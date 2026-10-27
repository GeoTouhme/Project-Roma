'use strict';

/**
 * Regression tests for F6 — JWT-based rate-limit bypass.
 *
 * All behavior is exercised through the real middleware (no internals): we
 * drive requests with forged / invalid / expired / valid JWT cookies through
 * the limiters and assert on what actually matters — 429s, bucket sharing,
 * and the RateLimit-Limit tier header.
 *
 * Covered attack (original F6): unsigned `token` cookie containing
 * {"role":"admin"} used to skip rate limiting entirely (createLimiter) or
 * unlock the 1000-attempt auth tier and private buckets (authLimiter /
 * registrationLimiter).
 *
 * Run: node --test tests/rate-limit-bypass.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const SECRET = 'test-jwt-secret-for-rate-limit-regression';
process.env.JWT_SECRET = SECRET;
process.env.NODE_ENV = 'test';
const { signAccessToken, signMfaTempToken } = require('../src/utils/authTokens');

const {
  getVerifiedTokenRole,
  isAdminRole,
  createLimiter,
  authLimiter,
  registrationLimiter,
} = require('../src/middleware/rateLimiters');

// ---------------------------------------------------------------- helpers

const ADMIN_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const CUSTOMER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

function signAdminToken() {
  return signAccessToken({ _id: ADMIN_ID, email: 'admin@balport.test', role: 'admin' });
}

function signSuperAdminToken() {
  return signAccessToken({ _id: ADMIN_ID, email: 'root@balport.test', role: 'super admin' });
}

function signCustomerToken() {
  return signAccessToken({ _id: CUSTOMER_ID, email: 'user@balport.test', role: 'user' });
}

/** The original F6 attack: unsigned { role: 'admin' } payload as a cookie. */
function forgedAdminCookie() {
  return Buffer.from(JSON.stringify({ _id: 'evil', role: 'admin' })).toString('base64url');
}

/** Second distinct forged value — used to prove rotating cookies share one bucket. */
function forgedSuperAdminCookie() {
  return `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ role: 'super admin' })).toString('base64url')}.sig`;
}

/** Expired admin token signed with the CORRECT secret. */
function expiredAdminToken() {
  const now = Date.now;
  Date.now = () => now() - 60 * 60 * 1000;
  try { return signAdminToken(); } finally { Date.now = now; }
}

/** Admin token signed with the WRONG secret — valid structure, bad signature. */
function wrongSecretAdminToken() {
  process.env.JWT_SECRET = 'wrong-secret';
  try { return signAdminToken(); } finally { process.env.JWT_SECRET = SECRET; }
}

/** MFA temp token: validly signed but carries no role claim. */
function mfaTempToken() {
  return signMfaTempToken(ADMIN_ID);
}

function makeReq({ cookie } = {}) {
  return {
    cookies: cookie ? { token: cookie } : {},
    headers: {},
    ip: '203.0.113.10',
    body: {},
  };
}

/**
 * Drive one request through a limiter middleware. Resolves with
 * { passed, statusCode, headers } — passed=true when next() was called,
 * statusCode=429 when the limiter rejected the request.
 */
function hit(limiter, opts = {}) {
  return new Promise((resolve) => {
    const req = makeReq(opts);
    const out = { passed: false, statusCode: 0, headers: {} };
    const res = {
      status(c) { out.statusCode = c; return res; },
      setHeader(k, v) { out.headers[k] = v; return res; },
      set(k, v) { if (typeof k === 'string') out.headers[k] = v; return res; },
      header(k, v) { out.headers[k] = v; return res; },
      json() { resolve(out); return res; },
      send() { resolve(out); return res; },
      end() { resolve(out); return res; },
      get() { return undefined; },
    };
    limiter(req, res, () => { out.passed = true; resolve(out); });
  });
}

async function expect429After(limiter, count, opts) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await hit(limiter, opts));
  }
  return results;
}

// ---------------------------------------------------------------- role detection (unit)

test('getVerifiedTokenRole returns admin for a valid signed admin token', () => {
  assert.equal(getVerifiedTokenRole(signAdminToken()), 'admin');
});

test('getVerifiedTokenRole returns super admin for a valid signed super-admin token', () => {
  assert.equal(getVerifiedTokenRole(signSuperAdminToken()), 'super admin');
});

test('getVerifiedTokenRole rejects the forged unsigned admin cookie (F6 attack)', () => {
  assert.equal(getVerifiedTokenRole(forgedAdminCookie()), null);
});

test('getVerifiedTokenRole rejects a token with an invalid signature', () => {
  assert.equal(getVerifiedTokenRole(wrongSecretAdminToken()), null);
});

test('getVerifiedTokenRole rejects an expired admin token', () => {
  assert.equal(getVerifiedTokenRole(expiredAdminToken()), null);
});

test('getVerifiedTokenRole returns null for the role-less MFA temp token', () => {
  // MFA step-up tokens are not admin sessions and must not buy admin treatment.
  assert.equal(getVerifiedTokenRole(mfaTempToken()), null);
});

test('getVerifiedTokenRole returns user for a valid signed customer token', () => {
  assert.equal(getVerifiedTokenRole(signCustomerToken()), 'user');
});

test('getVerifiedTokenRole returns null for missing / malformed tokens', () => {
  assert.equal(getVerifiedTokenRole(undefined), null);
  assert.equal(getVerifiedTokenRole(''), null);
  assert.equal(getVerifiedTokenRole('not-a-jwt'), null);
  assert.equal(getVerifiedTokenRole(12345), null);
});

test('isAdminRole matches only admin / super admin', () => {
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('super admin'), true);
  assert.equal(isAdminRole('user'), false);
  assert.equal(isAdminRole(null), false);
});

// ---------------------------------------------------------------- createLimiter (integration)

test('createLimiter: forged admin cookie is LIMITED — hits 429 at the cap (F6 attack)', async () => {
  // The old code called next() for forged admin cookies without touching the
  // limiter. The cookie must now be counted like any other request.
  const limiter = createLimiter(3, 15, 'Too many requests');
  const results = await expect429After(limiter, 4, { cookie: forgedAdminCookie() });
  assert.equal(results.filter((r) => r.statusCode === 429).length, 1,
    `expected exactly one 429, got ${JSON.stringify(results.map((r) => r.statusCode))}`);
});

test('createLimiter: rotating forged cookies cannot rotate buckets', async () => {
  const limiter = createLimiter(3, 15, 'Too many requests');
  await hit(limiter, { cookie: forgedAdminCookie() });
  await hit(limiter, { cookie: forgedAdminCookie() });
  await hit(limiter, { cookie: forgedSuperAdminCookie() }); // different forged value
  const fourth = await hit(limiter, { cookie: forgedSuperAdminCookie() });
  assert.equal(fourth.statusCode, 429, 'distinct forged tokens must share the single IP bucket');
});

test('createLimiter: forged cookie shares the IP bucket with no-token requests', async () => {
  const limiter = createLimiter(3, 15, 'Too many requests');
  await expect429After(limiter, 3, { cookie: forgedAdminCookie() });
  const noCookie = await hit(limiter); // same IP, no token at all
  assert.equal(noCookie.statusCode, 429, 'forged cookie and plain requests must share the IP bucket');
});

test('createLimiter: expired admin token falls into the IP bucket too', async () => {
  const limiter = createLimiter(3, 15, 'Too many requests');
  await expect429After(limiter, 3, { cookie: expiredAdminToken() });
  const next = await hit(limiter, { cookie: expiredAdminToken() });
  assert.equal(next.statusCode, 429);
});

test('createLimiter: wrong-secret admin token falls into the IP bucket too', async () => {
  const limiter = createLimiter(3, 15, 'Too many requests');
  await expect429After(limiter, 3, { cookie: wrongSecretAdminToken() });
  const next = await hit(limiter, { cookie: wrongSecretAdminToken() });
  assert.equal(next.statusCode, 429);
});

test('createLimiter: verified admin is rate-limited too, at the finite cap (no unlimited bypass)', async () => {
  // Requirement: retain reasonable limits for admins rather than exempting them.
  const limiter = createLimiter(3, 15, 'Too many requests');
  const results = await expect429After(limiter, 4, { cookie: signAdminToken() });
  assert.equal(results.filter((r) => r.statusCode === 429).length, 1,
    `admin must receive a finite limit, got ${JSON.stringify(results.map((r) => r.statusCode))}`);
});

test('createLimiter: verified admin has a SEPARATE bucket from the shared IP bucket', async () => {
  const limiter = createLimiter(3, 15, 'Too many requests');
  // Exhaust the IP bucket with forged cookies.
  await expect429After(limiter, 3, { cookie: forgedAdminCookie() });
  // A verified admin must still pass (own bucket), and vice versa: exhausting
  // the admin bucket must not affect the IP bucket.
  const admin = await hit(limiter, { cookie: signAdminToken() });
  assert.equal(admin.passed, true, 'verified admin must have a separate bucket');
  await expect429After(limiter, 3, { cookie: signAdminToken() }); // exhaust admin bucket
  const plain = await hit(limiter); // IP bucket still has room
  assert.equal(plain.statusCode, 429, 'IP bucket was exhausted by forged traffic earlier in this test');
});

test('createLimiter: ordinary customer requests from one IP share a bucket and hit the cap', async () => {
  const limiter = createLimiter(3, 15, 'Too many requests');
  const results = await expect429After(limiter, 4);
  assert.equal(results.filter((r) => r.statusCode === 429).length, 1,
    `expected exactly one 429, got ${JSON.stringify(results.map((r) => r.statusCode))}`);
});

test('createLimiter: verified customer token gets its own bucket (normal behavior preserved)', async () => {
  const limiter = createLimiter(3, 15, 'Too many requests');
  await expect429After(limiter, 3); // exhaust IP bucket
  const customer = await hit(limiter, { cookie: signCustomerToken() });
  assert.equal(customer.passed, true, 'signed-in customers keep their own bucket');
});

// ---------------------------------------------------------------- authLimiter (integration)

test('authLimiter: verified admin token gets the 1000-attempt tier', async () => {
  const r = await hit(authLimiter, { cookie: signAdminToken() });
  assert.equal(Number(r.headers['RateLimit-Limit']), 1000, JSON.stringify(r.headers));
});

test('authLimiter: verified super admin gets the 1000-attempt tier', async () => {
  const r = await hit(authLimiter, { cookie: signSuperAdminToken() });
  assert.equal(Number(r.headers['RateLimit-Limit']), 1000, JSON.stringify(r.headers));
});

test('authLimiter: forged admin cookie gets the ordinary 100-attempt tier (F6 attack)', async () => {
  const r = await hit(authLimiter, { cookie: forgedAdminCookie() });
  assert.equal(Number(r.headers['RateLimit-Limit']), 100, JSON.stringify(r.headers));
});

test('authLimiter: expired admin token gets the ordinary 100-attempt tier', async () => {
  const r = await hit(authLimiter, { cookie: expiredAdminToken() });
  assert.equal(Number(r.headers['RateLimit-Limit']), 100, JSON.stringify(r.headers));
});

test('authLimiter: wrong-secret token gets the ordinary 100-attempt tier', async () => {
  const r = await hit(authLimiter, { cookie: wrongSecretAdminToken() });
  assert.equal(Number(r.headers['RateLimit-Limit']), 100, JSON.stringify(r.headers));
});

test('authLimiter: MFA temp token gets the ordinary 100-attempt tier', async () => {
  const r = await hit(authLimiter, { cookie: mfaTempToken() });
  assert.equal(Number(r.headers['RateLimit-Limit']), 100, JSON.stringify(r.headers));
});

test('authLimiter: customer token and no-token requests get the ordinary 100-attempt tier', async () => {
  const customer = await hit(authLimiter, { cookie: signCustomerToken() });
  assert.equal(Number(customer.headers['RateLimit-Limit']), 100);
  const anon = await hit(authLimiter);
  assert.equal(Number(anon.headers['RateLimit-Limit']), 100);
});

// ---------------------------------------------------------------- registrationLimiter (integration)

test('registrationLimiter: forged admin cookie is capped at 10/30min like everyone else (F6 attack)', async () => {
  const results = [];
  for (let i = 0; i < 11; i++) {
    results.push(await hit(registrationLimiter, { cookie: forgedAdminCookie() }));
  }
  const rejected = results.filter((r) => r.statusCode === 429);
  assert.equal(rejected.length, 1,
    `expected the 11th forged-cookie request to be rejected, got ${JSON.stringify(results.map((r) => r.statusCode))}`);
});

test('registrationLimiter: forged cookie shares the bucket with plain requests (same IP)', async () => {
  for (let i = 0; i < 10; i++) {
    await hit(registrationLimiter, { cookie: forgedAdminCookie() });
  }
  const anon = await hit(registrationLimiter); // no cookie, same IP
  assert.equal(anon.statusCode, 429, 'forged cookies must not buy a private registration bucket');
});

test('registrationLimiter: verified admin keeps a separate bucket for staff account creation', async () => {
  for (let i = 0; i < 10; i++) {
    await hit(registrationLimiter, { cookie: forgedAdminCookie() });
  }
  const admin = await hit(registrationLimiter, { cookie: signAdminToken() });
  assert.equal(admin.passed, true, 'verified admins keep their own registration bucket');
});