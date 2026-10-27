# Security remediation deployment — 2026-10-26

**Status: security release deployed.** Production health and technical checks pass. Off-host recovery, real authenticated/provider acceptance and full CSP enforcement remain open; this is not a complete security sign-off.

## Outcome

- Deployed the tested backend, storefront, admin and image-service images. MongoDB now requires credentials and uses a separate internal network. The existing `project-roma_mongodb_data` volume was preserved.
- Backend and Mongo run as nonroot users with read-only roots and no Linux capabilities. All five containers have read-only roots and resource limits. Published service ports remain loopback-only.
- Kept the existing origin gate, TLS, real-IP configuration and proxy addresses. Public API returns HTTP 200; direct-origin forged-header requests to apex/www/admin/api return HTTP 403 from this host.
- Rotated MFA encryption independently of JWT signing without changing the authenticator enrollment. Existing sessions require a new sign-in.
- Installed root-owned local health and verified encrypted-backup timers. No raw application logs are exported.
- Plutus, Brew Co and Portainer remain stopped.

## Finding disposition

| Finding | Status | Result / limit |
|---|---|---|
| R01 | Deployed | Docker socket removed; nonroot/read-only backend; host-owned aggregate monitoring. |
| R02/R03 | Preserved and verified | Purpose-separated tokens, MFA on alternate sign-in paths, fixed-origin single-use password recovery retained. |
| R04 | Deployed | Bundle membership, exact quantities, authoritative prices and aggregate stock checked. |
| R05 | Deployed; acceptance pending | Database-backed sessions, atomic refresh consumption, password/logout/reset revocation and current-role checks. Existing sockets revalidate on incoming packets and every 15 seconds. |
| R06 | Deployed and verified | MongoDB auth and private network; original volume retained. App readWrite only, backup read only; anonymous/admin access denied as intended. |
| R07 | Deployed | Patched application dependencies and parser controls; runtime package managers removed. |
| R08 | Deployed | Durable verified webhook summaries, retry responses, replay-safe refunds and monotonic payment handling. New orders record the verified succeeded payment even if its webhook arrived first. |
| R09 | Deployed | Atomic order-state claims, replay-safe product restock markers, refund idempotency, controlled retry route and paid-order retention. |
| R10 | Partially complete | Owner-only files, fresh restore-tested backup, authenticated encryption and daily encrypted local backups. Off-host destination and separate key recovery location still needed. |
| R11 | Deployed | Root-only canonical environment outside checkout; separate MFA key. One enrollment re-encrypted with compare-and-set; follow-up dry-run found none requiring migration; previous key removed from runtime. |
| R12 | Deployed and verified | Pinned proxy addresses; original bridge preserved as external. Live image → customer proxy → API forged-IP test denied. Panels cannot connect directly to private Mongo TCP. |
| R13 | Deployed | Credential fields hidden/stripped, coupon identity/history fields removed from customer responses, public review order IDs removed. |
| R14 | Deployed | Current super-admin role required for role changes; generic super-admin demotion prohibited. |
| R15 | Deployed and verified | Bounded raster decode/reencode uploads; active document extensions denied; media served with nosniff and sandbox policy. |
| R16 | Partially complete | HTML/static headers and restrictive frame/object/base protections deployed. Full CSP remains report-only pending provider/browser compatibility and violation review. |
| R17 | Deployed | Pre-parser IP budgets, persistent Mongo rate counters, bounded cart/pagination/telemetry and 90-day expiry for new analytics. Existing analytics were not retroactively deleted. |
| R18 | Deployed | Authenticated owner/cart/currency-bound intents; durable checkout claim; ownership before returning existing order identifiers. |
| R19 | Deployed | Immutable owner ID required; ownerless/email-fallback access denied. |
| R20 | Deployed; scan scope limited | Supported pinned builds; pruned runtime; read-only roots/resource budgets; backend/Mongo nonroot with all capabilities dropped. Current four application/static images have zero HIGH/CRITICAL scanner findings; Mongo/host OS are outside that scan claim. |
| R21 | Mitigated; not a clean Git baseline | Protected canonical manifests, frozen image IDs and source hashes, rollback artifacts and source archive. Changes remain uncommitted; no push performed. |
| R22 | Deployed | Raw log exports retired; root-owned local health checks send no raw logs or external messages. |

## Validation

- **84 backend regressions passed** in the final image with no network, writable root or capabilities. This includes token-purpose isolation, MFA/recovery, session revocation, refresh/cancel concurrency, bundle substitution, image spoofing, payment ownership and webhook-before-order handling.
- **6 frontend tests passed**, production builds passed and admin TypeScript checks passed during release preparation.
- Headless browser recovery and fragment-reset smoke passed against production-served assets with zero uncaught errors. API and provider requests were mocked. Staged admin MFA browser smoke also passed; actual account/provider acceptance remains with the owner.
- Anonymous Mongo metadata access is denied. Application admin access is denied; exact app/backup roles were verified. Both panels are blocked from direct private-database TCP access.
- Live lateral forged-IP forwarding was denied; raster serving, media headers and active-extension denial passed.
- Final backend source files (**124 files**) match deployed bytes. Frozen image IDs, original DB volume, loopback ports and protected host configuration hashes match.
- Fresh backup was restored in isolation before rollout. A daily backup using the read-only DB account completed, authenticated encryption verified the content, and the run’s temporary plaintext was removed. Both timers are active and their services returned success.
- Trivy 0.76.1 scans on 2026-10-26 show **zero HIGH/CRITICAL findings** in the final backend, customer, admin and image-service images. A newly published curl/libcurl advisory found after yesterday’s staging was patched to `8.23.0-r0`. This claim excludes lower severities, MongoDB’s unchanged image and host packages.
- No real payment, refund, order update, reset email or customer password change was performed as a test. DB security identities and MFA ciphertext migration were intentional remediation changes.

## Deployment issues and recovery

Compose initially tried to replace the existing bridge, and the proposed two-CPU limit exceeded the host’s single CPU. The backend was briefly unavailable during recovery. The production overlay now explicitly preserves the existing external bridge and limits the backend to one CPU. Health checks passed after recovery and throughout final verification.

A payment-ordering edge case found during release review was corrected and regression-tested: order creation now persists the verified `succeeded` payment state when the success webhook arrived before the order existed.

## Deployed artifacts

| Service | Image ID | Started UTC |
|---|---|---|
| backend | `085cfa2bf250402e3f8d685df33d52753a48127ca24cc07f54192163f7e36391` | 2026-10-26T09:38:22.268724084Z |
| mongodb | `e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3` | 2026-10-26T09:41:58.609363732Z |
| customer-panel | `46843c7adf4b1b4d82916b4a72b3beae61d6d2f7f444c90f5c4baf88bca3f90e` | 2026-10-26T10:31:56.320974607Z |
| admin-panel | `b7ac2bebb2fc43724081fb83e553ef3988d71fd0108fd43b5fc65a6ddbc907f7` | 2026-10-26T09:52:02.531707039Z |
| image-fallback | `39a9d0cfa5e8e99964917786f6fec2fc106fb26ee6291abbc27b297ad3303b44` | 2026-10-26T09:52:03.241683753Z |

Full deployment evidence: [deployment JSON](docs/security-artifacts/deployment-20261026.json). Source/manifest and recovery records are root-only under `/root/roma-security-release-20261025/`.

## Operations and recovery

Use the canonical protected production configuration:

```bash
sudo /usr/local/sbin/roma-compose ps
sudo systemctl start roma-backup.service
sudo systemctl status roma-health.timer roma-backup.timer
```

The production environment and frozen compose/image manifests live under `/etc/project-roma` (root-only). The checkout’s `.env.local` links to that protected environment; its former contents were moved into protected recovery storage. Future production changes must use the wrapper so auth, private networking, mount restrictions and image selection remain consistent.

- Health service: root-owned `/usr/local/libexec/roma-security/health-check.py`, every minute.
- Encrypted local backups: `/var/backups/project-roma`, daily at 03:20 UTC. Existing encrypted backups are retained; no automatic off-host upload or old-backup pruning has been enabled. A 1 GiB free-space guard fails safely without deleting earlier backups.
- Encryption key: `/etc/project-roma/backup-encryption.key`, root-only. It has not yet been stored in a separate recovery location.
- Resume-day prechange backup/restore evidence: `/root/roma-security-release-20261025/resume-20261026/`.
- MFA-compatible emergency application rollback image and image mappings are saved under the protected release directory. They preserve cipher compatibility; older application images can reintroduce fixed application flaws. Prefer a forward fix and preserve current DB auth/network/volume and socket-free configuration.
- Do not use historical pre-F4 or earlier mount configurations as a blanket rollback. A complete production rollback has not been exercised.

## Still required

1. Owner confirmation of real storefront/admin sign-in and MFA, plus provider/checkout acceptance without using real transactions as a security test.
2. Owner-selected off-host encrypted backup destination and separately protected recovery-key location; upload and restore/recovery exercise remain unperformed.
3. Full CSP compatibility/violation review and staged enforcement.
4. Independent external IPv4/IPv6 origin/port acceptance and applicable Cloudflare dashboard review. The host-based direct-origin check does not replace an independent external test. Zone-specific AOP was not deployed.
5. Review and commit a clean security baseline while preserving prior workspace changes; complete the final closure review against the deployed hashes. Host/Mongo image assessment and host package maintenance remain outside the application scan claim.

Historical pause snapshot: [2026-10-25 report](SECURITY_REMEDIATION_2026-10-25.md). Original evidence and severity definitions: [security audit](SECURITY_FINAL_AUDIT_2026-10-24.md).


## Frontend render follow-up

The post-release `React is not defined` homepage regression was fixed by enabling the automatic JSX runtime consistently for `.jsx` files. The customer-panel Docker image was rebuilt from source and deployed alone at 2026-10-26T10:31:56.758907+00:00. Desktop/mobile loading and catalog navigation passed with real API responses and zero uncaught JavaScript errors. Backend, MongoDB, MFA, production secrets and Nginx/CSP policies were unchanged. See [the incident and deployment record](docs/FRONTEND_WHITE_SCREEN_2026-10-26.md). Automated public-hostname checks remain subject to Cloudflare challenge; on-server production-asset browser verification passed.
