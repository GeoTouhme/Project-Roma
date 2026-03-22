const moment = require('moment-timezone');

const Settings = require('../models/settings');

const isStoreOpen = async () => {
    const storeConfig = await Settings.findOneOrCreate();
    if (!storeConfig) {
        // Fallback or error if settings are somehow not created
        return { isOpen: true, message: "Store settings not configured.", schedule: [] };
    }

    const now = moment().tz(storeConfig.timezone);
    const dayOfWeek = now.day(); // Sunday = 0, Monday = 1, ...
    const currentTime = now.format("HH:mm");

    const today_schedule = storeConfig.operatingHours.find(h => h.dayOfWeek === dayOfWeek);
    
    // Get yesterday's schedule to handle overnight hours
    const yesterday_schedule = storeConfig.operatingHours.find(h => h.dayOfWeek === (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    let isOpen = false;
    let message = "The store is currently closed.";

    // Check 1: Is it within today's normal hours?
    if (today_schedule && today_schedule.isOpen) {
        // Handle schedules that DO NOT cross midnight
        if (today_schedule.open < today_schedule.close) {
            if (currentTime >= today_schedule.open && currentTime < today_schedule.close) {
                isOpen = true;
            }
        }
        // Handle schedules that DO cross midnight (check opening part)
        else {
            if (currentTime >= today_schedule.open) {
                isOpen = true;
            }
        }
    }

    // Check 2: Is it within yesterday's overnight hours?
    if (!isOpen && yesterday_schedule && yesterday_schedule.isOpen) {
        // If yesterday's schedule crosses midnight
        if (yesterday_schedule.close < yesterday_schedule.open) {
            if (currentTime < yesterday_schedule.close) {
                isOpen = true;
            }
        }
    }

    // Prepare a user-friendly message if closed
    if (!isOpen && today_schedule) {
        if(today_schedule.isOpen) {
            const openTime = moment(today_schedule.open, "HH:mm").format("h:mm A");
            message = `We are currently closed. We open at ${openTime}.`;
        } else {
            const nextOpenDay = storeConfig.operatingHours.find((h, index) => index > dayOfWeek && h.isOpen) || storeConfig.operatingHours.find(h => h.isOpen);
            if(nextOpenDay) {
                const openTime = moment(nextOpenDay.open, "HH:mm").format("h:mm A");
                message = `We are closed today. We will be open on the next business day at ${openTime}.`;
            }
        }
    }


    return { isOpen, message, schedule: storeConfig.operatingHours };
};


const checkStoreHours = async (req, res, next) => {
    const { isOpen, message } = await isStoreOpen();
    if (!isOpen) {
        return res.status(400).json({
            success: false,
            message: message || "Sorry, the store is currently closed and cannot accept orders."
        });
    }
    next();
};

module.exports = { checkStoreHours, isStoreOpen };
