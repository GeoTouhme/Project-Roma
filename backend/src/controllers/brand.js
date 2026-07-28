const Brands = require('../models/Brand');
const getBlurDataURL = require('../config/getBlurDataURL');
const CloudinaryService = require('../services/cloudinary.service');

// 🛡️ Whitelist allowed fields to prevent mass assignment
const ALLOWED_BRAND_FIELDS = ['name', 'metaTitle', 'description', 'metaDescription', 'slug', 'status'];

const createBrand = async (req, res) => {
  try {
    const { logo, ...body } = req.body;

    // Validate if the 'logo' property and its 'url' property exist in the request body
    if (!logo || !logo.url) {
      return res.status(400).json({ message: 'Invalid Logo Data' });
    }

    const safeData = {};
    for (const field of ALLOWED_BRAND_FIELDS) {
      if (body[field] !== undefined) safeData[field] = body[field];
    }

    // If blurDataURL is not provided, generate it using the 'getBlurDataURL' function
    const blurDataURL = await getBlurDataURL(logo.url);

    // Creating a new brand
    const newBrand = await Brands.create({
      ...safeData,
      logo: {
        ...logo,
        blurDataURL,
      },
      totalItems: 0,
    });

    res
      .status(201)
      .json({ success: true, data: newBrand, message: 'Brand Created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllBrands = async (req, res) => {
  try {
    const brands = await Brands.find()
      .sort({
        createdAt: -1,
      })
      .select(['name']);

    res.status(201).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const brand = await Brands.findOne({ slug });

    if (!brand) {
      return res.status(404).json({ message: 'Brand Not Found' });
    }

    res.status(201).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const { logo, ...body } = req.body;

    if (!logo || !logo.url) {
      return res.status(400).json({ message: 'Invalid Logo Data' });
    }

    const safeData = {};
    for (const field of ALLOWED_BRAND_FIELDS) {
      if (body[field] !== undefined) safeData[field] = body[field];
    }

    // Validate if the 'blurDataURL' property exists in the logo object
    if (!logo.blurDataURL) {
      // If blurDataURL is not provided, generate it using the 'getBlurDataURL' function
      logo.blurDataURL = await getBlurDataURL(logo.url);
    }
    const updatedBrand = await Brands.findOneAndUpdate(
      { slug },
      {
        ...safeData,
        logo: {
          ...logo,
        },
        totalItems: 0,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedBrand) {
      return res.status(404).json({ message: 'Brand Not Found' });
    }

    res
      .status(201)
      .json({ success: true, data: updatedBrand, message: 'Brand Updated' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const brand = await Brands.findOne({ slug });

    if (!brand) {
      return res.status(404).json({ message: 'Brand Not Found' });
    }
    if (brand?.logo?.public_id) {
      await CloudinaryService.deleteImage(brand.logo.public_id);
    }

    await Brands.deleteOne({ slug });

    res.status(201).json({ success: true, message: 'Brand Deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getBrands = async (req, res) => {
  try {
    const brands = await Brands.find().sort({
      createdAt: -1,
    });

    res.status(201).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createBrand,
  getAllBrands,
  getBrandBySlug,
  updateBrandBySlug,
  deleteBrandBySlug,
  getBrands,
};
