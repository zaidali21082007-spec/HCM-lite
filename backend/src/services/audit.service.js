const prisma = require('../config/prisma');

async function logAudit({
  actor,
  action,
  entity,
  entityId = null,
  before = null,
  after = null,
  req = null,
}) {
  try {
    const actorId = actor?.id || 'SYSTEM';
    const actorEmail = actor?.email || 'system@hcmlite.local';
    const actorRole = actor?.role || 'SYSTEM';

    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    const record = await prisma.auditLog.create({
      data: {
        actorId,
        actorEmail,
        actorRole,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        beforeJson: before ? JSON.stringify(before) : null,
        afterJson: after ? JSON.stringify(after) : null,
        ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
      },
    });

    return record;
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Audit logging failure should not crash the request, but log it
    return null;
  }
}

async function getAuditLogs({ entity, action, actorEmail, startDate, endDate, limit = 100, page = 1 }) {
  const where = {};

  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (actorEmail) where.actorEmail = { contains: actorEmail };

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    logs,
  };
}

module.exports = {
  logAudit,
  getAuditLogs,
};
