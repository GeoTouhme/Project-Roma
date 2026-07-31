'use strict';
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const socketAuth = require('./config/socketAuth');
const { setIO } = require('./utils/socketManager');
// Load environment variables from .env file
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://balportliquors.com', 'https://admin.balportliquors.com'],
    credentials: true
  }
});

// Apply JWT auth to Socket.IO and join authenticated admin sockets to the admin room
io.use(socketAuth);
io.on('connection', (socket) => {
  if (socket.user) {
    socket.join('admin');
  }
});
setIO(io);

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

// Decode the JWT (without verifying) to extract the user's role. Actual verification
// is still done by verifyToken middleware on protected routes, so this only affects
// rate-limit bucketing, not access control.
function getTokenRole(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded.role === 'string') {
      return decoded.role;
    }
  } catch {
    // ignore malformed token
  }
  return null;
}

// Authenticated admin/super-admin users bypass rate limiting entirely.
// Nginx -> Docker makes every request appear to come from the same proxy IP,
// so non-admin authenticated users are bucketed by JWT token and unauthenticated
// clients by the real client IP from X-Forwarded-For.
const createLimiter = (baseMax, windowMinutes, messagePrefix) => {
  const limiter = rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: baseMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: `${messagePrefix}. Please try again after ${windowMinutes} minutes.`,
    },
    keyGenerator: (req) => {
      const token = req.cookies?.token;
      if (token && token.length > 0) {
        const role = getTokenRole(token);
        // Admins and super admins get their own very high bucket so they never
        // hit rate limits during normal admin panel use.
        if (role === 'admin' || role === 'super admin') {
          return `admin:${token}`;
        }
        return `user:${token}`;
      }
      return `ip:${ipKeyGenerator(getClientIp(req))}`;
    },
  });

  return (req, res, next) => {
    const token = req.cookies?.token;
    if (token && token.length > 0) {
      const role = getTokenRole(token);
      if (role === 'admin' || role === 'super admin') {
        return next();
      }
    }
    return limiter(req, res, next);
  };
};

// Auth routes: strict to prevent brute-force / OTP abuse.
const authLimiterInternal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again after 15 minutes.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim() || req.ip
      : req.ip;
    const ip = ipKeyGenerator(clientIp);
    return email ? `auth:${email}:${ip}` : `auth:${ip}`;
  },
});

const authLimiter = (req, res, next) => {
  // Authenticated admin/super-admin users bypass auth rate limiting entirely.
  const token = req.cookies?.token || req.cookies?.tempToken;
  if (token && token.length > 0) {
    const role = getTokenRole(token);
    if (role === 'admin' || role === 'super admin') {
      return next();
    }
  }
  return authLimiterInternal(req, res, next);
};

// Public read routes: generous so customers can browse 100+ departments and paginated products.
const publicReadLimiter = createLimiter(8000, 15, 'Too many requests');

// Authenticated / mutating routes: generous for normal cart/order/wishlist/admin activity.
const apiLimiter = createLimiter(6000, 15, 'Too many requests');

// Admin-only routes: effectively unlimited for real admin work (50,000 / 15 min).
const adminLimiter = createLimiter(50000, 15, 'Too many admin requests');

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
// Mixed user/admin routes: the limiter key generator will detect admin role and
// put admins into the high admin bucket automatically.
app.use('/api', apiLimiter, userRoutes);
// Native ordering re-enabled. Auto-delivery dispatch is disabled in order controller;
// staff manually accepts orders and requests drivers via provider apps.
app.use('/api', apiLimiter, cartRoutes);
app.use('/api', apiLimiter, OrderRoutes);
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
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
