'use strict';
const router = require('express').Router();
const verifyToken = require('../config/jwt');
const adminCheck = require('../middleware/adminCheck');
const controller = require('../controllers/checkoutRecovery');
// Recovery must work after closing; eligibility/hours are checked before a new
// order is persisted, while an existing order or refund remains recoverable.
router.get('/checkout-policy', controller.getPublicPolicy);
router.post('/checkouts/cancel-unpaid', verifyToken, controller.cancelUnpaid);
router.post('/checkouts/recover', verifyToken, controller.recover);
router.get('/admin/checkouts/reconciliation', verifyToken, adminCheck, controller.getReconciliationQueue);
router.post('/admin/checkouts/:id/recover', verifyToken, adminCheck, controller.retry);
module.exports = router;
