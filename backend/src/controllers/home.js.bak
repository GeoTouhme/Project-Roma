// controllers/newsController.js
const BrandModel = require('../models/Brand');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().select([
      'name',
      'cover',
      'slug',
      'status',
    ]);
    res.status(201).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getTopRatedProducts = async (req, res) => {
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

          createdAt: 1,
        },
      },
    ]);

    // ✅ Add isWishlisted field based on user_id
    let wishlist = [];
    if (query.user_id) {
      const user = await User.findById(query.user_id).select('wishlist');
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
          createdAt: 1,
        },
      },
    ]);

    // ✅ Add isWishlisted field based on user_id
    let wishlist = [];
    if (query.user_id) {
      const user = await User.findById(query.user_id).select('wishlist');
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
          isFeatured: true,
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

          createdAt: 1,
        },
      },
    ]);

    // ✅ Add isWishlisted field based on user_id
    let wishlist = [];
    if (query.user_id) {
      const user = await User.findById(query.user_id).select('wishlist');
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
};
