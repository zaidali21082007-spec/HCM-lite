const setupService = require('../services/setup.service');

async function getSetupStatus(req, res, next) {
  try {
    const status = await setupService.getSetupStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
}

async function performSetup(req, res, next) {
  try {
    const result = await setupService.performInitialSetup(req.body, req);
    res.status(201).json({
      success: true,
      message: 'Initial setup completed successfully',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSetupStatus,
  performSetup,
};
