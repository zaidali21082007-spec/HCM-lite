const employeeService = require('../services/employee.service');

async function register(req, res, next) {
  try {
    const result = await employeeService.registerEmployee(req.user, req.body, req);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { departmentId, status, search, page, limit } = req.query;
    const result = await employeeService.listEmployees({
      departmentId,
      status,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const employee = await employeeService.getEmployeeById(req.params.id, req.user);
    res.json({ success: true, employee });
  } catch (err) {
    next(err);
  }
}

async function updateDetails(req, res, next) {
  try {
    const updated = await employeeService.updateEmployeeDetails(req.user, req.params.id, req.body, req);
    res.json({ success: true, employee: updated });
  } catch (err) {
    next(err);
  }
}

async function updateSelfProfile(req, res, next) {
  try {
    const updated = await employeeService.updateEmployeeSelfProfile(req.user.id, req.body, req);
    res.json({ success: true, employee: updated });
  } catch (err) {
    next(err);
  }
}

async function dryRunCsv(req, res, next) {
  try {
    const rows = req.body.rows || [];
    const result = await employeeService.dryRunCsvImport(rows);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function commitCsv(req, res, next) {
  try {
    const rows = req.body.rows || [];
    const result = await employeeService.commitCsvImport(req.user, rows, req);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function exportCsv(req, res, next) {
  try {
    const csvData = await employeeService.exportEmployeesCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employees_export.csv"');
    res.send(csvData);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  list,
  getById,
  updateDetails,
  updateSelfProfile,
  dryRunCsv,
  commitCsv,
  exportCsv,
};
