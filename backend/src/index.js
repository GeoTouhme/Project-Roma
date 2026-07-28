'use strict';
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🛡️ SECURITY: Disable the `qs` bracket-object parser.
// Without this, ?key[$ne]=x becomes { key: { $ne: 'x' } } — a direct NoSQL injection vector.
// The 'simple' parser (Node's built-in querystring) treats all values as plain strings.
app.set('query parser', 'simple');

// 🛡️ SECURITY: Enable trust proxy to support rate limiting behind Nginx.
// Set to 1 = trust exactly one proxy (Nginx). Using `true` is rejected by express-rate-limit v7+.
app.set('trust proxy', 1);

// Restrict CORS to known trusted origins — prevents cross-origin attacks
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

// 🛡️ SECURITY: Restrict CORS to known origins — fixes VULN reported in pentest.
// origin:true accepts ANY domain with credentials, enabling cross-site request forgery.
// Now reads from ALLOWED_ORIGINS env var (comma-separated list).
const CORS_ORIGINS = allowedOrigins.length > 0
  ? allowedOrigins
  : ['https://balportliquors.com', 'https://admin.balportliquors.com'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header) and known origins
    if (!origin || CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: origin '${origin}' is not allowed.`));
  },
  credentials: true,
}));

// 🛡️ SECURITY: Set security headers (HSTS, CSP, X-Content-Type-Options, etc.)
const helmetDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://js.stripe.com',
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
  ],
  fontSrc: [
    "'self'",
    'https://fonts.gstatic.com',
  ],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https://res.cloudinary.com',
    'https://ui-avatars.com',
    'https://www.google.com',
    'https://*.googleusercontent.com',
    'https://www.googletagmanager.com',
  ],
  connectSrc: [
    "'self'",
    'https://balportliquors.com',
    'https://admin.balportliquors.com',
    'http://localhost:5001',
    'https://api.stripe.com',
    'https://maps.googleapis.com',
    'https://www.google-analytics.com',
    'https://nrsgo.com',
    'https://res.cloudinary.com',
  ],
  frameSrc: [
    "'self'",
    'https://js.stripe.com',
    'https://checkout.stripe.com',
    'https://pay.google.com',
  ],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

// Only add upgrade-insecure-requests in production; helmet rejects undefined/conditional undefined.
if (process.env.NODE_ENV === 'production') {
  helmetDirectives.upgradeInsecureRequests = [];
}

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: helmetDirectives,
  },
}));

// Body parser with explicit size limit to prevent DoS via large payloads
// Preserve raw body buffer for webhook signature verification
app.use(cookieParser());

app.use(bodyParser.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));

// Tiered rate limiting to balance customer browsing with abuse protection.
// Limits are per user/IP per window. nginx sits in front as a single trusted proxy.

// Use the leftmost X-Forwarded-For IP when behind Nginx so each visitor gets
// their own bucket instead of everyone behind the Docker gateway sharing one.
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip;
}

const createLimiter = (max, windowMinutes, messagePrefix) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: `${messagePrefix}. Please try again after ${windowMinutes} minutes.`,
    },
    // Nginx -> Docker makes every request appear to come from the same proxy IP,
    // so bucket authenticated users by their JWT token and unauthenticated clients
    // by the real client IP from X-Forwarded-For.
    keyGenerator: (req) => {
      const token = req.cookies?.token;
      if (token && token.length > 0) {
        return `user:${token}`;
      }
      return `ip:${ipKeyGenerator(getClientIp(req))}`;
    },
  });

// Auth routes: strict to prevent brute-force / OTP abuse.
const authLimiter = createLimiter(20, 15, 'Too many auth attempts');

// Public read routes: generous so customers can browse 100+ departments and paginated products.
const publicReadLimiter = createLimiter(8000, 15, 'Too many requests');

// Authenticated / mutating routes: generous for normal cart/order/wishlist/admin activity.
const apiLimiter = createLimiter(6000, 15, 'Too many requests');

// Admin-only routes: even more generous because admin pages fire many parallel calls.
const adminLimiter = createLimiter(10000, 15, 'Too many admin requests');

// Polling endpoints (e.g. admin notification bell) need their own, higher limit
// so they don't exhaust the shared apiLimiter bucket for active admin users.
const pollLimiter = createLimiter(3000, 15, 'Too many notification polls');


// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

// Routes

const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const brandRoutes = require('./routes/brand');
const categoryRoutes = require('./routes/category');
const subcategoryRoutes = require('./routes/subcategory');
const newsletterRoutes = require('./routes/newsletter');
const productRoutes = require('./routes/product');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');
const userRoutes = require('./routes/user');
const cartRoutes = require('./routes/cart');
const couponCodeRoutes = require('./routes/coupon-code');
const reviewRoutes = require('./routes/review');
const wishlistRoutes = require('./routes/wishlist');
const OrderRoutes = require('./routes/order');
const paymentRoutes = require('./routes/payment-intents');
const recommendationRoutes = require('./routes/recommendation');
const delete_fileRoutes = require('./routes/file-delete');
const storeRoutes = require('./routes/store');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const doorDashWebhookRoutes = require('./routes/doorDashWebhook');
const uberDirectWebhookRoutes = require('./routes/uberDirectWebhook');
const stripeWebhookRoutes = require('./routes/stripeWebhook');
const notificationRoutes = require('./routes/notification');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/store', publicReadLimiter, storeRoutes);
app.use('/api', analyticsRoutes); // Public tracking + admin analytics (adminLimiter inside route)
app.use('/api/settings', publicReadLimiter, settingsRoutes);
app.use('/api', publicReadLimiter, homeRoutes);
app.use('/api', authRoutes); // Auth rate limiting is inside routes/auth.js
app.use('/api', publicReadLimiter, brandRoutes);
app.use('/api', publicReadLimiter, categoryRoutes);
app.use('/api', publicReadLimiter, subcategoryRoutes);
app.use('/api', publicReadLimiter, newsletterRoutes);
app.use('/api', publicReadLimiter, productRoutes); // User product browsing
app.use('/api', publicReadLimiter, recommendationRoutes);
app.use('/api', adminLimiter, dashboardRoutes); // Admin-only analytics
app.use('/api', publicReadLimiter, searchRoutes);
app.use('/api', apiLimiter, userRoutes); // Mixed user/admin profile routes
// Native ordering re-enabled. Auto-delivery dispatch is disabled in order controller;
// staff manually accepts orders and requests drivers via provider apps.
app.use('/api', apiLimiter, cartRoutes);
app.use('/api', apiLimiter, OrderRoutes); // Mixed user/admin order routes
app.use('/api', apiLimiter, paymentRoutes);
app.use('/api', apiLimiter, wishlistRoutes);
// Stripe webhook must be mounted BEFORE bodyParser.json so rawBody is preserved.
app.use('/api/webhooks', stripeWebhookRoutes);
// Webhooks disabled because there is no automatic delivery dispatch to receive updates from.
// app.use('/api', doorDashWebhookRoutes);
// app.use('/api', uberDirectWebhookRoutes);
app.use('/api', apiLimiter, couponCodeRoutes);
app.use('/api', publicReadLimiter, reviewRoutes);
app.use('/api', apiLimiter, delete_fileRoutes);
app.use('/api', adminLimiter, uploadRoutes); // Mostly admin image uploads
app.use('/api', pollLimiter, notificationRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// GET API
app.get('/', (req, res) => {
  res.send('This is a GET API');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
