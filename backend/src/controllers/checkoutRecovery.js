'use strict';
const Checkouts = require('../models/Checkout');
const { paymentMode, readPolicy } = require('../utils/checkoutPolicy');
const { recoverCheckout, cancelUnpaidCheckout } = require('../services/checkoutRecovery');
async function recover(req, res) {
  try {
    const result = await recoverCheckout({ checkoutId: req.body.checkoutId, paymentId: req.body.paymentId, ownerId: req.user._id });
    return res.status(result.state === 'payment_pending' ? 202 : 200).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Payment recovery is temporarily unavailable. Do not pay again; retry shortly or contact the store.' });
  }
}
async function getReconciliationQueue(req, res) {
  try {
    const data = await Checkouts.find({ version: 2, recoveryState: { $in: ['refund_pending', 'manual_review'] } })
      .select('owner amount currency paymentId recoveryState recoveryError createdAt updatedAt').sort({ createdAt: 1 }).limit(100).lean();
    return res.json({ success: true, data });
  } catch { return res.status(503).json({ success: false, message: 'Payment reconciliation queue unavailable.' }); }
}
async function retry(req, res) {
  try {
    const checkout = await Checkouts.findById(req.params.id);
    if (!checkout || checkout.version !== 2) return res.status(404).json({ success: false, message: 'Checkout not found.' });
    const result = await recoverCheckout({ checkoutId: String(checkout._id), ownerId: checkout.owner });
    return res.json({ success: true, ...result });
  } catch { return res.status(503).json({ success: false, message: 'Reconciliation is still pending. Do not create a second charge.' }); }
}
async function cancelUnpaid(req, res) {
  try { return res.json({ success: true, ...await cancelUnpaidCheckout({ checkoutId: req.body.checkoutId, ownerId: req.user._id }) }); }
  catch (error) { return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Unable to cancel this payment attempt. Retry recovery; do not pay again.' }); }
}
function getPublicPolicy(req, res) {
  try {
    const mode = paymentMode(), policy = readPolicy();
    return res.json({ success: true, data: { mode, version: policy.version, deliveryZips: policy.deliveryZips,
      policyVersions: require("../config/policyVersions.json"), allowedFulfillment: policy.allowedFulfillment, alcoholEnabled: policy.alcoholEnabled === true, tobaccoEnabled: policy.tobaccoEnabled === true } });
  } catch (error) { return res.status(503).json({ success: false, message: error.code === 'CHECKOUT_POLICY' ? error.message : 'Checkout is unavailable.' }); }
}
module.exports = { getPublicPolicy, cancelUnpaid, recover, getReconciliationQueue, retry };
