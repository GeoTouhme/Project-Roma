const test = require('node:test');
const assert = require('node:assert/strict');
const { pageHarness } = require('./page-harness.cjs');
function ordersPage(rows = []) {
  const requests = [];
  const page = pageHarness('src/pages/Orders.tsx', { '@/lib/api': { ordersAPI: {
    getOrders: async params => { requests.push(params); return { data: { success: true, data: rows, total: 45 } }; },
  } } });
  return { page, requests };
}
test('changing status resets pagination before requesting the backend-filtered page', async () => {
  const { page, requests } = ordersPage(); await page.settle();
  page.nodes(n => typeof n.props.onPageChange === 'function')[0].props.onPageChange(4); await page.settle();
  assert.equal(requests.at(-1).page, 4);
  page.nodes(n => n.type === 'Select')[0].props.onValueChange('pending'); await page.settle();
  assert.equal(requests.at(-1).status, 'pending');
  assert.equal(requests.at(-1).page, 1);
});
test('Orders renders server results and totals without after-pagination filtering', async () => {
  const rows = [{ _id: 'server-row', status: 'processing', fulfillmentType: 'delivery' }];
  const { page } = ordersPage(rows); await page.settle();
  page.nodes(n => n.type === 'Select')[0].props.onValueChange('pending'); await page.settle();
  const table = page.nodes(n => n.type === 'Table')[0];
  assert.equal(table.props.data, rows, 'server response must be authoritative, not filtered after pagination');
});
for (const control of ['search', 'pageSize']) test(`changing ${control} resets to first page`, async () => {
  const { page, requests } = ordersPage(); await page.settle();
  page.nodes(n => typeof n.props.onPageChange === 'function')[0].props.onPageChange(4); await page.settle();
  if (control === 'search') page.nodes(n => n.type === 'SearchBar')[0].props.onSearch('customer');
  else page.nodes(n => typeof n.props.onPageSizeChange === 'function')[0].props.onPageSizeChange(20);
  await page.settle();
  assert.equal(requests.at(-1).page, 1);
});
