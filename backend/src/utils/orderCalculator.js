/**
 * 🛡️ orderCalculator.js — Server-side cart total calculator
 *
 * Computes order totals from the authoritative product database instead of trusting
 * client-submitted prices. Used by both the order creation and PaymentIntent endpoints
 * so the Stripe intent amount always matches the cart the backend will charge for.
 */

const Products = require('../models/Product');
const Coupons = require('../models/CouponCode');
const Settings = require('../models/settings');
const { safeObjectId, safeNumber } = require('./validators');
const { getCrvPerItem } = require('./crv');

const alcoholCategorySlugs = [
  'beer', 'brandy', 'gin', 'liqueur', 'rum', 'seltzers-and-more',
  'spirits', 'tequila', 'vodka', 'whiskey', 'wine',
  'brandy-and-cognac', 'spiked', 'hard-seltzer',
];

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate authoritative order totals from cart items.
 * @param {Array} items - Cart items with at least { pid/_id/id, quantity, ... }
 * @param {number|string} shipping - Delivery fee
 * @param {number|string} tip - Tip amount
 * @param {string} [couponCode] - Optional coupon code
 * @returns {Promise<Object>} Totals plus updatedItems and products for downstream use.
 */
async function calculateOrderTotals({ items, shipping, tip, couponCode }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Please Provide Item(s)');
  }

  const safeItems = items
    .map((item) => {
      const rawPid = item.pid || item._id || item.id;
      const pid = safeObjectId(rawPid);
      const quantity = Math.max(1, Math.floor(safeNumber(item.quantity, 1)));
      return { ...item, pid, quantity };
    })
    .filter((item) => item.pid);

  if (safeItems.length === 0) {
    throw new Error('Invalid product IDs in cart.');
  }

  const productIds = safeItems.map((item) => item.pid);
  const products = await Products.find({
    _id: { $in: productIds },
  }).populate('category');

  const validProducts = products.filter(
    (p) => p.status !== 'disabled' && p.status !== 'inactive' && p.available > 0
  );
  if (validProducts.length !== products.length) {
    throw new Error('One or more products are unavailable or out of stock.');
  }

  let containsAlcohol = false;
  const updatedItems = safeItems.map((item) => {
    const product = products.find((p) => p._id.toString() === item.pid);
    if (!product) {
      throw new Error(`Product not found: ${item.pid}`);
    }

    if (product.category && alcoholCategorySlugs.includes(product.category.slug)) {
      containsAlcohol = true;
    }

    const price = product.priceSale;
    const total = price * item.quantity;

    return {
      pid: product._id,
      name: item.name || product.name,
      brand: item.brand || product.brand,
      slug: item.slug || product.slug,
      price: item.price ?? product.price,
      priceSale: product.priceSale,
      available: product.available,
      size: item.size || product.size || null,
      color: item.color || null,
      sku: item.sku || product.sku,
      quantity: item.quantity,
      subtotal: total.toFixed(2),
      total,
      imageUrl: product.images.length > 0 ? product.images[0].url : '',
    };
  });

  const grandTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);

  const settings = await Settings.findOneOrCreate();
  const taxRate = typeof settings.taxRate === 'number' ? settings.taxRate : 0.0775;

  let crvTotal = 0;
  let taxableSubtotal = 0;
  for (const item of updatedItems) {
    const product = products.find((p) => p._id.toString() === item.pid.toString());
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
  if (couponCode) {
    const safeCode = typeof couponCode === 'string' ? couponCode.trim() : null;
    if (!safeCode) {
      throw new Error('Invalid Coupon Code');
    }

    const couponData = await Coupons.findOne({ code: safeCode });
    if (!couponData) {
      throw new Error('Invalid Coupon Code');
    }

    const expired = new Date() >= new Date(couponData.expire);
    if (expired) {
      throw new Error('CouponCode Is Expired');
    }

    if (couponData.type === 'percent') {
      discount = (couponData.discount / 100) * grandTotal;
    } else {
      discount = couponData.discount;
    }
  }

  const discountedTotal = Math.max(0, grandTotal - discount);
  const taxBase = Math.max(0, taxableSubtotal - discount);
  const tax = round2(taxBase * taxRate);
  const sanitizedTip = Math.max(0, Math.min(safeNumber(tip, 0), 100));
  const deliveryFee = Math.max(0, safeNumber(shipping, 0));
  const orderTotal = round2(discountedTotal + tax + crvTotal + deliveryFee + sanitizedTip);

  return {
    products,
    updatedItems,
    containsAlcohol,
    grandTotal,
    taxableSubtotal,
    discount,
    tax,
    crvTotal,
    sanitizedTip,
    deliveryFee,
    orderTotal,
    expectedAmountCents: Math.round(orderTotal * 100),
  };
}

module.exports = { calculateOrderTotals };
