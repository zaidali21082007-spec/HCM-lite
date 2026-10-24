const payrollService = require('../services/payroll.service');

async function listRuns(req, res, next) {
  try {
    const runs = await payrollService.listPayrollRuns();
    res.json({ success: true, runs });
  } catch (err) {
    next(err);
  }
}

async function getRunById(req, res, next) {
  try {
    const run = await payrollService.getPayrollRunById(req.params.id, req.user);
    res.json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

async function generateDraft(req, res, next) {
  try {
    const run = await payrollService.generatePayrollDraft(req.user, req.body, req);
    res.status(201).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

async function finalizeRun(req, res, next) {
  try {
    const finalized = await payrollService.finalizePayroll(req.user, req.params.id, req);
    res.json({ success: true, run: finalized });
  } catch (err) {
    next(err);
  }
}

async function getMyPayslips(req, res, next) {
  try {
    const payslips = await payrollService.getEmployeePayslips(req.user.employee.id);
    res.json({ success: true, payslips });
  } catch (err) {
    next(err);
  }
}

async function downloadPayslipPDF(req, res, next) {
  try {
    const { runId, employeeId } = req.params;
    if (req.user.role === 'EMPLOYEE' && req.user.employee?.id !== employeeId) {
      const error = new Error("Access denied: You cannot view or download another employee's payslip");
      error.statusCode = 403;
      throw error;
    }
    const targetEmpId = employeeId;

    const pdfBuffer = await payrollService.getPayslipPDFBuffer(runId, targetEmpId, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="payslip_${runId}_${targetEmpId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRuns,
  getRunById,
  generateDraft,
  finalizeRun,
  getMyPayslips,
  downloadPayslipPDF,
};
