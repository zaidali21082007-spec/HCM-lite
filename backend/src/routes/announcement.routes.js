const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { announcementSchema } = require('../validators');
const { ROLES } = require('../config/constants');

router.get('/', authenticate, announcementController.listAnnouncements);
router.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.HR), validate(announcementSchema), announcementController.createAnnouncement);

module.exports = router;
