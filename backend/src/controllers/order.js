const mongoose = require('mongoose');
const Notifications = require('../models/Notification');
const Products = require('../models/Product');
const Orders = require('../models/Order');
const Coupons = require('../models/CouponCode');
const User = require('../models/User');
const doorDashService = require('../services/doorDashService');
const uberDirectService = require('../services/uberDirectService');
const Settings = require('../models/settings');
const sendEmail = require('../utils/mailer');
const Category = require('../models/Category');
const { safeObjectId, safeNumber } = require('../utils/validators');
const { getCrvPerItem } = require('../utils/crv');

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
  const provider = settings.deliveryProvider || 'store';
  return {
    service: provider === 'uberdirect' ? uberDirectService : doorDashService,
    provider,
  };
}

/**
 * Calculate delivery fee based on store settings.
 * Uses zip-specific fee if found, otherwise falls back to default.
 */
async function getStoreDeliveryFee(zip) {
  const settings = await Settings.findOneOrCreate();
  const zipFee = settings.deliveryFeesByZip?.find((z) => z.zip === zip)?.fee;
  return zipFee !== undefined ? zipFee : (settings.defaultDeliveryFee || 0);
}

/**
 * Round a number to 2 decimal places.
 */
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Process a Stripe refund for an order.
 * Returns the refund ID on success, or null if no Stripe payment exists.
 * Throws on Stripe error so the caller can decide whether to fail or continue.
 */
async function processStripeRefund(order) {
  if (order.paymentMethod !== 'Stripe' || !order.paymentId) {
    return null;
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const refundAmountCents = Math.round(Number(order.total) * 100);

  const refund = await stripe.refunds.create({
    payment_intent: order.paymentId,
    amount: refundAmountCents,
  });

  return { refundId: refund.id, amount: order.total };
}

async function restockInventory(items) {
  if (!items || !items.length) return;
  const restockUpdates = items.map((item) =>
    Products.findByIdAndUpdate(
      item.pid,
      { $inc: { available: item.quantity, sold: -item.quantity } },
      { new: true, runValidators: true }
    ).exec()
  );
  await Promise.all(restockUpdates);
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

    const validProducts = products.filter(
      (p) => p.status !== 'disabled' && p.status !== 'inactive' && p.available > 0
    );
    if (validProducts.length !== products.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products are unavailable or out of stock.',
      });
    }

    const alcoholCategorySlugs = [
      'beer', 'brandy', 'gin', 'liqueur', 'rum', 'seltzers-and-more',
      'spirits', 'tequila', 'vodka', 'whiskey', 'wine',
      'brandy-and-cognac', 'spiked', 'hard-seltzer'
    ];

    let containsAlcohol = false;

    const updatedItems = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.pid);

      if (product && product.category && alcoholCategorySlugs.includes(product.category.slug)) {
        containsAlcohol = true;
      }

      const price = product ? product.priceSale : 0;
      const total = price * item.quantity;

      return {
        ...item,
        total,
        imageUrl: product.images.length > 0 ? product.images[0].url : '',
      };
    });

    // Atomic transaction: decrement stock, create order, and record coupon use together.
    // If any step fails, all changes are rolled back.
    const session = await mongoose.startSession();
    let orderCreated;
    try {
      await session.withTransaction(async () => {
        for (const item of updatedItems) {
          const product = products.find((p) => p._id.toString() === item.pid);
          const stockResult = await Products.findOneAndUpdate(
            { _id: item.pid, available: { $gte: item.quantity } },
            { $inc: { available: -item.quantity, sold: item.quantity } },
            { new: true, runValidators: true, session }
          );
          if (!stockResult) {
            throw new Error(`Insufficient stock for product: ${product?.name || item.pid}`);
          }
        }

        orderCreated = await Orders.create([{
          paymentMethod,
          paymentId,
          discount,
          tip: sanitizedTip,
          tax,
          crv: crvTotal,
          total: orderTotal,
          subTotal: grandTotal,
          shipping,
          items: updatedItems.map(({ image, ...others }) => others),
          user: orderUser,
          totalItems,
          orderNo,
          containsAlcohol,
          status: 'pending',
        }], { session });
        orderCreated = orderCreated[0];

        await User.findByIdAndUpdate(
          req.user._id,
          { $push: { orders: orderCreated._id } },
          { session }
        );

        if (couponCode) {
          await Coupons.findOneAndUpdate(
            { code: couponCode },
            { $addToSet: { usedBy: req.user.email } },
            { session }
          );
        }
      });
    } catch (transactionError) {
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: transactionError.message || 'Order could not be completed. Please try again.'
      });
    }
    await session.endSession();

    const grandTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);

    // Calculate tax and CRV based on product categories and size
    const settings = await Settings.findOneOrCreate();
    const taxRate = typeof settings.taxRate === 'number' ? settings.taxRate : 0.0775;

    let crvTotal = 0;
    let taxableSubtotal = 0;
    for (const item of updatedItems) {
      const product = products.find((p) => p._id.toString() === item.pid);
      const category = product?.category;
      const productSize = product?.size;
      const itemTotal = item.total;
      const qty = item.quantity || 1;
      if (category?.taxable !== false) {
        taxableSubtotal += itemTotal;
      }
      if (category?.crvRate) {
        crvTotal += qty * getCrvPerItem(productSize, category.crvRate);
      }
    }

    crvTotal = round2(crvTotal);

    let discount = 0;
    let couponData = null;

    if (couponCode) {
      couponData = await Coupons.findOne({ code: couponCode });

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

      if (couponData.type === 'percent') {
        const percentLess = couponData.discount;
        discount = (percentLess / 100) * grandTotal;
      } else {
        discount = couponData.discount;
      }
    }

    let discountedTotal = grandTotal - discount;
    discountedTotal = discountedTotal || 0;

    const taxBase = Math.max(0, taxableSubtotal - discount);
    const tax = round2(taxBase * taxRate);

    // Issue 5: Sanitize tip value
    const sanitizedTip = Math.max(0, Math.min(Number(tip) || 0, 100));

    const deliveryFee = Number(shipping) || 0;
    const orderTotal = round2(discountedTotal + tax + crvTotal + deliveryFee + sanitizedTip);

    // Issue 1: Verify Stripe payment amount matches server-calculated total
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const expectedAmountCents = Math.round(orderTotal * 100);

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
    } catch (stripeError) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Please try again.'
      });
    }

    if (!paymentIntent) {
      return res.status(400).json({
        success: false,
        message: 'Payment not found. Please try again.'
      });
    }

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

    // Use authenticated user from JWT, not client-provided user object
    const orderUser = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
    };

    // Optional shipping details from the client must still come from a trusted source
    const shippingDetails = user || {};
    orderUser.phone = shippingDetails.phone || req.user.phone || '';
    orderUser.address = shippingDetails.address || req.user.address || '';
    orderUser.city = shippingDetails.city || req.user.city || '';
    orderUser.state = shippingDetails.state || req.user.state || '';
    orderUser.country = shippingDetails.country || req.user.country || '';
    orderUser.zip = shippingDetails.zip || req.user.zip || '';

    const orderNo = await generateOrderNumber();


    // --- Staff-Only Delivery ---
    // NOTE: This project uses staff-only delivery. DoorDash/Uber Direct auto-
    // dispatch is intentionally disabled. Staff members accept orders in the admin
    // panel and arrange delivery manually. Delivery service code is kept for
    // future use only.
    let trackingUrl = null;
    console.log(`⏸️ Staff-only delivery: order ${orderNo} awaiting staff acceptance.`);
    // --------------------------------------

    await Notifications.create([{
      opened: false,
      title: `${orderUser.firstName} ${orderUser.lastName} placed an order from ${orderUser.city}.`,
      paymentMethod,
      orderId: orderCreated._id,
      city: orderUser.city,
      cover: req.user?.cover?.url || '',
    }]);

    // Send order confirmation email (non-blocking)
    try {
      let htmlContent = readHTMLTemplate();

      htmlContent = htmlContent.replace(
        /{{recipientName}}/g,
        `${orderUser.firstName} ${orderUser.lastName}`
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
        to: orderUser.email,
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
      data: orderCreated,
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

    // 🛡️ AUTHORIZATION: Ensure customers can only read their own orders.
    const orderUserId = orderGet.user?._id?.toString();
    const authUserId = req.user?._id?.toString();
    if (orderUserId && orderUserId !== authUserId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this order.' });
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
    const ALLOWED_ORDER_FIELDS = ['status', 'trackingUrl', 'deliveryStatus', 'note', 'deliveryId', 'deliveryProvider', 'staffNotes'];
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

/**
 * Calculate tax and CRV for a cart without requiring delivery details.
 * Used by the cart page to preview estimated taxes before checkout.
 */
const getCartSummary = async (req, res) => {
  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          subtotal: 0,
          taxableSubtotal: 0,
          tax: 0,
          crv: 0,
          total: 0,
          itemCount: 0,
        },
      });
    }

    const pids = items
      .map((item) => safeObjectId(item.pid || item._id || item.id))
      .filter(Boolean);

    const products = await Products.find({ _id: { $in: pids } }).populate(
      'category',
      'name slug taxable crvRate'
    );

    const productById = new Map(
      products.map((p) => [p._id.toString(), p])
    );

    const settings = await Settings.findOneOrCreate();
    const taxRate =
      typeof settings.taxRate === 'number' ? settings.taxRate : 0.0775;

    let subtotal = 0;
    let taxableSubtotal = 0;
    let crvTotal = 0;
    let itemCount = 0;

    for (const item of items) {
      const pid = safeObjectId(item.pid || item._id || item.id);
      if (!pid) continue;

      const product = productById.get(pid);
      if (!product) continue;

      const qty = Math.max(1, safeNumber(item.quantity, 1));
      const unitPrice = product.priceSale || product.price || 0;
      const lineTotal = round2(unitPrice * qty);

      subtotal += lineTotal;
      itemCount += qty;

      if (product.category?.taxable !== false) {
        taxableSubtotal += lineTotal;
      }

      if (product.category?.crvRate) {
        crvTotal += qty * getCrvPerItem(product.size, product.category.crvRate);
      }
    }

    subtotal = round2(subtotal);
    taxableSubtotal = round2(taxableSubtotal);
    crvTotal = round2(crvTotal);
    const tax = round2(taxableSubtotal * taxRate);
    const total = round2(subtotal + tax + crvTotal);

    return res.status(200).json({
      success: true,
      data: {
        subtotal,
        taxableSubtotal,
        tax,
        crv: crvTotal,
        total,
        itemCount,
        taxRate,
      },
    });
  } catch (error) {
    console.error('Cart summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate cart summary.',
      error: error.message,
    });
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

    const validProducts = products.filter(
      (p) => p.status !== 'disabled' && p.status !== 'inactive' && p.available > 0
    );
    if (validProducts.length !== products.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products are unavailable or out of stock.',
      });
    }

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

    const settings = await Settings.findOneOrCreate();

    // Store-managed delivery fees (no DoorDash/Uber call)
    if (!settings.deliveryProvider || settings.deliveryProvider === 'store') {
      const fee = await getStoreDeliveryFee(user.zip);
      return res.status(200).json({
        success: true,
        data: { fee: fee * 100 },
        deliveryFee: fee,
        provider: 'store',
      });
    }

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

    // Cancel delivery if order has been dispatched automatically
    // Check terminal statuses for both DoorDash and Uber Direct
    const terminalStatuses = ['DELIVERY_CANCELLED', 'DASHER_DROPPED_OFF', 'canceled', 'delivered', 'returned'];
    // For automatically dispatched deliveries only (legacy / future)
    if (order.deliveryId && order.deliveryStatus && !terminalStatuses.includes(order.deliveryStatus)) {
      try {
        const service = order.deliveryProvider === 'uberdirect' ? uberDirectService : doorDashService;
        await service.cancelDelivery(order.deliveryId);
      } catch (ddError) {
        console.error('Delivery cancel failed:', ddError.response ? ddError.response.data : ddError.message);
        // Continue — update local status even if provider cancel fails
      }
    }

    // Restock inventory for cancelled orders
    await restockInventory(order.items);

    // Attempt Stripe refund for cancelled orders
    let refundResult = null;
    let refundError = null;
    try {
      refundResult = await processStripeRefund(order);
    } catch (err) {
      refundError = err.message;
      console.error(`❌ Stripe refund failed for cancelled order ${order.orderNo}:`, refundError);
    }

    const updateFields = {
      status: 'cancelled',
      deliveryStatus: 'DELIVERY_CANCELLED',
    };

    if (refundResult) {
      updateFields.refundId = refundResult.refundId;
      updateFields.refundAmount = refundResult.amount;
    } else if (refundError) {
      updateFields.refundError = refundError;
    }

    await Orders.findByIdAndUpdate(id, { $set: updateFields });

    return res.status(200).json({
      success: true,
      message: refundResult
        ? 'Order cancelled, inventory restocked, and refund issued.'
        : refundError
        ? 'Order cancelled and inventory restocked, but the refund failed. Please handle the refund manually in Stripe.'
        : 'Order cancelled and inventory restocked.',
      refundId: refundResult?.refundId || null,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const acceptOrderByAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Orders.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be accepted.',
      });
    }

    const adminUser = await User.findById(req.user._id).select('firstName lastName');

    await Orders.findByIdAndUpdate(id, {
      $set: {
        status: 'processing',
        staffAcceptedAt: new Date(),
        staffActionBy: {
          _id: adminUser?._id,
          name: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin',
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Order accepted. Staff can now request a driver manually.',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const denyOrderByAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const { reason } = await req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A denial reason is required.',
      });
    }

    const order = await Orders.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be denied.',
      });
    }

    // Restock inventory for denied orders
    await restockInventory(order.items);

    // Attempt Stripe refund for denied orders
    let refundResult = null;
    let refundError = null;
    try {
      refundResult = await processStripeRefund(order);
    } catch (err) {
      refundError = err.message;
      console.error(`❌ Stripe refund failed for denied order ${order.orderNo}:`, refundError);
    }

    const adminUser = await User.findById(req.user._id).select('firstName lastName');

    const updateFields = {
      status: 'denied',
      staffDenialReason: reason.trim(),
      staffDeniedAt: new Date(),
      staffActionBy: {
        _id: adminUser?._id,
        name: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin',
      },
    };

    if (refundResult) {
      updateFields.refundId = refundResult.refundId;
      updateFields.refundAmount = refundResult.amount;
    } else if (refundError) {
      updateFields.refundError = refundError;
    }

    await Orders.findByIdAndUpdate(id, { $set: updateFields });

    return res.status(200).json({
      success: true,
      message: refundResult
        ? 'Order denied, inventory restocked, and refund issued.'
        : refundError
        ? 'Order denied and inventory restocked, but the refund failed. Please handle the refund manually in Stripe.'
        : 'Order denied and inventory restocked.',
      refundId: refundResult?.refundId || null,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const cancelOrderByCustomer = async (req, res) => {
  try {
    const id = req.params.id;
    const { reason } = await req.body;
    const order = await Orders.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only allow cancellation while order is still pending (not yet accepted)
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This order can no longer be cancelled. Please contact the store.',
      });
    }

    // Verify the order belongs to the authenticated customer
    const authUser = req.user;
    if (
      order.user?._id?.toString() !== authUser?._id?.toString() &&
      order.user?.email !== authUser?.email
    ) {
      return res.status(403).json({ success: false, message: 'You are not authorized to cancel this order.' });
    }

    // Restock inventory
    await restockInventory(order.items);

    // Attempt Stripe refund
    let refundResult = null;
    let refundError = null;
    try {
      refundResult = await processStripeRefund(order);
    } catch (err) {
      refundError = err.message;
      console.error(`❌ Stripe refund failed for customer-cancelled order ${order.orderNo}:`, refundError);
    }

    const updateFields = {
      status: 'cancelled',
      customerCancellationReason: reason ? reason.trim() : 'Customer cancelled',
    };

    if (refundResult) {
      updateFields.refundId = refundResult.refundId;
      updateFields.refundAmount = refundResult.amount;
    } else if (refundError) {
      updateFields.refundError = refundError;
    }

    await Orders.findByIdAndUpdate(id, { $set: updateFields });

    // Notify staff about the customer cancellation
    try {
      await Notifications.create({
        opened: false,
        title: `⚠️ CUSTOMER CANCELLED Order ${order.orderNo} — ${order.user?.firstName} ${order.user?.lastName}`,
        paymentMethod: order.paymentMethod,
        orderId: order._id,
        city: order.user?.city || '',
        cover: '',
      });
    } catch (notifyErr) {
      console.error('Failed to create customer cancellation notification:', notifyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: refundResult
        ? 'Order cancelled and refund issued.'
        : refundError
        ? 'Order cancelled, but the refund failed. Please contact the store.'
        : 'Order cancelled.',
      refundId: refundResult?.refundId || null,
    });
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

    if (!order.deliveryId) {
      return res.status(400).json({ success: false, message: 'No delivery associated with this order' });
    }

    const provider = order.deliveryProvider || 'doordash';
    const service = provider === 'uberdirect' ? uberDirectService : doorDashService;
    const delivery = await service.getDeliveryStatus(order.deliveryId);

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
  getCartSummary,
  getDeliveryQuote,
  getOrderById,
  getOrdersByAdmin,
  getOneOrderByAdmin,
  updateOrderByAdmin,
  deleteOrderByAdmin,
  acceptOrderByAdmin,
  denyOrderByAdmin,
  cancelDelivery,
  cancelOrderByCustomer,
  refreshDeliveryStatus,
};
