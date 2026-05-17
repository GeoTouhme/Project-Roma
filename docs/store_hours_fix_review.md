# Store Hours Fixes — Code Review

**Reviewed:** April 16, 2026
**Scope:** All files changed in commit `9957f5c` against the 9 bugs in `store_hours_analysis.md`

---

## Bug-by-Bug Verdict

| # | Bug | Severity | Status | Notes |
|---|-----|----------|--------|-------|
| 1 | Next-open-day logic uses array index | 🔴 Critical | ✅ **Fixed** | Now sorts by `dayOfWeek` and compares `h.dayOfWeek > dayOfWeek` |
| 2 | No try/catch in `checkStoreHours` middleware | 🔴 Critical | ✅ **Fixed** | Wrapped in try/catch, fails open on error |
| 3 | Customer panel has zero store-hours integration | 🔴 Critical | ✅ **Fixed** | Full Redux slice + global banner + cart/billing guards |
| 4 | Admin panel can't change timezone | 🟡 Medium | ✅ **Fixed** | Added `Select` dropdown with 7 US timezones |
| 5 | Sunday schedule inconsistent | 🟡 Medium | ✅ **Fixed** | Sunday default changed from `23:59` → `02:00` to match weekdays |
| 6 | No validation on operating hours input | 🟡 Medium | ✅ **Fixed** | Validates 7 days, dayOfWeek 0–6, HH:mm regex, no duplicates |
| 7 | Docs say `/api/store/hours` instead of `/status` | 🟢 Low | ✅ **Fixed** | CLAUDE.md now says `GET /api/store/status` |
| 8 | Delivery quote endpoint not guarded | 🟢 Low | ✅ **Fixed** | `checkStoreHours` middleware added to delivery-quote route |
| 9 | Closed message doesn't include day name | 🟢 Low | ✅ **Fixed** | Message now says `"We will be open on ${nextOpenDay.day} at..."` |

### ✅ All 9 bugs are fixed.

---

## Detailed Review Per File

### Backend

#### `checkStoreHours.js` — ✅ Correct
- **BUG #1 fix** (line 56–57): Sorts `operatingHours` by `dayOfWeek` before searching. Uses `h.dayOfWeek > dayOfWeek` instead of `index > dayOfWeek`. ✅ 
- **BUG #2 fix** (line 70–84): `checkStoreHours` middleware now wrapped in try/catch with fail-open behavior. ✅
- **BUG #9 fix** (line 60): Message includes `${nextOpenDay.day}`. ✅

#### `settings.js` (controller) — ✅ Correct
- **BUG #6 fix** (lines 26–53): Thorough validation added:
  - Checks `operatingHours.length === 7` ✅
  - Validates `dayOfWeek` is a number 0–6 ✅
  - Checks for duplicate `dayOfWeek` entries using a `Set` ✅
  - Validates `HH:mm` format with regex `/^([01]\d|2[0-3]):[0-5]\d$/` ✅

#### `settings.js` (model) — ✅ Correct
- **BUG #5 fix** (line 30): Sunday now `close: '02:00'` matching the weekday pattern. ✅

#### `order.js` (routes) — ✅ Correct
- **BUG #8 fix** (line 11): `checkStoreHours` middleware added to `delivery-quote` route. ✅

### Admin Panel

#### `StoreSettings.tsx` — ✅ Correct
- **BUG #4 fix**: Added `US_TIMEZONES` array and a `Select` dropdown (lines 13–21, 104–119). ✅
- Timezone state is managed via `useState` and initialized from fetched settings (line 34, 50–52). ✅
- The payload now sends the user-selected `timezone` (line 80) instead of just passing through the API value. ✅

### Customer Panel

#### `storeStatusSlice.js` — ✅ Correct
- New Redux slice with `fetchStoreStatus` async thunk. ✅
- `initialState.isOpen` defaults to `true` (fail-open). ✅
- On rejection, fails open (`state.isOpen = true`). ✅

#### `storeService.js` — ✅ Correct
- Calls `GET /api/store/status`. URL correctly uses `${API_BASE_URL}store/status`. ✅

#### `store.js` (Redux config) — ✅ Correct
- `storeStatusReducer` registered under key `storeStatus`. ✅

#### `App.js` — ✅ Correct
- Dispatches `fetchStoreStatus()` on mount in `AppContent`. ✅
- Renders a red banner when `!isOpen` with the server's `message`. ✅
- Banner placement is above everything (including `AgeGate`), which ensures visibility. ✅

#### `Cart.jsx` — ✅ Correct
- Reads `storeIsOpen` from Redux (line 12). ✅
- "Proceed to checkout" button is `disabled={!storeIsOpen}` (line 126). ✅
- Button text changes to `"Store is Closed"` when closed (line 128). ✅

#### `Billing.jsx` — ✅ Correct
- Reads `storeIsOpen` from Redux (line 28). ✅
- "Place Order" button is `disabled` when `!storeIsOpen` (line 593). ✅
- Button gets dimmed styling when store is closed (line 595). ✅

### Documentation

#### `CLAUDE.md` — ✅ Correct
- **BUG #7 fix** (line 151): Updated from `/api/store/hours` to `/api/store/status`. ✅

---

## Minor Observations (Non-blocking)

> [!NOTE]
> These are not bugs — just small improvements to consider later.

1. **No periodic refresh of store status** — The customer panel fetches store status once on app load but doesn't poll. If a customer keeps the tab open past closing time, they won't see the banner until they refresh. Consider adding a 5-minute polling interval:
   ```javascript
   useEffect(() => {
     dispatch(fetchStoreStatus());
     const interval = setInterval(() => dispatch(fetchStoreStatus()), 5 * 60 * 1000);
     return () => clearInterval(interval);
   }, [dispatch]);
   ```

2. **`isStoreOpen()` itself has no try/catch** — The `isStoreOpen` function (lines 5–66) doesn't wrap its DB call in try/catch. The `checkStoreHours` middleware catches errors, but the `GET /api/store/status` route in `store.js` calls `isStoreOpen()` directly without try/catch either. If MongoDB is down, that route will 500.

3. **Timezone validation missing** — The controller validates hours format but doesn't validate that `timezone` is a valid IANA timezone string. An invalid timezone passed to `moment().tz()` will silently fail.

---

## Final Verdict

### ✅ All 9 bugs from the original analysis are fixed correctly. Good work!

The implementation is clean, consistent, and follows the project's existing patterns (Redux Toolkit for customer panel, TanStack Query for admin panel, Express middleware pattern on the backend).
