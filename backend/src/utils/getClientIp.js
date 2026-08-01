/**
 * getClientIp.js — extract the real client IP behind Cloudflare + nginx.
 *
 * Priority:
 * 1. CF-Connecting-IP (set by Cloudflare, spoof-resistant)
 * 2. Leftmost X-Forwarded-For entry (legacy / direct nginx path)
 * 3. Express req.ip
 * 4. TCP remote address
 *
 * Used by rate limiters and analytics so every visitor has their own bucket
 * even when traffic is proxied through Cloudflare.
 */

function getClientIp(req) {
  // Cloudflare passes the real client IP in this header and overwrites XFF[0].
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  return req.ip || req.connection?.remoteAddress || '';
}

module.exports = { getClientIp };
