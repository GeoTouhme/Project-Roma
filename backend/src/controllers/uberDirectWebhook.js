const crypto = require('crypto');
const Orders = require('../models/Order');
const Notifications = require('../models/Notification');

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
      external_id,
      status,
      tracking_url,
      pickup_time_estimated,
      dropoff_time_estimated,
    } = req.body;

    const orderNo = external_id || delivery_id;

    console.log(`📬 Uber Direct Webhook: Order ${orderNo} → ${status}`);

    // Find the order by orderNo (which is the external_id we sent during creation)
    const order = await Orders.findOne({ orderNo });

    if (!order) {
      console.warn(`⚠️ Uber Direct webhook received for unknown order: ${orderNo}`);
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
      case 'pickup_ready':
      case 'en_route_to_pickup':
      case 'pickup':
        // No status change yet
        break;

      case 'pickup_complete':
      case 'en_route_to_dropoff':
      case 'dropoff':
        updateFields.status = 'shipped';
        break;

      case 'delivered':
        updateFields.status = 'delivered';
        break;

      case 'canceled':
        updateFields.status = 'delivery_failed';
        await Notifications.create({
          opened: false,
          title: `🚨 DELIVERY CANCELLED by Uber Direct for Order ${orderNo}`,
          paymentMethod: order.paymentMethod,
          orderId: order._id,
          city: order.user?.city || '',
          cover: '',
        });
        break;

      case 'returned':
        updateFields.status = 'returned';
        await Notifications.create({
          opened: false,
          title: `📦 Order ${orderNo} RETURNED to store (ID verification failed)`,
          paymentMethod: order.paymentMethod,
          orderId: order._id,
          city: order.user?.city || '',
          cover: '',
        });
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
