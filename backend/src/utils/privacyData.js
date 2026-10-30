'use strict';
const crypto = require('node:crypto');
function privateHash(value, purpose = 'security', day = new Date().toISOString().slice(0, 10)) {
  const key = process.env.PRIVACY_HASH_SECRET || process.env.JWT_SECRET;
  if (!key || typeof value !== 'string' || !value) return undefined;
  return crypto.createHmac('sha256', key).update(`${purpose}:${day}:${value}`).digest('hex');
}
function referrerOrigin(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.origin : ''; } catch { return ''; }
}
function deviceSummary(agent = '') {
  return { deviceType: /mobile|android|iphone/i.test(agent) ? 'mobile' : /ipad|tablet/i.test(agent) ? 'tablet' : 'desktop',
    browserFamily: /edg\//i.test(agent) ? 'Edge' : /firefox\//i.test(agent) ? 'Firefox' : /chrome\//i.test(agent) ? 'Chrome' : /safari\//i.test(agent) ? 'Safari' : 'Other' };
}
function safeEvent(name, extra = {}) {
  const event = { event: String(name).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80) };
  if (Number.isInteger(extra.status) && extra.status >= 100 && extra.status <= 599) event.status = extra.status;
  if (typeof extra.method === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(extra.method)) event.method = extra.method;
  console.log(JSON.stringify(event));
}
module.exports = { privateHash, referrerOrigin, deviceSummary, safeEvent };
