# Plan: Fix Admin Panel 429 Errors Across Pages

## Problem
After the notification fix, the user reports that the admin dashboard and other admin pages still show `AxiosError: Request failed with status code 429` for products, etc. The issue is not the notification polling alone.

## Diagnosis
1. The rate-limit key generator in `backend/src/index.js` uses `req.cookies?.token`.
2. In production behind Nginx+Docker, `req.ip` appears as the Docker gateway IP, so unauthenticated requests fall back to `ip:${ipKeyGenerator(req.ip)}` and all users behind the proxy share one bucket.
3. For authenticated requests, **every valid JWT is a different token** because the admin panel login issues a new 7-day token each login, but more importantly the **rate limit counts requests, not users**, and a single admin page load triggers many parallel API calls (products, categories, orders, analytics, notifications) all bucketed by the same token. That can still exhaust even a 1500/15min bucket during active work.
4. The product routes are mounted under `publicReadLimiter` (2000/15min) for user-facing `/products`, but the **admin product endpoints** (`/api/admin/products`, `/api/admin/products/:slug`, `/api/admin/products/import-csv`, `/api/admin/products/export-csv`) are inside the same `productRoutes` file and therefore also fall under `publicReadLimiter`. Wait — actually they are mounted via `app.use('/api', publicReadLimiter, productRoutes);`. So admin product routes currently use the 2000/15min public limit, not `apiLimiter`. That should not 429 easily.

Let’s reconsider: the user explicitly says `/api/admin/products` and other pages return 429. The 429 message is generic. The rate-limit headers showed `RateLimit-Limit: 2000` when I hit the server locally without a real cookie, but **with a real JWT cookie the limit bucket is `user:<token>`**. If the admin opens multiple tabs or the app makes many requests in quick succession, the 2000 request public bucket does not apply — the `publicReadLimiter` key for authenticated users is actually also `user:${token}` because `req.cookies.token` exists. Wait, that means admin product requests are in the same `user:<token>` bucket as every other authenticated route. With 1500/15min for apiLimiter and 2000/15min for publicReadLimiter, but both keyed by token, a heavy admin session can hit the lower `apiLimiter` bucket because the same token is used across all routes.

Actually the 429 likely comes from `apiLimiter` (1500/15min) being shared by `dashboardRoutes`, `userRoutes`, `cartRoutes`, `OrderRoutes`, `paymentRoutes`, `wishlistRoutes`, `couponCodeRoutes`, `delete_fileRoutes`, `uploadRoutes`. Admin pages that load products also trigger dashboard, orders, user profile, upload, etc. The **admin-specific** endpoints need their own higher bucket.

## Proposed fix
1. **Create an `adminLimiter`** bucket specifically for admin-only routes.
   - 3000 requests / 15 min per admin user token.
2. **Move the following admin-only route files to `adminLimiter`:**
   - `dashboardRoutes` (`/api/admin/analytics`, `/api/admin/dashboard-analytics`)
   - `notificationRoutes` (already on `pollLimiter`, keep it)
   - `productRoutes` admin endpoints (but the public user endpoints `/products` should stay on `publicReadLimiter`).

Wait — Express middleware is applied per-router mount, not per-route inside the router. If we mount `productRoutes` under `adminLimiter`, the public `/products` endpoints also get it, which is fine (3000/15min is generous), but it mixes admin and public buckets. Simpler and safer is to mount `productRoutes` under `adminLimiter` and leave public product access untouched? No — the public product routes are in the same file and would also be affected.

Alternative: split the rate-limit key strategy instead of splitting the limiters. For authenticated admin users, use a **per-user email** key instead of per-token, so repeated logins don't create new buckets, and we can raise the admin limit. But we don't have the user email inside the limiter middleware easily without decoding JWT.

Better approach:
1. Increase `apiLimiter` to **4000/15min** (still a reasonable DoS ceiling for authenticated users).
2. Increase `publicReadLimiter` to **3000/15min**.
3. Make `pollLimiter` **1200/15min**.
4. Most importantly, **fix the unauthenticated bucket explosion**: Nginx forwards `X-Forwarded-For`; `ipKeyGenerator(req.ip)` may resolve to `127.0.0.1` or the Docker gateway. For unauthenticated requests we should use the **X-Forwarded-For header** (first IP) instead of `req.ip` when behind Nginx, otherwise every visitor shares the same bucket and legitimate traffic can 429.

Actually `express-rate-limit` `ipKeyGenerator(req.ip)` already reads the leftmost `X-Forwarded-For` because `trust proxy` is set. But `req.ip` itself is set from the header chain. The issue is when `req.ip` becomes the Docker network gateway (e.g. `172.x.x.1`) because of how Docker routes.

So the real comprehensive fix:
1. **Use `X-Forwarded-For` first IP explicitly** in the key generator if no token, to avoid all unauthenticated traffic hitting one bucket.
2. **Raise all limits** for authenticated users to prevent active admin sessions from being throttled.
3. **Add an admin-specific limiter** for admin-only routers (dashboard, notifications, product admin endpoints, user admin endpoints, orders admin endpoints, etc.) at a higher ceiling.

## Detailed implementation

### Backend `src/index.js`
- Add `getClientIp(req)` helper that returns the first IP from `X-Forwarded-For` or `req.ip`.
- Update `createLimiter` key generator:
  - If token exists: `user:${token}`.
  - Else: `ip:${getClientIp(req)}`.
- Add `adminLimiter = createLimiter(4000, 15, 'Too many admin requests')`.
- Keep `apiLimiter = createLimiter(2500, 15, ...)` (slightly higher).
- Keep `publicReadLimiter = createLimiter(3000, 15, ...)`.
- Keep `pollLimiter = createLimiter(1200, 15, ...)`.
- Mount admin-only routers under `adminLimiter`:
  - `dashboardRoutes` → `adminLimiter`
  - `notificationRoutes` → `adminLimiter`? But notifications are polling, so keep `pollLimiter`.
  - `userRoutes` contains both admin (`/admin/users`) and user (`/users/profile`, `/users/change-password`, `/users/invoice`). Mount under `apiLimiter` is fine; admin user endpoints are not called heavily.
  - `OrderRoutes` contains admin and user endpoints. It is called heavily by both. Leave under `apiLimiter` (now 2500).
  - `productRoutes` contains public `/products` AND admin `/admin/products`. We can mount the public routes under `publicReadLimiter` and admin routes under `adminLimiter` by splitting the router or by mounting at more specific paths. Simpler: mount `productRoutes` under a combined `publicReadLimiter` but the admin endpoints need higher. Alternatively, leave product routes as is and just raise `publicReadLimiter`.

Given the urgency and the user's complaint, the safest immediate change is to **raise all limits and fix the IP key generator**. We can do the admin-specific split as a follow-up if needed.

## Plan of changes
1. `backend/src/index.js`:
   - Add `getClientIp` helper.
   - Update `keyGenerator` to use it for unauthenticated requests.
   - Raise `apiLimiter` to 2500/15min.
   - Raise `publicReadLimiter` to 3000/15min.
   - Raise `pollLimiter` to 1200/15min.
2. Rebuild and redeploy backend.
3. Ask the user to refresh the admin panel and confirm the 429s are gone.

## Trade-offs
- Higher limits reduce DoS protection margin slightly, but they are still per-token/per-IP and far below what would stress the backend.
- Fixing the IP key prevents shared-proxy bucket exhaustion, which is the main production issue.
