const Orders = require('../models/Order');
const Notifications = require('../models/Notification');

const handleDoorDashWebhook = async (req, res) => {
  try {
    const {
      external_delivery_id,
      delivery_status,
      tracking_url,
      pickup_time_estimated,
      pickup_time_actual,
      dropoff_time_estimated,
      dropoff_time_actual,
    } = req.body;

    console.log(`📬 DoorDash Webhook: Order ${external_delivery_id} → ${delivery_status}`);

    // Find the order by orderNo (which is the external_delivery_id we sent)
    const order = await Orders.findOne({ orderNo: external_delivery_id });

    if (!order) {
      console.warn(`⚠️ DoorDash webhook received for unknown order: ${external_delivery_id}`);
      // Always return 200 to DoorDash — they retry on non-200
      return res.status(200).json({ received: true });
    }

    // Build update object
    const updateFields = {
      deliveryStatus: delivery_status,
    };

    if (tracking_url) updateFields.trackingUrl = tracking_url;
    if (dropoff_time_estimated) updateFields.estimatedDeliveryTime = dropoff_time_estimated;
    if (pickup_time_estimated) updateFields.estimatedPickupTime = pickup_time_estimated;

    // Map DoorDash status to internal order status
    switch (delivery_status) {
      case 'DASHER_CONFIRMED':
        // Dasher assigned — keep status as 'pending'
        break;

      case 'DASHER_CONFIRMED_PICKUP_ARRIVAL':
        // Dasher arrived at the store
        break;

      case 'DASHER_PICKED_UP':
        updateFields.status = 'shipped';
        break;

      case 'DASHER_CONFIRMED_DROPOFF_ARRIVAL':
        // Dasher arrived at customer
        break;

      case 'DASHER_DROPPED_OFF':
        updateFields.status = 'delivered';
        break;

      case 'DELIVERY_CANCELLED':
        updateFields.status = 'delivery_failed';
        await Notifications.create({
          opened: false,
          title: `🚨 DELIVERY CANCELLED by DoorDash for Order ${external_delivery_id}`,
          paymentMethod: order.paymentMethod,
          orderId: order._id,
          city: order.user?.city || '',
          cover: '',
        });
        break;

      case 'DELIVERY_RETURN_INITIALIZED':
        // Return started (e.g., customer failed ID check)
        break;

      case 'DASHER_CONFIRMED_RETURN_ARRIVAL':
        // Dasher returning to store
        break;

      case 'DELIVERY_RETURNED':
        updateFields.status = 'returned';
        await Notifications.create({
          opened: false,
          title: `📦 Order ${external_delivery_id} RETURNED to store (ID verification failed)`,
          paymentMethod: order.paymentMethod,
          orderId: order._id,
          city: order.user?.city || '',
          cover: '',
        });
        break;

      default:
        console.log(`📬 Unhandled DoorDash status: ${delivery_status}`);
    }

    await Orders.findByIdAndUpdate(order._id, { $set: updateFields });

    // Always return 200 — DoorDash retries on non-200
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ DoorDash Webhook Error:', error.message);
    // Still return 200 to prevent DoorDash from retrying indefinitely
    return res.status(200).json({ received: true });
  }
};

module.exports = { handleDoorDashWebhook };
