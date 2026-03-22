const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const uploadController = require('../controllers/upload');
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

// Single file upload. Field name 'image'.
router.post('/upload', verifyToken, adminCheck, upload.single('image'), uploadController.uploadImage);

module.exports = router;
