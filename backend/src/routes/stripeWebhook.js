const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../controllers/stripeWebhook');

// Stripe webhook endpoint — must NOT use bodyParser.json() so the raw body is preserved.
// The raw body buffer is attached by the verify hook in src/index.js.
router.post('/stripe', handleStripeWebhook);

module.exports = router;
