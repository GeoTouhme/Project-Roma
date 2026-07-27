const express = require('express');
const router = express.Router();
const orderRoutes = require('../controllers/order');
// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');
const { checkStoreHours } = require('../middleware/checkStoreHours');

//user routes
router.post('/orders', verifyToken, checkStoreHours, orderRoutes.createOrder);
router.post('/orders/cart-summary', verifyToken, orderRoutes.getCartSummary);
router.post('/orders/delivery-quote', verifyToken, checkStoreHours, orderRoutes.getDeliveryQuote);
router.get('/orders/:id', verifyToken, orderRoutes.getOrderById);
router.put('/orders/:id/cancel', verifyToken, orderRoutes.cancelOrderByCustomer);

//admin routes
router.get('/admin/orders', verifyToken, adminCheck, orderRoutes.getOrdersByAdmin);
router.get('/admin/orders/:id', verifyToken, adminCheck, orderRoutes.getOneOrderByAdmin);
router.put('/admin/orders/:id', verifyToken, adminCheck, orderRoutes.updateOrderByAdmin);
router.put('/admin/orders/:id/accept', verifyToken, adminCheck, orderRoutes.acceptOrderByAdmin);
router.put('/admin/orders/:id/deny', verifyToken, adminCheck, orderRoutes.denyOrderByAdmin);
router.delete('/admin/orders/:id', verifyToken, adminCheck, orderRoutes.deleteOrderByAdmin);
router.put('/admin/orders/:id/cancel', verifyToken, adminCheck, orderRoutes.cancelDelivery);
router.get('/admin/orders/:id/delivery-status', verifyToken, adminCheck, orderRoutes.refreshDeliveryStatus);

module.exports = router;
