const express = require('express');
const router = express.Router();
const delete_fileController = require('../controllers/file-delete');
const verifyToken = require('../config/jwt'); // Import the missing middleware
const adminCheck = require('../middleware/adminCheck');

router.delete('/delete-file/:id', verifyToken, adminCheck, delete_fileController.deleteFile);

module.exports = router;
