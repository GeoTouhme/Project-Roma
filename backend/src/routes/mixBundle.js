const express = require('express');
const router = express.Router();
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');
const mixBundleController = require('../controllers/mixBundle');

// Public: active bundles + qualification helper is exposed via controller import elsewhere.
router.get('/mix-bundles/active', mixBundleController.getActiveMixBundles);
router.get('/mix-bundles/qualify/:productId', mixBundleController.getQualifyingBundles);

// Admin CRUD
router.get('/admin/mix-bundles', verifyToken, adminCheck, mixBundleController.getAllMixBundles);
router.get('/admin/mix-bundles/:id', verifyToken, adminCheck, mixBundleController.getMixBundleById);
router.post('/admin/mix-bundles', verifyToken, adminCheck, mixBundleController.createMixBundle);
router.put('/admin/mix-bundles/:id', verifyToken, adminCheck, mixBundleController.updateMixBundle);
router.delete('/admin/mix-bundles/:id', verifyToken, adminCheck, mixBundleController.deleteMixBundle);

module.exports = router;
