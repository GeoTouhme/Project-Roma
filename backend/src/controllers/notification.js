const Notifications = require("../models/Notification");
const { emitToAdmins } = require("../utils/socketManager");

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
		const notification = await Notifications.create({
			...data,
		});
		emitToAdmins('notification:new', notification);

		return res.status(201).json({
			success: true,
			data: "Notification Added",
			message: "Notification Added",
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
const markNotificationAsOpened = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Notification ID is required.' });
    }

    const notification = await Notifications.findByIdAndUpdate(
      id,
      { opened: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Notification ID is required.' });
    }

    const notification = await Notifications.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.status(200).json({ success: true, message: 'Notification cleared.' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const clearAllNotifications = async (req, res) => {
  try {
    await Notifications.deleteMany({});
    return res.status(200).json({ success: true, message: 'All notifications cleared.' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

module.exports = { getNotifications, createNotification, markNotificationAsOpened, deleteNotification, clearAllNotifications };
