const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required.'],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required.'],
    },
    review: {
      type: String,
      required: [true, 'Review is required.'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required.'],
    },
    isPurchased: {
      type: Boolean,
      required: [true, 'isPurchased is required.'],
    },
    images: [
      {
        url: {
          type: String,
          // required: [true, 'image-id-required-error'],
        },

        blurDataURL: {
          type: String,
          // required: [true, 'image-blur-data-url-required-error'],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Check if the model is already defined
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

module.exports = Review;
