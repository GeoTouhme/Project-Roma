const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
router.get('/home/categories', homeController.getCategories);
router.get('/home/products/top', homeController.getTopRatedProducts);
router.get('/home/products/best-selling', homeController.getBestSellerProducts);
router.get('/home/products/featured', homeController.getFeaturedProducts);
router.get('/home/brands', homeController.getBrands);

module.exports = router;
