const express = require('express');
const router = express.Router();
const notificationRoutes = require('../controllers/notification');
// Import verifyToken function
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');

//admin routes
router.get('/admin/notifications', verifyToken, adminCheck, notificationRoutes.getNotifications);
router.post('/admin/notifications', verifyToken, adminCheck, notificationRoutes.createNotification);
router.put('/admin/notifications/:id/open', verifyToken, adminCheck, notificationRoutes.markNotificationAsOpened);
router.delete('/admin/notifications/:id', verifyToken, adminCheck, notificationRoutes.deleteNotification);
router.delete('/admin/notifications', verifyToken, adminCheck, notificationRoutes.clearAllNotifications);




module.exports = router;
