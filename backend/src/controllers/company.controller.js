const companyService = require('../services/company.service');

async function getSettings(req, res, next) {
  try {
    const settings = await companyService.getCompanySettings();
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const settings = await companyService.updateCompanySettings(req.user, req.body, req);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

async function getDepartments(req, res, next) {
  try {
    const departments = await companyService.getDepartments();
    res.json({ success: true, departments });
  } catch (err) {
    next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    const dept = await companyService.createDepartment(req.user, req.body, req);
    res.status(201).json({ success: true, department: dept });
  } catch (err) {
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const deleted = await companyService.deleteDepartment(req.user, req.params.id, req);
    res.json({ success: true, deleted });
  } catch (err) {
    next(err);
  }
}

async function getDesignations(req, res, next) {
  try {
    const designations = await companyService.getDesignations();
    res.json({ success: true, designations });
  } catch (err) {
    next(err);
  }
}

async function createDesignation(req, res, next) {
  try {
    const des = await companyService.createDesignation(req.user, req.body, req);
    res.status(201).json({ success: true, designation: des });
  } catch (err) {
    next(err);
  }
}

async function deleteDesignation(req, res, next) {
  try {
    const deleted = await companyService.deleteDesignation(req.user, req.params.id, req);
    res.json({ success: true, deleted });
  } catch (err) {
    next(err);
  }
}

async function getLeaveTypes(req, res, next) {
  try {
    const leaveTypes = await companyService.getLeaveTypes();
    res.json({ success: true, leaveTypes });
  } catch (err) {
    next(err);
  }
}

async function createLeaveType(req, res, next) {
  try {
    const lt = await companyService.createLeaveType(req.user, req.body, req);
    res.status(201).json({ success: true, leaveType: lt });
  } catch (err) {
    next(err);
  }
}

async function updateLeaveType(req, res, next) {
  try {
    const lt = await companyService.updateLeaveType(req.user, req.params.id, req.body, req);
    res.json({ success: true, leaveType: lt });
  } catch (err) {
    next(err);
  }
}

async function getHolidays(req, res, next) {
  try {
    const holidays = await companyService.getHolidays(req.query.year ? Number(req.query.year) : null);
    res.json({ success: true, holidays });
  } catch (err) {
    next(err);
  }
}

async function createHoliday(req, res, next) {
  try {
    const holiday = await companyService.createHoliday(req.user, req.body, req);
    res.status(201).json({ success: true, holiday });
  } catch (err) {
    next(err);
  }
}

async function deleteHoliday(req, res, next) {
  try {
    const deleted = await companyService.deleteHoliday(req.user, req.params.id, req);
    res.json({ success: true, deleted });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  getDepartments,
  createDepartment,
  deleteDepartment,
  getDesignations,
  createDesignation,
  deleteDesignation,
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  getHolidays,
  createHoliday,
  deleteHoliday,
};
