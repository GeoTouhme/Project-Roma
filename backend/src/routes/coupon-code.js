const express = require("express");
const router = express.Router();
const couponCodeRoutes = require("../controllers/coupon-code");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { getClientIp } = require("../utils/getClientIp");
// Import verifyToken function
const verifyToken = require("../config/jwt");
const adminCheck = require('../middleware/adminCheck');

// 🛡️ Brute-force protection for coupon code verification.
// Limit each user/IP to 20 attempts per 15 minutes.
const couponVerifyLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many coupon attempts. Please try again later.",
	},
	keyGenerator: (req) => {
		const token = req.cookies?.token;
		if (token) return `coupon:${token}`;
		return `coupon:${ipKeyGenerator(getClientIp(req))}`;
	},
});

//user routes — require auth so coupons cannot be brute-forced anonymously
router.get("/coupon-codes/:code", couponVerifyLimiter, verifyToken, couponCodeRoutes.getCouponCodeByCode);
router.get("/coupons/active", couponCodeRoutes.getActiveCoupons);
//admin routes
router.get(
	"/admin/coupon-codes",
	verifyToken,
	adminCheck,
	couponCodeRoutes.getCouponCodesByAdmin
);
router.post(
	"/admin/coupon-codes",
	verifyToken,
	adminCheck,
	couponCodeRoutes.createCouponCodeByAdmin
);
router.get(
	"/admin/coupon-codes/:id",
	verifyToken,
	adminCheck,
	couponCodeRoutes.getOneCouponCodeByAdmin
);
router.put(
	"/admin/coupon-codes/:id",
	verifyToken,
	adminCheck,
	couponCodeRoutes.updatedCouponCodeByAdmin
);
router.delete(
	"/admin/coupon-codes/:id",
	verifyToken,
	adminCheck,
	couponCodeRoutes.deleteCouponCodeByAdmin
);

module.exports = router;
