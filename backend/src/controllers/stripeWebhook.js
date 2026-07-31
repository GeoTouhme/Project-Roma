const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Orders = require('../models/Order');
const Notifications = require('../models/Notification');
const { emitToAdmins } = require('../utils/socketManager');

/**
 * Verify Stripe webhook signature and construct the event.
 * The raw body buffer is preserved by the body-parser verify hook in index.js.
 */
function constructEvent(req) {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  if (!endpointSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  if (!signature) {
    throw new Error('Missing stripe-signature header');
  }

  return stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
}

async function handleStripeWebhook(req, res) {
  let event;

  try {
    event = constructEvent(req);
  } catch (err) {
    // 🛡️ PRODUCTION: Always return 200 to Stripe to prevent retry storms,
    // even when the signature is invalid. Stripe retries 400s aggressively,
    // so an attacker could spam the endpoint and exhaust the rate-limit bucket.
    // We log the failure locally instead.
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(200).json({ received: true });
  }

  // Always acknowledge receipt quickly to prevent Stripe retries.
  res.status(200).json({ received: true });

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await Orders.findOneAndUpdate(
          { paymentId: paymentIntent.id },
          { $set: { paymentStatus: 'succeeded', status: 'pending' } },
          { new: true }
        );
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const order = await Orders.findOneAndUpdate(
          { paymentId: paymentIntent.id },
          { $set: { paymentStatus: 'failed', status: 'payment_failed' } },
          { new: true }
        );

        if (order) {
          const paymentFailedNotification = await Notifications.create({
            opened: false,
            title: `Payment failed for order #${order.orderNo}`,
            paymentMethod: order.paymentMethod,
            orderId: order._id,
            city: order.user?.city || '',
          });
          emitToAdmins('notification:new', paymentFailedNotification);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        const refundAmount = charge.amount_refunded / 100;

        if (paymentIntentId) {
          await Orders.findOneAndUpdate(
            { paymentId: paymentIntentId },
            { $set: { paymentStatus: 'refunded', status: 'cancelled' }, $inc: { refundedAmount: refundAmount } },
            { new: true }
          );
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object;
        const order = await Orders.findOneAndUpdate(
          { paymentId: dispute.payment_intent },
          { $set: { paymentStatus: 'disputed', status: 'disputed' } },
          { new: true }
        );

        if (order) {
          const disputeNotification = await Notifications.create({
            opened: false,
            title: `Dispute opened for order #${order.orderNo}`,
            paymentMethod: order.paymentMethod,
            orderId: order._id,
            city: order.user?.city || '',
          });
          emitToAdmins('notification:new', disputeNotification);
        }
        break;
      }

      default:
        // Unhandled event type — safe to ignore.
        break;
    }
  } catch (handlerError) {
    // Log but do not return an error response; Stripe already received 200.
    console.error('Stripe webhook handler error:', handlerError.message);
  }
}

module.exports = { handleStripeWebhook };
