# Store Hours Feature — Fix Report

**Project:** Project Roma (Bal-Port Liquors)
**Date:** April 16, 2026
**Status:** All 9 bugs resolved

---

## Executive Summary

This report documents all fixes applied to the Store Hours / Operating Hours feature across the backend and customer/admin panels, based on the `store_hours_analysis.md` audit.

---

## Bugs Fixed

### CRITICAL Bugs (3)

#### BUG #1 — "Next Open Day" logic used array index instead of `dayOfWeek` (CRITICAL)
**File:** `backend/src/middleware/checkStoreHours.js:56`

**Problem:** The code used `index > dayOfWeek` (array iteration index) instead of `h.dayOfWeek > dayOfWeek` (actual day number). If the MongoDB subdocument array was not sorted by `dayOfWeek`, this would return the wrong next open day.

**Fix:**
```diff
- const nextOpenDay = storeConfig.operatingHours.find(
-     (h, index) => index > dayOfWeek && h.isOpen
- ) || storeConfig.operatingHours.find(h => h.isOpen);
+ const sortedHours = [...storeConfig.operatingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
+ const nextOpenDay = sortedHours.find(
+     h => h.dayOfWeek > dayOfWeek && h.isOpen
+ ) || sortedHours.find(h => h.isOpen);
```

---

#### BUG #2 — No try/catch in `checkStoreHours` middleware (CRITICAL)
**File:** `backend/src/middleware/checkStoreHours.js:69-78`

**Problem:** If the database call in `isStoreOpen()` failed (MongoDB down, connection timeout), it would throw an unhandled promise rejection, crashing the request or even the server.

**Fix:**
```diff
  const checkStoreHours = async (req, res, next) => {
+    try {
         const { isOpen, message } = await isStoreOpen();
         if (!isOpen) {
             return res.status(400).json({
                 success: false,
                 message: message || "Sorry, the store is currently closed and cannot accept orders."
             });
         }
         next();
+    } catch (error) {
+        console.error('Store hours check failed:', error);
+        // Fail open: allow the order if the check itself fails
+        next();
+    }
  };
```

---

#### BUG #3 — Customer panel had ZERO store-hours integration (CRITICAL)
**Files:** Multiple customer-panel files

**Problem:** Customers could browse products, add to cart, enter billing/credit card info, and only then receive a "store closed" error — a terrible UX.

**Fix (5 files created/modified):**

1. **Created `customer-panel/src/services/storeService.js`** — Service to call `GET /api/store/status`

2. **Created `customer-panel/src/redux/storeStatusSlice.js`** — Redux slice with:
   - `fetchStoreStatus` async thunk
   - State: `isOpen`, `message`, `schedule`, `loading`, `error`
   - Fails **open** if API call fails (so store remains functional if status check is unavailable)

3. **Modified `customer-panel/src/redux/store.js`** — Added `storeStatusReducer` to Redux store

4. **Modified `customer-panel/src/App.js`** — Added:
   - `AppContent` component that dispatches `fetchStoreStatus()` on mount
   - Red banner displayed when `isOpen === false` showing the `message`

5. **Modified `customer-panel/src/pages/cart/Cart.jsx`**:
   - Added `storeIsOpen` from Redux state
   - Checkout button shows "Store is Closed" and is disabled when store is closed

6. **Modified `customer-panel/src/pages/Billing/Billing.jsx`**:
   - Added `storeIsOpen` from Redux state
   - "Place Order" button is disabled when store is closed

---

### MEDIUM Bugs (3)

#### BUG #4 — Admin panel couldn't change timezone (MEDIUM)
**File:** `admin-panel/src/pages/StoreSettings.tsx`

**Problem:** Timezone was read from API but the admin UI had no input to change it.

**Fix:**
- Added `US_TIMEZONES` array with 7 common US timezones
- Added shadcn/ui `Select` dropdown for timezone selection
- Timezone is now managed in local state and submitted with the form

```javascript
const US_TIMEZONES = [
    { value: 'America/New_York', label: 'Eastern Time (New York)' },
    { value: 'America/Chicago', label: 'Central Time (Chicago)' },
    { value: 'America/Denver', label: 'Mountain Time (Denver)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
    { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
    { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
];
```

---

#### BUG #5 — Sunday overnight hours inconsistent with rest of week (MEDIUM)
**File:** `backend/src/models/settings.js:30`

**Problem:** Sunday closed at `23:59` while Monday-Saturday all close at `02:00` (overnight). This created a 6+ hour "dead zone" where the store was incorrectly shown as closed between Sunday 23:59 and Monday 06:00.

**Fix:**
```diff
- { dayOfWeek: 0, day: 'Sunday', isOpen: true, open: '07:00', close: '23:59' },
+ { dayOfWeek: 0, day: 'Sunday', isOpen: true, open: '07:00', close: '02:00' },
```

---

#### BUG #6 — No server-side validation on operating hours input (MEDIUM)
**File:** `backend/src/controllers/settings.js`

**Problem:** The `updateSettings` controller only checked that `operatingHours` was an array. Malformed data (invalid times, wrong day numbers, duplicates) would pass through silently.

**Fix:** Added comprehensive validation in `updateSettings`:
- Validates exactly 7 days are provided
- Validates `dayOfWeek` is a number 0-6
- Detects and rejects duplicate `dayOfWeek` entries
- Validates `HH:mm` format for both `open` and `close` times using regex `/^([01]\d|2[0-3]):[0-5]\d$/`

---

### LOW Bugs (3)

#### BUG #7 — Documentation mismatch (LOW)
**File:** `CLAUDE.md:151`

**Problem:** Docs said `GET /api/store/hours` but actual route is `GET /api/store/status`

**Fix:** Updated CLAUDE.md to document the correct endpoint.

---

#### BUG #8 — Delivery quote endpoint not guarded by store hours (LOW)
**File:** `backend/src/routes/order.js:11`

**Problem:** `POST /api/orders/delivery-quote` was callable when store was closed, potentially giving customers false hope that they could place an order.

**Fix:**
```diff
- router.post('/orders/delivery-quote', orderRoutes.getDeliveryQuote);
+ router.post('/orders/delivery-quote', checkStoreHours, orderRoutes.getDeliveryQuote);
```

---

#### BUG #9 — "Next business day" message didn't include the day name (LOW)
**File:** `backend/src/middleware/checkStoreHours.js:60`

**Problem:** Message said "We will be open on the next business day at 6:00 AM" without specifying which day.

**Fix:**
```diff
- message = `We are closed today. We will be open on the next business day at ${openTime}.`;
+ message = `We are closed today. We will be open on ${nextOpenDay.day} at ${openTime}.`;
```

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/middleware/checkStoreHours.js` | BUG #1, #2, #9 |
| `backend/src/models/settings.js` | BUG #5 |
| `backend/src/controllers/settings.js` | BUG #6 |
| `backend/src/routes/order.js` | BUG #8 |
| `CLAUDE.md` | BUG #7 |
| `admin-panel/src/pages/StoreSettings.tsx` | BUG #4 |
| `customer-panel/src/App.js` | BUG #3 |
| `customer-panel/src/pages/cart/Cart.jsx` | BUG #3 |
| `customer-panel/src/pages/Billing/Billing.jsx` | BUG #3 |
| `customer-panel/src/redux/store.js` | BUG #3 |
| `customer-panel/src/redux/storeStatusSlice.js` | BUG #3 (new) |
| `customer-panel/src/services/storeService.js` | BUG #3 (new) |

---

## Summary Table

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | 🔴 Critical | Next-open-day logic used array index instead of `dayOfWeek` | ✅ Fixed |
| 2 | 🔴 Critical | No try/catch in `checkStoreHours` middleware | ✅ Fixed |
| 3 | 🔴 Critical | Customer panel had zero store-hours integration | ✅ Fixed |
| 4 | 🟡 Medium | Admin panel couldn't change timezone | ✅ Fixed |
| 5 | 🟡 Medium | Sunday schedule inconsistent with overnight pattern | ✅ Fixed |
| 6 | 🟡 Medium | No server-side validation on operating hours | ✅ Fixed |
| 7 | 🟢 Low | Docs said `/api/store/hours`, actual is `/api/store/status` | ✅ Fixed |
| 8 | 🟢 Low | Delivery quote endpoint not guarded by store hours | ✅ Fixed |
| 9 | 🟢 Low | "Next business day" message didn't include day name | ✅ Fixed |

---

## Testing Recommendations

1. **BUG #1:** Set a store's operating hours out of `dayOfWeek` order in MongoDB, close the store, and verify the "next open day" message shows the correct day
2. **BUG #2:** Temporarily stop MongoDB and attempt to place an order — server should not crash, request should proceed (fail open)
3. **BUG #3:** With store closed, browse to cart and billing pages — banner should appear and checkout should be disabled
4. **BUG #4:** Go to Admin > Store Settings and verify timezone dropdown works
5. **BUG #5:** Check Sunday's hours — should show "(Closes next day)" indicator
6. **BUG #6:** Try updating settings with invalid data (e.g., `close: "25:99"` or duplicate day) — should return 400 error
7. **BUG #7:** Verify `GET /api/store/status` endpoint exists and works
8. **BUG #8:** With store closed, call `POST /api/orders/delivery-quote` — should return 400 "store is closed"
9. **BUG #9:** With store closed on a known day, verify the closed message names the next open day (e.g., "open on Monday")
