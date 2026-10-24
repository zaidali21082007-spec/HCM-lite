const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  employeeRegisterSchema,
  employeeSelfUpdateSchema,
  employeeHrUpdateSchema,
} = require('../validators');
const { ROLES } = require('../config/constants');

// Register employee (HR & Admin)
router.post('/register', authenticate, authorize(ROLES.ADMIN, ROLES.HR), validate(employeeRegisterSchema), employeeController.register);

// List employees (HR & Admin)
router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.HR), employeeController.list);

// CSV Export (HR & Admin)
router.get('/export/csv', authenticate, authorize(ROLES.ADMIN, ROLES.HR), employeeController.exportCsv);

// CSV Import dry-run & commit (HR & Admin)
router.post('/import/dry-run', authenticate, authorize(ROLES.ADMIN, ROLES.HR), employeeController.dryRunCsv);
router.post('/import/commit', authenticate, authorize(ROLES.ADMIN, ROLES.HR), employeeController.commitCsv);

// Self profile update (Employee only phone/address)
router.patch('/profile/self', authenticate, validate(employeeSelfUpdateSchema), employeeController.updateSelfProfile);

// Get single employee
router.get('/:id', authenticate, employeeController.getById);

// Update employee details (HR & Admin)
router.put('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.HR), validate(employeeHrUpdateSchema), employeeController.updateDetails);

module.exports = router;
