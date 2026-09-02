const Products = require('../models/Product');
const MixBundle = require('../models/MixBundle');
const { safeObjectId, safeNumber } = require('./validators');

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Return active mix bundles that a product qualifies for.
 */
async function getQualifyingBundles(product) {
  const now = new Date();
  const bundles = await MixBundle.find({
    status: 'active',
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
    ],
  }).lean();
  return bundles.filter((bundle) => productMatchesBundle(product, bundle));
}

function isActive(bundle) {
  if (bundle.status !== 'active') return false;
  const now = new Date();
  if (bundle.startAt && now < new Date(bundle.startAt)) return false;
  if (bundle.expiresAt && now > new Date(bundle.expiresAt)) return false;
  return true;
}

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function productMatchesCondition(product, condition) {
  const { field, operator, value } = condition;
  let productValue;

  switch (field) {
    case 'category':
      productValue = product.category?._id?.toString() || product.category?.toString() || '';
      break;
    case 'size':
      productValue = product.size || '';
      break;
    case 'brand':
      productValue = product.brand?._id?.toString() || product.brand?.toString() || '';
      break;
    case 'tag':
      productValue = Array.isArray(product.tags) ? product.tags : [];
      break;
    default:
      return false;
  }

  if (operator === 'in') {
    const values = Array.isArray(value) ? value : [value];
    const normalized = values.map(normalize);
    if (Array.isArray(productValue)) {
      return productValue.some((pv) => normalized.includes(normalize(pv)));
    }
    return normalized.includes(normalize(productValue));
  }

  return normalize(productValue) === normalize(value);
}

function productMatchesBundle(product, bundle) {
  if (!isActive(bundle)) return false;
  return bundle.conditions.every((condition) =>
    productMatchesCondition(product, condition)
  );
}

/**
 * Apply active mix-bundle discounts to cart/order items.
 * Modifies items in place with `bundleApplied` flag and returns total discount.
 */
async function applyMixBundleDeals(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;

  const now = new Date();
  const bundles = await MixBundle.find({
    status: 'active',
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
    ],
  }).lean();
  const activeBundles = bundles.filter((b) => isActive(b));
  if (activeBundles.length === 0) return 0;

  // Need populated products to evaluate conditions.
  const pids = items
    .filter((item) => item.type !== 'bundle')
    .map((item) => safeObjectId(item.pid || item._id || item.id))
    .filter(Boolean);
  const products = pids.length
    ? await Products.find({ _id: { $in: pids } }).populate('category brand').lean()
    : [];
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  let totalDiscount = 0;

  for (const bundle of activeBundles) {
    // Find cart items that match this bundle.
    const matchingItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (item.type === 'bundle' || item.bundleApplied) return false;
        const product = productMap.get(safeObjectId(item.pid || item._id || item.id)?.toString());
        if (!product) return false;
        return productMatchesBundle(product, bundle);
      });

    const totalQty = matchingItems.reduce(
      (sum, { item }) => sum + Math.max(1, safeNumber(item.quantity, 1)),
      0
    );
    if (totalQty < bundle.requiredQty) continue;

    const regularTotal = matchingItems.reduce((sum, { item }) => {
      const product = productMap.get(safeObjectId(item.pid || item._id || item.id)?.toString());
      const unitPrice = product?.priceSale || product?.price || 0;
      return sum + Math.max(1, safeNumber(item.quantity, 1)) * unitPrice;
    }, 0);

    const bundleCount = Math.floor(totalQty / bundle.requiredQty);
    const leftoverQty = totalQty % bundle.requiredQty;
    const avgUnitPrice = regularTotal / totalQty;

    const discountedTotal = bundleCount * bundle.bundlePrice + leftoverQty * avgUnitPrice;
    const discount = round2(regularTotal - discountedTotal);
    if (discount > 0) {
      totalDiscount += discount;
      // Mark matching items as consumed so overlapping bundles don't double-discount them.
      matchingItems.forEach(({ item }) => {
        item.bundleApplied = true;
      });
    }
  }

  return totalDiscount;
}

module.exports = {
  getQualifyingBundles,
  productMatchesBundle,
  applyMixBundleDeals,
};
