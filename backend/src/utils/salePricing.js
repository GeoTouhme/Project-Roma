'use strict';

/**
 * salePricing.js — authoritative pricing semantics for Bal-Port Liquors.
 *
 * Data model reality (CSV import): 8,728 of 8,746 products carry `price: null`
 * and store their ONLY price in `priceSale`. A smaller set has a real `price`
 * with an optional lower `priceSale` (a genuine discount) plus an optional
 * `saleEndsAt` flash-sale expiry.
 *
 * Contract:
 *   activeSalePrice(product, now) → the *discount* price when a genuine,
 *     unexpired sale exists (valid regular price, valid lower sale price);
 *     otherwise 0 (there is no discount).
 *   sellingPrice(product, now)    → the price a customer pays: active sale
 *     price if any, else the regular price, else the sale-only price.
 *     Returns null when no valid price exists — callers must treat that as
 *     "not purchasable", never as $0.
 *   hasValidPricing(product, now) → true iff sellingPrice is a finite,
 *     positive number.
 *   normalizePricing(product, now) → display/cart copy with normalized
 *     `priceSale` (effective sale price or effective regular price — never a
 *     spurious 0 that clobbers a valid sale-only price), `discount` percent,
 *     and a `purchasable` flag.
 */

function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// A genuine discount requires BOTH a real regular price and a strictly lower,
// positive sale price. The old implementation returned 0 whenever `price` was
// null — correct (no discount) but consumers then treated priceSale as dead.
function activeSalePrice(product, now = Date.now()) {
  const regular = finitePositive(product?.price);
  const sale = finitePositive(product?.priceSale);
  if (regular === null || sale === null || sale >= regular) return 0;
  const ends = product?.saleEndsAt;
  if (ends) {
    const endsAt = new Date(ends).getTime();
    if (!Number.isFinite(endsAt) || endsAt <= Number(now)) return 0;
  }
  return sale;
}

// The authoritative selling price. null ⇒ unpriced ⇒ not purchasable.
function sellingPrice(product, now = Date.now()) {
  const active = activeSalePrice(product, now);
  if (active > 0) return active;
  return finitePositive(product?.price) ?? finitePositive(product?.priceSale);
}

function hasValidPricing(product, now = Date.now()) {
  return sellingPrice(product, now) !== null;
}

// Display-layer normalization. `priceSale` in the returned object is the
// effective customer-facing price (so cards/carts keep working for sale-only
// CSV products) and `discount` is only non-zero for genuine sales.
function normalizePricing(product, now = Date.now()) {
  const active = activeSalePrice(product, now);
  const effective = sellingPrice(product, now);
  const regular = finitePositive(product?.price);
  const discount = active > 0 && regular !== null
    ? Math.round((1 - active / regular) * 100)
    : 0;
  return {
    ...product,
    priceSale: active > 0 ? active : (effective ?? 0),
    salePrice: active > 0 ? active : (effective ?? 0),
    discount,
    purchasable: effective !== null,
  };
}

module.exports = { activeSalePrice, sellingPrice, hasValidPricing, normalizePricing };