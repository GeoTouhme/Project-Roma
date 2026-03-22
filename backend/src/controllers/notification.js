const Notifications = require("../models/Notification");

const getNotifications = async (req, res) => {
	try {
		const { limit = 10, page = 1 } = req.query;

		const skip = parseInt(limit) * (parseInt(page) - 1) || 0;
		const totalNotifications = await Notifications.countDocuments();
		const totalUnreadNotifications = await Notifications.countDocuments({
			opened: false,
		});
		const notifications = await Notifications.find({}, null, {
			skip: skip,
			limit: parseInt(limit),
		}).sort({
			createdAt: -1,
		});

		return res.status(200).json({
			success: true,
			data: notifications,
			totalNotifications: totalNotifications,
			totalUnread: totalUnreadNotifications,
			count: Math.ceil(totalUnreadNotifications / parseInt(limit)),
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};

//Post Notifications
const createNotification = async (req, res) => {
	try {
		const { ...data } = await req.body;
		// Create a new notification
		await Notifications.create({
			...data,
		});

		return res.status(201).json({
			success: true,
			data: "Notification Added",
			message: "Notification Added",
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
module.exports = { getNotifications, createNotification };
