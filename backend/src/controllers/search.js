
const Products = require('../models/Product');
const Categories = require('../models/Category');
const Brands = require('../models/Brand');

const Search=async(req,res)=> {
  try {
    const { query } = await req.body;
    
    // Security Sanitization
    if (!query || typeof query !== 'string') {
       return res.status(200).json({ success: true, products: [], categories: [], brands: [] });
    }
    const safeQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const categories = await Categories.find(
      {
        name: {
          $regex: safeQuery,
          $options: 'i'
        },
        status: { $ne: 'disabled' }
      },
      null,
      { limit: 10 }
    ).select(['name', 'cover', '_id', 'slug']);
    const products = await Products.find(
      {
        name: {
          $regex: safeQuery,
          $options: 'i'
        },
        status: { $ne: 'disabled' },
        available: { $gt: 0 },
      },
      null,
      { limit: 10 }
    )
      .populate('category')
      .select(['name', 'priceSale', 'images', '_id', 'category', 'slug']);

    const brands = await Brands.find(
      {
        name: {
          $regex: safeQuery,
          $options: 'i'
        },
        status: { $ne: 'disabled' }
      },
      null,
      { limit: 10 }
    ).select(['name', 'logo', '_id', 'slug']);
    return res.status(200).json(
      {
        success: true,
        products,
        categories,
        brands
      },
    );
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { Search };
