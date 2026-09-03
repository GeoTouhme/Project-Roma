/**
 * 🛡️ orderCalculator.js — Server-side cart total calculator
 *
 * Computes order totals from the authoritative product database instead of trusting
 * client-submitted prices. Used by both the order creation and PaymentIntent endpoints
 * so the Stripe intent amount always matches the cart the backend will charge for.
 */

const Products = require('../models/Product');
const Coupons = require('../models/CouponCode');
const Deal = require('../models/Deal');
const MixBundle = require('../models/MixBundle');
const Settings = require('../models/settings');
const { safeObjectId, safeNumber } = require('./validators');
const { applyMixBundleDeals } = require('./mixBundle');

const alcoholCategorySlugs = [
  'beer', 'brandy', 'gin', 'liqueur', 'rum', 'seltzers-and-more',
  'spirits', 'tequila', 'vodka', 'whiskey', 'wine',
  'brandy-and-cognac', 'spiked', 'hard-seltzer',
];

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate Deal (fixed-product bundle) discount for regular cart items.
 * "Buy N for $X" deals on specific products.
 */
async function applyBundleDealDiscounts(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;

  const now = new Date();
  const deals = await Deal.find({
    status: 'active',
    startAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
  }).lean();

  if (!deals.length) return 0;

  let totalDiscount = 0;

  for (const deal of deals) {
    const dealProductIds = new Set(deal.productIds.map((id) => id.toString()));
    const matchingItems = items.filter((item) => {
      if (item.type === 'bundle' || item.bundleApplied) return false;
      const itemId = (item.pid || item._id || item.id)?.toString();
      return dealProductIds.has(itemId);
    });
    const totalQty = matchingItems.reduce(
      (sum, item) => sum + Math.max(1, safeNumber(item.quantity, 1)),
      0
    );
    if (totalQty < deal.quantity) continue;

    // Use each item's own price (already set from authoritative DB in updatedItems)
    const regularTotal = matchingItems.reduce((sum, item) => {
      const unitPrice = safeNumber(item.priceSale, 0) || safeNumber(item.price, 0) || 0;
      return sum + Math.max(1, safeNumber(item.quantity, 1)) * unitPrice;
    }, 0);

    const bundleCount = Math.floor(totalQty / deal.quantity);
    const leftoverQty = totalQty % deal.quantity;
    const avgUnitPrice = regularTotal / totalQty;
    const discountedTotal = bundleCount * deal.bundlePrice + leftoverQty * avgUnitPrice;
    const discount = round2(regularTotal - discountedTotal);
    if (discount > 0) {
      totalDiscount += discount;
      matchingItems.forEach((item) => { item.bundleApplied = true; });
    }
  }

  return round2(totalDiscount);
}

/**
 * Calculate authoritative order totals from cart items.
 * @param {Array} items - Cart items with at least { pid/_id/id, quantity, ... }
 * @param {number|string} shipping - Delivery fee
 * @param {number|string} tip - Tip amount
 * @param {string} [couponCode] - Optional coupon code
 * @param {string} [userEmail] - Optional user email for per-user coupon validation
 * @returns {Promise<Object>} Totals plus updatedItems and products for downstream use.
 */
async function calculateOrderTotals({ items, shipping, tip, couponCode, userEmail }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Please Provide Item(s)');
  }

  const bundleItems = items.filter((item) => item.type === 'bundle');
  const regularItems = items.filter((item) => item.type !== 'bundle');
  const bundleProductPids = bundleItems.flatMap((item) =>
    (item.products || []).map((p) => safeObjectId(p.pid || p._id || p.id))
  ).filter(Boolean);

  const safeItems = regularItems
    .map((item) => {
      const rawPid = item.pid || item._id || item.id;
      const pid = safeObjectId(rawPid);
      const quantity = Math.max(1, Math.floor(safeNumber(item.quantity, 1)));
      return { ...item, pid, quantity };
    })
    .filter((item) => item.pid);

  if (safeItems.length === 0 && bundleItems.length === 0) {
    throw new Error('Please Provide Item(s)');
  }

  const productIds = safeItems.map((item) => item.pid);
  const products = await Products.find({
    _id: { $in: [...productIds, ...bundleProductPids] },
  }).populate('category');

  const validProducts = products.filter(
    (p) => p.status !== 'disabled' && p.status !== 'inactive' && p.available > 0
  );

  // For bundles, validate that all bundled products are available.
  const bundleAvailabilityErrors = [];
  for (const bundle of bundleItems) {
    const bundleProducts = (bundle.products || [])
      .map((p) => products.find((prod) => prod._id.toString() === safeObjectId(p.pid || p._id || p.id)?.toString()))
      .filter(Boolean);
    if (bundleProducts.length !== (bundle.products || []).length) {
      bundleAvailabilityErrors.push(`Bundle ${bundle.name || bundle.pid} contains unavailable products.`);
    }
  }

  if (bundleAvailabilityErrors.length > 0) {
    throw new Error(bundleAvailabilityErrors.join(' '));
  }

  if (safeItems.length > 0 && validProducts.length !== products.length) {
    throw new Error('One or more products are unavailable or out of stock.');
  }

  let containsAlcohol = false;
  const updatedItems = [];

  for (const item of safeItems) {
    const product = products.find((p) => p._id.toString() === item.pid);
    if (!product) {
      throw new Error(`Product not found: ${item.pid}`);
    }

    if (product.category && alcoholCategorySlugs.includes(product.category.slug)) {
      containsAlcohol = true;
    }

    const price = product.priceSale || product.price || 0;
    const total = price * item.quantity;

    updatedItems.push({
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
    });
  }

  const bundleIds = bundleItems
    .map((b) => safeObjectId(b.pid || b._id || b.id))
    .filter(Boolean);

  const [dbDeals, dbMixBundles] = await Promise.all([
    bundleIds.length > 0 ? Deal.find({ _id: { $in: bundleIds } }).lean() : [],
    bundleIds.length > 0 ? MixBundle.find({ _id: { $in: bundleIds } }).lean() : [],
  ]);

  const now = new Date();
  for (const bundle of bundleItems) {
    const rawBundleId = safeObjectId(bundle.pid || bundle._id || bundle.id);
    const bundleIdStr = rawBundleId?.toString();
    let authoritativeBundlePrice = null;
    let bundleName = bundle.name || 'Bundle';

    const matchedDeal = dbDeals.find((d) => d._id.toString() === bundleIdStr);
    if (matchedDeal) {
      const isDealValid =
        matchedDeal.status === 'active' &&
        (!matchedDeal.startAt || new Date(matchedDeal.startAt) <= now) &&
        (!matchedDeal.expiresAt || new Date(matchedDeal.expiresAt) >= now);
      if (isDealValid) {
        authoritativeBundlePrice = safeNumber(matchedDeal.bundlePrice, 0);
        bundleName = matchedDeal.name || bundleName;
      }
    }

    if (authoritativeBundlePrice === null) {
      const matchedMixBundle = dbMixBundles.find((mb) => mb._id.toString() === bundleIdStr);
      if (matchedMixBundle) {
        const isMixValid =
          matchedMixBundle.status === 'active' &&
          (!matchedMixBundle.startAt || new Date(matchedMixBundle.startAt) <= now) &&
          (!matchedMixBundle.expiresAt || new Date(matchedMixBundle.expiresAt) >= now);
        if (isMixValid) {
          authoritativeBundlePrice = safeNumber(matchedMixBundle.bundlePrice, 0);
          bundleName = matchedMixBundle.name || bundleName;
        }
      }
    }

    if (authoritativeBundlePrice === null) {
      throw new Error(`Bundle is invalid or expired: ${bundle.name || bundle.pid || bundle.id}`);
    }

    const bundleProducts = (bundle.products || [])
      .map((p) => {
        const product = products.find(
          (prod) => prod._id.toString() === safeObjectId(p.pid || p._id || p.id)?.toString()
        );
        if (!product) return null;
        if (product.category && alcoholCategorySlugs.includes(product.category.slug)) {
          containsAlcohol = true;
        }
        return {
          pid: product._id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          price: product.price,
          priceSale: product.priceSale,
          imageUrl: product.images?.[0]?.url || '',
          size: product.size || null,
        };
      })
      .filter(Boolean);

    const bundleQty = Math.max(1, Math.floor(safeNumber(bundle.quantity, 1)));
    const bundleLineTotal = round2(authoritativeBundlePrice * bundleQty);

    updatedItems.push({
      pid: bundle.pid || bundle._id || bundle.id,
      name: bundleName,
      type: 'bundle',
      bundlePrice: authoritativeBundlePrice,
      quantity: bundleQty,
      subtotal: bundleLineTotal.toFixed(2),
      total: bundleLineTotal,
      products: bundleProducts,
    });
  }

  const grandTotal = round2(updatedItems.reduce((acc, item) => acc + (item.total || 0), 0));
  const dealDiscount = round2(await applyBundleDealDiscounts(updatedItems));
  const mixDiscount = round2(await applyMixBundleDeals(updatedItems));
  const bundleDiscount = round2(dealDiscount + mixDiscount);
  const discountedGrandTotal = round2(Math.max(0, grandTotal - bundleDiscount));

  const settings = await Settings.findOneOrCreate();
  const taxRate = typeof settings.taxRate === 'number' ? settings.taxRate : 0.0775;
  const markupRate = typeof settings.markupRate === 'number' ? settings.markupRate : 0.02;

  let taxableSubtotal = 0;
  for (const item of updatedItems) {
    if (item.type === 'bundle') {
      const anyTaxable = (item.products || []).some((sub) => {
        const subProduct = products.find((p) => p._id.toString() === sub.pid.toString());
        return subProduct?.category?.taxable !== false;
      });
      if (anyTaxable) taxableSubtotal += item.total;
      continue;
    }

    const product = products.find((p) => p._id.toString() === item.pid.toString());
    const category = product?.category;
    const itemTotal = item.total;

    if (category?.taxable !== false) {
      taxableSubtotal += itemTotal;
    }
  }
  taxableSubtotal = round2(taxableSubtotal);

  // Store markup on every product's base price.
  const markupTotal = round2(grandTotal * markupRate);

  let couponDiscount = 0;
  if (couponCode) {
    const safeCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : null;
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

    // Per-user reuse check: if the user's email is already in usedBy, reject.
    if (userEmail && Array.isArray(couponData.usedBy) && couponData.usedBy.includes(userEmail)) {
      throw new Error('You have already used this coupon.');
    }

    // Max total uses check (0 = unlimited).
    if (couponData.maxUses && couponData.maxUses > 0) {
      const usedCount = (couponData.usedBy || []).length;
      if (usedCount >= couponData.maxUses) {
        throw new Error('This coupon has reached its maximum usage limit.');
      }
    }

    // Minimum order amount check (0 = no minimum).
    if (couponData.minOrderAmount && couponData.minOrderAmount > 0) {
      if (discountedGrandTotal < couponData.minOrderAmount) {
        throw new Error(
          `This coupon requires a minimum order of $${couponData.minOrderAmount.toFixed(2)}.`
        );
      }
    }

    if (couponData.type === 'percent') {
      couponDiscount = (couponData.discount / 100) * discountedGrandTotal;
    } else {
      couponDiscount = couponData.discount;
    }
    // Cap coupon at the remaining subtotal to avoid over-discounting.
    couponDiscount = Math.min(couponDiscount, discountedGrandTotal);
  }

  couponDiscount = round2(couponDiscount);
  const discount = round2(bundleDiscount + couponDiscount);
  const discountedTotal = round2(Math.max(0, discountedGrandTotal - couponDiscount));

  // Markup covers CRV deposits, payment processing, and VPS maintenance — excluded from taxBase.
  const taxRatio = grandTotal > 0 ? (taxableSubtotal / grandTotal) : 0;
  const taxBase = Math.max(0, round2(taxableSubtotal - taxRatio * discount));
  const tax = round2(taxBase * taxRate);

  const sanitizedTip = Math.max(0, Math.min(safeNumber(tip, 0), 100));
  const deliveryFee = Math.max(0, safeNumber(shipping, 0));
  const orderTotal = round2(discountedTotal + tax + markupTotal + deliveryFee + sanitizedTip);

  return {
    products,
    updatedItems,
    containsAlcohol,
    grandTotal,
    dealDiscount,
    mixDiscount,
    bundleDiscount,
    couponDiscount,
    taxableSubtotal,
    discount,
    taxBase,
    tax,
    taxRate,
    markupRate,
    markupTotal,
    sanitizedTip,
    deliveryFee,
    orderTotal,
    expectedAmountCents: Math.round(orderTotal * 100),
  };
}

module.exports = { calculateOrderTotals };
