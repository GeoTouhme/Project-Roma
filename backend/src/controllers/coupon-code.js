const CouponCode = require("../models/CouponCode");

const { nanoid } = require('nanoid');

// 🛡️ Whitelist allowed fields to prevent mass assignment
const ALLOWED_COUPON_FIELDS = ['name', 'code', 'discount', 'expire', 'description', 'type', 'usedBy'];

const generateCouponCode = (length = 10) => nanoid(length).toUpperCase();

const getCouponCodeByCode = async (req, res) => {
	try {
		const code = req.params.code;
		const getCouponCode = await CouponCode.findOne({ code: code });

		if (!getCouponCode) {
			return res.status(404).json({
				success: false,
				message: "CouponCode Not Found",
			});
		}

		return res.status(200).json({
			success: true,
			data: getCouponCode,
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
const getCouponCodeById = async (req, res) => {
	try {
		const id = req.params.id;
		const getCouponCode = await CouponCode.findById(id);

		if (!getCouponCode) {
			return res.status(404).json({
				success: false,
				message: "CouponCode Not Found",
			});
		}

		return res.status(200).json({
			success: true,
			data: getCouponCode,
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};

const getCouponCodesByAdmin = async (req, res) => {
	try {
		const { limit = 10, page = 1 } = req.query;

		const skip = parseInt(limit) * (parseInt(page) - 1) || 0;
		const totalCouponCode = await CouponCode.countDocuments();

		const CouponCodes = await CouponCode.find({}, null, {
			skip: skip,
			limit: parseInt(limit),
		}).sort({
			createdAt: -1,
		});

		return res.status(200).json({
			success: true,
			data: CouponCodes,
			count: Math.ceil(totalCouponCode / parseInt(limit)),
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};

// POST method to create a new couponCode
const createCouponCodeByAdmin = async (req, res) => {
	try {
		const data = await req.body;
		if (!data) {
			return res
				.status(404)
				.json({ success: false, message: "CouponCode Not Found" });
		}

		const safeData = {};
		for (const field of ALLOWED_COUPON_FIELDS) {
			if (data[field] !== undefined) safeData[field] = data[field];
		}

		// Auto-generate a unique coupon code if not provided.
		if (!safeData.code || safeData.code.trim() === '') {
			safeData.code = generateCouponCode();
		} else {
			safeData.code = safeData.code.trim().toUpperCase();
		}

		const newCouponCode = await CouponCode.create(safeData);

		return res.status(201).json({
			success: true,
			data: newCouponCode,
			message: "Coupon Code Created",
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
const getOneCouponCodeByAdmin = async (req, res) => {
	try {
		const id = req.params.id;
		const getCouponCode = await CouponCode.findById(id);

		if (!getCouponCode) {
			return res.status(404).json({
				success: false,
				message: "CouponCode Not Found",
			});
		}

		return res.status(200).json({
			success: true,
			data: getCouponCode,
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};

const updatedCouponCodeByAdmin = async (req, res) => {
	try {
		const id = req.params.id;

		const data = await req.body;

		const safeData = {};
		for (const field of ALLOWED_COUPON_FIELDS) {
			if (data[field] !== undefined) safeData[field] = data[field];
		}

		const updatedCouponCode = await CouponCode.findOneAndUpdate(
			{ _id: id },
			{ $set: safeData },
			{ new: true }
		);
		if (!updatedCouponCode) {
			return res
				.status(404)
				.json({ success: false, message: "CouponCode Not Found" });
		}
		return res.status(201).json({
			success: true,
			data: updatedCouponCode,
			message: "CouponCode Updated",
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
const deleteCouponCodeByAdmin = async (req, res) => {
	try {
		const id = req.params.id;
		const getCouponCode = await CouponCode.findById(id);
		if (!getCouponCode) {
			return res
				.status(404)
				.json({ success: false, message: "CouponCode Not Found" });
		}
		await CouponCode.findByIdAndDelete(id);
		return res.status(200).json({
			success: true,
			message: "CouponCode Deleted ",
		});
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
const getActiveCoupons = async (req, res) => {
	try {
		const now = new Date();
		const coupons = await CouponCode.find({
			expire: { $gte: now },
		}).select('name code discount type expire description').lean();
		res.status(200).json({ success: true, data: coupons });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = {
	getCouponCodeByCode,
	getCouponCodesByAdmin,
	createCouponCodeByAdmin,
	getOneCouponCodeByAdmin,
	updatedCouponCodeByAdmin,
	deleteCouponCodeByAdmin,
	getCouponCodeById,
	getActiveCoupons,
};
