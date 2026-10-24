const announcementService = require('../services/announcement.service');

async function createAnnouncement(req, res, next) {
  try {
    const announcement = await announcementService.createAnnouncement(req.user, req.body, req);
    res.status(201).json({ success: true, announcement });
  } catch (err) {
    next(err);
  }
}

async function listAnnouncements(req, res, next) {
  try {
    const announcements = await announcementService.listAnnouncements();
    res.json({ success: true, announcements });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAnnouncement,
  listAnnouncements,
};
