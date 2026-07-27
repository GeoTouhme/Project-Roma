const express = require('express');
const router = express.Router();
const recommendation = require('../controllers/recommendation');
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

router.get('/recommendations', recommendation.getRecommendations);
router.get('/recommendations/cart', recommendation.getCartRecommendations);
router.post(
  '/admin/recommendations/mine-online-orders',
  verifyToken,
  adminCheck,
  recommendation.mineOnlineOrderRecommendations
);

module.exports = router;
