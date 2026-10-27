'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = 'project-roma';
const PURPOSES = new Set(['access', 'mfa', 'email-verify', 'password-reset']);
const USER_ID = /^[a-f\d]{24}$/i;
const ROLES = new Set(['user', 'admin', 'super admin']);

function tokenKey(purpose) {
  if (!PURPOSES.has(purpose) || !process.env.JWT_SECRET) {
    throw new Error('Authentication signing configuration is unavailable');
  }
  // Domain-separated keys avoid adding new deployment secrets or changing MFA encryption.
  return crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`project-roma:auth:v1:${purpose}`).digest();
}

function validateClaims(claims, purpose) {
  if (!claims || typeof claims !== 'object' || claims.purpose !== purpose) {
    throw new Error('Invalid token purpose');
  }
  if (purpose === 'email-verify') {
    if (typeof claims.email !== 'string' || !claims.email.trim()) throw new Error('Invalid email claim');
  } else if (typeof claims._id !== 'string' || !USER_ID.test(claims._id)) {
    throw new Error('Invalid user claim');
  }
  if (purpose === 'access' && (!ROLES.has(claims.role) || claims.mfa !== undefined)) {
    throw new Error('Invalid access claims');
  }
  if (purpose === 'mfa' && (claims.mfa !== true || claims.role !== undefined)) {
    throw new Error('Invalid MFA claims');
  }
  if (purpose === 'password-reset' && !/^[a-f\d]{64}$/.test(claims.jti || '')) {
    throw new Error('Invalid reset claim');
  }
}

function signToken(payload, purpose, expiresIn) {
  const claims = { ...payload, purpose };
  validateClaims(claims, purpose);
  return jwt.sign(claims, tokenKey(purpose), {
    algorithm: 'HS256', issuer: ISSUER, audience: `${ISSUER}:${purpose}`, expiresIn,
  });
}

function verifyToken(token, purpose) {
  if (typeof token !== 'string' || !token) throw new Error('Missing token');
  const claims = jwt.verify(token, tokenKey(purpose), {
    algorithms: ['HS256'], issuer: ISSUER, audience: `${ISSUER}:${purpose}`,
  });
  validateClaims(claims, purpose);
  if (!Number.isInteger(claims.exp) || !Number.isInteger(claims.iat)) throw new Error('Missing token lifetime');
  return claims;
}

const signAccessToken = user => signToken({ _id: user._id.toString(), email: user.email, role: user.role, ...(user.authSessionId ? { sid: user.authSessionId } : {}) }, 'access', '15m');
const verifyAccessToken = token => verifyToken(token, 'access');
const signMfaTempToken = id => signToken({ _id: id.toString(), mfa: true }, 'mfa', '5m');
const verifyMfaTempToken = token => verifyToken(token, 'mfa');
const signEmailVerificationToken = email => signToken({ email }, 'email-verify', '1h');
const verifyEmailVerificationToken = token => verifyToken(token, 'email-verify');
const signPasswordResetToken = id => signToken({ _id: id.toString(), jti: crypto.randomBytes(32).toString('hex') }, 'password-reset', '15m');
const verifyPasswordResetToken = token => verifyToken(token, 'password-reset');

function passwordResetLink(token) {
  const frontend = new URL(process.env.FRONTEND_URL || 'https://balportliquors.com');
  const localDevelopment = process.env.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1', '[::1]'].includes(frontend.hostname);
  if (frontend.username || frontend.password
      || (frontend.protocol !== 'https:' && !(localDevelopment && frontend.protocol === 'http:'))) {
    throw new Error('Invalid storefront URL configuration');
  }
  // A fragment is never sent in HTTP paths, Referer headers, or origin access logs.
  const link = new URL('/auth/reset-password', frontend.origin);
  link.hash = new URLSearchParams({ token }).toString();
  return link.href;
}

module.exports = {
  signAccessToken, verifyAccessToken, signMfaTempToken, verifyMfaTempToken,
  signEmailVerificationToken, verifyEmailVerificationToken,
  signPasswordResetToken, verifyPasswordResetToken, passwordResetLink,
};
