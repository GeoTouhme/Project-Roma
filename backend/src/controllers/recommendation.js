const mongoose = require('mongoose');
const { exec } = require('child_process');
const path = require('path');
const Product = require('../models/Product');
const Recommendation = require('../models/Recommendation');
const { safeString, safeNumber } = require('../utils/validators');

const STOREfront_FILTER = {
  status: { $nin: ['disabled', 'inactive'] },
  available: { $gt: 0 },
  images: { $exists: true, $ne: [] },
};

// After a $lookup/$unwind the product lives under the `product` field.
const AGGREGATE_PRODUCT_FILTER = {
  'product.status': { $nin: ['disabled', 'inactive'] },
  'product.available': { $gt: 0 },
  'product.images': { $exists: true, $ne: [] },
};

// Weight online purchase behavior more heavily than physical-store baskets.
const SOURCE_WEIGHTS = {
  physical_basket: 1,
  online_order: 1.5,
};

async function _fetchRecommendations(sourceIds, excludeIds, limit) {
  const objectIds = sourceIds.map((id) => new mongoose.Types.ObjectId(id));
  const excludeObjectIds = excludeIds.map((id) => new mongoose.Types.ObjectId(id));

  return Recommendation.aggregate([
    { $match: { sourceProduct: { $in: objectIds } } },
    {
      $group: {
        _id: '$targetProduct',
        score: {
          $sum: {
            $cond: {
              if: { $eq: ['$source', 'online_order'] },
              then: { $multiply: ['$score', SOURCE_WEIGHTS.online_order] },
              else: { $multiply: ['$score', SOURCE_WEIGHTS.physical_basket] },
            },
          },
        },
        count: { $sum: '$count' },
      },
    },
    { $sort: { score: -1, count: -1 } },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $match: {
        ...AGGREGATE_PRODUCT_FILTER,
        'product._id': { $nin: excludeObjectIds },
      },
    },
    {
      $project: {
        _id: '$product._id',
        name: '$product.name',
        slug: '$product.slug',
        price: '$product.price',
        priceSale: '$product.priceSale',
        available: '$product.available',
        image: { $arrayElemAt: ['$product.images', 0] },
        score: { $round: ['$score', 4] },
        count: 1,
      },
    },
    { $limit: limit },
  ]);
}

const getRecommendations = async (req, res) => {
  try {
    const slug = safeString(req.query.product);
    if (!slug) {
      return res
        .status(400)
        .json({ success: false, message: 'Product slug is required.' });
    }

    const limit = safeNumber(req.query.limit, 8);

    const product = await Product.findOne({ slug, ...STOREfront_FILTER }).select('_id');
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found.' });
    }

    const data = await _fetchRecommendations(
      [product._id.toString()],
      [product._id.toString()],
      limit
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getRecommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load recommendations.',
      error: error.message,
    });
  }
};

const getCartRecommendations = async (req, res) => {
  try {
    const slugsParam = safeString(req.query.slugs);
    if (!slugsParam) {
      return res.status(400).json({
        success: false,
        message: 'Cart product slugs are required.',
      });
    }

    const slugs = slugsParam
      .split(',')
      .map((s) => safeString(s))
      .filter(Boolean);

    if (slugs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid cart product slugs provided.',
      });
    }

    const limit = safeNumber(req.query.limit, 8);

    const cartProducts = await Product.find({
      slug: { $in: slugs },
      ...STOREfront_FILTER,
    }).select('_id');

    if (cartProducts.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const cartIds = cartProducts.map((p) => p._id.toString());
    const data = await _fetchRecommendations(cartIds, cartIds, limit);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getCartRecommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load cart recommendations.',
      error: error.message,
    });
  }
};

const mineOnlineOrderRecommendations = async (req, res) => {
  try {
    const scriptPath = path.join(
      __dirname,
      '../scripts/mine-online-order-recommendations.js'
    );

    exec(`node "${scriptPath}"`, { cwd: path.join(__dirname, '../') }, (error, stdout, stderr) => {
      if (error) {
        console.error('Online-order mining error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to mine online-order recommendations.',
          error: error.message,
        });
      }
      if (stderr) {
        console.error('Online-order mining stderr:', stderr);
      }
      console.log('Online-order mining stdout:', stdout);
      return res.status(200).json({
        success: true,
        message: 'Online-order recommendation mining completed.',
      });
    });
  } catch (error) {
    console.error('mineOnlineOrderRecommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start mining process.',
      error: error.message,
    });
  }
};

module.exports = {
  getRecommendations,
  getCartRecommendations,
  mineOnlineOrderRecommendations,
};
