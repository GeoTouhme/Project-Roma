'use strict';
const User = require('../models/User');
const Orders = require('../models/Order');
const Checkout = require('../models/Checkout');
const Review = require('../models/Review');
const Newsletter = require('../models/Newsletter');
const Coupon = require('../models/CouponCode');
const PageView = require('../models/PageView');
const PrivacyRequest = require('../models/PrivacyRequest');
const Notifications = require('../models/Notification');
const MAX_EXPORT_RECORDS = 10000;
async function bounded(query) {
  const rows = await query.limit(MAX_EXPORT_RECORDS + 1).lean();
  if (rows.length > MAX_EXPORT_RECORDS) throw Object.assign(new Error('This export needs staff assistance; no partial export was produced.'), { status: 413 });
  return rows;
}
async function exportAccount(ownerId) {
  // Explicit allowlists exclude password, session, OTP and MFA secrets, staff notes,
  // internal claims and other customers' coupon usage.
  const account = await User.findById(ownerId).select('firstName lastName email phone provider isVerified createdAt updatedAt wishlist recentProducts cover').lean();
  if (!account) throw Object.assign(new Error('Account not found.'), { status: 404 });
  const [orders, checkouts, reviews, newsletter, coupons, analytics, requests] = await Promise.all([
    bounded(Orders.find({ 'user._id': ownerId }).select('orderNo user items status paymentStatus paymentEnvironment total subTotal shipping tax markup discount tip fulfillmentType createdAt updatedAt refundedAmount policyAcceptance ageAcknowledgedAt handoffVerification.checkedAt')),
    bounded(Checkout.find({ owner: ownerId }).select('amount currency recoveryState createdAt updatedAt +requestSnapshot')),
    bounded(Review.find({ user: ownerId }).select('product review rating images isPurchased createdAt updatedAt')),
    bounded(Newsletter.find({ email: account.email }).select('email createdAt updatedAt')),
    bounded(Coupon.find({ 'usageHistory.user': ownerId }).select('code usageHistory')),
    bounded(PageView.find({ owner: ownerId }).select('productSlug productName pageType source referrer deviceType browserFamily consentVersion createdAt')),
    bounded(PrivacyRequest.find({ owner: ownerId }).select('type status response legalHold createdAt updatedAt reviewedAt')),
  ]);
  const notifications = orders.length ? await bounded(Notifications.find({ orderId: { $in: orders.map(x => String(x._id)) } }).select('title city createdAt')) : [];
  for (const entry of checkouts) {
    const snapshot = entry.requestSnapshot;
    entry.checkout = snapshot ? { user: snapshot.user, items: snapshot.items, fulfillmentType: snapshot.fulfillmentType, pickupNote: snapshot.pickupNote,
      ageAcknowledgedAt: snapshot.ageAcknowledgedAt, policyAcceptance: snapshot.policyAcceptance } : null;
    delete entry.requestSnapshot;
  }
  return { generatedAt: new Date().toISOString(), account, orders, checkouts, reviews, newsletter,
    coupons: coupons.map(c => ({ code: c.code, usage: c.usageHistory.filter(h => String(h.user) === String(ownerId)).map(h => ({ date: h.date, orderNo: h.orderNo, total: h.total, discount: h.discount })) })),
    analytics, requests, notifications,
    limitations: ['Browser-only cart and anonymous analytics cannot be linked reliably to this account.', 'Vendor records, support communications and retained backups require staff coordination.'] };
}
function retentionConfiguration(env = process.env) {
  let config = {};
  if (env.DATA_RETENTION_POLICY_JSON) {
    try { config = JSON.parse(env.DATA_RETENTION_POLICY_JSON); } catch { throw new Error('Retention policy JSON is invalid.'); }
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Retention policy must be an object.');
  }
  const collections = ['orders', 'accounts', 'checkouts', 'analytics', 'logs', 'backups'];
  const configured = collections.every(key => Number.isInteger(config.days?.[key]) && config.days[key] > 0);
  // Configuration alone is not authorization to delete financial/recovery records.
  return { configured, approved: configured && typeof config.approvedBy === 'string' && !!config.approvedBy.trim()
    && typeof config.approvedAt === 'string' && Number.isFinite(Date.parse(config.approvedAt)) && !!config.version,
    cleanupEnabled: false, existingAnalyticsTtlDays: 90,
    days: Object.fromEntries(collections.map(key => [key, Number.isInteger(config.days?.[key]) && config.days[key] > 0 ? config.days[key] : null])) };
}
async function retentionReport() {
  const config = retentionConfiguration();
  const [holds, unresolvedPayments, pendingRequests, analyticsIndexes] = await Promise.all([
    PrivacyRequest.countDocuments({ legalHold: true }),
    Checkout.countDocuments({ version: 2, recoveryState: { $nin: ['completed', 'refunded', 'cancelled'] } }),
    PrivacyRequest.countDocuments({ status: { $nin: ['resolved', 'declined'] } }),
    PageView.collection.indexes(),
  ]);
  return { ...config, holds, unresolvedPayments, pendingRequests,
    analyticsTtlVerified: analyticsIndexes.some(i => i.key?.expiresAt === 1 && i.expireAfterSeconds === 0),
    backupVerification: 'Requires isolated restore and approved archive retention; not verified by this endpoint.' };
}
module.exports = { exportAccount, retentionConfiguration, retentionReport };
