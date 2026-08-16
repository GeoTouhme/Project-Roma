const mongoose = require('mongoose');

const DealSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    productIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    ],
    quantity: { type: Number, required: true, min: 1 },
    bundlePrice: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, default: null },
    startAt: { type: Date, default: Date.now },
    displayOnHome: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Deal || mongoose.model('Deal', DealSchema);
