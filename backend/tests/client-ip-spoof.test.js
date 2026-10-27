'use strict';

/**
 * Regression tests for F2 — client-IP spoofing via untrusted proxy headers.
 *
 * Threat model (see utils/getClientIp.js): after F1/W2 the only paths into
 * Express are our proxies. A client may still inject CF-Connecting-IP or
 * X-Forwarded-For and — until W1/W3 land — even X-Real-IP survives some
 * hops. getClientIp must honor X-Real-IP ONLY from exact trusted peers and
 * never read CF-Connecting-IP / XFF at all.
 *
 * Run: node --test tests/client-ip-spoof.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Deterministic env before requiring the module under test.
process.env.NODE_ENV = 'test';
delete process.env.TRUSTED_PROXY_IPS; // default boundary under test

const {
  getClientIp,
  isTrustedProxy,
  TRUSTED_PROXIES,
  TRUST_PROXY_CONFIG,
} = require('../src/utils/getClientIp');

// ---------------------------------------------------------------- helpers

const HOST_NGINX_PEERS = ['172.18.0.1', '::ffff:172.18.0.1', '127.0.0.1', '::1', '::ffff:127.0.0.1'];
const ADMIN_PANEL_PEER = '172.18.0.3';
const CUSTOMER_PANEL_PEER = '172.18.0.4';
const UNTRUSTED_PEERS = [
  '172.18.0.2',              // mongo — same bridge, must never be trusted
  '172.18.0.5',              // image-fallback — same bridge
  '172.18.0.9',              // hypothetical future container
  '172.19.0.2',              // other project's docker network
  '192.168.88.218',          // RFC1918 LAN — must NOT be blanket-trusted
  '10.0.0.1',                // RFC1918 — must NOT be blanket-trusted
  '8.8.8.8',                 // public internet (post-F1 impossible; defense)
  '::ffff:8.8.8.8',
  '2a02:4780:75:2146::1',    // public IPv6
];

function makeReq({ peer, headers = {}, expressIp } = {}) {
  return {
    headers,
    ip: expressIp,
    socket: { remoteAddress: peer },
  };
}

// ---------------------------------------------------------------- trust boundary

test('isTrustedProxy: exact host-nginx peer forms are trusted', () => {
  for (const p of HOST_NGINX_PEERS) assert.equal(isTrustedProxy(p), true, p);
});

test('isTrustedProxy: exact panel-nginx container IPs are trusted', () => {
  assert.equal(isTrustedProxy(ADMIN_PANEL_PEER), true);
  assert.equal(isTrustedProxy(CUSTOMER_PANEL_PEER), true);
  assert.equal(isTrustedProxy(`::ffff:${ADMIN_PANEL_PEER}`), true);
  assert.equal(isTrustedProxy(`::ffff:${CUSTOMER_PANEL_PEER}`), true);
});

test('isTrustedProxy: NO blanket RFC1918 / docker-subnet trust (F2 constraint)', () => {
  for (const p of UNTRUSTED_PEERS) assert.equal(isTrustedProxy(p), false, p);
});

test('TRUST_PROXY_CONFIG contains only the exact boundary — no CIDRs beyond the proxies', () => {
  assert.ok(TRUST_PROXY_CONFIG.includes('loopback'));
  assert.ok(TRUST_PROXY_CONFIG.includes('172.18.0.1'));
  assert.ok(TRUST_PROXY_CONFIG.includes(ADMIN_PANEL_PEER));
  assert.ok(TRUST_PROXY_CONFIG.includes(CUSTOMER_PANEL_PEER));
  // No /8, /12, /16 style entries: the only entries are loopback + 3 hosts.
  for (const entry of TRUST_PROXY_CONFIG) {
    if (entry.includes('/')) assert.fail(`broad CIDR in trust list: ${entry}`);
  }
});

// ---------------------------------------------------------------- legit path (valid CF / nginx)

test('valid request via host nginx: X-Real-IP is honored', () => {
  for (const peer of HOST_NGINX_PEERS) {
    const req = makeReq({
      peer,
      headers: { 'x-real-ip': '203.0.113.10' },
      expressIp: '172.18.0.1',
    });
    assert.equal(getClientIp(req), '203.0.113.10', `peer=${peer}`);
  }
});

test('valid request via panel nginx containers: X-Real-IP is honored', () => {
  const req = makeReq({
    peer: CUSTOMER_PANEL_PEER,
    headers: { 'x-real-ip': '198.51.100.7' },
    expressIp: '172.18.0.4',
  });
  assert.equal(getClientIp(req), '198.51.100.7');
});

test('valid IPv6 client behind nginx: IPv6 X-Real-IP is honored', () => {
  const req = makeReq({
    peer: '172.18.0.1',
    headers: { 'x-real-ip': '2606:4700:3033::6815:17a2' },
    expressIp: '172.18.0.1',
  });
  assert.equal(getClientIp(req), '2606:4700:3033::6815:17a2');
});

test('legit request with all three headers present: X-Real-IP wins, XFF/CF ignored', () => {
  const req = makeReq({
    peer: '::ffff:172.18.0.1',
    headers: {
      'x-real-ip': '203.0.113.10',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      'cf-connecting-ip': '9.9.9.9',
    },
    expressIp: '172.18.0.1',
  });
  assert.equal(getClientIp(req), '203.0.113.10');
});

// ---------------------------------------------------------------- forged CF-Connecting-IP

test('F2 vector: forged CF-Connecting-IP is NEVER read — trusted peer, no X-Real-IP', () => {
  const req = makeReq({
    peer: '172.18.0.1',
    headers: { 'cf-connecting-ip': '1.2.3.4' },
    expressIp: '172.18.0.1',
  });
  assert.equal(getClientIp(req), '172.18.0.1', 'must fall back to peer, not the CF header');
});

test('F2 vector: forged CF-Connecting-IP with no other headers — untrusted peer', () => {
  const req = makeReq({
    peer: '8.8.8.8',
    headers: { 'cf-connecting-ip': '1.2.3.4' },
    expressIp: '8.8.8.8',
  });
  assert.equal(getClientIp(req), '8.8.8.8');
});

test('forged CF-Connecting-IP cannot override a valid X-Real-IP from a trusted peer', () => {
  const req = makeReq({
    peer: '172.18.0.1',
    headers: { 'x-real-ip': '203.0.113.10', 'cf-connecting-ip': '6.6.6.6' },
    expressIp: '172.18.0.1',
  });
  assert.equal(getClientIp(req), '203.0.113.10');
});

// ---------------------------------------------------------------- forged X-Forwarded-For

test('F2 vector: forged XFF chain is NEVER read — trusted peer without X-Real-IP', () => {
  const req = makeReq({
    peer: '172.18.0.1',
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
    expressIp: '172.18.0.1',
  });
  assert.equal(getClientIp(req), '172.18.0.1');
});

test('forged XFF from an untrusted peer is ignored', () => {
  const req = makeReq({
    peer: '172.18.0.5',
    headers: { 'x-forwarded-for': '1.2.3.4' },
    expressIp: '172.18.0.5',
  });
  assert.equal(getClientIp(req), '172.18.0.5');
});

// ---------------------------------------------------------------- forged X-Real-IP from untrusted peers

test('F2 vector: unrelated bridge container (image-fallback) cannot inject X-Real-IP', () => {
  const req = makeReq({
    peer: '172.18.0.5',
    headers: { 'x-real-ip': '1.2.3.4' },
    expressIp: '172.18.0.5',
  });
  assert.equal(getClientIp(req), '172.18.0.5', 'must return the peer, not the injected header');
});

test('mongo container cannot inject X-Real-IP', () => {
  const req = makeReq({
    peer: '172.18.0.2',
    headers: { 'x-real-ip': '1.2.3.4' },
    expressIp: '172.18.0.2',
  });
  assert.equal(getClientIp(req), '172.18.0.2');
});

test('direct-origin request (public peer) with forged X-Real-IP: header ignored', () => {
  for (const peer of ['8.8.8.8', '::ffff:8.8.8.8', '2a02:4780:75:2146::1']) {
    const req = makeReq({ peer, headers: { 'x-real-ip': '1.2.3.4' }, expressIp: peer });
    assert.equal(getClientIp(req), peer);
  }
});

// ---------------------------------------------------------------- malformed / adversarial values

test('malformed X-Real-IP values from a trusted peer fall back to peer (never crash, never spoof)', () => {
  const bad = [
    '1.2.3.4, 5.6.7.8',   // duplicate-header join / list
    '1.2.3.4:80',         // port appended
    '999.1.1.1',           // out-of-range octets
    '1.2.3',               // too few octets
    'abc',
    '',
    '   ',
    '203.0.113.10 extra',
    '<script>alert(1)</script>',
  ];
  for (const v of bad) {
    const req = makeReq({
      peer: '172.18.0.1',
      headers: { 'x-real-ip': v },
      expressIp: '172.18.0.1',
    });
    assert.equal(getClientIp(req), '172.18.0.1', `value=${JSON.stringify(v)}`);
  }
});

test('non-string X-Real-IP (array header) is ignored', () => {
  const req = makeReq({
    peer: '172.18.0.1',
    headers: { 'x-real-ip': ['1.2.3.4', '5.6.7.8'] },
    expressIp: '172.18.0.1',
  });
  assert.equal(getClientIp(req), '172.18.0.1');
});

// ---------------------------------------------------------------- direct-origin / fallbacks

test('direct-origin request with NO headers returns the TCP peer', () => {
  const req = makeReq({ peer: '82.29.177.108', expressIp: '82.29.177.108' });
  assert.equal(getClientIp(req), '82.29.177.108');
});

test('trusted peer with no headers falls back to req.ip (Express-derived)', () => {
  const req = makeReq({ peer: '172.18.0.1', expressIp: '203.0.113.99' });
  assert.equal(getClientIp(req), '203.0.113.99');
});

test('missing socket and req.ip degrade to empty string (never throw)', () => {
  assert.equal(getClientIp({ headers: {} }), '');
});

// ---------------------------------------------------------------- env extension

test('TRUSTED_PROXY_IPS env var extends the boundary additively (child process)', () => {
  const out = execFileSync(
    process.execPath,
    [
      '-e',
      `process.env.TRUSTED_PROXY_IPS='172.28.0.9';
       const { getClientIp, isTrustedProxy } = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'utils', 'getClientIp.js'))});
       console.log(JSON.stringify({
         extended: isTrustedProxy('172.28.0.9'),
         stillUntrusted: isTrustedProxy('172.18.0.2'),
         honored: getClientIp({ headers: { 'x-real-ip': '203.0.113.10' }, socket: { remoteAddress: '172.28.0.9' }, ip: '172.28.0.9' }),
       }));`,
    ],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.extended, true, 'env-added IP must be trusted');
  assert.equal(parsed.stillUntrusted, false, 'default boundary must not widen');
  assert.equal(parsed.honored, '203.0.113.10', 'env-added proxy X-Real-IP must be honored');
});

test('TRUSTED_PROXIES set never contains broad ranges (invariants)', () => {
  for (const entry of TRUSTED_PROXIES) {
    if (entry.includes('/')) assert.fail(`CIDR slipped into TRUSTED_PROXIES: ${entry}`);
  }
});