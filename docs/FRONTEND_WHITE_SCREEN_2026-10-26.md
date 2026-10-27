# Storefront white-screen fix — approval required

**Status: Docker rebuilt from source and frontend-only fix deployed on 2026-10-26 at 10:31:56 UTC, after the owner instructed deployment.**

## Root cause

The deployed frontend image is `sha256:2f054b73b63d20ec35952910a7a115ff7c2274ed884f49d9ba277948636ca55f` (`project-roma-customer-panel:security-20261026-final`). Its HTML loads `/static/index-Bt1021BE.js`, SHA256 `27de1f8870c1e522ca1f4d489853df08d64eef1defb346fd03d2f617f6b5b226`.

The reported position `index-Bt1021BE.js:21:72131` falls in the minified `ProductCardSkeleton` component. Its array callback calls bare `React.createElement(...)`. The matching source is `customer-panel/src/components/skeleton/productCardSkeleton.jsx:7–8`: it imports `Skeleton` but has no React binding.

The Vite migration configured the automatic JSX runtime only in the custom transform for `.js` source files. `.jsx` files fell through to esbuild's classic JSX transform, which emits `React.createElement` and requires a React import. Six JSX modules have no such binding, including the skeleton and actual product card. Thus adding an import to only the first failing component would leave other paths exposed.

The real homepage reproduces `React is not defined` and leaves `#root` empty. The adjacent library code in the same bundle uses a properly bound React alias; there is no missing React CDN/global script to unblock. CSP is not the cause.

My earlier browser checks covered recovery pages and missed the homepage loading state. Jest uses its own automatic JSX preset, so those tests also did not expose the production compiler mismatch.

## Small fix

One production source change in `customer-panel/vite.config.mjs`:

```js
esbuild: { jsx: 'automatic' },
```

This makes `.jsx` compilation consistent with the existing `.js` transform and React's automatic runtime. No dependency, component, auth, CSP, backend, database, MFA or secret changes are needed.

Additional files are the browser regression script `customer-panel/test/production-render.cjs`, this report, and test evidence under `docs/frontend-white-screen-20261026/`.

## Candidate and validation

- Image: `project-roma-customer-panel:react-runtime-fix-20261026`.
- Exact image ID: `sha256:13f4c56debefa1786e6251544072b9b69b04acd642b2b24bdb6718a196bb5c86`.
- New entry: `/static/index-CiPbZdvq.js`, SHA256 `a84d0441fc26a0d3036bb6348fd317deae98fe259ccb4840d27dcdce73bcd7b3`.
- Production build succeeded; new bundle contains no bare `React.createElement` references.
- Existing tests: **3 suites / 6 tests passed**.
- Actual Chromium browser: homepage loading skeleton, desktop/mobile homepage, products, deals, login and recovery pages passed with **zero uncaught JavaScript errors**.
- The browser made **73 real read-only API requests** (70 HTTP 200 and 3 HTTP 201). **No API responses were mocked.** API writes such as analytics were blocked to avoid form/email/order operations.
- Static candidate responses were served under the production logical origin so the real API's CORS restrictions remained enabled and applicable. Testing a localhost page directly correctly fails the production API allowlist; no CORS setting was relaxed.
- Visually inspected the rendered homepage screenshot with real catalog content.
- Candidate and production Nginx configuration hashes are identical: `da3e169aa7588dfa6f82a79bad28e652f7df697c58ab9b0eb8cad99f20771b1c`.
- Enforced CSP, CSP Report-Only, HSTS, nosniff, frame and referrer headers match exactly. Nginx configuration test passed.
- Stripe publishable keys and Google client IDs in the compiled bundles are unchanged; values are omitted.
- Before approval, all production image IDs/start times were unchanged. The approved deployment changed only the frontend. Backend, MongoDB, admin, MFA and production secret configuration remain unchanged.

Evidence: [before failure](frontend-white-screen-20261026/before.json), [browser results](frontend-white-screen-20261026/after.json), [rendered homepage](frontend-white-screen-20261026/after.png), [unchanged security headers](frontend-white-screen-20261026/security-headers.json).

Reproduce the browser check against a temporary candidate frontend connected to the real read-only API:

```bash
PLAYWRIGHT_MODULE=/tmp/roma-browser-tests/node_modules/playwright \
STOREFRONT_URL=http://127.0.0.1:4300 \
STOREFRONT_ORIGIN=https://balportliquors.com \
node customer-panel/test/production-render.cjs
```

## Separate findings

CSP Report-Only and Google Analytics/network warnings are not treated as causes of the undefined React reference. The browser check additionally observed Google's nonfatal `[GSI_LOGGER]: Provided button width is invalid: 100%` warning. These were not changed as part of this minimal fix. Intentional analytics-write blocking also produces request-failure console messages; these are distinct from uncaught JavaScript exceptions, whose count is zero.

## Frontend-only deployment plan — requires explicit approval

1. Save the active frontend image selection and frontend metadata. The current image is already retained as `project-roma-customer-panel:rollback-react-white-screen-20261026`.
2. Change only the customer-panel image selection in the protected canonical image manifest to the verified candidate. Preserve all other service image selections and environment values.
3. Recreate **only** `customer-panel` using `--no-deps --no-build --pull never`. Preserve its IP, loopback port, read-only image mount, resource limits and security configuration.
4. Verify the new entry/hash, security headers, homepage loading/rendering and navigation with a browser, then record the frontend image/source hashes. Do not restart or change backend, MongoDB, admin or MFA.

## Frontend-only rollback

Restore only the previous customer-panel image selection (`sha256:2f054b73b63d20ec35952910a7a115ff7c2274ed884f49d9ba277948636ca55f`) and recreate only that service with `--no-deps`. This preserves the deployed security controls and leaves all other services unchanged. It restores the pre-fix state **including the known white-screen bug**; it is recovery from a new regression, not a resolution of the original error. Do not roll back to pre-security images or alter CSP/authentication to hide the failure.

The owner subsequently instructed a Docker rebuild and deployment. That approval was applied to the frontend-only plan above.

## Approved Docker rebuild and deployment

- Built the actual multistage `customer-panel/Dockerfile` from source with the existing browser-public build arguments. Production secrets were not changed.
- Deployed `project-roma-customer-panel:react-runtime-docker-fix-20261026`.
- Final image ID: `sha256:46843c7adf4b1b4d82916b4a72b3beae61d6d2f7f444c90f5c4baf88bca3f90e`.
- The source-rebuilt Docker image emits the same browser-tested entry `index-CiPbZdvq.js` and SHA256 recorded above.
- Recreated only the customer-panel container. The other production container IDs and start times stayed unchanged. Protected environment, Mongo backup config, encryption key and origin configuration hashes stayed unchanged.
- Post-deployment Chromium checks against the production-served assets passed all loading, desktop/mobile and navigation checks, with 73 actual API responses and zero uncaught JavaScript errors. API responses were not mocked; write requests were blocked. The loading-state test delays real catalog requests briefly to exercise the placeholder deterministically.
- Deployed frontend scan: zero HIGH/CRITICAL findings. Nginx and all security headers remain identical.
- Rollback directory: `/root/roma-frontend-react-fix-20261026T102735Z/`. Its rollback restores only the customer-panel image and restarts only that service.
- Public-hostname checks from this server are challenged by Cloudflare. This limits direct edge verification here; no Cloudflare, CSP or authentication setting was relaxed. The application fix is verified against the production-served build and real production APIs.

Evidence: [deployment record](frontend-white-screen-20261026/deployment.json), [post-deployment browser results](frontend-white-screen-20261026/live-after-deployment.json), [post-deployment screenshot](frontend-white-screen-20261026/live-after-deployment.png).
