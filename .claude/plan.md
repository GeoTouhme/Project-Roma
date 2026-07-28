# Plan: Fix Admin Dashboard 429 Errors on Notifications

## Problem
The admin dashboard shows repeated `AxiosError: Request failed with status code 429` when fetching notifications. The notification bell polls `/api/admin/notifications` every 10 seconds, and that endpoint currently shares the generic `apiLimiter` (1000 requests / 15 min) with all other admin mutating routes (orders, products, dashboard analytics, etc.). Active admin work can exhaust the shared bucket, causing the bell (and other admin requests) to be rate-limited.

## Diagnosis
- Nginx has **no** `limit_req` rate limiting — confirmed by grep.
- `express-rate-limit` is the source of the 429s.
- `NotificationBell.tsx` polls every 10 s and logs every failure to the console, so one rate-limit burst creates many visible errors.
- `/api/admin/notifications` is mounted under the generic `apiLimiter` in `backend/src/index.js`.

## Proposed fix
1. **Add a dedicated `pollLimiter`** for high-frequency polling endpoints.
   - 600 requests / 15 min per user (≈ 40 polls/min or one every 1.5 s), still bucketed by JWT token.
2. **Move `/api/admin/notifications` onto `pollLimiter`** instead of `apiLimiter`.
3. **Bump the generic `apiLimiter`** from 1000 to 1500 / 15 min to give active admin work more headroom.
4. **Slow the notification bell poll interval** from 10 s to 30 s to reduce noise and load while staying responsive.
5. **Add a small console-rate-limit guard** in `NotificationBell.tsx` so repeated failures don’t spam the browser console, and pause polling briefly after a 429.

## Files to change
- `backend/src/index.js` — add `pollLimiter`, apply it to notification routes, bump `apiLimiter`.
- `admin-panel/src/components/NotificationBell.tsx` — change poll interval to 30 s; skip one poll cycle after a 429; suppress repeated identical error logs.

## Trade-offs
- Slightly slower "new order" notification refresh (30 s vs 10 s). Still reasonable for a liquor-store admin flow.
- More permissive `apiLimiter` marginally increases abuse surface, but it remains per-user-token and well below public-read limits.

## Verification
- Rebuild backend container and confirm `/api/admin/notifications` no longer shares the generic limit.
- Check that active navigation/searches in admin panel no longer trigger notification 429s.
