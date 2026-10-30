'use strict';
const Checkouts = require('../models/Checkout');
const { recoverCheckout } = require('../services/checkoutRecovery');
let running = false;
async function runCheckoutRecovery() {
  if (running) return;
  running = true;
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const work = await Checkouts.find({ version: 2, paymentId: { $exists: true },
      recoveryState: { $in: ['payment_pending', 'refund_pending'] },
      $or: [{ recoveryCheckedAt: { $exists: false } }, { recoveryCheckedAt: { $lt: cutoff } }],
    }).select('_id owner').sort({ recoveryCheckedAt: 1, createdAt: 1 }).limit(20).lean();
    for (const checkout of work) {
      try { await recoverCheckout({ checkoutId: String(checkout._id), ownerId: checkout.owner }); }
      catch { console.error('Checkout recovery retry deferred. Review the reconciliation queue if the issue persists.'); }
    }
  } finally { running = false; }
}
function startCheckoutRecovery() {
  if (process.env.NODE_ENV !== 'production') return;
  const timer = setInterval(() => runCheckoutRecovery().catch(() => console.error('Checkout recovery scan unavailable.')), 60000);
  timer.unref();
  return timer;
}
module.exports = { runCheckoutRecovery, startCheckoutRecovery };
