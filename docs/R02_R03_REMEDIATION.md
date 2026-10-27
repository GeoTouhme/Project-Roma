# R02/R03 authentication remediation

Status: **deployed on 2026-10-24 at 14:42 UTC**. See [deployment results](R02_R03_DEPLOYMENT_2026-10-24.md). Only customer and backend containers were replaced. Existing host configuration, data volumes, F1/F2/F4/F6 controls, and other projects were preserved.

## Changes

- API middleware, Socket.IO, and limiter role detection accept only access tokens. Access, MFA, verification, and reset tokens have separate purposes, audiences, and HMAC-derived signing keys, with fixed issuer, HS256, expiry, and claim checks. Keys derive from the existing JWT_SECRET; no new environment credentials or MFA encryption-key change is required.
- Password login, Google login, OTP verification, and email-link verification must complete local TOTP when MFA is enabled. The token-pair issuer rejects incomplete authentication. Google MFA now has a customer-facing code prompt; admin password/TOTP flow retains its current API contract.
- Reset destinations come exclusively from validated server FRONTEND_URL (HTTPS in production), never body origin, Host, or forwarded Host. New reset links use `/auth/reset-password#token=…`; fragments do not reach HTTP access paths or Referer headers. Recovery routes skip page-view tracking and recovery errors avoid logging request objects.
- Password resets expire in 15 minutes and store only a SHA-256 token hash. A new request replaces the preceding hash. A conditional atomic update consumes it exactly once, including concurrent submissions. Password types/lengths are validated and successful resets invalidate the stored refresh credential and clear browser cookies.
- Added recovery pages, including a working `/forgot-password` route. Recovery routes are reachable even when local browser UI state says signed in. A successful reset clears local authenticated state and redirects to login.
- Added hidden user fields `passwordResetTokenHash`, `passwordResetTokenExpiresAt`, and `refreshTokenVersion`. These are additive schema fields, without a TTL index on the user collection. No manual production migration has been run.

## Compatibility and scope

All pre-patch access, MFA, verification, and reset JWTs will be rejected. Pre-patch refresh sessions have no accepted version marker and cannot silently mint newly typed access tokens. Existing users must sign in again; pending verification/reset links must be resent. Communicate this before rollout.

This addresses R02/R03; it does not close every R05 issue. General logout/refresh-family revocation, atomic refresh rotation, current-role checks for sockets, and immediate revocation of already-issued access tokens remain separate work. Reset revokes refresh state; a copied new-format access token issued before that reset can remain valid until its 15-minute expiry. No key rotation or MFA reenrollment is needed for this patch.

## Validation

Pre-deployment implementation validation: **66 backend tests and 4 focused customer UI tests passed**. The customer production build compiled successfully in `/tmp` with dummy public keys. Backend syntax and Git whitespace checks passed (respecting existing CRLF files). Build emitted the existing stale Browserslist-data warning. Production image IDs and container start times remained unchanged during implementation; the subsequent authorized cutover is recorded separately.

Backend: `cd backend && npm test` (synthetic records, dummy keys, mocked persistence/email/Google). Covers the existing 51 F2/F6 cases plus token-type confusion, issuer/audience/algorithm/expiry/claim rejection, API/socket/limiter parity, trusted reset destination, fragment link, stored hash, single-use/concurrent/replaced/expired reset, password validation, alternate MFA flows, correct TOTP, and legacy refresh cutover.

Customer UI: `cd customer-panel && CI=true npm test -- --watch=false --runInBand --runTestsByPath src/pages/auth/PasswordRecovery.test.jsx src/components/google-signin/GoogleSignInButton.test.jsx`. Four focused tests verify email-only recovery requests, fragment consumption, missing-link handling, and Google MFA completion before local sign-in. Google/mail/database calls are mocked. A customer production build is also checked in a temporary directory using dummy public build values, without copying production env files.

Production smoke tests requiring authenticated users and real mail/Google configuration still require operator confirmation. Server-side postdeployment negative checks are recorded in the deployment results. No reset email was sent and no real password changed during implementation or deployment checks.

## Rollout and acceptance checklist

1. Review/commit only the intended authentication changes, retaining existing uncommitted infrastructure fixes. Preserve the production source/image/config baseline and verify backup/recovery access. Confirm FRONTEND_URL is the intended HTTPS storefront origin.
2. Build immutable customer and backend candidate images without moving production tags or altering live containers. Verify required new helper/model files are included; run the suites above against the candidate artifacts. No dependency upgrades are part of this patch.
3. Deploy the customer panel first. Its Google MFA and recovery UI remain compatible with ordinary existing login responses. New recovery email requests require the backend patch to become usable; deploy the backend promptly in the same maintenance window.
4. Deploy the backend with current Compose mappings/networks/volumes untouched. Expect forced reauthentication for pre-patch sessions. Do not change JWT_SECRET/MFA_SECRET_KEY, firewall, origin gate, or MongoDB data/users as part of this deployment.
5. Confirm normal password login, MFA password login, Google MFA login, email-change verification, fresh reset mail destination, single-use reset, forced re-login, and refreshed typed sessions using authorized test accounts. Confirm access cookies remain Secure/HttpOnly/SameSite and challenge/reset tokens produce 401 on APIs and socket authentication. Check rates/false 429s and preserve F1/F2/F4/F6 health checks. Use synthetic data/staging for adversarial resets/concurrency, not customer accounts.

The additive fields do not require dropping collections or volumes. Rollback of customer UI alone is possible, but old UI does not support Google MFA challenges. Reverting the backend to the previous image reopens the security defects; prefer a reviewed forward fix. New reset links and typed JWTs are not compatible with that old backend. Do not promise session continuity across rollback or restore a database merely to roll back code.
