const mongoose = require('mongoose');

const operatingHoursSchema = new mongoose.Schema({
    dayOfWeek: { type: Number, required: true }, // 0 for Sunday, 6 for Saturday
    day: { type: String, required: true },
    isOpen: { type: Boolean, default: false },
    open: { type: String, default: '00:00' }, // HH:mm format
    close: { type: String, default: '00:00' }, // HH:mm format
}, { _id: false });

const settingsSchema = new mongoose.Schema({
    // Using a fixed key to ensure only one settings document exists
    key: { type: String, default: 'storeConfig', unique: true },
    timezone: {
        type: String,
        required: true,
        default: 'America/Los_Angeles'
    },
    operatingHours: [operatingHoursSchema]
});

// Create a default settings document if it doesn't exist
settingsSchema.statics.findOneOrCreate = async function () {
    let settings = await this.findOne({ key: 'storeConfig' });
    if (!settings) {
        settings = new this({
            key: 'storeConfig',
            timezone: 'America/Los_Angeles',
            operatingHours: [
                { dayOfWeek: 0, day: 'Sunday', isOpen: true, open: '07:00', close: '02:00' },
                { dayOfWeek: 1, day: 'Monday', isOpen: true, open: '06:00', close: '02:00' },
                { dayOfWeek: 2, day: 'Tuesday', isOpen: true, open: '06:00', close: '02:00' },
                { dayOfWeek: 3, day: 'Wednesday', isOpen: true, open: '06:00', close: '02:00' },
                { dayOfWeek: 4, day: 'Thursday', isOpen: true, open: '06:00', close: '02:00' },
                { dayOfWeek: 5, day: 'Friday', isOpen: true, open: '06:00', close: '02:00' },
                { dayOfWeek: 6, day: 'Saturday', isOpen: true, open: '06:00', close: '02:00' },
            ]
        });
        await settings.save();
    }
    return settings;
};


module.exports = mongoose.model('Settings', settingsSchema);
