# Option C — anonymous cart repricing verification

Date: 2026-10-29

## Outcome

Deployed the backend and customer panel only. The previously failing anonymous restored cart now displays CONUNDRUM WHITE x2 at $47.98, with the current $23.99 unit price persisted. No product documents were modified, no payment was created, and the unrelated backup service was not changed. Admin and Mongo container IDs remained unchanged.

## Endpoint survey and scope

- Reused existing public `GET /api/products?ids=<comma-separated IDs>&limit=<batch size>&page=1` through `ProductService.allProducts`.
- Public list responses are `{ success: true, data: Product[], total, count }`, HTTP 201, with raw `price`, `priceSale`, `saleEndsAt`, ID and availability.
- Existing status, stock, real-photo and price-range filters remain applied. Omitted products are treated as unavailable, not deleted from the cart.
- A live pre-change probe returned `total:1,data:[]` for a known product: `safeObjectId` returns strings and Mongo aggregation does not cast IDs. Fixed only the ID-filter block in the existing product controller: validated BSON ObjectIds, first 100 input entries, invalid-only/wrong-typed filters fail closed.
- No new endpoint. Did not reuse POST /api/cart, which fails the entire cart when any line is missing/unavailable and does not preserve raw sale semantics in its response.
- `backend/src/routes/order.js` compared byte-for-byte with its pre-deploy running-container version. `verifyToken` remains on POST /api/orders/cart-summary. Live anonymous HTTP probe returned 401.
- Final order/payment calculator behavior was not changed by Option C.

## Display behavior

- All anonymous product lines are refreshed on cart entry, even when saved prices look valid. Persisted verification markers are not authority.
- IDs are deduplicated, validated locally, and requested in batches of at most 50. Empty/invalid ID sets do not query the catalog.
- `sellingPrice()` resolves current raw data and expired flash sales. Missing/deleted/unpriced/failed-batch lines receive no effective price.
- Loading hides cached prices and disables checkout. Unavailable lines remain identifiable, show "Price unavailable", hide aggregate totals, and expose Retry prices.
- Fresh fields are allow-list merged into still-existing Redux cart lines and localStorage without replacing quantities or resurrecting removed lines.
- Anonymous quantity-only changes use this mount's fresh product data, without another product lookup. Refresh/remount fetches again. A known sale-expiry boundary triggers refresh.
- Anonymous totals are explicitly estimated product subtotals; tax, markup, shipping and bundle discounts are deferred to authenticated checkout, never fabricated as zero.
- Explicit bundle lines require sign-in for an authoritative deal quote. A sign-in action is provided; anonymous product refresh does not mark saved bundles unavailable for subsequent authenticated checkout.
- Billing blocks unavailable local products until a successful authenticated summary supplies valid unit prices. Summary prices can repair legacy authenticated stale carts. No authorization or payment-policy configuration was changed.

## Automated verification

- Frontend: 15 suites, 104 tests passed, zero failures.
- Targeted backend: 31 passed, zero failures (public ID lookup, sale pricing, calculator pricing and P1/P2 controls).
- Full backend suite: 212 tests, 199 passed, 10 failed, 3 skipped. All ten failures remain the known subcategory integration fixture connection failures at 127.0.0.1:27017, not new pricing/lookup failures. Full log: /tmp/optionc-backend-suite.log.
- Both production builds succeeded using the documented privileged `roma-compose build <service>` alternative. No host npm production build was run, and this report does not claim `hermes verify` succeeded.
- Candidate image proof checked BSON ID conversion and preserved cart-summary middleware; panel proof checked new pricing/retry strings and bundle fingerprint.
- Source diff whitespace check passed with existing CRLF convention recognized (`git -c core.whitespace=cr-at-eol diff --check`).

## Stage gates and images

Rollback tags were created from actual running image IDs before either build:

- `project-roma-backend:rollback-optionc-pre-20261029T165316Z`
  - sha256:8e9863e649604d5c024172e2f9e27ae329cf0c813498d69cc0a9e42a3339b3a2
- `project-roma-customer-panel:rollback-optionc-pre-20261029T165316Z`
  - sha256:56e2f3150cde83fdb3dfe7735d84eb5ba30ca46f4a7b4fdfc7fd18e53aef7023

Pinned names remain `project-roma-<service>:policies-20261029`. The documented alternate build path writes directly into those pinned names; no rollback image was promoted as a candidate.

1. Backend build and candidate proof passed.
2. Backend-only recreate: `sudo /usr/local/sbin/roma-compose up -d --no-build --pull never --no-deps backend`.
3. Live backend batch lookup returned the known product at 23.99, unknown IDs were omitted, malformed IDs failed closed, protected summary returned 401, store status returned 200.
4. Frontend Docker production build and candidate proof passed.
5. Loopback candidate preview passed six browser scenarios using real backend responses through a test-only read proxy. The first direct-preview attempt hit expected CORS restrictions; proxy teardown was corrected before accepting the preview run. Application CORS was not changed. Preview exit status ultimately 0.
6. Customer-panel-only recreate with the same no-build/no-pull/no-deps flags.
7. Public production browser acceptance passed with NO preview proxy. Exit status 0.

Running backend:
`sha256:a429246bc813da61789862434bdba7c3c5ce998334eae17f6b423c17a8b5f655`

Running customer panel:
`sha256:53ad57d4cd25016cf4739e9fb1b1abf3f748522b2f8a27332ceca1d9cf504472`

Verified candidate and live JS fingerprint: `/static/index-DQlrdoLU.js`.

Temporary loopback preview container was removed after verification. The deployment preceded the pricing-only source commit documented in the finalization record below. Unrelated deployed work remains outside that commit. Nothing was pushed.

## Production acceptance results

Read-only Playwright script: `customer-panel/test/anonymous-cart-pricing.cjs`. Non-read API methods are blocked except verified catalog-search reads. localStorage is changed only inside the isolated test browser.

- Stale anonymous cart (price null, priceSale/salePrice 0): $47.98 for quantity 2; saved raw priceSale 23.99, price null.
- Quantity change to 3: $71.97, no extra product lookup.
- Browser refresh: new product lookup, quantity and $71.97 restored.
- Nonexistent valid ID mixed with a valid product: both lines retained; missing line shows unavailable; aggregate total unavailable; checkout disabled. No database deletion was performed.
- Induced network failure: item retained, unavailable display, checkout disabled. Retry against the real API recovers $47.98.
- Five total batch product requests across the six scenarios; zero protected-summary requests from the anonymous cart; zero page JavaScript errors.
- Public site HTTP 200; live bundle and image ID match candidate.
- Additional catalog smoke: 12 homepage cards with no $0.00; CONUNDRUM WHITE $23.99; LA CREMA CHARDONNAY $27.99/$23.99; VEUVE CLICQUOT BRUT $85.99/$79.99; product purchase buttons enabled for those priced samples; no page JavaScript errors.

Evidence:
- /tmp/optionc-production-results.json
- /tmp/optionc-preview-final.json
- /tmp/optionc-catalog-smoke.json
- /tmp/optionc-frontend-final.log
- /tmp/optionc-backend-targeted.log
- /tmp/optionc-deploy-state.json

## Remaining risks / limitations

- The ten existing Mongo fixture integration failures prevent claiming a fully green host backend suite.
- Authenticated recovery and Billing guards were covered by automated component tests, not a real authenticated production browser/payment session. No Stripe test-mode PaymentIntent or real charge was created.
- Public catalog filters intentionally exclude hidden/out-of-stock/no-photo products and may exclude regular-only products with no priceSale; such lines fail closed and require correction/removal rather than silently using saved prices.
- Anonymous bundle lines require sign-in; product subtotal estimates do not promise checkout-level bundle savings, fees or tax.
- Prices can change after the read; final checkout/payment remains independently database-authoritative.
- The unrelated backup-service issue remains as previously documented; this rollout neither repaired it nor claims a new encrypted backup.

## Root cause

The CSV catalog commonly has `price: null` with its only selling price in `priceSale`. Discount-only logic and normalization treated the missing regular price as zero/no valid sale, then persisted zero sale prices. Those local cart entries no longer contained enough information to recover their actual price. Backend consumers also needed an explicit distinction between a genuine discount, a sale-only CSV selling price, and an unpriced product.

The first pricing fix restored catalog and backend pricing semantics, but anonymous stale carts still fell back to local values after the intentionally authenticated cart-summary returned 401. Option C retrieves fresh raw product data through the public catalog instead of weakening authentication. The public batch lookup also needed validated string IDs converted to BSON ObjectIds because aggregation does not apply Mongoose query casting.

## Pricing-only source finalization

No production application source was edited, no service was redeployed, no product documents were changed, and no payment was enabled or created during finalization.

The index was assembled from explicit pricing-only hunks, not blanket `git add`. Mixed checkout, policy/legal, privacy, accessibility, admin-management and presentation changes remain unstaged. Mixed untracked test files were similarly staged as pricing-only excerpts; their unrelated test portions remain in the working tree. A clean snapshot of HEAD plus the index was tested separately so untracked policy/config files could not accidentally satisfy missing commit dependencies.

Fresh exact-index regression results:

- Backend: 23 passed, zero failed (sale semantics, authoritative order calculator, public ID lookup).
- The complete backend suite present in the isolated index snapshot passed: 107 tests, zero failures. The unrelated, untracked Mongo fixture tests are deliberately excluded from this pricing-only snapshot; this does not resolve their working-tree connection failures.
- Frontend: 7 suites, 63 passed, zero failed (sale pricing, hydration, Redux persistence, cart states/restoration/races, Billing guards/recovery, pricing portions of product-card tests).
- The complete frontend suite in that isolated index snapshot also passed: 10 suites, 69 tests, zero failures. The full deployed working-tree suite was rerun separately: 15 suites, 104 tests, zero failures.
- These are the isolated pricing commit's counts, distinct from the accepted deployment's broader 104 frontend / 31 targeted backend checks above.
- Full staged-blob heuristic secret scan and artifact-path checks found no secrets, environment files, database dumps, private keys, logs, build output, caches or temporary artifacts selected for commit. Test fixture placeholders are not real credentials. Existing unrelated `__pycache__` output remains excluded.
- Whitespace checks recognize the repository's existing CRLF files. Canonical `hermes verify --json` remains blocked by `.env.local` permissions; this finalization does not claim it passed and does not alter protected file permissions.

### Files selected for the pricing commit

Backend source:
- `backend/src/controllers/cart.js`
- `backend/src/controllers/home.js` (sale-expiry projections only)
- `backend/src/controllers/order.js` (per-line summary prices only)
- `backend/src/controllers/product.js` (batch ID conversion and sale-expiry projections only)
- `backend/src/controllers/wishlist.js` (sale-expiry projection only)
- `backend/src/utils/mixBundle.js`
- `backend/src/utils/orderCalculator.js` (pricing only, excluding unrelated goods-policy changes)
- `backend/src/utils/salePricing.js`

Backend regression tests:
- `backend/tests/orderCalculator-pricing.test.js`
- `backend/tests/product-id-lookup.test.js`
- `backend/tests/salePricing.test.js`

Customer source:
- `customer-panel/src/components/deal-card/index.jsx`
- `customer-panel/src/components/product-card/index.jsx` (pricing only)
- `customer-panel/src/pages/Billing/Billing.jsx` (pricing only)
- `customer-panel/src/pages/cart/Cart.jsx` (pricing only)
- `customer-panel/src/pages/collections/index.jsx` (sale-expiry forwarding only)
- `customer-panel/src/pages/home/index.jsx` (sale-expiry forwarding only)
- `customer-panel/src/pages/product/index.jsx` (pricing only)
- `customer-panel/src/pages/wishlist/index.jsx` (sale-expiry forwarding only)
- `customer-panel/src/redux/cartSlice.js`
- `customer-panel/src/utils/cartRepricing.js`
- `customer-panel/src/utils/salePricing.js`

Customer regression tests / read-only acceptance script:
- `customer-panel/src/components/product-card/ProductCard.test.jsx` (pricing excerpt)
- `customer-panel/src/pages/Billing/Billing-repricing.test.jsx` (pricing excerpt)
- `customer-panel/src/pages/Billing/Billing.test.jsx` (pricing excerpt)
- `customer-panel/src/pages/cart/Cart.test.jsx` (pricing excerpt)
- `customer-panel/src/redux/cartSlice.test.js`
- `customer-panel/src/utils/cartRepricing.test.js`
- `customer-panel/src/utils/salePricing.test.js`
- `customer-panel/test/anonymous-cart-pricing.cjs`

Documentation:
- `docs/OPTION_C_CART_REPRICING_2026-10-29.md`
- `docs/PRICING_SOURCE_PROVENANCE_2026-10-29.json`

### Source-to-image correspondence

The running backend's 144 source files match the current working tree byte-for-byte. A separate, network-disabled Docker build-stage reproduction used the original storefront build record's public build arguments and matched all 110 frontend source files. All six compiled static assets matched the running customer-panel assets byte-for-byte. An actual browser loaded the public main bundle and confirmed SHA-256 `23f37a2bf1005ce93cafabb34ec3f35d1944841c8ed0aa5c608c85e002d7dba0` for `/static/index-DQlrdoLU.js`. A direct non-browser hash request was blocked by HTTP 403; browser verification succeeded.

The source-proof build targets only the build stage under a separate tag; it does not rebuild or replace the running production images. A first offline full-image attempt stopped at Alpine package-index access, so the successful reproduction deliberately omitted the unrelated nginx packaging stage. Existing running image IDs, pinned tags and rollback tags were left unchanged.

`PRICING_SOURCE_PROVENANCE_2026-10-29.json` records deployed/full-worktree hashes separately from pricing-only index hashes for mixed files. The deployed images contain pre-existing unrelated work; the pricing-only commit must not be misrepresented as a byte-identical clean snapshot of the entire deployment. It captures the verified pricing delta independently, without absorbing that other work.
