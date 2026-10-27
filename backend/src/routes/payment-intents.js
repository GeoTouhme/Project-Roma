const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment-intents");
router.post("/payment-intents", require("../config/jwt"), paymentController.payment_intents);

module.exports = router;
