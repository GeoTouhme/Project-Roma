const test = require('node:test');
const assert = require('node:assert/strict');
const { pageHarness } = require('./page-harness.cjs');

test('deal product picker shows products returned with the actual singular image API contract', async () => {
  const h = pageHarness('src/pages/Deals.tsx', { '@/lib/api': {
    dealsAPI: { getAll: async () => ({ data: { success: true, data: [] } }) },
    productsAPI: { getProducts: async () => ({ data: { success: true, data: [{ _id: 'fixture', name: 'Fixture Drink', image: { url: '/api/images/fixture.jpg' } }] } }) },
  } });
  await h.settle();
  assert.equal(h.nodes(n => n.type === 'img' && n.props.alt === 'Fixture Drink').length, 1);
});

test('deal picker search matches name or UPC/sku and shows placeholder-image products', async () => {
  const calls = [];
  const h = pageHarness('src/pages/Deals.tsx', { '@/lib/api': {
    dealsAPI: { getAll: async () => ({ data: { success: true, data: [] } }) },
    productsAPI: { getProducts: async (params) => { calls.push(params); return { data: { success: true, data: [
      { _id: 'p1', name: 'CORONA EXTRA 12PK', sku: '0012345678901', image: { url: 'https://via.placeholder.com/600.png' } },
      { _id: 'p2', name: 'Modelo Especial', sku: '0074999912345', image: { url: 'https://res.cloudinary.com/x/p2.jpg' } },
    ] } }; } },
  } });
  await h.settle();
  // Initial load: both products must render even though p1 has only a placeholder image.
  assert.equal(h.nodes(n => n.type === 'img').length, 2, 'placeholder-image products must be visible for picking');
  // Typing a search sends it to the API and shows matching results.
  const input = h.nodes(n => n.type !== 'img' && n.props.placeholder === 'Search products by name or UPC...')[0];
  input.props.onChange({ target: { value: 'corona' } });
  await h.settle();
  const lastCall = calls.at(-1);
  assert.equal(lastCall.search, 'corona');
  assert.ok(h.nodes(n => n.type === 'span' && n.children.includes('CORONA EXTRA 12PK')).length >= 1, 'searched product name must be displayed');
  // UPC search input is sent through unchanged.
  input.props.onChange({ target: { value: '0012345678901' } });
  await h.settle();
  assert.equal(calls.at(-1).search, '0012345678901');
});