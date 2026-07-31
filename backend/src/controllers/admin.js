const User = require("../models/User");
const Order = require("../models/Order");

// Escapes special regex characters to prevent ReDoS and NoSQL injection
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getUsersByAdmin = async (req, res) => {
	try {
		const { limit = 10, page = 1, search = "" } = req.query;

		const skip = parseInt(limit) * (parseInt(page) - 1) || 0;

		// Constructing nameQuery based on search input
		const safeSearch = escapeRegex(search);
		const nameQuery = safeSearch
			? {
				$or: [
					{ firstName: { $regex: safeSearch, $options: "i" } },
					{ lastName: { $regex: safeSearch, $options: "i" } },
					{ email: { $regex: safeSearch, $options: "i" } },
				],
			}
			: {};

		const totalUserCounts = await User.countDocuments(nameQuery);

		const users = await User.find(nameQuery, null, {
			skip: skip,
			limit: parseInt(limit),
		}).sort({
			createdAt: -1,
		});

		return res.status(200).json({
			success: true,
			data: users,
			count: Math.ceil(totalUserCounts / parseInt(limit)),
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
const getOrdersByUid = async (req, res) => {
	try {
		const id = req.params.id;
		const { limit = 10, page = 1 } = req.query;

		const skip = parseInt(limit) * (parseInt(page) - 1) || 0;

		const currentUser = await User.findById(id);

		const totalOrders = await Order.countDocuments({ "user._id": id });

		const orders = await Order.find({ "user._id": id }, null, {
			skip: skip,
			limit: parseInt(limit),
		}).sort({
			createdAt: -1,
		});

		if (!currentUser) {
			return res
				.status(404)
				.json({ success: false, message: "User Not Found" });
		}

		return res.status(200).json({
			success: true,
			user: currentUser,
			orders,
			count: Math.ceil(totalOrders / parseInt(limit)),
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};

const UpdateRoleByAdmin = async (req, res) => {
	try {
		const id = req.params.id;
		const userToUpdate = await User.findById(id);

		if (!userToUpdate) {
			return res
				.status(404)
				.json({ success: false, message: "User Not Found." });
		}

		// Check if the user to update is a super admin
		if (userToUpdate.role === "super admin") {
			return res.status(403).json({
				success: false,
				message: "Cannot Change The Role Of A Super Admin.",
			});
		}

		// Toggle the user's role
		const newRole = userToUpdate.role === "user" ? "admin" : "user";

		// Update the user's role
		const updatedUser = await User.findByIdAndUpdate(
			id,
			{ role: newRole },
			{ new: true, runValidators: true }
		);

		return res.status(200).json({
			success: true,
			message: `${updatedUser.firstName} Is Now ${newRole}.`,
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};
const deleteUserByAdmin = async (req, res) => {
	try {
		const id = req.params.id;
		const userToDelete = await User.findById(id);

		if (!userToDelete) {
			return res.status(404).json({ success: false, message: "User Not Found." });
		}

		// Prevent self-deletion — JWT payload uses _id, not id
		if (req.user && req.user._id?.toString() === id) {
			return res.status(403).json({ success: false, message: "Cannot delete your own account." });
		}

		// Prevent deletion of super admin
		if (userToDelete.role === "super admin") {
			return res.status(403).json({ success: false, message: "Cannot delete a Super Admin." });
		}

		await User.findByIdAndDelete(id);

		return res.status(200).json({ success: true, message: "User deleted successfully." });
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

const updateUserByAdmin = async (req, res) => {
	try {
		const id = req.params.id;
		const userToUpdate = await User.findById(id);

		if (!userToUpdate) {
			return res.status(404).json({ success: false, message: "User Not Found." });
		}

		// Prevent editing another super admin unless you are a super admin yourself.
		// adminCheck already enforces admin/super-admin access, but we double-check escalation here.
		if (userToUpdate.role === "super admin" && req.user?.role !== "super admin") {
			return res.status(403).json({ success: false, message: "Only a Super Admin can edit another Super Admin." });
		}

		// Validate and normalize incoming data
		const data = req.body || {};
		const safeEmail = typeof data.email === 'string' ? data.email.toLowerCase().trim() : undefined;

		// If email is changing, ensure it is not already taken by another user
		if (safeEmail && safeEmail !== userToUpdate.email.toLowerCase()) {
			const existingUser = await User.findOne({ email: safeEmail });
			if (existingUser && existingUser._id.toString() !== id) {
				return res.status(400).json({ success: false, message: "Email is already in use by another account." });
			}
		}

		// Whitelist editable fields to prevent mass-assignment attacks
		const ALLOWED_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'role', 'status', 'isVerified'];
		const safeData = {};
		for (const field of ALLOWED_FIELDS) {
			if (data[field] !== undefined) {
				safeData[field] = data[field];
			}
		}

		// Only a super admin can promote/demote admins or super admins
		if (data.role !== undefined && req.user?.role !== "super admin") {
			return res.status(403).json({ success: false, message: "Only a Super Admin can change user roles." });
		}

		// Prevent removing the last super admin
		if (
			data.role !== undefined &&
			userToUpdate.role === "super admin" &&
			data.role !== "super admin"
		) {
			const superAdminCount = await User.countDocuments({ role: "super admin" });
			if (superAdminCount <= 1) {
				return res.status(403).json({ success: false, message: "Cannot demote the last Super Admin." });
			}
		}

		const updatedUser = await User.findByIdAndUpdate(
			id,
			safeData,
			{ new: true, runValidators: true }
		).select('-password');

		return res.status(200).json({
			success: true,
			message: "User updated successfully.",
			data: updatedUser,
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = { getUsersByAdmin, getOrdersByUid, UpdateRoleByAdmin, deleteUserByAdmin, updateUserByAdmin };
