# Cloudflare Free Tier Pre-Integration Audit
**Project Roma (Bal-Port Liquors)**
**Audit Date: 2026-08-01**
**Status:** Code-level fixes applied on 2026-08-01. Cloudflare dashboard and host firewall configuration still required before enabling orange-cloud proxy.

---

## 1. DNS & Domain

**Status:** Found

**Details:**

- Three domains in use, all with Let's Encrypt SSL certs:
  - `balportliquors.com` (customer panel → proxy to `127.0.0.1:3000`)
  - `admin.balportliquors.com` (admin panel → proxy to `127.0.0.1:5173`)
  - `invoices.balportliquors.com` (separate invoice app → proxy to `127.0.0.1:5000`)
- Origin server IP: `31.97.132.106` (documented in CLAUDE.md)
- All services bind to localhost only in docker-compose.yml:
  - MongoDB: `127.0.0.1:27017`
  - Backend: `127.0.0.1:5001`
  - Customer panel: `127.0.0.1:3000`
  - Admin panel: `5173` (**NOTE: this one is NOT bound to 127.0.0.1**)
- Host nginx terminates SSL on 443 and proxies to localhost containers
- Hardcoded domains found in:
  - `backend/src/index.js` lines 24, 57, 102–103 (CORS fallback + CSP connectSrc)
  - `docker-compose.yml` lines 39, 51, 63, 78 (ALLOWED_ORIGINS, FRONTEND_URL, build args)
  - `customer-panel/src/config/EnvironmentConfig.js` lines 2, 7, 13 (BASE_URL)
  - `admin-panel/src/lib/api.ts` line 5 (API_URL fallback)
- WebSocket usage: Socket.IO is used for real-time admin notifications
  - `backend/src/index.js` lines 13, 22–36 — Socket.IO server on same port as Express
  - Proxied through host nginx at `/socket.io/` (both customer and admin nginx configs)
  - JWT-authenticated via cookie in handshake (`backend/src/config/socketAuth.js`)

**IMPORTANT:** Admin panel port 5173 in `docker-compose.yml` line 81 is mapped as `"5173:80"` (not `127.0.0.1:5173:80`), meaning it is exposed on ALL interfaces. The host nginx proxies to `127.0.0.1:5173`, but the container port is publicly accessible on the origin IP if firewall is inactive (which it is — ufw shows "inactive").

**Action needed before Cloudflare integration:**

- **DNS:** Migrate A records for `balportliquors.com`, `www.balportliquors.com`, and `admin.balportliquors.com` to Cloudflare (orange-cloud proxied). The invoices subdomain can be added too or left grey-clouded.
- **Port 5173 exposure:** ✅ Fixed. Admin panel in `docker-compose.yml` now binds to `127.0.0.1:5173:80`, preventing direct public access to the admin panel on the origin IP. Traffic must go through host nginx (basic auth) and Cloudflare.
- **WebSocket:** Cloudflare Free tier supports WebSocket on proxied records, but ensure the `/socket.io/` path is not cached by Cloudflare (create a Page Rule or Cache Rule to bypass cache for `/socket.io/*`).
- **Non-HTTP ports:** No service expects traffic on non-80/443 ports from the public internet (all host nginx listens on 80/443). Cloudflare only proxies 80/443 by default.

---

## 2. IP & Origin Trust

**Status:** Found — CRITICAL

**Details:**

- Express trust proxy is set to 1 (`backend/src/index.js` line 45):
  ```js
  app.set('trust proxy', 1);
  ```
  This tells Express to trust exactly ONE proxy hop (the host nginx). With Cloudflare in front, the proxy chain becomes:
  ```
  Client → Cloudflare → Host Nginx → Docker Nginx → Backend
  ```
  That is 3+ hops. `trust proxy=1` will make Express use the wrong IP (it will use the Docker gateway IP or Nginx IP instead of the real client IP).

- IP extraction is done manually in multiple places, always reading `X-Forwarded-For[0]`:
  - `backend/src/index.js` lines 158–165 (`getClientIp` function for rate limiting)
  - `backend/src/index.js` lines 232–235 (`authLimiterInternal` keyGenerator)
  - `backend/src/routes/auth.js` lines 40–43 (`authLimiter` keyGenerator)
  - `backend/src/controllers/analytics.js` line 27 (`req.ip` stored for page view tracking)

- None of these read `CF-Connecting-IP`. They all parse `X-Forwarded-For` manually.

- With Cloudflare, the `X-Forwarded-For` header will be:
  ```
  <real_client_ip>, <cloudflare_edge_ip>
  ```
  Cloudflare appends the real client IP. The host nginx then appends `$remote_addr` (which will be Cloudflare's IP). The code takes `[0]` which would still be the real client IP — BUT only if no client spoofed an XFF header. Cloudflare overwrites XFF[0] with the real client IP, so this is actually OK as long as Cloudflare is the first hop.

- However, Express's `req.ip` relies on trust proxy setting. With `trust proxy=1`, `req.ip` uses the last entry in XFF (the one added by the immediate predecessor — host nginx), which would be the Cloudflare edge IP, not the real client IP.

**Action needed before Cloudflare integration:**

- **CRITICAL:** ✅ Fixed. Express trust proxy in `backend/src/index.js` now uses the specific Cloudflare IP ranges plus `127.0.0.1`:
  ```js
  app.set('trust proxy', [...CLOUDFLARE_IP_RANGES, '127.0.0.1']);
  ```
  This ensures `req.ip` resolves to the real client IP behind Cloudflare → host nginx → Docker.
- ✅ Fixed. Client IP extraction is now centralized in `backend/src/utils/getClientIp.js`. It reads `CF-Connecting-IP` first, falls back to leftmost `X-Forwarded-For`, then `req.ip`. This util is used by:
  - `backend/src/index.js` (`createLimiter` and `authLimiterInternal`)
  - `backend/src/routes/auth.js` (`authLimiter`)
  - `backend/src/controllers/analytics.js` (page view tracking)
- ✅ Fixed. Defense-in-depth middleware added to `backend/src/index.js`. It attaches `req.realIp` (via `CF-Connecting-IP`/`X-Forwarded-For`) and `req.cfRay` to every request and logs warnings in production when a request reaches the origin without a `CF-Ray` header. Webhooks are logged separately and never blocked, preserving provider reliability. Hard blocking remains the responsibility of the host nginx Cloudflare allow-list.
- ✅ Fixed. `backend/src/controllers/analytics.js` now uses `req.realIp || getClientIp(req)` instead of `req.ip || req.connection.remoteAddress`.
- ✅ Fixed. New defense-in-depth middleware in `backend/src/index.js` attaches `req.realIp` and `req.cfRay` for all requests and logs warnings for requests reaching the origin without a `CF-Ray` header (webhooks are logged separately, never blocked).

---

## 3. SSL/TLS

**Status:** Found

**Details:**

- Origin uses Let's Encrypt certificates (`fullchain.pem` + `privkey.pem`) for all three domains:
  - `/etc/letsencrypt/live/balportliquors.com/`
  - `/etc/letsencrypt/live/admin.balportliquors.com/`
  - `/etc/letsencrypt/live/invoices.balportliquors.com/`
- Host nginx terminates SSL on port 443 and proxies to containers over HTTP (`127.0.0.1:3000`, `:5001`, `:5173`)
- HTTP (port 80) redirects to HTTPS via 301 for all domains
- Backend Express server itself does NOT do TLS — it runs plain HTTP on port 5001
- Container nginx configs listen on port 80 only (no TLS inside containers)
- The backend sets `upgradeInsecureRequests` in CSP when `NODE_ENV=production` (`index.js` line 125)
- Cookie `secure: true` is set in production (`auth.js` line 48)
- HSTS is set by BOTH host nginx AND helmet (`index.js` lines 128–133):
  - Host nginx: `max-age=63072000` (2 years)
  - Helmet: `max-age=31536000` (1 year)
  - These are duplicate and have mismatched max-age values.
- Hardcoded `https://` URLs: Many (CORS origins, CSP directives, frontend config). These are correct for the domain and won't cause mixed content since Cloudflare will serve HTTPS to clients.
- One `http://` reference in CSP connectSrc: `'http://localhost:5001'` (`index.js` line 104) — this is a development leftover but could cause CSP violations if a browser tries to connect to it. Not a Cloudflare issue per se, but should be cleaned up.

**Action needed before Cloudflare integration:**

- **SSL Mode:** Set Cloudflare to "Full" (not "Flexible"). The origin has valid Let's Encrypt certs. "Full (strict)" is even better since the certs are valid and not self-signed. Using "Flexible" would cause redirect loops because the origin nginx redirects HTTP to HTTPS, and Cloudflare Flexible would try to connect to the origin via HTTP.
- **HSTS duplication:** Decide whether HSTS should come from Cloudflare or from origin. Having both is not harmful but the mismatched max-age (2 years vs 1 year) is inconsistent. Consider disabling HSTS in helmet and letting Cloudflare manage it, or aligning the max-age values.
- **Let's Encrypt renewal:** With Cloudflare proxying traffic, the ACME HTTP-01 challenge may fail because Cloudflare intercepts the `.well-known/acme-challenge` requests. Either:
  - (a) Use DNS-01 challenge instead (recommended), or
  - (b) Temporarily grey-cloud (DNS-only) the domain during renewal, or
  - (c) Create a Cloudflare Page Rule to bypass cache/proxy for `/.well-known/acme-challenge/*`
- ✅ Fixed. The `http://localhost:5001` entry in CSP connectSrc (`backend/src/index.js`) has been removed.

---

## 4. Caching & Static Assets

**Status:** Found (partial)

**Details:**

- Static files served by Express: `backend/src/index.js` line 338:
  ```js
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  ```
  No cache-control headers are set on this path. These are user-uploaded images (though most images go to Cloudinary).
- Container nginx serves static frontend bundles via `try_files` (`customer-panel/nginx.conf`, `admin-panel/nginx.conf`). No explicit cache-control or expires directives.
- Host nginx: No cache-control or expires directives for `balportliquors.com` or `admin.balportliquors.com` server blocks.
- Host nginx DOES set `expires 7d` for `/static/` on the invoices subdomain (not relevant to Roma).
- CSV export endpoint sets `Content-Disposition: attachment` (`product.js` line 848) — this is dynamic and should NOT be cached.
- Dynamic API routes: All `/api/` routes are proxied to the backend. These include:
  - Auth endpoints (login, register, OTP, password reset)
  - Cart, orders, wishlist, payment intents
  - Admin CRUD operations
  - Webhooks (`/api/webhooks/stripe`, `/api/webhooks/doordash`, `/api/webhooks/uberdirect`)
  - Analytics tracking (`/api/track-view`)
  - Store status, settings
- Product browsing routes (GET `/api/products`, categories, brands, reviews) are public read and could potentially be cached, but currently set no cache-control headers.

**Action needed before Cloudflare integration:**

- Create Cloudflare Cache Rules to ensure all `/api/*` routes are NOT cached (Bypass Cache). This is critical — caching API responses would break authentication, cart, orders, and real-time data.
- The `/socket.io/*` path must be excluded from caching (WebSocket upgrade).
- Static assets from the frontend build (JS, CSS, images with hashed filenames) CAN be cached by Cloudflare. The container nginx serves them via `try_files` but doesn't set explicit cache headers. Cloudflare will cache based on file extension by default, which is acceptable.
- The `/uploads` path (Express static) could be cached but currently has no cache headers. Consider adding cache-control headers if these are immutable images.
- The `/api/webhooks/*` endpoints must not be cached or challenged by Cloudflare — see Section 6.

---

## 5. Security Headers & Existing Protections

**Status:** Found

**Details:**

- **Helmet middleware** (`backend/src/index.js` lines 128–138):
  - HSTS: `max-age=31536000`, `includeSubDomains`, `preload`
  - CSP: Full policy with directives (`defaultSrc`, `scriptSrc`, `styleSrc`, `fontSrc`, `imgSrc`, `connectSrc`, `frameSrc`, `objectSrc`, `baseUri`, `formAction`, `frameAncestors`)
  - `upgradeInsecureRequests` in production
  - Other helmet defaults (`X-Content-Type-Options`, etc.) are active via `helmet()` defaults
- **Host nginx also adds (duplicate) security headers:**
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Frame-Options: SAMEORIGIN` (main site) / `DENY` (admin)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Rate limiting** (express-rate-limit v7):
  - Tiered limiters: `publicReadLimiter` (8000/15min), `apiLimiter` (6000/15min), `adminLimiter` (50000/15min), `pollLimiter` (3000/15min), `authLimiter` (100/15min for non-admins)
  - Admin/super-admin users bypass rate limiting via JWT role detection
  - Key generators use IP or token for bucketing
- No existing WAF or bot protection beyond rate limiting
- CSP `frameAncestors` is set to `'none'` (`index.js` line 120), while host nginx sets `X-Frame-Options: SAMEORIGIN` for the main site. These are contradictory — CSP `frameAncestors:'none'` takes precedence in modern browsers.

**Action needed before Cloudflare integration:**

- **HSTS:** Both helmet and host nginx set HSTS with different max-age values. Cloudflare Free also offers HSTS. Decide on a single source. Recommendation: Disable HSTS in helmet, keep it on host nginx, and optionally enable it in Cloudflare with the same max-age.
- **CSP:** Cloudflare does not set CSP by default (that's a paid feature). The existing helmet CSP will continue to work. No conflict expected.
- **X-Frame-Options:** Both helmet and nginx set this. Not harmful but redundant. Cloudflare may add its own via "Security headers" settings. Align to avoid conflicts.
- **Rate limiting:** The express-rate-limit will continue to work behind Cloudflare, but ONLY if the trust proxy and IP extraction are fixed (see Section 2). Otherwise all requests will appear to come from Cloudflare's IP and rate limiting will be ineffective (everyone shares one bucket) or overly aggressive (one Cloudflare IP triggers limits for everyone).
- Cloudflare's "Browser Integrity Check" and "Bot Fight Mode" (Free tier) can be enabled but may interfere with webhook endpoints — see Section 6.

---

## 6. API Endpoints & Webhooks

**Status:** Found — CRITICAL

**Details:**

Three webhook endpoints exist:

### 1. Stripe Webhook
- **Route:** `POST /api/webhooks/stripe` (`backend/src/routes/stripeWebhook.js`)
- Mounted BEFORE `bodyParser.json` (`index.js` lines 328–329) to preserve raw body
- Raw body preserved via bodyParser `verify` hook (`index.js` lines 146–150)
- Signature verification: `stripe.webhooks.constructEvent(req.rawBody, signature, secret)` (`stripeWebhook.js` line 22)
- Reads `stripe-signature` header
- Always returns 200 to prevent Stripe retries

### 2. DoorDash Webhook
- **Route:** `POST /api/webhooks/doordash` (`backend/src/routes/doorDashWebhook.js`)
- Currently **DISABLED**/commented out (`index.js` lines 331–332)
- Uses Basic Auth (configured in DoorDash Developer Portal)
- No signature verification in code — relies on Basic Auth
- Uses `req.body` (parsed JSON, not raw body)

### 3. Uber Direct Webhook
- **Route:** `POST /api/webhooks/uberdirect` (`backend/src/routes/uberDirectWebhook.js`)
- Currently **DISABLED**/commented out (`index.js` line 332)
- HMAC-SHA256 signature verification using `req.rawBody` (`uberDirectWebhook.js` lines 15–18)
- Reads `x-uber-signature` header
- Uses `crypto.timingSafeEqual` for constant-time comparison

### 4. Analytics tracking endpoint
- **Route:** `POST /api/track-view` (`backend/src/routes/analytics.js`)
- Public, no auth — accepts page view data from the frontend

**Action needed before Cloudflare integration:**

- **CRITICAL for Stripe:** Cloudflare must NOT modify the request body. By default Cloudflare does not modify POST bodies, but ensure:
  - The `/api/webhooks/stripe` path is set to "Bypass Cache" in Cloudflare
  - Cloudflare's "Bot Fight Mode" (Free tier) may challenge Stripe's webhook requests. Create a WAF exception rule for `/api/webhooks/*` to skip bot challenges.
  - If Cloudflare's "Rocket Loader" or other optimization features are enabled, they should not affect API endpoints (they target HTML/JS), but verify.
- **Signature verification:** The raw body must arrive unmodified. Cloudflare does not modify request bodies on standard proxy, so Stripe and Uber signature verification should work. However, if Cloudflare's "Always Use HTTPS" or other redirect features cause the webhook to be redirected, the POST body may be lost on the redirect. Ensure webhooks go directly to the correct HTTPS endpoint.
- **DoorDash webhooks** are currently disabled but if re-enabled, Basic Auth should work through Cloudflare as long as the auth header is forwarded (it is, by default).
- Create a Cloudflare WAF custom rule to allow webhook traffic:
  - Rule: `(http.request.uri.path contains "/api/webhooks/")` → Skip (All managed rules, Bot Fight Mode)
- The `/api/track-view` endpoint is called from the browser, so it will work through Cloudflare normally. No special handling needed beyond cache bypass.

---

## 7. Authentication & Sessions

**Status:** Found

**Details:**

- JWT authentication via HttpOnly cookies (`backend/src/controllers/auth.js` lines 44–57):
  - `httpOnly: true`
  - `secure: true` (in production only)
  - `sameSite: 'strict'`
  - `path: '/'`
  - `domain`: derived from `FRONTEND_URL` env var (e.g., `.balportliquors.com`) in production
  - `maxAge`: configurable (passed as parameter)
- Token is NOT stored in localStorage or returned in response body — fully cookie-based
- Both admin and customer panels use `withCredentials: true` in Axios (`admin-panel/src/lib/api.ts` line 15, `customer-panel/src/interceptor/fetchInterceptor.jsx` line 7)
- Socket.IO authentication reads the JWT cookie from the WebSocket handshake (`backend/src/config/socketAuth.js`)
- CORS configuration (`index.js` lines 48–68):
  - Reads `ALLOWED_ORIGINS` from env (comma-separated)
  - Falls back to: `https://balportliquors.com`, `https://admin.balportliquors.com`
  - Allows requests with no Origin header (server-to-server)
  - `credentials: true`
- MFA (TOTP) is implemented via speakeasy (`auth.js` lines 68–71 routes)
- `SameSite=Strict` means the cookie will NOT be sent on cross-site requests, including navigations from other sites. This is the most restrictive setting.

**Action needed before Cloudflare integration:**

- **Cookies:** The `secure:true` + `sameSite:'strict'` settings are correct for Cloudflare HTTPS. No changes needed. Cloudflare terminates TLS and forwards to origin over HTTPS (with Full/Full Strict mode), so the browser sees HTTPS and secure cookies will be sent.
- **CORS:** The `ALLOWED_ORIGINS` env var is already configurable. No changes needed for Cloudflare since the domains remain the same. However, if Cloudflare's "Always Use HTTPS" redirects are enabled, ensure the CORS origins are all `https://` (they already are).
- **SameSite=Strict:** This is fine for Cloudflare. No issue.
- **Cookie domain:** The `.balportliquors.com` domain cookie will work correctly through Cloudflare since the domain doesn't change.
- **Socket.IO cookie auth:** The WebSocket upgrade request carries the cookie. Cloudflare supports WebSocket and will forward cookies. No changes needed, but verify WebSocket connections work after enabling Cloudflare proxying (orange cloud).

---

## 8. Environment & Config

**Status:** Found

**Details:**

- Secrets stored in `/etc/project-roma/.env` (symlinked from `/var/www/Project-Roma/.env`)
- Key env vars relevant to Cloudflare:
  - `ALLOWED_ORIGINS=https://balportliquors.com,https://www.balportliquors.com,https://admin.balportliquors.com`
  - `FRONTEND_URL=https://balportliquors.com`
  - `PORT=5001`
  - `NODE_ENV=production` (set in `docker-compose.yml` line 24)
- No existing Cloudflare-related env vars (no `CF_*`, no `CLOUDFLARE_*`)
- No env var for trusted proxy IP ranges — the trust proxy is hardcoded to 1
- No env var for origin port or scheme
- Docker Compose port mappings:
  - Backend: `127.0.0.1:5001:5001` (localhost only — good)
  - MongoDB: `127.0.0.1:27017:27017` (localhost only — good)
  - Customer panel: `127.0.0.1:3000:80` (localhost only — good)
  - Admin panel: `5173:80` (**ALL INTERFACES — security concern**)
- Host firewall (ufw) is **INACTIVE** — no port-level filtering
- iptables INPUT chain has policy ACCEPT with no rules

**Action needed before Cloudflare integration:**

- ✅ Trust proxy and IP extraction now hardcode Cloudflare IP ranges in the Express app (`backend/src/index.js` and `backend/src/utils/getClientIp.js`). No env var changes required.
- ✅ Admin panel port binding restricted to `127.0.0.1` in `docker-compose.yml`.
- ✅ Host firewall (ufw) enabled with only 22, 80, 443 allowed. All other incoming ports blocked.
  ```bash
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw enable
  ```
- ✅ Nginx access restricted to Cloudflare IP ranges + localhost for `balportliquors.com`, `www.balportliquors.com`, and `admin.balportliquors.com`. Direct origin access now returns `403`.
- ✅ Let's Encrypt `/.well-known/acme-challenge/` path allowed from any IP in nginx for HTTP-01 fallback.
- ⬜ (Optional) Add `TRUSTED_PROXY_RANGES` env var if you want the Cloudflare IP list to be configurable without a code change.

---

## Priority List

Ordered from "must fix before enabling Cloudflare" to "can configure after".

### BLOCKERS (must fix before enabling Cloudflare proxy)

| # | Priority | Item | File / Location | Problem | Fix | Status |
|---|----------|------|-----------------|---------|-----|--------|
| 1 | CRITICAL | Fix trust proxy setting | `backend/src/index.js` line 45 | `trust proxy=1` with 3+ hop chain breaks IP detection, rate limiting, analytics | Set to Cloudflare IP ranges + `127.0.0.1` | ✅ Fixed |
| 2 | CRITICAL | Bind admin panel to localhost only | `docker-compose.yml` line 81 | `"5173:80"` exposes admin on all interfaces, bypasses Cloudflare + nginx auth | Change to `"127.0.0.1:5173:80"` | ✅ Fixed |
| 3 | CRITICAL | Set Cloudflare SSL mode to Full (strict) | Cloudflare dashboard | "Flexible" mode causes infinite redirect loops | Set SSL/TLS → Full (strict) | ⬜ Cloudflare dashboard |
| 4 | HIGH | Create WAF exception for webhook endpoints | Cloudflare dashboard → `/api/webhooks/*` | Bot Fight Mode may block Stripe/DoorDash/Uber webhooks | WAF custom rule: skip all managed rules + bot fight for `/api/webhooks/*` | ⬜ Cloudflare dashboard |
| 5 | HIGH | Create Cache Rules to bypass cache for dynamic content | Cloudflare dashboard → `/api/*`, `/socket.io/*` | Caching API responses breaks auth, cart, orders, WebSocket | Cache Rule: bypass cache for `/api/*` and `/socket.io/*` | ⬜ Cloudflare dashboard |

### IMPORTANT (should fix shortly after enabling Cloudflare)

| # | Priority | Item | File / Location | Problem | Fix | Status |
|---|----------|------|-----------------|---------|-----|--------|
| 6 | HIGH | Switch IP extraction to CF-Connecting-IP | `backend/src/index.js` (getClientIp, authLimiterInternal), `backend/src/routes/auth.js` | Manual XFF[0] parsing works but is spoofable if origin is hit directly | Read `req.headers['cf-connecting-ip']` first, fall back to XFF[0], then `req.ip` | ✅ Fixed |
| 7 | MEDIUM | Enable host firewall (ufw) | Server OS level | ufw inactive, iptables policy ACCEPT; all container ports accessible | `ufw allow 80/tcp`, `ufw allow 443/tcp`, `ufw allow 22/tcp`, `ufw default deny incoming` | ✅ Fixed |
| 8 | MEDIUM | Restrict origin access to Cloudflare IPs only | Host nginx or ufw rules | Port 80/443 open to everyone; attackers can bypass Cloudflare WAF | Configure nginx/ufw to only allow inbound 80/443 from Cloudflare IP ranges (https://www.cloudflare.com/ips/) | ✅ Fixed (nginx allow/deny) |
| 9 | MEDIUM | Handle Let's Encrypt renewal behind Cloudflare | Server certbot config | ACME HTTP-01 challenge intercepted by Cloudflare proxy | Switch to DNS-01 challenge, or create Page Rule to bypass proxy for `/.well-known/acme-challenge/*` during renewal | ⬜ Manual server config |
| 10 | LOW | Resolve duplicate HSTS headers | Helmet (`index.js` lines 128–133) + host nginx | Helmet sets max-age=31536000, nginx sets 63072000 — inconsistent | Pick one source (recommend nginx), disable in helmet | ✅ Fixed |
| 11 | LOW | Remove `http://localhost:5001` from CSP connectSrc | `backend/src/index.js` line 104 | Dev artifact in production CSP | Remove the entry or gate behind `NODE_ENV` check | ✅ Fixed |

### CAN CONFIGURE AFTER (post-integration tuning)

| # | Priority | Item | File / Location | Notes |
|---|----------|------|-----------------|-------|
| 12 | LOW | Add cache-control headers to `/uploads` static path | `backend/src/index.js` line 338 | Currently no cache headers; could benefit from Cloudflare CDN caching for uploaded images |
| 13 | LOW | Consider Cloudflare caching for public read API endpoints | GET `/api/products`, `/api/categories`, `/api/brands`, `/api/reviews` | Public read-only, could be cached at edge with short TTLs; requires careful Cache Rule config |
| 14 | INFO | Enable Cloudflare "Always Use HTTPS" | Cloudflare dashboard | Origin already redirects HTTP→HTTPS; this does it at the edge, reducing origin requests |
| 15 | INFO | Enable Cloudflare "Automatic HTTPS Rewrites" | Cloudflare dashboard | App already uses HTTPS everywhere; this is a no-op but harmless |
| 16 | INFO | DISABLE Cloudflare "Rocket Loader" | Cloudflare dashboard | Customer panel is CRA, admin panel is Vite; Rocket Loader can break SPA JavaScript bundles |
| 17 | INFO | Resolve X-Frame-Options vs CSP frameAncestors contradiction | Helmet `frameAncestors:'none'` vs nginx `X-Frame-Options: SAMEORIGIN` | CSP takes precedence in modern browsers; align these if frame embedding is intentionally allowed on main site |

---

## Summary of Code Changes (2026-08-01)

| File | Change |
|------|--------|
| `docker-compose.yml` | Admin panel port bound to `127.0.0.1:5173:80` |
| `backend/src/index.js` | Trust proxy set to Cloudflare IP ranges + localhost; CSP `localhost:5001` removed; rate limiters use `getClientIp()`; defense-in-depth middleware attaches `req.realIp`/`req.cfRay` and logs missing CF-Ray headers |
| `backend/src/utils/getClientIp.js` | New centralized, Cloudflare-aware client IP extractor |
| `backend/src/routes/auth.js` | Auth limiter uses `getClientIp()` |
| `backend/src/controllers/analytics.js` | Page view IP tracking uses `req.realIp \|\| getClientIp(req)` |
| `backend/src/controllers/auth.js` | Security events (register, login, password reset, OTP resend/verify) now log the Cloudflare-aware client IP |
| `backend/src/controllers/order.js` | New orders store `clientIp` from `req.realIp` for fraud/audit tracking |
| `backend/src/models/Order.js` | Added `clientIp` field to Order schema |

## Still Required in Cloudflare Dashboard / Server

1. **Cloudflare DNS:** Orange-cloud `balportliquors.com`, `www.balportliquors.com`, `admin.balportliquors.com`.
2. **SSL/TLS mode:** Set to **Full (strict)**.
3. **WAF rule:** Skip Bot Fight Mode / managed rules for `http.request.uri.path contains "/api/webhooks/"`.
4. **Cache rules:** Bypass cache for `/api/*` and `/socket.io/*`.
5. **Host firewall:** Enable ufw, allow only 22, 80, 443.
6. **Let's Encrypt:** Switch certbot to DNS-01 or create a Page Rule to bypass proxy during renewal.

*End of Audit*