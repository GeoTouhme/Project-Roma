# Project Roma / Balport — final production security audit

**Date:** 2026-10-24 UTC. **Disposition: remediation required; production security sign-off withheld.**

## Executive assessment

The deployed port restrictions, signed-JWT limiter fix, and Cloudflare origin peer gate materially reduce internet exposure. They do not establish application or host security. Confirmed defects remain in token-purpose separation, MFA enforcement, bundle eligibility, session revocation, payment-event processing, database access control, and container isolation. A compromised backend would have a path to host-level Docker control. Customer-data backup files are also insufficiently protected locally.

No evidence establishes a successful compromise. No real payment operation, production user mutation, order mutation, customer-document read, destructive probe, brute-force attempt, configuration change, deployment, service restart, or network/firewall modification was performed in this audit. Findings distinguish source-confirmed behavior, safe live metadata checks, offline reproductions, and unverified exploitation conditions.

Only this requested report was added to the project. Test fixtures, advisory results, and static-asset copies were placed under `/tmp/roma-final-audit`. An initial static-file copy included mounted product images; it was stopped and that temporary copy removed. The final scan copied only JS/CSS asset directories. Production images/data were not changed. Plutus and Brew Co remain stopped from the user's earlier instructions. Portainer was observed stopped during this audit; this audit did not stop it.

## Scope, method, and evidence quality

- Inventoried all backend source files and all route declarations; scanned all 110 backend JavaScript files for dangerous execution, network, filesystem, and query constructs. Manually followed authentication, account management, authorization, payment/order, pricing, uploads, and proxy trust flows. Reviewed frontend authentication, storage, HTML sinks, API clients, builds, and served assets. This is comprehensive risk coverage, not a claim that every behavior/branch was exhaustively tested.
- Independently inspected running container metadata, actual process/runtime versions, effective host/panel Nginx, listeners, Docker/UFW rules, database command/index metadata, file permissions, and selected logs. No prior report was treated as proof.
- Compared all **116 deployed backend source files** with local copies: all match. Both deployed panel Nginx configurations match local files. Deployed backend package-lock also matches the reviewed lockfile. Frontend source-to-bundle reproducibility was not independently established.
- Existing regression suites: **51 tests passed, zero failures**, using a temporary source copy, dummy test secrets, and host Node **22.23.2**. Production Node is independently verified as **22.23.4**. These tests exercise middleware in memory, not production endpoints or a production database.
- Additional offline assertions reproduced MFA/reset token confusion, API/admin acceptance of a reset-shaped token, reset-link origin injection, and bundle substitution. Database writes and mail were mocked; dummy keys/users/products only. Reproduction fixtures are `/tmp/roma-final-audit/security-probes.cjs`.
- Low-volume live probes used ordinary GETs and metadata commands. Two GETs from the image container compared direct versus panel-mediated spoofing. No crash/DoS advisory payload was sent to production.
- Current npm advisories were queried against isolated lockfile copies with scripts disabled. Scanner severity is reported separately from application exploitability. No OS/container CVE scanner was installed; full image SBOM/CVE assessment remains outstanding.

## Independently verified deployment and prior fixes

| Condition | Result | Evidence / limit |
|---|---|---|
| Production Node 22.23.4 | **PASS** | `docker exec balport-backend node --version` → `v22.23.4`. |
| F1 backend 5001 loopback only | **PASS** | Docker mapping and host socket both `127.0.0.1:5001`; NAT rule has loopback destination restriction. Independent external 5001 test not performed here. |
| Customer panel 3000 loopback only | **PASS** | Docker mapping, listener, and NAT destination restriction agree. Admin 5173 and image 8080 likewise loopback-only. |
| F2 rejection of forged CF/XFF at host boundary | **PASS for tested path** | Trusted Cloudflare Real IP ranges; host overwrites X-Real-IP/XFF and strips CF-Connecting-IP; direct origin requests are denied; 23 client-IP regressions pass. |
| F2 complete chain under a compromised neighboring-container threat | **FAIL** | Image container → backend rejects spoof; image container → customer-panel → backend accepts spoof. See R12. Existing tests omit that intermediate-proxy case. |
| F6 unsigned/expired/wrong-key JWT limiter bypass | **PASS** | Production source matches signature-verifying middleware; remaining 28 regression tests pass. No production limit buckets were exhausted. |
| F4 Stage 1 original-peer gate | **PASS for local probes** | All four Balport hosts reject forged direct-origin GETs with 403; Plutus SNI + API Host also 403; public API through Cloudflare 200. Effective gate uses `$realip_remote_addr`. |
| F4 independent external postdeployment test | **NOT VERIFIED** | Prior operator Windows result established predeployment HTTP 200 only. Current Windows retest was requested; no postdeployment result supplied during this audit. |
| Legitimate Cloudflare API traffic | **PASS for sampled traffic** | API 200; origin log shows Cloudflare-peer 2xx/101/204/304 traffic and no sampled peer-1 403/429/502/503. |
| Storefront/login/authenticated admin browser use | **NOT VERIFIED** | Curl receives pre-existing Cloudflare challenges on HTML routes; an authenticated real browser is required. |
| Reviewed security source is deployed | **PASS** | 116 matching source files, matching backend lockfile and both panel Nginx files. Git still has uncommitted security changes. |

Running backend image ID: `524dfe8a75b128507e70a3164cfe9e4b62e21e09bc3fdf99a617b0b39886e436`; admin `811e3fe76c14…`; customer `208244fd5052…`. Current addresses: gateway `.1`, Mongo `.2`, customer `.3`, admin `.4`, image `.5`, backend `.6` on `172.18.0.0/16`. Comments in the trust module reverse the panel labels; both addresses are trusted, so this particular swap currently does not break identification.

## Findings

### R01 — CRITICAL — backend has Docker daemon authority

**Component/evidence:** `docker-compose.yml:71`, `backend/Dockerfile`, `backend/src/utils/logAnalyzer.js:17`. Backend runs UID/GID 0 with `/var/run/docker.sock:ro`; socket mode 0660, UID 0. A read-only HTTP `GET /_ping` from the backend returned 200/OK. The purpose is fetching its own logs for the daily report.

**Prerequisite/impact/status:** Confirmed configuration and socket access; requires backend code execution or equivalent ability to issue Docker requests, not merely an ordinary customer account. A read-only bind mount does not make the socket API read-only. With an unrestricted rootful daemon this can enable launching host-mounted/privileged workloads and compromising all hosted projects. No mutating Docker API proof was attempted. [Docker daemon security](https://docs.docker.com/engine/security/).

**Remediation/risk:** Remove the socket from the application. Collect/redact logs via a host-controlled job or a narrowly restricted logging interface. Run the backend as an unprivileged user with minimal capabilities and no-new-privileges; evaluate a read-only root filesystem with explicit writable paths. Daily reports need a replacement log source; deploy separately with a brief backend recreation.

**Regression/verification:** App cannot open the Docker socket; no socket mount remains; application UID is nonroot; daily reporting still works through the replacement; checkout, uploads, and image paths remain functional.

### R02 — HIGH — JWT token-purpose confusion bypasses MFA and reset boundaries

**Component/evidence:** `backend/src/config/jwt.js:14`, `controllers/auth.js:159`, `:470`, `:512`; `middleware/adminCheck.js`; `controllers/googleAuth.js:163`. API middleware accepts any correctly signed JWT with no access-token purpose check. MFA temporary JWT contains `_id,mfa:true` with the same key. Password-reset JWT also contains `_id` and no purpose. Reset handler accepts any same-key JWT with `_id`. Google login issues a full pair without checking `mfaEnabled`.

**Prerequisite/impact/status:** Confirmed offline with exact middleware: dummy MFA and reset-shaped tokens pass authentication and a mocked current-admin database check; MFA token also reaches the mocked password update. Anyone who obtains the password-stage MFA token can bypass TOTP for the API; no admin Basic Auth is required to call API-host admin routes. Google inbox ownership also bypasses local MFA in that path. This does not mean unsigned JWTs work.

**Remediation/risk:** Distinct token purposes/audiences, strict claims and algorithms, and preferably separate keys for access, reset, email verification, and MFA challenges. Access middleware must require a completed-auth session and reject every challenge/reset token. Apply local MFA policy to Google/account-link/email-change recovery flows. Make reset tokens server-tracked, single-use, and short-lived. Existing sessions/reset links may need invalidation.

**Regression/verification:** Cross-product token-type tests against every consumer; MFA challenge cannot access `/auth/me`, profiles, or admin routes or reset passwords; Google login for an MFA-enabled account cannot issue a session until policy is satisfied; correct complete-auth paths remain valid.

### R03 — HIGH — password-reset link destination is client-controlled

**Component/evidence:** `controllers/auth.js:474`: reset URL is built from `req.body.origin`. An offline mail stub received a reset link pointing to `https://attacker.invalid`.

**Prerequisite/impact/status:** Confirmed source/offline behavior; attacker requests reset for a known account and persuades the recipient to follow the application's genuine email. The destination receives the signed reset token. No production mail was sent.

**Remediation/risk:** Build reset URLs from a fixed validated server configuration; never trust body/Host/forwarded-host for this purpose. Enforce single-use reset state and session revocation. Low implementation downtime; update frontend reset route compatibility.

**Regression/verification:** Attacker origin and Host values cannot alter the email destination; links expire, cannot replay, and target the expected frontend route. Also normalize known/unknown account response text/timing; current success messages differ.

### R04 — HIGH — authoritative bundle price does not enforce bundle contents

**Component/evidence:** `utils/orderCalculator.js:127`, `:193`, `:223`. Server reads a real deal/mix-bundle price but accepts client-selected `bundle.products`. It does not enforce Deal.productIds/quantity or MixBundle.conditions/requiredQty at that boundary. Offline mock: a synthetic $1 deal accepted a $1,000 product not belonging to it and charged $1.

**Prerequisite/impact/status:** Confirmed source/offline defect; production exploitation requires an active usable deal/bundle and successful payment of the incorrectly calculated amount. Active production bundle contents were not queried. Both payment intent and order creation share this calculator, so amount matching does not fix the mismatch. Client-supplied names/SKUs also influence regular-line display, and `item.price` survives in a fallback field used by discount calculations; remove that trust as part of the fix.

**Remediation/risk:** Reconstruct fixed bundles entirely from DB; validate every mix selection and aggregate quantity against rules; reject duplicates, unknown/missing members, disabled products, and invalid quantities. Use authoritative product metadata/prices throughout. Existing carts may need revalidation/repricing; no data migration should be assumed necessary.

**Regression/verification:** Substitution, missing/extra/duplicate members, excessive quantities, rule bypass, and price fallback tampering fail before payment creation. Legitimate deals and mix carts retain expected totals, tax, stock effects, and refunds.

### R05 — HIGH — logout/password changes do not revoke server-side sessions

**Component/evidence:** `controllers/auth.js:848` only clears cookies; `:555` updates password without revoking refresh state; `:1182` reads refresh hash then separately overwrites it through `issueTokenPair`. `controllers/user.js:changePassword` similarly does not revoke refresh state. Refresh has no verified/disabled-account gate. `config/socketAuth.js` trusts token role without checking current database role/status; existing sockets remain joined to admin.

**Prerequisite/impact/status:** Confirmed source behavior; exploitation needs a stolen still-valid access/refresh token or stale privileged session. A saved refresh token can survive browser logout/password recovery. Concurrent refreshes are not atomic one-time consumption. Replaying an old token clears only the caller's cookies, not the attacker's successor session. Database-backed HTTP adminCheck does recheck the current role, which limits that particular stale-role path.

**Remediation/risk:** Server-side session records/token families with atomic rotation and reuse revocation; revoke on logout, reset, password change, administrative disable and MFA policy changes. Check account state and current role for sockets and disconnect/revalidate existing privileged connections. Decide explicit multi-device policy. Customer/admin sessions may be logged out during migration.

**Regression/verification:** Copied refresh fails after logout/reset/disable; concurrent refresh cannot mint two accepted successors; detected reuse revokes the family; role downgrade removes socket access; email-unverified sessions cannot keep renewing against policy.

### R06 — HIGH — MongoDB lacks authentication on a shared application network

**Component/evidence:** `docker-compose.yml:15`; running `balport-mongo` **8.2.12**. Anonymous getCmdLineOpts succeeds, reports only bindIp `*` and no authorization; anonymous listDatabases succeeds (count only; names/documents not printed). API, both panels, MongoDB, and image service share one bridge. Database is correctly loopback-published on the host.

**Prerequisite/impact/status:** Confirmed access-control absence, not confirmed internet database exposure or customer-data theft. A reachable local process or compromised bridge member can access an unprotected database; metadata access was demonstrated, but reads/writes of customer documents were deliberately not attempted.

**Remediation/risk:** Separate database network membership to necessary backend/backup clients; enable auth on existing persisted data with distinct app/admin/backup identities; remove host publishing if unnecessary. Use verified TLS if crossing the accepted trust boundary. Do not expect initialization environment changes to safely configure an existing volume. Requires a backed-up, staged auth migration and brief database/API downtime.

**Regression/verification:** Anonymous privileged commands fail from the application network; unrelated containers cannot reach DB; app account has only required database privileges; backup/restore works; existing volume is preserved.

### R07 — HIGH — deployed runtime dependencies include current security advisories

**Component/evidence:** `backend/package-lock.json` equals deployed lock. npm audit: **23 affected package entries: 1 critical, 14 high, 8 moderate** (full dependency tree, not 23 independently exploitable internet bugs). Deployed examples: body-parser 1.20.6, Engine.IO 6.6.9, Multer 2.4.0, Axios 1.19.0, Nodemailer 9.1.1. Body-parser is globally enabled with default inflation before authentication/routing.

**Prerequisite/impact/status:** Vulnerable-version presence confirmed; most exploit paths remain untested. In particular [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) describes an unauthenticated compressed-body process crash fixed in body-parser 1.20.9/2.4.0. Do not send its payload to production. The critical [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) requires particular malformed IPv6 trust subnets; current exact IPv4/loopback trust configuration does not establish that prerequisite, so it is not evidence the tested F2 internet path fails.

**Remediation/risk:** Prioritize compatible runtime patches, starting with body-parser and reachable socket/parser paths; consider `inflate:false` if compressed bodies are unnecessary. Review every advisory's prerequisites. Update lockfiles in staging, use reproducible installs, and rebuild immutable images. Avoid blindly applying force/major-version audit fixes. API, multipart, auth/OAuth/mail, and socket compatibility require testing; backend recreation needed.

**Regression/verification:** Isolated crash tests and normal compressed/uncompressed body handling; socket protocol/malformed input tests; file-upload bounds; OAuth/mail/payment integrations; clean or documented residual advisory inventory for the exact deployed image.

### R08 — HIGH — Stripe webhook processing is not durable or idempotent

**Component/evidence:** `controllers/stripeWebhook.js:22` correctly verifies signature against preserved raw bytes, but `:40` sends 200 before DB handling; errors are then only logged. No event-ID ledger exists. `:48` resets order status to pending for succeeded events. `:83` increments refund totals using cumulative `amount_refunded` for each delivery.

**Prerequisite/impact/status:** Confirmed source defect; requires legitimate duplicate/out-of-order events or processing failures, not forged signatures. Replayed delivery can duplicate refund accounting/notifications, regress fulfilled/cancelled state to pending, or lose updates permanently after an acknowledged DB failure. No live event was replayed.

**Remediation/risk:** Verify, durably enqueue/persist event ID atomically, then acknowledge. Deduplicate events and business transitions, apply monotonic payment/order state rules, use absolute reconciled refund amounts or unique refund IDs, and make failures retryable. Invalid signatures should be non-2xx; returning 200 currently conceals a misconfigured secret, though it does not itself execute the event. Deploy with event reconciliation and controlled cutover, not blind replay.

**Regression/verification:** Offline signed test-mode fixtures: duplicate/reordered succeeded/failed/refunded events, partial/multiple refunds, database outage/restart, missing/malformed signature, raw-body modification, stale timestamp. Exactly one durable effect; no fulfilled-state regression; failures are observable/recoverable. [Stripe webhook guidance](https://docs.stripe.com/webhooks).

### R09 — HIGH — cancellation/refund/restock state transitions are not atomic

**Component/evidence:** `controllers/order.js:856`, `:958`, `:1031`, `:94`. Admin cancellation has no already-terminal check and restocks on every call. Customer cancellation/denial first reads pending, performs effects, then updates state. Refund creation lacks an idempotency key. Restock treats top-level bundle IDs as product IDs instead of restoring their components. Accept/deny updates are not compare-and-set. Denial writes `denied`, which is absent from Order.status enum, without validation in that update.

**Prerequisite/impact/status:** Confirmed unsafe code paths; actual concurrent financial effects not exercised. Admin retries or concurrent customer requests can repeat stock restoration and refund attempts; bundle stock may stay reduced. Stripe's own over-refund checks constrain actual refunded money but do not repair local accounting. R08 can make previously handled orders pending again.

**Remediation/risk:** Explicit atomic state machine with one transition owner, idempotent effect records/outbox, component-level stock restoration, and refund keys bound to order/action. Reconcile existing refund/stock errors before enabling changed workflow. Requires sandbox tests and possible manual reconciliation; no blind order migration.

**Regression/verification:** Parallel cancel/cancel, accept/cancel, deny/retry, provider error, partial refund, and mixed-bundle restock fixtures produce one authorized transition and exactly-once inventory/accounting effects.

### R10 — HIGH — customer-data backup files have broad local read permissions

**Component/evidence:** Metadata only: `/tmp/balport-20261024-112158.dump` is mode **0664**, ~8 MB; `/home/geo/balport-production-20260811.dump` also 0664. Contents were not opened. `/tmp` is a public traversal location. No application-specific scheduled backup/restore proof was identified; the OS dpkg-db-backup timer is not a MongoDB backup.

**Prerequisite/impact/status:** Confirmed insufficient permissions for the `/tmp` dump; any qualifying local user/process with filesystem access can read it. The home-directory dump additionally depends on `/home/geo` traversal permissions. No proof of exfiltration or verified restore exists.

**Remediation/risk:** Move backups to restricted directories/files (0700/0600), encrypt off-host copies, set retention/access/audit policy, and validate an isolated restore. Preserve the last known good copy during remediation. Permissions/location changes have little application downtime risk; scheduling consistent standalone backups may require quiescing writes.

**Regression/verification:** Unprivileged unrelated OS account cannot open backups; encrypted off-host restore succeeds with controlled keys; demonstrated recovery point/time and documented retention. Do not dump or restore production merely to close this audit item.

### R11 — MEDIUM — active production secrets use a loosely protected development env file

**Component/evidence:** `.env.local` mode **0664**, owned geo:geo; booleans confirm its JWT and Stripe secrets match runtime. `/home/geo` is 0750, so world-read on the file is not by itself access for every OS user. Documented `/etc/project-roma/.env` and `/var/www/.../.env` paths are absent. Only `backend/.env.example` is tracked. MFA key is not separate from JWT in runtime.

**Prerequisite/impact/status:** Confirmed operational secret separation/permission weakness; requires directory/group access or a qualifying local compromise. No secret value was printed; no public Git secret leak is asserted.

**Remediation/risk:** Protected production env/secret source outside the checkout, mode 0600 and minimal owner access; explicit deployment env selection; separate MFA encryption key with a re-encryption/rotation plan. Ignore all `.env*` variants from image contexts except approved examples. Do not rotate JWT/MFA blindly: sessions/enrollments can break.

**Regression/verification:** Correct production secret provenance with inaccessible files for unrelated accounts; no secrets in Git, images/layers, assets, or logs; controlled key rotation preserves expected MFA enrollments or mandates documented reenrollment.

### R12 — MEDIUM — lateral proxy identity laundering and unstable IP assumptions

**Component/evidence:** `customer-panel/nginx.conf:64` forwards `$http_x_real_ip` without authenticating its own peer. All services share a bridge; trust is hardcoded in `utils/getClientIp.js:33`. Compose has no static IPAM/ipv4_address pinning despite comments claiming pinned panel IPs. Safe live GETs from image container `.5`: direct backend yielded `::ffff:172.18.0.5`; via customer panel yielded forged **198.51.100.77** in backend anomaly logs.

**Prerequisite/impact/status:** Confirmed under a compromised/local bridge-client threat, not ordinary internet exploitation because F1/F4 prevent direct public panel access. Such a client can rotate rate-limit identities and pollute audit logs. Reallocation can also degrade attribution or accidentally trust a different service.

**Remediation/risk:** Authenticate/restrict each panel's incoming proxy peer, sanitize there, and isolate networks; stabilize trusted identities through explicit constrained topology or authenticated proxy links. Update trust consistently and test before recreation; incorrect rollout can merge all customers into a proxy bucket and produce false 429s.

**Regression/verification:** Add image → customer panel → API and image → admin panel → API adversarial tests, plus container recreation/readdressing tests. Legitimate Cloudflare IPv4/IPv6 remains accurately attributed; untrusted peers cannot inject identity on any path.

### R13 — MEDIUM — API responses expose unnecessary account/coupon metadata

**Component/evidence:** `controllers/coupon-code.js:182` publicly selects `usedBy` email arrays; authenticated coupon lookup returns the entire coupon including usageHistory. `controllers/review.js:getReviewsbyPid` populates user `orders` IDs publicly. `models/User.js:83`, `:103`, `:108` do not default-hide OTP and encrypted MFA secrets; broad user returns in profile/review/admin handlers can include them. Password and refresh-token hash are default-hidden, which is a useful existing control.

**Prerequisite/impact/status:** Confirmed response construction; actual production private-field contents were not retrieved. Exposure depends on nonempty fields. Email/usage disclosure enables enumeration; order IDs help targeted IDOR probing; OTP/MFA ciphertext should never be generic response fields even when owned by the caller.

**Remediation/risk:** Explicit public/customer/admin DTOs and default-hidden credential fields; public coupon responses contain eligibility/remaining-use counts, not identities/history; public reviews do not contain order lists. Low downtime but frontend field consumers must be checked.

**Regression/verification:** Seed synthetic sensitive fields and assert absence across all public/customer responses and broad admin lists; intended public product/review information remains available.

### R14 — MEDIUM — legacy role-toggle route bypasses the super-admin-only policy

**Component/evidence:** `routes/user.js` exposes POST `/admin/users/role/:id` behind ordinary adminCheck. `controllers/admin.js:78` toggles user/admin without requiring a super admin. Neighboring update controller at `:179` explicitly permits role changes only to super admins.

**Prerequisite/impact/status:** Confirmed inconsistent authorization; requires an existing admin session. It cannot directly make a super admin, but can create/demote admins contrary to the stricter endpoint's policy. No live role was changed.

**Remediation/risk:** Consolidate role-changing endpoints under one current-database super-admin policy; protect last privileged account and self-action rules. Check clients: frontend currently references a differently shaped role URL/method. Low downtime; remove stale endpoint only after client migration.

**Regression/verification:** User/admin cannot change roles through any alias; super-admin authorized changes work; last-super-admin protection is atomic.

### R15 — MEDIUM — image upload trusts MIME and preserves active-content extensions

**Component/evidence:** `middleware/upload.js:25`, `utils/localImageStore.js:23`, `controllers/upload.js`, `routes/upload.js`. Upload is correctly admin-only, but only checks caller-supplied `image/*` MIME; original extension persists in local storage served under same-origin `/api/images/`. SVG or HTML with spoofed MIME is not content-decoded/reencoded. Host/customer static paths do not add a document CSP.

**Prerequisite/impact/status:** Confirmed unsafe validation/serving construction; browser exploit not performed. Requires an authorized upload-capable account or another route to writing image storage and a victim opening active content. No arbitrary unauthenticated upload is asserted. Directly navigated same-origin active content can act with that origin's cookies even if HttpOnly prevents reading their values.

**Remediation/risk:** Decode and reencode approved raster formats, reject SVG/HTML and extension/MIME mismatches, enforce count/dimension/decompression limits, and use a cookieless media origin or restrictive content headers. Existing media formats and image migration require compatibility review.

**Regression/verification:** Spoofed MIME, SVG scripts, HTML, polyglots, oversized dimensions, and traversal names fail safely; normal images display; no uploaded document can execute in an authenticated application origin.

### R16 — MEDIUM — security headers are absent on origin HTML/static responses

**Component/evidence:** Host vhosts do not set HSTS/CSP/X-Frame-Options/nosniff/referrer policy. Local customer HTML response confirms all absent; image server likewise. Backend Helmet protects API responses but disables HSTS based on a stale comment that host Nginx sets it; observed backend HSTS is absent too. API CSP also permits unsafe-inline/eval.

**Prerequisite/impact/status:** Confirmed origin header gap; final edge/browser headers on challenged HTML pages remain unverified because Cloudflare may add policy. This is defense-in-depth failure, not proof of an existing frontend XSS payload.

**Remediation/risk:** Define effective policy for actual HTML/media responses; deploy CSP in report-only mode first, then enforce nonces/hashes and minimize script permissions. Align HSTS at a verified layer after certificate/domain review. Payment, Google, maps, analytics, and inline styles can break under an untested CSP.

**Regression/verification:** A real unchallenged browser HTML response receives intended headers; Stripe/Google/login/checkout work; frame protections and CSP violation handling are tested. Child Nginx locations with add_header need inheritance verification.

### R17 — MEDIUM — public write/resource paths have incomplete abuse controls

**Component/evidence:** `index.js:305` mounts analytics without a limiter; `controllers/analytics.js:trackView` accepts long client values and writes each hit. JSON parsing/decompression occurs before rate limiters and allows 10 MB. Several public list/cart paths have unbounded caller-controlled page/item limits. Auth limiter keys by email+IP, allowing rotating emails to avoid an aggregate login/reset cap. MemoryStore resets on restart and is not shared between instances.

**Prerequisite/impact/status:** Confirmed missing caps; no production load test. Public traffic can consume storage/CPU, and a distributed/rotating-email attacker is not bounded by a single account bucket. F6's invalid-token bucket fix remains valid. Huge production rates mean a low-volume probe cannot prove DoS resistance.

**Remediation/risk:** Endpoint-appropriate IP/account/global budgets, bounded payload/cardinality and pagination, parser limits by route, durable shared limiter store where needed, TTL for analytics and low-cost telemetry validation. Preserve webhook reliability and avoid false 429s for NAT users/admin tools.

**Regression/verification:** Isolated abuse and legitimate load matrices, including rotating email/cookies/IPv6, restart/multiple-worker behavior, empty/huge cart requests, and analytics retention. No high-volume production testing.

### R18 — MEDIUM — payment intents are not bound to authenticated checkout ownership

**Component/evidence:** `routes/payment-intents.js:4` lacks verifyToken; controller computes authoritative regular prices but creates intents without user/cart metadata and accepts optional caller idempotency keys. `controllers/order.js:159` returns existing order IDs/numbers for any supplied matching paymentId before checking ownership. Later retrieval checks amount and succeeded status, but not customer/checkout identity or currency.

**Prerequisite/impact/status:** Confirmed missing binding, not a demonstrated payment theft. Reuse/claim scenarios require knowledge of a valid paid PaymentIntent ID and a matching total before it is claimed. The deployed unique sparse paymentId index **is present**, preventing duplicate persisted orders for one intent; it does not establish rightful owner or reserve checkout contents.

**Remediation/risk:** Server-owned checkout records bind authenticated customer, canonical cart, currency, amount, and idempotency; derive intent ownership metadata and atomically consume it; check ownership before any existing-order response. If guest checkout is intentional, design an explicit unguessable guest session. Existing frontend flow and in-flight paid checkouts need careful migration.

**Regression/verification:** Cross-user intent claim, mismatched cart/currency, concurrent submit, repeated owner submit, and arbitrary idempotency keys. Use Stripe mocks/sandbox, never real transactions for these tests.

### R19 — MEDIUM — order ownership fails open for ownerless legacy records

**Component/evidence:** `controllers/order.js:519` rejects a mismatch only when `order.user._id` exists. Ownerless orders therefore return to any signed-in caller knowing their ID. Customer cancellation permits either ID or email match, extending access to email-reuse/legacy scenarios.

**Prerequisite/impact/status:** Confirmed conditional authorization defect; existence of affected production records is **NOT VERIFIED** because customer documents were not queried. No broad current order IDOR is claimed: ordinary orders with a valid different owner ID are denied by the current read check.

**Remediation/risk:** Default deny and require immutable owner ID; carefully migrate/quarantine ownerless records rather than falling back to email identity. Legacy customers may need support-assisted reassignment.

**Regression/verification:** Two synthetic customers plus ownerless, malformed-owner, deleted/recreated-email, and legitimate legacy cases. Unknown/missing ownership never grants access by omission.

### R20 — MEDIUM — build and container hardening are incomplete

**Component/evidence:** Both panel Dockerfiles use Node 18-alpine builders, which are EOL; final images run Nginx, not Node 18. Backend build uses npm install and copies the entire node_modules tree including build/dev dependencies, despite its production-only comment. Mutable base tags include mongo:latest and nginx variants. Containers have writable roots, default capabilities, no explicit no-new-privileges, and no configured resource ceilings in reviewed Compose. Full image CVE assessment was unavailable. [Node release status](https://nodejs.org/en/about/previous-releases).

**Prerequisite/impact/status:** Confirmed build/hardening weakness, not proof that frontend serves a Node development server. npm audit lockfile counts: customer **70 entries** (4 critical/39 high/15 moderate/12 low); admin **25** (15 high/10 moderate). Many are build/dev-only; browser-bundled vulnerable-code reachability was not established. No obvious private Stripe key/PEM patterns were found in the scanned served JS assets. Customer has three source maps; admin none.

**Remediation/risk:** Supported builder versions, npm ci with reviewed lockfiles and production pruning, scanned/pinned image digests, SBOMs, nonroot/minimal caps, explicit writable paths and resource budgets. Rebuild frontend under compatible supported tooling; do not apply all forced major upgrades blindly. CRA/Vite migration and CSP/assets need regression testing.

**Regression/verification:** Reproducible artifact/source mapping; exact-image OS/npm scan; no private build variables in any final artifact/layer; nonroot upload/image operation; bounded memory/CPU; frontend browser regression suite. Treat source-map publication as an exposure decision, not a secret by itself.

### R21 — LOW — security deployment provenance and rollback documentation drift

**Component/evidence:** Uncommitted changes in both panel Nginx files, backend index/client-IP helper, and Compose files; new F2 regression test and Nginx staging artifacts are untracked. Historical snippets still say “not deployed”; backup instructions can target pre-F2 images/configs. Current deployed sources match workspace, which prevents a present code-mismatch conclusion.

**Prerequisite/impact/status:** Confirmed reproducibility/rollback risk. A fresh checkout/rebuild can lose fixes or alter proxy assumptions; rollback can reintroduce fixed weaknesses.

**Remediation/risk:** Review/commit security changes, record immutable image/source/config hashes and approved deployment manifests, and replace stale rollback instructions with tested versions retaining F1/F2/F6/F4. No production runtime change needed merely to document; deployment changes still require approval.

**Regression/verification:** Clean, reviewable security baseline builds matching hashes and passes tests; rollback exercised in isolation preserves all port/proxy/rate-limit controls.

### R22 — MEDIUM — raw operational logs are sent to an external analysis workflow

**Component/evidence:** `utils/logAnalyzer.js:98`, `jobs/dailyLogReport.js`. Runtime has report recipients and an Ollama endpoint configured. Raw backend logs (up to 250 KB) are sent for analysis and report emailed; auth logs contain emails/IPs, and URLs/errors can contain other sensitive values. No structured redaction exists before submission. Daily-report success was not present in the sampled logs, so actual transfer during this window is unverified.

**Prerequisite/impact/status:** Confirmed configured data flow; policy acceptability/vendor retention and actual transmission are **NOT VERIFIED**. Log-controlled prompt text can also distort the narrative report; this workflow has no authority to execute remediation itself.

**Remediation/risk:** Minimize and redact data before export; document permitted recipients, retention, and provider controls; use structured metrics/security alerts with untrusted log content treated as data. Move collection off the application socket as R01 requires. Reporting changes should not affect checkout; preserve meaningful operational alerts.

**Regression/verification:** Synthetic passwords, cookies, reset tokens, customer addresses, and log-injection text never leave redaction unfiltered; report delivery and security alerting are verified without real customer data.

## Payments, frontend, and infrastructure observations that are not findings of exploitation

- Regular-item pricing, tax/markup and delivery fees are recomputed server-side; order creation retrieves Stripe intent and checks amount/status. The DB unique paymentId index is deployed. These are positive controls but do not resolve R04/R08/R18.
- Stripe raw request bytes are preserved by body-parser's verify hook for webhook paths. The comment claiming the route precedes JSON parsing is stale, but preserved raw bytes provide the required verification input. No live payment or webhook event with real effects was sent in this audit.
- DoorDash Drive and Uber Direct routes are implemented but **not mounted** in running index.js. DoorDash handler has no actual Basic Auth/signature validation despite its comments; Uber uses HMAC/timing-safe comparison but lacks a replay ledger. They are **NOT APPLICABLE to active inbound delivery webhooks**, and must pass authentication/idempotency review before reactivation. No Uber Eats Marketplace integration was established.
- Most write/admin routes require verifyToken plus current-database adminCheck. Public `/admin/all-brands` is misnamed but returns catalog data; its name alone is not an administrative bypass. Product editing remains admin-gated, though raw update operator passthrough should be replaced with a field allowlist as part of input hardening.
- Main catalog search escapes regex syntax and query parser is simple. Whole-source scanning found no live eval/new Function or `$where` sink. The admin recommendation shell command uses a fixed script path; Mongoose `.exec()` matches are not shell execution. A complete absence of NoSQL/prototype pollution cannot be proven by pattern scans or existing regressions.
- Image filename routing rejects slash/backslash/NUL; general local filename construction sanitizes base names. No confirmed arbitrary file-read/path traversal or arbitrary server SSRF was established. Blur fetches require the configured Cloudinary URL prefix; review-media URLs are not directly fetched unless that prefix matches. Redirect/DNS edge cases remain to be tested in isolation.
- React generally escapes displayed strings; the chart style HTML sink validates colors and uses code-controlled config. No attacker-controlled script execution was established. LocalStorage contains profile/UI/cart state rather than auth JWTs; changing it alone does not grant protected API access. Third-party scripts and public API keys require account/dashboard restrictions not visible in this audit.
- Cookies are HttpOnly, Secure in production, SameSite=Strict, domain-wide. CORS uses a configured origin allowlist and credentials. No dedicated CSRF token exists; SameSite plus JSON/CORS controls help, but sibling-subdomain and real-browser scenarios remain unverified. Shared-domain cookies make sibling application isolation significant.
- Socket.IO engine handshake/upgrade is not itself authenticated application-room access. Source authenticates Socket.IO connection JWT/role before joining admin; R05 covers current-role/revocation omissions.
- Host Balport TLS vhosts limit to TLS 1.2/1.3 and retain valid Cloudflare Origin CA server certificates. Full(strict), WAF/cache/bot settings and zone ownership were not inspected through dashboard credentials. **AOP is not deployed.** Stage 1 authenticates Cloudflare network membership only; zone-specific AOP is the recommended later control after compatibility checks. Public TLS remains reachable and port 80 retains redirects/ACME behavior.

## Coverage matrix

PASS means secure **for the tested condition only**; it is not a whole-component certification.

| Area / condition | Status | Evidence / unresolved work |
|---|---|---|
| Exact running Node version and F1/panel loopback bindings | PASS | Runtime/listener/NAT evidence above. |
| Deployed source matches reviewed security source | PASS | 116 files, backend lock, panel configs. |
| Existing F2/F6 regressions | PASS | 51 isolated assertions. |
| F2 original internet header-forgery vectors | PASS | Sanitized host boundary, deny gate, unit tests. |
| Full lateral client-IP trust chain and recreation stability | FAIL | R12 live lateral probe; no static IP pinning. |
| F4 current local direct-origin rejection and public API success | PASS | Four host probes plus mixed routing; API 200. |
| Independent external postdeployment origin denial | NOT VERIFIED | Operator result pending. |
| Zone-specific origin authentication / Cloudflare dashboard policy | NOT VERIFIED | No AOP; no dashboard evidence. |
| Docker socket least privilege / backend containment | FAIL | R01; root socket access. |
| MongoDB auth and network segmentation | FAIL | R06 anonymous metadata succeeds. |
| No currently listening Docker TCP daemon | PASS | No 2375/2376 listener in snapshot; Unix socket remains exposed inside backend. |
| JWT signature/expiry checks against unsigned forgeries | PASS | Middleware/source and F6 regressions. |
| Token-purpose/MFA boundaries | FAIL | R02 offline reproduction. |
| Reset-link trust and one-time reset | FAIL | R02/R03. |
| Session revocation, refresh atomicity, socket role freshness | FAIL | R05 source. |
| Most admin route authentication | PASS | Route review/current DB adminCheck; exceptions R02/R14. |
| Consistent super-admin authorization | FAIL | R14. |
| Normal order read owner mismatch rejection | PASS | Explicit ID mismatch check. |
| Ownerless/legacy order authorization | FAIL | Conditional fail-open R19; affected production data not queried. |
| Canonical bundle pricing/eligibility | FAIL | R04 synthetic substitution proof. |
| Regular item authoritative price, intent amount/status and unique ID index | PASS | Source and index metadata; real payment E2E NOT VERIFIED. |
| Intent ownership/checkout binding | FAIL | R18. |
| Stripe authenticity/raw bytes for current code | PASS | Signature verification path/source; sandbox delivery test pending. |
| Stripe event durability/deduplication/state ordering | FAIL | R08. |
| Atomic cancellation/refund/restock | FAIL | R09. |
| Active DoorDash/Uber inbound webhook deployment | NOT APPLICABLE | Routes commented out; code unsafe to enable without fixes. |
| High-risk input/query/SSRF/path traversal paths | NOT VERIFIED | Focused source controls present; full adversarial suite absent. |
| Upload content safety and same-origin media isolation | FAIL | R15. |
| Catalog/customer DTO privacy | FAIL | R13. |
| Frontend JWT avoidance in browser storage | PASS | Reviewed clients use HttpOnly cookies; scanned assets show no obvious private key pattern. |
| Full browser XSS/CSRF and third-party account restrictions | NOT VERIFIED | Requires authenticated browser and vendor/dashboard review. |
| Origin document security headers | FAIL | R16. |
| Public abuse/DoS budgets | FAIL | R07/R17; no live load/crash test performed. |
| Dependency/base-image vulnerability closure | FAIL | Runtime advisories, EOL builders; image CVE scan remains NOT VERIFIED. |
| Secret-file separation and backup permissions | FAIL | R10/R11. |
| Recovery access, restore readiness, retention | NOT VERIFIED | Prior operator console confirmation exists; no independent DB restore validation. |
| Logging/privacy and alert effectiveness | FAIL | R22, incomplete evidence of report/alert delivery. |
| Attribution of malicious activity/compromise | NOT VERIFIED | No supporting compromise evidence; limited sample cannot exclude it. |

## Logs, patching, drift, and recovery evidence

Backend log sample: last 24h request, capped to 15,000 lines; actual current-container sample was only **147 lines**. Aggregates included four failed-login messages, one Stripe signature rejection from the earlier safe probe, and 13 missing-CF-Ray warnings (including deliberate local audit traffic). No reset-completed, refresh-reuse, webhook-handler-error, Mongo connect-error, or daily-report-success message was found in that sample. These counts are not incident attribution.

Origin log snapshot before final probes: Cloudflare-peer statuses 70×200, 2×101, 2×401, 60×204, 38×304, 1×404, 5×201; non-Cloudflare 31×403. No Cloudflare-peer 403/429/502/503. Nginx error log was empty at the earlier inspection; `nginx -t` passes. Nginx rotates `/var/log/nginx/*.log` daily, 14 compressed rotations; that includes the new origin log. Container json-file logs have no container-specific rotation settings; daemon defaults need confirmation. Do not interpret observed successful user traffic as full acceptance coverage.

Host is Ubuntu 24.04.4, kernel `6.8.0-147-generic`; Docker 29.7.2. Cached APT metadata lists updates including Docker/containerd/AppArmor; no package index refresh, upgrade, kernel/CVE scan, or reboot was performed. Panel Nginx reports 1.31.8 and 1.30.6 respectively. Version strings alone do not establish patch sufficiency.

F4 prechange backup and executable rollback exist in `/root/f4-stage1-20261024T130850Z`; this audit did not invoke them. Restoring pre-F4 vhosts would reopen origin access and must be an explicit emergency decision. Older pre-F2 backups/images are not a safe universal rollback. Database changes require independently validated backups; image rollback alone cannot undo user/schema/state migrations.

## Top five priorities

1. **Close token/MFA/reset trust flaws (R02/R03/R05)** with isolated security tests, then a controlled authentication release and explicit session invalidation strategy.
2. **Remove application Docker authority and restrict exposed backups/secrets (R01/R10/R11)**; replace log collection before removing its socket dependency.
3. **Patch reachable parser/socket runtime advisories (R07)**, starting with the unauthenticated body-parser crash condition; do not run its exploit against production.
4. **Repair bundle/checkout/payment state integrity (R04/R08/R09/R18)** before considering checkout fraud controls complete.
5. **Authenticate/segment MongoDB and repair lateral proxy trust (R06/R12)** with a tested, volume-preserving migration.

## Exact recommended remediation sequence — proposal only

1. Freeze and record the current production baseline: reviewed source/config hashes, immutable image IDs, volume names, current F1/F2/F6/F4 tests, available SSH/console recovery, and service health. Review/commit security code and correct stale rollback documentation. Obtain approval for each deployment group; no rollback should retag an older vulnerable image by default.
2. With authorization, restrict/move existing backup artifacts and production secret sources, validate an encrypted off-host backup and isolated restore, and prepare host-based redacted log collection. No database contents should be copied into reports or normal CI logs.
3. Build an isolated staging replica using synthetic fixtures and dummy provider keys. Add failing tests for R02–R05/R14/R19 and the lateral R12 chain. Patch reachable runtime packages in a separate reviewed image, running all 51 existing tests plus new isolation/crash regressions. Keep F1 loopback mappings and origin peer gate unchanged.
4. Release the socket-removal/nonroot backend image with replacement reporting and verified writable paths. Verify Docker API is inaccessible from the app. Prepare a rollback image that retains current security source and has no database downgrade requirement.
5. Release authentication fixes: strict token types/purposes, fixed reset destination, single-use reset/session records, MFA across alternate login flows, atomic refresh/revocation, current-state socket access, consistent role policy. Plan forced reauthentication and support messaging. Roll back code only under a documented session/key compatibility plan.
6. Release checkout fixes: canonical bundle reconstruction, private checkout intent binding and ownership, durable deduplicated webhook queue, monotonic order states, atomic cancel/refund/restock. Exercise Stripe sandbox/mocks and reconcile affected real-world state through an authorized process. Do not blindly replay production events or issue refunds as an audit check.
7. Migrate MongoDB auth and least-privilege users on the existing `project-roma_mongodb_data` volume; segment networks and stabilize authenticated proxy identities. Treat this as its own maintenance window with verified backups and explicit rollback that preserves data/users. Confirm expected DB and proxy connectivity after recreation, including IPv6/NAT attribution and false-429 checks.
8. Deploy DTO/privacy, upload/media-origin, endpoint budgets, and HTML security-header fixes; use CSP report-only first. Upgrade supported frontend builders/lockfiles, generate SBOMs, scan exact final images, and compare deployed artifact/source hashes. Preserve working Basic Auth and API authorization.
9. Review Cloudflare Full(strict), WAF/cache/webhook/bot settings and alternate origin paths with dashboard evidence. Deploy **zone-specific AOP only after separate authorization and compatibility tests**; Stage 1 remains active throughout. Do not change shared-host firewall rules without dependency review.
10. Perform independent external IPv4/IPv6 acceptance, authenticated browser flows, and monitoring/restore exercises. Obtain a new security review against the final deployed hashes; passing the old suites alone is insufficient.

## Required before production security sign-off

- Independent external postdeployment F4 denial, including spoofed headers and mixed SNI/Host routing; external checks of 5001/3000/5173/27017/8080 in both address families and every alternate hostname.
- Authenticated storefront/account/login/admin/browser checkout smoke tests; two-customer/admin/super-admin role/IDOR matrix; CSRF/sibling-origin and stored-media XSS tests in staging.
- Cross-token-purpose/MFA/recovery matrix, session theft/reuse/concurrent refresh tests, password/reset/logout/disable revocation, and socket namespace/room plus stale-role tests.
- Synthetic bundle eligibility/pricing/stock tests; Stripe sandbox signature, duplicate/out-of-order/retry/failure tests; cross-user intent binding; concurrent cancellation/refund/restock checks. No live financial effects without explicit separate authorization.
- Exact-image dependency/OS SBOM scan and advisory reachability review; verify malformed-body/socket crash cases only in isolation. Validate supported build/toolchain versions and absence of private build secrets from final layers/assets.
- Database auth/least privilege and lateral-network adversarial tests, including container recreation/IP drift; no anonymous privileged DB access.
- Protected backups/secrets, demonstrated isolated restore, retention/off-host recovery evidence, redacted logging and tested alerts.
- Review any suspicious events with appropriate retained evidence. This audit has not established compromise and must not be used to assert either that compromise occurred or that it was impossible.

**Audit complete. No remediation authorized or executed by this report. Await authorization before implementing fixes.**
