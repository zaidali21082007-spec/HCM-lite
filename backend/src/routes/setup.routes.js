const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setup.controller');
const validate = require('../middlewares/validate.middleware');
const { setupSchema } = require('../validators');

router.get('/status', setupController.getSetupStatus);
router.post('/initial', validate(setupSchema), setupController.performSetup);

module.exports = router;
