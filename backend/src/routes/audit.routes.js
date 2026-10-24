const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

// Audit logs are strictly viewable only by Admin, and immutable (no delete/update routes!)
router.get('/', authenticate, authorize(ROLES.ADMIN), auditController.getLogs);

module.exports = router;
