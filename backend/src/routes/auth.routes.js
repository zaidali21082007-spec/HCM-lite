const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { loginSchema, changePasswordSchema, createHrUserSchema } = require('../validators');
const { ROLES } = require('../config/constants');

router.post('/login', validate(loginSchema), authController.login);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.get('/me', authenticate, authController.getMe);

// Admin-only HR login management
router.post('/hr-users', authenticate, authorize(ROLES.ADMIN), validate(createHrUserSchema), authController.createHrUser);
router.get('/hr-users', authenticate, authorize(ROLES.ADMIN), authController.listHrUsers);
router.patch('/hr-users/:userId/status', authenticate, authorize(ROLES.ADMIN), authController.toggleUserActive);
router.post('/hr-users/:userId/reset-password', authenticate, authorize(ROLES.ADMIN), authController.resetUserPassword);

module.exports = router;
