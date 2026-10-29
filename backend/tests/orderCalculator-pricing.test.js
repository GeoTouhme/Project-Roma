'use strict';
const test = require('node:test'), assert = require('node:assert/strict');

// orderCalculator consumes Mongoose models; we stub the models with the repo's
// established Module/_compile fixture pattern (see tests/checkout-flow.test.js).
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

function makeCalculator({ products, deals = [], mixBundles = [], settings = {} } = {}) {
  const mocks = {
    '../models/Product': {
      find: () => ({
        populate() { return this; },
        then(a, b) { return Promise.resolve(products).then(a, b); },
      }),
    },
    '../models/CouponCode': { findOne: async () => null },
    '../models/Deal': { find: () => ({ lean: async () => deals }) },
    '../models/MixBundle': { find: () => ({ lean: async () => mixBundles }) },
    '../models/settings': { findOneOrCreate: async () => ({ taxRate: 0, markupRate: 0, ...settings }) },
    './mixBundle': { applyMixBundleDeals: async () => 0, productMatchesBundle: () => false },
  };
  const filename = path.resolve(__dirname, '../src/utils/orderCalculator.js');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod);
  mod.require = key => Object.hasOwn(mocks, key) ? mocks[key] : real(key);
  mod._compile('const console={log(){},warn(){},error(){}};\n' + fs.readFileSync(filename, 'utf8'), filename);
  return { calculateOrderTotals: mod.exports.calculateOrderTotals };
}

const PID_CSV = 'b'.repeat(24);        // price: null, priceSale: 23.99 (CSV import shape)
const PID_SALE = 'c'.repeat(24);       // price: 27.99, priceSale: 23.99, future saleEndsAt
const PID_REGULAR = 'd'.repeat(24);    // price: 12.5, no sale
const PID_UNPRICED = 'e'.repeat(24);   // price: null, priceSale: null — must not be purchasable
const PID_EXPIRED = 'f'.repeat(24);    // price: 27.99, priceSale: 23.99, PAST saleEndsAt

const products = [
  { _id: PID_CSV, name: 'CSV Product', sku: '049331002222', status: 'active', available: 10, price: null, priceSale: 23.99, category: null, images: [{ url: '/api/images/x.jpg' }] },
  { _id: PID_SALE, name: 'Sale Product', sku: '081753050207', status: 'active', available: 10, price: 27.99, priceSale: 23.99, saleEndsAt: '2099-01-01T00:00:00Z', category: null, images: [{ url: '/api/images/y.jpg' }] },
  { _id: PID_REGULAR, name: 'Regular Product', sku: '111', status: 'active', available: 10, price: 12.5, priceSale: null, category: null, images: [{ url: '/api/images/z.jpg' }] },
  { _id: PID_UNPRICED, name: 'Unpriced Product', sku: '222', status: 'active', available: 10, price: null, priceSale: null, category: null, images: [] },
  { _id: PID_EXPIRED, name: 'Expired Flash Sale', sku: '333', status: 'active', available: 10, price: 27.99, priceSale: 23.99, saleEndsAt: '2020-01-01T00:00:00Z', category: null, images: [{ url: '/api/images/w.jpg' }] },
];

test('orderCalculator charges the authoritative CSV price (price null, priceSale 23.99)', async () => {
  const { calculateOrderTotals } = makeCalculator({ products });
  const totals = await calculateOrderTotals({ items: [{ pid: PID_CSV, quantity: 2 }] });
  assert.equal(totals.updatedItems[0].total, 47.98);
  assert.equal(totals.grandTotal, 47.98);
});

test('orderCalculator applies the genuine flash-sale price and stamps unitPrice', async () => {
  const { calculateOrderTotals } = makeCalculator({ products });
  const totals = await calculateOrderTotals({ items: [{ pid: PID_SALE, quantity: 1 }] });
  assert.equal(totals.updatedItems[0].total, 23.99);
  assert.equal(totals.updatedItems[0].unitPrice, 23.99);
  assert.equal(totals.grandTotal, 23.99);
});

test('orderCalculator falls back to the regular price when the flash sale is expired', async () => {
  const { calculateOrderTotals } = makeCalculator({ products });
  const totals = await calculateOrderTotals({ items: [{ pid: PID_EXPIRED, quantity: 1 }] });
  assert.equal(totals.updatedItems[0].total, 27.99);
  assert.equal(totals.updatedItems[0].unitPrice, 27.99);
});

test('orderCalculator charges the regular price when only price exists', async () => {
  const { calculateOrderTotals } = makeCalculator({ products });
  const totals = await calculateOrderTotals({ items: [{ pid: PID_REGULAR, quantity: 3 }] });
  assert.equal(totals.updatedItems[0].total, 37.5);
});

test('orderCalculator REJECTS unpriced products — never charges $0', async () => {
  const { calculateOrderTotals } = makeCalculator({ products });
  await assert.rejects(
    () => calculateOrderTotals({ items: [{ pid: PID_UNPRICED, quantity: 1 }] }),
    /missing a valid price|unpriced/i,
  );
});

test('orderCalculator rejects a cart that mixes priced and unpriced products', async () => {
  const { calculateOrderTotals } = makeCalculator({ products });
  await assert.rejects(
    () => calculateOrderTotals({ items: [{ pid: PID_CSV, quantity: 1 }, { pid: PID_UNPRICED, quantity: 1 }] }),
    /missing a valid price|unpriced/i,
  );
});