'use strict';
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createLimiter } = require('./middleware/rateLimiters');
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
const {
  getClientIp,
  TRUST_PROXY_CONFIG,
} = require('./utils/getClientIp');
const { startDailyLogReportJob } = require('./jobs/dailyLogReport');
// Load environment variables from .env file
dotenv.config();

// Start daily automated log analysis report in production.
startDailyLogReportJob();

// Cloudflare IP ranges (fetched 2026-10-24 from cloudflare.com/ips-v4 + ips-v6)
// — used ONLY by nginx realip config (W1), NOT for Express trust proxy.
// After F1 (loopback binding) no Cloudflare edge ever connects to Express
// directly, so the ranges below are documentation for the nginx boundary.
const CLOUDFLARE_IP_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Parse allowed origins once, early, so both Socket.IO and Express CORS use the
// same trimmed list. .env files often contain spaces after commas.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0
      ? allowedOrigins
      : ['https://balportliquors.com', 'https://admin.balportliquors.com'],
    credentials: true,
  },
  path: '/socket.io/',
});

// Apply JWT auth to Socket.IO and join authenticated admin sockets to the admin room
io.use(socketAuth);
io.on('connection', (socket) => {
  if (socket.user) {
    socket.join('admin');
    // Revoked sessions and demoted staff lose existing connections as well.
    const check = async () => {
      try {
        const { verifyAccessToken } = require('./utils/authTokens');
        const { authenticateSession } = require('./utils/authSession');
        const user = await authenticateSession(verifyAccessToken(socket.accessToken));
        if (!['admin', 'super admin'].includes(user.role)) throw new Error('Forbidden');
      } catch { socket.disconnect(true); }
    };
    const timer = setInterval(check, 15000);
    timer.unref();
    socket.on('disconnect', () => clearInterval(timer));
    socket.use(async (packet, next) => { await check(); if (socket.connected) next(); });
  }
});
setIO(io);

// 🛡️ SECURITY: Disable the `qs` bracket-object parser.
// Without this, ?key[$ne]=x becomes { key: { $ne: 'x' } } — a direct NoSQL injection vector.
// The 'simple' parser (Node's built-in querystring) treats all values as plain strings.
app.set('query parser', 'simple');

// 🛡️ SECURITY (F2): trust ONLY our exact reverse proxies — host nginx
// (loopback / bridge gateway) and the two panel nginx containers (static
// bridge IPs). The boundary is defined once, in utils/getClientIp.js, and
// consumed by both getClientIp() and Express's trust proxy. No blanket
// RFC1918/Docker-subnet trust: mongo and image-fallback share this bridge
// and must never be able to inject a client identity.
app.set('trust proxy', TRUST_PROXY_CONFIG);

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
    'https://accounts.google.com',
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
    'https://balportliquors.com',
    'https://www.balportliquors.com',
    'https://images.balportliquors.com',
    'https://ui-avatars.com',
    'https://www.google.com',
    'https://*.googleusercontent.com',
    'https://www.googletagmanager.com',
  ],
  connectSrc: [
    "'self'",
    'https://balportliquors.com',
    'https://www.balportliquors.com',
    'https://admin.balportliquors.com',
    'https://api.balportliquors.com',
    'wss://balportliquors.com',
    'wss://admin.balportliquors.com',
    'wss://api.balportliquors.com',
    'https://api.stripe.com',
    'https://maps.googleapis.com',
    'https://www.google-analytics.com',
    'https://nrsgo.com',
    'https://res.cloudinary.com',
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
  ],
  frameSrc: [
    "'self'",
    'https://js.stripe.com',
    'https://checkout.stripe.com',
    'https://pay.google.com',
    'https://accounts.google.com',
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
  // HSTS is already set by host nginx (max-age=63072000). Disable here to avoid
  // duplicate headers with mismatched max-age values.
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000 } : false,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: helmetDirectives,
  },
}));

// Defense-in-depth: log Cloudflare request metadata and attach the real client IP.
// Nginx already restricts origin access to Cloudflare IPs via allow-list, but this
// middleware ensures every request that reaches Express carries Cloudflare headers.
// Webhooks are included so we can correlate provider retries with CF-Ray IDs.
app.use((req, res, next) => {
  req.realIp = getClientIp(req);
  req.cfRay = req.headers['cf-ray'] || '';

  if (process.env.NODE_ENV === 'production') {
    const hasCfRay = Boolean(req.cfRay);
    const hasCfConnectingIp = Boolean(req.headers['cf-connecting-ip']);

    // Only log anomalies for now. In the future this can be upgraded to a hard
    // block once we are confident all legitimate traffic (including webhooks)
    // flows through Cloudflare.
    if (!hasCfRay && !req.originalUrl.startsWith('/api/webhooks/')) {
      console.warn('Request without CF-Ray header reached origin:', {
        method: req.method,
        url: req.originalUrl,
        realIp: req.realIp,
        userAgent: req.get('User-Agent'),
      });
    }

    // Webhooks from delivery providers may legitimately lack CF-Ray if they hit
    // the origin directly during DNS propagation. Log but never block them here
    // because nginx already enforces the Cloudflare allow-list.
    if (!hasCfRay && req.originalUrl.startsWith('/api/webhooks/')) {
      console.warn('Webhook request without CF-Ray header:', {
        url: req.originalUrl,
        realIp: req.realIp,
        userAgent: req.get('User-Agent'),
      });
    }
  }

  next();
});

// Body parser with explicit size limit to prevent DoS via large payloads
// Preserve raw body buffer for webhook signature verification
app.use(cookieParser());

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const ipBudget = (max, windowMs) => rateLimit({
  ...(process.env.NODE_ENV === 'production' ? { store: new (require('./middleware/mongoRateStore').MongoRateStore)(`ip:${max}:${windowMs}`) } : {}), windowMs, limit: max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(getClientIp(req)) });
app.use('/api/auth', ipBudget(200, 15 * 60 * 1000));
app.use('/api/track-view', ipBudget(120, 60 * 1000));
app.use('/api/payment-intents', ipBudget(30, 60 * 1000));
app.use('/api/orders', ipBudget(300, 60 * 1000));
app.use('/api', (req, res, next) => {
  for (const [key, max] of [['limit', 100], ['page', 10000]]) {
    if (req.query[key] !== undefined && (!/^\d+$/.test(req.query[key]) || Number(req.query[key]) < 1 || Number(req.query[key]) > max)) {
      return res.status(400).json({ success: false, message: `Invalid ${key}` });
    }
  }
  next();
});
app.use(bodyParser.json({
  inflate: false,
  limit: '1mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));

// Tiered rate limiting to balance customer browsing with abuse protection.
// Limits are per user/IP per window. nginx sits in front as a single trusted proxy.
//
// 🛡️ SECURITY (F6): all limiter role detection is centralized in
// middleware/rateLimiters.js and uses jwt.verify (never jwt.decode), so
// forged `token` cookies can no longer buy admin-tier or unlimited buckets.
const publicReadLimiter = createLimiter(8000, 15, 'Too many requests');
const apiLimiter = createLimiter(6000, 15, 'Too many requests');
const adminLimiter = createLimiter(50000, 15, 'Too many admin requests');
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
const dealRoutes = require('./routes/deal');
const mixBundleRoutes = require('./routes/mixBundle');
const imageFallbackRoutes = require('./routes/imageFallback');
const doorDashWebhookRoutes = require('./routes/doorDashWebhook');
const uberDirectWebhookRoutes = require('./routes/uberDirectWebhook');
const stripeWebhookRoutes = require('./routes/stripeWebhook');
const notificationRoutes = require('./routes/notification');
const analyticsRoutes = require('./routes/analytics');
const sitemapRoutes = require('./routes/sitemap');

app.use('/api', publicReadLimiter, sitemapRoutes); // Dynamic XML sitemap (no auth required)
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
app.use('/api/images', publicReadLimiter, imageFallbackRoutes);
app.use('/api', pollLimiter, notificationRoutes);
app.use('/api', publicReadLimiter, dealRoutes);
app.use('/api', publicReadLimiter, mixBundleRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// GET API
app.get('/', (req, res) => {
  res.send('This is a GET API');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
