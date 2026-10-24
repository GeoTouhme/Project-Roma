'use strict';

/**
 * Centralized rate limiters with signature-verified JWT role detection.
 *
 * 🛡️ SECURITY (F6 remediation): role claims used for limiter bucketing or
 * tier upgrades MUST come from jwt.verify — never jwt.decode. decode() accepts
 * any unsigned or tampered payload, so a forged `token` cookie containing
 * {"role":"admin"} used to grant unlimited / admin-tier rate-limit treatment.
 * Every helper here verifies signature AND expiry against JWT_SECRET before
 * trusting the role claim. Authentication itself was never affected —
 * verifyToken / socketAuth always verified signatures; only limiter
 * bucketing trusted decoded claims.
 *
 * Admins keep generous, FINITE tiers (no unlimited exemptions):
 * authenticated admins are bucketed by their verified token with the same
 * baseMax as everyone else (deliberately high limits per route), and auth
 * routes give verified admins a 1000-attempt tier instead of bypassing.
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { getClientIp } = require('../utils/getClientIp');

/**
 * Extract the role claim from a JWT only when the signature is valid and the
 * token is unexpired. Returns null for missing, malformed, unsigned,
 * tampered, wrong-secret, or expired tokens — and for valid tokens that carry
 * no role claim (e.g. the 5-minute MFA temp token).
 *
 * @param {string|undefined} token
 * @returns {string|null}
 */
function getVerifiedTokenRole(token) {
  if (typeof token !== 'string' || token.length === 0) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && typeof decoded.role === 'string') return decoded.role;
  } catch {
    // Invalid signature, expired, or malformed — no privileged treatment.
  }
  return null;
}

function isAdminRole(role) {
  return role === 'admin' || role === 'super admin';
}

// General-purpose limiter factory for public read / authenticated / admin /
// polling routes. Limits are per verified-token or per real client IP.
//
// Bucketing rules:
//   - verified admin token  → own bucket keyed by token (same baseMax)
//   - verified customer token → own bucket keyed by token
//   - anything else (no token, unsigned, tampered, expired) → IP bucket.
//     Invalid tokens must NOT get per-token buckets: an attacker rotating
//     garbage tokens would otherwise rotate buckets and evade the limit.
const createLimiter = (baseMax, windowMinutes, messagePrefix) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max: baseMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: `${messagePrefix}. Please try again after ${windowMinutes} minutes.`,
  },
  keyGenerator: (req) => {
    const token = req.cookies?.token;
    if (token && token.length > 0) {
      const role = getVerifiedTokenRole(token);
      if (isAdminRole(role)) {
        return `admin:${token}`;
      }
      if (role) {
        return `user:${token}`;
      }
      // Unverified token — fall through to IP bucketing.
    }
    return `ip:${ipKeyGenerator(getClientIp(req))}`;
  },
});

// Auth routes (login, OTP, MFA, refresh): strict to prevent brute-force.
// Behind Nginx+Docker all requests share the same proxy IP, so bucket by
// email when provided and fall back to the real client IP.
// Verified admins get a 1000-attempt tier (generous for real admin tooling,
// useless to forgers); everyone else gets 100 / 15 min.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    const role = getVerifiedTokenRole(req.cookies?.token);
    return isAdminRole(role) ? 1000 : 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again after 15 minutes.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    const token = req.cookies?.token;
    const role = getVerifiedTokenRole(token);
    if (isAdminRole(role)) {
      // Verified admins and super admins get a separate bucket.
      return `auth-admin:${token}`;
    }
    // Use the real client IP (Cloudflare-aware) instead of the Docker gateway IP.
    const clientIp = getClientIp(req);
    const ip = ipKeyGenerator(clientIp);
    return email ? `auth:${email}:${ip}` : `auth:${ip}`;
  },
});

// 🛡️ SECURITY: strict registration limiter. The general authLimiter keys on
// email:IP, so a fraudster rotating disposable emails gets a fresh bucket per
// address — useless against mass fake-account creation. This limiter keys on
// IP ONLY with a hard cap, so rotating throwaway addresses doesn't help.
// 10 per 30 min: generous enough for shared-IP legit users (CGNAT, offices),
// still throttles bulk signup; the disposable blocklist catches the rest.
// Forged admin cookies do NOT get a token-keyed bucket here — only verified
// admin tokens do (admins rarely register accounts, and 10/30min is plenty).
const registrationLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 10, // max 10 new-account attempts per IP per 30 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts from this network. Please try again later.',
  },
  keyGenerator: (req) => {
    const token = req.cookies?.token;
    const role = getVerifiedTokenRole(token);
    if (isAdminRole(role)) {
      return `auth-admin:${token}`;
    }
    return `register:${ipKeyGenerator(getClientIp(req))}`;
  },
});

module.exports = {
  getVerifiedTokenRole,
  isAdminRole,
  createLimiter,
  authLimiter,
  registrationLimiter,
};