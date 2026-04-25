// controllers/newsController.js
const mongoose = require('mongoose');
const Brand = require('../models/Brand');
const Product = require('../models/Product');
const { safeString, safeObjectId, safeNumber } = require('../utils/validators');

const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

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
const _ = require('lodash');
const CloudinaryService = require('../services/cloudinary.service');
const blurDataUrl = require('../config/getBlurDataURL');
const { getAdmin } = require('../config/getUser');
const User = require('../models/User');

const getProducts = async (req, res) => {
  try {
    const query = req.query;

    // Build a clean match query from scratch
    let productSearchQuery = {
      status: { $ne: 'disabled' },
    };

    // 1. Handle Partial Search by Name with Security Sanitization
    if (query.search && typeof query.search === 'string' && query.search.trim() !== '' && query.search !== 'null') {
      // Escape special regex characters to prevent ReDoS and NoSQL injection
      const safeSearch = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      productSearchQuery.name = { $regex: safeSearch, $options: 'i' };
    }

    // 2. Handle Category (Only if not 'null' and exists)
    if (query.category && query.category !== 'null') {
      const category = await Category.findOne({ slug: query.category }).select('_id');
      if (category) productSearchQuery.category = category._id;
    }

    // 3. Handle SubCategory
    if (query.subCategory && query.subCategory !== 'null') {
      const subCategory = await SubCategory.findOne({ slug: query.subCategory }).select('_id');
      if (subCategory) productSearchQuery.subCategory = subCategory._id;
    }

    // 4. Handle Brand
    if (query.brand && query.brand !== 'null') {
      const brand = await Brand.findOne({ slug: query.brand }).select('_id');
      if (brand) productSearchQuery.brand = brand._id;
    }

    // 5. Handle Sizes & Colors
    const safeSizes = safeString(query.sizes);
    if (safeSizes) {
      productSearchQuery.sizes = { $in: safeSizes.split('_') };
    }
    const safeColors = safeString(query.colors);
    if (safeColors) {
      productSearchQuery.colors = { $in: safeColors.split('_') };
    }

    // 6. Handle Price Range — safeNumber guards against NaN from object payloads
    const safePrices = safeString(query.prices);
    const minPrice = safePrices ? safeNumber(safePrices.split('_')[0], 0) : 0;
    const maxPrice = safePrices ? safeNumber(safePrices.split('_')[1], 10000000) : 10000000;
    productSearchQuery.priceSale = { $gte: minPrice, $lte: maxPrice };

    // 7. Handle Featured — only accept literal string 'true'
    if (query.isFeatured === 'true') {
      productSearchQuery.isFeatured = true;
    }

    const skip = parseInt(query.limit) || 12;
    const page = parseInt(query.page) || 1;

    console.log('--- EXECUTING GET_PRODUCTS WITH ALCOHOL SORT ---');
    console.log('Clean Mongo Query:', JSON.stringify(productSearchQuery));

    const totalProducts = await Product.countDocuments(productSearchQuery);

    const products = await Product.aggregate([
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
          isAlcoholic: {
            $cond: {
              if: { $in: ['$category', ALCOHOLIC_CATEGORIES] },
              then: 1,
              else: 0
            }
          },
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $match: productSearchQuery,
      },
      {
        $project: {
          _id: 1,
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          available: 1,
          createdAt: 1,
          isAlcoholic: 1,
        },
      },
      {
        $sort: {
          isAlcoholic: -1,
          createdAt: -1
        },
      },
      { $skip: (page - 1) * skip },
      { $limit: skip },
    ]);

    // 🛡️ Add isWishlisted — validate user_id as a proper ObjectId before querying
    let wishlist = [];
    const safeUserId = safeObjectId(query.user_id);
    if (safeUserId) {
      const user = await User.findById(safeUserId).select('wishlist');
      if (user && user.wishlist) {
        wishlist = user.wishlist.map(id => id.toString());
      }
    }

    const enrichedProducts = products.map(product => ({
      ...product,
      isWishlisted: wishlist.includes(product._id.toString()),
    }));

    console.log('--- DATA BEING SENT TO FRONTEND (TOP 5) ---');
    enrichedProducts.slice(0, 5).forEach(p => {
        console.log(`Product: ${p.name} | isAlcoholic: ${p.isAlcoholic} | CreatedAt: ${p.createdAt}`);
    });

    res.status(201).json({
      success: true,
      data: enrichedProducts,
      total: totalProducts,
      count: Math.ceil(totalProducts / skip),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};

const getFilters = async (req, res) => {
  try {
    const totalProducts = await Product.find({
      status: { $ne: 'disabled' },
    }).select(['colors', 'sizes', 'gender', 'price']);

    const brands = await Brand.find({
      status: { $ne: 'disabled' },
    }).select(['name', 'slug']);
    const total = totalProducts.map((item) => item.gender);
    const totalGender = total.filter((item) => item !== '');
    function onlyUnique(value, index, array) {
      return array.indexOf(value) === index;
    }
    const mappedColors = totalProducts?.map((v) => v.colors);
    const mappedSizes = totalProducts?.map((v) => v.sizes);
    const mappedPrices = totalProducts?.map((v) => v.price);
    const min = mappedPrices[0] ? Math.min(...mappedPrices) : 0;
    const max = mappedPrices[0] ? Math.max(...mappedPrices) : 100000;
    const response = {
      colors: _.union(...mappedColors),
      sizes: _.union(...mappedSizes),
      prices: [min, max],
      genders: totalGender.filter(onlyUnique),
      brands: brands,
    };
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
const getProductsByAdmin = async (request, response) => {
  try {
    const {
      page: pageQuery,
      limit: limitQuery,
      search: searchQuery,
      category: categoryQuery,
      subCategory: subCategoryQuery,
      filter: filterQuery, // Add support for object filters
    } = request.query;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;
    const skip = limit * (page - 1);

    let matchQuery = {};

    // 1. Parse 'filter' if it arrives as a JSON string (Common in React-Admin)
    // 🛡️ SECURITY: Whitelist only known-safe string fields from the parsed JSON.
    // Blindly spreading JSON.parse(filterQuery) into matchQuery allows operator injection.
    let parsedFilter = {};
    if (filterQuery && typeof filterQuery === 'string') {
      try {
        const rawFilter = JSON.parse(filterQuery);
        // Only extract plain-string properties we actually use
        if (typeof rawFilter.q === 'string') parsedFilter.q = rawFilter.q;
        if (typeof rawFilter.name === 'string') parsedFilter.name = rawFilter.name;
        if (typeof rawFilter.category === 'string') parsedFilter.category = rawFilter.category;
        if (typeof rawFilter.subCategory === 'string') parsedFilter.subCategory = rawFilter.subCategory;
      } catch (e) {
        // Malformed JSON — silently ignore, proceed with empty filter
      }
    }

    // 2. Intelligent Search (prioritize search param, then filter.q, then filter.name)
    const searchTerm = searchQuery || parsedFilter.q || parsedFilter.name || request.query.q || request.query.name;
    if (searchTerm && searchTerm !== 'null' && searchTerm.trim() !== '') {
      const safeSearch = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matchQuery.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { code: { $regex: safeSearch, $options: 'i' } },
        { sku: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // 3. Advanced Category/SubCategory Filtering (handle IDs or Slugs)
    const category = categoryQuery || parsedFilter.category;
    if (category && category !== 'null' && category !== 'all') {
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        matchQuery.category = category;
      } else {
        const catDoc = await Category.findOne({ slug: category }).select('_id');
        if (catDoc) matchQuery.category = catDoc._id;
      }
    }

    const subCategory = subCategoryQuery || parsedFilter.subCategory;
    if (subCategory && subCategory !== 'null' && subCategory !== 'all') {
      if (subCategory.match(/^[0-9a-fA-F]{24}$/)) {
        matchQuery.subCategory = subCategory;
      } else {
        const subDoc = await SubCategory.findOne({ slug: subCategory }).select('_id');
        if (subDoc) matchQuery.subCategory = subDoc._id;
      }
    }

    console.log('Gemini Fixed Match Query:', JSON.stringify(matchQuery));

    const totalProducts = await Product.countDocuments(matchQuery);

    const products = await Product.aggregate([
      { $match: matchQuery },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData',
        },
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCategory',
          foreignField: '_id',
          as: 'subCategoryData',
        },
      },
      {
        $addFields: {
          image: { $arrayElemAt: ['$images', 0] },
          categoryData: { $arrayElemAt: ['$categoryData', 0] },
          subCategoryData: { $arrayElemAt: ['$subCategoryData', 0] },
        },
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          sku: 1,
          code: 1,
          available: 1,
          priceSale: 1,
          price: 1,
          category: 1,
          subCategory: 1,
          categoryData: 1,
          subCategoryData: 1,
          status: 1,
          createdAt: 1,
        },
      },
    ]);

    response.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error('Gemini Controller Error:', error);
    response.status(400).json({ success: false, message: error.message });
  }
};
const createProductByAdmin = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);

    const { images, ...body } = req.body;

    const updatedImages = await Promise.all(
      images.map(async (image) => {
        const blurDataURL = await blurDataUrl(image.url);
        return { ...image, blurDataURL };
      })
    );
    const data = await Product.create({
      ...body,
      images: updatedImages,
      likes: 0,
    });

    res.status(201).json({
      success: true,
      message: 'Product Created',
      data: data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getOneProductByAdmin = async (req, res) => {
  try {
    // 🛡️ Validate slug param as a plain string before querying
    const slug = safeString(req.params.slug);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Invalid product slug.' });
    }
    const product = await Product.findOne({ slug });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product Not Found' });
    }
    const category = await Category.findById(product.category).select([
      'name',
      'slug',
    ]);
    const brand = await Brand.findById(product.brand).select('name');

    const getProductRatingAndReviews = () => {
      return Product.aggregate([
        {
          $match: { slug },
        },
        {
          $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'product',
            as: 'reviews',
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            rating: { $avg: '$reviews.rating' },
            totalReviews: { $size: '$reviews' },
          },
        },
      ]);
    };

    const reviewReport = await getProductRatingAndReviews();
    return res.status(201).json({
      success: true,
      data: product,
      totalRating: reviewReport[0]?.rating,
      totalReviews: reviewReport[0]?.totalReviews,
      brand: brand,
      category: category,
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
const updateProductByAdmin = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);
    const slug = safeString(req.params.slug);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Invalid product slug.' });
    }

    const { images = [], category, subCategory, ...body } = req.body;

    const updateFields = { ...body };

    if (category) {
      const safeCat = safeObjectId(category);
      if (!safeCat) {
        return res.status(400).json({ success: false, message: 'Invalid category ID.' });
      }
      updateFields.category = safeCat;
    }

    if (subCategory) {
      const safeSub = safeObjectId(subCategory);
      if (!safeSub) {
        return res.status(400).json({ success: false, message: 'Invalid subCategory ID.' });
      }
      updateFields.subCategory = safeSub;
    }

    if (images.length > 0) {
      const updatedImages = await Promise.all(
        images.map(async (image) => {
          const blurDataURL = await blurDataUrl(image.url);
          return { ...image, blurDataURL };
        })
      );
      updateFields.images = updatedImages;
    }

    const updated = await Product.findOneAndUpdate(
      { slug },
      updateFields,
      { new: true, runValidators: true }
    );

    return res.status(201).json({
      success: true,
      data: updated,
      message: 'Product Updated',
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
async function deletedProductByAdmin(req, res) {
  try {
    const slug = req.params.slug;
    const product = await Product.findOne({ slug: slug });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Item Not Found',
      });
    }
    if (product && product.images && product.images.length > 0) {
      // Use CloudinaryService to delete images
      for (const image of product.images) {
        // Try regular public_id (from new flow) or _id (from legacy schema)
        const publicId = image.public_id || image._id;
        if (publicId) {
          await CloudinaryService.deleteImage(publicId);
        }
      }
    }
    const deleteProduct = await Product.deleteOne({ slug: slug });
    if (!deleteProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product Deletion Failed',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Product Deleted ',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

const getFiltersByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const categoryData = await Category.findOne({ slug: category }).select([
      'name',
      'slug',
    ]);
    if (!categoryData) {
      return res
        .status(404)
        .json({ success: false, message: 'Category Not Found' });
    }
    const totalProducts = await Product.find({
      status: { $ne: 'disabled' },
      category: categoryData._id,
    }).select(['colors', 'sizes', 'gender']);
    const brands = await Brand.find({
      status: { $ne: 'disabled' },
    }).select(['name', 'slug']);

    const total = totalProducts.map((item) => item.gender);
    const totalGender = total.filter((item) => item !== '');

    function onlyUnique(value, index, array) {
      return array.indexOf(value) === index;
    }
    const mappedColors = totalProducts?.map((v) => v.colors);
    const mappedSizes = totalProducts?.map((v) => v.sizes);
    const mappedPrices = totalProducts?.map((v) => v.price);
    const min = mappedPrices[0] ? Math.min(...mappedPrices[0]) : 0;
    const max = mappedPrices[0] ? Math.max(...mappedPrices[0]) : 100000;
    const response = {
      colors: _.union(...mappedColors),
      sizes: _.union(...mappedSizes),
      prices: [min, max],
      genders: totalGender.filter(onlyUnique),
      brands: brands,
    };
    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getFiltersBySubCategory = async (req, res) => {
  try {
    const { category, subcategory } = req.params;

    const categoryData = await Category.findOne({ slug: category }).select([
      'name',
      'slug',
    ]);
    const subCategoryData = await SubCategory.findOne({
      slug: subcategory,
    }).select(['name', 'slug']);
    if (!categoryData) {
      return res
        .status(404)
        .json({ success: false, message: 'Category Not Found' });
    }
    if (!subCategoryData) {
      return res
        .status(404)
        .json({ success: false, message: 'SubCategory Not Found' });
    }
    const totalProducts = await Product.find({
      status: { $ne: 'disabled' },
      subCategory: subCategoryData._id,
    }).select(['colors', 'sizes', 'gender']);
    const brands = await Brand.find({
      status: { $ne: 'disabled' },
    }).select(['name', 'slug']);

    const total = totalProducts.map((item) => item.gender);
    const totalGender = total.filter((item) => item !== '');

    function onlyUnique(value, index, array) {
      return array.indexOf(value) === index;
    }
    const mappedColors = totalProducts?.map((v) => v.colors);
    const mappedSizes = totalProducts?.map((v) => v.sizes);
    const mappedPrices = totalProducts?.map((v) => v.price);
    const min = mappedPrices[0] ? Math.min(...mappedPrices[0]) : 0;
    const max = mappedPrices[0] ? Math.max(...mappedPrices[0]) : 100000;
    const response = {
      colors: _.union(...mappedColors),
      sizes: _.union(...mappedSizes),
      prices: [min, max],
      genders: totalGender.filter(onlyUnique),
      brands: brands,
    };
    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllProductSlug = async (req, res) => {
  try {
    const products = await Product.find().select('slug');

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const relatedProducts = async (req, res) => {
  try {
    const pid = req.params.pid;
    const product = await Product.findById(pid).select('_id category');

    const related = await Product.aggregate([
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
          category: product.category,
          _id: { $ne: product._id },
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

    res.status(200).json({ success: true, data: related });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getOneProductBySlug = async (req, res) => {
  try {
    // 🛡️ Validate slug param as a plain string before querying
    const slug = safeString(req.params.slug);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Invalid product slug.' });
    }
    const product = await Product.findOne({ slug });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product Not Found' });
    }
    const category = await Category.findById(product.category).select([
      'name',
      'slug',
    ]);
    const brand = await Brand.findById(product.brand).select('name');

    const getProductRatingAndReviews = () => {
      return Product.aggregate([
        {
          $match: { slug },
        },
        {
          $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'product',
            as: 'reviews',
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            rating: { $avg: '$reviews.rating' },
            totalReviews: { $size: '$reviews' },
          },
        },
      ]);
    };

    const reviewReport = await getProductRatingAndReviews();
    return res.status(201).json({
      success: true,
      data: product,
      totalRating: reviewReport[0]?.rating,
      totalReviews: reviewReport[0]?.totalReviews,
      brand: brand,
      category: category,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = {
  getProducts,
  getFilters,
  getProductsByAdmin,
  createProductByAdmin,
  getOneProductByAdmin,
  updateProductByAdmin,
  deletedProductByAdmin,
  getFiltersByCategory,
  getAllProductSlug,
  getFiltersBySubCategory,
  relatedProducts,
  getOneProductBySlug,
};
