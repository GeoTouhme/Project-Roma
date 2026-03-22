const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Please enter a firstName'],
    },
    lastName: {
      type: String,
      required: [true, 'Please enter a lastName'],
    },
    email: {
      type: String,
      required: [true, 'Please enter an email'],
      unique: true,
    },
    password: {
      type: String,
      select: false,
      required: [true, 'Please enter a password'],
      minlength: 8,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Please enter a gender'],
    },
    cover: {
      _id: {
        type: String,
      },
      url: { type: String },
      blurDataURL: {
        type: String,
      },
    },
    wishlist: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
      },
    ],
    orders: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Order',
      },
    ],
    shop: { type: mongoose.Types.ObjectId, ref: 'SHop' },
    recentProducts: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
      },
    ],
    phone: {
      type: String,
      required: [true, 'Please provide a Phone Number.'],
      maxlength: [20, 'Phone cannot be more than 20 characters.'],
    },

    status: {
      type: String,
    },
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    zip: {
      type: String,
    },
    country: {
      type: String,
    },
    state: {
      type: String,
    },
    about: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      required: true,
    },
    lastOtpSentAt: {
      type: Date,
    },
    role: {
      type: String,
      enum: ['super admin', 'admin', 'user'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash the password before saving
UserSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    return next();
  } catch (error) {
    return next(error);
  }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
module.exports = User;
