const attendanceService = require('../services/attendance.service');

async function checkIn(req, res, next) {
  try {
    const attendance = await attendanceService.checkIn(req.user.id, req.body, req);
    res.status(201).json({
      success: true,
      attendance,
      status: attendance.status,
      distanceMeters: attendance.distanceMeters,
      remarks: attendance.remarks,
    });
  } catch (err) {
    next(err);
  }
}

async function checkOut(req, res, next) {
  try {
    const attendance = await attendanceService.checkOut(req.user.id, req.body, req);
    res.json({ success: true, attendance });
  } catch (err) {
    next(err);
  }
}

async function getDailyBoard(req, res, next) {
  try {
    const { date, departmentId } = req.query;
    const board = await attendanceService.getDailyAttendanceBoard(date, departmentId);
    res.json({ success: true, ...board });
  } catch (err) {
    next(err);
  }
}

async function getMyAttendance(req, res, next) {
  try {
    const now = new Date();
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const records = await attendanceService.getEmployeeAttendance(req.user.employee.id, year, month);
    res.json({ success: true, records });
  } catch (err) {
    next(err);
  }
}

async function requestCorrection(req, res, next) {
  try {
    const correction = await attendanceService.requestCorrection(req.user.id, req.body, req);
    res.status(201).json({ success: true, correction });
  } catch (err) {
    next(err);
  }
}

async function listPendingCorrections(req, res, next) {
  try {
    const corrections = await attendanceService.listPendingCorrections(req.query.departmentId);
    res.json({ success: true, corrections });
  } catch (err) {
    next(err);
  }
}

async function reviewCorrection(req, res, next) {
  try {
    const reviewed = await attendanceService.reviewCorrection(req.user, req.params.id, req.body, req);
    res.json({ success: true, correction: reviewed });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkIn,
  checkOut,
  getDailyBoard,
  getMyAttendance,
  requestCorrection,
  listPendingCorrections,
  reviewCorrection,
};
