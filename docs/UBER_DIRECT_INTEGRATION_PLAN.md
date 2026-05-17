# Plan: Add Uber Direct Delivery Integration Alongside DoorDash

## Context
Bal-Port Liquors currently uses DoorDash Drive API v2 for alcohol delivery dispatch from the Newport Beach store. The DoorDash production API push is on hold, so the business wants to add **Uber Direct** as an alternative delivery provider. The end goal is a configurable system where the store can switch between DoorDash and Uber Direct via an admin toggle, with DoorDash code preserved as a fallback.

## Recommended Approach
An additive integration: build the Uber Direct service layer and webhook handler as new files, add a `deliveryProvider` setting, store the provider per-order, and branch the order dispatch logic. No DoorDash files are deleted.

---

## Phase 1 — Backend Service Layer

### 1.1 Create `backend/src/services/uberDirectService.js`
**New file.** Implements the same 4-method interface as `doorDashService.js` so the order controller can call either interchangeably:

| Method | Purpose |
|--------|---------|
| `createDelivery(orderData)` | POST delivery to Uber Direct. |
| `getDeliveryQuote(deliveryData)` | POST quote request. |
| `cancelDelivery(externalDeliveryId)` | POST cancel by delivery ID. |
| `getDeliveryStatus(externalDeliveryId)` | GET delivery status. |

**Key differences from DoorDash:**

- **Auth:** OAuth2 client-credentials flow instead of JWT. The access token **must be cached in memory** and refreshed ~60 seconds before expiry to avoid per-request token calls.
  - Token endpoint: `https://login.uber.com/oauth/v2/token`
  - Grant type: `client_credentials`
  - Scope: `eats.deliveries`
  - Content-Type: `application/x-www-form-urlencoded`

  **Token caching implementation:**
  ```js
  class UberDirectService {
    constructor() {
      this.accessToken = null;
      this.tokenExpiry = 0;
      this.customerId = process.env.UBER_DIRECT_CUSTOMER_ID;
      this.baseUrl = `https://api.uber.com/v1/customers/${this.customerId}/deliveries`;
    }

    async getAccessToken() {
      // Return cached token if still valid (with 60s safety buffer)
      if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
        return this.accessToken;
      }
      const response = await axios.post(
        'https://login.uber.com/oauth/v2/token',
        new URLSearchParams({
          client_id: process.env.UBER_DIRECT_CLIENT_ID,
          client_secret: process.env.UBER_DIRECT_CLIENT_SECRET,
          grant_type: 'client_credentials',
          scope: 'eats.deliveries',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      return this.accessToken;
    }
  }
  ```

- **Base URL:** `https://api.uber.com/v1/customers/{customerId}/deliveries`
  - Sandbox vs. production is controlled by the OAuth2 app credentials (sandbox app vs. production app), **not** by a URL switch.

- **Payload shape:** Uber Direct expects `pickup_address`, `dropoff_address`, `manifest`, `manifest_items`, etc.

- **Alcohol flags:** Uber Direct uses a `dropoff_verification` object for alcohol deliveries:
  ```json
  {
    "dropoff_verification": {
      "identification": {
        "enabled": true
      }
    }
  }
  ```
  This replaces DoorDash's `dropoff_options.id_verification: "required"` and `action_if_undeliverable: "return_to_pickup"`. Uber automatically handles return-to-pickup when ID verification fails.

- **Cancel endpoint:** `POST /v1/customers/{customerId}/deliveries/{deliveryId}/cancel` — note this is **POST**, not PUT (DoorDash uses PUT).

- **Phone format:** E.164 required (reuse existing `formatPhone` logic).

- **Tip:** Uber Direct does **not** accept tips in the merchant delivery payload. Tips are handled by the customer via the Uber tracking link. **Omit the `tip` field** from the Uber Direct delivery creation payload entirely.

**Environment variables to add to `backend/.env`:**
```
UBER_DIRECT_CLIENT_ID=...
UBER_DIRECT_CLIENT_SECRET=...
UBER_DIRECT_CUSTOMER_ID=...
UBER_DIRECT_WEBHOOK_SECRET=...
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

Also add it to the `findOneOrCreate` defaults so new settings documents get the default value.

### 1.3 Update `backend/src/models/Order.js`
Add a `deliveryProvider` field to the Order schema:
```js
deliveryProvider: {
  type: String,
  enum: ['doordash', 'uberdirect'],
  default: 'doordash',
},
```

This is **required** so that `cancelDelivery` and `refreshDeliveryStatus` can route to the correct provider's API for existing orders. Without this, orders created under one provider could have their cancel/refresh calls sent to the wrong API.

### 1.4 Update `backend/src/controllers/settings.js`
The current `updateSettings` destructures only `{ timezone, operatingHours }` and passes them directly to `findOneAndUpdate`. This means any new field (like `deliveryProvider`) would be silently dropped or wiped on save.

**Fix:** Restructure to include `deliveryProvider`:
```js
const updateSettings = async (req, res) => {
  try {
    const { timezone, operatingHours, deliveryProvider } = req.body;

    // Validate deliveryProvider if provided
    if (deliveryProvider && !['doordash', 'uberdirect'].includes(deliveryProvider)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery provider.' });
    }

    // ... existing operatingHours validation (only if operatingHours is provided) ...

    // Build update object — only include fields that were sent
    const updateData = {};
    if (timezone) updateData.timezone = timezone;
    if (operatingHours) updateData.operatingHours = operatingHours;
    if (deliveryProvider) updateData.deliveryProvider = deliveryProvider;

    const settings = await Settings.findOneAndUpdate(
      { key: 'storeConfig' },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
```

**Key change:** Use `$set` with only the provided fields instead of replacing the whole document. This prevents saving store hours from wiping `deliveryProvider`, and vice versa. The `operatingHours` validation should be conditional — only validate if `operatingHours` is present in the request body.

### 1.5 Update `backend/src/controllers/order.js`
Import the new Uber Direct service alongside the existing DoorDash service:
```js
const doorDashService = require('../services/doorDashService');
const uberDirectService = require('../services/uberDirectService');
const Settings = require('../models/settings');
```

**Create a helper** to get the active delivery service:
```js
async function getDeliveryService() {
  const settings = await Settings.findOneOrCreate();
  const provider = settings.deliveryProvider || 'doordash';
  return {
    service: provider === 'uberdirect' ? uberDirectService : doorDashService,
    provider,
  };
}
```

In `createOrder` (after Stripe payment succeeds, before dispatch):
1. Call `getDeliveryService()` to get the active provider and service.
2. Call `service.createDelivery(orderCreated)`.
3. Save the `deliveryProvider` value onto the Order document alongside `deliveryId`, `trackingUrl`, `deliveryStatus`, `estimatedPickupTime`, `estimatedDeliveryTime`.

Apply the same branching pattern to:
- `getDeliveryQuote` — use the active provider from settings.
- `cancelDelivery` — read `order.deliveryProvider` from the **existing order** (not settings, since the provider may have changed since the order was placed).
- `refreshDeliveryStatus` — read `order.deliveryProvider` from the **existing order**.

Update the `ALLOWED_ORDER_FIELDS` whitelist to include `deliveryProvider`:
```js
const ALLOWED_ORDER_FIELDS = ['status', 'trackingUrl', 'deliveryStatus', 'note', 'deliveryId', 'deliveryProvider'];
```

Update hardcoded log messages:
- `'❌ DoorDash Quote Error:'` → `'❌ Delivery Quote Error:'`
- `'DoorDash cancel failed:'` → `'Delivery cancel failed:'`
- `'🚀 Triggering DoorDash Delivery'` → `'🚀 Triggering ${provider} Delivery'`

**Important:** Keep all existing DoorDash status mapping intact. Add Uber Direct status mapping alongside it (see Phase 2).

---

## Phase 2 — Webhook Handler

### 2.1 Create `backend/src/controllers/uberDirectWebhook.js`
**New file.** Handles Uber Direct webhook events with **mandatory signature verification**.

**Route:** `POST /api/webhooks/uberdirect`

**Signature Verification (required):**
Uber Direct signs every webhook with an `x-uber-signature` header using HMAC-SHA256 of the raw request body. This **must** be verified before processing:

```js
const crypto = require('crypto');

function verifyUberSignature(req) {
  const signingKey = process.env.UBER_DIRECT_WEBHOOK_SECRET;
  if (!signingKey) {
    console.error('⚠️ UBER_DIRECT_WEBHOOK_SECRET not configured');
    return false;
  }
  const signature = req.headers['x-uber-signature'];
  if (!signature) return false;

  const expectedSig = crypto
    .createHmac('sha256', signingKey)
    .update(req.rawBody) // Must use raw body buffer — see §2.3
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}
```

**Raw body handling:** The webhook handler needs the raw (unparsed) request body for HMAC verification. This requires special handling — see §2.3.

**Behavior:**
- Verify the `x-uber-signature` header. Return 401 if invalid.
- Read `delivery_id` from the payload and find the local order by `orderNo` (the `external_id` we sent during creation).
- Map Uber Direct statuses to internal order statuses:

| Uber Direct Status | Internal Status | Notes |
|-------------------|-----------------|-------|
| `pending` | (no change) | Delivery request received |
| `pickup_ready` | (no change) | Order is ready |
| `en_route_to_pickup` | (no change) | Courier heading to store |
| `pickup` | (no change) | Courier at pickup location |
| `pickup_complete` | `shipped` | Courier picked up order |
| `en_route_to_dropoff` | `shipped` | Courier heading to customer |
| `dropoff` | `shipped` | Courier at dropoff location |
| `delivered` | `delivered` | Successfully delivered |
| `canceled` | `delivery_failed` | + create admin Notification |
| `returned` | `returned` | + create admin Notification |

- Update `trackingUrl`, `estimatedDeliveryTime`, `estimatedPickupTime` if present.
- Always return HTTP 200 to prevent Uber retries (even on processing errors).

### 2.2 Create `backend/src/routes/uberDirectWebhook.js`
**New file.** Single route registering `POST /webhooks/uberdirect` → `handleUberDirectWebhook`.

### 2.3 Update `backend/src/index.js`
Two changes needed:

**A) Preserve raw body for webhook signature verification:**
Update the body parser configuration to capture the raw body buffer for webhook routes:
```js
app.use(bodyParser.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    // Preserve raw body for webhook signature verification
    if (req.originalUrl.startsWith('/api/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));
```

**B) Import and mount the new webhook route:**
```js
const uberDirectWebhookRoutes = require('./routes/uberDirectWebhook');
app.use('/api', uberDirectWebhookRoutes);
```

---

## Phase 3 — Admin Panel Settings UI

### 3.1 Update `admin-panel/src/pages/StoreSettings.tsx`
Add a **"Delivery Provider"** dropdown (or radio group) below the timezone selector.

**Implementation details:**
1. Add state: `const [deliveryProvider, setDeliveryProvider] = useState('doordash');`
2. Load from settings response:
   ```ts
   if (settings?.data?.data?.deliveryProvider) {
     setDeliveryProvider(settings.data.data.deliveryProvider);
   }
   ```
3. Add to the submit payload:
   ```ts
   const payload = { timezone, operatingHours, deliveryProvider };
   ```
4. Add the UI (using existing `Select` component from shadcn/ui):
   ```tsx
   <div className="flex flex-col space-y-2">
     <label className="text-sm font-medium text-gray-500">Delivery Provider</label>
     <Select value={deliveryProvider} onValueChange={setDeliveryProvider}>
       <SelectTrigger className="w-full md:w-[300px]">
         <SelectValue placeholder="Select provider" />
       </SelectTrigger>
       <SelectContent>
         <SelectItem value="doordash">DoorDash</SelectItem>
         <SelectItem value="uberdirect">Uber Direct</SelectItem>
       </SelectContent>
     </Select>
   </div>
   ```

- Options: **DoorDash** (`doordash`) / **Uber Direct** (`uberdirect`)
- Load current value from `GET /api/settings`
- Save via `PUT /api/settings` with `{ deliveryProvider: 'uberdirect' | 'doordash' }`

---

## Phase 4 — Customer Panel Frontend

### 4.1 Update `customer-panel/src/pages/Billing/Billing.jsx`
- **Error message (line ~161):** Change `"DoorDash: Delivery not available for this address."` to `"Delivery not available for this address."`
- **Legal copy (line ~606):** Change `"...processed by DoorDash for the purpose of identity verification..."` to `"...processed by our delivery partner for the purpose of identity verification as required by law."`
- **Button labels:** Keep existing flow (`Verify Delivery` → `Place Order`). No structural changes needed.

### 4.2 Update `customer-panel/src/pages/order/index.jsx`
- **Comment (line ~115):** Change `{/* DoorDash Tracking Info */}` to `{/* Delivery Tracking Info */}`
- **Copy (line ~123):** Change `"Your order is being delivered by DoorDash. Click below to track your driver in real-time."` to `"Your order is being delivered. Click below to track your driver in real-time."`
- Keep the tracking URL, status, ETA, and support ID display exactly as-is — the data model is unchanged.

### 4.3 Update `customer-panel/src/services/orderService.js`
No changes needed. The endpoints `/orders/delivery-quote`, `/orders` (create), `/orders/:id/cancel`, and `/admin/orders/:id/delivery-status` remain the same. The backend branching is transparent to the frontend.

---

## Phase 5 — Email Template & Documentation

### 5.1 `backend/src/email-templates/order.html`
No changes needed. The `{{trackingInfo}}` placeholder is generic and already conditionally renders a tracking link.

### 5.2 Update `CLAUDE.md`
After implementation, add a section documenting the dual-provider delivery architecture:
- How the `deliveryProvider` setting works (Settings model for global config, Order model per-order)
- Which env vars are needed for Uber Direct (`UBER_DIRECT_CLIENT_ID`, `UBER_DIRECT_CLIENT_SECRET`, `UBER_DIRECT_CUSTOMER_ID`, `UBER_DIRECT_WEBHOOK_SECRET`)
- Webhook endpoint: `/api/webhooks/uberdirect` (with signature verification)
- `deliveryProvider` field on Order model — used by cancel/refresh to route to correct API
- OAuth2 token caching behavior in `uberDirectService.js`

---

## Phase 6 — Environment & Deployment

### 6.1 Add Uber Direct env vars
Append to `backend/.env` (and ensure they are set in production):
```
UBER_DIRECT_CLIENT_ID=
UBER_DIRECT_CLIENT_SECRET=
UBER_DIRECT_CUSTOMER_ID=
UBER_DIRECT_WEBHOOK_SECRET=
```

Note: There is no `UBER_DIRECT_ENV` variable. Sandbox vs. production behavior is controlled by the OAuth2 app credentials configured in the Uber Developer Dashboard (sandbox app vs. production app), not by an environment toggle.

### 6.2 Docker / Vercel
- `docker-compose.yml` already loads `backend/.env` via `env_file`. No changes needed.
- `vercel.json` requires no changes. The webhook route at `/api/webhooks/uberdirect` is covered by the existing catch-all routing to `src/index.js`.

---

## Files to Create
1. `backend/src/services/uberDirectService.js`
2. `backend/src/controllers/uberDirectWebhook.js`
3. `backend/src/routes/uberDirectWebhook.js`

## Files to Modify
| File | Change |
|------|--------|
| `backend/src/models/settings.js` | Add `deliveryProvider` enum field + update `findOneOrCreate` defaults |
| `backend/src/models/Order.js` | Add `deliveryProvider` enum field |
| `backend/src/controllers/settings.js` | Accept `deliveryProvider` in update; switch to `$set` partial updates |
| `backend/src/controllers/order.js` | Branch between DoorDash & Uber Direct services; save `deliveryProvider` per order; use `order.deliveryProvider` for cancel/refresh; update log messages |
| `backend/src/index.js` | Mount new webhook route + add raw body preservation for webhook routes |
| `backend/.env` | Add `UBER_DIRECT_*` variables |
| `admin-panel/src/pages/StoreSettings.tsx` | Add delivery provider dropdown with state management |
| `customer-panel/src/pages/Billing/Billing.jsx` | Generic error/legal copy |
| `customer-panel/src/pages/order/index.jsx` | Generic delivery partner copy |

## Files Left Unchanged (DoorDash preserved)
- `backend/src/services/doorDashService.js`
- `backend/src/controllers/doorDashWebhook.js`
- `backend/src/routes/doorDashWebhook.js`
- `backend/src/email-templates/order.html`

## Verification Plan
1. **Settings API:** `PUT /api/settings` with `deliveryProvider: 'uberdirect'`, then `GET /api/settings` to confirm persistence. Also save operating hours separately and confirm `deliveryProvider` is **not** wiped.
2. **Quote Flow:** With provider set to `uberdirect`, trigger checkout address verification in customer panel. Verify Uber Direct quote API is called and `deliveryFee` is returned correctly.
3. **Create Order:** Place a test order. Verify the Uber Direct delivery creation API is called, the order document has `deliveryId`, `trackingUrl`, `deliveryStatus`, and `deliveryProvider: 'uberdirect'` populated.
4. **Webhook Signature Rejection:** POST a payload to `/api/webhooks/uberdirect` with an invalid `x-uber-signature` header. Confirm 401 is returned and the order is **not** updated.
5. **Webhook Simulation:** POST a properly-signed Uber Direct webhook payload to `/api/webhooks/uberdirect` and confirm the order status updates (e.g., `pickup_complete` → `shipped`).
6. **Cancel Flow:** Cancel an active Uber Direct order from the admin panel and confirm the Uber Direct cancellation API is called (POST, not PUT).
7. **Refresh Status:** Trigger a manual status refresh and confirm Uber Direct status is polled and mapped correctly.
8. **DoorDash Fallback:** Switch `deliveryProvider` back to `doordash`, place an order, and confirm DoorDash flows still work unchanged. Verify old Uber Direct orders can still be cancelled/refreshed using the stored `order.deliveryProvider`.
9. **Admin UI:** Confirm the Store Settings page renders and saves the provider dropdown. Confirm operating hours save does not reset the provider.
10. **Alcohol Verification:** Place an order containing alcohol products. Confirm the Uber Direct payload includes `dropoff_verification.identification.enabled: true`.

## Resolved Design Decisions
| Topic | Decision | Rationale |
|-------|----------|-----------|
| OAuth2 scope | `eats.deliveries` | Confirmed via Uber Developer Dashboard. `direct_deliveries` is deprecated. |
| Base URL | `https://api.uber.com/v1/customers/{customerId}/deliveries` | v1 is current. Sandbox/production controlled by app credentials, not URL. |
| Tip handling | Omit from Uber Direct payload | Uber handles tips via consumer tracking link. Including it would cause API rejection. |
| Alcohol payload | `dropoff_verification.identification.enabled: true` | Uber's structure differs from DoorDash's `id_verification: "required"`. |
| Webhook signature | HMAC-SHA256 via `x-uber-signature` header — **mandatory** | Without it, anyone can POST fake status updates. Use `crypto.timingSafeEqual` to prevent timing attacks. |
| Cancel HTTP method | POST (not PUT) | Uber Direct uses `POST .../deliveries/{id}/cancel`. DoorDash uses `PUT .../deliveries/{id}/cancel`. |
| Per-order provider | Store `deliveryProvider` on Order model | Required for cancel/refresh routing on existing orders when the global setting may have changed. |
| Settings update pattern | Use `$set` with partial field updates | Prevents saving store hours from wiping `deliveryProvider` and vice versa. |
