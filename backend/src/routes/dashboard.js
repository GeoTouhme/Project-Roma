const express = require('express');
const router = express.Router();
const dashboard = require('../controllers/dashboard');

// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

router.get(
  '/admin/dashboard-analytics',
  verifyToken,
  adminCheck,
  dashboard.getDashboardAnalytics
);

router.get('/admin/notifications', verifyToken, adminCheck, dashboard.getNofications);

module.exports = router;
