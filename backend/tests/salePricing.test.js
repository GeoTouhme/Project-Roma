'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { activeSalePrice, sellingPrice, normalizePricing, hasValidPricing } = require('../src/utils/salePricing');

// Reference instant: everything below is evaluated relative to this fixed `now`
// so the tests are deterministic regardless of wall-clock time.
const NOW = Date.parse('2026-10-29T12:00:00Z');
const FUTURE = '2026-10-30T12:00:00Z';
const PAST = '2026-10-28T12:00:00Z';

test('CSV semantics: null price + valid priceSale → priceSale is the selling price', () => {
  assert.equal(activeSalePrice({ price: null, priceSale: 23.99 }, NOW), 0); // no discount — priceSale is the *only* price
  assert.equal(sellingPrice({ price: null, priceSale: 23.99 }, NOW), 23.99);
  assert.equal(hasValidPricing({ price: null, priceSale: 23.99 }, NOW), true);
});

test('CSV semantics: missing price field + valid priceSale → priceSale sells', () => {
  assert.equal(sellingPrice({ priceSale: 6.99 }, NOW), 6.99);
  assert.equal(activeSalePrice({ priceSale: 6.99 }, NOW), 0);
});

test('activeSalePrice: real sale (both prices, priceSale < price, unexpired) → discount price', () => {
  assert.equal(activeSalePrice({ price: 27.99, priceSale: 23.99 }, NOW), 23.99);
  assert.equal(sellingPrice({ price: 27.99, priceSale: 23.99 }, NOW), 23.99);
});

test('activeSalePrice respects saleEndsAt: future → active, past/equal → expired, invalid → fail closed', () => {
  assert.equal(activeSalePrice({ price: 27.99, priceSale: 23.99, saleEndsAt: FUTURE }, NOW), 23.99);
  assert.equal(activeSalePrice({ price: 27.99, priceSale: 23.99, saleEndsAt: PAST }, NOW), 0);
  assert.equal(activeSalePrice({ price: 27.99, priceSale: 23.99, saleEndsAt: NOW }, NOW), 0); // boundary: ends-at == now is expired
  assert.equal(activeSalePrice({ price: 27.99, priceSale: 23.99, saleEndsAt: 'invalid' }, NOW), 0);
  // Expired flash sale falls back to the regular price — never $0
  assert.equal(sellingPrice({ price: 27.99, priceSale: 23.99, saleEndsAt: PAST }, NOW), 27.99);
});

test('activeSalePrice: not a sale when priceSale >= price, <= 0, or missing', () => {
  for (const sale of [-1, 0, 27.99, 30]) assert.equal(activeSalePrice({ price: 27.99, priceSale: sale }, NOW), 0);
  // sale >= regular means "not discounted" — selling price stays the regular price
  assert.equal(sellingPrice({ price: 27.99, priceSale: 30 }, NOW), 27.99);
  assert.equal(sellingPrice({ price: 27.99, priceSale: 0 }, NOW), 27.99);
});

test('only regular price → regular price is the selling price', () => {
  assert.equal(sellingPrice({ price: 12.5 }, NOW), 12.5);
  assert.equal(sellingPrice({ price: 12.5, priceSale: null }, NOW), 12.5);
  assert.equal(hasValidPricing({ price: 12.5, priceSale: null }, NOW), true);
});

test('invalid pricing never yields a purchasable $0', () => {
  for (const p of [
    { price: null, priceSale: null },
    { price: null, priceSale: 0 },
    { price: 0, priceSale: 0 },
    {},
    { price: 'abc', priceSale: 'xyz' },
    { price: NaN, priceSale: NaN },
    { price: -5, priceSale: -3 },
    { price: null, priceSale: -3 },
  ]) {
    assert.equal(sellingPrice(p, NOW), null, JSON.stringify(p));
    assert.equal(hasValidPricing(p, NOW), false, JSON.stringify(p));
  }
});

test('non-finite numbers are rejected; numeric coercion is uniform (JSON round-trip safety)', () => {
  assert.equal(sellingPrice({ price: Infinity, priceSale: 1 }, NOW), 1); // invalid regular + valid sale-only price = CSV pattern → 1 sells
  assert.equal(sellingPrice({ price: 10, priceSale: Infinity }, NOW), 10); // sale invalid → regular
  assert.equal(sellingPrice({ price: '10', priceSale: '8' }, NOW), 8); // numeric strings behave exactly like numbers
  assert.equal(activeSalePrice({ price: '10', priceSale: '8' }, NOW), 8);
  assert.equal(sellingPrice({ price: 'abc', priceSale: null }, NOW), null); // garbage is still not purchasable
});

test('normalizePricing preserves CSV priceSale (never overwrites with 0) and computes discount only for real sales', () => {
  // CSV product: null regular, sale-only price. priceSale MUST survive normalization.
  const csv = normalizePricing({ name: 'LA CREMA', price: null, priceSale: 23.99 }, NOW);
  assert.equal(csv.priceSale, 23.99);
  assert.equal(csv.salePrice, 23.99);
  assert.equal(csv.discount, 0);
  assert.equal(csv.purchasable, true);

  // Real sale: discount % computed from regular vs sale.
  const sale = normalizePricing({ price: 27.99, priceSale: 23.99, saleEndsAt: FUTURE }, NOW);
  assert.equal(sale.priceSale, 23.99);
  assert.equal(sale.discount, 14); // (1 - 23.99/27.99) * 100 ≈ 14

  // Expired sale: discount removed, priceSale falls back to regular price semantics.
  const expired = normalizePricing({ price: 27.99, priceSale: 23.99, saleEndsAt: PAST }, NOW);
  assert.equal(expired.priceSale, 27.99);
  assert.equal(expired.discount, 0);
  assert.equal(expired.purchasable, true);

  // Unpriced product: priceSale 0/null, not purchasable — never $0.
  const unpriced = normalizePricing({ price: null, priceSale: null }, NOW);
  assert.equal(unpriced.priceSale, 0);
  assert.equal(unpriced.purchasable, false);
});

test('normalizePricing is idempotent through its own output contract', () => {
  const once = normalizePricing({ price: null, priceSale: 23.99 }, NOW);
  const twice = normalizePricing(once, NOW);
  assert.equal(twice.priceSale, 23.99);
  assert.equal(twice.salePrice, 23.99);
  assert.equal(twice.purchasable, true);
});

test('backend original contract: activeSalePrice keeps flash-sale gating semantics for real sales', () => {
  // These mirror the existing p1-p2-controls.test.js expectations (valid sale shape).
  assert.equal(activeSalePrice({ price: 10, priceSale: 8, saleEndsAt: '2026-10-30' }, NOW), 8);
  assert.equal(activeSalePrice({ price: 10, priceSale: 8 }, NOW), 8);
  for (const sale of [-1, 0, 10, 11]) assert.equal(activeSalePrice({ price: 10, priceSale: sale }, NOW), 0);
  for (const saleEndsAt of ['2026-10-28', 'invalid', '2026-10-29T12:00:00Z']) assert.equal(activeSalePrice({ price: 10, priceSale: 8, saleEndsAt }, NOW), 0);
});