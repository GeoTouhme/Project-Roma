const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth");
const verifyToken = require("../config/jwt");

// Strict rate limit for auth endpoints to prevent brute-force / OTP abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again after 15 minutes.' },
});

router.post("/auth/register", authLimiter, authController.registerUser);

router.post("/auth/login", authLimiter, authController.loginUser);

router.post("/auth/forget-password", authLimiter, authController.forgetPassword);

router.post("/auth/reset-password", authLimiter, authController.resetPassword);

router.post("/auth/verify-otp", authLimiter, authController.verifyOtp);

router.post("/auth/resend-otp", authLimiter, authController.resendOtp);

// router.get("/profile", verifyToken, userController.getProfile);

module.exports = router;
