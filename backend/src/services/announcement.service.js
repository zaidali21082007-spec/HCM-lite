const prisma = require('../config/prisma');
const { AUDIT_ACTIONS } = require('../config/constants');
const { logAudit } = require('./audit.service');

async function createAnnouncement(actor, { title, content, priority = 'MEDIUM' }, req = null) {
  const actorName = actor.employee
    ? `${actor.employee.firstName} ${actor.employee.lastName}`
    : actor.role === 'ADMIN'
    ? 'System Administrator'
    : actor.email;

  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      priority,
      authorId: actor.id,
      authorName: actorName,
      authorRole: actor.role,
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'ANNOUNCEMENT',
    entityId: announcement.id,
    after: { title, priority },
    req,
  });

  return announcement;
}

async function listAnnouncements() {
  return await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

module.exports = {
  createAnnouncement,
  listAnnouncements,
};
