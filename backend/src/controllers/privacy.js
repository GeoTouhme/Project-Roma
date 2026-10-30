const Requests = require('../models/PrivacyRequest');
const { exportAccount, retentionReport } = require('../services/privacyOperations');
const openStates = ['submitted', 'reviewing', 'needs_information', 'held'];
const types = ['access', 'delete', 'correct', 'opt_out'];
function unavailable(res, error) { return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Privacy operations are temporarily unavailable.' }); }
async function submit(req, res) {
  try {
    if (!types.includes(req.body.type)) return res.status(400).json({ success: false, message: 'Choose a valid privacy request type.' });
    let data = await Requests.findOne({ owner: req.user._id, type: req.body.type, status: { $in: openStates } });
    if (!data) { try { data = await Requests.create({ owner: req.user._id, type: req.body.type }); }
      catch (error) { if (error.code !== 11000) throw error; data = await Requests.findOne({ owner: req.user._id, type: req.body.type, status: { $in: openStates } }); } }
    return res.status(202).json({ success: true, data, message: 'Request received for staff review. No data has been deleted.' });
  } catch (error) { return unavailable(res, error); }
}
async function listOwn(req, res) {
  try { return res.json({ success: true, data: await Requests.find({ owner: req.user._id }).sort({ createdAt: -1 }).limit(100).lean() }); }
  catch (error) { return unavailable(res, error); }
}
async function exportOwn(req, res) {
  try { const data = await exportAccount(req.user._id); res.set('Cache-Control', 'private, no-store').set('Content-Disposition', 'attachment; filename="balport-account-export.json"'); return res.json(data); }
  catch (error) { return unavailable(res, error); }
}
async function listAdmin(req, res) {
  try { const page = Math.max(1, Math.min(10000, parseInt(req.query.page) || 1));
    return res.json({ success: true, data: await Requests.find().select('+staffNote +resolutionEvidence').sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).lean(), page, count: await Requests.countDocuments() }); }
  catch (error) { return unavailable(res, error); }
}
function validateReview(body, request) {
  if (!['reviewing', 'needs_information', 'held', 'resolved', 'declined'].includes(body.status)
    || typeof body.legalHold !== 'boolean' || typeof body.response !== 'string' || body.response.length > 2000
    || typeof body.staffNote !== 'string' || body.staffNote.length > 2000) return 'Invalid review fields.';
  if (body.status === 'resolved' && (body.legalHold || request.type === 'delete')) return 'Deletion completion is disabled until an approved erasure and backup procedure is implemented; retain this request for review.';
  if (['resolved', 'declined'].includes(body.status) && (!body.response.trim() || typeof body.resolutionEvidence !== 'string' || !body.resolutionEvidence.trim() || body.resolutionEvidence.length > 500)) return 'A customer response and evidence reference are required to close a request.';
}
async function review(req, res) {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid request ID.' });
    const data = await Requests.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Request not found.' });
    const problem = validateReview(req.body, data);
    if (problem) return res.status(409).json({ success: false, message: problem });
    Object.assign(data, { status: req.body.status, legalHold: req.body.legalHold, staffNote: req.body.staffNote.trim(), response: req.body.response.trim(),
      resolutionEvidence: ['resolved', 'declined'].includes(req.body.status) ? req.body.resolutionEvidence.trim() : undefined,
      reviewedBy: req.user._id, reviewedAt: new Date() });
    const changed = await Requests.findOneAndUpdate({ _id: data._id, updatedAt: data.updatedAt }, {
      $set: { status: data.status, legalHold: data.legalHold, staffNote: data.staffNote, response: data.response, resolutionEvidence: data.resolutionEvidence, reviewedBy: data.reviewedBy, reviewedAt: data.reviewedAt },
      $push: { reviewHistory: { status: data.status, legalHold: data.legalHold, reviewedBy: data.reviewedBy, reviewedAt: data.reviewedAt } },
    }, { new: true, runValidators: true });
    if (!changed) return res.status(409).json({ success: false, message: 'Request changed; reload before saving.' });
    return res.json({ success: true, data: changed });
  } catch (error) { return unavailable(res, error); }
}
async function retention(req, res) { try { return res.json({ success: true, data: await retentionReport() }); } catch (error) { return unavailable(res, error); } }
module.exports = { submit, listOwn, exportOwn, listAdmin, review, retention, validateReview };
