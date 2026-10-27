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
      // 🛡️ SECURITY: basic RFC-lite format gate — blocks garbage strings
      // that would otherwise persist and pollute OTP/coupon email flows.
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please enter a valid email address'],
      lowercase: true,
      trim: true,
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
      select: false,
      type: String,
      // Google-authenticated users are verified by Google; no local OTP is needed.
      default: null,
    },
    // 🛡️ OTP security: expiration and failed-attempt lockout.
    otpExpiresAt: {
      select: false,
      type: Date,
    },
    otpAttempts: {
      select: false,
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
      select: false,
      type: String,
      default: null,
    },
    // Temporary secret while enrollment is in progress (not active until confirmed)
    mfaTempSecret: {
      select: false,
      type: String,
      default: null,
    },
    lastOtpSentAt: {
      select: false,
      type: Date,
    },

    // 🛡️ SECURITY: Refresh token rotation — raw token is stored as a SHA-256
    // hash so a leaked DB dump cannot be used to forge new sessions.
    // On every /auth/refresh call the old hash is replaced with a new one
    // (rotation). If a previously-used token is presented, both hash and expiry
    // will fail, triggering an immediate forced logout (theft detection).
    refreshTokenHash: {
      type: String,
      default: null,
      select: false, // never returned in normal queries
    },
    refreshTokenExpiresAt: {
      select: false,
      type: Date,
      default: null,
    },
    // Reject refresh sessions created before purpose-separated authentication.
    authSessionId: { type: String, select: false },
    refreshTokenVersion: { type: Number, default: 0, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetTokenExpiresAt: { type: Date, select: false },

    role: {
      type: String,
      enum: ['super admin', 'admin', 'user'],
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { transform(doc, ret) {
      for (const key of ['authSessionId', 'password', 'otp', 'otpExpiresAt', 'otpAttempts', 'lastOtpSentAt', 'mfaSecret', 'mfaTempSecret', 'refreshTokenHash', 'refreshTokenExpiresAt', 'refreshTokenVersion', 'passwordResetTokenHash', 'passwordResetTokenExpiresAt']) delete ret[key];
      return ret;
    } },
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
