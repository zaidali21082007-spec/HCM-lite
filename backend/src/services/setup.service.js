const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { ROLES, AUDIT_ACTIONS } = require('../config/constants');
const { logAudit } = require('./audit.service');

async function getSetupStatus() {
  const company = await prisma.companySetting.findFirst();
  const adminCount = await prisma.user.count({ where: { role: ROLES.ADMIN } });
  
  return {
    isConfigured: !!(company && company.setupCompleted && adminCount > 0),
    companyName: company?.companyName || null,
  };
}

async function performInitialSetup(data, req = null) {
  const existingCompany = await prisma.companySetting.findFirst();
  const adminCount = await prisma.user.count({ where: { role: ROLES.ADMIN } });

  if (existingCompany?.setupCompleted && adminCount > 0) {
    const error = new Error('Setup has already been completed for this system.');
    error.statusCode = 400;
    throw error;
  }

  const {
    companyName,
    adminEmail,
    adminPassword,
    officeStartTime = '09:00',
    officeEndTime = '18:00',
    graceMinutes = 15,
    officeLatitude = null,
    officeLongitude = null,
    officeRadiusMeters = null,
  } = data;

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Company Settings
    let company;
    if (existingCompany) {
      company = await tx.companySetting.update({
        where: { id: existingCompany.id },
        data: {
          companyName,
          officeStartTime,
          officeEndTime,
          graceMinutes,
          officeLatitude,
          officeLongitude,
          officeRadiusMeters,
          setupCompleted: true,
        },
      });
    } else {
      company = await tx.companySetting.create({
        data: {
          companyName,
          officeStartTime,
          officeEndTime,
          graceMinutes,
          officeLatitude,
          officeLongitude,
          officeRadiusMeters,
          setupCompleted: true,
        },
      });
    }

    // 2. Admin User
    const adminUser = await tx.user.upsert({
      where: { email: adminEmail.toLowerCase() },
      update: {
        passwordHash,
        role: ROLES.ADMIN,
        isActive: true,
        isTemporaryPassword: false,
      },
      create: {
        email: adminEmail.toLowerCase(),
        passwordHash,
        role: ROLES.ADMIN,
        isActive: true,
        isTemporaryPassword: false,
      },
    });

    // 3. Seed Default Leave Types
    const defaultLeaveTypes = [
      { name: 'Annual Leave', code: 'ANNUAL', annualQuota: 14, isUnpaid: false },
      { name: 'Sick Leave', code: 'SICK', annualQuota: 8, isUnpaid: false },
      { name: 'Casual Leave', code: 'CASUAL', annualQuota: 10, isUnpaid: false },
      { name: 'Unpaid Leave', code: 'UNPAID', annualQuota: 0, isUnpaid: true },
    ];

    for (const lt of defaultLeaveTypes) {
      await tx.leaveType.upsert({
        where: { code: lt.code },
        update: {},
        create: lt,
      });
    }

    // 4. Seed Default Departments
    const defaultDepartments = [
      { name: 'Engineering', code: 'ENG', description: 'Software Development & Architecture' },
      { name: 'Human Resources', code: 'HR', description: 'Talent Acquisition & Employee Operations' },
      { name: 'Sales & Marketing', code: 'SM', description: 'Business Growth & Client Relations' },
      { name: 'Finance & Operations', code: 'FIN', description: 'Accounting and Financial Compliance' },
    ];

    for (const dept of defaultDepartments) {
      await tx.department.upsert({
        where: { code: dept.code },
        update: {},
        create: dept,
      });
    }

    // 5. Seed Default Designations
    const defaultDesignations = [
      { title: 'Software Engineer', description: 'Full Stack & Backend Development' },
      { title: 'Senior Software Engineer', description: 'System Architecture & Engineering' },
      { title: 'HR Manager', description: 'HR Administration & Employee Relations' },
      { title: 'Account Executive', description: 'Revenue & Account Management' },
      { title: 'Financial Analyst', description: 'Budgeting & Financial Reporting' },
    ];

    for (const des of defaultDesignations) {
      await tx.designation.upsert({
        where: { title: des.title },
        update: {},
        create: des,
      });
    }

    return { company, adminUser };
  });

  await logAudit({
    actor: { id: result.adminUser.id, email: result.adminUser.email, role: ROLES.ADMIN },
    action: AUDIT_ACTIONS.CREATE,
    entity: 'COMPANY_SETUP',
    entityId: result.company.id,
    after: { companyName, adminEmail },
    req,
  });

  const secret = process.env.JWT_SECRET || 'hcm_lite_jwt_super_secret_key_2026_x89';
  const token = jwt.sign(
    { userId: result.adminUser.id, email: result.adminUser.email, role: result.adminUser.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: result.adminUser.id,
      email: result.adminUser.email,
      role: result.adminUser.role,
      isTemporaryPassword: false,
    },
    company: result.company,
  };
}

module.exports = {
  getSetupStatus,
  performInitialSetup,
};
