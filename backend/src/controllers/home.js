const mongoose = require('mongoose');
const BrandModel = require('../models/Brand');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');
const { safeObjectId } = require('../utils/validators');

const ALCOHOLIC_CATEGORIES = [
  '69bc40b76f0fa539b06ef96a', // TEQUILA
  '69bc40d16f0fa539b06ef988', // RUM
  '69bc40df6f0fa539b06ef992', // WINE
  '69bc40e26f0fa539b06ef997', // GIN
  '69bc41066f0fa539b06ef9b4', // VODKA
  '69bc42556f0fa539b06efa4f', // BEER
  '69bc44f76f0fa539b06efb77', // WHISKEY
  '69bd4c23013d204dfbd805e3', // COCKTAILS & SELTZERS
  '69bd4c23013d204dfbd805e5', // LIQUEUR & SPIRITS
].map(id => new mongoose.Types.ObjectId(id));

const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  const isBlocked = lower.includes('placeholder') || lower.includes('via.placeholder') || lower.includes('google.com/url');
  if (isBlocked) return false;

  // Accept Cloudinary upload URLs (they don't always end with an extension)
  const isCloudinary = lower.includes('cloudinary.com') || lower.includes('res.cloudinary');
  if (isCloudinary) return true;

  // Accept direct image URLs by extension
  return /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/.test(lower);
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().select([
      'name',
      'cover',
      'slug',
      'status',
    ]);

    // Enrich covers with a real product image when only a placeholder is set
    const enriched = await Promise.all(
      categories.map(async (cat) => {
        const coverUrl = cat.cover?.url || '';
        if (isValidImageUrl(coverUrl)) return cat;

        const product = await Product.findOne({
          category: cat._id,
          status: { $nin: ['disabled', 'inactive'] },
          images: {
            $elemMatch: {
              url: {
                $exists: true,
                $ne: '',
                $not: /placeholder|via\.placeholder|google\.com\/url/i,
              },
            },
          },
        })
          .sort({ sold: -1 })
          .select('images')
          .lean();

        const firstImage = product?.images?.find((img) => isValidImageUrl(img?.url));
        if (firstImage?.url) {
          return {
            ...cat.toObject(),
            cover: {
              _id: firstImage._id || cat.cover?._id || 'product_fallback',
              url: firstImage.url,
              blurDataURL: firstImage.blurDataURL || cat.cover?.blurDataURL || '',
            },
          };
        }

        return cat;
      })
    );

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getDealProducts = async (req, res) => {
  try {
    const query = req.query;
    const now = new Date();
    const dealProducts = await Product.aggregate([
      {
        $match: {
          status: { $nin: ['disabled', 'inactive'] },
          available: { $gt: 0 },
          images: {
            $elemMatch: {
              url: {
                $exists: true,
                $ne: '',
                $not: /placeholder|via\.placeholder|google\.com\/url/i,
              },
            },
          },
          $expr: {
            $or: [
              { $gt: ['$discount', 0] },
              { $and: [{ $gt: ['$price', 0] }, { $gt: ['$priceSale', 0] }, { $lt: ['$priceSale', '$price'] }] },
            ],
          },
          $or: [{ saleEndsAt: { $exists: false } }, { saleEndsAt: null }, { saleEndsAt: { $gte: now } }],
        },
      },
      { $sort: { discount: -1, sold: -1 } },
      { $limit: 12 },
      {
        $project: {
          image: { url: { $arrayElemAt: ['$images.url', 0] }, blurDataURL: { $arrayElemAt: ['$images.blurDataURL', 0] } },
          name: 1,
          slug: 1,
          price: 1,
          priceSale: 1,
          discount: 1,
          saleEndsAt: 1,
          averageRating: 1,
          isBestSeller: 1,
          isTopCollection: 1,
        },
      },
    ]);

    let wishlist = [];
    const safeUserId = safeObjectId(query.user_id);
    if (safeUserId) {
      const user = await User.findById(safeUserId).select('wishlist');
      if (user?.wishlist?.length) wishlist = user.wishlist.map(id => id.toString());
    }

    return res.status(200).json({
      success: true,
      data: dealProducts.map(p => ({ ...p, isWishlisted: wishlist.includes(p._id.toString()) })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getTopRatedProducts = async (req, res) => {
  try {
    const query = req.query;
    const bestSellingProduct = await Product.aggregate([
      {
        $match: {
          category: { $in: ALCOHOLIC_CATEGORIES },
          status: { $nin: ['disabled', 'inactive'] },
          available: { $gt: 0 },
          images: { $exists: true, $ne: [] },
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $sort: {
          averageRating: -1,
        },
      },
      {
        $limit: 8,
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          available: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          isBestSeller: 1,
          isTopCollection: 1,
          createdAt: 1,
        },
      },
    ]);

    // 🛡️ Validate user_id as a real ObjectId before querying
    let wishlist = [];
    const safeUserId = safeObjectId(query.user_id);
    if (safeUserId) {
      const user = await User.findById(safeUserId).select('wishlist');
      if (user && user.wishlist && Array.isArray(user.wishlist)) {
        wishlist = user.wishlist.map(id => id.toString());
      }
    }

    const enrichedProducts = bestSellingProduct.map(product => ({
      ...product,
      isWishlisted: wishlist.includes(product._id.toString()),
    }));
    res.status(201).json({ success: true, data: enrichedProducts });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getBrands = async (req, res) => {
  try {
    const brands = await BrandModel.find().select([
      'name',
      'logo',
      'slug',
      'status',
    ]);

    res.status(201).json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getBestSellerProducts = async (req, res) => {
  try {
    const query = req.query;
    const bestSellingProduct = await Product.aggregate([
      {
        $match: {
          category: { $in: ALCOHOLIC_CATEGORIES },
          status: { $nin: ['disabled', 'inactive'] },
          available: { $gt: 0 },
          images: { $exists: true, $ne: [] },
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $match: {
          isBestSeller: true,
        },
      },
      {
        $sort: {
          sold: -1,
        },
      },
      {
        $limit: 8,
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          available: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          isBestSeller: 1,
          isTopCollection: 1,
          createdAt: 1,
        },
      },
    ]);

    // 🛡️ Validate user_id as a real ObjectId before querying
    let wishlist = [];
    const safeUserId = safeObjectId(query.user_id);
    if (safeUserId) {
      const user = await User.findById(safeUserId).select('wishlist');
      if (user && user.wishlist && Array.isArray(user.wishlist)) {
        wishlist = user.wishlist.map(id => id.toString());
      }
    }

    const enrichedProducts = bestSellingProduct.map(product => ({
      ...product,
      isWishlisted: wishlist.includes(product._id.toString()),
    }));
    return res.status(200).json({ success: true, data: enrichedProducts });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getFeaturedProducts = async (req, res) => {
  try {
    const query = req.query;
    const bestSellingProduct = await Product.aggregate([
      {
        $lookup: {
          from: 'reviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $match: {
          isTopCollection: true,
          category: { $in: ALCOHOLIC_CATEGORIES },
          status: { $nin: ['disabled', 'inactive'] },
          available: { $gt: 0 },
          images: { $exists: true, $ne: [] },
        },
      },
      {
        $limit: 8,
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          available: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          isBestSeller: 1,
          isTopCollection: 1,
          createdAt: 1,
        },
      },
    ]);

    // 🛡️ Validate user_id as a real ObjectId before querying
    let wishlist = [];
    const safeUserId = safeObjectId(query.user_id);
    if (safeUserId) {
      const user = await User.findById(safeUserId).select('wishlist');
      if (user && user.wishlist && Array.isArray(user.wishlist)) {
        wishlist = user.wishlist.map(id => id.toString());
      }
    }

    const enrichedProducts = bestSellingProduct.map(product => ({
      ...product,
      isWishlisted: wishlist.includes(product._id.toString()),
    }));
    return res.status(200).json({ success: true, data: enrichedProducts });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategories,
  getTopRatedProducts,
  getBrands,
  getBestSellerProducts,
  getFeaturedProducts,
  getDealProducts,
};
