const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
  {
    sourceProduct: {
      type: mongoose.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Source product is required.'],
    },
    targetProduct: {
      type: mongoose.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Target product is required.'],
    },
    source: {
      type: String,
      enum: ['physical_basket', 'online_order'],
      required: [true, 'Source type is required.'],
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// A product should only have one association record with another product per source.
recommendationSchema.index(
  { sourceProduct: 1, targetProduct: 1, source: 1 },
  { unique: true }
);

// Fast lookups for recommendations ordered by strength.
recommendationSchema.index({ sourceProduct: 1, source: 1, score: -1 });
recommendationSchema.index({ targetProduct: 1, source: 1, score: -1 });

const Recommendation =
  mongoose.models.Recommendation ||
  mongoose.model('Recommendation', recommendationSchema);

module.exports = Recommendation;
