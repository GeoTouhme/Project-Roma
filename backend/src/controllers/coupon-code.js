const CouponCode = require("../models/CouponCode");

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

		const newCouponCode = await CouponCode.create({ ...data });

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

		const updatedCouponCode = await CouponCode.findOneAndUpdate(
			{ _id: id },
			{ ...data },
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
module.exports = {
	getCouponCodeByCode,
	getCouponCodesByAdmin,
	createCouponCodeByAdmin,
	getOneCouponCodeByAdmin,
	updatedCouponCodeByAdmin,
	deleteCouponCodeByAdmin,
	getCouponCodeById,
};
