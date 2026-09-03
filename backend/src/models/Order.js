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
    tax: {
      type: Number,
      default: 0,
    },
    markup: {
      type: Number,
      default: 0,
    },
    taxRateSnapshot: {
      type: Number,
      default: 0.0775,
    },
    markupRateSnapshot: {
      type: Number,
      default: 0.02,
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
      enum: ['pending', 'processing', 'payment_failed', 'accepted', 'shipped', 'delivered', 'cancelled', 'disputed', 'refunded'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded', 'disputed'],
      default: 'pending',
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    fulfillmentType: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
      required: true,
    },
    pickupNote: {
      type: String,
      default: '',
    },
    containsAlcohol: {
      type: Boolean,
      default: false,
    },
    deliveryProvider: {
      type: String,
      enum: ['doordash', 'uberdirect', 'store'],
      default: 'store',
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
    estimatedPickupTime: {
      type: String,
    },
    estimatedDeliveryTime: {
      type: String,
    },
    // Staff order-acceptance workflow fields
    staffDenialReason: {
      type: String,
    },
    staffAcceptedAt: {
      type: Date,
    },
    staffDeniedAt: {
      type: Date,
    },
    staffActionBy: {
      _id: {
        type: mongoose.Types.ObjectId,
      },
      name: {
        type: String,
      },
    },
    staffNotes: {
      type: String,
    },
    // Refund and cancellation tracking
    refundId: {
      type: String,
    },
    refundAmount: {
      type: Number,
    },
    refundError: {
      type: String,
    },
    customerCancellationReason: {
      type: String,
    },
    clientIp: {
      type: String,
      default: '',
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
        default: '',
      },
      city: {
        type: String,
        default: '',
      },
      zip: {
        type: String,
        default: '',
      },
      country: {
        type: String,
        default: 'US',
      },
      state: {
        type: String,
        default: 'CA',
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
