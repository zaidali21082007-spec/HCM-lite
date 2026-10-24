const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middlewares/auth.middleware');

router.get('/metrics', authenticate, dashboardController.getMetrics);

module.exports = router;
