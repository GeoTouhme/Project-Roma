const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const authController = require("../controllers/auth");
const googleAuthController = require("../controllers/googleAuth");
const verifyToken = require("../config/jwt");
const { getClientIp } = require("../utils/getClientIp");

// Helpers to decode role for rate-limit bucketing (access control still happens via verifyToken).
function getTokenRole(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded.role === 'string') return decoded.role;
  } catch {
    // ignore
  }
  return null;
}

// Rate limit for auth endpoints to prevent brute-force / OTP abuse.
// Behind Nginx+Docker all requests share the same proxy IP, so bucket by email
// when provided and fall back to the real client IP from X-Forwarded-For.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    const role = getTokenRole(req.cookies?.token);
    return role === 'admin' || role === 'super admin' ? 1000 : 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again after 15 minutes.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    // Admins and super admins get a separate, much higher bucket.
    const token = req.cookies?.token;
    const role = getTokenRole(token);
    if (role === 'admin' || role === 'super admin') {
      return `auth-admin:${token}`;
    }
    // Use the real client IP (Cloudflare-aware) instead of the Docker gateway IP.
    const clientIp = getClientIp(req);
    const ip = ipKeyGenerator(clientIp);
    return email ? `auth:${email}:${ip}` : `auth:${ip}`;
  },
});

router.post("/auth/register", authLimiter, authController.registerUser);

router.post("/auth/google", authLimiter, googleAuthController.googleAuth);

router.post("/auth/login", authLimiter, authController.loginUser);

router.post("/auth/forget-password", authLimiter, authController.forgetPassword);

router.post("/auth/reset-password", authLimiter, authController.resetPassword);

router.post("/auth/verify-otp", authLimiter, authController.verifyOtp);

router.post("/auth/verify-email-token", authLimiter, authController.verifyEmailToken);

router.post("/auth/resend-otp", authLimiter, authController.resendOtp);

// router.get("/profile", verifyToken, userController.getProfile);

router.post("/auth/logout", verifyToken, authController.logoutUser);

// 🛡️ Return current authenticated user from HttpOnly cookie.
router.get("/auth/me", verifyToken, authController.getMe);

// 🛡️ MFA endpoints
router.post("/auth/setup-mfa", verifyToken, authLimiter, authController.setupMfa);
router.post("/auth/confirm-mfa", verifyToken, authLimiter, authController.confirmMfaSetup);
router.post("/auth/verify-mfa", authLimiter, authController.verifyMfa);
router.post("/auth/disable-mfa", verifyToken, authLimiter, authController.disableMfa);

module.exports = router;
