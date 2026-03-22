const Settings = require('../models/settings');

// @desc    Get store settings
// @route   GET /api/settings
// @access  Public
const getSettings = async (req, res) => {
    try {
        const settings = await Settings.findOneOrCreate();
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update store settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        const { timezone, operatingHours } = req.body;

        if (!operatingHours || !Array.isArray(operatingHours)) {
            return res.status(400).json({ success: false, message: 'Operating hours must be an array.' });
        }

        const settings = await Settings.findOneAndUpdate(
            { key: 'storeConfig' },
            { timezone, operatingHours },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};


module.exports = {
    getSettings,
    updateSettings,
};
