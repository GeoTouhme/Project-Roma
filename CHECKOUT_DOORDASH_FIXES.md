# Checkout & DoorDash Integration — Fix Plan

> **Purpose**: This document is a structured task list for an AI coding agent to fix critical issues in the checkout pipeline and DoorDash delivery integration. Each issue includes severity, affected files, root cause analysis, and exact implementation instructions.

---

## Project Context

- **Project**: Project-Roma — an e-commerce liquor store (Bal-Port Liquors) with delivery via DoorDash Drive API v2
- **Stack**: React frontend (`customer-panel/`), Node.js/Express backend (`backend/`), MongoDB (Mongoose), Stripe payments, DoorDash Drive v2
- **Store address**: 4521 W Coast Hwy, Newport Beach, CA 92663

---

## Issue 1: Payment Amount ≠ Order Total (🔴 HIGH)

### Problem

The frontend sends `subtotal` (raw cart total) to create the Stripe payment intent, but the backend independently calculates the real total (applying coupons, discounts, shipping). There is **no server-side verification** that the Stripe charge matches the actual order total. A malicious client could tamper with the `amount` sent to `/payment-intents` to pay less than the actual order total.

### Affected Files

- `backend/src/controllers/payment-intents.js` (lines 6–30)
- `backend/src/controllers/order.js` — `createOrder` function (lines 39–296)
- `customer-panel/src/pages/Billing/Billing.jsx` — `handleSubmit` function (lines 256–323)

### Root Cause

The payment intent is created in a **separate endpoint** (`POST /payment-intents`) with a client-provided `amount`, and the order creation (`POST /orders`) never verifies that the Stripe payment intent's `amount` matches the server-calculated order total.

### Fix Instructions

**Option A (Recommended): Verify payment amount during order creation**

In `backend/src/controllers/order.js` inside `createOrder`, after computing the final `discountedTotal + shipping` total:

1. Use the Stripe SDK to **retrieve the payment intent** using the `paymentId` (which is currently a payment method ID — see note below).
2. Compare `paymentIntent.amount` (in cents) against `Math.round(orderTotal * 100)`.
3. If they don't match, reject the order with a `400` error.

Add this code after line 179 (after `orderCreated` but **before** DoorDash dispatch), or better yet, **before** creating the order at all (after line 146 where `discountedTotal` is computed):

```javascript
// Verify Stripe payment amount matches server-calculated total
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// The frontend sends paymentMethod.id — we need the PaymentIntent ID instead
// IMPORTANT: The frontend must be updated to send the PaymentIntent ID, not the PaymentMethod ID
const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
const expectedAmountCents = Math.round((discountedTotal + Number(shipping)) * 100);

if (paymentIntent.amount !== expectedAmountCents) {
  return res.status(400).json({
    success: false,
    message: 'Payment amount mismatch. Please try again.'
  });
}

if (paymentIntent.status !== 'succeeded') {
  return res.status(400).json({
    success: false,
    message: 'Payment not confirmed. Please try again.'
  });
}
```

**IMPORTANT**: The frontend currently sends `paymentMethodReq.paymentMethod.id` as `paymentId`. You need to update the frontend to send the **PaymentIntent ID** instead. In `Billing.jsx`, after `confirmCardPayment`:

```javascript
// Change this (line ~302-305):
const orderResponse = await OrderService.creteOrder({
  ...orderPayload,
  paymentId: paymentMethodReq.paymentMethod.id,
});

// To this:
const orderResponse = await OrderService.creteOrder({
  ...orderPayload,
  paymentId: confirmRes.paymentIntent.id,  // PaymentIntent ID, not PaymentMethod ID
});
```

This allows the backend to retrieve and verify the actual charged amount.

---

## Issue 2: No Idempotency on Order Creation (🟡 MEDIUM)

### Problem

If a customer's network times out after Stripe payment succeeds but before the frontend receives the order creation response, a retry (or page refresh + re-submit) could create a **duplicate order** for the same Stripe payment.

### Affected Files

- `backend/src/controllers/order.js` — `createOrder` function (lines 39–296)
- `backend/src/models/Order.js` (lines 1–107)

### Fix Instructions

1. **In `backend/src/models/Order.js`**: Add a unique index on `paymentId`:

```javascript
// Add after the schema definition (around line 98), before the model export:
OrderSchema.index({ paymentId: 1 }, { unique: true, sparse: true });
```

The `sparse: true` allows multiple documents without a `paymentId` (for legacy or edge cases), but ensures no two orders can share the same `paymentId`.

2. **In `backend/src/controllers/order.js`**: At the top of `createOrder`, before any processing, check if an order with this `paymentId` already exists:

```javascript
// Add after line 64 (after the paymentId check):
const existingOrder = await Orders.findOne({ paymentId });
if (existingOrder) {
  // Return the existing order instead of creating a duplicate
  return res.status(200).json({
    success: true,
    message: 'Order already placed',
    orderId: existingOrder._id,
    orderNo: existingOrder.orderNo,
  });
}
```

3. **Wrap the `Orders.create()` call** (line 166) in a try-catch that specifically handles the duplicate key error (MongoDB error code 11000):

```javascript
try {
  const orderCreated = await Orders.create({ ... });
  // ... rest of the logic
} catch (err) {
  if (err.code === 11000 && err.keyPattern?.paymentId) {
    const existingOrder = await Orders.findOne({ paymentId });
    return res.status(200).json({
      success: true,
      message: 'Order already placed',
      orderId: existingOrder._id,
      orderNo: existingOrder.orderNo,
    });
  }
  throw err; // Re-throw other errors
}
```

---

## Issue 3: Inventory Decrement Fire-and-Forget (🟡 MEDIUM)

### Problem

In `backend/src/controllers/order.js`, the inventory update (lines 100–104) calls `Products.findOneAndUpdate(...).exec()` **without `await`**. This means:

- The order completes before inventory is actually decremented
- Under concurrent requests, two customers could buy the last item simultaneously (overselling)
- If the DB update fails, inventory is never corrected and no error is logged

### Affected Files

- `backend/src/controllers/order.js` — lines 100–104

### Fix Instructions

1. **Collect all inventory update promises** and `await` them with `Promise.all`:

Replace lines 84–111 with:

```javascript
const inventoryUpdates = [];

const updatedItems = items.map((item) => {
  const product = products.find((p) => p._id.toString() === item.pid);

  if (product) {
    console.log(`🔍 Checking Product: ${product.name} | Category: ${product.category ? product.category.name : 'N/A'} | Slug: ${product.category ? product.category.slug : 'N/A'}`);
  }

  if (product && product.category && alcoholCategorySlugs.includes(product.category.slug)) {
    containsAlcohol = true;
  }

  const price = product ? product.priceSale : 0;
  const total = price * item.quantity;

  // Collect the promise instead of fire-and-forget
  inventoryUpdates.push(
    Products.findOneAndUpdate(
      { _id: item.pid, available: { $gte: item.quantity } },
      { $inc: { available: -item.quantity, sold: item.quantity } },
      { new: true, runValidators: true }
    ).exec().then(result => {
      if (!result) {
        throw new Error(`Insufficient stock for product: ${product?.name || item.pid}`);
      }
      return result;
    })
  );

  return {
    ...item,
    total,
    imageUrl: product.images.length > 0 ? product.images[0].url : '',
  };
});

// Await all inventory updates — fail the order if any product is out of stock
try {
  await Promise.all(inventoryUpdates);
} catch (stockError) {
  return res.status(400).json({
    success: false,
    message: stockError.message || 'One or more items are out of stock.'
  });
}
```

Key changes:
- `await Promise.all(inventoryUpdates)` ensures inventory is decremented before the order is created
- The `$gte: item.quantity` condition (changed from `$gte: 0`) ensures there's enough stock
- If any product lacks sufficient stock, the order fails with a clear error message

---

## Issue 4: Remove COD Dead Code (🟢 LOW)

### Problem

The frontend still has Cash On Delivery (COD) handling code that is effectively disabled — it shows "Temporarily Unavailable" and the backend rejects non-Stripe payments. This dead code is confusing and should be cleaned up.

### Affected Files

- `customer-panel/src/pages/Billing/Billing.jsx` — lines 31, 243–254
- `backend/src/models/Order.js` — line 8 (enum includes `PayPal` and `COD`)

### Fix Instructions

1. **In `Billing.jsx`**: Remove the `selectedPaymentMethod` state variable (line 31) and replace all references with the hardcoded string `"Stripe"`. Remove the COD branch in `handleSubmit` (lines 243–254):

Delete these lines entirely:
```javascript
// DELETE: lines 243-254
if (selectedPaymentMethod === "COD") {
  try {
    // await PaymentService.createOrder(orderPayload); // COD only
    setCheckoutError('Cash On Delivery: Temporary Unavailable');
    setProcessing(false);
    // Redirect to success page or show confirmation
  } catch (err) {
    setCheckoutError(err?.response?.data?.message || 'Order creation failed');
    setProcessing(false);
  }
  return;
}
```

Also remove the state declaration on line 31:
```javascript
// DELETE:
const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Stripe");
```

Replace all remaining references to `selectedPaymentMethod` with the literal string `"Stripe"`. There are two:
- Line 232: `paymentMethod: selectedPaymentMethod` → `paymentMethod: "Stripe"`
- Line 256: `if (selectedPaymentMethod === "Stripe")` → remove the `if` wrapper entirely (always Stripe)
- Line 577: `{selectedPaymentMethod === "Stripe" && (` → just render the card element directly without the conditional

2. **In `Order.js`** (optional): Tighten the enum to only `['Stripe']` if you want to enforce this at the data layer too. Only do this if no existing orders in the DB have `PayPal` or `COD` as `paymentMethod`.

---

## Issue 5: DoorDash Driver Tip Always $0 (🟢 LOW)

### Problem

The DoorDash delivery payload hardcodes `tip: 0` (line 71 of `doorDashService.js`). There's no UI for customers to add a tip for the delivery driver.

### Affected Files

- `customer-panel/src/pages/Billing/Billing.jsx` — add tip UI
- `backend/src/controllers/order.js` — pass tip through to order
- `backend/src/services/doorDashService.js` — line 71
- `backend/src/models/Order.js` — add tip field

### Fix Instructions

1. **In `Order.js`**: Add a `tip` field to the schema:

```javascript
// Add after the `discount` field (around line 34):
tip: {
  type: Number,
  default: 0,
},
```

2. **In `Billing.jsx`**: Add a tip selector in the order summary section (right panel), between the shipping line and the total line. Suggested UI:

```jsx
// Add state:
const [tip, setTip] = useState(0);

// Add tip selector UI (between the Shipping and Total sections, around line 568):
<div className="mt-2">
  <p className="font-semibold mb-1">Driver Tip</p>
  <div className="flex gap-2">
    {[0, 2, 3, 5].map((amount) => (
      <button
        key={amount}
        onClick={() => setTip(amount)}
        className={`px-3 py-1 rounded-lg border text-sm font-semibold transition-colors ${
          tip === amount
            ? "bg-[#B5223B] text-white border-[#B5223B]"
            : "bg-white text-gray-700 border-gray-300 hover:border-[#B5223B]"
        }`}
      >
        {amount === 0 ? "No tip" : `$${amount}`}
      </button>
    ))}
  </div>
</div>
```

Update the total display to include the tip:
```jsx
// Change the total line to:
<p>${(subtotal + tip).toFixed(2)}</p>
```

Add `tip` to `orderPayload`:
```javascript
const orderPayload = {
  paymentMethod: "Stripe",
  items,
  user,
  totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  couponCode: null,
  shipping: "0",
  tip,  // Add this
};
```

Also update the Stripe payment intent amount to include the tip:
```javascript
// Change line 266 from:
const clientSecret = await PaymentService.paymentIntentCreate({ amount: subtotal })

// To:
const clientSecret = await PaymentService.paymentIntentCreate({ amount: subtotal + tip })
```

3. **In `order.js` (backend controller)**: Extract `tip` from the request body and include it in the order:

```javascript
// Add `tip` to the destructured body (line 41):
const { items, user, paymentMethod, paymentId, couponCode, totalItems, shipping, tip } = await req.body;

// Sanitize the tip value (after shipping validation):
const sanitizedTip = Math.max(0, Math.min(Number(tip) || 0, 100)); // Cap at $100

// Include in Orders.create() (around line 166):
tip: sanitizedTip,

// Update total calculation to include tip (line 170):
total: discountedTotal + Number(shipping) + sanitizedTip,
```

4. **In `doorDashService.js`**: Use the order's tip value instead of hardcoded 0:

```javascript
// Change line 71 from:
tip: 0,

// To:
tip: Math.round((orderData.tip || 0) * 100), // DoorDash expects tip in cents
```

---

## Issue 6: DoorDash Delivery Fee Not Charged to Customer (🔴 HIGH)

### Problem

The system calls DoorDash's `/drive/v2/quotes` endpoint during address verification, which returns the delivery fee in the response. However, **this fee is completely discarded** — the frontend only checks `response.success` and ignores the fee data. Shipping is hardcoded to `"0"` (free) in the order payload, and the customer always sees "Shipping: Free".

This means the store is **absorbing the DoorDash delivery fee on every order** without it being visible anywhere.

### Affected Files

- `customer-panel/src/pages/Billing/Billing.jsx` — lines 126–161 (`checkDeliveryQuote`), line 237 (hardcoded `shipping: "0"`), line 567 (displays "Free")
- `customer-panel/src/services/orderService.js` — `getDeliveryQuote` function (line 15)
- `backend/src/controllers/order.js` — `getDeliveryQuote` (lines 459–514), `createOrder` (line 170 total calculation)
- `backend/src/services/doorDashService.js` — `getDeliveryQuote` (lines 104–134)

### How DoorDash Quote Response Works

The DoorDash Drive v2 `/quotes` endpoint returns a response like:

```json
{
  "external_delivery_id": "QUOTE-1714480000000",
  "fee": 895,
  "currency": "USD",
  "delivery_time": "2026-04-30T15:30:00Z",
  "pickup_time_estimated": "2026-04-30T15:15:00Z",
  "dropoff_time_estimated": "2026-04-30T15:45:00Z"
}
```

The `fee` field is in **cents** (e.g., `895` = $8.95). This value is currently returned to the frontend but never extracted or used.

### Fix Instructions

#### 1. Backend: Return the fee from the quote endpoint

In `backend/src/controllers/order.js`, update the `getDeliveryQuote` function to explicitly return the fee. Change the success response (around line 502–505):

```javascript
// Change from:
return res.status(200).json({
  success: true,
  data: quote
});

// To:
return res.status(200).json({
  success: true,
  data: quote,
  deliveryFee: (quote.fee || 0) / 100, // Convert from cents to dollars
});
```

#### 2. Frontend: Store and display the delivery fee

In `customer-panel/src/pages/Billing/Billing.jsx`:

**Add state for delivery fee** (add after line 46):

```javascript
const [deliveryFee, setDeliveryFee] = useState(0);
```

**Extract fee from quote response** — update `checkDeliveryQuote` (around lines 151–153):

```javascript
// Change from:
if (response.success) {
  setQuoteVerified(true);
  setCheckoutError(null);
}

// To:
if (response.success) {
  const fee = response.deliveryFee || 0;
  setDeliveryFee(fee);
  setQuoteVerified(true);
  setCheckoutError(null);
}
```

**Reset delivery fee when address changes** — in each place where `setQuoteVerified(false)` is called, also add `setDeliveryFee(0)`. These are in:
- `handleZipChange` (line 103)
- Address `onChange` (line 405)
- City `onChange` (line 423)
- Phone `onChange` (line 468)

**Update the shipping display** (around line 565–568):

```jsx
// Change from:
<div className="flex justify-between">
  <p>Shipping:</p>
  <p className="font-semibold">Free</p>
</div>

// To:
<div className="flex justify-between">
  <p>Delivery Fee:</p>
  <p className="font-semibold">
    {deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : "Free"}
  </p>
</div>
```

**Update the total display** (around line 570–573):

```jsx
// Change from:
<p>${subtotal.toFixed(2)}</p>

// To:
<p>${(subtotal + deliveryFee).toFixed(2)}</p>
```

**Update the order payload** — change the `shipping` field (line 237):

```javascript
// Change from:
shipping: "0",

// To:
shipping: deliveryFee.toString(),
```

**Update the Stripe payment intent amount** to include the delivery fee (line 266):

```javascript
// Change from:
const clientSecret = await PaymentService.paymentIntentCreate({ amount: subtotal })

// To:
const clientSecret = await PaymentService.paymentIntentCreate({ amount: subtotal + deliveryFee + tip })
```

> **Note**: If Issue 5 (tip) is also implemented, make sure the payment intent amount is `subtotal + deliveryFee + tip`.

#### 3. Handle fee display before verification

Before the quote is verified, show a placeholder message to set expectations:

```jsx
{/* Add below the Delivery Fee line, around line 568 */}
{!quoteVerified && (
  <p className="text-xs text-gray-400 italic">
    Delivery fee calculated after address verification
  </p>
)}
```

#### 4. Store-absorbed delivery (OPTIONAL)

If the store owner **intentionally** wants to offer free delivery and absorb the DoorDash fee, instead of the above changes:

1. Do NOT display the fee to the customer
2. But DO log the fee in the Order model for accounting purposes:

Add to `backend/src/models/Order.js`:

```javascript
doorDashFee: {
  type: Number,
  default: 0,
},
```

And save it during order creation in `order.js` by fetching a fresh quote:

```javascript
// After order creation, store the DoorDash fee for bookkeeping
// This helps the store track how much they're paying DoorDash per order
```

Choose ONE approach: either charge the customer (recommended for sustainability) or absorb it but track it.

---

## Validation Checklist

After implementing all fixes, verify the following:

- [ ] Place a test order and confirm the Stripe payment intent amount matches the server-calculated total
- [ ] Attempt to create a duplicate order with the same `paymentId` — should return existing order, not create a new one
- [ ] Add an item with low stock (e.g., `available: 1`) and attempt to order 2 — should fail with stock error
- [ ] Verify the COD code path is completely removed and no UI references remain
- [ ] Test the tip selector UI — $0, $2, $3, $5 options should reflect in the total and pass through to DoorDash
- [ ] Verify the order confirmation email still sends correctly with tracking URL
- [ ] Confirm DoorDash delivery dispatch still works after all changes
- [ ] Test with an alcohol product to ensure ID verification flags are still set correctly
- [ ] Verify the DoorDash delivery fee is extracted from the quote response and displayed to the customer
- [ ] Confirm the delivery fee is included in the Stripe payment intent amount
- [ ] Confirm the delivery fee is stored in the order's `shipping` field
- [ ] Test that changing the address resets the delivery fee to $0 until re-verified

---

## File Change Summary

| File | Changes |
|------|---------|
| `backend/src/controllers/payment-intents.js` | No changes needed |
| `backend/src/controllers/order.js` | Add payment verification, idempotency check, await inventory updates, accept tip |
| `backend/src/services/doorDashService.js` | Use dynamic tip from order data |
| `backend/src/models/Order.js` | Add unique index on `paymentId`, add `tip` field |
| `customer-panel/src/pages/Billing/Billing.jsx` | Send PaymentIntent ID, remove COD code, add tip UI, display delivery fee, include fee in total + payment |
| `backend/src/models/Order.js` | (Optional) Add `doorDashFee` field for store-absorbed fee tracking |
