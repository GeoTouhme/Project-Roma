'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String, type: String, paymentId: String, amountRefunded: Number,
  fullyRefunded: Boolean, processedAt: Date,
}, { timestamps: true });
module.exports = mongoose.models.StripeEvent || mongoose.model('StripeEvent', schema);
