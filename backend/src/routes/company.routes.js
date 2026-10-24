const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  companySettingsSchema,
  departmentSchema,
  designationSchema,
  leaveTypeSchema,
  holidaySchema,
} = require('../validators');
const { ROLES } = require('../config/constants');

// Settings
router.get('/settings', authenticate, companyController.getSettings);
router.put('/settings', authenticate, authorize(ROLES.ADMIN), validate(companySettingsSchema), companyController.updateSettings);

// Departments
router.get('/departments', authenticate, companyController.getDepartments);
router.post('/departments', authenticate, authorize(ROLES.ADMIN), validate(departmentSchema), companyController.createDepartment);
router.delete('/departments/:id', authenticate, authorize(ROLES.ADMIN), companyController.deleteDepartment);

// Designations
router.get('/designations', authenticate, companyController.getDesignations);
router.post('/designations', authenticate, authorize(ROLES.ADMIN), validate(designationSchema), companyController.createDesignation);
router.delete('/designations/:id', authenticate, authorize(ROLES.ADMIN), companyController.deleteDesignation);

// Leave Types
router.get('/leave-types', authenticate, companyController.getLeaveTypes);
router.post('/leave-types', authenticate, authorize(ROLES.ADMIN), validate(leaveTypeSchema), companyController.createLeaveType);
router.put('/leave-types/:id', authenticate, authorize(ROLES.ADMIN), companyController.updateLeaveType);

// Holidays
router.get('/holidays', authenticate, companyController.getHolidays);
router.post('/holidays', authenticate, authorize(ROLES.ADMIN), validate(holidaySchema), companyController.createHoliday);
router.delete('/holidays/:id', authenticate, authorize(ROLES.ADMIN), companyController.deleteHoliday);

module.exports = router;
