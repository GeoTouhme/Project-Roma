const test = require('node:test');
const assert = require('node:assert/strict');
const { pageHarness } = require('./page-harness.cjs');
for (const actorRole of ['admin', 'super admin']) {
  test(`${actorRole} customer edits submit only authorized role fields`, async () => {
    let payload;
    const h = pageHarness('src/pages/CustomerForm.tsx', {
      'react-router-dom': { useParams: () => ({ id: 'fixture-user' }), useNavigate: () => () => {} },
      '@/context/AuthContext': { useAuth: () => ({ user: { role: actorRole } }) },
      '@/lib/api': { customersAPI: {
        getCustomerById: async () => ({ data: { success: true, user: { firstName: 'Fixture', lastName: 'Customer', email: 'fixture@example.invalid', role: 'user' } } }),
        updateCustomer: async (id, data) => { payload = data; },
      } },
    });
    await h.settle();
    const save = h.nodes(n => n.type === 'Button' && n.children.some(c => typeof c === 'string' && c.includes('Save Customer')))[0];
    assert.ok(save); await save.props.onClick();
    assert.ok(payload);
    assert.equal(payload.role, actorRole === 'super admin' ? 'user' : undefined);
  });
}
