const mongoose = require('mongoose');

// Interface representing a single document in the Notifications collection
const NotificationsSchema = new mongoose.Schema(
  {
    opened: {
      type: Boolean,
      required: [true, 'Open is required.'],
    },
    title: {
      type: String,
      required: [true, 'Title is required.'],
    },
    orderId: {
      type: String,
      required: [true, 'Order Id is required.'],
    },
    cover: {
      _id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    city: {
      type: String,
      required: [true, 'City is required.'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment Method is required.'],
      enum: ['Stripe', 'PayPal', 'COD'],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

// Export the Notifications model based on the NotificationsSchema
const Notifications =
  mongoose.models.Notifications ||
  mongoose.model('Notifications', NotificationsSchema);
module.exports = Notifications;
