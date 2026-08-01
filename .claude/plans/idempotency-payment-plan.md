# Plan: Prevent Duplicate PaymentIntents on Double-Click

## Problem

When a customer clicks **Place Order** twice in quick succession, two `POST /api/payment-intents` requests can reach Stripe before the button is fully disabled. This creates two PaymentIntents and potentially two charges for the same cart. The existing duplicate `paymentId` check in `order.js` only prevents duplicate *orders*, not duplicate *charges*.

## Goal

Ensure that a single checkout attempt (including accidental double-clicks) results in exactly one PaymentIntent, one confirmed charge, and one order.

## Proposed Solution

Use Stripe’s `idempotencyKey` on **both** PaymentIntent creation and PaymentIntent confirmation, and generate the key deterministically from the current checkout payload so accidental retries share the same key.

## Files to Change

### 1. Backend — `backend/src/controllers/payment-intents.js`

- Accept `idempotencyKey` from `req.body`.
- Validate it is a string and truncate/return error if longer than 255 chars.
- Pass it to `stripe.paymentIntents.create({ ..., idempotencyKey })` when present.
- Keep backward compatibility: if no key is sent, create the PaymentIntent without one.

### 2. Frontend Service — `customer-panel/src/services/paymentService.js`

- Add an optional `idempotencyKey` argument to `paymentIntentCreate()`.
- Include it in the POST body.

### 3. Frontend Checkout — `customer-panel/src/pages/Billing/Billing.jsx`

- In `handleSubmit`, generate a deterministic `idempotencyKey` at the very start.
- Pass it to `PaymentService.paymentIntentCreate()`.
- Pass the **same** key to `stripe.confirmCardPayment()`.
- Keep the existing `processing` state guard that disables the submit button.

## Idempotency Key Design

The key must be:
- **Identical** for accidental double-clicks (millisecond apart, same cart/user/amount).
- **Different** for genuinely separate checkout attempts (different cart or different time bucket).

Implementation:

```js
const generateIdempotencyKey = () => {
  const cartFingerprint = cartItems
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}:${item.quantity}:${item.priceSale || item.price || 0}`)
    .join('|');
  const timeBucket = Math.floor(Date.now() / 30000); // 30-second window
  const raw = `${email}|${cartFingerprint}|${deliveryFee}|${tip}|${cartSummary.tax}|${cartSummary.crv}|${timeBucket}`;
  return btoa(raw).slice(0, 255);
};
```

Why 30 seconds? It is long enough to catch double-clicks and quick retries, but short enough that a user who returns later gets a fresh PaymentIntent.

## Stripe Flow with Idempotency

1. User clicks **Place Order** once:
   - Key `K` generated.
   - Backend creates PaymentIntent with `idempotencyKey: K` → Stripe returns PaymentIntent `PI_A`.
   - Frontend confirms `PI_A` with `idempotencyKey: K` → succeeds.
   - Order created with `paymentId = PI_A`.

2. User double-clicks (two parallel `handleSubmit` calls):
   - Both calls generate the same key `K` (same cart, same 30s window).
   - Both backend calls hit Stripe with `idempotencyKey: K`. Stripe returns the same `PI_A` to both.
   - Both confirmation calls use `idempotencyKey: K`. Stripe returns the same confirmation result to both.
   - The first `creteOrder` call creates the order. The second `creteOrder` call finds the existing order by `paymentId` and returns it safely.

## Acceptance Criteria

- [ ] Rapid double-click on **Place Order** creates exactly one PaymentIntent in Stripe Dashboard.
- [ ] Only one order appears in the admin panel.
- [ ] Only one charge is recorded.
- [ ] Normal single-click checkout still works.
- [ ] Retry after a failure (more than 30 seconds later) creates a new PaymentIntent.

## Out of Scope

- Server-side cart persistence across devices (tracked separately in GitHub issue).
- Refund webhook inventory restocking (can be handled in a separate task).
