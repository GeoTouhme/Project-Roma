const express = require('express');
const router = express.Router();
const delete_fileController = require('../controllers/delete');
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');
router.delete('/delete-file/:id', verifyToken, adminCheck, delete_fileController.delete_file);

module.exports = router;
