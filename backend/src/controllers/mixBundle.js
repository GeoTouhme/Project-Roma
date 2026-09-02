const MixBundle = require('../models/MixBundle');
const Products = require('../models/Product');
const { safeObjectId } = require('../utils/validators');
const { getQualifyingBundles: getQualifyingBundlesUtil } = require('../utils/mixBundle');

function isActive(bundle) {
  if (bundle.status !== 'active') return false;
  const now = new Date();
  if (bundle.startAt && now < bundle.startAt) return false;
  if (bundle.expiresAt && now > bundle.expiresAt) return false;
  return true;
}

function productMatchesCondition(product, condition) {
  const { field, operator, value } = condition;
  let productValue;

  switch (field) {
    case 'category':
      productValue = product.category?.toString?.() || product.category?.toString() || '';
      break;
    case 'size':
      productValue = product.size || '';
      break;
    case 'brand':
      productValue = product.brand?.toString?.() || product.brand?.toString() || '';
      break;
    case 'tag':
      productValue = Array.isArray(product.tags) ? product.tags : [];
      break;
    default:
      return false;
  }

  if (operator === 'in') {
    const values = Array.isArray(value) ? value : [value];
    const normalized = values.map((v) => String(v).trim().toLowerCase());
    if (Array.isArray(productValue)) {
      return productValue.some((pv) => normalized.includes(String(pv).trim().toLowerCase()));
    }
    return normalized.includes(String(productValue).trim().toLowerCase());
  }

  // equals
  return String(productValue).trim().toLowerCase() === String(value).trim().toLowerCase();
}

function productMatchesBundle(product, bundle) {
  if (!isActive(bundle)) return false;
  return bundle.conditions.every((condition) =>
    productMatchesCondition(product, condition)
  );
}

const getQualifyingBundles = async (req, res) => {
  try {
    const productId = safeObjectId(req.params.productId);
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }
    const product = await Products.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const bundles = await getQualifyingBundlesUtil(product);
    return res.status(200).json({ success: true, data: bundles });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

async function getActiveMixBundlesInternal() {
  const now = new Date();
  const bundles = await MixBundle.find({
    status: 'active',
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
    ],
  }).lean();
  return bundles;
}

const getActiveMixBundles = async (req, res) => {
  try {
    const bundles = await getActiveMixBundlesInternal();
    return res.status(200).json({ success: true, data: bundles });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAllMixBundles = async (req, res) => {
  try {
    const bundles = await MixBundle.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: bundles });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMixBundleById = async (req, res) => {
  try {
    const bundle = await MixBundle.findById(req.params.id);
    if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });
    return res.status(200).json({ success: true, data: bundle });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createMixBundle = async (req, res) => {
  try {
    const bundle = await MixBundle.create(req.body);
    return res.status(201).json({ success: true, data: bundle });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const updateMixBundle = async (req, res) => {
  try {
    const bundle = await MixBundle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });
    return res.status(200).json({ success: true, data: bundle });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const deleteMixBundle = async (req, res) => {
  try {
    const bundle = await MixBundle.findByIdAndDelete(req.params.id);
    if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });
    return res.status(200).json({ success: true, message: 'Bundle deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllMixBundles,
  getMixBundleById,
  createMixBundle,
  updateMixBundle,
  deleteMixBundle,
  getQualifyingBundles,
  getActiveMixBundles,
  productMatchesBundle,
};
