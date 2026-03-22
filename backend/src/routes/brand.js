const express = require('express');
const router = express.Router();
const brand = require('../controllers/brand');

// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

// admin routes

router.post('/admin/brands', verifyToken, adminCheck, brand.createBrand);

router.get('/admin/brands', verifyToken, adminCheck, brand.getBrands);

router.get('/admin/brands/:slug', verifyToken, adminCheck, brand.getBrandBySlug);

router.put('/admin/brands/:slug', verifyToken, adminCheck, brand.updateBrandBySlug);

router.delete('/admin/brands/:slug', verifyToken, adminCheck, brand.deleteBrandBySlug);

router.get('/admin/all-brands', brand.getAllBrands);

// User routes

router.get('/brands', brand.getAllBrands);

module.exports = router;
