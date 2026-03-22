const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settings');
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

// @route   GET /api/settings
// @desc    Get store operating hours and timezone
// @access  Public
router.get('/', getSettings);


// @route   PUT /api/settings
// @desc    Update store settings
// @access  Admin
router.put('/', verifyToken, adminCheck, updateSettings);

module.exports = router;
