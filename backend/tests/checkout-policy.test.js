'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { restrictionOf, restrictionsFor } = require('../src/utils/restrictedGoods');
const { paymentMode, validateDestination, withinHours, validateCheckout, validateHandoff } = require('../src/utils/checkoutPolicy');
const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: true, open: '06:00', close: '02:00' }));
const date = new Date('2026-10-29T19:00:00Z');
const settings = { timezone: 'America/Los_Angeles', operatingHours: hours };
const user = { address: '1 Test Street', city: 'Test', zip: '92663', state: 'CA', country: 'US' };
const wine = { category: { slug: 'wine' } }, rtd = { category: { slug: 'ready-to-drink-seltzers' } };
const policy = { version: 'fixture-v1', deliveryZips: ['92663'], allowedFulfillment: ['pickup', 'delivery'], alcoholEnabled: true, tobaccoEnabled: false };
function checkout(overrides = {}) { return validateCheckout({ products: [wine], user, fulfillmentType: 'delivery', ageAcknowledged: true, settings, date, mode: 'test', policy, ...overrides }); }

test('RTD, mixed bundles and explicit product restrictions are classified conservatively', () => {
  assert.equal(restrictionOf(rtd), 'alcohol');
  assert.equal(restrictionOf({ category: { slug: 'tobacco-nicotine' } }), 'tobacco');
  assert.equal(restrictionOf({ restrictionType: 'none', category: { restrictionType: 'alcohol' } }), 'alcohol');
  assert.equal(restrictionOf({ restrictionType: 'alcohol', category: { restrictionType: 'none' } }), 'alcohol');
  assert.equal(restrictionOf({ category: { slug: 'unknown' } }), 'unclassified');
  assert.equal(restrictionOf({ restrictionType: 'unclassified', category: { slug: 'water' } }), 'unclassified');
  assert.equal(restrictionOf({ restrictionType: 'unclassified', category: { slug: 'wine' } }), 'unclassified');
  assert.deepEqual(restrictionsFor([wine, rtd, { category: { slug: 'water' } }]), { containsAlcohol: true, containsTobacco: false, hasUnclassifiedGoods: false });
});
test('backend delivery allowlist cannot be replaced with client state, country or malformed data', () => {
  validateDestination(user, 'delivery', policy);
  for (const bad of [{ ...user, zip: '99999' }, { ...user, zip: { $ne: null } }, { ...user, state: 'NV' }, { ...user, country: 'CA' }, { ...user, address: '' }]) assert.throws(() => validateDestination(bad, 'delivery', policy));
  assert.throws(() => validateDestination(user, 'unknown', policy));
  validateDestination({}, 'pickup', policy);
});
test('store and restricted hours enforce overnight windows and exact closing boundary', () => {
  assert.equal(withinHours(hours, settings.timezone, date), true);
  assert.equal(withinHours(hours, settings.timezone, new Date('2026-10-29T08:59:00Z')), true);
  assert.equal(withinHours(hours, settings.timezone, new Date('2026-10-29T09:00:00Z')), false);
  assert.equal(withinHours(hours, settings.timezone, new Date('2026-10-29T12:59:00Z')), false);
  assert.equal(withinHours(hours.slice(1), settings.timezone, date), false);
  assert.equal(withinHours(hours, 'Invalid/Zone', date), false);
  assert.equal(withinHours(hours.map(h => ({ ...h, close: '06:00' })), settings.timezone, date), false);
});
test('age acknowledgement is required by backend and is recorded as acknowledgement, not verified identity', () => {
  for (const ageAcknowledged of [undefined, false, 'true', 1]) assert.throws(() => checkout({ ageAcknowledged }), /21/);
  const result = checkout({ products: [rtd] });
  assert.equal(result.containsAlcohol, true);
  assert.equal(result.ageAcknowledgedAt, date);
  assert.equal(result.policyVersion, policy.version);
  assert.throws(() => checkout({ settings: {} }), /closed/);
});
test('unclassified goods, unapproved tobacco and missing live policy fail closed', () => {
  assert.throws(() => checkout({ products: [{ category: { slug: 'tobacco-nicotine' } }] }), /Tobacco/);
  assert.throws(() => checkout({ products: [{ category: { slug: 'unknown' } }] }), /review/);
  assert.throws(() => checkout({ mode: 'live' }), /Review/);
  assert.throws(() => checkout({ mode: 'live', products: [{category:{restrictionType:'alcohol'}}] }), /approval/);
  assert.equal(checkout({ mode: 'live', products: [{category:{restrictionType:'alcohol'}}], policy: { ...policy, approvedBy: 'management', approvedAt: '2026-10-29', handoffProcedureApproved: true, restrictedHours: hours, timezone: settings.timezone } }).containsAlcohol, true);
});
test('live key swap alone cannot enable live charges and webhook setup is mandatory', () => {
  assert.equal(paymentMode({ STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'fixture' }), 'test');
  assert.throws(() => paymentMode({ STRIPE_SECRET_KEY: 'sk_live_fixture', STRIPE_WEBHOOK_SECRET: 'fixture' }));
  assert.throws(() => paymentMode({ STRIPE_SECRET_KEY: 'sk_live_fixture', PAYMENT_MODE: 'live', STRIPE_WEBHOOK_SECRET: 'fixture' }), /approval/);
  assert.throws(() => paymentMode({ STRIPE_SECRET_KEY: 'sk_test_fixture' }), /recovery/);
});
test('restricted handoff needs all checks, staff identity, approved procedure and allowed time; stores no ID numbers', () => {
  const approved = { ...policy, restrictedHours: hours, timezone: settings.timezone, handoffProcedureApproved: true };
  const verification = { photoIdChecked: true, age21Confirmed: true, recipientPresent: true, recipientEligible: true, idNumber: 'must-not-store' };
  const order = { containsAlcohol: true };
  assert.throws(() => validateHandoff(order, verification, 'staff', policy, date));
  for (const field of ['photoIdChecked', 'age21Confirmed', 'recipientPresent', 'recipientEligible']) assert.throws(() => validateHandoff(order, { ...verification, [field]: false }, 'staff', approved, date));
  const saved = validateHandoff(order, verification, 'staff', approved, date);
  assert.equal(saved.checkedBy, 'staff'); assert.equal(saved.idNumber, undefined);
  assert.equal(saved.checkedAt, date);
  assert.throws(() => validateHandoff(order, verification, 'staff', approved, new Date('2026-10-29T09:00:00Z')));
});
