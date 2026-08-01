const express = require('express');
const router = express.Router();
const { googleAuth } = require('../controllers/googleAuth');

router.post('/auth/google', googleAuth);

module.exports = router;
