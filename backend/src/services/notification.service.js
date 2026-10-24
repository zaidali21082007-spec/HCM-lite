const prisma = require('../config/prisma');

async function createNotification({ userId, title, message, type = 'SYSTEM', link = null }) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

async function getUserNotifications(userId) {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

async function markNotificationAsRead(id, userId) {
  return await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
}

async function markAllNotificationsAsRead(userId) {
  return await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
