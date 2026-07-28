# Plan: Resolve Persistent 429 Errors (Including Login)

## Current situation
- Admin dashboard/products/orders still show `AxiosError: Request failed with status code 429`.
- Login itself now returns 429 after the user logged out and tried again.
- Nginx has no rate limiting; the 429s are from `express-rate-limit`.

## Root causes identified
1. **Auth limiter is too tight:** `backend/src/routes/auth.js` limits auth endpoints to **20 requests per 15 minutes** per `email:ip`. Behind Nginx+Docker the IP is the Docker gateway, so the user alone can exhaust this bucket with a few failed login/MFA attempts.
2. **Authenticated limits are still too low for real admin usage:** Even after raising limits, the admin panel fires many parallel API calls on every navigation (products, categories, dashboard, orders, upload, notifications). The current ceilings are not generous enough for production admin work.
3. **Auth limiter does not use `X-Forwarded-For`:** It buckets by `req.ip`, which is the Docker gateway IP, making the non-email fallback bucket shared by all visitors.

## Proposed fix
1. **Raise auth limiter** in `backend/src/routes/auth.js`:
   - `max: 100` per 15 minutes (still blocks brute force, allows normal retries/MFA setup).
   - Use `getClientIp(req)` helper to use the real `X-Forwarded-For` IP.
2. **Raise all other limits much higher** in `backend/src/index.js`:
   - `publicReadLimiter`: 8000 / 15 min
   - `apiLimiter`: 6000 / 15 min
   - `adminLimiter`: 10000 / 15 min
   - `pollLimiter`: 3000 / 15 min
3. **Export `getClientIp` from index.js** or create a small shared helper so auth routes can reuse it (to avoid duplication). Simpler: just inline the same X-Forwarded-For logic in `auth.js`.
4. **Temporarily monitor**: after deploy, ask the user to refresh and confirm 429s stop.

## Files to change
- `backend/src/routes/auth.js` — raise `max` to 100 and use real client IP in key generator.
- `backend/src/index.js` — raise all limiter ceilings.

## Trade-offs
- Much more permissive. We accept this because the current limits are actively blocking legitimate admin use. The long-term fix is per-user-account bucketing (email/userId) rather than per-token, but that requires decoding JWT in middleware. For now we raise ceilings to unblock operations.
