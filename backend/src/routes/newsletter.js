const express = require('express');
const router = express.Router();
const newsletter = require('../controllers/newsletter');

// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

router.get('/admin/newsletter', verifyToken, adminCheck, newsletter.getNewsletters);

// User routes

router.post('/newsletter', newsletter.createNewsletter); // Add token verification middleware

module.exports = router;
