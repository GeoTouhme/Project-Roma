'use strict';

/**
 * getClientIp.js — single source of truth for client identity (F2 remediation).
 *
 * TRUST MODEL (exact proxies, never whole RFC1918 / Docker subnets):
 * - X-Real-IP is honored ONLY when the TCP peer is one of our reverse proxies:
 *     · host nginx — reaches the backend via the published loopback ports;
 *       Node sees the peer as the Docker bridge gateway (172.18.0.1) or a
 *       loopback form.
 *     · admin-panel nginx (static bridge IP 172.18.0.3)
 *     · customer-panel nginx (static bridge IP 172.18.0.4)
 *   Both nginx tiers OVERWRITE X-Real-IP with their validated $remote_addr
 *   (post-realip), so a value arriving from these peers is authoritative.
 * - CF-Connecting-IP is NEVER read: nginx forwards it untouched today, so a
 *   client-forgeable copy reaches Express even on the proxied path.
 * - X-Forwarded-For is NEVER read by getClientIp: XFF[0] is attacker-chosen
 *   even on the legitimate Cloudflare path (CF appends, never replaces).
 *   Express's own req.ip (trust proxy below) handles XFF safely because it
 *   only unwinds from trusted peers.
 * - Header values are validated with net.isIP before use.
 * - Everything else falls back to the TCP peer address. Fail-closed: if a
 *   proxy's IP drifts, accuracy degrades to peer bucketing — spoofing is
 *   never possible.
 *
 * Unrelated containers on the shared bridge (mongo 172.18.0.2,
 * image-fallback 172.18.0.5, any future service) are NOT trusted and cannot
 * inject a client identity.
 *
 * Topology changes: set TRUSTED_PROXY_IPS (comma-separated IPs/CIDRs) in the
 * environment to extend the boundary without a rebuild.
 */

const net = require('net');

// Canonical trusted-proxy IPs (plain + IPv4-mapped IPv6 peer forms).
const BASE_TRUSTED_PROXY_IPS = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  '172.18.0.1',          // bridge gateway — host nginx via published loopback ports
  '::ffff:172.18.0.1',
  '172.18.0.3',          // admin-panel nginx (static IP pinned in compose)
  '::ffff:172.18.0.3',
  '172.18.0.4',          // customer-panel nginx (static IP pinned in compose)
  '::ffff:172.18.0.4',
];

function parseEnvExtras() {
  return (process.env.TRUSTED_PROXY_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const envExtras = parseEnvExtras();

// Set used by isTrustedProxy() for peer checks (includes mapped forms).
const TRUSTED_PROXIES = new Set([...BASE_TRUSTED_PROXY_IPS, ...envExtras]);

// Express `trust proxy` configuration: loopback keyword + explicit IPs.
// proxy-addr normalizes IPv4-mapped forms itself, so plain entries suffice.
// Same boundary as TRUSTED_PROXIES — single source, exported for index.js.
const TRUST_PROXY_CONFIG = [
  'loopback',
  '172.18.0.1', // bridge gateway — host nginx
  '172.18.0.3', // admin-panel nginx
  '172.18.0.4', // customer-panel nginx
  ...envExtras,
];

function isTrustedProxy(addr) {
  return typeof addr === 'string' && TRUSTED_PROXIES.has(addr.trim());
}

function getClientIp(req) {
  const peer =
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    '';

  if (isTrustedProxy(peer)) {
    const xRealIp = req.headers['x-real-ip'];
    if (typeof xRealIp === 'string') {
      const candidate = xRealIp.trim();
      // net.isIP rejects ports, lists, embedded junk, and duplicate-header
      // joins ("1.2.3.4, 5.6.7.8") — all fall through to the peer address.
      if (candidate && net.isIP(candidate)) {
        return candidate;
      }
    }
  }

  // Untrusted peer, or trusted peer without a valid header: TCP peer only.
  // NEVER fall back to CF-Connecting-IP or X-Forwarded-For here.
  return req.ip || peer || '';
}

module.exports = {
  getClientIp,
  isTrustedProxy,
  TRUSTED_PROXIES,
  TRUST_PROXY_CONFIG,
};