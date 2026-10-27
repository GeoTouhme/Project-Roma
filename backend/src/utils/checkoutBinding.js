 'use strict';
const crypto = require('crypto');
function checkoutHash(totals, currency) {
  const line = item => ({ id: String(item.pid), quantity: item.quantity,
    price: item.type === 'bundle' ? item.bundlePrice : (item.priceSale || item.price || 0),
    products: (item.products || []).map(p => ({ id: String(p.pid), quantity: p.quantity || 1 })).sort((a,b) => a.id.localeCompare(b.id)) });
  const payload = { amount: totals.expectedAmountCents, currency: currency.toLowerCase(), fulfillment: totals.fulfillmentType,
    items: totals.updatedItems.map(line).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
module.exports = { checkoutHash };
