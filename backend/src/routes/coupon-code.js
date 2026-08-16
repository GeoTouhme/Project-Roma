const express = require("express");
const router = express.Router();
const couponCodeRoutes = require("../controllers/coupon-code");
// Import verifyToken function
const verifyToken = require("../config/jwt");
const adminCheck = require('../middleware/adminCheck');
//user routes — require auth so coupons cannot be brute-forced anonymously
router.get("/coupon-codes/:code", verifyToken, couponCodeRoutes.getCouponCodeByCode);
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
