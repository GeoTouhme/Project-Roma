# P1/P2 remediation — October 29, 2026

This release includes the previously staged P0 checkout work plus the P1/P2 changes described below. It is an engineering remediation, not a legal-compliance or accessibility certification. Business-specific restrictions, retention and delivery remedies still need approval. The original audit remains a dated record of findings, not a description of every post-remediation behavior.

## Implemented

- Optional store analytics requires a versioned, explicit opt-in. Essential Only and withdrawal suppress tracking, clear the store analytics identifier and known Google analytics cookies, and preserve cart/auth preferences. Browser GPC overrides a saved opt-in; the API independently rejects missing/stale consent and Sec-GPC requests before writing records.
- Removed unconditional Google Analytics and Google Fonts loaders from both the Vite entry and legacy public HTML entry. Google Analytics is not loaded even when store analytics is accepted. This avoids relying on unverified enhanced-measurement settings, which can generate automatic history-based events despite `send_page_view: false`; see [Google's pageview documentation](https://developers.google.com/analytics/devguides/collection/ga4/views).
- Analytics excludes authentication, checkout and privacy-request paths, normalizes order/account paths, and stores coarse device/browser details and referrer origin instead of raw IP/user-agent or referrer queries. Optional daily IP hashing requires an existing signing secret; it never falls back to an unhashed IP.
- Footer privacy choices can be reopened. Footer contact targets match displayed values, link names are meaningful and the copyright year is current. Shared public store identity is verified across frontend/backend. The pickup email uses the shared location; pending-order messages say awaiting store acceptance. Removed the unsupported free-delivery promotion and hardcoded-hours claim.
- Delivery quoting uses the same configured fee calculation as checkout rather than obtaining an external courier quote that may differ from the charged fee. Recipient data is not sent to a courier merely to display a website quote.
- Expired, malformed, nonpositive or non-discount sale prices are ignored in authoritative totals. Product cards, detail pages and basket calculations use matching sale-expiry rules, and relevant API projections include expiration metadata.
- Checkout requires explicit acknowledgment of the existing Terms/Privacy versions and stores the version hashes and acceptance time with the immutable checkout and resulting order. A stale frontend policy manifest is rejected. The new draft policies have not replaced the existing accepted policy text.
- Reused the site's existing alcohol warning on product, cart, checkout and confirmation-email surfaces. Wording/placement still require counsel review.
- Age dialog uses dialog semantics, keyboard focus containment and inert background content; legal/privacy contact pages remain reachable before age confirmation. Added main/skip navigation, focus and reduced-motion styles, checkout labels/errors, selected review-rating state, a review-text label, account password labels/errors and descriptive product image alternatives. These are focused improvements, not a complete WCAG evaluation.
- Authenticated account exports use allowlisted fields and immutable ownership. They include account, owned orders/checkouts, reviews, newsletter subscription, owned coupon usage, linked analytics, privacy requests and linked notifications; they exclude credentials, sessions, staff notes and other customers' coupon records. Unlinkable browser/anonymous data, vendor systems, logs and backups require separate procedures. Exports fail rather than silently truncate when a collection exceeds the record limit.
- Customers can submit/track access, correction, deletion and opt-out requests. Admins can review, record responses/evidence and retention holds. Concurrent duplicate open requests are deduplicated by an index; review history is appended atomically with optimistic concurrency. Completing deletion is explicitly blocked until an approved erasure/backup procedure exists. The old user-only deletion endpoint now refuses incomplete deletion.
- Account invoice queries/counts use immutable owner ID; they no longer match merely by email or expose a global order count.
- Admin delivery-exception controls validate state/payment and require actual goods receipt before recording a return. Exceptions enter a review queue; they do not automatically charge fees, refund or restock. Provider callbacks remain unmounted and now fail closed if accidentally reached. Provider polling updates metadata rather than bypassing staff handoff or reviving terminal states.
- Cancellation refunds retain pending processor states and a durable refund ID. Retrying retrieves the same refund or reuses a tagged existing one; partial/unknown refunds need staff reconciliation. A pending refund is not reported as completed. Existing full-cancellation remedies remain available; unapproved delivery-exception/partial-fee rules are not implemented.
- Removed password-form debugging and personal/request/provider payloads from affected account, order, email, delivery and origin-anomaly logs. Historical application, proxy, vendor and backup records are not retroactively erased.
- Admin retention verification reports configured periods, holds, unresolved payments and whether the existing analytics TTL index is installed. `ops/security/retention-check.py` inventories backup headers/age without decrypting, uploading or deleting archives. Destructive cleanup remains disabled even if retention settings are supplied.
- Session-refresh regression tests verify one refresh for concurrent 401s, the normalized URL, cookie-preserving replay, and exclusions for login/password-reset requests.

## Verification

- Backend database-independent suite: **176 passed**.
- Storefront Jest suite: **46 passed**.
- Admin TypeScript check and Vite build passed. An additional 42 existing admin tests passed during verification.
- Two isolated Mongo integration tests passed with no external network or published database port. They verify checkout recovery, locally signed webhooks, immutable totals, expired-sale pricing, quote/payment fee agreement, acceptance persistence, payment failures/refunds, privacy export isolation, concurrent request deduplication, holds and installed TTL verification. Stripe responses and customer records are synthetic.
- Browser check against the final Docker storefront files passed: age focus containment/legal access, essential-only suppression, opt-in and withdrawal, GPC override and unauthenticated privacy contact access. Every API and external request was intercepted. No browser page errors occurred. Run using `customer-panel/test/privacy-accessibility.cjs` with `PLAYWRIGHT_MODULE` and `STOREFRONT_BUILD` pointing to local tools/candidate files.
- Shared store/policy configuration check passed. Existing CRLF files produce whitespace warnings in an ordinary `git diff --check`; no broad line-ending rewrite was performed.
- Existing dependency directive/chunk-size build warnings remain. Comprehensive screen-reader/payment-widget/live-vendor testing, production data/index inspection and offsite restore verification are not claimed.

## Deployment and rollback

User explicitly authorized deploying safe changes on October 29. Production is kept in Stripe test mode; live approval remains off. No vendor callbacks, automatic partial refunds, retention purges or completed erasure were enabled.

Release tags: `project-roma-backend:p1-p2-20261029`, `project-roma-customer-panel:p1-p2-20261029`, `project-roma-admin-panel:p1-p2-20261029`. Release uses the existing protected Compose/hardening configuration. Mongo and image-fallback are not rebuilt or recreated for this rollout.

The pre-release manifest is retained at `/etc/project-roma/images.yml.before-p1-p2-20261029`. Because its backend/admin tags did not identify the exact running container contents, rollback backend source and admin static files were preserved in separately built `pre-p1-p2-20261029` images. The usable rollback manifest is `/etc/project-roma/images.yml.rollback-p1-p2-20261029`; the prior customer image is `accessibility-contact-20261029`. Treat backend and both panels as a coordinated release. Do not blindly roll back a backend with unresolved version-2 paid checkouts; reconcile first.

Deployment health evidence is recorded in `docs/P1_P2_DEPLOYMENT_2026-10-29.md` after rollout.

## Remaining decisions and work

1. Verify entity/contact/licensing, authorized goods/hours and actual handoff procedures before live sales. P0 live checkout remains gated.
2. Approve delivery-failure/return remedies, partial refunds and any fees. Current exceptions require manual review; automatic financial resolution is not complete.
3. Approve identity verification, privacy owner, category-specific retention, legal exceptions, vendor erasure and backup expiration/restore procedures. The request/export workflow is operational, but full erasure and destructive retention enforcement are deliberately incomplete.
4. Complete offsite backup/recovery verification and vendor/data-sharing inventory; no archive purge or offsite transfer occurred.
5. Perform comprehensive manual accessibility and third-party component testing. Broader forms/content/contrast may still need work.
6. Review and approve the four new policy drafts in `docs/legal-drafts/`. They contain explicit editorial placeholders. Public legal text is unchanged; do not present the drafts as approved or current public policies.
