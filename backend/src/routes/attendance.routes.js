const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  attendanceCorrectionSchema,
  correctionReviewSchema,
} = require('../validators');
const { ROLES } = require('../config/constants');

// Web check-in / check-out (Employee only)
router.post('/check-in', authenticate, authorize(ROLES.EMPLOYEE), validate(attendanceCheckInSchema), attendanceController.checkIn);
router.post('/check-out', authenticate, authorize(ROLES.EMPLOYEE), validate(attendanceCheckOutSchema), attendanceController.checkOut);

// Own attendance calendar
router.get('/my', authenticate, attendanceController.getMyAttendance);

// Attendance corrections
router.post('/corrections', authenticate, validate(attendanceCorrectionSchema), attendanceController.requestCorrection);
router.get('/corrections/pending', authenticate, authorize(ROLES.ADMIN, ROLES.HR), attendanceController.listPendingCorrections);
router.patch('/corrections/:id/review', authenticate, authorize(ROLES.ADMIN, ROLES.HR), validate(correctionReviewSchema), attendanceController.reviewCorrection);

// Daily attendance board (HR & Admin)
router.get('/board', authenticate, authorize(ROLES.ADMIN, ROLES.HR), attendanceController.getDailyBoard);

module.exports = router;
