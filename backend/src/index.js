'use strict';
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
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

// Body parser with explicit size limit to prevent DoS via large payloads
// Preserve raw body buffer for webhook signature verification
app.use(bodyParser.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));

// Relaxed rate limiter for development/testing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again after 15 minutes.' },
});

// Skip rate limit for admin-authenticated requests
const skipRateLimitForAdmin = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(
        token.replace('Bearer ', ''),
        process.env.JWT_SECRET || 'b2bda22377f71d92dcc55e75f7be2091cc1ad5775139c1312e407e0c51cb1ad3'
      );
      if (decoded.role === 'admin' || decoded.role === 'super admin') {
        return next('router');
      }
    } catch (err) {
      // Token invalid — fall through to rate limiter
    }
  }
  next();
};

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
const delete_fileRoutes = require('./routes/file-delete');
const storeRoutes = require('./routes/store');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const doorDashWebhookRoutes = require('./routes/doorDashWebhook');
const uberDirectWebhookRoutes = require('./routes/uberDirectWebhook');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/store', storeRoutes);
app.use('/api', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', homeRoutes);
app.use('/api', skipRateLimitForAdmin, authLimiter, authRoutes); // Keep auth enabled for admin panel
app.use('/api', brandRoutes);
app.use('/api', categoryRoutes);
app.use('/api', subcategoryRoutes);
app.use('/api', newsletterRoutes);
app.use('/api', productRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', searchRoutes);
app.use('/api', userRoutes);
// === TEMPORARILY DISABLED — Using DoorDash for ordering ===
// app.use('/api', cartRoutes);
// app.use('/api', OrderRoutes);
// app.use('/api', paymentRoutes);
// app.use('/api', wishlistRoutes);
// app.use('/api', doorDashWebhookRoutes);
// app.use('/api', uberDirectWebhookRoutes);
app.use('/api', couponCodeRoutes);
app.use('/api', reviewRoutes);
app.use('/api', delete_fileRoutes);
app.use('/api', uploadRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// GET API
app.get('/', (req, res) => {
  res.send('This is a GET API');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
