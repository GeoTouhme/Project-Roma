'use strict';
const moment = require('moment-timezone');
const { restrictionsFor, hasExplicitClassification } = require('./restrictedGoods');

const VERSION = 'p0-2026-10-29';
const DELIVERY_ZIPS = ['92663', '92646', '92612', '92647', '92661', '92707', '92648'];
function policyError(message, status = 400) { return Object.assign(new Error(message), { status, code: 'CHECKOUT_POLICY' }); }
function paymentMode(env = process.env) {
  const keyMode = /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY || '') ? 'test'
    : /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '') ? 'live' : 'unknown';
  const mode = env.PAYMENT_MODE || 'test';
  if (!['test', 'live'].includes(mode) || mode !== keyMode) throw policyError('Payment configuration is unavailable.', 503);
  if (mode === 'live' && env.LIVE_CHECKOUT_APPROVED !== 'true') throw policyError('Live checkout is awaiting approval.', 503);
  if (!env.STRIPE_WEBHOOK_SECRET) throw policyError('Payment recovery is not configured.', 503);
  return mode;
}
function readPolicy(env = process.env) {
  let policy = {};
  if (env.CHECKOUT_POLICY_JSON) {
    try { policy = JSON.parse(env.CHECKOUT_POLICY_JSON); } catch { throw policyError('Checkout policy configuration is invalid.', 503); }
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw policyError('Checkout policy configuration is invalid.', 503);
  }
  return { version: VERSION, deliveryZips: DELIVERY_ZIPS, alcoholEnabled: true, tobaccoEnabled: false,
    allowedFulfillment: ['pickup', 'delivery'], ...policy };
}
function validateDestination(user, fulfillmentType, policy = readPolicy()) {
  if (!['pickup', 'delivery'].includes(fulfillmentType)) throw policyError('Invalid fulfillment type.');
  if (!Array.isArray(policy.allowedFulfillment) || !policy.allowedFulfillment.includes(fulfillmentType)) throw policyError('This fulfillment method is unavailable.');
  if (fulfillmentType === 'pickup') return;
  const zip = typeof user?.zip === 'string' ? user.zip.trim() : '';
  if (!Array.isArray(policy.deliveryZips) || !policy.deliveryZips.includes(zip)) throw policyError('We do not deliver to this ZIP code.');
  if (user?.state !== 'CA' || user?.country !== 'US') throw policyError('Delivery is limited to the approved California service area.');
  for (const field of ['address', 'city']) if (typeof user?.[field] !== 'string' || !user[field].trim() || user[field].length > 200) throw policyError('A valid delivery address is required.');
}
function withinHours(hours, timezone, date = new Date()) {
  if (!moment.tz.zone(timezone) || !Array.isArray(hours) || hours.length !== 7) return false;
  const days = new Set();
  for (const h of hours) {
    if (!h || typeof h !== 'object' || !Number.isInteger(h.dayOfWeek) || h.dayOfWeek < 0 || h.dayOfWeek > 6 || days.has(h.dayOfWeek)
      || typeof h.isOpen !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close)
      || (h.isOpen && h.open === h.close)) return false;
    days.add(h.dayOfWeek);
  }
  const now = moment(date).tz(timezone), day = now.day(), time = now.format('HH:mm');
  const today = hours.find(h => h.dayOfWeek === day), yesterday = hours.find(h => h.dayOfWeek === (day + 6) % 7);
  return Boolean((today?.isOpen && (today.open < today.close ? time >= today.open && time < today.close : time >= today.open))
    || (yesterday?.isOpen && yesterday.close < yesterday.open && time < yesterday.close));
}
function validateCheckout({ products, user, fulfillmentType = 'delivery', ageAcknowledged, settings, date = new Date(), mode, policy = readPolicy() }) {
  validateDestination(user, fulfillmentType, policy);
  if (!withinHours(settings?.operatingHours, settings?.timezone, date)) throw policyError('The store is closed for ordering.');
  const goods = restrictionsFor(products);
  if (mode === 'live' && products.some(product => !hasExplicitClassification(product))) throw policyError('Review explicit product or category restrictions before live checkout.', 503);
  if (goods.hasUnclassifiedGoods) throw policyError('An item needs a product restriction review before checkout.');
  if (goods.containsTobacco && policy.tobaccoEnabled !== true) throw policyError('Tobacco and nicotine online checkout is unavailable.');
  if (goods.containsAlcohol && policy.alcoholEnabled !== true) throw policyError('Alcohol online checkout is unavailable.');
  if (goods.containsAlcohol || goods.containsTobacco) {
    if (ageAcknowledged !== true) throw policyError('Confirm that you are 21 or older and will present valid photo ID at handoff.');
    // Self-attestation is not identity verification. Live operation needs explicit,
    // reviewed hours and a documented, approved staff verification procedure.
    if (mode === 'live' && (!policy.approvedBy || !policy.approvedAt || !policy.version
      || policy.handoffProcedureApproved !== true || !policy.restrictedHours || !policy.timezone)) {
      throw policyError('Restricted-goods checkout is awaiting management approval.', 503);
    }
    if (policy.restrictedHours && !withinHours(policy.restrictedHours, policy.timezone, date)) throw policyError('Restricted-goods ordering is closed.');
  }
  return { ...goods, policyVersion: policy.version, ageAcknowledgedAt: ageAcknowledged === true ? date : undefined };
}
function validateHandoff(order, verification, staffId, policy = readPolicy(), date = new Date()) {
  if (!order.containsAlcohol && !order.containsTobacco) return undefined;
  if (!verification || verification.photoIdChecked !== true || verification.age21Confirmed !== true
    || verification.recipientPresent !== true || verification.recipientEligible !== true || !staffId) {
    throw policyError('Record the photo ID, age, recipient presence and eligibility checks before completing this order.');
  }
  if (!policy.restrictedHours || !policy.timezone || policy.handoffProcedureApproved !== true
    || !withinHours(policy.restrictedHours, policy.timezone, date)) {
    throw policyError('Restricted-goods handoff needs an approved procedure and permitted handoff hours.', 503);
  }
  return { photoIdChecked: true, age21Confirmed: true, recipientPresent: true, recipientEligible: true,
    checkedBy: staffId, checkedAt: date, policyVersion: policy.version };
}
module.exports = { VERSION, DELIVERY_ZIPS, policyError, paymentMode, readPolicy, validateDestination, withinHours, validateCheckout, validateHandoff };
