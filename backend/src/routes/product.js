const express = require('express');
const router = express.Router();
const multer = require('multer');
const product = require('../controllers/product');

// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

// Multer memory storage for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'), false);
    }
  },
});

// CSV export/import routes (MUST be before :slug routes)
router.get('/admin/products/export-csv', verifyToken, adminCheck, product.exportInventoryCSV);
router.post('/admin/products/import-csv', verifyToken, adminCheck, upload.single('file'), product.importInventoryCSV);

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

