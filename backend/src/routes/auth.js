const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const { refreshToken } = authController;
const googleAuthController = require("../controllers/googleAuth");
const verifyToken = require("../config/jwt");
const {
  authLimiter,
  registrationLimiter,
} = require("../middleware/rateLimiters");

// NOTE (F6 remediation): limiter role detection lives in
// middleware/rateLimiters.js and verifies JWT signatures before granting
// admin-tier treatment. The old decode-only getTokenRole allowed any
// unsigned {"role":"admin"} cookie to unlock the 1000-attempt auth tier
// and a private token-keyed bucket.

// Rate limit for auth endpoints to prevent brute-force / OTP abuse.
// Bucketing and admin tiers are handled in middleware/rateLimiters.js:
// verified admins get a generous finite tier; forged cookies get nothing.

// 🛡️ SECURITY: strict registration limiter — definition lives in
// middleware/rateLimiters.js. Keys on IP only with a hard 10/30min cap so
// disposable-email rotation can't mass-create accounts.

router.post("/auth/register", registrationLimiter, authLimiter, authController.registerUser);

router.post("/auth/google", authLimiter, googleAuthController.googleAuth);

router.post("/auth/login", authLimiter, authController.loginUser);

router.post("/auth/forget-password", authLimiter, authController.forgetPassword);

router.post("/auth/reset-password", authLimiter, authController.resetPassword);

router.post("/auth/verify-otp", authLimiter, authController.verifyOtp);

router.post("/auth/verify-email-token", authLimiter, authController.verifyEmailToken);

router.post("/auth/resend-otp", authLimiter, authController.resendOtp);

// router.get("/profile", verifyToken, userController.getProfile);

router.post("/auth/logout", authLimiter, authController.logoutUser);

// 🛡️ Return current authenticated user from HttpOnly cookie.
router.get("/auth/me", verifyToken, authController.getMe);

// 🛡️ MFA endpoints
router.post("/auth/setup-mfa", verifyToken, authLimiter, authController.setupMfa);
router.post("/auth/confirm-mfa", verifyToken, authLimiter, authController.confirmMfaSetup);
router.post("/auth/verify-mfa", authLimiter, authController.verifyMfa);
router.post("/auth/disable-mfa", verifyToken, authLimiter, authController.disableMfa);

// 🛡️ Refresh token rotation — issues a new access+refresh pair from the
// HttpOnly refresh cookie. Rate-limited to prevent brute-force against the
// hashed token stored in DB.
router.post("/auth/refresh", authLimiter, refreshToken);

module.exports = router;

