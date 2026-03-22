const express = require('express');
const router = express.Router();
const product = require('../controllers/product');

// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

// Admin routes

router.post('/admin/products', verifyToken, adminCheck, product.createProductByAdmin);
router.get('/admin/products', verifyToken, adminCheck, product.getProductsByAdmin);
router.get('/admin/products/:slug', verifyToken, adminCheck, product.getOneProductByAdmin);
router.put('/admin/products/:slug', verifyToken, adminCheck, product.updateProductByAdmin);

router.delete(
  '/admin/products/:slug',
  verifyToken,
  adminCheck,
  product.deletedProductByAdmin
);
// User routes

router.get('/products', product.getProducts);
router.get('/products/filters', product.getFilters);
router.get('/filters/:category', product.getFiltersByCategory);
router.get('/filters/:category/:subcategory', product.getFiltersBySubCategory);
router.get('/products/:slug', product.getOneProductBySlug);
router.get('/products-slugs', product.getAllProductSlug);
router.get('/related-products/:pid', product.relatedProducts);

module.exports = router;
