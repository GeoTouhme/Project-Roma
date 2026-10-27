> Historical pause snapshot. Work resumed and the release deployed on 2026-10-26. See [the current deployment report](SECURITY_REMEDIATION_2026-10-26.md).

# Remaining security remediation — 2026-10-25

**Status: PAUSED at the owner's request, 2026-10-25 09:07 UTC.**

Production containment for R01/R22 is applied. The broader application/database release **has not started**. All other implementation changes described below are staged and must not be treated as deployed fixes.

The interrupted deployment command did not create its rollout script or start a rollout process. No database bootstrap or deployment-completion marker exists. Current production container image IDs and start times confirm that MongoDB, both panels, and the image service are unchanged. Temporary browser preview servers were stopped; no remediation/deployment task is continuing in the background.

## Production containment

- Docker socket removed from the production backend at 08:38:58 UTC; the R02/R03 application image is unchanged.
- Raw-log export recipients and Ollama configuration disabled. Public API health returned 200. Other Balport containers unchanged.
- Existing database dumps and workspace environment file restricted to 0600; root-only production configuration staged outside the checkout.
- Fresh database backup restored successfully in an isolated container. Application read/write worked, admin access and anonymous metadata access were denied. Backup encrypted with AES-256-GCM; authenticated decrypt/hash verification passed.

## Candidate changes

| Finding | Implemented change | Remaining verification/release work |
|---|---|---|
| R01 | No Docker socket in application Compose; nonroot/read-only candidate; host aggregate health checker replaces in-app collection. | Containment deployed; candidate source/host monitoring release pending. |
| R04 | Validate fixed/mix bundle eligibility, exact quantities, authoritative prices and aggregate stock. | Release and verify deployed hashes. |
| R05 | Database session IDs; atomic refresh consumption; logout/password/reset revocation; current role/status checks and socket revalidation. | Release and verify deployed hashes. |
| R06 | Authenticated MongoDB; separate internal network; readWrite app and read-only backup identities; volume-preserving bootstrap. | Release and verify deployed hashes. |
| R07 | Patched dependencies; retired Docker/log-report dependencies; compressed JSON disabled. | Release and verify deployed hashes. |
| R08 | Durable verified event records before acknowledgment; replay-safe cumulative refund totals; payment events cannot reset fulfillment. | Release and verify deployed hashes. |
| R09 | Atomic cancellation/acceptance claims; per-product restock markers; stable refund idempotency key; protected administrative recovery endpoint; paid-order retention. | Release and verify deployed hashes. |
| R10 | Backup permissions tightened; isolated restore and authenticated encryption verified. | Off-host destination and separate key recovery location required from owner. |
| R11 | Protected production environment; independent MFA key and compatibility keyring; dry-run/apply migration utility. | Release and verify deployed hashes. |
| R12 | Untrusted panel peers cannot forward supplied identities; exact proxy addresses pinned. | Release and verify deployed hashes. |
| R13 | Credential fields hidden and stripped from document JSON; coupon identities and public review order IDs removed. | Release and verify deployed hashes. |
| R14 | All role changes require current super-admin role; generic super-admin demotion prohibited to eliminate last-account races. | Release and verify deployed hashes. |
| R15 | Decode and reencode raster uploads to WebP; extension/MIME/dimension limits; active document serving denied. | Release and verify deployed hashes. |
| R16 | HTML/static headers and restrictive object/frame/base policy; full CSP in report-only mode pending browser acceptance. | Full CSP enforcement requires Stripe/Google/maps acceptance and violation review. |
| R17 | Pre-parser aggregate IP budgets, durable Mongo counters, bounded cart/pagination/analytics fields, 90-day expiry on newly created analytics. | Release and verify deployed hashes. |
| R18 | Authenticated payment intents with owner/cart/currency metadata and checkout records; atomic claim; ownership before duplicate-order responses. | Release and verify deployed hashes. |
| R19 | Immutable owner ID required; ownerless and email-fallback access denied. | Release and verify deployed hashes. |
| R20 | Supported Node builders, reproducible lock installs, pinned image digests, Vite migration, pruned/nonroot candidate and resource limits. | Release and verify deployed hashes. |
| R21 | Immutable candidate images, source manifests, protected rollback metadata and this finding ledger. | Final source snapshot and release records; preserve unrelated workspace changes. |
| R22 | Raw export workflow retired; host-only aggregate monitoring with no external log transfer. | Containment deployed; candidate source/host monitoring release pending. |

R02/R03 remain deployed from the previous release and their regression tests are retained.

## Completed validation

- **83 backend tests pass** in the exact Alpine/nonroot candidate with no network, Docker socket, writable root, or capabilities.
- Production-mode synthetic API: health, unauthenticated payment rejection, compressed-body rejection, pagination/analytics validation, rotating-email aggregate limit, and restart-persistent rate budgets pass.
- Both panel proxy configurations pass synthetic lateral spoof denial, trusted forwarding, HTML and asset header checks.
- Customer and admin dependency audits report zero advisories. Backend production dependency audit reports zero advisories.
- **6 frontend tests pass** across 3 suites. Both production builds and the admin TypeScript check pass. Headless browser storefront recovery, fragment reset, and admin MFA challenge pass with zero uncaught browser errors; all API/provider traffic was mocked.

## Operational limits

- No real payment, refund, order mutation, reset mail, or customer password change is used as a test.
- Plutus, Brew Co, and Portainer remain stopped.
- Final backend, customer, and admin candidate images were scanned with Trivy 0.76.1: **zero HIGH/CRITICAL findings**. This scan does not assert zero lower-severity issues, cover unchanged MongoDB/host packages, or establish complete security.
- External IPv4/IPv6 origin acceptance, real authenticated provider/browser acceptance, off-host backup delivery and key recovery remain distinct sign-off items.
- Do not restore the pre-F4 Nginx configuration or reintroduce the Docker socket during rollback.

## Current production state at pause

| Service | Running image | Started UTC |
|---|---|---|
| Backend | `d0de9920bfdc9a68e728f3216e71f26d3d89ddb3f74f31059c3681e9f030bdc5` | 2026-10-25 08:38:58 |
| Customer panel | `04693a5b85c6d020e280340bd3e9e18df4e8c515ef0755380f695474acb87894` | 2026-10-24 14:42:20 |
| Admin panel | `811e3fe76c14e4131fca6d5d72723ed1cd80e3cf4b9f89d386af3f990cf2db9e` | 2026-10-24 12:25:50 |
| MongoDB | `e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3` | 2026-10-24 11:02:16 |
| Image fallback | `13064357b5d105501b700302851e7b77e355c0be3e4499b968f83012a0243942` | 2026-10-17 10:40:55 |

- Public API health: **HTTP 200** at the pause check.
- Backend Docker socket absent; raw-log export recipient configuration empty.
- Backend still runs Node **v22.23.4** and the previously deployed R02/R03 code.
- MongoDB authentication/private networking and independent MFA key rollout **are not applied**. The new DB identities have not been bootstrapped. No MFA enrollment migration ran.
- Storefront/admin/new checkout/session/upload/dependency/header fixes are **not yet live**.
- Plutus API/Mongo/ngrok, Brew Co backend/frontend/Postgres, and Portainer agent remain stopped.
- Host Nginx origin gate/real-IP/TLS configuration was not modified by this work.

## Saved handoff and recovery material

- This report: `SECURITY_REMEDIATION_2026-10-25.md`.
- Original findings: `SECURITY_FINAL_AUDIT_2026-10-24.md` (historical audit, retained).
- Sanitized results and candidate image IDs: `docs/security-artifacts/pause-verification.json` and adjacent API/proxy/browser result files.
- Backend dependency SBOM: `docs/security-artifacts/backend.cdx.json`.
- Source changes, tests, Dockerfiles and operational helpers remain in the workspace; **no Git commit or push was made**. Preserve existing unrelated work when reviewing the diff.
- Successful production containment configuration/evidence: `/root/roma-containment-20261025T083821Z/`.
- Frozen candidate manifests, protected staged environment, database identity material, pre-release container metadata, and rollback image mappings: `/root/roma-security-release-20261025/` (root-only).
- Protected backup, restore proof, and encrypted archive: `/root/roma-security-20261025/`; encryption key: `/etc/project-roma/backup-encryption.key` (root-only; value omitted).
- Emergency backend rollback image includes MFA cipher compatibility; the rollback release remains staged and has not been exercised as a complete production rollback.

## Resume work

1. Recheck live service/container state and compare frozen candidate hashes with the workspace and Docker tags. Recreate the interrupted rollout helper only after this check.
2. Review the frozen production/rollback manifests and the successful isolated restore. The new production Compose definition enables auth/private networking and must be released with the protected staged credentials and bootstrap procedure.
3. Bootstrap app/admin/read-only-backup DB identities, deploy the nonroot backend, then cut MongoDB over on the **existing** volume; verify health and anonymous/admin privilege denial. Roll panels/image service over with the tested artifacts and preserve pinned proxy IPs.
4. Dry-run and apply the MFA ciphertext re-encryption with its compatibility key retained until verification succeeds. Activate the protected canonical deployment configuration and host-only monitoring.
5. Verify deployed hashes, security tests, public origin protection, browser/customer/admin flows and monitoring. Existing sessions will require a fresh login. Previously paid/in-flight checkouts need staff-assisted reconciliation if they predate checkout binding; do not issue real transactions/refunds as a test.
6. Obtain the off-host backup destination and a separately protected key-recovery location from the owner. No off-host upload has occurred.
7. Finish CSP violation/third-party compatibility review, external IPv4/IPv6 acceptance, and the final finding-by-finding closure review. Full CSP is currently a report-only candidate; no complete production sign-off is claimed.

Older R02/R03 or pre-F4 rollback instructions can restore older mounts or origin rules. Use the current containment/release records when preparing recovery so Docker authority and origin bypass are not reintroduced.
