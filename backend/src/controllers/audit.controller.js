const auditService = require('../services/audit.service');

async function getLogs(req, res, next) {
  try {
    const { entity, action, actorEmail, startDate, endDate, limit, page } = req.query;
    const result = await auditService.getAuditLogs({
      entity,
      action,
      actorEmail,
      startDate,
      endDate,
      limit: limit ? Number(limit) : 50,
      page: page ? Number(page) : 1,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLogs,
};
