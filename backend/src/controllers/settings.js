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

        // Validate exactly 7 days
        if (operatingHours.length !== 7) {
            return res.status(400).json({ success: false, message: 'Operating hours must contain exactly 7 days.' });
        }

        // Validate no duplicate dayOfWeek entries
        const dayOfWeekSet = new Set();
        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

        for (const hour of operatingHours) {
            // Validate dayOfWeek is 0-6
            if (typeof hour.dayOfWeek !== 'number' || hour.dayOfWeek < 0 || hour.dayOfWeek > 6) {
                return res.status(400).json({ success: false, message: 'Invalid dayOfWeek value. Must be a number between 0 (Sunday) and 6 (Saturday).' });
            }

            // Check for duplicates
            if (dayOfWeekSet.has(hour.dayOfWeek)) {
                return res.status(400).json({ success: false, message: `Duplicate dayOfWeek found: ${hour.dayOfWeek}` });
            }
            dayOfWeekSet.add(hour.dayOfWeek);

            // Validate HH:mm format
            if (!timeRegex.test(hour.open)) {
                return res.status(400).json({ success: false, message: `Invalid open time for ${hour.day || 'day ' + hour.dayOfWeek}. Must be in HH:mm format.` });
            }
            if (!timeRegex.test(hour.close)) {
                return res.status(400).json({ success: false, message: `Invalid close time for ${hour.day || 'day ' + hour.dayOfWeek}. Must be in HH:mm format.` });
            }
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
