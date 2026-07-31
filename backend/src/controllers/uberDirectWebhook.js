const crypto = require('crypto');
const Orders = require('../models/Order');
const Notifications = require('../models/Notification');
const { emitToAdmins } = require('../utils/socketManager');

function verifyUberSignature(req) {
  const signingKey = process.env.UBER_DIRECT_WEBHOOK_SECRET;
  if (!signingKey) {
    console.error('⚠️ UBER_DIRECT_WEBHOOK_SECRET not configured');
    return false;
  }
  const signature = req.headers['x-uber-signature'];
  if (!signature) return false;

  const expectedSig = crypto
    .createHmac('sha256', signingKey)
    .update(req.rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

const handleUberDirectWebhook = async (req, res) => {
  try {
    if (!verifyUberSignature(req)) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const {
      delivery_id,
      status,
      data = {},
    } = req.body;

    // Uber webhook payload nests delivery details under `data`
    const {
      tracking_url,
      pickup_time_estimated,
      dropoff_time_estimated,
      courier_imminent,
      undeliverable_action,
      undeliverable_reason,
      cancelation_reason,
    } = data;

    if (!delivery_id) {
      console.warn('⚠️ Uber Direct webhook missing delivery_id');
      return res.status(200).json({ received: true });
    }

    // Return jobs use `ret_` prefix; strip it to match the original order's deliveryId
    const searchDeliveryId = delivery_id.startsWith('ret_')
      ? delivery_id.replace(/^ret_/, '')
      : delivery_id;

    console.log(`📬 Uber Direct Webhook: Delivery ${delivery_id} (search: ${searchDeliveryId}) → ${status}${courier_imminent ? ' (courier imminent)' : ''}`);

    // Find the order by deliveryId (the ID Uber assigned and we stored on creation)
    const order = await Orders.findOne({ deliveryId: searchDeliveryId });

    if (!order) {
      console.warn(`⚠️ Uber Direct webhook received for unknown delivery: ${searchDeliveryId}`);
      // Always return 200 to Uber — they retry on non-200
      return res.status(200).json({ received: true });
    }

    // Build update object
    const updateFields = {
      deliveryStatus: status,
    };

    if (tracking_url) updateFields.trackingUrl = tracking_url;
    if (dropoff_time_estimated) updateFields.estimatedDeliveryTime = dropoff_time_estimated;
    if (pickup_time_estimated) updateFields.estimatedPickupTime = pickup_time_estimated;

    // Map Uber Direct status to internal order status
    switch (status) {
      case 'pending':
        // No status change yet
        break;

      case 'pickup':
        // courier_imminent true means ~1 min from store — still "pending" on our side
        if (courier_imminent) {
          console.log(`📬 Uber Direct: Courier is imminent for Order ${order.orderNo}`);
        }
        break;

      case 'pickup_complete':
        updateFields.status = 'shipped';
        break;

      case 'dropoff':
        // courier_imminent true means ~1 min from customer — already "shipped"
        if (courier_imminent) {
          console.log(`📬 Uber Direct: Courier is near dropoff for Order ${order.orderNo}`);
        }
        updateFields.status = 'shipped';
        break;

      case 'delivered':
        updateFields.status = 'delivered';
        break;

      case 'canceled':
        updateFields.status = 'delivery_failed';
        console.error(`🚨 Uber Direct CANCEL: ${cancelation_reason || 'No reason provided'}`);
        const uberCancelledNotification = await Notifications.create({
          opened: false,
          title: `🚨 DELIVERY CANCELLED by Uber Direct for Order ${order.orderNo}${cancelation_reason ? ` (${cancelation_reason})` : ''}`,
          paymentMethod: order.paymentMethod,
          orderId: order._id,
          city: order.user?.city || '',
          cover: '',
        });
        emitToAdmins('notification:new', uberCancelledNotification);
        break;

      case 'returned':
        updateFields.status = 'returned';
        console.error(`📦 Uber Direct RETURN: ${undeliverable_reason || 'No reason provided'}`);
        const uberReturnedNotification = await Notifications.create({
          opened: false,
          title: `📦 Order ${order.orderNo} RETURNED to store (${undeliverable_reason || 'ID verification failed'})`,
          paymentMethod: order.paymentMethod,
          orderId: order._id,
          city: order.user?.city || '',
          cover: '',
        });
        emitToAdmins('notification:new', uberReturnedNotification);
        break;

      case 'shopping_completed':
        // Courier Pick & Pack only — no action needed for standard Direct
        console.log(`📬 Uber Direct: Shopping completed for Order ${order.orderNo}`);
        break;

      default:
        console.log(`📬 Unhandled Uber Direct status: ${status}`);
    }

    await Orders.findByIdAndUpdate(order._id, { $set: updateFields });

    // Always return 200 — Uber retries on non-200
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Uber Direct Webhook Error:', error.message);
    // Still return 200 to prevent Uber from retrying indefinitely
    return res.status(200).json({ received: true });
  }
};

module.exports = { handleUberDirectWebhook };
