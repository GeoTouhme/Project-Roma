# DoorDash Production Readiness — Step-by-Step Fix Plan

> **Purpose**: This document provides step-by-step instructions for an AI coding agent to implement all missing features required to pass DoorDash's production review. Each step includes the exact files, line numbers, and copy-paste-ready code.

---

## Project Context

- **Project**: Project-Roma (Bal-Port Liquors e-commerce)
- **Stack**: React (`customer-panel/`), Node.js/Express (`backend/`), MongoDB, Stripe, DoorDash Drive v2
- **Store**: 4521 W Coast Hwy, Newport Beach, CA 92663
- **Express entry**: `backend/src/index.js` — routes registered at `/api` prefix
- **Route pattern**: Each route file is in `backend/src/routes/`, controllers in `backend/src/controllers/`

---

## Step 1: Add `estimatedDeliveryTime` to Order Model

DoorDash returns `dropoff_time_estimated` when a delivery is created. This must be stored and displayed.

### File: `backend/src/models/Order.js`

Add two new fields after `deliveryError` (after line 57):

```javascript
    deliveryError: {
      type: String,
    },
    // ADD THESE TWO FIELDS:
    estimatedPickupTime: {
      type: String,
    },
    estimatedDeliveryTime: {
      type: String,
    },
```

---

## Step 2: Store Estimated Delivery Time from DoorDash Response

### File: `backend/src/controllers/order.js`

In the `createOrder` function, after line 272, add the estimated times to the order update. Replace lines 268–274:

```javascript
      await Orders.findByIdAndUpdate(orderCreated._id, {
        $set: { 
          deliveryId: deliveryResponse.support_reference || deliveryResponse.delivery_id || deliveryResponse.id,
          trackingUrl: trackingUrl,
          deliveryStatus: deliveryResponse.delivery_status || 'created',
          estimatedPickupTime: deliveryResponse.pickup_time_estimated || null,
          estimatedDeliveryTime: deliveryResponse.dropoff_time_estimated || null,
        }
      });
```

---

## Step 3: Add `cancelDelivery` and `getDeliveryStatus` to DoorDash Service

DoorDash requires you can cancel deliveries and retrieve status on-demand.

### File: `backend/src/services/doorDashService.js`

Add these two methods inside the `DoorDashService` class, **before** the closing `}` on line 135:

```javascript
  async cancelDelivery(externalDeliveryId) {
    try {
      const token = this.generateToken();

      const response = await axios.put(
        `${this.baseUrl}/${externalDeliveryId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('DoorDash Cancel Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async getDeliveryStatus(externalDeliveryId) {
    try {
      const token = this.generateToken();

      const response = await axios.get(
        `${this.baseUrl}/${externalDeliveryId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('DoorDash Status Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
```

---

## Step 4: Add Admin Cancel Delivery Endpoint

### File: `backend/src/controllers/order.js`

Add this function **before** the `module.exports` block (before line 592):

```javascript
const cancelDelivery = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Orders.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Cancel DoorDash delivery if order has been dispatched
    if (order.orderNo && order.deliveryStatus && order.deliveryStatus !== 'DELIVERY_CANCELLED' && order.deliveryStatus !== 'DASHER_DROPPED_OFF') {
      try {
        await doorDashService.cancelDelivery(order.orderNo);
      } catch (ddError) {
        console.error('DoorDash cancel failed:', ddError.response ? ddError.response.data : ddError.message);
        // Continue — update local status even if DoorDash cancel fails
      }
    }

    await Orders.findByIdAndUpdate(id, {
      $set: {
        status: 'cancelled',
        deliveryStatus: 'DELIVERY_CANCELLED',
      }
    });

    return res.status(200).json({ success: true, message: 'Delivery cancelled' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

Add `cancelDelivery` to the `module.exports`:

```javascript
module.exports = {
  createOrder,
  getDeliveryQuote,
  getOrderById,
  getOrdersByAdmin,
  getOneOrderByAdmin,
  updateOrderByAdmin,
  deleteOrderByAdmin,
  cancelDelivery,    // ADD THIS
};
```

### File: `backend/src/routes/order.js`

Add the cancel route after line 18 (after the `deleteOrderByAdmin` route):

```javascript
router.put('/admin/orders/:id/cancel', verifyToken, adminCheck, orderRoutes.cancelDelivery);
```

---

## Step 5: Add Admin Refresh Delivery Status Endpoint

Allows the admin to manually poll DoorDash for the latest delivery status (fallback if webhook missed).

### File: `backend/src/controllers/order.js`

Add this function **before** the `module.exports` block:

```javascript
const refreshDeliveryStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Orders.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.orderNo) {
      return res.status(400).json({ success: false, message: 'No delivery associated with this order' });
    }

    const delivery = await doorDashService.getDeliveryStatus(order.orderNo);

    const updateFields = {
      deliveryStatus: delivery.delivery_status,
    };

    if (delivery.tracking_url) updateFields.trackingUrl = delivery.tracking_url;
    if (delivery.dropoff_time_estimated) updateFields.estimatedDeliveryTime = delivery.dropoff_time_estimated;
    if (delivery.pickup_time_estimated) updateFields.estimatedPickupTime = delivery.pickup_time_estimated;

    // Map DoorDash status to internal order status
    if (delivery.delivery_status === 'DASHER_PICKED_UP') updateFields.status = 'shipped';
    if (delivery.delivery_status === 'DASHER_DROPPED_OFF') updateFields.status = 'delivered';
    if (delivery.delivery_status === 'DELIVERY_CANCELLED') updateFields.status = 'delivery_failed';
    if (delivery.delivery_status === 'DELIVERY_RETURNED') updateFields.status = 'returned';

    await Orders.findByIdAndUpdate(id, { $set: updateFields });

    return res.status(200).json({
      success: true,
      message: 'Delivery status refreshed',
      data: delivery,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

Add `refreshDeliveryStatus` to `module.exports`:

```javascript
module.exports = {
  createOrder,
  getDeliveryQuote,
  getOrderById,
  getOrdersByAdmin,
  getOneOrderByAdmin,
  updateOrderByAdmin,
  deleteOrderByAdmin,
  cancelDelivery,
  refreshDeliveryStatus,    // ADD THIS
};
```

### File: `backend/src/routes/order.js`

Add the route:

```javascript
router.get('/admin/orders/:id/delivery-status', verifyToken, adminCheck, orderRoutes.refreshDeliveryStatus);
```

---

## Step 6: Create DoorDash Webhook Endpoint

This is the **most critical** piece. DoorDash pushes delivery status updates here.

### Create new file: `backend/src/controllers/doorDashWebhook.js`

```javascript
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
```

### Create new file: `backend/src/routes/doorDashWebhook.js`

```javascript
const express = require('express');
const router = express.Router();
const { handleDoorDashWebhook } = require('../controllers/doorDashWebhook');

// DoorDash sends webhooks — no JWT auth middleware
// Authentication is configured in DoorDash Developer Portal (Basic Auth)
router.post('/webhooks/doordash', handleDoorDashWebhook);

module.exports = router;
```

### File: `backend/src/index.js`

Register the webhook route. Add **after** line 110 (after `const uploadRoutes = ...`):

```javascript
const doorDashWebhookRoutes = require('./routes/doorDashWebhook');
```

Add **after** line 131 (after `app.use('/api', uploadRoutes);`):

```javascript
app.use('/api', doorDashWebhookRoutes);
```

### CORS Note

The webhook comes from DoorDash servers (not your frontend), so the `origin` will be different. Your CORS handler already allows requests with no `Origin` header (`!origin` check on line 39), and server-to-server requests typically don't send an `Origin` header, so this should work. If DoorDash sends an `Origin` header, you may need to add their domain to `ALLOWED_ORIGINS`.

---

## Step 7: Display Estimated Delivery Time on Order Page

DoorDash will check that customers can see the estimated delivery time.

### File: `customer-panel/src/pages/order/index.jsx`

**Step 7a**: Extract `estimatedDeliveryTime` from the order object. Update the destructuring on lines 36–50:

```javascript
    const {
        orderNo,
        items,
        subTotal,
        total,
        shipping,
        discount,
        paymentMethod,
        status,
        createdAt,
        user,
        deliveryId,
        trackingUrl,
        deliveryStatus,
        estimatedDeliveryTime,  // ADD THIS
    } = order;
```

**Step 7b**: Display the estimated time inside the tracking panel. Add this block **after** the Support ID `div` (after line 141), before the closing `</div>` on line 142:

```jsx
                                {estimatedDeliveryTime && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 uppercase font-semibold">ETA:</span>
                                        <span className="text-gray-800 font-semibold">
                                            {new Date(estimatedDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
```

---

## Step 8: Clean Up Sandbox References & PII Logging

DoorDash reviewers will check your codebase for production readiness.

### File: `backend/src/controllers/order.js`

**8a**: Line 256 — change the sandbox comment:

```javascript
// CHANGE FROM:
    // --- DoorDash Integration (Sandbox) ---

// CHANGE TO:
    // --- DoorDash Delivery Dispatch ---
```

**8b**: Line 264 — remove the full response dump (contains customer PII):

```javascript
// CHANGE FROM:
      console.log('✅ DoorDash Full Response:', JSON.stringify(deliveryResponse, null, 2));

// CHANGE TO:
      console.log('✅ DoorDash Delivery created:', deliveryResponse.delivery_id || deliveryResponse.id);
```

### File: `backend/src/services/doorDashService.js`

**8c**: Line 88 — remove full payload dump (contains customer address, phone):

```javascript
// CHANGE FROM:
      console.log('📦 Sending Fully-Compliant Payload:', JSON.stringify(payload, null, 2));

// CHANGE TO:
      console.log('📦 Creating DoorDash delivery for order:', payload.external_delivery_id);
```

**8d**: Line 121 — remove full quote payload dump:

```javascript
// CHANGE FROM:
      console.log('📦 Sending Fully-Validated Quote Payload:', JSON.stringify(payload, null, 2));

// CHANGE TO:
      console.log('📦 Requesting DoorDash delivery quote for:', payload.dropoff_address);
```

---

## Step 9: Configure DoorDash Developer Portal

This is a manual step (not code). After deploying the webhook endpoint:

1. Go to **[DoorDash Developer Portal](https://developer.doordash.com/)**
2. Navigate to **Webhooks** section
3. Click **+** for the **Production** environment
4. Enter your webhook URL: `https://yourdomain.com/api/webhooks/doordash`
5. Select **Basic Auth** and set credentials
6. Test the webhook endpoint using the Delivery Simulator

> **Note**: Each environment (Sandbox/Production) supports only ONE webhook endpoint.

---

## Step 10: Request Production Access

After all code is deployed and tested:

1. Go to DoorDash Developer Portal → **Request Production Access**
2. DoorDash will schedule a **live demo** where they verify:
   - API logs show correct payloads
   - Customer UI displays: tracking URL, delivery status, support ID, estimated ETA
   - Alcohol orders include ID verification flags
   - Admin can cancel deliveries
   - Webhook receives and processes status updates
3. Once approved, swap your sandbox credentials for production ones in your `.env`

---

## Final File Change Summary

| File | Action | Changes |
|------|--------|---------|
| `backend/src/models/Order.js` | EDIT | Add `estimatedPickupTime` and `estimatedDeliveryTime` fields |
| `backend/src/services/doorDashService.js` | EDIT | Add `cancelDelivery()` and `getDeliveryStatus()` methods, clean PII logs |
| `backend/src/controllers/order.js` | EDIT | Store ETA fields, add `cancelDelivery` + `refreshDeliveryStatus` functions, clean sandbox refs + PII logs |
| `backend/src/routes/order.js` | EDIT | Add cancel + refresh-status admin routes |
| `backend/src/controllers/doorDashWebhook.js` | **CREATE** | Webhook handler for all DoorDash delivery status events |
| `backend/src/routes/doorDashWebhook.js` | **CREATE** | Webhook route (`POST /api/webhooks/doordash`) |
| `backend/src/index.js` | EDIT | Register webhook route |
| `customer-panel/src/pages/order/index.jsx` | EDIT | Display estimated delivery time in tracking panel |

---

## Validation Checklist

After implementing all steps, verify the following:

- [ ] Webhook endpoint (`POST /api/webhooks/doordash`) is accessible and returns 200
- [ ] Send a test webhook payload with `delivery_status: "DASHER_PICKED_UP"` — order status should update to `shipped`
- [ ] Send a test webhook with `delivery_status: "DASHER_DROPPED_OFF"` — order status should update to `delivered`
- [ ] Send a test webhook with `delivery_status: "DELIVERY_CANCELLED"` — admin notification created
- [ ] Send a test webhook with `delivery_status: "DELIVERY_RETURNED"` — order status should update to `returned`
- [ ] Admin cancel endpoint (`PUT /api/admin/orders/:id/cancel`) successfully calls DoorDash cancel API
- [ ] Admin refresh status endpoint (`GET /api/admin/orders/:id/delivery-status`) returns latest delivery data
- [ ] Order confirmation page shows estimated delivery time (ETA)
- [ ] No `console.log` statements dump full customer PII (address, phone) in logs
- [ ] No "Sandbox" references in code comments
- [ ] DoorDash Developer Portal webhook is configured and receiving events
- [ ] All existing features (order creation, tracking URL, alcohol compliance) still work
