const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String, owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  claimedAt: Date, claimToken: { type: String, select: false }, orderId: mongoose.Schema.Types.ObjectId,
  cartHash: { type: String, required: true }, amount: Number, currency: String, paymentId: String,
}, { timestamps: true });
module.exports = mongoose.models.Checkout || mongoose.model('Checkout', schema);
