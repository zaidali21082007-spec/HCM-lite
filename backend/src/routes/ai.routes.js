const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

// Chat panel for all authenticated roles
router.post('/chat', authenticate, aiController.chat);

// Smart leave parsing for Employee and HR
router.post('/smart-leave', authenticate, authorize(ROLES.EMPLOYEE, ROLES.HR), aiController.smartLeave);

// Dashboard summary for Admin and HR
router.post('/dashboard-summary', authenticate, authorize(ROLES.ADMIN, ROLES.HR), aiController.dashboardSummary);

module.exports = router;
