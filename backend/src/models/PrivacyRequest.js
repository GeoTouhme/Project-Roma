const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, enum: ['access', 'delete', 'correct', 'opt_out'], required: true },
  status: { type: String, enum: ['submitted', 'reviewing', 'needs_information', 'held', 'resolved', 'declined'], default: 'submitted' },
  // Staff notes are internal; the customer sees only the separate response.
  staffNote: { type: String, maxlength: 2000, select: false },
  response: { type: String, maxlength: 2000 },
  reviewedBy: mongoose.Schema.Types.ObjectId, reviewedAt: Date,
  legalHold: { type: Boolean, default: false },
  reviewHistory: { type: [{ status: String, legalHold: Boolean, reviewedBy: mongoose.Schema.Types.ObjectId, reviewedAt: Date }], select: false },
  resolutionEvidence: { type: String, maxlength: 500, select: false },
}, { timestamps: true });
schema.index({ owner: 1, type: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['submitted', 'reviewing', 'needs_information', 'held'] } } });
module.exports = mongoose.models.PrivacyRequest || mongoose.model('PrivacyRequest', schema);
