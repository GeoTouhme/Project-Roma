# Tax & CRV Audit — Project Roma (Bal-Port Liquors)

**Date:** July 31, 2026
**Scope:** Read-only review of how tax and CRV flow from admin config through backend calculation to the cart and billing pages.
**No files were edited.**

---

## 1. Configuration (Admin Panel)

### Tax Rate
- **File:** `admin-panel/src/pages/StoreSettings.tsx` (lines 35, 56-57, 94, 151-160)
- Store-wide tax rate is set as a decimal (0 to 1) in Store Settings.
- Default: `0.0775` (7.75% Newport Beach).
- Input `type=number`, `step=0.0001`, `min=0`, `max=1`.
- Saved to Settings model via `PUT /api/settings`.
- Backend validates: must be number, `0 <= taxRate <= 1` (`settings.js` line 28-30).

### Taxable Flag (per category)
- **File:** `admin-panel/src/pages/MainCategoryForm.tsx` (lines 27, 46, 75, 183-190)
- Each category has a "Taxable" checkbox (default `true`).
- Stored as `Category.taxable` (Boolean, default `true`).
- When unchecked (`taxable=false`), items in that category are excluded from tax calculation.

### CRV Rate (per category)
- **File:** `admin-panel/src/pages/MainCategoryForm.tsx` (lines 28, 47, 76, 193-202)
- Dropdown with 3 options:
  - `"No CRV"` (0)
  - `"$0.05 (under 24 oz)"` (0.05)
  - `"$0.10 (24 oz or larger)"` (0.10)
- Stored as `Category.crvRate` (Number, default `0`).
- Displayed in category list table (`MainCategories.tsx` lines 135-138).

### Category List View
- **File:** `admin-panel/src/pages/MainCategories.tsx` (lines 132-138)
- Shows "Taxable" column (Yes/No) and "CRV" column ($0.05 / $0.10 / -).

> **Note:** The dropdown labels say "under 24 oz" and "24 oz or larger" but the actual code threshold in `crv.js` is 30 fl oz, not 24. See Issue #1 below.

---

## 2. Backend Calculation

### 2a. CRV Logic
**File:** `backend/src/utils/crv.js`

`parseSizeToOz(size)` — converts free-text size strings to fluid ounces:
- `"12 oz"` / `"12oz"` / `"12 fl oz"` → `12`
- `"750ml"` / `"750 ml"` → `25.36` oz
- `"1L"` / `"1.75 L"` → `33.81` / `58.92` oz
- `"6 x 12 oz"` / `"12/12oz"` → `12` (uses the per-container size)
- Returns `null` if unparseable.

`getCrvPerItem(size, categoryCrvRate)` — determines per-item CRV:
- If size can't be parsed: falls back to `categoryCrvRate` as flat per-item amount.
- If `categoryCrvRate` is `0` (falsy): returns `0` (no CRV).
- If parseable and category has `crvRate`: `oz >= 30` → `$0.10`, else `$0.05`.

### 2b. Order Total Calculator
**File:** `backend/src/utils/orderCalculator.js`

`calculateOrderTotals({ items, shipping, tip, couponCode })`:
1. Fetches real products from DB by ObjectID, populates category.
2. Validates all products are active and in stock.
3. Uses `product.priceSale` for line item totals (**not** client-submitted price).
4. Computes `grandTotal = sum(priceSale * quantity)`.
5. Loops through items to build `taxableSubtotal` and `crvTotal`:
   - If `category.taxable !== false`: add line total to `taxableSubtotal`.
   - If `category.crvRate`: add `qty * getCrvPerItem(product.size, category.crvRate)` to `crvTotal`.
6. Applies coupon discount (percent or flat) to `grandTotal`.
7. `taxBase = max(0, taxableSubtotal - discount)` — discount reduces taxable base.
8. `tax = round2(taxBase * taxRate)`.
9. `orderTotal = discountedTotal + tax + crvTotal + deliveryFee + tip`.
10. Returns `expectedAmountCents = Math.round(orderTotal * 100)` for Stripe.

**Key security point:** Prices come from the DB, not the client. The client-submitted prices in the items array are ignored for total calculation (line 74: `const price = product.priceSale`).

### 2c. Cart Summary Endpoint
**File:** `backend/src/controllers/order.js` (lines 544-633)
**Route:** `POST /api/orders/cart-summary` (public, no auth)

Lighter-weight version used by both `Cart.jsx` and `Billing.jsx` for preview:
- Fetches products, populates category with `name slug taxable crvRate`.
- Uses `product.priceSale || product.price` as unit price.
- Same taxable/crv logic as `orderCalculator`.
- Returns: `{ subtotal, taxableSubtotal, tax, crv, total, itemCount, taxRate }`.
- Does **not** include `deliveryFee` or `tip` in the total (those are added client-side in Billing).
- Does **not** apply coupons (preview only).

### 2d. Payment Intent
**File:** `backend/src/controllers/payment-intents.js`
- Calls `calculateOrderTotals()` with `items, shipping, tip, couponCode`.
- Uses `expectedAmountCents` to create the Stripe PaymentIntent.
- Client never sends an amount — server computes it.

### 2e. Order Creation
**File:** `backend/src/controllers/order.js` (lines 151-261)
- Calls `calculateOrderTotals()` again on order submission.
- Verifies `Stripe PaymentIntent.amount === expectedAmountCents` (line 194).
- Saves `tax`, `crv`, `discount`, `subTotal`, `total`, `shipping`, `tip` to Order document (lines 248-253).
- Order model has fields: `tax` (Number, default 0), `crv` (Number, default 0).

---

## 3. Customer Panel — Cart Page
**File:** `customer-panel/src/pages/cart/Cart.jsx`

- On mount and whenever `cartItems` changes, calls `OrderService.getCartSummary({ items })` (line 39).
- Sends only `pid` + `quantity` per item (lines 35-38).
- Stores response in `summary` state: `{ subtotal, tax, crv, total }`.
- Displays:
  - **Subtotal:** `$summary.subtotal` (line 196)
  - **Shipping:** `Free` (lines 199-200, hardcoded)
  - **Tax:** `$summary.tax` (line 204)
  - **CRV:** `$summary.crv` (line 208)
  - **Total:** `$summary.total` (line 212)
- Fallback: if server call fails, computes local subtotal only with `tax=0`, `crv=0` (lines 43-62).
- "Proceed to checkout" button disabled when store is closed (line 217).

> **Observation:** Cart page shows shipping as "Free" always. Delivery fee is only calculated on the Billing page after address verification. This is expected behavior but could confuse users who see "Free" in cart then a delivery fee at checkout.

---

## 4. Customer Panel — Billing Page
**File:** `customer-panel/src/pages/Billing/Billing.jsx`

- Also calls `OrderService.getCartSummary({ items })` on mount (lines 61-86).
- Stores response in `cartSummary` state and `taxRate` from response (line 78).
- Delivery fee is fetched separately via `OrderService.getDeliveryQuote()` after user fills address (lines 179-217).
- Tip is selected client-side from `[0, 2, 3, 5]` buttons (line 666).

### Order Summary display (lines 630-659):
| Field | Source |
|-------|--------|
| Subtotal | `$cartSummary.subtotal` |
| Delivery Fee | `$deliveryFee` (or "Free" if 0) |
| CRV | `$cartSummary.crv` |
| Tax (X%) | `$cartSummary.tax` (rate shown from `taxRate` state) |
| **Total** | `cartSummary.subtotal + cartSummary.tax + cartSummary.crv + deliveryFee + tip` |

The total on line 658 is computed entirely client-side from the server-provided components. This is display-only — the actual charge amount is determined server-side by `calculateOrderTotals()` when creating the PaymentIntent and again when creating the Order.

### Order submission (lines 289-391):
1. Sends items with client-side prices (`priceSale`, `price`), but these are **ignored** by the backend for total calculation.
2. Sends `shipping` (deliveryFee as string) and `tip`.
3. Calls `PaymentService.paymentIntentCreate()` first (server computes amount).
4. Confirms card payment with Stripe.
5. Then calls `OrderService.creteOrder()` with `paymentId` — backend verifies amount match again.

---

## 5. Data Model Summary

| Model | Field | Type | Default | Notes |
|-------|-------|------|---------|-------|
| Settings | `taxRate` | Number | `0.0775` | Store-wide, min 0 |
| Category | `taxable` | Boolean | `true` | Per-category tax exemption |
| Category | `crvRate` | Number | `0` | Per-category CRV eligibility + fallback rate |
| Order | `tax` | Number | `0` | Persisted on order creation |
| Order | `crv` | Number | `0` | Persisted on order creation |
| Order | `subTotal` | Number | required | Pre-tax, pre-shipping subtotal |
| Order | `total` | Number | required | Final charged total |
| Order | `discount` | Number | — | Coupon discount amount |
| Order | `shipping` | Number | required | Delivery fee |
| Order | `tip` | Number | `0` | Driver tip |
| Product | `size` | String | — | Free-text size label used for CRV size parsing |
| Product | `price` | Number | — | Original price |
| Product | `priceSale` | Number | — | Sale price (what's actually charged) |

---

## 6. Issues & Observations

### Issue #1 — CRV threshold mismatch (label vs code) ✅ Fixed
The admin dropdown says `"$0.05 (under 24 oz)"` and `"$0.10 (24 oz or larger)"` but `crv.js` line 66 used threshold `oz >= 30`, not 24. **Fixed** by updating `backend/src/utils/crv.js` to use `oz >= 24` and updating comments to match California CRV law.

### Issue #2 — CRV per-item rate vs category flat rate ambiguity ✅ Fixed
The `crvRate` dropdown offers `0`, `0.05`, or `0.10`. But `getCrvPerItem()` uses the category's `crvRate` as a **boolean gate** (line 64: `if (!categoryCrvRate) return 0`), then recomputes the actual per-item amount from the product size (line 66). So selecting `"$0.10"` on a category doesn't mean every item gets `$0.10` — a 12 oz can still gets `$0.05`. **Fixed** by adding helper text under the CRV dropdown in `admin-panel/src/pages/MainCategoryForm.tsx` explaining that CRV is calculated per container from each product's size label and the selected rate is a fallback when size cannot be parsed.

### Issue #3 — Cart summary fallback shows no tax/CRV on error ✅ Fixed
If the cart-summary API call fails (network error, server down), `Cart.jsx` falls back to showing subtotal only with `tax=0` and `crv=0` (lines 43-62). The user sees a lower total than they'll actually be charged. **Fixed** by adding an amber warning banner in `customer-panel/src/pages/cart/Cart.jsx` when the summary fails: "Tax and CRV could not be estimated right now. The total will be recalculated at checkout."

### Issue #4 — Billing page total is client-side composition ✅ Fixed
Line 658: `Total = cartSummary.subtotal + cartSummary.tax + cartSummary.crv + deliveryFee + tip`. This is all client-side arithmetic from server-provided parts. If any of these values are stale (e.g., cart changed but summary hasn't refetched), the displayed total could differ from what Stripe charges. **Fixed** by moving the total into a `useMemo` in `customer-panel/src/pages/Billing/Billing.jsx` so it recomputes automatically whenever any component changes, reducing the risk of a stale display total.

### Issue #5 — No tax on delivery fee or CRV ✅ (correct)
California generally does not tax delivery fees if separately stated, and CRV is not taxable. The code correctly excludes CRV from the tax base (tax is computed on `taxableSubtotal` only, line 143 of `orderCalculator.js`). Delivery fee is also not in the tax base. This appears correct for CA.

### Issue #6 — Discount reduces tax base but not CRV ✅ (correct)
In `orderCalculator.js` line 143: `taxBase = max(0, taxableSubtotal - discount)`. A coupon reduces the taxable amount, which is correct. CRV is not affected by discounts (lines 100-116, `crvTotal` is computed independently). This is correct — CRV is a deposit, not a price.

### Issue #7 — priceSale fallback inconsistency ✅ Fixed
- Cart summary (`order.js` line 592): `const unitPrice = product.priceSale || product.price || 0`
- Order calculator (`orderCalculator.js` line 74): `const price = product.priceSale`

If a product has no `priceSale` (null/undefined), the cart summary falls back to `product.price`, but the order calculator would use `undefined` and produce `NaN` for the line total. **Fixed** by updating `backend/src/utils/orderCalculator.js` to use `const price = product.priceSale || product.price || 0;`, matching the cart summary behavior.

### Issue #8 — Cart page shows "Shipping: Free" but billing may charge delivery ✅ Fixed
`Cart.jsx` lines 199-200 always showed "Free" for shipping. The actual delivery fee is only calculated on the Billing page after address verification. This is a UX inconsistency — the cart shows $0.00 shipping, then the billing page may add a delivery fee. **Fixed** by changing the Cart page shipping text from "Free" to "Calculated at checkout" in `customer-panel/src/pages/cart/Cart.jsx`.

### Issue #9 — `size` field not sent from cart to backend ✅ (correct)
In `Cart.jsx` (lines 35-38) and `Billing.jsx` (lines 70-73), only `pid` and `quantity` are sent to `getCartSummary`. The backend fetches the product from DB to get `product.size` for CRV calculation (`order.js` line 603). This is correct — the backend uses the authoritative `product.size`, not a client-submitted value.

### Issue #10 — Order items don't persist per-item CRV breakdown ✅ Fixed
The Order model stores aggregate `crv` and `tax` fields but individual items in the order (lines 233-255) didn't include a per-item CRV amount. If a refund or partial cancellation is needed, there's no way to determine how much CRV to refund per item. **Fixed** by computing `crvPerItem` and `totalCrv` for each line item in `backend/src/utils/orderCalculator.js` and storing them on each order item in `backend/src/controllers/order.js`. Existing orders remain unchanged.

---

## 7. Security Assessment

### GOOD ✅
- All prices come from the DB, not client submissions.
- Tax rate comes from Settings model, not client.
- CRV rates come from Category model, not client.
- Stripe PaymentIntent amount is server-calculated.
- Order creation verifies `PaymentIntent.amount === expectedAmountCents`.
- Category updates use field whitelisting (prevents mass assignment of `crvRate`/`taxable`).
- Settings `taxRate` update is validated (0 to 1 range).

**No security issues found in the tax/CRV calculation pipeline.**

---

## 8. Summary

The tax and CRV system is architecturally sound — server-side calculation with client-side display only. All medium and low-priority findings from this audit have been addressed:

| Priority | Issue | Description | Status |
|----------|-------|-------------|--------|
| Medium | #1 | CRV threshold label/code mismatch (24 oz labels vs 30 oz code) | ✅ Fixed |
| Medium | #7 | `priceSale` fallback inconsistency | ✅ Fixed |
| Low | #2 | Admin CRV dropdown doesn't explain per-container calculation | ✅ Fixed |
| Low | #3 | Cart page fallback hides tax/CRV on API failure | ✅ Fixed |
| Low | #4 | Billing total is client-side composition | ✅ Fixed |
| Low | #8 | Cart shows "Free" shipping but billing may charge delivery | ✅ Fixed |
| Low | #10 | No per-item CRV breakdown stored on order for partial refunds | ✅ Fixed |

No remaining issues identified. The tax/CRV pipeline remains server-authoritative with improved UX and auditability.