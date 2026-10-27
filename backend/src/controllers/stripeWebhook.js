'use strict';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Orders = require('../models/Order');
const Events = require('../models/StripeEvent');

async function applyEvent(event) {
  if (!event.paymentId) return;
  const filter = { paymentId: event.paymentId };
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Payment confirmation must never move fulfillment backwards.
      await Orders.updateOne({ ...filter, paymentStatus: { $in: ['pending', 'failed'] } }, { $set: { paymentStatus: 'succeeded' } });
      break;
    case 'payment_intent.payment_failed':
      await Orders.updateOne({ ...filter, paymentStatus: 'pending' }, { $set: { paymentStatus: 'failed' } });
      break;
    case 'charge.refunded':
      // amount_refunded is cumulative. $max is replay-safe and order-independent.
      await Orders.updateOne(filter, { $max: { refundedAmount: event.amountRefunded },
        ...(event.fullyRefunded ? { $set: { paymentStatus: 'refunded' } } : {}) });
      break;
    case 'charge.dispute.created':
      await Orders.updateOne({ ...filter, paymentStatus: { $ne: 'refunded' } }, { $set: { paymentStatus: 'disputed' } });
      break;
  }
}

async function handleStripeWebhook(req, res) {
  let event;
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('Missing configuration');
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ received: false });
  }
  try {
    const object = event.data.object;
    const summary = {
      type: event.type,
      paymentId: event.type.startsWith('payment_intent.') ? object.id : (typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id),
      amountRefunded: Math.max(0, Number(object.amount_refunded) || 0) / 100,
      fullyRefunded: object.refunded === true,
    };
    // _id's unique constraint is present even before additional indexes are built.
    try { await Events.updateOne({ _id: event.id }, { $setOnInsert: summary }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
    const saved = await Events.findById(event.id);
    if (!saved.processedAt) {
      // Mutations are themselves idempotent: retries after a crash/concurrent delivery are safe.
      await applyEvent(saved);
      await Events.updateOne({ _id: event.id }, { $set: { processedAt: new Date() } });
    }
    return res.status(200).json({ received: true });
  } catch {
    // Stripe retains responsibility for retries until persistence and processing succeed.
    return res.status(503).json({ received: false });
  }
}
module.exports = { handleStripeWebhook, applyEvent };
