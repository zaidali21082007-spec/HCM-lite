const dashboardService = require('../services/dashboard.service');

async function getMetrics(req, res, next) {
  try {
    const { departmentId, startDate, endDate } = req.query;
    const metrics = await dashboardService.getDashboardMetrics({
      departmentId,
      startDate,
      endDate,
      requestingUser: req.user,
    });
    res.json({ success: true, metrics });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMetrics,
};
