'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const OWNER = 'a'.repeat(24), FOREIGN = 'b'.repeat(24), ID = 'c'.repeat(64), ORDER = 'd'.repeat(24);
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod); mod.require = key => Object.hasOwn(mocks, key) ? mocks[key] : real(key);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename); return mod.exports;
}
function fixture(options = {}) {
  const checkout = { _id: ID, owner: OWNER, version: 2, paymentId: 'pi_fixture', amount: 1000, currency: 'usd', cartHash: 'hash', recoveryState: 'payment_pending', ...options.checkout };
  let order = options.order, completionCalls = 0, refunds = 0, cancelCalls = 0, creates = 0, failAfterRefund = options.failAfterRefund;
  const intent = { id: 'pi_fixture', status: 'succeeded', latest_charge: { paid: true, refunded: false, amount_refunded: 0, disputed: false }, amount: 1000, currency: 'usd', metadata: { checkoutVersion: '2', checkoutId: ID, ownerId: OWNER, cartHash: 'hash' }, ...options.intent };
  const refund = { id: 're_fixture', status: options.refundStatus || 'succeeded', metadata: { checkoutId: ID } };
  let prior = options.priorRefund ? [refund] : [];
  function matches(filter) {
    if (filter.owner && String(filter.owner) !== checkout.owner) return false;
    if (filter._id && filter._id !== checkout._id) return false;
    if (filter.version && filter.version !== checkout.version) return false;
    if (typeof filter.recoveryState === 'string' && filter.recoveryState !== checkout.recoveryState) return false;
    for (const field of ['claimedAt', 'orderId']) {
      if (filter[field]?.$exists === false && checkout[field] !== undefined) return false;
    }
    return true;
  }
  const checkouts = {
    async findOne(filter) { return matches(filter) ? structuredClone(checkout) : null; },
    async updateOne(filter, change) {
      if (!matches(filter)) return { matchedCount: 0 };
      if (change.$set?.refundId && failAfterRefund) { failAfterRefund = false; throw new Error('database write timed out'); }
      Object.assign(checkout, change.$set); return { matchedCount: 1 };
    },
    async findOneAndUpdate(filter, change) { if (!matches(filter)) return null; Object.assign(checkout, change.$set); return structuredClone(checkout); },
  };
  const service = load('services/checkoutRecovery.js', {
    '../models/Checkout': checkouts,
    '../models/StripeEvent': { find: () => ({ lean: async () => options.events || [] }) },
    '../models/Order': { async findOne() { return order; } },
    '../models/User': { async findById() { return options.noUser ? null : { _id: OWNER, email: 'fixture@example.test' }; } },
    '../controllers/order': { async createOrder(req, res) {
      completionCalls++; assert.deepEqual(req.body, { checkoutId: ID }); assert.equal(String(req.user._id), OWNER);
      if (options.completionError) return res.status(options.completionError).json({ success: false });
      creates++; order = { _id: ORDER, orderNo: 'TEST', user: { _id: OWNER } };
      checkout.orderId = ORDER; checkout.recoveryState = 'completed';
      return res.status(201).json({ success: true, orderId: ORDER, orderNo: 'TEST' });
    } },
    stripe: () => ({ paymentIntents: { async retrieve() { return intent; }, async cancel(id, body, request) {
      cancelCalls++; assert.equal(request.idempotencyKey, `roma-abandon-${ID}`);
      if (options.cancelRace) { intent.status = 'succeeded'; throw new Error('already succeeded'); }
      intent.status = 'canceled'; return intent;
    } }, refunds: {
      async list() { return { data: prior }; }, async retrieve() { return refund; },
      async create(payload, request) { refunds++; assert.equal(payload.payment_intent, 'pi_fixture'); assert.equal(request.idempotencyKey, `roma-checkout-refund-${ID}`); prior = [refund]; return refund; },
    } }),
  });
  return { service, checkout, recover: () => service.recoverCheckout({ checkoutId: ID, ownerId: OWNER }), counts: () => ({ completionCalls, refunds, cancelCalls, creates }) };
}
test('a paid redirect is completed using only the stored checkout; repeated recovery does not create another order', async () => {
  const f = fixture();
  assert.equal((await f.recover()).state, 'completed');
  assert.equal((await f.recover()).orderId, ORDER);
  assert.deepEqual(f.counts(), { completionCalls: 1, refunds: 0, cancelCalls: 0, creates: 1 });
});
test('foreign owners cannot inspect or complete another customer checkout', async () => {
  const f = fixture();
  await assert.rejects(f.service.recoverCheckout({ checkoutId: ID, ownerId: FOREIGN }), /not found/);
  assert.equal(f.counts().completionCalls, 0);
});
test('amount, currency and metadata binding mismatches never create an order or refund', async () => {
  for (const intent of [{ amount: 999 }, { currency: 'eur' }, { metadata: { ownerId: FOREIGN } }]) {
    const f = fixture({ intent }); await assert.rejects(f.recover(), /binding/);
    assert.equal(f.counts().completionCalls, 0); assert.equal(f.counts().refunds, 0);
  }
});
test('async processing and unpaid attempts are not fulfilled or refunded', async () => {
  for (const status of ['processing', 'requires_payment_method', 'requires_action', 'requires_confirmation']) {
    const f = fixture({ intent: { status } });
    assert.equal((await f.recover()).state, status === 'processing' ? 'payment_pending' : 'payment_incomplete');
    assert.equal(f.counts().completionCalls, 0); assert.equal(f.counts().refunds, 0);
  }
});
test('post-payment stock/eligibility failure claims a full refund exactly once', async () => {
  const f = fixture({ completionError: 400 });
  assert.equal((await f.recover()).state, 'refunded');
  assert.equal((await f.recover()).state, 'refunded');
  assert.equal(f.counts().refunds, 1); assert.equal(f.checkout.refundId, 're_fixture');
});
test('refund is not duplicated after a DB failure following a successful refund', async () => {
  const f = fixture({ completionError: 400, failAfterRefund: true });
  await assert.rejects(f.recover(), /database/);
  assert.equal(f.checkout.recoveryState, 'refund_pending');
  assert.equal((await f.recover()).state, 'refunded');
  assert.equal(f.counts().refunds, 1);
});
test('existing tagged refund is reused even beyond an idempotency retention window', async () => {
  const f = fixture({ checkout: { recoveryState: 'refund_pending' }, priorRefund: true });
  assert.equal((await f.recover()).state, 'refunded'); assert.equal(f.counts().refunds, 0);
});
test('pending refund remains pending and failed refund enters manual review', async () => {
  const pending = fixture({ completionError: 400, refundStatus: 'pending' });
  assert.equal((await pending.recover()).state, 'refund_pending');
  assert.equal((await pending.recover()).state, 'refund_pending'); assert.equal(pending.counts().refunds, 1);
  const failed = fixture({ completionError: 400, refundStatus: 'failed' });
  assert.equal((await failed.recover()).state, 'manual_review');
});
test('in-flight inventory work is not refunded; stale claims enter durable manual review', async () => {
  const active = fixture({ checkout: { claimedAt: new Date() } });
  assert.equal((await active.recover()).state, 'payment_pending'); assert.equal(active.counts().refunds, 0);
  const stale = fixture({ checkout: { claimedAt: new Date(Date.now() - 600000) } });
  assert.equal((await stale.recover()).state, 'manual_review'); assert.equal(stale.checkout.recoveryState, 'manual_review');
  assert.equal(stale.counts().refunds, 0);
});
test('temporary completion failures remain retryable without issuing a refund', async () => {
  const f = fixture({ completionError: 503 }); await assert.rejects(f.recover(), /temporarily/);
  assert.equal(f.counts().refunds, 0); assert.equal(f.checkout.recoveryState, 'payment_pending');
});
test('unpaid cancellation is idempotent and a payment-success race recovers the order instead', async () => {
  const f = fixture({ intent: { status: 'requires_payment_method' } });
  assert.equal((await f.service.cancelUnpaidCheckout({ checkoutId: ID, ownerId: OWNER })).state, 'cancelled');
  assert.equal((await f.service.cancelUnpaidCheckout({ checkoutId: ID, ownerId: OWNER })).state, 'cancelled');
  assert.equal(f.counts().cancelCalls, 1);
  const race = fixture({ intent: { status: 'requires_action' }, cancelRace: true });
  assert.equal((await race.service.cancelUnpaidCheckout({ checkoutId: ID, ownerId: OWNER })).state, 'completed');
  assert.equal(race.counts().refunds, 0);
});

test('signed payment-success webhook retries recovery failures and marks processed only after durable recovery', async () => {
  let saved, attempts = 0;
  const controller = load('controllers/stripeWebhook.js', {
    stripe: () => ({ webhooks: { constructEvent() { return { id: 'evt_fixture', livemode: false, type: 'payment_intent.succeeded', data: { object: { id: 'pi_fixture', metadata: { checkoutVersion: '2', checkoutId: ID, ownerId: OWNER } } } }; } } }),
    '../models/Order': { async updateOne() {} },
    '../models/StripeEvent': { async updateOne(filter, change) { if (change.$setOnInsert && !saved) saved = { _id: filter._id, ...change.$setOnInsert }; if (change.$set) Object.assign(saved, change.$set); }, async findById() { return saved; } },
    '../models/Checkout': { async updateOne() {} },
    '../services/checkoutRecovery': { async recoverCheckout(input) { assert.equal(input.ownerId, OWNER); attempts++; if (attempts === 1) throw new Error('temporary outage'); return { state: 'completed', orderId: ORDER }; } },
  });
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  let res = response(); await controller.handleStripeWebhook({ headers: {}, rawBody: Buffer.from('{}') },res);
  assert.equal(res.statusCode,503); assert.equal(saved.processedAt,undefined);
  res=response(); await controller.handleStripeWebhook({ headers: {}, rawBody: Buffer.from('{}') },res);
  assert.equal(res.statusCode,200); assert.ok(saved.processedAt);
  res=response(); await controller.handleStripeWebhook({ headers: {}, rawBody: Buffer.from('{}') },res);
  assert.equal(attempts,2);
});


test('a correctly signed event for the wrong Stripe environment is rejected before persistence', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
  let writes = 0;
  const controller = load('controllers/stripeWebhook.js', {
    stripe: () => ({ webhooks: { constructEvent() { return { id: 'evt_wrong_mode', livemode: true, type: 'payment_intent.succeeded', data: { object: { id: 'pi_fixture' } } }; } } }),
    '../models/Order': {}, '../models/StripeEvent': { async updateOne() { writes++; } },
  });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  await controller.handleStripeWebhook({ headers: {} }, res);
  assert.equal(res.statusCode, 400); assert.equal(writes, 0);
});


test('a succeeded intent that was refunded or disputed never creates an orphan order', async () => {
  for (const charge of [{ paid: true, refunded: true, amount_refunded: 1000 }, { paid: true, amount_refunded: 500 }, { paid: true, disputed: true, amount_refunded: 0 }]) {
    const f = fixture({ intent: { latest_charge: charge } });
    assert.equal((await f.recover()).state, charge.refunded ? 'refunded' : 'manual_review');
    assert.equal(f.counts().creates, 0); assert.equal(f.counts().refunds, 0);
  }
});


test('durable pre-order refund events prevent later payment success from enabling fulfillment', async () => {
  const { reconcileOrderPayment } = require('../src/utils/paymentReconciliation');
  let change;
  const result = await reconcileOrderPayment({
    Orders: { async updateOne(filter, update) { change = { filter, update }; } },
    Events: { find() { return { async lean() { return [{ type: 'charge.refunded', amountRefunded: 10, fullyRefunded: true }]; } }; } },
    orderId: ORDER, paymentId: 'pi_fixture', intent: { status: 'succeeded', amount: 1000, latest_charge: { paid: true, refunded: false, amount_refunded: 0 } },
  });
  assert.equal(result, 'refunded'); assert.equal(change.update.$set.paymentStatus, 'refunded'); assert.equal(change.update.$max.refundedAmount, 10);
});


test('a refund event committed before orphan completion is honored even when a charge read is stale', async () => {
  const f = fixture({ events: [{ type: 'charge.refunded', amountRefunded: 10, fullyRefunded: true }] });
  assert.equal((await f.recover()).state, 'refunded'); assert.equal(f.counts().creates, 0); assert.equal(f.counts().refunds, 0);
});
