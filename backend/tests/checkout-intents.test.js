'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
const OWNER = 'a'.repeat(24), PID = 'b'.repeat(24);
function fixture({ category = 'ready-to-drink-seltzers' } = {}) {
  const calls = [], writes = [];
  const realPolicy = require('../src/utils/checkoutPolicy');
  const totals = { expectedAmountCents: 1000, orderTotal: 10, fulfillmentType: 'delivery', sanitizedTip: 0, products: [{ _id: PID, category: { slug: category } }], updatedItems: [{ pid: PID, quantity: 1, price: 10 }] };
  const mocks = {
    stripe: function () { return { paymentIntents: { async create(options, request) { calls.push({ options, request }); return { id: 'pi_fixture', client_secret: 'synthetic_fixture' }; } } }; },
    '../models/Checkout': { async updateOne(filter, change) { writes.push({ filter, change: structuredClone(change) }); } },
    '../models/settings': { async findOneOrCreate() { return { timezone: 'UTC', operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: true, open: '06:00', close: '02:00' })) }; } },
    '../utils/orderCalculator': { async calculateOrderTotals() { return totals; } },
    '../utils/checkoutPolicy': { ...realPolicy, validateCheckout: options => realPolicy.validateCheckout({ ...options, date: new Date('2026-10-29T12:00:00Z') }) },
  };
  const filename = path.resolve(__dirname, '../src/controllers/payment-intents.js'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); const real = mod.require.bind(mod);
  mod.require = key => Object.hasOwn(mocks,key) ? mocks[key] : real(key); mod._compile(fs.readFileSync(filename,'utf8'),filename);
  const body = { items: [{ pid: PID, quantity: 1 }], user: { firstName: 'Test', lastName: 'Recipient', phone: '0000000000', address: '1 Test Street', city: 'Newport Beach', zip: '92663', state: 'CA', country: 'US' }, fulfillmentType: 'delivery', ageAcknowledged: true, termsAccepted: true, policyVersions: require('../src/config/policyVersions.json'), idempotencyKey: 'stable-fixture-key' };
  const run = async (input = body) => { const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } }; await mod.exports.payment_intents({ body: input, user: { _id: OWNER, email: 'fixture@example.test' } },res); return res; };
  return { run, body, calls, writes };
}
test('age, tobacco, unknown category and destination failures occur before any Stripe intent is created', async () => {
  for (const category of ['tobacco-nicotine', 'unknown-category']) {
    const f = fixture({ category }), res = await f.run(); assert.equal(res.statusCode,400); assert.equal(f.calls.length,0); assert.equal(f.writes.length,0);
  }
  for (const change of [{ ageAcknowledged: false }, { ageAcknowledged: 'true' }, { user: { zip: '99999' } }]) {
    const f = fixture(), res = await f.run({ ...f.body, ...change }); assert.equal(res.statusCode,400); assert.equal(f.calls.length,0);
  }
  const f = fixture(), res = await f.run({ ...f.body, user: { ...f.body.user, zip: '99999' } });
  assert.equal(res.statusCode,400); assert.equal(f.calls.length,0);
});
test('intent uses authoritative amount and durable snapshots; recipient changes cannot reuse the same payment binding', async () => {
  const f = fixture();
  const first = await f.run({ ...f.body, total: 0.01, containsAlcohol: false });
  assert.equal(first.statusCode,200); assert.equal(f.calls[0].options.amount,1000);
  assert.equal(f.calls[0].options.metadata.checkoutVersion,'2');
  assert.equal(f.writes[0].change.$setOnInsert.version,2);
  assert.equal(f.writes[0].change.$setOnInsert.requestSnapshot.user.address,f.body.user.address);
  assert.equal(f.writes[0].change.$setOnInsert.requestSnapshot.ageAcknowledged,true);
  assert.equal(f.writes[0].change.$setOnInsert.totalsSnapshot.products,undefined);
  const repeat = await f.run(); assert.equal(repeat.body.checkoutId,first.body.checkoutId);
  const moved = await f.run({ ...f.body, user: { ...f.body.user, address: '2 Test Street' } });
  assert.notEqual(moved.body.checkoutId,first.body.checkoutId);
  assert.notEqual(f.calls[2].request.idempotencyKey,f.calls[0].request.idempotencyKey);
});
test('accidental live key configuration returns 503 before creating a payment', async () => {
  const prior = process.env.STRIPE_SECRET_KEY;
  try {
    process.env.STRIPE_SECRET_KEY='sk_live_fixture';
    const f=fixture(), res=await f.run(); assert.equal(res.statusCode,503); assert.equal(f.calls.length,0); assert.equal(f.writes.length,0);
  } finally { process.env.STRIPE_SECRET_KEY=prior; }
});
