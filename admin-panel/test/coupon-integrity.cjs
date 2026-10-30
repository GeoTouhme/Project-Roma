const test = require('node:test');
const assert = require('node:assert/strict');
const { pageHarness } = require('./page-harness.cjs');
test('coupon edits explicitly clear restrictions and descriptions rather than omitting them', async () => {
  let saved;
  const coupon = { _id: 'fixture', name: 'Fixture', code: 'FIXTURE', discount: 10, type: 'percent', expire: '2030-01-01T00:00:00Z', maxUses: 5, minOrderAmount: 25, description: 'Old', usedBy: [] };
  const h = pageHarness('src/pages/Coupons.tsx', { '@/lib/api': { couponsAPI: {
    getAll: async () => ({ data: { success: true, data: [coupon] } }),
    update: async (id, payload) => { saved = payload; },
  } } });
  await h.settle();
  h.nodes(n => n.type === 'Button' && n.props['aria-label'] === 'Edit')[0].props.onClick(); h.render();
  for (const id of ['maxUses', 'minOrderAmount', 'description']) {
    const input = h.nodes(n => n.props.id === id && n.props.onChange)[0];
    assert.ok(input, id); input.props.onChange({ target: { value: id === 'description' ? '' : '0' } }); h.render();
  }
  await h.nodes(n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.ok(saved);
  assert.equal(saved.maxUses, 0);
  assert.equal(saved.minOrderAmount, 0);
  assert.equal(saved.description, '');
});
