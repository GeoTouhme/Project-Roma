const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    paymentMethod: {
      type: String,
      required: [true, 'Payment Method is required.'],
      enum: ['Stripe', 'PayPal', 'COD'],
    },
    orderNo: {
      type: String,
      required: [true, 'Order No is required.'],
    },
    paymentId: {
      type: String,
    },
    subTotal: {
      type: Number,
      required: [true, 'Subtotal is required.'],
    },
    total: {
      type: Number,
      required: [true, 'Total is required.'],
    },
    totalItems: {
      type: Number,
      required: [true, 'Total items is required.'],
    },
    shipping: {
      type: Number,
      required: [true, 'ShippingFee is required.'],
    },
    discount: {
      type: Number,
    },
    tip: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
    },
    containsAlcohol: {
      type: Boolean,
      default: false,
    },
    deliveryId: {
      type: String,
    },
    trackingUrl: {
      type: String,
    },
    deliveryStatus: {
      type: String,
    },
    deliveryError: {
      type: String,
    },
    items: {
      type: Array,
    },
    user: {
      _id: {
        type: mongoose.Types.ObjectId, // Use ObjectId type
      },
      firstName: {
        type: String,
        required: [true, 'First name is required.'],
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required.'],
      },
      email: {
        type: String,
        required: [true, 'Email is required.'],
      },
      phone: {
        type: String,
        required: [true, 'Phone is required.'],
      },
      address: {
        type: String,
        required: [true, 'Address is required.'],
      },
      city: {
        type: String,
        required: [true, 'City is required.'],
      },
      zip: {
        type: String,
        required: [true, 'Postal code is required.'],
      },
      country: {
        type: String,
        required: [true, 'Country is required.'],
      },
      state: {
        type: String,
        required: [true, 'State is required.'],
      },
    },
  },
  {
    timestamps: true,
  }
);

OrderSchema.index({ paymentId: 1 }, { unique: true, sparse: true });

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
module.exports = Order;
