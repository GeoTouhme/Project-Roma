// salePricing.js — authoritative pricing semantics for Bal-Port Liquors.
//
// Data model reality (CSV import): the overwhelming majority of products carry
// `price: null` and store their ONLY price in `priceSale`. A smaller set has a
// real `price` with an optional lower `priceSale` (a genuine discount) plus an
// optional `saleEndsAt` flash-sale expiry.
//
// Contract (mirrors backend/src/utils/salePricing.js — keep both in sync):
//   activeSalePrice(product, now) → discount price when a genuine, unexpired
//     sale exists; otherwise 0 (no discount).
//   sellingPrice(product, now)   → the price a customer pays: active sale
//     price, else regular price, else sale-only price. null ⇒ unpriced ⇒ not
//     purchasable — NEVER render or charge $0 for it.
//   hasValidPricing(product, now) → sellingPrice is a finite positive number.
//   normalizePricing(product, now) → display/cart copy where `priceSale` is
//     the effective customer-facing price (a valid sale-only price is never
//     overwritten with 0), `discount` is the genuine discount percent, and
//     `purchasable` gates the add-to-cart affordance.

function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

function sellingPrice(product, now = Date.now()) {
  const active = activeSalePrice(product, now);
  if (active > 0) return active;
  return finitePositive(product?.price) ?? finitePositive(product?.priceSale);
}

function hasValidPricing(product, now = Date.now()) {
  return sellingPrice(product, now) !== null;
}

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

export { activeSalePrice, sellingPrice, hasValidPricing, normalizePricing };