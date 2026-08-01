const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Products = require('../models/Product');
const sendEmail = require('../utils/mailer');
const { emitToAdmins } = require('../utils/socketManager');

const TOKEN_COOKIE_NAME = 'token';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

/**
 * 🛡️ SECURITY: Issue auth token as an HttpOnly, Secure, SameSite=Strict cookie.
 * Reuses the same cookie settings as the email/password auth controller so
 * Google users receive an identical session.
 */
function getCookieDomain() {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const frontendUrl = process.env.FRONTEND_URL || '';
  try {
    const hostname = new URL(frontendUrl).hostname;
    if (hostname && !hostname.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return `.${parts.slice(-2).join('.')}`;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

function setAuthCookie(res, token, maxAgeMs) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: '/',
  };
  const domain = getCookieDomain();
  if (domain) {
    cookieOptions.domain = domain;
  }
  res.cookie(TOKEN_COOKIE_NAME, token, cookieOptions);
}

// Build the same wishlist response shape used in the password login flow.
async function getWishlistProducts(wishlistIds) {
  if (!wishlistIds || wishlistIds.length === 0) return [];
  return Products.aggregate([
    {
      $match: {
        _id: { $in: wishlistIds },
        status: { $nin: ['disabled', 'inactive'] },
        available: { $gt: 0 },
      },
    },
    {
      $lookup: {
        from: 'reviews',
        localField: 'reviews',
        foreignField: '_id',
        as: 'reviews',
      },
    },
    {
      $addFields: {
        averageRating: { $avg: '$reviews.rating' },
        image: { $arrayElemAt: ['$images', 0] },
      },
    },
    {
      $project: {
        image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
        name: 1,
        slug: 1,
        colors: 1,
        discount: 1,
        available: 1,
        likes: 1,
        priceSale: 1,
        price: 1,
        averageRating: 1,
        createdAt: 1,
      },
    },
  ]);
}

/**
 * POST /api/auth/google
 * Receives a Google ID token from the frontend, verifies it, and either creates
 * a new user or links to an existing email/password account when Google has
 * verified the email address.
 */
const googleAuth = async (req, res) => {
  try {
    const { idToken, provider = 'google' } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ success: false, message: 'Google ID token is required.' });
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error('❌ GOOGLE_CLIENT_ID is not configured on the server.');
      return res.status(500).json({ success: false, message: 'Google sign-in is not configured.' });
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('❌ Google ID token verification failed:', verifyError.message);
      return res.status(401).json({ success: false, message: 'Invalid Google session. Please try again.' });
    }

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ success: false, message: 'Unable to read Google profile.' });
    }

    const { sub: googleId, email, email_verified, given_name: firstName, family_name: lastName, picture } = payload;

    if (!email || !email_verified) {
      return res.status(400).json({ success: false, message: 'Google account must have a verified email address.' });
    }

    const safeEmail = email.toLowerCase().trim();

    // Try to find an existing user by Google ID or verified email.
    let user = await User.findOne({ $or: [{ googleId }, { email: safeEmail }] });
    let isNewUser = false;

    if (user) {
      // If the user was created via email/password but has no googleId, link the
      // Google identity because Google has already verified email ownership.
      if (!user.googleId) {
        user.googleId = googleId;
        user.provider = 'google';
        // Ensure the user is marked verified since Google validated the email.
        if (!user.isVerified) {
          user.isVerified = true;
        }
        await user.save();
      }
    } else {
      // Create a new Google-authenticated user.
      isNewUser = true;
      const placeholderPassword = crypto.randomBytes(32).toString('hex');

      user = await User.create({
        firstName: firstName || '',
        lastName: lastName || '',
        email: safeEmail,
        password: placeholderPassword,
        phone: '',
        role: 'user',
        isVerified: true,
        provider: 'google',
        googleId,
        cover: picture ? { url: picture } : undefined,
      });

      // Optional: notify admins that a new customer signed up via Google.
      try {
        emitToAdmins('notification:new', {
          opened: false,
          title: `New Google sign-up: ${firstName || ''} ${lastName || ''} (${safeEmail})`,
          paymentMethod: 'N/A',
          orderId: null,
          city: '',
          cover: picture || '',
        });
      } catch (notifyErr) {
        console.error('Failed to emit admin notification for Google sign-up:', notifyErr.message);
      }
    }

    // Issue JWT cookie (valid for 7 days, same as password login).
    const token = jwt.sign(
      { _id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token, 7 * 24 * 60 * 60 * 1000);

    const products = await getWishlistProducts(user.wishlist || []);

    console.log(`🔐 Google ${isNewUser ? 'sign-up' : 'login'} successful:`, { email: user.email });

    return res.status(201).json({
      success: true,
      message: isNewUser ? 'Account created with Google.' : 'Logged in with Google.',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        cover: user.cover,
        phone: user.phone || '',
        role: user.role,
        wishlist: products,
        mfaEnabled: user.mfaEnabled || false,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error('❌ Google auth error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Google sign-in failed.' });
  }
};

module.exports = { googleAuth };
