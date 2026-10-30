'use strict';
// A signed refund/dispute event may precede the order, or arrive while a charge
// read is in flight. Include both durable event history and current charge data.
async function readPaymentState({ Events, paymentId, intent }) {
  if (intent.status !== 'succeeded' || !intent.latest_charge || typeof intent.latest_charge !== 'object' || intent.latest_charge.paid !== true) {
    throw new Error('Payment has not been verified for fulfillment.');
  }
  const events = await Events.find({ paymentId, type: { $in: ['charge.refunded', 'charge.dispute.created'] } }).lean();
  const charge = intent.latest_charge;
  const refundedAmount = Math.max(Number(charge.amount_refunded || 0) / 100, ...events.map(event => Number(event.amountRefunded) || 0));
  const fullyRefunded = charge.refunded === true || events.some(event => event.fullyRefunded === true) || refundedAmount >= intent.amount / 100;
  const disputed = charge.disputed === true || events.some(event => event.type === 'charge.dispute.created');
  return { paymentStatus: fullyRefunded ? 'refunded' : disputed ? 'disputed' : refundedAmount > 0 ? 'review_required' : 'succeeded', refundedAmount };
}
async function reconcileOrderPayment({ Orders, Events, orderId, paymentId, intent }) {
  const state = await readPaymentState({ Events, paymentId, intent });
  const filter = { _id: orderId, paymentId };
  if (state.paymentStatus !== 'refunded') filter.paymentStatus = { $nin: ['refunded', 'disputed', 'review_required'] };
  await Orders.updateOne(filter, { $set: { paymentStatus: state.paymentStatus }, $max: { refundedAmount: state.refundedAmount } });
  return state.paymentStatus;
}
module.exports = { readPaymentState, reconcileOrderPayment };
