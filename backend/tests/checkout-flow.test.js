'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
process.env.NODE_ENV = 'test';
const OWNER = 'a'.repeat(24), PID = 'b'.repeat(24), ORDER = 'd'.repeat(24), CID = 'c'.repeat(64);
function query(value) { return { select() { return this; }, populate() { return this; }, then(a,b) { return Promise.resolve(value).then(a,b); } }; }
function fixture({ available = true, notificationFailure = false, productType = 'alcohol', acknowledged = true } = {}) {
  const product = { _id: PID, name: 'Server item', category: { restrictionType: productType }, status: 'active', available: available ? 5 : 0 };
  const totals = { expectedAmountCents: 1000, orderTotal: 10, grandTotal: 10, discount: 0, tax: 0, markupTotal: 0, sanitizedTip: 0, deliveryFee: 0, fulfillmentType: 'pickup', taxRate: 0, markupRate: 0,
    updatedItems: [{ pid: PID, name: 'Original price', quantity: 1, price: 10, priceSale: 10, total: 10 }], containsAlcohol: true };
  const requestSnapshot = { paymentMethod: 'Stripe', user: { firstName: 'Test', lastName: 'Recipient', phone: '0000000000' }, items: totals.updatedItems, fulfillmentType: 'pickup', ageAcknowledged: acknowledged, totalItems: 1 };
  const bindingSnapshot = { user: requestSnapshot.user, policyVersion: 'fixture', ageAcknowledged: acknowledged };
  const { checkoutHash } = require('../src/utils/checkoutBinding');
  const checkout = { _id: CID, owner: OWNER, version: 2, paymentId: 'pi_fixture', requestSnapshot, totalsSnapshot: totals, bindingSnapshot,
    cartHash: checkoutHash(totals, 'usd', bindingSnapshot), amount: 1000, currency: 'usd', recoveryState: 'payment_pending' };
  let saved, stockWrites = 0, recalculations = 0;
  const settings = { timezone: 'UTC', operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: true, open: '06:00', close: '02:00' })) };
  const realPolicy = require('../src/utils/checkoutPolicy');
  const mocks = {
    '../models/Checkout': { findOne: () => query(checkout), async exists() { return true; }, async findOneAndUpdate(filter, change) {
      if (checkout.claimedAt) return null; Object.assign(checkout, change.$set); return checkout;
    }, async updateOne(filter, change) { Object.assign(checkout, change.$set); for (const key of Object.keys(change.$unset || {})) delete checkout[key]; } },
    '../models/Product': { find: () => query([product]), async findOneAndUpdate() { if (!available) return null; stockWrites++; return product; }, async findByIdAndUpdate() { stockWrites--; } },
    '../models/StripeEvent': { find: () => ({ lean: async () => [] }) },
    '../models/Order': { async updateOne(filter, change) { Object.assign(saved, change.$set); }, async findOne() { return saved; }, async create(data) { await new (require('../src/models/Order'))(data).validate(); saved = { _id: ORDER, ...data }; return saved; } },
    '../models/User': { async findByIdAndUpdate() {} }, '../models/Notification': { async create() { if (notificationFailure) throw new Error('unavailable'); return [{ _id: PID }]; } },
    '../models/settings': { async findOneOrCreate() { return settings; } },
    '../utils/checkoutPolicy': { ...realPolicy, validateCheckout: options => realPolicy.validateCheckout({ ...options, date: new Date('2026-10-29T12:00:00Z') }) },
    '../utils/orderCalculator': { async calculateOrderTotals() { recalculations++; throw new Error('Must use saved price'); } },
    '../utils/mailer': async () => {}, '../utils/socketManager': { emitToAdmins() {} }, fs: { readFileSync: () => '<p>{{recipientName}}</p>' },
    stripe: () => ({ paymentIntents: { async retrieve() { return { status: 'succeeded', latest_charge: { paid: true, refunded: false, amount_refunded: 0, disputed: false }, amount: 1000, currency: 'usd', metadata: { ownerId: OWNER, checkoutId: CID, checkoutVersion: '2', cartHash: checkout.cartHash } }; } } }),
  };
  const filename = path.resolve(__dirname, '../src/controllers/order.js'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod); mod.require = key => Object.hasOwn(mocks,key) ? mocks[key] : real(key);
  mod._compile('const console={log(){},warn(){},error(){}};\n'+fs.readFileSync(filename,'utf8'),filename);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  return { checkout, response, controller: mod.exports, saved: () => saved, counts: () => ({ stockWrites, recalculations }) };
}
test('actual order controller uses immutable recipient/prices and ignores client replacement after payment', async () => {
  const f = fixture(), res = f.response();
  await f.controller.createOrder({ user: { _id: OWNER, email: 'fixture@example.test' }, body: { checkoutId: CID, user: { firstName: 'Attacker' }, items: [], paymentId: 'pi_foreign', ageAcknowledged: false } }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(f.saved().user.firstName, 'Test'); assert.equal(f.saved().total, 10);
  assert.equal(f.saved().containsAlcohol, true); assert.ok(f.saved().ageAcknowledgedAt);
  assert.equal(f.saved().paymentEnvironment, 'test'); assert.equal(f.checkout.recoveryState, 'completed');
  assert.deepEqual(f.counts(), { stockWrites: 1, recalculations: 0 });
});
test('out of stock after payment creates no order and releases only the failed completion claim', async () => {
  const f = fixture({ available: false }), res = f.response();
  await f.controller.createOrder({ user: { _id: OWNER, email: 'fixture@example.test' }, body: { checkoutId: CID } }, res);
  assert.equal(res.statusCode, 400); assert.equal(f.saved(), undefined);
  assert.equal(f.checkout.claimedAt, undefined); assert.equal(f.counts().stockWrites, 0);
});
test('stored acknowledgement is required and current tobacco restrictions are rechecked before stock writes', async () => {
  for (const opts of [{ acknowledged: false }, { productType: 'tobacco' }, { productType: 'unclassified' }]) {
    const f = fixture(opts), res = f.response();
    await f.controller.createOrder({ user: { _id: OWNER, email: 'fixture@example.test' }, body: { checkoutId: CID, ageAcknowledged: true } }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(res.body)); assert.equal(f.saved(), undefined); assert.equal(f.counts().stockWrites, 0);
  }
});
test('notification failure after persistence cannot turn a paid order into a failed response', async () => {
  const f = fixture({ notificationFailure: true }), res = f.response();
  await f.controller.createOrder({ user: { _id: OWNER, email: 'fixture@example.test' }, body: { checkoutId: CID } }, res);
  assert.equal(res.statusCode, 201); assert.equal(res.body.orderId, ORDER); assert.equal(f.counts().stockWrites, 1);
});
