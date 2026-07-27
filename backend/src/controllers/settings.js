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
        const { timezone, operatingHours, deliveryProvider, taxRate, defaultDeliveryFee, deliveryFeesByZip } = req.body;

        // Validate deliveryProvider if provided
        if (deliveryProvider && !['doordash', 'uberdirect', 'store'].includes(deliveryProvider)) {
            return res.status(400).json({ success: false, message: 'Invalid delivery provider.' });
        }

        if (taxRate !== undefined) {
            if (typeof taxRate !== 'number' || taxRate < 0 || taxRate > 1) {
                return res.status(400).json({ success: false, message: 'Tax rate must be a number between 0 and 1 (e.g. 0.0775 for 7.75%).' });
            }
        }

        if (defaultDeliveryFee !== undefined) {
            if (typeof defaultDeliveryFee !== 'number' || defaultDeliveryFee < 0) {
                return res.status(400).json({ success: false, message: 'Default delivery fee must be a non-negative number.' });
            }
        }

        if (deliveryFeesByZip !== undefined) {
            if (!Array.isArray(deliveryFeesByZip)) {
                return res.status(400).json({ success: false, message: 'Delivery fees by zip must be an array.' });
            }
            for (const row of deliveryFeesByZip) {
                if (!row.zip || typeof row.fee !== 'number' || row.fee < 0) {
                    return res.status(400).json({ success: false, message: 'Each delivery fee entry must have a zip and non-negative fee.' });
                }
            }
        }

        // Validate operatingHours only if provided
        if (operatingHours) {
            if (!Array.isArray(operatingHours)) {
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
        }

        // Build update object — only include fields that were sent
        const updateData = {};
        if (timezone) updateData.timezone = timezone;
        if (operatingHours) updateData.operatingHours = operatingHours;
        if (deliveryProvider) updateData.deliveryProvider = deliveryProvider;
        if (taxRate !== undefined) updateData.taxRate = taxRate;
        if (defaultDeliveryFee !== undefined) updateData.defaultDeliveryFee = defaultDeliveryFee;
        if (deliveryFeesByZip !== undefined) updateData.deliveryFeesByZip = deliveryFeesByZip;

        const settings = await Settings.findOneAndUpdate(
            { key: 'storeConfig' },
            { $set: updateData },
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
