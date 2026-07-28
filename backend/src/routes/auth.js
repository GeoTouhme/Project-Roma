const express = require("express");
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const authController = require("../controllers/auth");
const verifyToken = require("../config/jwt");

// Strict rate limit for auth endpoints to prevent brute-force / OTP abuse.
// Behind Nginx+Docker all requests share the same proxy IP, so bucket by email
// when provided and fall back to IP for requests without a body email.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again after 15 minutes.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    const ip = ipKeyGenerator(req.ip);
    return email ? `auth:${email}:${ip}` : `auth:${ip}`;
  },
});

router.post("/auth/register", authLimiter, authController.registerUser);

router.post("/auth/login", authLimiter, authController.loginUser);

router.post("/auth/forget-password", authLimiter, authController.forgetPassword);

router.post("/auth/reset-password", authLimiter, authController.resetPassword);

router.post("/auth/verify-otp", authLimiter, authController.verifyOtp);

router.post("/auth/resend-otp", authLimiter, authController.resendOtp);

// router.get("/profile", verifyToken, userController.getProfile);

router.post("/auth/logout", verifyToken, authController.logoutUser);

module.exports = router;
