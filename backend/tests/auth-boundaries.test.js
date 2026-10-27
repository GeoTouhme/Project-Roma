'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-auth-test-secret-not-production';
process.env.FRONTEND_URL = 'https://store.example.test';
process.env.GOOGLE_CLIENT_ID = 'mock-google-audience';
const tokens = require('../src/utils/authTokens');
const verifyApi = require('../src/config/jwt');
const socketAuth = require('../src/config/socketAuth');
const { getVerifiedTokenRole } = require('../src/middleware/rateLimiters');
const ID = 'a'.repeat(24);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function loadController(name, mocks) {
  const filename = path.resolve(__dirname, '../src/controllers', name);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name);
  // Keep controller logs out of test-runner IPC and never print credential fixtures.
  mod._compile('const console = { log() {}, warn() {}, error() {} };\n'
    + fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}

function res() {
  return {
    statusCode: 200, cookies: [], cleared: [],
    status(n) { this.statusCode = n; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) { this.cookies.push({ name, value, options }); },
    clearCookie(name) { this.cleared.push(name); },
  };
}

// Every database write and mail send below affects this in-memory fixture only.
function fixture(overrides = {}) {
  const state = {
    user: {
      _id: ID, email: 'customer@example.test', role: 'user', isVerified: true,
      password: bcrypt.hashSync('old-password', 4), wishlist: [], googleId: 'mock-google-id',
      mfaEnabled: false, otp: '123456', otpAttempts: 0,
      save: async function () { return this; }, ...overrides,
    },
    mail: [], writes: [], reads: 0,
  };
  const matches = filter => state.user && Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return true;
    if (value && value.$gt) return new Date(state.user[key]) > value.$gt;
    return state.user[key]?.toString() === value?.toString();
  });
  const query = value => ({
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    select() { return this; }, maxTimeMS() { return this; },
    exec: () => Promise.resolve(value),
  });
  function update(filter, change) {
    if (!matches(filter)) return null;
    state.writes.push(change);
    Object.assign(state.user, change.$set || change);
    for (const key of Object.keys(change.$unset || {})) delete state.user[key];
    return state.user;
  }
  const users = {
    findOne: filter => { state.reads++; return query(matches(filter) ? state.user : null); },
    findById: id => { state.reads++; return query(matches({ _id: id }) ? state.user : null); },
    findByIdAndUpdate: async (id, change) => update({ _id: id }, change),
    findOneAndUpdate: async (filter, change) => update(filter, change),
    exists: async () => false,
  };
  const mocks = {
    '../models/User': users, '../models/Product': { aggregate: async () => [] },
    '../utils/mailer': async message => state.mail.push(message),
    '../utils/socketManager': { emitToAdmins() {} },
    '../utils/emailGuard': { assertAcceptableEmail: async () => {}, isDisposableEmail: () => false },
    fs: { readFileSync: () => '<a href="javascript:void(0);">Reset</a>' },
  };
  const auth = loadController('auth.js', mocks);
  const google = loadController('googleAuth.js', {
    ...mocks, './auth': auth,
    'google-auth-library': { OAuth2Client: class {
      async verifyIdToken(options) {
        assert.equal(options.audience, 'mock-google-audience');
        return { getPayload: () => ({ sub: 'mock-google-id', email: state.user.email, email_verified: true }) };
      }
    } },
  });
  return { state, auth, google };
}

const tokenCases = () => [
  ['access', tokens.signAccessToken({ _id: ID, email: 'admin@example.test', role: 'admin' }), tokens.verifyAccessToken],
  ['mfa', tokens.signMfaTempToken(ID), tokens.verifyMfaTempToken],
  ['email', tokens.signEmailVerificationToken('customer@example.test'), tokens.verifyEmailVerificationToken],
  ['reset', tokens.signPasswordResetToken(ID), tokens.verifyPasswordResetToken],
];

test('token consumers accept only their own purpose, key, audience, and issuer', () => {
  const cases = tokenCases();
  for (const [name, token, verify] of cases) {
    assert.ok(verify(token));
    for (const [other, otherToken] of cases) {
      if (name !== other) assert.throws(() => verify(otherToken), `${other} accepted as ${name}`);
    }
  }
});

test('legacy, unsigned, wrong-algorithm, wrong-audience, expired, and malformed access tokens fail', () => {
  const claims = jwt.decode(tokens.signAccessToken({ _id: ID, role: 'admin' }));
  const { exp, ...withoutExpiry } = claims;
  const key = crypto.createHmac('sha256', process.env.JWT_SECRET).update('project-roma:auth:v1:access').digest();
  const invalid = [
    jwt.sign({ _id: ID, role: 'admin' }, process.env.JWT_SECRET),
    jwt.sign(claims, key, { algorithm: 'HS384' }),
    jwt.sign({ ...claims, aud: 'other' }, key),
    jwt.sign({ ...claims, iss: 'other' }, key),
    jwt.sign({ ...claims, exp: 1 }, key),
    jwt.sign({ ...claims, _id: { $ne: null } }, key),
    jwt.sign({ ...claims, role: 'owner' }, key),
    jwt.sign({ ...claims, mfa: true }, key),
    jwt.sign(withoutExpiry, key),
    'eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.', undefined,
  ];
  for (const value of invalid) assert.throws(() => tokens.verifyAccessToken(value));
});

test('API, sockets reject tokens without a current session; limiter checks signature', async () => {
  const admin = tokens.signAccessToken({ _id: ID, role: 'admin' });
  const others = tokenCases().filter(([name]) => name !== 'access').map(([, token]) => token);
  others.push(jwt.sign({ _id: ID, role: 'admin' }, process.env.JWT_SECRET));
  for (const token of [admin, ...others]) {
    let passed = false;
    const response = res();
    await verifyApi({ cookies: { token } }, response, () => { passed = true; });
    let socketError;
    await socketAuth({ request: { headers: { cookie: `token=${token}` } } }, error => { socketError = error; });
    assert.equal(passed, false);
    assert.equal(!socketError, false);
    assert.equal(getVerifiedTokenRole(token), token === admin ? 'admin' : null);
    assert.equal(response.statusCode, 401);
  }
});

test('reset email ignores body origin and Host, uses a fragment, and stores only a hash', async () => {
  const { auth, state } = fixture(); const response = res();
  await auth.forgetPassword({ body: { email: state.user.email, origin: 'https://evil.invalid' }, headers: { host: 'evil.invalid', 'x-forwarded-host': 'evil.invalid' } }, response);
  assert.equal(response.statusCode, 200);
  const url = new URL(state.mail[0].html.match(/href="([^"]+)"/)[1]);
  assert.equal(url.origin, 'https://store.example.test');
  assert.equal(url.pathname, '/auth/reset-password');
  assert.equal(url.search, '');
  const token = new URLSearchParams(url.hash.slice(1)).get('token');
  assert.equal(tokens.verifyPasswordResetToken(token)._id, ID);
  assert.equal(state.user.passwordResetTokenHash, hash(token));
  assert.ok(!state.mail[0].html.includes('evil.invalid'));
  const unknown = res();
  await auth.forgetPassword({ body: { email: 'absent@example.test' } }, unknown);
  assert.deepEqual(unknown.body, response.body);
});

test('production reset links fail closed for unsafe server URL configuration', () => {
  const previous = { node: process.env.NODE_ENV, url: process.env.FRONTEND_URL };
  try {
    process.env.NODE_ENV = 'production';
    for (const url of ['http://store.example.test', 'javascript:alert(1)', 'https://user:pass@store.example.test']) {
      process.env.FRONTEND_URL = url;
      assert.throws(() => tokens.passwordResetLink('dummy'));
    }
  } finally { process.env.NODE_ENV = previous.node; process.env.FRONTEND_URL = previous.url; }
});

async function requestReset(auth, state) {
  await auth.forgetPassword({ body: { email: state.user.email } }, res());
  const url = new URL(state.mail.at(-1).html.match(/href="([^"]+)"/)[1]);
  return new URLSearchParams(url.hash.slice(1)).get('token');
}

test('reset rejects every non-reset token before database access', async () => {
  for (const [name, token] of tokenCases()) {
    if (name === 'reset') continue;
    const { auth, state } = fixture(); const response = res();
    await auth.resetPassword({ body: { token, newPassword: 'new-password' } }, response);
    assert.equal(response.statusCode, 400); assert.equal(state.reads, 0); assert.equal(state.writes.length, 0);
  }
});

test('reset is single-use, invalidates refresh state, and handles simultaneous consumption', async () => {
  const { auth, state } = fixture({ refreshTokenHash: 'old', refreshTokenVersion: 1 });
  const token = await requestReset(auth, state);
  const first = res(), second = res();
  await Promise.all([first, second].map(response => auth.resetPassword({ body: { token, newPassword: 'new-password' } }, response)));
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 400]);
  assert.ok(await bcrypt.compare('new-password', state.user.password));
  assert.equal(state.user.passwordResetTokenHash, undefined);
  assert.equal(state.user.refreshTokenHash, null);
  assert.equal(state.user.refreshTokenVersion, 0);
  const replay = res();
  await auth.resetPassword({ body: { token, newPassword: 'third-password' } }, replay);
  assert.equal(replay.statusCode, 400);
});

test('new reset invalidates previous reset and invalid passwords do not consume the latest token', async () => {
  const { auth, state } = fixture();
  const oldToken = await requestReset(auth, state), token = await requestReset(auth, state);
  assert.notEqual(oldToken, token);
  const old = res(); await auth.resetPassword({ body: { token: oldToken, newPassword: 'new-password' } }, old);
  assert.equal(old.statusCode, 400);
  for (const password of ['short', {}, 'é'.repeat(40), 'old-password']) {
    const response = res(); await auth.resetPassword({ body: { token, newPassword: password } }, response);
    assert.equal(response.statusCode, 400); assert.equal(state.user.passwordResetTokenHash, hash(token));
  }
  state.user.passwordResetTokenExpiresAt = new Date(0);
  const expired = res(); await auth.resetPassword({ body: { token, newPassword: 'new-password' } }, expired);
  assert.equal(expired.statusCode, 400);
});

test('password and Google login require MFA and cannot issue session cookies first', async () => {
  const { auth, google } = fixture({ mfaEnabled: true });
  const passwordResponse = res();
  await auth.loginUser({ body: { email: 'customer@example.test', password: 'old-password' } }, passwordResponse);
  assert.equal(passwordResponse.body.mfaRequired, true); assert.equal(passwordResponse.cookies.length, 0);
  assert.equal(tokens.verifyMfaTempToken(passwordResponse.body.tempToken)._id, ID);
  const response = res(); await google.googleAuth({ body: { idToken: 'mock-token' } }, response);
  assert.equal(response.body.mfaRequired, true); assert.equal(response.cookies.length, 0);
  const user = fixture().state.user;
  await assert.rejects(auth.issueTokenPair(res(), { ...user, mfaEnabled: true }), /incomplete/);
});

test('email link and OTP verification require local MFA for enrolled accounts', async () => {
  for (const mode of ['link', 'otp']) {
    const { auth, state } = fixture({ mfaEnabled: true, isVerified: false }); const response = res();
    if (mode === 'link') await auth.verifyEmailToken({ body: { token: tokens.signEmailVerificationToken(state.user.email) } }, response);
    else await auth.verifyOtp({ body: { email: state.user.email, otp: '123456' } }, response);
    assert.equal(state.user.isVerified, true); assert.equal(response.body.mfaRequired, true); assert.equal(response.cookies.length, 0);
  }
});

test('valid TOTP completion issues typed access and versioned refresh cookies; wrong code cannot', async () => {
  const secret = speakeasy.generateSecret().base32;
  const key = crypto.scryptSync(process.env.MFA_SECRET_KEY || process.env.JWT_SECRET, 'project-roma-mfa', 32);
  const iv = crypto.randomBytes(16), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  const mfaSecret = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  const { auth, state } = fixture({ mfaEnabled: true, mfaSecret });
  const tempToken = tokens.signMfaTempToken(ID);
  const wrong = res(); await auth.verifyMfa({ body: { tempToken, code: 'invalid' } }, wrong);
  assert.equal(wrong.statusCode, 400); assert.equal(wrong.cookies.length, 0);
  const response = res();
  await auth.verifyMfa({ body: { tempToken, code: speakeasy.totp({ secret, encoding: 'base32' }) } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(tokens.verifyAccessToken(response.cookies.find(x => x.name === 'token').value)._id, ID);
  assert.equal(response.cookies.length, 2); assert.equal(state.user.refreshTokenVersion, 1);
});

test('ordinary login and Google login preserve verified non-MFA sessions', async () => {
  for (const mode of ['password', 'google']) {
    const { auth, google, state } = fixture(); const response = res();
    if (mode === 'password') await auth.loginUser({ body: { email: state.user.email, password: 'old-password' } }, response);
    else await google.googleAuth({ body: { idToken: 'mock-token' } }, response);
    assert.equal(response.body.success, true); assert.equal(response.cookies.length, 2);
    assert.equal(tokens.verifyAccessToken(response.cookies[0].value)._id, ID);
  }
});

test('pre-fix refresh sessions cannot mint typed access; new completed sessions can refresh', async () => {
  for (const version of [0, 1]) {
    const raw = 'dummy-refresh-token';
    const { auth } = fixture({ refreshTokenHash: hash(raw), refreshTokenExpiresAt: new Date(Date.now() + 60000), refreshTokenVersion: version, authSessionId: 'b'.repeat(64) });
    const response = res(); await auth.refreshToken({ cookies: { refreshToken: raw } }, response);
    assert.equal(response.statusCode, version ? 200 : 401);
    assert.equal(response.cookies.length, version ? 2 : 0);
  }
});

test('unverified linked Google accounts and incomplete sessions cannot issue cookies', async () => {
  const { auth, google, state } = fixture({ isVerified: false });
  const response = res();
  await google.googleAuth({ body: { idToken: 'mock-token' } }, response);
  assert.equal(response.statusCode, 403); assert.equal(response.cookies.length, 0);
  await assert.rejects(auth.issueTokenPair(res(), state.user), /incomplete/);
});

test('MFA and email controllers reject tokens intended for a different authentication step', async () => {
  const { auth, state } = fixture({ mfaEnabled: true });
  const access = tokens.signAccessToken(state.user);
  const mfaResponse = res();
  await auth.verifyMfa({ body: { tempToken: access, code: '123456' } }, mfaResponse);
  assert.equal(mfaResponse.statusCode, 401);
  const emailResponse = res();
  await auth.verifyEmailToken({ body: { token: access } }, emailResponse);
  assert.equal(emailResponse.statusCode, 400);
  assert.equal(state.reads, 0); assert.equal(state.writes.length, 0);
});

test('R05 logout revokes opaque refresh and all access in that session', async () => {
  const { auth,state }=fixture();const login=res();await auth.issueTokenPair(login,state.user);
  const raw=login.cookies.find(x=>x.name==='refreshToken').value;
  assert.ok(state.user.authSessionId);
  const out=res();await auth.logoutUser({cookies:{refreshToken:raw}},out);
  assert.equal(out.statusCode,200);assert.equal(state.user.authSessionId,undefined);
  const replay=res();await auth.refreshToken({cookies:{refreshToken:raw}},replay);
  assert.equal(replay.statusCode,401);assert.equal(replay.cookies.length,0);
});

test('R05 concurrent refresh consumes the old token exactly once', async () => {
  const { auth,state }=fixture();const login=res();await auth.issueTokenPair(login,state.user);
  const raw=login.cookies.find(x=>x.name==='refreshToken').value;
  const results=[res(),res()];await Promise.all(results.map(out=>auth.refreshToken({cookies:{refreshToken:raw}},out)));
  assert.equal(results.filter(out=>out.statusCode===200).length,1);
  assert.equal(results.filter(out=>out.cookies.length===2).length,1);
});
