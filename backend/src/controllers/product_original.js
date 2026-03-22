// controllers/newsController.js
const Brand = require('../models/Brand');
const Product = require('../models/Product');

const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const _ = require('lodash');
const CloudinaryService = require('../services/cloudinary.service');
const blurDataUrl = require('../config/getBlurDataURL');
const { getAdmin } = require('../config/getUser');
const User = require('../models/User');

// ... (existing getProducts, getFilters, etc. - keep them unchanged, just updating imports and delete/create logic)

const createProductByAdmin = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);

    const { images, ...body } = req.body;

    const updatedImages = await Promise.all(
      images.map(async (image) => {
        // If image has a URL but no blurDataURL, generate it.
        // In the new flow, upload returns blurDataURL, so this might be redundant but safe.
        const blurDataURL = image.blurDataURL || await blurDataUrl(image.url);
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
    // ROLLBACK: If product creation fails, delete uploaded images
    if (req.body.images && Array.isArray(req.body.images)) {
      console.log("Rolling back images due to product creation failure...");
      for (const img of req.body.images) {
        if (img.public_id) { // Use public_id if available (new flow)
          await CloudinaryService.deleteImage(img.public_id);
        } else if (img._id) { // Fallback to _id (legacy flow, might not work if it's not a public_id)
          await CloudinaryService.deleteImage(img._id);
        }
      }
    }

    res.status(400).json({ success: false, message: error.message });
  }
};


// ... (getOneProductByAdmin, updateProductByAdmin - generally fine, update might need similar rollback if we want to be perfect, but let's focus on create/delete first)

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
    const product = await Product.findOne({ slug: req.params.slug });
    const category = await Category.findById(product.category).select([
      'name',
      'slug',
    ]);
    const brand = await Brand.findById(product.brand).select('name');

    if (!product) {
      notFound();
    }
    const getProductRatingAndReviews = () => {
      return Product.aggregate([
        {
          $match: { slug: req.params.slug },
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
