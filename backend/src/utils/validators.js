/**
 * 🛡️ validators.js — Shared input sanitization utilities
 *
 * These helpers enforce an Allow-list (whitelist) approach to input validation,
 * protecting every controller from NoSQL injection via object payloads.
 *
 * Root cause prevented: Express's default `qs` parser turns ?key[$ne]=x into
 * { key: { "$ne": "x" } }. These helpers ensure only plain strings reach DB queries.
 */

/**
 * Returns a trimmed string if the value is a non-empty, non-null plain string.
 * Returns null for anything else (objects, arrays, undefined, 'null' literal).
 *
 * @param {*} value
 * @returns {string|null}
 */
function safeString(value) {
  if (typeof value === 'string' && value.trim() !== '' && value !== 'null') {
    return value.trim();
  }
  return null;
}

/**
 * Returns the value if it is a valid 24-character MongoDB ObjectId hex string.
 * Returns null otherwise. Prevents object injection in findById / findOne calls.
 *
 * @param {*} value
 * @returns {string|null}
 */
function safeObjectId(value) {
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
    return value;
  }
  return null;
}

/**
 * Parses a number from a value, returning a fallback if the result is NaN.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function safeNumber(value, fallback) {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

module.exports = { safeString, safeObjectId, safeNumber };
