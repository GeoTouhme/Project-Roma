const test = require('node:test');
const assert = require('node:assert/strict');
const { pageHarness } = require('./page-harness.cjs');
for (const status of ['pending', 'processing', 'accepted', 'shipped', 'delivered', 'cancelled', 'denied', 'payment_failed', 'disputed', 'refunded', 'ontheway', 'unknown']) {
  test(`Cancel Order eligibility: ${status}`, async () => {
    const calls = [];
    const page = pageHarness('src/pages/OrderDetail.tsx', {
      'react-router-dom': { useParams: () => ({ id: 'order-id' }), useNavigate: () => () => {} },
      '@/lib/api': { ordersAPI: {
        getOrderById: async () => ({ data: { success: true, data: { _id: 'order-id', status, user: {}, items: [] } } }),
        updateOrder: async (...args) => calls.push(args),
      } },
    });
    await page.settle();
    const cancel = page.nodes(n => n.type === 'Button' && n.children.includes('Cancel Order'))[0];
    if (status === 'pending') { assert.equal(cancel, undefined, 'pending orders use accept/deny workflow'); return; }
    assert.ok(cancel);
    const allowed = ['pending', 'processing', 'accepted'].includes(status);
    assert.equal(Boolean(cancel.props.disabled), !allowed);
    if (allowed) { await cancel.props.onClick(); assert.equal(calls[0][1].status, 'cancelled'); }
  });
}
