const express = require('express');
const router = express.Router();
const orderRoutes = require('../controllers/order');
// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');
const { checkStoreHours } = require('../middleware/checkStoreHours');

//user routes
router.post('/orders', checkStoreHours, orderRoutes.createOrder);
router.post('/orders/delivery-quote', orderRoutes.getDeliveryQuote);
router.get('/orders/:id', verifyToken, orderRoutes.getOrderById);

//admin routes
router.get('/admin/orders', verifyToken, adminCheck, orderRoutes.getOrdersByAdmin);
router.get('/admin/orders/:id', verifyToken, adminCheck, orderRoutes.getOneOrderByAdmin);
router.put('/admin/orders/:id', verifyToken, adminCheck, orderRoutes.updateOrderByAdmin);
router.delete('/admin/orders/:id', verifyToken, adminCheck, orderRoutes.deleteOrderByAdmin);

module.exports = router;
