const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment-intents");
router.post("/payment-intents", paymentController.payment_intents);

module.exports = router;
