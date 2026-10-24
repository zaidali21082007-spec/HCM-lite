const express = require('express');
const router = express.Router();

const setupRoutes = require('./setup.routes');
const authRoutes = require('./auth.routes');
const companyRoutes = require('./company.routes');
const employeeRoutes = require('./employee.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRoutes = require('./leave.routes');
const payrollRoutes = require('./payroll.routes');
const dashboardRoutes = require('./dashboard.routes');
const announcementRoutes = require('./announcement.routes');
const notificationRoutes = require('./notification.routes');
const auditRoutes = require('./audit.routes');
const aiRoutes = require('./ai.routes');

router.use('/setup', setupRoutes);
router.use('/auth', authRoutes);
router.use('/company', companyRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/payroll', payrollRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/announcements', announcementRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit', auditRoutes);
router.use('/ai', aiRoutes);

module.exports = router;
