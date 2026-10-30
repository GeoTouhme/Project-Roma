const versions = require('../config/policyVersions.json');
function policyAcceptance(body, now = new Date()) {
  if (body.termsAccepted !== true || body.policyVersions?.terms !== versions.terms || body.policyVersions?.privacy !== versions.privacy || body.policyVersions?.delivery !== versions.delivery) {
    throw Object.assign(new Error('Review and accept the current Terms and Delivery, Refund and Cancellation Policy and acknowledge the Privacy Policy before payment.'), { status: 409 });
  }
  return { versions: { ...versions }, acceptedAt: now, source: 'checkout' };
}
module.exports = { versions, policyAcceptance };
