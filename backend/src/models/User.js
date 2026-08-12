const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
      minlength: [8, 'Password must be at least 8 characters'],
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
      // Google sign-in users may not provide a phone immediately. It is enforced
      // at checkout and on the account page before an order can be placed.
      maxlength: [20, 'Phone cannot be more than 20 characters.'],
    },

    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },

    googleId: {
      type: String,
      sparse: true,
    },

    status: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      // Google-authenticated users are verified by Google; no local OTP is needed.
      default: null,
    },
    // 🛡️ OTP security: expiration and failed-attempt lockout.
    otpExpiresAt: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },

    // 🛡️ Multi-factor authentication (TOTP / Authenticator app)
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    // AES-256-GCM encrypted TOTP secret (base32)
    mfaSecret: {
      type: String,
      default: null,
    },
    // Temporary secret while enrollment is in progress (not active until confirmed)
    mfaTempSecret: {
      type: String,
      default: null,
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

// Hash the password before saving. Google-authenticated users receive a random
// placeholder password; if for any reason it is absent, skip hashing.
UserSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password') || !this.password) {
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
