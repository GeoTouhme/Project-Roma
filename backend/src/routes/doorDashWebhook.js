const express = require('express');
const router = express.Router();
const { handleDoorDashWebhook } = require('../controllers/doorDashWebhook');

// DoorDash sends webhooks — no JWT auth middleware
// Authentication is configured in DoorDash Developer Portal (Basic Auth)
router.post('/webhooks/doordash', handleDoorDashWebhook);

module.exports = router;
