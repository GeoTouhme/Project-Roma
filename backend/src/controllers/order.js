const Notifications = require('../models/Notification');
const Products = require('../models/Product');
const Orders = require('../models/Order');
const Coupons = require('../models/CouponCode');
const User = require('../models/User');
const doorDashService = require('../services/doorDashService');
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

    const products = await Products.find({
      _id: { $in: items.map((item) => item.pid) },
    }).populate('category');

    const alcoholCategorySlugs = [
      'beer', 'brandy', 'gin', 'liqueur', 'rum', 'seltzers-and-more', 
      'spirits', 'tequila', 'vodka', 'whiskey', 'wine', 
      'brandy-and-cognac', 'spiked', 'hard-seltzer'
    ];

    let containsAlcohol = false;

    const updatedItems = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.pid);
      
      // DEBUG LOG
      if (product) {
        console.log(`🔍 Checking Product: ${product.name} | Category: ${product.category ? product.category.name : 'N/A'} | Slug: ${product.category ? product.category.slug : 'N/A'}`);
      }

      // Check if this product is alcohol based on its category slug
      if (product && product.category && alcoholCategorySlugs.includes(product.category.slug)) {
        containsAlcohol = true;
      }

      const price = product ? product.priceSale : 0;
      const total = price * item.quantity;

      Products.findOneAndUpdate(
        { _id: item.pid, available: { $gte: 0 } },
        { $inc: { available: -item.quantity, sold: item.quantity } },
        { new: true, runValidators: true }
      ).exec();

      return {
        ...item,
        total,
        imageUrl: product.images.length > 0 ? product.images[0].url : '',
      };
    });

    const grandTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);
    let discount = 0;

    if (couponCode) {
      const couponData = await Coupons.findOne({ code: couponCode });

      // Prevent server crash via null dereference if an invalid coupon code is entered
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
      // Add the user's email to the usedBy array of the coupon code
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

    const existingUser = await User.findOne({ email: user.email });
    const orderNo = await generateOrderNumber();
    
    // Construct the user object for the order with all billing details
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

    const orderCreated = await Orders.create({
      paymentMethod,
      paymentId,
      discount,
      total: discountedTotal + Number(shipping),
      subTotal: grandTotal,
      shipping,
      items: updatedItems.map(({ image, ...others }) => others),
      user: orderUser,
      totalItems,
      orderNo,
      containsAlcohol,
      status: 'pending',
    });

    // --- DoorDash Integration (Sandbox) ---
    let deliveryResponse = null;
    let deliveryError = null;
    let trackingUrl = null;

    try {
      console.log('🚀 Triggering DoorDash Delivery for Order:', orderNo);
      deliveryResponse = await doorDashService.createDelivery(orderCreated);
      console.log('✅ DoorDash Full Response:', JSON.stringify(deliveryResponse, null, 2));
      
      trackingUrl = deliveryResponse.tracking_url;

      await Orders.findByIdAndUpdate(orderCreated._id, {
        $set: { 
          deliveryId: deliveryResponse.support_reference || deliveryResponse.delivery_id || deliveryResponse.id,
          trackingUrl: trackingUrl,
          deliveryStatus: deliveryResponse.delivery_status || 'created'
        }
      });
    } catch (ddError) {
      deliveryError = ddError.response ? ddError.response.data : ddError.message;
      console.error('❌ DoorDash Delivery Failed Post-Payment:', deliveryError);
      
      // Update order status to alert admin that delivery dispatch failed
      await Orders.findByIdAndUpdate(orderCreated._id, {
        $set: { 
          status: 'delivery_failed',
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
    const order = await Orders.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
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

    const quote = await doorDashService.getDeliveryQuote(mockOrder);
    
    return res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error('❌ DoorDash Quote Error:', error.response ? error.response.data : error.message);
    const message = error.response?.data?.message || error.message;
    return res.status(400).json({ 
      success: false, 
      message: `Delivery restricted: ${message}` 
    });
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
};
