const express = require('express');
const router = express.Router();
const { isStoreOpen } = require('../middleware/checkStoreHours');

router.get('/status', async (req, res) => {
    const { isOpen, message, schedule } = await isStoreOpen();
    res.status(200).json({
        success: true,
        isOpen,
        message,
        schedule
    });
});

module.exports = router;
