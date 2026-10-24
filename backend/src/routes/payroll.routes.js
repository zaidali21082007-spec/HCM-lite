const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { payrollDraftSchema } = require('../validators');
const { ROLES } = require('../config/constants');

// List payroll runs
router.get('/runs', authenticate, authorize(ROLES.ADMIN, ROLES.HR), payrollController.listRuns);
router.get('/runs/:id', authenticate, authorize(ROLES.ADMIN, ROLES.HR), payrollController.getRunById);

// Generate draft (Admin & HR)
router.post('/runs/draft', authenticate, authorize(ROLES.ADMIN, ROLES.HR), validate(payrollDraftSchema), payrollController.generateDraft);

// Finalize run (Admin only - locks month!)
router.post('/runs/:id/finalize', authenticate, authorize(ROLES.ADMIN), payrollController.finalizeRun);

// Employee payslips
router.get('/my-payslips', authenticate, payrollController.getMyPayslips);

// PDF payslip download
router.get('/runs/:runId/employees/:employeeId/pdf', authenticate, payrollController.downloadPayslipPDF);

module.exports = router;
