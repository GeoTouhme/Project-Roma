import { activeSalePrice, sellingPrice, hasValidPricing, normalizePricing } from "./salePricing";

const NOW = Date.parse("2026-10-29T12:00:00Z");
const FUTURE = "2026-10-30T12:00:00Z";
const PAST = "2026-10-28T12:00:00Z";

describe("salePricing — CSV semantics (null price, valid priceSale)", () => {
  test("priceSale is the selling price when price is null", () => {
    expect(sellingPrice({ price: null, priceSale: 23.99 }, NOW)).toBe(23.99);
    expect(hasValidPricing({ price: null, priceSale: 23.99 }, NOW)).toBe(true);
  });

  test("priceSale is the selling price when price is missing entirely", () => {
    expect(sellingPrice({ priceSale: 6.99 }, NOW)).toBe(6.99);
    expect(activeSalePrice({ priceSale: 6.99 }, NOW)).toBe(0); // no discount, just the price
  });

  test("normalizePricing preserves CSV priceSale — never overwrites it with 0", () => {
    const out = normalizePricing({ price: null, priceSale: 23.99 }, NOW);
    expect(out.priceSale).toBe(23.99);
    expect(out.salePrice).toBe(23.99);
    expect(out.discount).toBe(0);
    expect(out.purchasable).toBe(true);
  });

  test("normalizePricing is idempotent for CSV products", () => {
    const once = normalizePricing({ price: null, priceSale: 23.99 }, NOW);
    expect(normalizePricing(once, NOW).priceSale).toBe(23.99);
  });
});

describe("salePricing — genuine sales", () => {
  test("both prices, priceSale < price, unexpired → discounted price", () => {
    expect(activeSalePrice({ price: 27.99, priceSale: 23.99, saleEndsAt: FUTURE }, NOW)).toBe(23.99);
    expect(sellingPrice({ price: 27.99, priceSale: 23.99, saleEndsAt: FUTURE }, NOW)).toBe(23.99);
  });

  test("no saleEndsAt means the sale never expires", () => {
    expect(activeSalePrice({ price: 27.99, priceSale: 23.99 }, NOW)).toBe(23.99);
  });

  test("expired flash sale falls back to the regular price — never $0", () => {
    expect(activeSalePrice({ price: 27.99, priceSale: 23.99, saleEndsAt: PAST }, NOW)).toBe(0);
    expect(sellingPrice({ price: 27.99, priceSale: 23.99, saleEndsAt: PAST }, NOW)).toBe(27.99);
    const out = normalizePricing({ price: 27.99, priceSale: 23.99, saleEndsAt: PAST }, NOW);
    expect(out.priceSale).toBe(27.99); // effective price after expiry
    expect(out.discount).toBe(0);
  });

  test("equal or higher sale price is not a discount", () => {
    expect(activeSalePrice({ price: 27.99, priceSale: 27.99 }, NOW)).toBe(0);
    expect(activeSalePrice({ price: 27.99, priceSale: 30 }, NOW)).toBe(0);
    expect(sellingPrice({ price: 27.99, priceSale: 30 }, NOW)).toBe(27.99);
  });

  test("discount percent is computed only for genuine sales", () => {
    expect(normalizePricing({ price: 27.99, priceSale: 23.99, saleEndsAt: FUTURE }, NOW).discount).toBe(14);
    expect(normalizePricing({ price: null, priceSale: 23.99 }, NOW).discount).toBe(0);
  });
});

describe("salePricing — regular prices", () => {
  test("only price exists → price is the selling price", () => {
    expect(sellingPrice({ price: 12.5 }, NOW)).toBe(12.5);
    expect(sellingPrice({ price: 12.5, priceSale: null }, NOW)).toBe(12.5);
    expect(normalizePricing({ price: 12.5, priceSale: null }, NOW).priceSale).toBe(12.5);
  });
});

describe("salePricing — invalid pricing never renders $0", () => {
  test.each([
    [{ price: null, priceSale: null }],
    [{ price: null, priceSale: 0 }],
    [{ price: 0, priceSale: 0 }],
    [{}],
    [{ price: "abc", priceSale: "xyz" }],
    [{ price: -5, priceSale: -3 }],
  ])("unpriced shape %j is not purchasable", (product) => {
    expect(sellingPrice(product, NOW)).toBeNull();
    expect(hasValidPricing(product, NOW)).toBe(false);
    const out = normalizePricing(product, NOW);
    expect(out.purchasable).toBe(false);
    expect(out.discount).toBe(0);
  });
});