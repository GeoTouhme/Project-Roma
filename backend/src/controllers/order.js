const Notifications = require('../models/Notification');
const Products = require('../models/Product');
const Orders = require('../models/Order');
const Coupons = require('../models/CouponCode');
const User = require('../models/User');
const doorDashService = require('../services/doorDashService');
const uberDirectService = require('../services/uberDirectService');
const Settings = require('../models/settings');
const sendEmail = require('../utils/mailer');

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
function isExpired(expirationDate) {
  const currentDateTime = new Date();
  return currentDateTime >= new Date(expirationDate);
}
function generateOrderNumber() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let orderNumber = '';

  // Generate a random alphabet character
  orderNumber += alphabet.charAt(Math.floor(Math.random() * alphabet.length));

  // Generate 4 random digits
  for (let i = 0; i < 6; i++) {
    orderNumber += Math.floor(Math.random() * 10);
  }

  return orderNumber;
}
function readHTMLTemplate() {
  const htmlFilePath = path.join(
    process.cwd(),
    'src/email-templates',
    'order.html'
  );
  return fs.readFileSync(htmlFilePath, 'utf8');
}

async function getDeliveryService() {
  const settings = await Settings.findOneOrCreate();
  const provider = settings.deliveryProvider || 'doordash';
  return {
    service: provider === 'uberdirect' ? uberDirectService : doorDashService,
    provider,
  };
}

const createOrder = async (req, res) => {
  try {
    const {
      items,
      user,
      paymentMethod,
      paymentId,
      couponCode,
      totalItems,
      shipping,
      tip,
    } = await req.body;

    // Security: Only allow Stripe payments for now to prevent fraud
    if (paymentMethod !== 'Stripe') {
      return res.status(400).json({
        success: false,
        message: 'Currently, only Stripe payments are accepted for security reasons.'
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Please try again.'
      });
    }

    if (!items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: 'Please Provide Item(s)' });
    }

    // Issue 2: Idempotency - check if order with this paymentId already exists
    const existingOrder = await Orders.findOne({ paymentId });
    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message: 'Order already placed',
        orderId: existingOrder._id,
        orderNo: existingOrder.orderNo,
      });
    }

    const products = await Products.find({
      _id: { $in: items.map((item) => item.pid) },
    }).populate('category');

    const alcoholCategorySlugs = [
      'beer', 'brandy', 'gin', 'liqueur', 'rum', 'seltzers-and-more',
      'spirits', 'tequila', 'vodka', 'whiskey', 'wine',
      'brandy-and-cognac', 'spiked', 'hard-seltzer'
    ];

    let containsAlcohol = false;

    // Issue 3: Collect inventory update promises and await them
    const inventoryUpdates = [];

    const updatedItems = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.pid);

      if (product) {
        console.log(`🔍 Checking Product: ${product.name} | Category: ${product.category ? product.category.name : 'N/A'} | Slug: ${product.category ? product.category.slug : 'N/A'}`);
      }

      if (product && product.category && alcoholCategorySlugs.includes(product.category.slug)) {
        containsAlcohol = true;
      }

      const price = product ? product.priceSale : 0;
      const total = price * item.quantity;

      // Issue 3: Collect the promise instead of fire-and-forget
      inventoryUpdates.push(
        Products.findOneAndUpdate(
          { _id: item.pid, available: { $gte: item.quantity } },
          { $inc: { available: -item.quantity, sold: item.quantity } },
          { new: true, runValidators: true }
        ).exec().then(result => {
          if (!result) {
            throw new Error(`Insufficient stock for product: ${product?.name || item.pid}`);
          }
          return result;
        })
      );

      return {
        ...item,
        total,
        imageUrl: product.images.length > 0 ? product.images[0].url : '',
      };
    });

    // Issue 3: Await all inventory updates - fail the order if any product is out of stock
    try {
      await Promise.all(inventoryUpdates);
    } catch (stockError) {
      return res.status(400).json({
        success: false,
        message: stockError.message || 'One or more items are out of stock.'
      });
    }

    const grandTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);
    let discount = 0;

    if (couponCode) {
      const couponData = await Coupons.findOne({ code: couponCode });

      if (!couponData) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid Coupon Code' });
      }

      const expired = isExpired(couponData.expire);
      if (expired) {
        return res
          .status(400)
          .json({ success: false, message: 'CouponCode Is Expired' });
      }
      await Coupons.findOneAndUpdate(
        { code: couponCode },
        { $addToSet: { usedBy: user.email } }
      );

      if (couponData && couponData.type === 'percent') {
        const percentLess = couponData.discount;
        discount = (percentLess / 100) * grandTotal;
      } else if (couponData) {
        discount = couponData.discount;
      }
    }

    let discountedTotal = grandTotal - discount;
    discountedTotal = discountedTotal || 0;

    // Issue 5: Sanitize tip value
    const sanitizedTip = Math.max(0, Math.min(Number(tip) || 0, 100));

    // Issue 1: Verify Stripe payment amount matches server-calculated total
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const expectedAmountCents = Math.round((discountedTotal + Number(shipping) + sanitizedTip) * 100);

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
    } catch (stripeError) {
      // If we can't retrieve the payment intent (e.g., it's a payment method ID instead of payment intent ID),
      // the frontend may need updating. For now, allow order to proceed but log a warning.
      console.warn('⚠️ Could not retrieve Stripe payment intent. Payment verification skipped.', stripeError.message);
    }

    if (paymentIntent) {
      if (paymentIntent.amount !== expectedAmountCents) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount mismatch. Please try again.'
        });
      }
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Payment not confirmed. Please try again.'
        });
      }
    }

    const existingUser = await User.findOne({ email: user.email });
    const orderNo = await generateOrderNumber();

    const orderUser = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      city: user.city,
      state: user.state,
      country: user.country,
      zip: user.zip,
      ...(existingUser ? { _id: existingUser._id } : {})
    };

    // Issue 2: Wrap order creation in try-catch for duplicate key error
    let orderCreated;
    try {
      orderCreated = await Orders.create({
        paymentMethod,
        paymentId,
        discount,
        tip: sanitizedTip,
        total: discountedTotal + Number(shipping) + sanitizedTip,
        subTotal: grandTotal,
        shipping,
        items: updatedItems.map(({ image, ...others }) => others),
        user: orderUser,
        totalItems,
        orderNo,
        containsAlcohol,
        status: 'pending',
      });
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.paymentId) {
        const duplicateOrder = await Orders.findOne({ paymentId });
        return res.status(200).json({
          success: true,
          message: 'Order already placed',
          orderId: duplicateOrder._id,
          orderNo: duplicateOrder.orderNo,
        });
      }
      throw err;
    }

    // --- Delivery Dispatch ---
    let deliveryResponse = null;
    let deliveryError = null;
    let trackingUrl = null;
    let activeProvider = 'doordash';

    try {
      const { service, provider } = await getDeliveryService();
      activeProvider = provider;

      console.log(`🚀 Triggering ${provider} Delivery for Order:`, orderNo);
      deliveryResponse = await service.createDelivery(orderCreated);
      console.log(`✅ ${provider} Delivery created:`, deliveryResponse.delivery_id || deliveryResponse.id || deliveryResponse.external_id);

      trackingUrl = deliveryResponse.tracking_url;

      await Orders.findByIdAndUpdate(orderCreated._id, {
        $set: {
          deliveryProvider: provider,
          deliveryId: deliveryResponse.support_reference || deliveryResponse.delivery_id || deliveryResponse.id || deliveryResponse.external_id,
          trackingUrl: trackingUrl,
          deliveryStatus: deliveryResponse.delivery_status || deliveryResponse.status || 'created',
          estimatedPickupTime: deliveryResponse.pickup_time_estimated || null,
          estimatedDeliveryTime: deliveryResponse.dropoff_time_estimated || null,
        }
      });
    } catch (ddError) {
      deliveryError = ddError.response ? ddError.response.data : ddError.message;
      console.error(`❌ ${activeProvider} Delivery Failed Post-Payment:`, deliveryError);

      // Update order status to alert admin that delivery dispatch failed
      await Orders.findByIdAndUpdate(orderCreated._id, {
        $set: {
          status: 'delivery_failed',
          deliveryProvider: activeProvider,
          deliveryError: JSON.stringify(deliveryError)
        }
      });

      // Create a critical notification for the admin
      await Notifications.create({
        opened: false,
        title: `🚨 DELIVERY FAILED for Order ${orderNo}`,
        paymentMethod,
        orderId: orderCreated._id,
        city: user.city,
        cover: '', // Optional
      });
    }
    // --------------------------------------

    await Notifications.create({
      opened: false,
      title: `${user.firstName} ${user.lastName} placed an order from ${user.city}.`,
      paymentMethod,
      orderId: orderCreated._id,
      city: user.city,
      cover: user?.cover?.url || '',
    });

    // Send order confirmation email (non-blocking)
    try {
      let htmlContent = readHTMLTemplate();

      htmlContent = htmlContent.replace(
        /{{recipientName}}/g,
        `${user.firstName} ${user.lastName}`
      );

      let itemsHtml = '';
      updatedItems.forEach((item) => {
        itemsHtml += `
          <tr style='border-bottom: 1px solid #e4e4e4;'>
            <td style="border-radius: 8px; box-shadow: 0 0 5px rgba(0, 0, 0, 0.1); overflow: hidden; border-spacing: 0; border: 0">
              <img src="${item.imageUrl}" alt="${item.name}" style="width: 62px; height: 62px; object-fit: cover; border-radius: 8px;">
            </td>
            <td style=" padding: 10px; border-spacing: 0; border: 0">${item.name}</td>         
            <td style=" padding: 10px; border-spacing: 0; border: 0">${item.sku}</td>
            <td style=" padding: 10px; border-spacing: 0; border: 0">${item.quantity}</td>
            <td style=" padding: 10px; border-spacing: 0; border: 0">${item.priceSale}</td>
          </tr>
        `;
      });

      htmlContent = htmlContent.replace(/{{items}}/g, itemsHtml);
      htmlContent = htmlContent.replace(/{{grandTotal}}/g, orderCreated.total); // Total includes shipping
      htmlContent = htmlContent.replace(/{{Shipping}}/g, orderCreated.shipping > 0 ? `$${orderCreated.shipping}` : 'Free');
      htmlContent = htmlContent.replace(/{{subTotal}}/g, orderCreated.subTotal);

      // ADD TRACKING INFO IF AVAILABLE
      let trackingHtml = '';
      if (trackingUrl) {
        trackingHtml = `
          <tr>
            <td style="border-spacing: 0; border: 0; color: #B5223B;">Track Delivery :</td>
            <td style="border-spacing: 0; border: 0;"><a href="${trackingUrl}" style="color: #B5223B; font-weight: bold; text-decoration: underline;">Click Here to Track</a></td>
          </tr>
          <tr><td colspan="2"><hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;"></td></tr>
        `;
      }
      htmlContent = htmlContent.replace(/{{trackingInfo}}/g, trackingHtml);

      // Send email via OAuth2 utility
      await sendEmail({
        to: user.email,
        subject: `Your Balport Order #${orderNo} Confirmation`,
        html: htmlContent
      });
      console.log(`✅ Order confirmation email sent to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send order confirmation email:', emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Order Placed',
      orderId: orderCreated._id,
      data: items.name,
      orderNo,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getOrderById = async (req, res) => {
  try {
    const id = req.params.id;
    const orderGet = await Orders.findById(id); // Remove curly braces around _id: id

    if (!orderGet) {
      return res
        .status(404)
        .json({ success: false, message: 'Order Not Found' });
    }

    return res.status(200).json({
      success: true,
      data: orderGet,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getOrdersByAdmin = async (req, res) => {
  try {
    const {
      page: pageQuery,
      limit: limitQuery,
      search: searchQuery,
    } = req.query;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;

    const skip = limit * (page - 1);
    let matchQuery = {};

    // Escape special regex characters to prevent ReDoS
    const safeSearch = (searchQuery || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const totalOrders = await Orders.countDocuments({
      $or: [
        { 'user.firstName': { $regex: safeSearch, $options: 'i' } },
        { 'user.lastName': { $regex: safeSearch, $options: 'i' } },
      ],
      ...matchQuery,
    });

    const orders = await Orders.aggregate([
      { $match: { ...matchQuery } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      total: totalOrders,
      count: Math.ceil(totalOrders / parseInt(limit)),
      currentPage: page,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOneOrderByAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    await Notifications.findOneAndUpdate(
      { orderId: id },
      {
        opened: true,
      },
      {
        new: true,
        runValidators: true,
      }
    );
    const orderGet = await Orders.findById({ _id: id });
    if (!orderGet) {
      return res.status(404).json({
        success: false,
        message: 'Order Not Found',
      });
    }

    return res.status(200).json({
      success: true,
      data: orderGet,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const updateOrderByAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const data = await req.body;

    // 🛡️ SECURITY: Whitelist only the fields admins are allowed to update.
    // Passing raw req.body allows injection of Mongo operators ($set, $inc, etc.)
    // or overwriting sensitive fields like paymentId, user._id, total.
    const ALLOWED_ORDER_FIELDS = ['status', 'trackingUrl', 'deliveryStatus', 'note', 'deliveryId', 'deliveryProvider'];
    const safeData = {};
    for (const field of ALLOWED_ORDER_FIELDS) {
      if (data[field] !== undefined) safeData[field] = data[field];
    }

    const order = await Orders.findByIdAndUpdate(
      id,
      { $set: safeData },
      {
        new: true,
        runValidators: true,
      }
    );
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order Not Found',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Order Updated',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const deleteOrderByAdmin = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Find the order to be deleted
    const order = await Orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order Not Found',
      });
    }

    // Delete the order from the Orders collection
    await Orders.findByIdAndDelete(orderId);

    // Remove the order ID from the user's order array
    await User.findOneAndUpdate(
      { _id: order.user },
      { $pull: { orders: orderId } }
    );

    // Delete notifications related to the order
    await Notifications.deleteMany({ orderId });

    return res.status(200).json({
      success: true,
      message: 'Order Deleted',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getDeliveryQuote = async (req, res) => {
  try {
    const { user, items } = req.body;
    
    if (!user || !user.address) {
      return res.status(400).json({ success: false, message: 'Address is required for delivery quote.' });
    }

    // Get product details to check for alcohol
    const products = await Products.find({
      _id: { $in: items.map((item) => item.pid) },
    }).populate('category');

    const alcoholCategorySlugs = [
      'beer', 'brandy', 'gin', 'liqueur', 'rum', 'seltzers-and-more', 
      'spirits', 'tequila', 'vodka', 'whiskey', 'wine', 
      'brandy-and-cognac', 'spiked', 'hard-seltzer'
    ];

    let containsAlcohol = false;
    products.forEach(product => {
      if (product.category && alcoholCategorySlugs.includes(product.category.slug)) {
        containsAlcohol = true;
      }
    });

    // Create a mock order object for the quote
    const mockOrder = {
      user: {
        firstName: user.firstName || 'Customer',
        lastName: user.lastName || '',
        phone: user.phone || '0000000000',
        address: user.address,
        city: user.city,
        state: user.state,
        zip: user.zip,
        country: user.country
      },
      containsAlcohol
    };

    const { service, provider } = await getDeliveryService();

    const quote = await service.getDeliveryQuote(mockOrder);

    return res.status(200).json({
      success: true,
      data: quote,
      deliveryFee: (quote.fee || 0) / 100, // Convert from cents to dollars
    });
  } catch (error) {
    console.error('❌ Delivery Quote Error:', error.response ? error.response.data : error.message);
    const message = error.response?.data?.message || error.message;
    return res.status(400).json({ 
      success: false, 
      message: `Delivery restricted: ${message}` 
    });
  }
};

const cancelDelivery = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Orders.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Cancel delivery if order has been dispatched
    // Check terminal statuses for both DoorDash and Uber Direct
    const terminalStatuses = ['DELIVERY_CANCELLED', 'DASHER_DROPPED_OFF', 'canceled', 'delivered', 'returned'];
    if (order.orderNo && order.deliveryStatus && !terminalStatuses.includes(order.deliveryStatus)) {
      try {
        const service = order.deliveryProvider === 'uberdirect' ? uberDirectService : doorDashService;
        await service.cancelDelivery(order.orderNo);
      } catch (ddError) {
        console.error('Delivery cancel failed:', ddError.response ? ddError.response.data : ddError.message);
        // Continue — update local status even if provider cancel fails
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

    const provider = order.deliveryProvider || 'doordash';
    const service = provider === 'uberdirect' ? uberDirectService : doorDashService;
    const delivery = await service.getDeliveryStatus(order.orderNo);

    const updateFields = {};

    if (provider === 'uberdirect') {
      updateFields.deliveryStatus = delivery.status;
      if (delivery.tracking_url) updateFields.trackingUrl = delivery.tracking_url;
      if (delivery.dropoff_eta) updateFields.estimatedDeliveryTime = delivery.dropoff_eta;
      if (delivery.pickup_eta) updateFields.estimatedPickupTime = delivery.pickup_eta;

      if (delivery.status === 'pickup_complete' || delivery.status === 'en_route_to_dropoff' || delivery.status === 'dropoff') updateFields.status = 'shipped';
      if (delivery.status === 'delivered') updateFields.status = 'delivered';
      if (delivery.status === 'canceled') updateFields.status = 'delivery_failed';
      if (delivery.status === 'returned') updateFields.status = 'returned';
    } else {
      updateFields.deliveryStatus = delivery.delivery_status;
      if (delivery.tracking_url) updateFields.trackingUrl = delivery.tracking_url;
      if (delivery.dropoff_time_estimated) updateFields.estimatedDeliveryTime = delivery.dropoff_time_estimated;
      if (delivery.pickup_time_estimated) updateFields.estimatedPickupTime = delivery.pickup_time_estimated;

      if (delivery.delivery_status === 'DASHER_PICKED_UP') updateFields.status = 'shipped';
      if (delivery.delivery_status === 'DASHER_DROPPED_OFF') updateFields.status = 'delivered';
      if (delivery.delivery_status === 'DELIVERY_CANCELLED') updateFields.status = 'delivery_failed';
      if (delivery.delivery_status === 'DELIVERY_RETURNED') updateFields.status = 'returned';
    }

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

module.exports = {
  createOrder,
  getDeliveryQuote,
  getOrderById,
  getOrdersByAdmin,
  getOneOrderByAdmin,
  updateOrderByAdmin,
  deleteOrderByAdmin,
  cancelDelivery,
  refreshDeliveryStatus,
};
