const express = require('express');
const router = express.Router();
const dealController = require('../controllers/deal');
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

router.get('/deals/active', dealController.getDeals);

router.get('/admin/deals', verifyToken, adminCheck, dealController.getAllDeals);
router.get('/admin/deals/:id', verifyToken, adminCheck, dealController.getDealById);
router.post('/admin/deals', verifyToken, adminCheck, dealController.createDeal);
router.put('/admin/deals/:id', verifyToken, adminCheck, dealController.updateDeal);
router.delete('/admin/deals/:id', verifyToken, adminCheck, dealController.deleteDeal);

module.exports = router;
