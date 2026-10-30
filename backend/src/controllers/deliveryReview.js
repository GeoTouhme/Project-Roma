const Orders = require('../models/Order');
function validateException(order, body) {
  if (!['failed', 'returned'].includes(body.type) || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000) return 'Choose a delivery exception and a factual reason.';
  if (body.type === 'returned' && body.goodsReceived !== true) return 'Confirm that goods were physically received before recording a return.';
  const allowed = body.type === 'returned' ? ['shipped', 'delivery_failed'] : ['processing', 'accepted', 'shipped'];
  if (order.fulfillmentType !== 'delivery' || order.paymentStatus !== 'succeeded' || !allowed.includes(order.status) || order.cancellationStartedAt) return 'This order cannot enter that delivery exception state.';
}
async function record(req, res) {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    const order = await Orders.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    const problem = validateException(order, req.body);
    if (problem) return res.status(409).json({ success: false, message: problem });
    const data = await Orders.findOneAndUpdate({ _id: order._id, status: order.status, paymentStatus: 'succeeded', cancellationStartedAt: { $exists: false } }, {
      $set: { status: req.body.type === 'returned' ? 'returned' : 'delivery_failed', deliveryException: { type: req.body.type, reason: req.body.reason.trim(), reviewedBy: req.user._id, recordedAt: new Date(), reviewRequired: true } },
    }, { new: true, runValidators: true });
    if (!data) return res.status(409).json({ success: false, message: 'Order changed. Reload before reviewing.' });
    return res.json({ success: true, message: 'Exception recorded for staff review. No refund, fee or inventory change was made.', data });
  } catch { return res.status(503).json({ success: false, message: 'Delivery review unavailable.' }); }
}
async function queue(req, res) {
  try { return res.json({ success: true, data: await Orders.find({ $or: [{ 'deliveryException.reviewRequired': true }, { cancellationEffectsPending: true }] }).select('orderNo status paymentStatus total refundStatus cancellationEffectsPending deliveryException createdAt').sort({ createdAt: 1 }).limit(100).lean() }); }
  catch { return res.status(503).json({ success: false, message: 'Order review queue unavailable.' }); }
}
module.exports = { record, queue, validateException };
