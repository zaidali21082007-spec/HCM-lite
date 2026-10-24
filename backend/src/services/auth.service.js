const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { ROLES, AUDIT_ACTIONS } = require('../config/constants');
const { logAudit } = require('./audit.service');

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      employee: {
        include: {
          department: true,
          designation: true,
        },
      },
    },
  });

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('Account has been deactivated. Please contact your administrator.');
    error.statusCode = 403;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const secret = process.env.JWT_SECRET || 'hcm_lite_jwt_super_secret_key_2026_x89';
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isTemporaryPassword: user.isTemporaryPassword,
      employee: user.employee,
    },
  };
}

async function changePassword(userId, { currentPassword, newPassword }, req = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Current password does not match');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      isTemporaryPassword: false,
    },
  });

  await logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'USER_PASSWORD',
    entityId: user.id,
    req,
  });

  return { success: true, message: 'Password successfully updated' };
}

async function createHrUser(actor, { email, password }, req = null) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: ROLES.HR,
      isActive: true,
      isTemporaryPassword: true,
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'HR_USER',
    entityId: newUser.id,
    after: { email: newUser.email, role: newUser.role },
    req,
  });

  return {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    isActive: newUser.isActive,
    createdAt: newUser.createdAt,
  };
}

async function listHrUsers() {
  return await prisma.user.findMany({
    where: { role: ROLES.HR },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      isTemporaryPassword: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function toggleUserActive(actor, userId, isActive, req = null) {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetUser.role === ROLES.ADMIN) {
    const error = new Error('Cannot deactivate the Admin account');
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'USER_STATUS',
    entityId: targetUser.id,
    before: { isActive: targetUser.isActive },
    after: { isActive },
    req,
  });

  return updated;
}

async function resetUserPassword(actor, userId, newPassword, req = null) {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      isTemporaryPassword: true,
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'USER_PASSWORD_RESET',
    entityId: targetUser.id,
    req,
  });

  return { success: true, message: 'Password reset successfully. User must change on next login.' };
}

module.exports = {
  login,
  changePassword,
  createHrUser,
  listHrUsers,
  toggleUserActive,
  resetUserPassword,
};
