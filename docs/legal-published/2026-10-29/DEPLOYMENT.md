# Publication record — October 29, 2026

User explicitly requested publication of all four drafts. Public copies were prepared without internal notes/placeholders, with the existing store contact details and verified site behavior. No legal entity, fixed retention schedule, return fee, live-payment approval or conformance certification was invented.

Published pages, each verified HTTP 200 over public HTTPS:

- https://balportliquors.com/privacy-policy
- https://balportliquors.com/terms-and-conditions
- https://balportliquors.com/accessibility
- https://balportliquors.com/delivery-and-refund-policy

Footer and checkout include the delivery/refund/cancellation policy. Shared policy manifests now contain hashes for all four public sources. New checkouts require current Terms, Privacy and delivery policy versions; the order schema preserves the expanded version evidence. Existing paid checkout recovery continues using its original immutable snapshot.

Validation: 176 backend tests, 46 storefront tests, isolated Mongo checkout integration, shared-config verification, Docker builds and synthetic browser checks passed. Browser checks cover all four dated public pages without editorial placeholders, mobile overflow, footer links, legal access before age confirmation, consent suppression/withdrawal and GPC. The public HTML references the exact tested candidate bundle. Checkout readiness remains HTTP 200 in test mode with matching hashes. Both deployed services run with zero restart counts at verification.

Images:

- Backend `project-roma-backend:policies-20261029`: `sha256:19bacbabc50022295d782aee74e1874f573761a574962350ad506d9c051a6a7b`.
- Storefront `project-roma-customer-panel:policies-20261029`: `sha256:79e806a05ffb53bd2cfaab1cfe908f82f595134bad812bd727a4cbc9e56d6191`.

Production uses the protected Compose wrapper and hardening overlays. The prior manifest is retained at `/etc/project-roma/images.yml.rollback-policies-20261029`. Admin, database and image-fallback containers were not recreated for this publication. No live purchases, refunds, messages, data deletion or provider delivery calls were performed.

The publication does not resolve the separately documented business/licensing/vendor/retention questions or establish legal/accessibility compliance. Original drafts remain in `docs/legal-drafts`; previous public source and version hashes are archived in `docs/legal-archive/2026-10-29-before-publication`.
