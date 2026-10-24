const leaveService = require('../services/leave.service');

async function applyLeave(req, res, next) {
  try {
    const leave = await leaveService.applyLeave(req.user.id, req.body, req);
    res.status(201).json({ success: true, leave });
  } catch (err) {
    next(err);
  }
}

async function cancelLeave(req, res, next) {
  try {
    const cancelled = await leaveService.cancelLeave(req.user.id, req.params.id, req);
    res.json({ success: true, leave: cancelled });
  } catch (err) {
    next(err);
  }
}

async function getMyBalances(req, res, next) {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const balances = await leaveService.getEmployeeLeaveBalance(req.user.employee.id, year);
    res.json({ success: true, balances });
  } catch (err) {
    next(err);
  }
}

async function listRequests(req, res, next) {
  try {
    const { status, departmentId, employeeId, page, limit } = req.query;
    
    // If user is EMPLOYEE, restrict to their own requests
    const filterEmployeeId = req.user.role === 'EMPLOYEE' ? req.user.employee?.id : employeeId;

    const result = await leaveService.listLeaveRequests({
      status,
      departmentId,
      employeeId: filterEmployeeId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function reviewRequest(req, res, next) {
  try {
    const reviewed = await leaveService.reviewLeaveRequest(req.user, req.params.id, req.body, req);
    res.json({ success: true, leave: reviewed });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  applyLeave,
  cancelLeave,
  getMyBalances,
  listRequests,
  reviewRequest,
};
