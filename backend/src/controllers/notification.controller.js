const notificationService = require('../services/notification.service');

async function getMyNotifications(req, res, next) {
  try {
    const notifications = await notificationService.getUserNotifications(req.user.id);
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    await notificationService.markNotificationAsRead(req.params.id, req.user.id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    await notificationService.markAllNotificationsAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
