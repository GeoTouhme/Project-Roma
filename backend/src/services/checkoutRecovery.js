'use strict';
const crypto = require('node:crypto');
const Checkouts = require('../models/Checkout');
const Orders = require('../models/Order');
const Users = require('../models/User');
const Events = require('../models/StripeEvent');
const { readPaymentState, reconcileOrderPayment } = require('../utils/paymentReconciliation');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const validId = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
async function recoverCheckout({ checkoutId, paymentId, ownerId }) {
  if ((!validId(checkoutId) && !(typeof paymentId === 'string' && /^pi_[a-zA-Z0-9]+$/.test(paymentId))) || !ownerId) {
    throw Object.assign(new Error('Invalid checkout recovery request.'), { status: 400 });
  }
  const checkout = await Checkouts.findOne({ ...(validId(checkoutId) ? { _id: checkoutId } : { paymentId }), owner: ownerId, version: 2 });
  if (!checkout) throw Object.assign(new Error('Checkout not found.'), { status: 404 });
  await Checkouts.updateOne({ _id: checkout._id }, { $set: { recoveryCheckedAt: new Date() } });
  const existing = checkout.paymentId && await Orders.findOne({ paymentId: checkout.paymentId });
  if (existing) {
    if (String(existing.user?._id) !== String(ownerId)) throw new Error('Checkout ownership mismatch.');
    if (existing.paymentStatus === 'pending') {
      const settled = await stripe.paymentIntents.retrieve(checkout.paymentId, { expand: ['latest_charge'] });
      await reconcileOrderPayment({ Orders, Events, orderId: existing._id, paymentId: checkout.paymentId, intent: settled });
    }
    await Checkouts.updateOne({ _id: checkout._id }, { $set: { orderId: existing._id, recoveryState: 'completed' } });
    return { state: 'completed', orderId: existing._id, orderNo: existing.orderNo };
  }
  if (checkout.recoveryState === 'cancelled') return { state: 'cancelled', message: 'The unpaid payment attempt was cancelled.' };
  if (checkout.recoveryState === 'refunded') return { state: 'refunded', message: 'Payment refunded because the order could not be completed.' };
  if (checkout.recoveryState === 'manual_review') return { state: 'manual_review', message: 'The store is reviewing this payment. Do not pay again.' };
  if (!checkout.paymentId) return { state: 'payment_pending', message: 'Waiting for payment initialization.' };
  const intent = await stripe.paymentIntents.retrieve(checkout.paymentId, { expand: ['latest_charge'] });
  if (intent.metadata?.checkoutId !== String(checkout._id) || intent.metadata?.ownerId !== String(ownerId)
    || intent.metadata?.cartHash !== checkout.cartHash || intent.metadata?.checkoutVersion !== '2'
    || intent.amount !== checkout.amount || intent.currency !== checkout.currency) throw new Error('Payment binding mismatch.');
  if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status)) return { state: 'payment_incomplete', message: 'Payment was not completed. Cancel this unpaid attempt before starting another payment.' };
  if (intent.status === 'canceled') {
    await Checkouts.updateOne({ _id: checkout._id }, { $set: { recoveryState: 'cancelled' } });
    return { state: 'cancelled', message: 'The unpaid payment attempt was cancelled.' };
  }
  if (intent.status !== 'succeeded') return { state: 'payment_pending', message: 'Payment has not completed. Do not submit another payment while it is processing.' };

  if (checkout.recoveryState !== 'refund_pending') {
    const paymentState = await readPaymentState({ Events, paymentId: checkout.paymentId, intent });
    if (paymentState.paymentStatus === 'refunded') {
      await Checkouts.updateOne({ _id: checkout._id, claimedAt: { $exists: false } }, { $set: { recoveryState: 'refunded' } });
      return { state: 'refunded', message: 'This payment has already been refunded. No order was created.' };
    }
    if (paymentState.paymentStatus !== 'succeeded') {
      await Checkouts.updateOne({ _id: checkout._id, claimedAt: { $exists: false } }, { $set: { recoveryState: 'manual_review', recoveryError: 'A partial refund or dispute needs review before fulfillment.' } });
      return { state: 'manual_review', message: 'The store needs to review this payment. Do not pay again.' };
    }
    if (checkout.claimedAt) {
      // A crashed stock/order operation is ambiguous: never refund or release its
      // claim automatically while another writer could still commit an order.
      if (Date.now() - new Date(checkout.claimedAt).getTime() > 5 * 60 * 1000) {
        await Checkouts.updateOne({ _id: checkout._id, orderId: { $exists: false }, claimedAt: checkout.claimedAt }, {
          $set: { recoveryState: 'manual_review', recoveryError: 'Interrupted order operation; reconcile inventory and payment before retrying.' },
        });
        return { state: 'manual_review', message: 'The store is reviewing this payment. Do not pay again.' };
      }
      return { state: 'payment_pending', message: 'Your order is being completed. Do not pay again.' };
    }
    const user = await Users.findById(ownerId);
    if (!user) {
      await Checkouts.updateOne({ _id: checkout._id }, { $set: { recoveryState: 'manual_review', recoveryError: 'Checkout owner is unavailable.' } });
      return { state: 'manual_review', message: 'The store is reviewing this payment. Do not pay again.' };
    }
    let result;
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { result = { code: this.statusCode, ...body }; return this; } };
    // The order controller reads its immutable server-side snapshot. Neither the
    // redirect nor the caller supplies prices, contact details, or age evidence.
    await require('../controllers/order').createOrder({ body: { checkoutId: String(checkout._id) }, user: { _id: user._id, email: user.email }, realIp: '' }, response);
    if (result?.success) return { state: 'completed', orderId: result.orderId, orderNo: result.orderNo };
    if (!result || result.code >= 500) throw new Error('Order completion is temporarily unavailable.');
    const saved = await Orders.findOne({ paymentId: checkout.paymentId });
    if (saved) return { state: 'completed', orderId: saved._id, orderNo: saved.orderNo };
    if (result.code === 409) return { state: 'payment_pending', message: 'Your order is being completed. Do not pay again.' };
    // Claim refund responsibility atomically using the same claim field as order
    // creation. A competing completion that has reserved stock wins instead.
    const claimed = await Checkouts.findOneAndUpdate({ _id: checkout._id, claimedAt: { $exists: false }, orderId: { $exists: false }, recoveryState: 'payment_pending' }, {
      $set: { claimedAt: new Date(), claimToken: `refund:${crypto.randomUUID()}`, recoveryState: 'refund_pending', recoveryError: 'Order eligibility or inventory could not be confirmed after payment.' },
    }, { new: true });
    if (!claimed) return { state: 'payment_pending', message: 'Checkout reconciliation is in progress. Do not pay again.' };
  }
  // Retry is safe after an API timeout or a crash between refund and DB update.
  let refund;
  if (checkout.refundId) refund = await stripe.refunds.retrieve(checkout.refundId);
  else {
    // The metadata lookup also protects retries after Stripe's idempotency-key
    // retention window, if a previous refund succeeded but its DB write failed.
    const prior = await stripe.refunds.list({ payment_intent: checkout.paymentId, limit: 100 });
    refund = prior.data.find(item => item.metadata?.checkoutId === String(checkout._id));
    if (!refund) refund = await stripe.refunds.create({ payment_intent: checkout.paymentId, metadata: { checkoutId: String(checkout._id) } }, { idempotencyKey: `roma-checkout-refund-${checkout._id}` });
  }
  const state = refund.status === 'succeeded' ? 'refunded' : ['failed', 'canceled'].includes(refund.status) ? 'manual_review' : 'refund_pending';
  await Checkouts.updateOne({ _id: checkout._id, recoveryState: 'refund_pending' }, { $set: { recoveryState: state, refundId: refund.id } });
  return { state, message: state === 'refunded' ? 'Payment refunded because the order could not be completed.'
    : state === 'manual_review' ? 'The store needs to review the refund. Do not pay again.' : 'A refund was requested and is pending. Do not pay again.' };
}
async function cancelUnpaidCheckout({ checkoutId, ownerId }) {
  if (!validId(checkoutId) || !ownerId) throw Object.assign(new Error('Invalid checkout.'), { status: 400 });
  const checkout = await Checkouts.findOne({ _id: checkoutId, owner: ownerId, version: 2 });
  if (!checkout) throw Object.assign(new Error('Checkout not found.'), { status: 404 });
  if (checkout.recoveryState === 'cancelled') return { state: 'cancelled' };
  if (!checkout.paymentId) throw Object.assign(new Error('Payment initialization is pending. Retry shortly.'), { status: 409 });
  const intent = await stripe.paymentIntents.retrieve(checkout.paymentId, { expand: ['latest_charge'] });
  if (intent.metadata?.checkoutId !== checkoutId || intent.metadata?.ownerId !== String(ownerId)) throw new Error('Payment binding mismatch.');
  if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'canceled'].includes(intent.status)) {
    if (intent.status !== 'canceled') {
      try { await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `roma-abandon-${checkoutId}` }); }
      catch { return recoverCheckout({ checkoutId, ownerId }); }
    }
    await Checkouts.updateOne({ _id: checkoutId, orderId: { $exists: false } }, { $set: { recoveryState: 'cancelled' } });
    return { state: 'cancelled' };
  }
  return recoverCheckout({ checkoutId, ownerId });
}
module.exports = { recoverCheckout, cancelUnpaidCheckout };
