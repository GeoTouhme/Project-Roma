# P0/P1/P2 safe production release — October 29, 2026

The user explicitly authorized deploying safe changes. The backend and both panels were rebuilt and deployed using the protected production Compose wrapper, with its existing environment and hardening overlays. Mongo, the image-fallback service, payment credentials and public legal text were not changed by this deployment.

## Release images

| Service | Tag | Image ID |
|---|---|---|
| Backend | `project-roma-backend:p1-p2-20261029` | `sha256:e13bbe7b079cec9080db54a9b5cd8db48841664fdfdf87ad7383c144608eabb1` |
| Customer | `project-roma-customer-panel:p1-p2-20261029` | `sha256:0620dc49b78bdf3326d9d46e32da224f9467cc4e71e83c4ded737e5182ec631e` |
| Admin | `project-roma-admin-panel:p1-p2-20261029` | `sha256:d5af6a5fa9cd7f8a86a0f99cb02bb3433e67a2c0f9b8708b1d43faae6bcf81be` |

## Verified after deployment

- Backend `/` responds HTTP 200.
- `/api/checkout-policy` responds HTTP 200, reports `mode: test`, reports tobacco unavailable and includes current policy hashes.
- Live checkout approval remains false. No live payment credentials were enabled.
- Unauthenticated `/api/privacy/export`, `/api/privacy/requests`, `/api/admin/privacy/requests` and `/api/admin/orders/review-queue` respond HTTP 401.
- Customer nginx serves the application HTML. Admin nginx retains its authentication requirement and responds HTTP 401 to an unauthenticated request.
- Both panel nginx configuration checks pass. A direct loopback TLS request could not validate the origin certificate against the local public trust store; the separate normal public HTTPS request validated successfully and returned HTTP 200.
- All three release containers are running with zero restart counts at verification.
- Both policy/store identity manifests match the source of the currently published Terms and Privacy pages.
- The final built customer files passed synthetic browser checks with all API/external requests intercepted. This is separate from a real signed-in production checkout; no production purchase, refund, customer message, deletion or vendor delivery request was performed.

The release does not enable automatic courier callbacks, destructive retention cleanup, completed account erasure, or unapproved delivery-exception/partial-fee remedies. Existing application TTL behavior remains as documented. Full live-payment, legal and accessibility compliance is not claimed.

## Rollback references

- Production image manifest: `/etc/project-roma/images.yml`.
- Previous manifest copy: `/etc/project-roma/images.yml.before-p1-p2-20261029`.
- Usable coordinated rollback manifest: `/etc/project-roma/images.yml.rollback-p1-p2-20261029`.
- Preserved backend/admin rollback tags: `project-roma-backend:pre-p1-p2-20261029` and `project-roma-admin-panel:pre-p1-p2-20261029`.
- Previous customer tag: `project-roma-customer-panel:accessibility-contact-20261029`.

The previous manifest's backend/admin tags differed from the running container contents. The rollback images preserve the running backend source and admin static files on matching existing release bases, without copying runtime environment secrets. Backend dependencies were retained from the previously verified base. Do not blindly downgrade a backend while version-2 paid checkouts need reconciliation.

## Policy drafts

Four internal drafts and a publication/readiness guide are saved in `docs/legal-drafts/`. They total approximately 3,900 words including editorial notes and references. They are not public policy replacements. Entity, licensing/handoff, vendors/data sharing, retention, remedies/fees and accommodation procedures still need confirmation; counsel should review the completed documents before publication. See `README.md` in that directory for the exact remaining decisions and coordinated version-update process.

Implementation/test details are in `docs/P1_P2_REMEDIATION_2026-10-29.md`; the earlier P0 implementation is described in `docs/P0_CHECKOUT_REMEDIATION_2026-10-29.md`.
