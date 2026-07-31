# Sign-Up Flow & Email Verification Audit — Project Roma

**Date:** 2026-07-31
**Scope:** Customer registration (`/api/auth/register`), email verification (`/api/auth/verify-otp`), Google/Gmail delivery for verification emails, and the customer-panel UI flow.
**Auditor:** Hermes Agent (read-only)

---

## 1. Executive Summary

The customer sign-up flow is functional but has several security, reliability, and UX gaps. The most critical issues are:

1. **Account is created and logged in before the email is verified.** `registerUser` issues a 47-day JWT cookie immediately, even though `isVerified` is `false`.
2. **No verification gate on protected routes.** Because the cookie is already set, an unverified user can browse, add to cart, and potentially checkout without ever clicking the verification email.
3. **OTP has no expiration, no per-attempt lockout, and can be reused indefinitely.**
4. **Email delivery is best-effort / silent fail.** If Gmail OAuth2 fails, registration still succeeds and the user is never told email delivery failed.
5. **Admin registration collision risk.** The first registered account becomes `super admin`; the second becomes `user`. On a public internet app this could allow an attacker to claim the super-admin role if the real owner hasn't registered yet.

---

## 2. Files Audited

| File | Role |
|------|------|
| `backend/src/controllers/auth.js` | Registration, OTP generation/verify/resend, cookies, MFA |
| `backend/src/utils/mailer.js` | Nodemailer + Gmail OAuth2 wrapper |
| `backend/src/routes/auth.js` | Rate-limiting and route mounting |
| `backend/src/models/User.js` | User schema (`otp`, `isVerified`, `role`, `password`, `mfa*`) |
| `customer-panel/src/pages/auth/Register.jsx` | Customer registration form |
| `customer-panel/src/pages/auth/VerifyEmail.jsx` | Auto-verify from email link |
| `customer-panel/src/services/authServices.js` | API client for auth endpoints |
| `docker-compose.yml` | Env var wiring for email/OAuth2 |
| `backend/src/index.js` | CORS, trust proxy, security headers |

---

## 3. Detailed Flow Analysis

### 3.1 Customer Registration Flow

**Frontend — `Register.jsx`**
- Collects: firstName, lastName, email, password, confirmPassword, phone.
- Client-side validation: email regex, password >= 8 chars with upper/lower/digit, phone 7-15 chars.
- Submits `{firstName, lastName, email, password, phone}` to `POST /api/auth/register` via `AuthService.register()`.
- On success:
  - If `response.user.isVerified === true` it stores user in `localStorage` and logs them into Redux.
  - Otherwise it navigates to `/login`.
- Because the backend currently always returns `isVerified: false` for new users, the realistic path is `/login`.

**Backend — `auth.js::registerUser`**
1. Validates `email` is a non-empty string and lowercases/trims it.
2. Checks for existing user by email.
3. Generates a 6-digit numeric OTP with `otp-generator`.
4. Creates user with:
   - `role: UserCount > 0 ? 'user' : 'super admin'`
   - `isVerified: false`
   - `otp` stored as plaintext string in the document
5. Signs a JWT with 47-day expiry and sets it as an HttpOnly, Secure (in prod), SameSite=Strict cookie named `token`.
6. Reads `src/email-templates/otp.html`, replaces placeholder `<h1>` with OTP, replaces email placeholder, injects a verification link:  
   `{{FRONTEND_URL}}/verify-otp?email={{email}}&otp={{otp}}`
7. Calls `sendEmail()` (wrapped in try/catch; failures are logged but not returned to the client).
8. Returns 201 with user object.

**Observations**
- ✅ Email normalization defends against case-typosquatting.
- ✅ Password is hashed via `bcrypt` pre-save hook in `User.js`.
- ✅ No `role` injection from client.
- ⚠️ **Critical:** `setAuthCookie` is called before email verification. The user receives a session even if `isVerified` is false.
- ⚠️ **Critical:** First user becomes `super admin`. If the platform is publicly reachable before the real owner signs up, an attacker can squat the super-admin role.
- ⚠️ Email send failure is swallowed. The user may wait for an email that never arrives and has no UI feedback.

### 3.2 Email Verification Flow

**Frontend — `VerifyEmail.jsx`**
- Reads `?email=` and `?otp=` from the URL query string on mount.
- If either is missing, shows "Invalid Link".
- Calls `AuthService.verifyOtp({email, otp})` on component mount.
- On success: toast + redirect to `/login` after 3 seconds.
- On error: toast + "Register Again" link.

**Backend — `auth.js::verifyOtp`**
1. Validates email string, lowercases/trims.
2. Finds user. If missing → 404.
3. If `user.isVerified === true` → 400 "OTP Has Already Been Verified".
4. Compares `otp === user.otp` (plaintext).
5. If match → sets `isVerified = true`, saves, returns 201 success.
6. If mismatch → returns 404 "Invalid OTP".

**Observations**
- ✅ Verification link contains both email and OTP.
- ✅ Prevents re-verification of already-verified accounts.
- ⚠️ **OTP has no expiry.** A verification link from months ago still works as long as the user wasn't verified.
- ⚠️ **No OTP attempt lockout.** An attacker with the email can brute-force the 6-digit OTP (1M combinations). `express-rate-limit` is applied to the route but is global per IP/email (100 per 15 min), which makes online brute-force feasible.
- ⚠️ Status code for invalid OTP is `404`, which is semantically odd.
- ⚠️ After successful verification, the user is redirected to `/login` manually; no auto-login.

### 3.3 Resend OTP Flow

**Backend — `auth.js::resendOtp`**
- Requires email; finds user.
- If `isVerified === true` → 400.
- Generates new OTP, updates user, re-sends `otp.html` template.
- No `lastOtpSentAt` throttle (the field exists on `User` schema but is never set).

**Observations**
- ⚠️ No cooldown between resends. Abuse could exhaust Gmail sending quota or flag the account.
- ⚠️ Same silent-fail behavior as registration email.

### 3.4 Google/Gmail Email Delivery

**Backend — `utils/mailer.js`**
```javascript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});
```

- Uses Gmail OAuth2 (refresh token) to send mail from `process.env.EMAIL` with display name `Balport Liquors <...>`.
- Errors are caught and returned as `null`; the caller is never notified.

**Docker Compose env wiring**
```yaml
- EMAIL=${EMAIL}
- EMAIL_PASSWORD=${EMAIL_PASSWORD}
- GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
- GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
- GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH_TOKEN}
```

**Observations**
- ✅ OAuth2 is more secure than storing a plaintext Gmail app password.
- ⚠️ `EMAIL_PASSWORD` is passed to the container but `mailer.js` uses OAuth2 and does not reference it. This is dead config.
- ⚠️ If the refresh token expires or is revoked, all verification emails silently stop. No alerting or fallback.
- ⚠️ No DKIM/SPF/DMARC alignment is configured in code. Gmail will deliver, but SPF must include `_spf.google.com` for the sending domain.
- ⚠️ "From" display name is hardcoded to `Balport Liquors` — fine, but not configurable per environment.

---

## 4. Security Findings

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 1 | Unverified users receive a session cookie immediately | **Critical** | `auth.js:205` — `setAuthCookie(res, token, 47 * 24 * 60 * 60 * 1000)` before verification |
| 2 | First public registration becomes super admin | **Critical** | `auth.js:150` — `role: UserCount > 0 ? 'user' : 'super admin'` |
| 3 | OTP has no expiration and no max attempts | **High** | `User.js` has no `otpExpiresAt` field; `verifyOtp` only checks equality |
| 4 | Verification email failure is silent | **High** | `auth.js:201-203` catches email errors and only logs |
| 5 | No resend cooldown / rate-limit beyond global limiter | **Medium** | `resendOtp` updates OTP without throttling |
| 6 | Verification link OTP is single-use but eternal | **Medium** | `otp` is replaced on resend, but never expires |
| 7 | `404` returned for invalid OTP leaks less info but is semantically wrong | **Low** | `auth.js:494` |
| 8 | `EMAIL_PASSWORD` env var unused / dead config | **Low** | `mailer.js` uses OAuth2 only |
| 9 | `lastOtpSentAt` schema field unused | **Low** | `User.js:86-88` |
| 10 | Verification link passes OTP in URL query string (GET-like), but verification is POST | **Low** | URL may end up in server logs / browser history |
| 11 | Cookie domain can become `.balportliquors.com` and is shared across subdomains | **Info** | `auth.js:24-41` — intended for cross-subdomain SSO |

---

## 5. Compliance / Deliverability Notes

- **CAN-SPAM / legal:** Verification emails are transactional (user-initiated), so explicit opt-in is already captured. No unsubscribe link is required for purely transactional messages.
- **Gmail bulk sender requirements (Feb 2024):** For >5k messages/day to Gmail/Yahoo, SPF, DKIM, DMARC with alignment, and one-click unsubscribe are required. Transactional verification volume is likely below the threshold, but setting `spf`, `dkim`, and `dmarc` DNS records is still recommended.
- **Bounce handling:** Not implemented. Hard/soft bounces from Gmail are not tracked or surfaced.

---

## 6. Recommendations

1. **Do not issue a session cookie until after email verification.** Move `setAuthCookie` from `registerUser` to `verifyOtp` (or to login after verification). Until then return only a temporary/anonymous response.
2. **Add an admin seed/bootstrapping step.** The first account should be created via a controlled setup flow (e.g., env var `INITIAL_ADMIN_EMAIL` + a setup token), not the public register form.
3. **Add OTP expiry and attempt limits.** Add `otpExpiresAt` (e.g., 15 min) and `otpAttempts` with lockout after N failed tries.
4. **Surface email delivery failures to the user.** If `sendEmail` returns `null`, return `success: false` or at least a clear warning and offer resend.
5. **Implement resend throttling.** Use the existing `lastOtpSentAt` field; allow resend only every 60–120 seconds.
6. **Remove or use `EMAIL_PASSWORD`.** If OAuth2 is the canonical method, drop the env var from `docker-compose.yml` and docs.
7. **Consider a signed verification token instead of raw OTP in URL.** e.g. `/verify-email?token=signedJwt` so the OTP is never exposed in URL logs.
8. **Add DNS records for deliverability:** SPF include `_spf.google.com`, DKIM via Google Workspace / Gmail, DMARC `p=quarantine; rua=...`.
9. **Log and alert on email send failures.** A failing `sendEmail` should be visible in monitoring (Sentry, PagerDuty, or at least a periodic health check).
10. **Status-code nit:** return `401` or `400` for invalid OTP, not `404`.

---

## 7. Verification Commands Used

- `read_file` on controllers, utils, models, routes, customer-panel pages, docker-compose.
- `search_files` for register/verify/email/OAuth2 references.
- `terminal` to inspect running containers and env path (no edits).

---

## 8. Conclusion

The sign-up flow works for the happy path, but the combination of **immediate login before verification**, **eternal OTPs**, **silent email failures**, and **super-admin squatting risk** makes it unsuitable for production hardening. The recommended fixes above should be prioritized before the site sees significant public traffic.
