const express = require('express');
const router = express.Router();
const analytics = require('../controllers/analytics');
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

// Public endpoint for tracking product views (no auth)
router.post('/track-view', analytics.trackView);

// Admin-only analytics dashboard data
router.get('/admin/analytics', verifyToken, adminCheck, analytics.getAnalytics);

module.exports = router;
