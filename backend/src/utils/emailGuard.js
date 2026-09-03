/**
 * 🛡️ emailGuard.js — Disposable/throwaway email defense
 *
 * Blocks registration and email-change flows from using disposable/temporary
 * inbox providers (Mailinator, Guerrilla Mail, 10MinuteMail, Temp-Mail, YOPmail,
 * Sharklasers, robustq.com, etc.). This platform is an age-restricted alcohol
 * delivery service: throwaway inboxes are the primary vehicle for fake accounts,
 * OTP-flow abuse, per-user coupon fraud, and ban evasion.
 *
 * Domain blocklist: the community-maintained
 * disposable-email-domains/disposable-email-domains list (~8,700 entries),
 * loaded once at startup from src/data/disposable-domains.txt.
 * Refresh the file periodically to pick up new providers.
 *
 * Also validates basic email format and rejects "+tag" local parts on
 * self-service flows (gmail aliases allow one real inbox to spawn unlimited
 * "unique" accounts).
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

function loadDisposableDomains() {
  const filePath = path.join(__dirname, '..', 'data', 'disposable-domains.txt');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const domains = new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line && !line.startsWith('#'))
    );
    return domains;
  } catch (err) {
    console.error('❌ Failed to load disposable-domains.txt:', err.message);
    // Fail closed for the blocklist is dangerous (blocks ALL signups on a
    // missing file); instead fail open here but keep format/MX/alias checks.
    return new Set();
  }
}

const DISPOSABLE_SET = loadDisposableDomains();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailDomain(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function isDisposableEmail(email) {
  const domain = emailDomain(email);
  if (!domain) return true;
  if (DISPOSABLE_SET.has(domain)) return true;
  // Suffix match: subdomains of disposable providers
  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join('.');
    if (DISPOSABLE_SET.has(candidate)) return true;
  }
  return false;
}

function isValidEmailFormat(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

/**
 * Gmail-style "+tag" aliases let one real inbox register unlimited "unique"
 * accounts (per-user coupon limits, review abuse). Rejected on self-service
 * flows where the user types the address manually.
 */
function hasPlusAlias(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  return email.slice(0, at).includes('+');
}

/**
 * Confirm the email's domain actually has MX records so the verification
 * email is deliverable. Definitive "no MX" → reject. DNS resolution errors
 * (timeouts, resolver hiccups) are treated leniently to avoid blocking all
 * signups during a transient DNS outage — the domain blocklist above is the
 * hard gate, this is a quality check.
 */
async function domainCanReceiveMail(email) {
  const domain = emailDomain(email);
  if (!domain) return { ok: false, reason: 'invalid' };
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { ok: false, reason: 'no-mx' };
    }
    return { ok: true };
  } catch (err) {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'ENODATA')) {
      return { ok: false, reason: 'no-mx' };
    }
    // Timeout / resolver error — don't block signup on infra flakiness.
    return { ok: true };
  }
}

/**
 * Full self-service acceptance check. Throws Error with a user-safe message
 * when the email is unacceptable.
 */
async function assertAcceptableEmail(email, { allowPlusAlias = false } = {}) {
  if (!isValidEmailFormat(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (isDisposableEmail(email)) {
    throw new Error('Disposable email addresses are not allowed. Please use a permanent email address.');
  }
  if (!allowPlusAlias && hasPlusAlias(email)) {
    throw new Error('Email aliases with "+" are not allowed. Please use your primary email address.');
  }
  const mx = await domainCanReceiveMail(email);
  if (!mx.ok) {
    throw new Error('This email domain cannot receive mail. Please check the address or use a different email.');
  }
}

module.exports = {
  isDisposableEmail,
  isValidEmailFormat,
  hasPlusAlias,
  assertAcceptableEmail,
  DISPOSABLE_DOMAIN_COUNT: DISPOSABLE_SET.size,
};