const mongoose = require('mongoose');

const PageViewSchema = new mongoose.Schema(
  {
    productSlug: {
      type: String,
      required: true,
      index: true,
    },
    productName: {
      type: String,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    referrer: {
      type: String,
    },
    source: {
      type: String,
      default: 'direct',
    },
    sessionId: {
      type: String,
      index: true,
    },
    pageType: {
      type: String,
      default: 'product',
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient analytics queries
PageViewSchema.index({ createdAt: -1, productSlug: 1 });

module.exports = mongoose.model('PageView', PageViewSchema);
