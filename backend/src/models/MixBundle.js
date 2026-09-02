const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: [true, 'Condition field is required'],
    enum: ['category', 'size', 'brand', 'tag'],
  },
  operator: {
    type: String,
    required: true,
    enum: ['equals', 'in'],
    default: 'equals',
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator(value) {
        if (Array.isArray(value)) return value.length > 0 && value.every((v) => typeof v === 'string' && v.trim());
        return typeof value === 'string' && value.trim().length > 0;
      },
      message: 'Condition value must be a non-empty string or array of strings',
    },
  },
}, { _id: true });

const mixBundleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    conditions: {
      type: [conditionSchema],
      required: [true, 'At least one condition is required'],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'At least one condition is required',
      },
    },
    requiredQty: { type: Number, required: true, min: 1 },
    bundlePrice: { type: Number, required: true, min: 0 },
    startAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

mixBundleSchema.index({ status: 1, startAt: 1, expiresAt: 1 });

module.exports = mongoose.model('MixBundle', mixBundleSchema);
