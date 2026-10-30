# Balport Liquors — Legal Technical Audit

Date: 2026-10-29  
Scope: Customer storefront, admin workflows, Express backend, MongoDB schemas, delivery/payment adapters, existing tests, and selected non-sensitive deployed configuration.  
Purpose: Establish facts for later legal drafting. This document is not a legal policy or a legal compliance determination.

## A. Executive Summary

Balport has a React storefront, a separate admin panel, and a Node/Express API backed by MongoDB. Native checkout supports pickup and staff-managed delivery. Customers authenticate, submit contact/fulfillment information, confirm a Stripe payment, and then create a paid order awaiting staff acceptance. Staff may accept or deny it. Automatic DoorDash/Uber dispatch and delivery webhooks are disabled in the mounted application, although adapters, quote branches, and legacy delivery-management methods remain. [E01–E08]

**The deployed backend and storefront are configured for Stripe TEST mode. Live payments are not active through the inspected configuration.** This was established by classifying key types inside the runtime and compiled bundle; no key values were displayed, and no payment API was called. A configured key does not establish processor-account health or a successful end-to-end payment. [R01]

The most consequential gaps are:

1. Age confirmation is a persistent browser-local self-attestation. There is no inspected server-side DOB, verified-age record, checkout age acknowledgement, or mandatory staff verification record. Tobacco has no separate purchase restriction in the reviewed checkout path. Physical verification remains **NOT VERIFIED**. [E09–E11]
2. Alcohol detection depends on category slugs and omits the current `ready-to-drink-seltzers` category. Generic store hours are enforced for orders, but there is no independent alcohol-specific restricted-hours rule, and PaymentIntent creation does not use the store-hours middleware. [E02, E05, E10–E12]
3. Delivery ZIP restrictions exist in the frontend, not the authoritative order/payment path. Staff-managed quotes fall back to a default fee for other ZIPs rather than rejecting them. [E04–E06, E13]
4. “Essential Only” does not gate either the first-party tracker or Google Analytics initialization. Browser checks confirmed both requests are attempted with that choice set; the audit intercepted them before transmission. No GPC handling was found. [E14–E17, R02]
5. A successful charge precedes order persistence and staff acceptance. Some subsequent failures leave a paid checkout requiring manual reconciliation rather than an automatic refund. Redirect-dependent payment completion also needs verification. [E02–E05]
6. Cancellation/denial attempts a full refund and restores stock, with idempotency and an admin retry path. Failed delivery/return handlers do not provide equivalent automatic financial reconciliation and are currently unmounted. No customer partial-refund endpoint or return-fee calculation was found. [E07–E08]
7. Privacy text describes DoorDash sharing as the normal fulfillment model, omits material analytics/authentication/email/storage details, and promises deletion without a complete deletion workflow. [E18–E23]
8. Only Terms contains the inspected Proposition 65 warning. No corresponding warning was located in product/cart/checkout or order-email templates. Placement and wording require counsel review. [E19, E24]
9. Technical accessibility issues include an age overlay that allows background focus, unassociated checkout labels, unnamed social links, missing main landmarks, and weak small-text contrast. This is a limited audit, not a WCAG certification. [E25–E31, R02]
10. Business identity, pickup address, phone/email link targets, fee promises, and hours contain inconsistencies. Licenses, actual service area, staff duties, and vendor contracts require management confirmation. [E06, E12, E21, E32]

### Audit boundaries and verification method

- The sole project file created by this audit is this report. No application code, tests, dependencies, environment files, databases, containers, deployment settings, or legal pages were changed.
- No production database connection/query, order, account operation, email, refund, delivery quote, or live third-party API call was initiated.
- Source inspection establishes implementation, not successful operation. Existing tests were read; they were not rerun during this audit. Earlier-session test/deployment results are not represented as new audit tests.
- Read-only runtime inspection classified credential types/presence without exposing values, compared six backend files against workspace source, inspected the compiled storefront, read active nginx/logrotate configuration, and checked whether the backup timer is enabled/active. No credentials or customer records were read into this report.
- Limited browser checks loaded existing storefront static assets from loopback. Every `/api/` request was fulfilled with synthetic data, every third-party request was blocked, and only local static GET/HEAD traffic was allowed. No screenshots or additional audit artifacts were saved. These checks do not verify live catalog, authentication, checkout, processor widgets, or provider operation.
- Pre-existing modified/untracked files were present. Findings describe the inspected working tree; runtime matching was checked only where expressly stated. Legacy `.bak` files and planning documents were not treated as active implementation.
- Negative findings mean “not found in the reviewed application sources/routes/schemas,” not proof about external staff systems, vendor dashboards, or every historical copy.
- No California statutory interpretation was undertaken. Counsel must determine applicable requirements, licensing conditions, permitted hours, privacy-law applicability, and policy language.

## B. Feature Verification Matrix

Status meanings: **IMPLEMENTED** means executable code was inspected; it does not imply production-tested. **CONFIGURED BUT UNVERIFIED** means configuration indicators exist without operational verification. **PARTIALLY IMPLEMENTED** means only part of the stated control exists. **DISABLED** identifies deliberately inactive paths. **NOT IMPLEMENTED** means no corresponding mechanism was found in the reviewed scope. **NOT VERIFIED** identifies facts outside available evidence.

| Feature | Status | Evidence | Customer Data Involved | Legal Policy Impact |
|---|---|---|---|---|
| Native pickup and delivery checkout | IMPLEMENTED | E01–E06 | Account, contact, address, basket | Describe two fulfillment modes and staff acceptance |
| Live Stripe payments | DISABLED | R01: both runtime key classifications TEST | Payment/billing data | Do not say live commerce was verified |
| Stripe Payment Element and PaymentIntents | IMPLEMENTED | E02–E03 | Card data directly to Stripe; billing contacts | Processor architecture supports a qualified Stripe statement |
| Stripe production-account readiness | NOT VERIFIED | R01; no API calls | Payment records | Dashboard, live keys, payment methods require confirmation |
| PayPal/COD | DISABLED | E04: non-Stripe rejected; schema enum is legacy | None through accepted order path | Do not advertise as supported |
| Signed Stripe webhooks and event deduplication | IMPLEMENTED | E08; existing mocked tests E33 | Event/payment IDs, refund totals | Reconciliation exists; actual webhook delivery NOT VERIFIED |
| Customer pending-order cancellation | IMPLEMENTED | E07 | Order, reason, refund metadata | Cancellation ceases after acceptance |
| Staff denial/cancellation and full refund attempt | IMPLEMENTED | E07 | Order, staff identity, refund/error | Describe attempted refund and exception handling accurately |
| Customer partial refunds | NOT IMPLEMENTED | E07–E08 | Refund amount | External partial refunds can be reflected by webhook; no application initiation flow found |
| Orphan-payment automatic reconciliation | PARTIALLY IMPLEMENTED | E02, E04–E05, E08 | Paid checkout, payment ID | No guarantee every charge immediately yields an order or refund |
| Automatic DoorDash/Uber dispatch | DISABLED | E05, E01 | None via disabled create-delivery path | Policies must not describe it as ordinary automatic dispatch |
| DoorDash/Uber configuration | CONFIGURED BUT UNVERIFIED | R01 | Conditional provider data | Presence is not authorization, activation, or successful use |
| External-provider delivery quotes | PARTIALLY IMPLEMENTED | E06, E13 | Address, phone, alcohol flag | Conditional on stored provider setting; live selection NOT VERIFIED |
| Manual staff driver coordination | IMPLEMENTED | E05, E07 | Order/recipient details accessible to staff | Actual sharing, ID check and training procedures NOT VERIFIED |
| Alcohol handoff safeguards in adapters | PARTIALLY IMPLEMENTED | E13, E34 | Recipient, address, restricted-goods flag | Flags/instructions exist, but dispatch disabled and provider acceptance untested |
| Verified recipient identity/age evidence storage | NOT IMPLEMENTED | E09–E11, E13, E34 | No dedicated ID/DOB verification schema | Do not claim an auditable verification history |
| Browser 21+ age gate | IMPLEMENTED | E09, R02 | Local `ageVerified` flag | Self-attestation only; no expiry or backend proof |
| Backend alcohol/tobacco age eligibility | NOT IMPLEMENTED | E04, E10–E11 | No age inputs required | Management/counsel must define controls before live restricted sales |
| Generic order-hours middleware | IMPLEMENTED | E12 | Timezone and schedule | No independent alcohol-hours rule; active schedule NOT VERIFIED |
| Server-side destination allowlist | NOT IMPLEMENTED | E04, E06, E13 | Delivery address/ZIP | UI-only geography must not be described as a secure restriction |
| Server pricing, tax, discounts, stock | IMPLEMENTED | E10, E04 | Basket, email for coupon reuse | Tax correctness, fee meaning, and applicable rates need confirmation |
| Cookie choice UI | PARTIALLY IMPLEMENTED | E14–E17, R02 | Local consent preference | Choice is stored but does not enforce analytics opt-out |
| Google Analytics | IMPLEMENTED | E16, R01–R02 | Browser/page/network identifiers potentially | Loader present; actual collection/settings/cookies NOT VERIFIED |
| First-party page analytics | IMPLEMENTED | E17 | IP, user agent, referrer, session ID, page | Must disclose even when no marketing pixels are found |
| GPC handling | NOT IMPLEMENTED | Search of customer/backend source; E14–E17 | Opt-out signal | Applicability and enforcement require legal/product decisions |
| Google sign-in | CONFIGURED BUT UNVERIFIED | E22, R01 | Subject ID, verified email, names, avatar | Describe optional authentication, not DOB verification |
| Google Maps Places | DISABLED | E03; R01 compiled script absent | Typed address if enabled | Source integration exists; not confirmed active in current bundle |
| Gmail API transactional email | CONFIGURED BUT UNVERIFIED | E23, R01 | Recipient/name/order/address or verification link | Vendor disclosure; delivery success not tested |
| Cloudinary uploads/fallback | CONFIGURED BUT UNVERIFIED | E35, R01 | Admin-uploaded image files; remote image requests | Local-first upload still attempts remote copy; service health not tested |
| Cloudflare edge/proxy configuration | IMPLEMENTED | E36, R03 | IP, requests, user agent, potentially cookies/content | Edge processing exists; dashboard cookie/analytics settings NOT VERIFIED |
| Password hashing, rotating cookie authentication, MFA support | IMPLEMENTED | E20, E22, E37 | Credential hashes, session identifiers, encrypted MFA secrets | Describe safeguards without claiming complete security |
| Full customer export/privacy request workflow | NOT IMPLEMENTED | E18, E20–E21 | Multiple stores | Profile/order access exists; no complete privacy export/request tracker found |
| Self-service account deletion | NOT IMPLEMENTED | E20–E21 | Account and related records | Admin user deletion is not comprehensive erasure |
| PageView retention | PARTIALLY IMPLEMENTED | E17 | Analytics records | 90-day TTL schema; installed index/legacy expiry coverage NOT VERIFIED |
| Encrypted local database backup | CONFIGURED BUT UNVERIFIED | E38, R03 | Full database contents | Timer active; archive success/recovery not tested; no purge period in script |
| Privacy, Terms, Accessibility pages | IMPLEMENTED | E18–E21, R02 | Policy text | Hardcoded, public routes; age overlay can obstruct initial access |
| Separate delivery/refund policy | NOT IMPLEMENTED | E21 route/footer inspection | None | New page and business decisions needed |
| Policy-version acceptance records | NOT IMPLEMENTED | E09, E03–E04, E11 | No stored acceptance/version field | Recommend deliberate consent evidence; no automatic legal-violation conclusion |
| Full WCAG 2.2 AA conformance | NOT VERIFIED | F; R02 | All customer flows | Never publish an unsupported conformance claim |

### B1. Business identity and operations

| Topic | Inspected facts | Verification limit / management action |
|---|---|---|
| Display/legal name | “Balport Liquors,” “Bal-Port Liquors,” and title “Balport Liquor”; app config also says “Liquor.” E03, E06, E16, E21 | Registered entity/DBA and merchant of record NOT VERIFIED; no legal business-name field found |
| Store address | Footer, checkout pickup panel and provider adapters use 4521 West Coast Hwy, Newport Beach, CA 92663. Order pickup email instead embeds 1779 Newport Blvd, Costa Mesa / Newport Beach, CA 92627. E03, E06, E13, E21 | Confirm authoritative location and remove conflict in a later change |
| Contact | Footer/accessibility display 949-200-9377 and balportliquorstore@gmail.com. Footer secondary number displays 617-751-0412 but links to the first number; email link goes to balport@gmail.com. Provider pickup phone differs: 949-642-1921. E13, E21 | Confirm correct customer/support/provider contacts; fix routing later |
| Service area | Frontend permits ZIPs 92663, 92646, 92612, 92647, 92661, 92707, 92648; country/state UI fixed to US/CA. E03 | No matching server allowlist; actual licensed/operational territory NOT VERIFIED |
| Hours | Model defaults use America/Los_Angeles, Sunday 07:00–02:00 and other days 06:00–02:00. Overnight schedules are supported. Announcement claims Mon–Sun 6AM–2AM. E12, E32 | Database schedule deliberately not queried; legal sale/delivery hours and license conditions NOT VERIFIED |
| Currency | Backend defaults to USD; Stripe Elements explicitly uses USD. E02–E03 | No currency environment value disclosed; any future currency divergence needs review |
| Tax/markup | Schema defaults: tax 7.75%, markup 2%; per-category taxable boolean, ZIP/default delivery fees. These are code defaults, not verified effective rates. E10–E12 | Management/accountant must confirm rates, category treatment, CRV and fee disclosures |
| License information | No business-license/ABC-license number or license-type display/storage field found in reviewed storefront/settings/product sources | License existence, validity, type, conditions, tobacco permissions and entity identity NOT VERIFIED; catalog is not license evidence |
| Alcohol vs tobacco | Category-slug alcohol flag; no explicit product minimum age/restricted-goods field; tobacco taxonomy exists without checkout-specific guard. E10–E11 | Confirm actual tobacco catalog eligibility; do not infer whether any tobacco purchase has occurred |

### B2. Personal-information inventory

“Stored” below describes schema/code destinations, not inspected production records. Unless specified, no automatic retention/deletion mechanism was found for the category.

| Category | Collection point and purpose | Storage/how | Third-party transmission | Retention/deletion |
|---|---|---|---|---|
| First/last name | Register, Google sign-in, profile/admin edits, checkout; identify customer/recipient | Mongo User; duplicated Order.user; coupon history and notification titles; browser `user` cache | Gmail order messages; Stripe billing; conditional courier payload; Google auth exchanges | Admin deletes User only; order/coupon/notification copies remain. E03–E04, E11, E20–E23 |
| Email | Register/login/recovery, profile, newsletter, checkout; auth/contact/marketing enrolment/coupon reuse | User, Order.user, Newsletter, CouponCode.usedBy/usageHistory; security/email logs; browser cache | Google identity/Gmail; Stripe billing. Courier create/quote payloads inspected do not include email | No complete erasure, newsletter unsubscribe, or unified retention flow found. E18, E20–E23, E39 |
| Phone | Register/profile/checkout, Google users can supply later; fulfillment contact | User and Order.user; browser cache | Stripe billing; courier quote/create requests; staff external sharing NOT VERIFIED | User deletion does not remove order copies. E03–E04, E11, E13 |
| Delivery/billing address | Checkout form; Google address suggestions if enabled; delivery quote | Order.user address/city/state/country/ZIP; form state; no separate address-book schema found | Stripe billing details; conditional DoorDash/Uber quote/create; Gmail delivery confirmation | Orders retained, no period found. Pickup clears delivery address fields. E03–E04, E13, E23 |
| Password/confirmation | Registration/login/change/reset; credential authentication | Browser form state; passwords submitted to API; bcrypt hashes stored in User, not plaintext passwords; confirmation excluded from registration submission | Credential transport to Balport API; no inspected onward password transmission | Hash removed with User deletion; old backups can retain hashes. E20, E22, E37 |
| OTP/reset/verification records | Email verification, password recovery | User OTP and expiry/attempt fields; reset token hash/expiry; signed verification link | Gmail receives verification/recovery message. MX lookup sends email domain to DNS resolver, not full address | OTP/reset expirations govern validity, not whole account retention; no automatic unverified-account purge found. E20, E22–E23, E37 |
| Google profile | Optional sign-in: verified email, Google subject ID, given/family names, picture | User.googleId/provider/names/email/cover, browser user cache | Google ID-token verification; avatar URL requests can contact Google | User deletion leaves related order/history data. No DOB/ID-document field returned by inspected integration. E22 |
| Session/MFA identifiers | Login, refresh, MFA enrolment | HttpOnly `token`/`refreshToken` cookies; User refresh hash/session ID; AES-GCM encrypted MFA secret; temporary challenge token in frontend state | Requests pass infrastructure; auth cookie shared across configured root-domain subdomains | Access 15 minutes, refresh 7 days; logout/password change invalidate session; expiry does not delete account. E20, E22, E37 |
| Card/payment data | Stripe Payment Element and confirmPayment | No PAN/CVV input or schema in inspected Balport code. Order/Checkout/StripeEvent store payment IDs, amounts/status/refund summary | Stripe-hosted collection plus billing contact/address; wallet availability processor-dependent | No general payment-summary purge found. Scope does not certify PCI compliance or vendor security. E02–E04, E08 |
| Basket, wishlist, browsing and orders | Cart actions, wishlist endpoints, page tracker, ordering | `cartItems` browser localStorage; User wishlist/orders/recentProducts references; Order item snapshots; PageViews | Basket metadata/amount to Stripe; conditional courier item payload; Google page analytics | Cart manually removed/cleared; no browser TTL; order/history erasure not implemented. recentProducts field exists, collection/write behavior NOT VERIFIED. E10–E11, E17, E40 |
| IP/device/referrer data | Request middleware, analytics, order creation, rate limits | Order.clientIp; PageView IP/userAgent/referrer/source; nginx/container logs; hashed rate bucket identifiers | Cloudflare edge; Google/Stripe/vendor requests may expose device/network data | PageView 90-day schema TTL; rate buckets reset TTL; nginx daily 14 rotations; Docker size rotation. Actual external/log retention NOT VERIFIED. E04, E17, E36–E38 |
| Analytics/marketing identifiers | Automatic Google tag, first-party getSessionId, newsletter signup | `visitor_session_id` persistent localStorage, PageView.sessionId; third-party identifiers NOT VERIFIED because requests blocked | Google Analytics loader attempted regardless of choice; advertising destinations/settings NOT VERIFIED | No first-party identifier TTL; consent values do not disable collection. E14–E17, R02 |
| Age/DOB/identity documents | “Yes, I am 21+” button; delivery adapter flags | Browser `ageVerified` only; no inspected DOB, scanned ID, signature image, or verified-age result schema | Conditional courier verification request; actual driver/vendor ID processing NOT VERIFIED | No expiry for browser age flag; vendor ID retention NOT VERIFIED. E09–E11, E13, E34 |
| Reviews/ratings/images | Review modal/API; product feedback | Review user/product/rating/text/image URLs; publicly populated first/last name and avatar | Remote review image URLs may contact their host; no external review-management platform found | No unified account-deletion cleanup or published-review retention found. E30, E41 |
| Customer/staff free text | Pickup notes; customer cancellation reason; staff denial reason/notes | Order pickupNote/customerCancellationReason/staffNotes; notifications; pickup note inserted into email | Gmail; manual staff/provider sharing NOT VERIFIED | No period or sanitizing/anonymization workflow found; advise against entering sensitive information. E04–E07 |
| Support/accessibility correspondence | Public email/phone links; no support-message schema/form found | External mailbox/phone system behavior NOT VERIFIED | Mail/telephony providers selected by store/customer | Retention and request handling NOT VERIFIED. E21, E23 |
| UI/privacy preferences | Cookie choices, age gate, auth flag, dismissed announcement | localStorage cookieConsent/ageVerified/isAuthenticated; sessionStorage announcement_dismissed | No preference server record found; browser value is not evidence of effective tracking opt-out | No version/timestamp or revocation/preference-center mechanism found. E09, E14, E32, E40 |
| Derived recommendation associations | Product/basket recommendation engine | Recommendation records reference source/target products, source type, counts/scores rather than direct customer identity | No active external AI inference request found in inspected current src call sites | Historical generation jobs and joins to identifiable purchase records NOT VERIFIED. E42 |

### B3. Restricted goods, checkout and vendor behavior

**Alcohol.** The age gate is mounted globally and persists any truthy `ageVerified` localStorage value; it is not sent as a verified age credential. Registration collects identity/contact/password fields but no DOB. Checkout has ID-related prose for pickup and desktop delivery terms, but no required 21+ checkbox, verified-age token, or server check. The order calculator sets `containsAlcohol` for listed category slugs; `ready-to-drink-seltzers` exists in the taxonomy but is not on the calculator/quote lists. No production bypass was attempted. Static API inspection shows that bypassing the UI removes these frontend-only restrictions because the API does not require corresponding age/destination evidence. [E03–E04, E09–E13]

**Tobacco/nicotine.** Taxonomy/artwork/import mappings identify tobacco-related categories. No backend tobacco-specific block, minimum-age check, destination rule, delivery classification, or product-specific restriction field was found in the general pricing/order path. An enabled, stocked tobacco product is not explicitly excluded by that path. Actual production inventory, successful online tobacco purchases, and vendor permission are **NOT VERIFIED**. Treat the policy decision as unresolved, not as proof of authorization. [E10–E11]

**Hours.** `checkStoreHours` protects order creation and delivery quotes and handles overnight schedules in the configured timezone. Exceptions fail closed with 503. A null configuration branch returns open; the normal `findOneOrCreate` path creates defaults and can write settings. The audit did not call it. Configurable store hours are not a separate hardcoded alcohol-sale/delivery restriction, and staff status transitions do not check legal handoff hours. The payment-intent endpoint lacks that middleware, so a charge can precede an order rejected on hours. [E01–E02, E12]

**DoorDash Drive v2.** Code targets `https://openapi.doordash.com/drive/v2/deliveries` and `/drive/v2/quotes`; cancel is `PUT /deliveries/{external_delivery_id}/cancel`; status is `GET /deliveries/{external_delivery_id}`. Create payload includes order number, customer names, delivery address/components, phone, item names/descriptions/prices/quantities, value, tip and requested pickup time. Alcohol sets `order_contains.alcohol`, `contactless_dropoff: false`, ID-required options, hand-to-customer instructions and return-to-pickup if undeliverable. Signature is requested in instruction text; actual supported semantics/required age/provider enforcement are **NOT VERIFIED**. Quotes send address, phone and alcohol flag, with a placeholder order value. Requests can occur on a quote branch if settings select that provider, even though automatic dispatch is disabled. [E06, E13]

**Uber Direct.** Code uses OAuth `/oauth/v2/token`, `/v1/customers/{customer}/deliveries` and `/delivery_quotes`, cancel/status methods, and similar recipient/manifest fields. Alcohol requests identification minimum age 21 and a signature. The inspected create payload does not establish a tested no-unattended-delivery guarantee or a tested return procedure. Both provider credential sets are present, but actual accounts, agreements, configured provider choice and API success are **NOT VERIFIED**. [E34, R01]

**Verification results and failures.** Order stores tracking/status/ETA/error fields, not dedicated age-verification evidence, identity documents or proof-of-delivery artifacts. Unmounted webhook handlers process delivered/cancelled/returned events and create staff notifications but do not initiate refunds/restocking. They map some states (`delivery_failed`, `returned`) absent from the Order status enum. DoorDash route code relies on portal Basic Auth and has no application signature validation; since it is unmounted, this is a future-enablement risk, not a confirmed exposed endpoint. Uber has an HMAC check. Actual provider checks must be established contractually and operationally; code comments are not evidence that a recipient was verified. [E08, E11, E34]

### B4. External services and tracking inventory

| Service | Purpose and information potentially received | Activity evidence | Cookies/opt-out and unresolved disclosure |
|---|---|---|---|
| Stripe / Stripe.js | Payment Element, billing names/email/phone/address, amount/currency, network/device data | Test-mode keys on both sides; SDK code and live bundle present; no transaction tested | Stripe cookie/storage behavior NOT VERIFIED; not disabled by banner; wallet availability cannot be promised from comments |
| Google Identity Services | Optional Google sign-in; subject ID, verified email, names/avatar | Backend config present; GSI script loaded by login/register component | Google cookie/device processing NOT VERIFIED; user can choose local sign-in; banner does not gate GSI |
| Google Analytics gtag | Site/page traffic and browser identifiers, potentially purchase-related URLs | Unconditional HTML loader/config and blocked browser request observed | No consent-state gating found, no GPC handling, actual GA retention/advertising integrations/settings NOT VERIFIED |
| First-party analytics | IP/userAgent/referrer/page/product/session ID to Balport API | Source plus intercepted `/track-view` request observed with Essential Only | localStorage session ID; no opt-out enforcement; 90-day record TTL not identifier TTL |
| Google Fonts | Jost font stylesheet/font requests; network/device/referrer information | External stylesheet in index.html; browser requests blocked | No banner gating; provider retention and actual cookie behavior NOT VERIFIED |
| Google Maps Places | Address autocomplete sends address input/network information if enabled | Conditional source; literal maps-loader URL absent from deployed bundle | Current active integration not established; no vendor API calls tested |
| Gmail API / Google OAuth | Transactional verification, password reset, order messages; recipient/name/address/items | Configuration present and mailer implementation inspected | Delivery and mailbox retention NOT VERIFIED; not a marketing consent workflow |
| DoorDash Drive / Uber Direct | Conditional quote/legacy dispatch recipient, address, phone/order data | Adapters configured; automatic dispatch and webhook mounts disabled | Manual staff apps and quote-provider setting NOT VERIFIED; no blanket statement that all deliveries use DoorDash |
| Cloudinary | Remote copy of admin-uploaded images; browser image delivery when remote URLs used | Upload attempts after local save; configured flags present | Account health NOT VERIFIED during audit; no ID-document upload purpose found; remote image requests may reveal network data |
| Cloudflare | Reverse proxy/security edge for storefront/admin/API | Active host nginx configuration trusts/restricts CF peers | Cloudflare dashboard products, cookie settings, data locations/retention and contract NOT VERIFIED |
| NRSGo external ordering link | `https://nrsgo.com/balport` in fallback ordering-disabled branch | Native ordering flag false for disabling, so native checkout enabled | External purchases/data processing not inspected; do not label as an active Balport checkout provider |
| Other image hosts | Google avatar, supplied remote review/product image URLs | URL-based rendering and schemas | Recipients depend on actual stored URLs, not queried in this audit |
| Advertising pixels / external review vendors | No Meta pixel, ad SDK or third-party review-service integration found in scoped source searches | NOT VERIFIED externally | GA linked ads/Signals, tag-account changes, proxy-injected scripts and non-code agreements need review before “no sale/share” claims |
| External AI log analysis | Application daily-log job is a no-op; related historical plans are not active-code evidence | DISABLED in current job source | Host jobs outside inspected timer/config scope NOT VERIFIED; no claim of universally absent external analytics |

## C. Privacy Policy Requirements

The policy should accurately explain the categories and purposes in B2, including account authentication, order processing, fraud/security logging, delivery/pickup coordination, transactional email, newsletter enrolment, reviews, analytics, browser storage and payment records. It should separate customer-provided information, automatically collected information and Google profile information. Disclose that review authors' names/avatar and review text may be public. Explain browser cart/profile caching separately from authentication cookies. [E11, E17, E20–E23, E40–E41]

Stripe-only processing is supported by the accepted-order code: `createOrder` rejects non-Stripe methods, and card entry uses Payment Element. A carefully scoped statement that the inspected application does not store full card numbers/CVV is consistent with inspected forms/schemas; a universal claim covering every business system, logs, emails, vendors or PCI compliance is not established. **The current application is test-configured.** Do not describe live processing as verified. [E02–E04, R01]

Describe delivery data sharing according to the actual staff/provider workflow. Current Privacy states that names/addresses/phones “are shared with DoorDash” to fulfill delivery and that DoorDash performs verification. Automatic dispatch is disabled; quotes remain conditional, and staff manual apps are unverified. Replace certainty only after management confirms actual practices. [E05–E06, E18]

Disclose real retention categories and criteria: orders/payment records, security logs, analytics, accounts, backups and vendor systems. The 90-day PageView TTL does not establish a 90-day global retention policy. Account deletion does not remove embedded order identity, coupon history, newsletters, notifications or backups. Users have profile/order access, but no complete export/privacy request tracker or self-service erasure route was found. Establish a contact channel, identity-verification procedure, response ownership and retention exceptions before promising automatic deletion. [E17, E20–E21, E38–E39]

Do not state any of the following without additional evidence/decisions:

- “Essential Only disables analytics”; “we honor GPC”; or “only necessary cookies run before consent.”
- “We do not sell or share personal information” as a legal conclusion without reviewing GA/ad-account settings, contracts and applicable definitions.
- “We verify every purchaser's age online,” “we store no personal data,” or “we retain no ID information anywhere,” because driver/vendor practices are not inspected.
- “All data is encrypted at rest,” “all customer information is deleted on request,” or a fixed global retention period.
- A definitive CCPA applicability/right/exemption statement based solely on the existing page or business location; counsel must assess the business facts.
- Universal security or PCI certification claims. Code safeguards are not independent certification.

The admin order detail has a Print button without an inspected click handler and an explicitly disabled “Email Customer (Coming Soon)” button; these are not verified export or messaging features. User profile/order responses can support manual access requests, but no complete machine-readable privacy export was found. [E44]

The present page has a March 2026 update label, no comprehensive controller/contact/retention/vendor discussion, and only a brief browser-cookie explanation. Hardcoded text is not admin-managed. [E18]

## D. Terms & Conditions Requirements

Terms need management/counsel decisions tied to these implementation facts:

| Contractual topic | Actual application behavior | Required drafting decision |
|---|---|---|
| Merchant identity and premises | Inconsistent display names/address/contact links | Confirm registered entity/DBA and binding customer contact/location |
| Eligible customers and goods | 21+ browser attestation; no backend verified age; tobacco not separately gated | Define eligibility, permitted products and evidence; do not claim comprehensive enforcement |
| Formation/acceptance | Payment success precedes persisted `pending` order; staff then accepts/denies | **Legal binding point NOT VERIFIED.** Decide whether submission, payment or staff acceptance forms the contract and align messaging |
| Prices, taxes and fees | Authoritative DB pricing; category tax; percentage markup; ZIP/default delivery fees; optional delivery tip | Confirm current rates, fee purpose, CRV treatment and tax accounting; explain totals before charge |
| Discount terms | Active fixed/mix deals/coupons; priceSale used in calculator regardless of saleEndsAt | Define expiry/stacking and align expired sale pricing; avoid promises inconsistent with calculator |
| Payment | Stripe-only accepted orders; test-configured; automatic/default capture rather than an explicit manual-capture workflow | Approve live-payment rollout and supported methods; no PayPal/COD promises |
| Stock and substitutions | Stock checked before intent, deducted after payment during order creation; compensating rollback; no substitution approval workflow found | Define stock failures after payment and approved substitutions without promising unsupported automation |
| Delivery/pickup | Staff-managed dispatch, fixed frontend ZIP choices, no server geography proof | Confirm areas, timing, third-party sharing, handoff and pickup rules |
| Cancellations and returns | Customer cancellation only while pending; full-refund attempt, provider/manual exceptions | State practical cutoff and remedies; define return/failed-ID charges before claiming them |
| Customer conduct/reviews | Public names/review content; backend rating validation | Decide content moderation/use and support procedure |
| Terms presentation/acceptance | Age-gate prose and footer statement; desktop checkout text; no acceptance checkbox/version/timestamp schema | Add deliberate, accessible linked acceptance and version evidence as a recommendation, not a legal conclusion |

Current Terms says Balport “strictly complies with all California and Federal laws,” identifies the driver as a Dasher, and says “A return fee may apply.” None is established as a complete operational fact by this audit. The code calculates no return fee. The acceptance statement is hidden with the desktop button at mobile sizes; the mobile fixed ordering bar contains no equivalent terms notice. Pickup text references valid ID but not explicit Terms acceptance. Registration has no Terms checkbox in the inspected component. [E03, E09, E19, E21]

## E. Delivery, Cancellation & Refund Policy Requirements

### Actual technical lifecycle

1. **Cart:** stored locally; server summary recalculates product/deal/coupon/tax/markup values. No inventory reservation occurs merely by adding to cart. [E10, E40]
2. **Checkout:** customer supplies contact/address or pickup mode. Frontend checks supported ZIPs and quote verification; totals display subtotal, discount, markup, tax, fee/tip and total. Pickup forces backend tip and delivery fee to zero. [E03, E10]
3. **Payment:** authenticated backend recalculates totals, creates a checkout binding and Stripe PaymentIntent with owner/cart metadata and idempotency. Stripe Elements collects payment data, and frontend confirms before calling createOrder. No explicit manual capture option was found. [E02–E03]
4. **Creation:** backend verifies payment ownership/hash/currency/amount/succeeded status, claims checkout, decrements stock conditionally and persists a paid pending order. Sequential compensation is used rather than a multi-document database transaction. User/coupon bookkeeping follows. [E04]
5. **Confirmation:** notification and confirmation email are attempted before successful HTTP response. Email failures are caught; a failure in the separate notification step can still reach the outer error after order persistence. A retry with the same payment ID can recover an existing order. [E05]
6. **Fulfillment:** staff accepts to `processing`; no automatic driver is created. Staff may mark shipped/delivered. Actual manual driver request and ID/handoff procedures are outside verified code. [E05, E07]
7. **Cancellation/denial:** customer may cancel only own pending order; staff denial is pending-only; staff cancellation allows pending/processing/accepted. A cancellation claim prevents duplicate transitions, inventory is restored with per-order markers, then a full refund is attempted. Failure is stored for manual retry/reconciliation. [E07]
8. **External payment events:** signed Stripe webhook stores a summary, applies payment/refund/dispute changes idempotently, and retries persistence failures with non-2xx. A refund API response is not proof of final settlement; webhook delivery and customer bank posting were not verified. [E08]

### Material failure cases and policy limits

- **Paid but no order:** prices/stock/hours can change after payment confirmation. Errors in validation/stock/persistence return contact-store guidance; no general automatic refund of an unmatched paid checkout was found. A Stripe success event with no order does not create one. [E02–E05, E08]
- **Payment redirects:** `redirect: 'if_required'` can redirect to `/orders` before the code below confirmPayment creates an order. No inspected return-page completion/recovery binding was found. Actual enabled redirect methods and observed failure frequency are **NOT VERIFIED**. [E03]
- **Delivery quotes vs charges:** external-provider quote fees can be shown, while order/payment calculations use configured ZIP/default fees. If settings select an external provider and these differ, the displayed amount can diverge from the charged amount. Staff/store setting avoids that branch; current provider setting was not queried. [E02–E03, E06, E10]
- **Delivery failure/failed ID/unattended attempts:** no active automatic provider dispatch/webhook/refund workflow establishes the customer outcome. Provider payload flags alone do not prove handoff checks. Define staff actions, returned merchandise handling, charges and refund exceptions before drafting promises. [E05, E08, E13, E34]
- **Partial refunds:** webhooks can reflect cumulative partial refunds initiated externally, but application cancellation requests the full order total. No return-fee deduction or customer partial-refund UI/API was found. A previously partially refunded payment may need manual handling before requesting full total again. [E07–E08]
- **Fees/promotions:** announcement promises free delivery over $75, but authoritative fee logic is ZIP/default based without a basket-threshold waiver. Markup comments cite CRV/payment/VPS costs; no item-specific CRV calculation was found in that logic. Confirm/align both before publishing precise fee claims. [E10, E32]
- **Pickup:** supported, no delivery fee/tip, ID reminder exists, but confirmation-email pickup address conflicts with checkout. Pickup availability timing and uncollected-order policy are **NOT VERIFIED**. [E03, E05–E06]
- **Email accuracy:** pending delivery orders receive “Your order is on the way!” before staff acceptance/dispatch. This overstates fulfillment status. [E05]
- **Cancellations shown as successful:** handlers return a successful cancellation with an explicit warning when the refund failed. Customer order UI may show cancellation before money is settled. Avoid guaranteed immediate refund language. [E07–E08]
- **Return policy:** no dedicated `/delivery-and-refund-policy` route/page/footer link found. Terms mentions possible return fees but does not define amounts, cancellation windows, damaged/wrong goods, failed identification or refund posting time. [E19–E21]

### Proposition 65 inventory

The exact inspected heading is **“WARNING: Prop 65”**. Text, after JSX whitespace normalization:

> Drinking distilled spirits, beer, coolers, wine and other alcoholic beverages may increase cancer risk, and, during pregnancy, can cause birth defects. For more information please visit www.p65Warnings.ca.gov/alcohol.

The link target is `https://www.p65Warnings.ca.gov/alcohol`. [E19]

| Placement requested | Finding |
|---|---|
| Product pages | No warning component/text found in reviewed product-page source |
| Shopping cart | No warning component/text found in reviewed Cart source |
| Before payment / checkout | No warning found in reviewed Billing flow |
| Terms | Present at Terms.jsx:37–64 |
| Order confirmation emails | No warning found in order email template/controller substitutions |
| Delivery customer communications | No Balport warning template found in inspected provider adapters; provider-authored communications NOT VERIFIED |

This is a placement inventory, not a judgment about legal sufficiency. Counsel must review required wording, prominence, product coverage, timing and any other applicable warnings. [E19, E24]

## F. Accessibility Findings

Technical target: WCAG 2.2 Level AA. Criterion references below are engineering mapping targets, not a conformance determination. Browser evidence applies to the installed storefront shell with synthetic API responses and blocked third-party widgets. No screen reader, full keyboard purchase, actual payment widget, comprehensive 200%/400% text zoom, or site-wide contrast audit was completed.

| Finding | Severity | Evidence and verification | Recommended remediation / target |
|---|---|---|---|
| Age overlay lacks modal semantics and allows background focus | HIGH | Static AgeGate has no dialog/aria-modal/name binding/focus management/inert. Browser Tab sequence: No → Yes, I am 21+ → Balport Liquors home → Home → Shop while gate remains visible. E09; R02 | Accessible dialog with labeled purpose, contained focus, background inertness, sensible initial/restored focus; review 2.4.3, 2.4.7, 4.1.2 |
| Legal pages inaccessible through gate without acknowledgement | MEDIUM | Global AgeGate overlays public legal routes; its Terms/Privacy prose has no links. E09, E21 | Provide accessible policy links and an approved legal-page access strategy before attestation |
| Checkout visible labels are not associated with inputs | HIGH | First/last name, phone, address-related fields and note labels lack htmlFor/id association; error text lacks described-by/invalid bindings. Static finding; authenticated checkout not browser-tested. E03, E25 | Use associated labels, autocomplete/input types, aria-invalid/aria-describedby and accessible error summary; 1.3.1, 3.3.1, 3.3.2, 4.1.2 |
| Checkout/order errors and quote status not systematically announced | MEDIUM | Plain paragraphs/divs, no live-region/error-focus mechanism in inspected Billing. E03 | Use status/alert semantics selectively, announce totals/quote updates without stealing focus; 4.1.3, 3.3.1 |
| Footer social links have no accessible names | MEDIUM | Three icon-only `Link to="#"` elements; browser found 3 unnamed links on inspected routes. E21; R02 | Add clear names and real destinations or remove placeholders; 2.4.4, 4.1.2 |
| No main landmark on sampled pages | MEDIUM | `.main` class is a div, legal wrappers are divs. Browser found zero main/[role=main] on Privacy/Terms/Accessibility/Register/Login/Cart. No skip-link found in reviewed shell. E21, E26; R02 | One meaningful main landmark, skip link, deliberate route focus/title updates; 1.3.1, 2.4.1 |
| Weak small-text contrast | MEDIUM | AgeGate `text-gray-400` on white computes about 2.54:1; form `text-red-500` on white about 3.76:1 using default utility colors, below 4.5:1 for normal text. Static color calculations, not all rendered states. E09, E25 | Adjust foreground/background tokens and verify actual computed colors across states; 1.4.3 |
| Product pseudo-tabs lack tab semantics | MEDIUM | Product description/review controls are buttons without tablist/tab/tabpanel relationships. E27 | Implement accessible tabs with keyboard/selected/panel associations or use a simpler disclosed section structure; 1.3.1, 2.1.1, 4.1.2 |
| Review input/selection semantics incomplete | MEDIUM | HeadlessUI Dialog is a positive base; rating buttons have names, but no selected radio/group semantics, textarea only has placeholder. E30 | Add explicit label, rating group/radio state and keyboard tests; 3.3.2, 4.1.2 |
| Focus support is uneven | MEDIUM | Header/mobile nav/product cards have focus-visible outlines; forms often use focus rings. Slider slide wrapper suppresses outline. It is not established that every interactive item loses focus indication. E28 | Test actual focused links/buttons within carousel, all modal/footer/checkout controls; 2.4.7, 2.4.11 |
| Heading/page transition consistency | LOW | Legal pages have h1; Login and Cart page titles use h2; browser observed no h1 on register/login/cart samples. ScrollToTop scrolls but does not move focus. E26, E29 | Use logical heading structure and intentional route announcements/focus. Missing h1 alone is not asserted as automatic failure |
| Reflow and resize coverage incomplete | MEDIUM | Privacy page had no horizontal overflow at widths 320, 390, 1280. This verifies only those synthetic checks; zoom, large text, long products and sticky checkout overlap NOT VERIFIED. R02 | Verify 1.4.4/1.4.10 plus keyboard focus obstruction at real viewport/text sizes |
| Third-party interfaces | NOT VERIFIED | Google/Stripe/Maps requests blocked to avoid live processing | Test accessible authentication, wallets, errors and recovery in isolated vendor test environments |

Positive observations: native buttons/links are common; search has an accessible name and a search region; main/mobile navigation have labels; many image alts use product/category names; quantity controls have names and 44px sizing in several components; cookie buttons have minimum heights; review dialog uses HeadlessUI. Existing UI tests exercise some navigation/touch/error scenarios but are not a comprehensive accessibility suite. E28–E31, E33.

The existing Accessibility page offers an email and phone contact, includes an October 2026 update label, and refers to “mobile apps” and third-party properties. Native-app existence, an accessibility response SLA, actual accommodation process, external accessibility review, and complete WCAG conformance are **NOT VERIFIED**. Do not claim them as established facts. [E21]

## G. Compliance Gap Matrix

Severity is an engineering risk assessment, not a finding of legal violation. **CRITICAL** means potential exposure involving restricted sales/sensitive data/financial transactions; **HIGH** means significant compliance/consumer-protection concern; **MEDIUM** means important disclosure, implementation or accessibility gap; **LOW** means a narrower inconsistency/improvement. Test-mode configuration limits observed live-payment exposure but does not resolve design issues before live enablement.

| Finding | Severity | Legal/Operational Concern | Code Evidence | Recommended Action |
|---|---|---|---|---|
| G01: No verified-age/server eligibility requirement; tobacco path unrestricted | CRITICAL | Restricted goods can reach ordering logic without a backend age qualification; physical controls unverified | E04, E09–E11 | Management/counsel define authorized goods and required online/handoff controls before live sales |
| G02: Category-based alcohol flag omits RTD parent; no independent alcohol-hours guard | CRITICAL | Misclassification and mutable store hours can undermine intended restricted-goods handling | E10–E12 | Explicit restricted-goods model and validated category mapping; separately reviewed sale/handoff hour policy |
| G03: Charge can succeed without persisted/accepted order | HIGH | Customer may pay and receive no fulfilled order or automated refund | E02–E05, E08 | Durable checkout state/recovery and paid-without-order reconciliation; verify redirect completion |
| G04: Delivery coverage UI-only | HIGH | Unsupported destinations are not rejected authoritatively | E03–E06 | Server allowlist/geographic eligibility at quote, intent and order creation |
| G05: Essential Only is not enforced | HIGH | Privacy choice conflicts with tracking implementation | E14–E17, R02 | Central consent state gates scripts/events; preference change/GPC design after applicability review |
| G06: DoorDash verification/sharing claims overstate active workflow | HIGH | Current policy does not describe staff-managed fulfillment accurately | E05–E06, E18–E19 | Confirm manual vendor workflow and contracts, then align disclosures |
| G07: No active financial reconciliation for delivery failure/return | HIGH | Refund/restock/return-fee outcome undefined; unmounted legacy handlers also diverge from schema | E07–E08, E34 | Define state machine and approved remedies before provider enablement |
| G08: Proposition 65 only found in Terms | HIGH | Warning visibility/timing needs counsel review before paid alcohol orders | E19, E24 | Counsel specifies wording/placement; implement once approved |
| G09: No full deletion/export/privacy request workflow | HIGH | Policy deletion/access expectations exceed verified process | E18, E20–E21, E38–E39 | Inventory all copies, identity verification, retention exceptions, vendor/backups and request ownership |
| G10: Pickup-email address differs; pending-order email says on the way | HIGH | Customer could travel to wrong location or infer dispatch before acceptance | E03, E05–E06, E21 | Central store identity/config and lifecycle-accurate communications |
| G11: Checkout quote fee may differ from authoritative charge under external provider | HIGH | Display/charge inconsistency and financial support exposure | E02–E03, E06, E10 | Bind approved quote/fee server-side or consistently use one fee model |
| G12: Test-mode payments with production ordering UI | HIGH | Public checkout should not be described as verified live payment acceptance | R01, E02–E04 | Decide release mode; isolated live-readiness process without real purchases during audit |
| G13: Missing modal focus/checkout labeling | HIGH | Customer access to essential purchase/legal flows impaired | E09, E25, R02 | Accessible modal, form labels/errors; comprehensive testing |
| G14: No policy version/timestamp acceptance evidence; mobile notice absent | MEDIUM | Weak evidence of which terms customer saw/agreed to | E03–E04, E09, E11, E21 | Deliberate linked acceptance and version record; counsel defines need |
| G15: Backups retained without programmed purge; general record TTLs absent | MEDIUM | Erasure/retention statements cannot be universal or precise | E11, E17, E38 | Approved category-specific retention and backup restoration/deletion process |
| G16: Identifiable information in logs and notifications | MEDIUM | Additional copies/access paths require privacy/security scope | E04–E05, E17, E22–E23, E36 | Minimize/redact, document staff access and retention; no raw-log external analysis |
| G17: Free-delivery-over-$75 promise lacks matching fee logic | MEDIUM | Promotional claim may conflict with checkout charge | E10, E32 | Confirm business rule and align code/promotion |
| G18: Expired single-product sale price still used by total calculator | MEDIUM | Homepage expiry filtering differs from charged price behavior | E10; home.js:108–162 | Decide sale-expiry behavior and enforce same rule across display/calculation |
| G19: Footer email/phone targets and displayed content differ | MEDIUM | Privacy/support/accessibility requests may go to wrong destination | E21 | Confirm contacts and repair targets in separately authorized changes |
| G20: Incomplete warning/retention/vendor/analytics disclosures | MEDIUM | Privacy and Terms fail to describe implemented data flows | E18–E23 | Rewrite only after factual and business questions resolved |
| G21: Future DoorDash webhook would lack app signature check | MEDIUM | Dormant integration must not be enabled assuming current auth is complete | E08, E34 | Authenticate/replay-protect and validate states before mounting; currently disabled |
| G22: Frontend refresh path appears duplicated `/api/` | MEDIUM | API_BASE_URL ends `/api/`, helper appends `/api/auth/refresh`; recovery may fail after token expiry | E43 | Verify in isolated auth test; normalize URL; full end-to-end session recovery NOT VERIFIED |
| G23: Footer year and “mobile apps” statement need verification | LOW | Outdated/unverified presentation | E21 | Confirm current scope and update later |

## H. Management Questions

1. What is the registered legal entity, DBA, merchant of record, authoritative store/pickup address, and customer-support/privacy/accessibility contact? Which displayed phone numbers and inboxes are maintained?
2. What licenses and permits apply to this location and each online product category? Provide current ABC license type/number/conditions and any tobacco/nicotine permissions to counsel. No conclusion is inferred from the catalog.
3. Are tobacco/vapes/nicotine intended to be purchasable online, pickup-only, delivery-eligible, or excluded? Who maintains category/restricted-product flags?
4. What are the permitted ordering, sale, pickup and actual delivery/handoff hours for each restricted category? May staff extend store hours? How are overnight orders controlled operationally?
5. Is the site intended to remain in Stripe test mode? Who approves live credentials, processor methods, refunds/disputes and reconciliation? What happens to successful payments lacking an order?
6. At what point should an order be contractually accepted: submission, payment, persistence or staff acceptance? How should pending confirmations be worded?
7. Who actually delivers orders: employees, DoorDash merchant apps, Drive, Uber or another service? Which agreements permit alcohol/tobacco? Are customer data entered manually into external apps?
8. Who checks ID/age/intoxication at pickup/delivery? What evidence is recorded, where, for how long, and by whom? Are unattended deliveries prohibited in practice? Are recipients required to match the purchaser?
9. What geographic area and ZIPs are approved? Are cross-city/state destinations, PO boxes, restricted premises or different recipient addresses permitted?
10. What are the authoritative tax rates, taxable-category rules, markup/CRV/service-fee basis, delivery charges, free-delivery threshold and tip rules? Are external quotes charged or only shown?
11. What cancellation cutoff, failed-ID/no-recipient/incorrect-address/return fees, damaged or wrong item remedies, partial refunds and refund posting estimates are approved? Which fees/tips/taxes are refunded?
12. Are substitutions allowed, and how is customer consent captured? How are unavailable products discovered after payment handled?
13. Who owns privacy requests, identity checks, export/deletion/search across orders/reviews/coupons/newsletters/logs, vendor requests and backup retention exceptions? What turnaround commitments can actually be met?
14. Which retention periods apply to accounts, unverified accounts, orders, tax/payment evidence, analytics identifiers, logs, emails, support records and backups? Is offsite backup/disaster recovery configured and tested?
15. What Google Analytics properties/features, Google Signals/ads links, audience sharing, ad pixels outside source, tag-manager settings and Cloudflare products are enabled? Do contracts/practices constitute sale/share under applicable law? Counsel must decide.
16. Which privacy laws actually apply given business size, processing and relationships? How should GPC/opt-out signals, cookie preferences and authorized-agent requests be handled?
17. Does a mobile app exist? Who handles accessibility requests, what accommodation channels exist, and has an independent accessibility review been conducted?
18. Which Proposition 65 and other product warnings should appear at which points? Counsel must approve wording, placement and product scope.
19. Do current legal texts originate from a template, another merchant or counsel? Source provenance/license and original legal approval are **NOT VERIFIED**.
20. Which policy version/acceptance records and changes/notifications are required for the intended contract? What business facts must be fixed before publishing the four pages?

## I. Recommended Engineering Changes

Recommendations only; none implemented by this audit.

**Priority 0 — before approving live restricted-goods checkout**

1. Confirm business/licensing/fulfillment responsibilities with management/counsel. Define alcohol/tobacco eligibility explicitly; use product/category restriction attributes rather than fragile name/slug lists. Cover RTD products and mixed bundles.
2. Enforce approved age eligibility, service geography and sale/handoff timing on the backend. Require approved verification evidence at staff handoff without collecting unnecessary sensitive documents. Ensure direct API use cannot omit required eligibility inputs.
3. Make paid checkout durable and recoverable: inventory strategy, redirect completion, reconciliation of settled intents without orders, expiry/hours/amount changes, and retry-safe refunds. Document staff exception queues.
4. Resolve test/live payment release intent; independently validate webhook configuration and test-method coverage in an isolated environment. Do not perform a real purchase as an audit shortcut.

**Priority 1 — reconcile promises with behavior**

5. Gate tracking with actual preference state; implement approved GPC/opt-out behavior and preference changes; document cookies/localStorage and vendor settings. Stop implying current banner choices disable analytics.
6. Centralize store identity/address/contact/hours. Fix pickup-email location, pending-delivery headline, footer targets, free-delivery rule, and fee quote/charge consistency.
7. Define and implement delivery failure/return/cancellation/refund transitions and reconciliation, including partial-refund and fee treatment if approved. Align enums and protect terminal order states before enabling provider callbacks.
8. Place approved product warnings in approved customer touchpoints. Keep warning content separate from unsupported blanket compliance claims.
9. Add accessible, linked policy notices/acceptance across desktop/mobile and persist approved policy version/time evidence when required.
10. Fix age modal focus/semantics and checkout labels/errors. Add main/skip navigation, named footer links and verified contrast; test full keyboard and screen-reader checkout including vendor components.

**Priority 2 — privacy operations and verification**

11. Implement a documented privacy request/export/deletion process covering embedded order identities, coupon records, reviews, notifications, newsletters, identifiers, logs and backups, with approved retention exceptions.
12. Define data-specific retention, installed TTL/index checks, backup expiry/offsite recovery and vendor retention. Minimize identifiable log content.
13. Verify frontend session-refresh URL/recovery and expired-sale-price behavior in isolated tests. Review actual redirect/wallet availability and error recovery.
14. Add focused integration tests for age/geography/hours, late order failures, quote fee consistency, failed refund recovery and consent suppression. Existing tests should be retained as evidence of limited, mocked controls, not certification.
15. After business decisions and fixes, draft legal pages, obtain counsel approval, and establish owners/version review dates. No policy rewrite is part of this audit.

## J. Policy Drafting Readiness

| Proposed page | Confirmed facts ready to be written | Facts requiring verification | Decisions requiring management approval | Matters requiring California legal counsel |
|---|---|---|---|---|
| Privacy Policy | Actual collected categories/storage in B2; Stripe-hosted collection architecture; account cookies; Google/Gmail code; analytics and local storage; current deletion limitations | Active vendors/manual staff sharing, ad-account settings, vendor retention, installed TTL/backups, external support systems, live payment release | Retention, rights contact/process, tracking choices, GPC response, public review identity | Applicability/exemptions, required rights/disclosures, sale/share classification, sensitive-data treatment and vendor terms |
| Terms & Conditions | Stripe-only accepted order path; payment-before-staff-acceptance; pickup/delivery, stock checks, pending-only customer cancellation | Entity/license, actual handoff checks, hours, areas, substitutions, payment methods and incident handling | Contract formation, cancellation/refusal rules, tax/markup/CRV/fees, remedies, policy acceptance | Enforceability, age/restricted-goods obligations, liability terms, required warnings and disclosures |
| Delivery, Cancellation & Refund Policy | Staff-managed fulfillment code, conditional provider quotes, full-refund attempts, pending cancellation restriction, failure exceptions and pickup fee behavior | Driver contracts/practices, ID checks, return process, settlement times and provider charges | Coverage/hours, failed delivery/ID fees, returns, partial refunds, damages, pickup deadlines, substitutions | Alcohol/tobacco fulfillment constraints, fee/refund terms, consumer remedies and warning placement |
| Accessibility | Public contact statement; sampled technical findings and positive controls; no full conformance claim | Accommodation operations, mobile-app existence, third-party widgets, complete WCAG/manual testing | Responsible owner, contact routes, remediation schedule and service commitments | Applicable accessibility duties and defensible statement language |

**Readiness:** Technical facts are sufficient to start an internal factual outline. Publication-ready legal drafts are blocked by management decisions and verification gaps, particularly licensed goods/hours, test/live payments, staff handoff duties, actual vendor sharing, refund exceptions, privacy operations and tracking enforcement. Do not paper over missing controls with absolute policy promises.

## K. Evidence Appendix

Paths are relative to the project root unless explicitly absolute. Line numbers refer to the source inspected on 2026-10-29 and can shift after later edits. R entries are observations from this audit, not committed test files.

| ID | Exact evidence and function/route | Finding supported |
|---|---|---|
| E01 | `backend/src/index.js:248–276,333–368`; `backend/src/routes/order.js:10–25`; `backend/src/routes/payment-intents.js:4`; `backend/src/routes/stripeWebhook.js:7` | Parsing/raw webhook body, mounted order/payment routes; disabled delivery webhook mounts at index.js:358–360 |
| E02 | `backend/src/controllers/payment-intents.js:10–56`, `payment_intents`; `backend/src/utils/checkoutBinding.js:3–9`, `checkoutHash`; `backend/src/models/Checkout.js:2–6` | Authoritative intents, idempotency/owner binding, USD default, no age/hours/destination allowlist in route |
| E03 | `customer-panel/src/pages/Billing/Billing.jsx:31–64,152–214,216–239,330–390,432–517,568–578,915–949,974–1008,1035–1068,1088–1102`; `customer-panel/src/config/stripe.js:1–4`; `customer-panel/src/config/AppConfig.js:4–6` | ZIPs/forms/Maps, Stripe collection/confirm-before-order, desktop vs mobile notice, pricing and pickup |
| E04 | `backend/src/controllers/order.js:122–350`, `createOrder`; notably 139–145,163–172,239–257,283–350 | Stripe-only order, address-only backend gate, verified succeeded charge, sequential stock/order persistence |
| E05 | `backend/src/controllers/order.js:352–403,405–418,420–537`; `readHTMLTemplate:40–46`; `createOrder` | Post-persistence exceptions, disabled dispatch, notification/email, early on-the-way message, conflicting pickup email address |
| E06 | `backend/src/controllers/order.js:49–66,826–905`, `getDeliveryService`, `getStoreDeliveryFee`, `getDeliveryQuote` | Provider selection, ZIP/default fee, conditional courier quotes with customer data |
| E07 | `backend/src/controllers/order.js:80–120,661–705,720–732,909–1191`, `processStripeRefund`, `restockInventory`, `claimCancellation`, `acceptOrderByAdmin`, `denyOrderByAdmin`, `cancelOrderByCustomer`, `retryCancellation` | Full refund, inventory idempotency, state/cancel rules, staff acceptance/reconciliation |
| E08 | `backend/src/controllers/stripeWebhook.js:6–56`, `applyEvent`/`handleStripeWebhook`; `backend/src/models/StripeEvent.js:3–6`; `backend/src/index.js:268–275,356–360` | Signed persisted/deduplicated payment events, refund/dispute summaries, disabled delivery callbacks |
| E09 | `customer-panel/src/components/age-gate/AgeGate.jsx:7–30,35–65`; `customer-panel/src/App.js:89–93` | Persistent self-attestation, no policy links/modal focus management, global overlay |
| E10 | `backend/src/utils/orderCalculator.js:17–21,91–183,195–288,290–394`, `calculateOrderTotals` | Alcohol slug list, stock/price validation, unexpired bundle checks, sale price, tax/markup/tip/fee logic |
| E11 | `backend/src/models/User.js:4–155`; `backend/src/models/Order.js:5–193`; `backend/src/models/Product.js:3–114`; `backend/src/models/Category.js:23–73`; `backend/scripts/apply-category-hierarchy.js:147`; `backend/src/scripts/import-pricebook-subcategories.js:27` | Personal/order fields, absent age/consent/product restriction attributes, RTD/tobacco taxonomy |
| E12 | `backend/src/middleware/checkStoreHours.js:5–87`, `isStoreOpen`/`checkStoreHours`; `backend/src/models/settings.js:25–55,64–83`; `backend/src/routes/order.js:10–12`; `backend/src/routes/settings.js:10–16`; `backend/src/controllers/settings.js:19–39,82–132` | Overnight configurable hours/defaults, fail-closed exceptions, no separate alcohol-hour boundary |
| E13 | `backend/src/services/doorDashService.js:4–10,41–99,104–131,136–174` | Drive v2 endpoints, recipient/order payloads, alcohol handoff and return flags, quote logging |
| E14 | `customer-panel/src/components/cookie-consent/CookieConsent.jsx:7–35,41–83` | Local accepted/essential_only UI, no collection gating/action linkage |
| E15 | `customer-panel/src/App.js:23–53,63,89–93`, `PageTracker` | Tracking mounted independent of consent; recovery routes excluded |
| E16 | `customer-panel/public/index.html:28–36` | Google Fonts and unconditional gtag configuration |
| E17 | `customer-panel/src/services/analyticsService.js:3–23`; `backend/src/controllers/analytics.js:4–40`, `trackView`; `backend/src/models/PageView.js:5–40`; `backend/src/routes/analytics.js:8–11` | Persistent ID, unauthenticated analytics payload, IP/device/referrer, schema TTL, protected admin aggregate |
| E18 | `customer-panel/src/pages/Privacy/Privacy.jsx:10–45`, `Privacy` | Current collection/Stripe/DoorDash/rights/cookie claims and March update label |
| E19 | `customer-panel/src/pages/Terms/Terms.jsx:10–33,37–74`, `Terms` | Age/compliance/Dasher/return-fee/payment statements, exact warning, September update label |
| E20 | `backend/src/routes/user.js:8–44`; `backend/src/controllers/user.js:13–30,77–189,193–214`; `backend/src/controllers/admin.js:116–139` | Profile/order access; no self-deletion/export route; admin deletion removes only User |
| E21 | `customer-panel/src/components/footer/index.jsx:13–24,31–40,43–77`; `customer-panel/src/pages/Accessibility/Accessibility.jsx:10–22`; `customer-panel/src/routes/PublicRoutes.jsx:24–37`; `customer-panel/src/routes/AuthenticatedRoutes.jsx:34–42` | Public legal routes/contact/date text, incorrect link targets, missing delivery/refund policy |
| E22 | `backend/src/controllers/googleAuth.js:64–97,113–172`; `customer-panel/src/components/google-signin/GoogleSignInButton.jsx:8–31,43–54,90–100`; `backend/src/controllers/auth.js:150–214,256,302–317` | Google profile/linking and registration data, local browser profile cache, identifiable auth logs |
| E23 | `backend/src/utils/mailer.js:13–26,29–38,48–71`, `getAuthorizedGmailClient`/`sendEmail`; `backend/src/utils/emailGuard.js:88–103` | Gmail OAuth API, recipient/content and logs, DNS MX domain check |
| E24 | `customer-panel/src/pages/product/index.jsx`, `customer-panel/src/pages/cart/Cart.jsx`, `customer-panel/src/pages/Billing/Billing.jsx` (reviewed render paths); `backend/src/email-templates/order.html:93–157`; `backend/src/controllers/order.js:420–523` | Warning search/placement inventory: only Terms matches scoped source warning search; dynamic product descriptions not queried |
| E25 | `customer-panel/src/pages/Billing/Billing.jsx:591–616,625–731,741–747,988–1003`; `customer-panel/src/pages/auth/Register.jsx:220–253`; `customer-panel/src/pages/auth/Login.jsx:142–173` | Unassociated checkout labels/errors contrasted with associated auth labels; announcements/terms rendering |
| E26 | `customer-panel/src/pages/Privacy/Privacy.jsx:5–8`; `customer-panel/src/pages/auth/Login.jsx:128–137`; `customer-panel/src/pages/cart/Cart.jsx:137–148`; `customer-panel/src/routes/PublicRoutes.jsx:21–40` | Div wrappers, sampled heading/landmark structure |
| E27 | `customer-panel/src/pages/product/index.jsx:392–419` | Description/review pseudo-tabs |
| E28 | `customer-panel/src/index.css:33–38,355–358`; `customer-panel/src/components/header/index.jsx:73–116,145–146` | Focus styles, named search/navigation and icons; carousel outline suppression |
| E29 | `customer-panel/src/components/scroll-to-top/ScrollToTop.jsx:4–9` | Scroll-only route transition |
| E30 | `customer-panel/src/components/review-modal/index.jsx:57–98` | HeadlessUI dialog, rating buttons and placeholder-only textarea |
| E31 | `customer-panel/src/pages/cart/Cart.jsx:170–173,187–205`; `customer-panel/src/components/cookie-consent/CookieConsent.jsx:69–82`; `customer-panel/src/components/category-slider/index.jsx:91–117` | Image alternative text, named quantity/remove controls, minimum target sizing |
| E32 | `customer-panel/src/components/header/AnnouncementBar.jsx:3–8,16–34` | Free-delivery/hour claims and sessionStorage preference |
| E33 | `backend/tests/auth-boundaries.test.js:109–320`; `backend/tests/remaining-security.test.js:39–225`; `customer-panel/test/storefront-ui.cjs:1–90`; `customer-panel/src/components/header/Header.test.jsx`; `customer-panel/src/components/mobile-bottom-nav/MobileBottomNav.test.jsx` | Existing mocked auth/payment/stock/refund tests and limited UI checks inspected, not rerun |
| E34 | `backend/src/services/uberDirectService.js:7–30,40–99,103–180`; `backend/src/controllers/uberDirectWebhook.js:6–33,74–155`; `backend/src/controllers/doorDashWebhook.js:5–104`; `backend/src/routes/doorDashWebhook.js:5–7`; `backend/src/controllers/order.js:1194–1235` | Uber auth/minimum-age/signature options; dormant webhook verification/status/failure limitations |
| E35 | `backend/src/controllers/upload.js:13–49`; `backend/src/services/cloudinary.service.js:44–87`; `backend/src/utils/localImageStore.js:5–30,43–56`; `backend/src/routes/upload.js:9` | Admin-only sanitized local-first images with remote upload attempt; no identity-document collection purpose |
| E36 | `/etc/nginx/sites-enabled/balport:15–25,28–53,57–85,91–116`; matching repo `nginx-staging/f4-balport.conf`; `customer-panel/nginx.conf:13–18`; `backend/src/index.js:209–241`; `/etc/logrotate.d/nginx:1–23` | Active HTTP redirect/TLS/CF peer/Basic Auth configuration, HSTS/CSP, identifiable logs and 14 rotations |
| E37 | `backend/src/models/User.js:83–141,151–168`; `backend/src/controllers/auth.js:26–28,62–134,783–800,1110–1148`; `backend/src/utils/authTokens.js:40–65`; `backend/src/utils/authSession.js:3–7`; `backend/src/config/jwt.js:5–20`; `backend/src/utils/mfaCipher.js:3–26`; `backend/src/middleware/mongoRateStore.js:4–19` | Bcrypt, JWT scopes/lifetimes, rotation/invalidation, cookie flags, encrypted MFA, TTL rate buckets |
| E38 | `ops/security/backup-db.py:2–16`; `ops/security/encrypt-backup.py:7–28`; `ops/security/roma-backup.service:4–14`; `ops/security/roma-backup.timer:3–7`; `docker-compose.yml:114–150`; `/etc/project-roma/hardened.yml:20–62` | Encrypted backups with no purge code, timer schedule, infrastructure retention boundaries; no archive content inspected |
| E39 | `backend/src/models/Newsletter.js:4–12`; `backend/src/controllers/newsletter.js:31–48`; `backend/src/routes/newsletter.js:9–13`; `backend/src/models/CouponCode.js:32–43`; `backend/src/models/Notification.js:4–37` | Newsletter/coupon/notification identity copies; no unsubscribe or full deletion workflow in inspected routes |
| E40 | `customer-panel/src/redux/cartSlice.js:3–10,46–65`; `customer-panel/src/redux/authSlice.js:3–18`; `customer-panel/src/components/google-signin/GoogleSignInButton.jsx:43–46`; `backend/src/models/User.js:39–56` | Local cart/profile/auth storage; wishlist/order/recent-product references |
| E41 | `backend/src/models/Review.js:3–42`; `backend/src/controllers/review.js:7–17,50–106`; `backend/src/routes/review.js:8–13` | Public review author names/cover and user-generated content; protected creation/admin reads |
| E42 | `backend/src/models/Recommendation.js:3–31`; `backend/src/controllers/recommendation.js:99–120`; `backend/src/jobs/dailyLogReport.js:1–5` | Product association rather than direct personal profile; retired application log analysis |
| E43 | `customer-panel/src/config/AppConfig.js:4`; `customer-panel/src/interceptor/fetchInterceptor.jsx:55–68,87–106` | API-base suffix and potentially duplicated refresh path; runtime end-to-end unverified |
| E44 | `admin-panel/src/pages/OrderDetail.tsx:228–235`; `backend/src/controllers/user.js:193–214`; `backend/src/routes/user.js:8–44` | Print placeholder, disabled manual email, limited user access rather than complete privacy export |
| R01 | Read-only runtime classification: backend secret-key type TEST; deployed JS public-key type TEST; webhook/Google/Gmail/DoorDash/Uber/Cloudinary presence flags true; literal Maps loader absent in bundle. `index.js`, order/payment controllers, orderCalculator, checkStoreHours and stripeWebhook matched workspace bytes. | Configured modes/presence, not credentials, provider health, transactions or DB values |
| R02 | Playwright loopback static-only check, synthetic API responses and all external traffic blocked. Legal headings rendered; 3 unnamed links and no main landmark on six sampled routes; Privacy no horizontal overflow at 320/390/1280; age focus escaped; one track-view and one Google tag loader attempted with Essential Only. First pass intercepted 30 API requests and blocked 32 external requests. | Limited browser-confirmed accessibility/consent behavior; no production API traffic allowed |
| R03 | Read-only `systemctl is-enabled/is-active roma-backup.timer` returned enabled/active; active nginx and logrotate read directly. Backup scripts, archives, recovery and cloud dashboard were not executed/inspected. | Configuration only, no proof of completed backup or effective vendor/data-retention policies |

### Evidence limitations that remain explicit

- Actual legal identity/licensing, vendor contracts/account eligibility, tax correctness, database settings/indices/records, staff ID checks, delivery outcomes, refund settlement, offsite backups, mobile apps, external support retention, advertising-account settings and full accessibility conformance: **NOT VERIFIED**.
- A product description could contain additional warnings from database content; no such records were queried. The warning-placement finding concerns application-authored templates/components, not every dynamic catalog record.
- Current backend runtime source matches support core operational findings; this audit did not exhaustively compare every bundled frontend component or backend file against source.
- A “configured” integration is not a tested integration. A disabled handler's shortcomings are future-enablement concerns, not proof of currently reachable behavior.
- No dependencies were installed, tests edited, services restarted, Docker builds/deployments performed, policy text rewritten, third-party requests sent, or application/production configuration modified during this audit.
