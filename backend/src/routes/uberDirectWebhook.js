const express = require('express');
const router = express.Router();
const { handleUberDirectWebhook } = require('../controllers/uberDirectWebhook');

// Uber Direct sends webhooks — no JWT auth middleware
// Authentication is handled via HMAC-SHA256 signature verification in the controller
router.post('/webhooks/uberdirect', handleUberDirectWebhook);

module.exports = router;
