# P0 checkout remediation — 2026-10-29

Status: engineering changes implemented and tested; separately tagged Docker candidates built. **This task has not changed running containers or protected production configuration.** Management decisions requested during this task remain unanswered. Live checkout remains unapproved.

This is an implementation/release note, not a legal policy or a certification of lawful sales. The original legal technical audit is retained as the pre-remediation snapshot.

## Implemented controls

### Restricted products and handoff

- Product and Category now have an explicit `restrictionType` attribute. The admin category/product forms expose it. A product override can add a restriction, but cannot remove a known restricted category's alcohol/tobacco requirement.
- Existing recognizable category slugs have one centralized compatibility mapping, including Ready-to-Drink & Seltzers and tobacco/nicotine. Unknown categories fail checkout. An explicitly unclassified product is blocked even inside a known category.
- **Live checkout requires explicit product/category classification.** The compatibility mapping alone cannot authorize a live purchase. No production catalog records have been migrated or reclassified automatically.
- The server requires a boolean 21+/photo-ID acknowledgement for restricted products and records the server-received timestamp and policy version. This is self-attestation, not verified online identity. No DOB, ID number or document is collected.
- Restricted-product completion requires staff attestations for photo-ID inspection, age 21+, recipient presence and recipient eligibility. The backend records staff identity, time and policy version, ignoring unrelated ID/document fields. It reclassifies stored-order products so a missing legacy alcohol flag cannot skip the check.
- Restricted handoff also requires an approved procedure and configured restricted-goods hours. Staff acceptance/shipping/completion cannot proceed on a refunded, disputed or otherwise unsuccessful payment.
- Physical ID checks, staff training, vendor permissions and business licenses remain management/operational responsibilities; the code cannot independently verify that staff performed the attested checks.

### Destination, hours and payment mode

- Delivery ZIP/state/country/address checks run server-side before creating a PaymentIntent and before creating an order. Quotes use the same destination validation.
- The initial sandbox ZIP list preserves the seven ZIPs previously present in the customer UI. The UI now reads the list from the backend rather than maintaining a second authoritative list.
- Store hours apply to PaymentIntent creation as well as order completion. Overnight schedules and exact closing boundaries are tested; missing/invalid schedules fail closed.
- Restricted-goods hours are a separately configurable policy and also apply at handoff. No statutory schedule or license condition has been invented or silently approved.
- Payment mode defaults to test. A live key alone fails initialization. Live initialization requires an explicit matching mode, live-checkout approval, webhook configuration and, for restricted goods, a reviewed policy/procedure and explicit product classifications.
- The frontend verifies its public-key mode against the server's mode and clearly labels test checkout. Admin order detail flags test payments as unsuitable for fulfillment as a paid live purchase.
- Stripe webhook signatures and the event's test/live environment are checked independently of the UI.

### Durable checkout and financial recovery

- Before returning a client secret, the server persists a versioned checkout with authoritative price/total/item snapshots and a sanitized recipient/request snapshot.
- Payment metadata and idempotency bind owner, cart/amount/currency and recipient/policy acknowledgement. Changing the recipient requires a different payment binding. Client replacement of prices, address or acknowledgement after payment is ignored in favor of the stored snapshot.
- Checkout completion rechecks current product restrictions, store/restricted hours and stock. Agreed price snapshots are preserved if the product price changes after payment.
- Customer recovery and signed success webhooks can both complete the same saved checkout. Conditional checkout claims, stock updates and the unique order payment ID protect concurrent/repeated completion.
- The return page handles redirected payments, resumes after login, removes return-query client secrets from subsequent navigation, retains only checkout/payment identifiers in sessionStorage, and asks customers not to pay again while recovery is unresolved.
- Incomplete attempts must be cancelled server-side before a fresh attempt. A cancellation/payment-success race recovers the paid order instead of treating it as unpaid.
- A settled payment that cannot produce an eligible/in-stock order is claimed for refund only when no order/inventory completion owns the claim. Refund retries use stable idempotency and tagged refund lookup; pending/failed refunds remain distinguishable from completed refunds.
- Ambiguous interrupted stock/order claims enter manual review instead of being automatically released or refunded. This avoids issuing a refund while a competing completion might still create an order.
- Current charge data and durable signed refund/dispute events are checked. A PaymentIntent's succeeded state alone cannot resurrect an externally refunded/disputed payment. Payment events that arrive before order persistence are reapplied before fulfillment becomes eligible.
- Notification failure after order persistence no longer turns a successfully saved paid order into a failed checkout response.
- A bounded production recovery job scans at most 20 eligible saved checkouts per minute, spacing rechecks by five minutes. It does not initiate new charges. It is disabled under test NODE_ENV.
- Admin Orders includes a reconciliation queue for refund-pending/manual-review checkouts and a safe retry action. Current queue display is bounded to the oldest 100 entries; high-volume queue pagination/operations scaling remains follow-up work.

**Capture behavior has not changed:** payment still captures immediately and staff accepts afterward. Authorization-first/capture-on-acceptance was proposed as a separate decision; it has not been approved or implemented. Stock is still conditionally decremented at order creation, rather than reserved before payment. Durable completion/refund/manual-review paths address post-payment stock failures.

## Added API surfaces

| Route | Access | Behavior |
|---|---|---|
| `GET /api/checkout-policy` | Public, existing API limiter | Sanitized payment mode, policy version, ZIP list and allowed fulfillment flags; no approval identities or credentials |
| `POST /api/checkouts/recover` | Authenticated customer | Recover only a checkout owned by that customer, using checkoutId or paymentId |
| `POST /api/checkouts/cancel-unpaid` | Authenticated customer | Cancel only that customer's incomplete attempt; recover instead if it succeeded |
| `GET /api/admin/checkouts/reconciliation` | Authenticated admin | Bounded queue of refund-pending/manual-review records without contact snapshots or client secrets |
| `POST /api/admin/checkouts/:id/recover` | Authenticated admin | Retry safe completion/refund reconciliation; does not force-release uncertain stock claims |

The existing order-update route accepts `handoffVerification` only when recording completion. Required values are `photoIdChecked`, `age21Confirmed`, `recipientPresent` and `recipientEligible`, all true. The server supplies the staff identity and timestamp.

## Configuration and decisions before release

These are new setting names and draft field definitions, not current production values. No protected environment file was edited.

- `PAYMENT_MODE`: defaults to `test`; accepted values `test` or `live` and must match the secret-key type.
- `LIVE_CHECKOUT_APPROVED`: live initialization requires the literal `true`. Do not set this merely to make checkout errors disappear.
- `CHECKOUT_POLICY_JSON`: optional server-controlled JSON policy. It is not editable by customers and is not exposed wholesale by the public endpoint.

Supported policy fields:

| Field | Meaning / approval needed |
|---|---|
| `version` | Identifier for the reviewed business procedure/policy configuration |
| `deliveryZips` | Approved array of ZIP strings; sandbox default preserves the existing UI list |
| `allowedFulfillment` | Array containing the approved `pickup` and/or `delivery` modes |
| `alcoholEnabled` | Sandbox default true; requires management confirmation for live use |
| `tobaccoEnabled` | Default false; do not enable without approved product/vendor/licensing decisions |
| `approvedBy`, `approvedAt` | Management approval reference and date; do not imply the application independently validates a license |
| `handoffProcedureApproved` | Explicit approval of the documented staff procedure; required for restricted handoff |
| `timezone` | Reviewed IANA timezone for the restricted-hours policy |
| `restrictedHours` | Exactly seven `{dayOfWeek, isOpen, open, close}` entries with valid HH:mm times; separate from general store hours |

An empty/missing restricted-hours procedure is intentionally insufficient for live restricted checkout or restricted handoff. No real restricted handoff should be enabled until management/counsel supplies the permitted schedule and procedure.

Unanswered decisions requested during implementation:

1. Alcohol only, alcohol plus tobacco/nicotine, or restricted products pickup-only?
2. Confirm delivery ZIPs and approved ordering/pickup/delivery/handoff hours, including overnight operation and any license conditions.
3. Keep immediate capture with recovery/refunds, or move to authorization-first and capture only after staff acceptance?

Business identity, current licenses, vendor agreements and actual staff procedures from the original audit also remain unverified. No code change can establish those facts.

## Validation

- Database-independent backend suite: **167 passed** in the final run.
- Storefront Jest suite: 40 passing tests, including return-query cleanup, login, recovery failure and unpaid-attempt cancellation.
- Admin TypeScript check: passed.
- Storefront and admin Vite builds: passed; existing dependency directive/chunk-size warnings remain.
- Dedicated real-Mongo integration: executed in disposable containers with no external network and no published ports. The test asserts a fixture-only database/hostname before writes. It covers simultaneous recovery, immutable prices, exact stock decrement, locally signed Stripe webhooks, tampered signatures, stock-race refunds and early-refund history.
- Stripe responses are synthetic. Signature checks use the installed SDK's local signing/verification helpers. No real purchases, refunds, customer messages, provider delivery calls or production database tests were performed.
- Existing subcategory/inventory Mongo fixture suites are not claimed as rerun; they require separate dedicated replica-set fixtures and were excluded from the database-independent suite.

The implementation follows Stripe's documented separation between [payment status and subsequent refunds/disputes](https://docs.stripe.com/payments/payment-intents/verifying-status), [refund/cancellation states](https://docs.stripe.com/refunds), and [signed webhook handling](https://docs.stripe.com/webhooks). These references do not establish Balport's actual vendor configuration or legal compliance.

## Docker candidates and rollout

Prepared image tags:

- `project-roma-backend:p0-checkout-20261029`
- `project-roma-customer-panel:p0-checkout-20261029`
- `project-roma-admin-panel:p0-checkout-20261029`

These are candidate images, not a deployment. This task did not update the production release manifest or recreate production containers. The backend candidate overlays 23 P0 source files on the prior release image and preserves the active sitemap fix; all untouched JavaScript and dependency manifests were compared with the running backend and match; frontends use the existing protected build configuration with separate image tags.

Recorded local image IDs:

| Candidate | Image ID |
|---|---|
| Backend | `sha256:4073db197b6f67f72b053c528bcac5fe0ebd530c7b68a0b748595f772f55a6a0` |
| Storefront | `sha256:31b0ef6b3a0af387b174e6e368930fc1243ea48c975250e464776b21370cdfd4` |
| Admin | `sha256:3fb8c4a295f5b144e04246d4e2ae5a033a5127a530dfb9cc8161522fedc91349` |

Before an approved rollout, retain the current release manifest for rollback, review the actual business-policy configuration, and use the production Compose wrapper and hardening overlay. Do not switch to live keys or enable automatic courier dispatch as part of this release by implication.

After deployment, verify mode/ZIP readiness and unauthenticated route protection without creating a real payment. Test the full customer/provider workflow only in an expressly approved vendor test environment. Reverting only one frontend/backend can break the new recovery flow; treat the three images as one release. Do not roll back the backend while unresolved version-2 paid checkouts exist without a reconciliation plan.

## Staff reconciliation procedure

1. Review the pending entry, payment identifier, related order (if any), refund state and stock history. Do not ask the customer to pay again while the original attempt is unresolved.
2. For `refund_pending`, the safe retry reuses the same tagged refund and idempotency key or retrieves its current state. A pending API refund is not a promise about bank posting time.
3. For `manual_review`, establish whether an order or stock change committed before any corrective action. Safe retry deliberately does not clear an ambiguous claim. Authorized staff must reconcile provider and inventory records using the approved operational procedure; no forced-reset API was added.
4. Record the outcome and preserve the payment/order link. Do not issue duplicate refunds, re-charge the customer, or blindly increment stock to make the queue disappear.

Manual review is intentionally conservative. An interrupted multi-document operation on standalone MongoDB cannot be inferred safely from a timer alone. A future reservation ledger/transactional architecture may reduce these cases, but this release does not claim to eliminate them.
