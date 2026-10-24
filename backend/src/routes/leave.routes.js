const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { leaveApplySchema, leaveReviewSchema } = require('../validators');
const { ROLES } = require('../config/constants');

// Apply & cancel leave (Employee)
router.post('/apply', authenticate, validate(leaveApplySchema), leaveController.applyLeave);
router.post('/:id/cancel', authenticate, leaveController.cancelLeave);

// Leave types alias
router.get('/types', authenticate, (req, res, next) => require('../controllers/company.controller').getLeaveTypes(req, res, next));

// Leave balance
router.get('/balances/my', authenticate, leaveController.getMyBalances);

// List leave requests (role-aware: Employee sees own; HR/Admin sees filtered)
router.get('/requests', authenticate, leaveController.listRequests);

// Approve / reject leave (HR & Admin)
router.patch('/requests/:id/review', authenticate, authorize(ROLES.ADMIN, ROLES.HR), validate(leaveReviewSchema), leaveController.reviewRequest);

module.exports = router;
