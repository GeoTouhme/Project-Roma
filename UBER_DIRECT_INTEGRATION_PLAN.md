# Plan: Add Uber Direct Delivery Integration Alongside DoorDash

## Context
Bal-Port Liquors currently uses DoorDash Drive API v2 for alcohol delivery dispatch from the Newport Beach store. The DoorDash production API push is on hold, so the business wants to add **Uber Direct** as an alternative delivery provider. The end goal is a configurable system where the store can switch between DoorDash and Uber Direct via an admin toggle, with DoorDash code preserved as a fallback.

## Recommended Approach
An additive integration: build the Uber Direct service layer and webhook handler as new files, add a `deliveryProvider` setting, and branch the order dispatch logic. No DoorDash files are deleted.

---

## Phase 1 — Backend Service Layer

### 1.1 Create `backend/src/services/uberDirectService.js`
**New file.** Implements the same 4-method interface as `doorDashService.js` so the order controller can call either interchangeably:

| Method | Purpose |
|--------|---------|
| `createDelivery(orderData)` | POST delivery to Uber Direct. |
| `getDeliveryQuote(deliveryData)` | POST quote request. |
| `cancelDelivery(externalDeliveryId)` | PUT cancel by delivery ID. |
| `getDeliveryStatus(externalDeliveryId)` | GET delivery status. |

**Key differences from DoorDash:**
- **Auth:** OAuth2 client-credentials flow instead of JWT. Cache the access token and refresh before expiry.
  - Token endpoint: `https://login.uber.com/oauth/v2/token`
  - Scope: `direct_deliveries`
- **Base URL:** `https://api.uber.com/v1/customers/{customerId}/deliveries`
- **Payload shape:** Uber Direct expects `pickup_address`, `dropoff_address`, `manifest`, `manifest_items`, `contactless_dropoff`, `id_verification`, `return_to_pickup` (for alcohol), etc.
- **Alcohol flags:** Uber Direct uses `id_verification: "required"` and `return_to_pickup: true` when `containsAlcohol` is true.
- **Phone format:** E.164 required (reuse existing `formatPhone` logic).
- **Tip:** Uber Direct tip handling may differ; confirm whether tip is passed in the delivery payload or handled separately.

**Environment variables to add to `backend/.env`:**
```
UBER_DIRECT_CLIENT_ID=...
UBER_DIRECT_CLIENT_SECRET=...
UBER_DIRECT_CUSTOMER_ID=...
UBER_DIRECT_ENV=sandbox   # or production
```

### 1.2 Update `backend/src/models/settings.js`
Add a new field to the Settings schema:
```js
deliveryProvider: {
  type: String,
  enum: ['doordash', 'uberdirect'],
  default: 'doordash',
}
```

### 1.3 Update `backend/src/controllers/settings.js`
In `updateSettings`, destructure `deliveryProvider` from `req.body` and include it in the `$set` update. Validate that it matches the enum values.

### 1.4 Update `backend/src/controllers/order.js`
Import the new Uber Direct service alongside the existing DoorDash service.

In `createOrder` (after Stripe payment succeeds, before dispatch):
1. Load the store settings: `Settings.findOne({ key: 'storeConfig' })`.
2. Branch on `settings?.deliveryProvider`:
   - `'doordash'` (or default) → call `doorDashService.createDelivery(orderCreated)`
   - `'uberdirect'` → call `uberDirectService.createDelivery(orderCreated)`
3. Save the response fields generically into the Order model (`deliveryId`, `trackingUrl`, `deliveryStatus`, `estimatedPickupTime`, `estimatedDeliveryTime`).

Apply the same branching pattern to:
- `getDeliveryQuote`
- `cancelDelivery`
- `refreshDeliveryStatus`

**Important:** Keep all existing DoorDash status mapping intact. Add Uber Direct status mapping alongside it (see Phase 2).

---

## Phase 2 — Webhook Handler

### 2.1 Create `backend/src/controllers/uberDirectWebhook.js`
**New file.** Handles Uber Direct webhook events.

**Route:** `POST /api/webhooks/uberdirect`

**Behavior:**
- Read `delivery_id` from the payload and find the local order by `orderNo` (the `external_delivery_id` we sent during creation).
- Map Uber Direct statuses to internal order statuses:

| Uber Direct Status | Internal Status |
|-------------------|-----------------|
| `pending` | (no change) |
| `pickup_ready` | (no change) |
| `pickup_complete` / `courier_picked_up` | `shipped` |
| `dropoff_complete` / `delivered` | `delivered` |
| `canceled` / `cancelled` | `delivery_failed` + create admin Notification |
| `returned` | `returned` + create admin Notification |

- Update `trackingUrl`, `estimatedDeliveryTime`, `estimatedPickupTime` if present.
- Always return HTTP 200 to prevent Uber retries.

### 2.2 Create `backend/src/routes/uberDirectWebhook.js`
**New file.** Single route registering `POST /webhooks/uberdirect` → `handleUberDirectWebhook`.

### 2.3 Update `backend/src/index.js`
Import and mount the new webhook route alongside the existing DoorDash webhook:
```js
const uberDirectWebhookRoutes = require('./routes/uberDirectWebhook');
app.use('/api', uberDirectWebhookRoutes);
```

---

## Phase 3 — Admin Panel Settings UI

### 3.1 Update `admin-panel/src/pages/StoreSettings.tsx`
Add a **"Delivery Provider"** dropdown (or radio group) below the timezone selector.

- Options: **DoorDash** (`doordash`) / **Uber Direct** (`uberdirect`)
- Load current value from `GET /api/settings`
- Save via `PUT /api/settings` with `{ deliveryProvider: 'uberdirect' | 'doordash' }`

---

## Phase 4 — Customer Panel Frontend

### 4.1 Update `customer-panel/src/pages/Billing/Billing.jsx`
- **Error message:** Change hardcoded `"DoorDash: Delivery not available for this address."` to a generic `"Delivery not available for this address."`
- **Legal copy:** Change `"...processed by DoorDash for the purpose of identity verification..."` to `"...processed by our delivery partner for the purpose of identity verification as required by law."` (or make it dynamic based on the active provider).
- **Button labels:** Keep existing flow (`Verify Delivery` → `Place Order`). No structural changes needed.

### 4.2 Update `customer-panel/src/pages/order/index.jsx`
- **Live Delivery Tracking card:** Change `"Your order is being delivered by DoorDash"` to `"Your order is being delivered by our delivery partner"` (or make it dynamic).
- Keep the tracking URL, status, ETA, and support ID display exactly as-is — the data model is unchanged.

### 4.3 Update `customer-panel/src/services/orderService.js`
No changes needed. The endpoints `/orders/delivery-quote`, `/orders` (create), `/orders/:id/cancel`, and `/admin/orders/:id/delivery-status` remain the same. The backend branching is transparent to the frontend.

---

## Phase 5 — Email Template & Documentation

### 5.1 `backend/src/email-templates/order.html`
No changes needed. The `{{trackingInfo}}` placeholder is generic and already conditionally renders a tracking link.

### 5.2 Update `CLAUDE.md`
After implementation, add a section documenting the dual-provider delivery architecture:
- How the `deliveryProvider` setting works
- Which env vars are needed for Uber Direct
- Webhook endpoint: `/api/webhooks/uberdirect`

---

## Phase 6 — Environment & Deployment

### 6.1 Add Uber Direct env vars
Append to `backend/.env` (and ensure they are set in production):
```
UBER_DIRECT_CLIENT_ID=
UBER_DIRECT_CLIENT_SECRET=
UBER_DIRECT_CUSTOMER_ID=
UBER_DIRECT_ENV=sandbox
```

### 6.2 Docker / Vercel
- `docker-compose.yml` already loads `backend/.env` via `env_file`. No changes needed.
- `vercel.json` requires no changes.

---

## Files to Create
1. `backend/src/services/uberDirectService.js`
2. `backend/src/controllers/uberDirectWebhook.js`
3. `backend/src/routes/uberDirectWebhook.js`

## Files to Modify
| File | Change |
|------|--------|
| `backend/src/models/settings.js` | Add `deliveryProvider` enum field |
| `backend/src/controllers/settings.js` | Accept `deliveryProvider` in update |
| `backend/src/controllers/order.js` | Branch between DoorDash & Uber Direct services |
| `backend/src/index.js` | Mount new webhook route |
| `backend/.env` | Add `UBER_DIRECT_*` variables |
| `admin-panel/src/pages/StoreSettings.tsx` | Add delivery provider dropdown |
| `customer-panel/src/pages/Billing/Billing.jsx` | Generic error/legal copy |
| `customer-panel/src/pages/order/index.jsx` | Generic delivery partner copy |

## Files Left Unchanged (DoorDash preserved)
- `backend/src/services/doorDashService.js`
- `backend/src/controllers/doorDashWebhook.js`
- `backend/src/routes/doorDashWebhook.js`
- `backend/src/models/Order.js`
- `backend/src/email-templates/order.html`

## Verification Plan
1. **Settings API:** `PUT /api/settings` with `deliveryProvider: 'uberdirect'`, then `GET /api/settings` to confirm persistence.
2. **Quote Flow:** With provider set to `uberdirect`, trigger checkout address verification in customer panel. Verify Uber Direct quote API is called and `deliveryFee` is returned correctly.
3. **Create Order:** Place a test order. Verify the Uber Direct delivery creation API is called and the order document has `deliveryId`, `trackingUrl`, and `deliveryStatus` populated.
4. **Webhook Simulation:** POST a simulated Uber Direct webhook payload to `/api/webhooks/uberdirect` and confirm the order status updates (e.g., `pickup_complete` → `shipped`).
5. **Cancel Flow:** Cancel an active Uber Direct order from the admin panel and confirm the cancellation API is called.
6. **Refresh Status:** Trigger a manual status refresh and confirm Uber Direct status is polled and mapped correctly.
7. **DoorDash Fallback:** Switch `deliveryProvider` back to `doordash`, place an order, and confirm DoorDash flows still work unchanged.
8. **Admin UI:** Confirm the Store Settings page renders and saves the provider dropdown.

## Open Questions / Risks
- **Uber Direct OAuth2 scope:** Confirm exact scope string (`direct_deliveries` or `delivery`) with Uber Developer Dashboard.
- **Uber Direct base URL:** Confirm whether it uses `/v1/customers/{customerId}/deliveries` or `/v2/...`.
- **Uber Direct tip model:** Uber may handle tips differently than DoorDash (e.g., not accepting tips in the delivery payload). This may require removing or restructuring the tip flow during checkout.
- **Uber Direct alcohol manifest:** Confirm exact payload fields for alcohol (`id_verification`, `return_to_pickup`, `contains_alcohol`, etc.).
- **Uber Direct webhook signature verification:** Uber may sign webhooks with a secret; if so, a verification helper should be added to `uberDirectWebhook.js`.
