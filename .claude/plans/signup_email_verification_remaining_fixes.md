# Plan: Remaining Sign-Up / Email Verification Hardening

## Goal
Close the remaining audit gaps from `signup_email_verification_audit_2026-07-31.md` that are not yet fixed in production:

1. Surface email delivery failures to the user.
2. Replace the raw OTP in the verification URL with a short-lived signed token.
3. Alert admins when a verification / password-reset email fails to send.
4. Document DNS/email-domain reality (sending from `@gmail.com`, so SPF/DKIM/DMARC records are Google's responsibility unless a custom domain is configured).

---

## Current State

- `registerUser` creates the user but swallows email errors.
- The verification email link exposes the raw 6-digit OTP in the URL query string (`/verify-otp?email=...&otp=...`).
- `mailer.js` returns `null` on failure and only logs to `console.error`.
- `VerifyEmail.jsx` only understands `?email=&otp=`.
- `Register.jsx` assumes the email always succeeds and redirects to `/login`.

---

## Proposed Changes

### 1. Signed email-verification token (backend)

Add a small helper in `backend/src/controllers/auth.js`:

```js
const EMAIL_VERIFY_PURPOSE = 'email-verify';

function signEmailVerificationToken(email) {
  return jwt.sign(
    { email, purpose: EMAIL_VERIFY_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function verifyEmailVerificationToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.purpose !== EMAIL_VERIFY_PURPOSE) return null;
    return decoded;
  } catch {
    return null;
  }
}
```

- On **register** and **resend**, generate this token alongside the OTP.
- Email template gets two verification paths:
  - One-click link: `{{FRONTEND_URL}}/verify-email?token={{verificationToken}}`
  - Manual OTP fallback is still shown in the email body.
- Add a new endpoint `POST /api/auth/verify-email-token`:
  - Accepts `{ token }`.
  - Verifies and decodes the signed token.
  - Looks up the user by the email in the token.
  - If the user is already verified, returns `400`.
  - Marks verified, resets `otpAttempts`, applies the `INITIAL_ADMIN_EMAIL` bootstrap, and issues the auth cookie.
  - Returns `{ success: true, user: {...} }`.

Keep the existing `POST /api/auth/verify-otp` endpoint for users who prefer to type the code manually.

### 2. Signed email-verification token (frontend)

- Add `AuthService.verifyEmailToken(data)` in `customer-panel/src/services/authServices.js`.
- Add `AuthService.resendOtp(data)` in `customer-panel/src/services/authServices.js`.
- Update `customer-panel/src/pages/auth/VerifyEmail.jsx`:
  - Read `?token=` from the URL.
  - If a token is present, call `/auth/verify-email-token`.
  - Else fall back to the existing `?email=&otp=` flow.
  - Keep the same UI states (`verifying`, `success`, `error`, `invalid`).

### 3. Surface email delivery failures

- `sendEmail()` already returns the nodemailer result on success and `null` on failure.
- In `registerUser`:
  - If `sendEmail()` returns `null`, return:
    ```json
    {
      "success": true,
      "emailSent": false,
      "message": "Account created, but we couldn't send the verification email. Please use 'Resend' below or contact support."
    }
    ```
- In `resendOtp`:
  - If `sendEmail()` returns `null`, return:
    ```json
    {
      "success": false,
      "emailSent": false,
      "message": "We couldn't resend the verification email right now. Please try again shortly."
    }
    ```
- Update `Register.jsx`:
  - On successful registration, store the submitted email in component state.
  - If `response.emailSent === false`, show an inline warning card with a **Resend verification email** button.
  - The resend button calls `AuthService.resendOtp({ email })` and shows a toast with the result.
  - If email succeeds, still redirect to `/login` as today.

### 4. Admin alert on email failures

- Import `emitToAdmins` from `../utils/socketManager` in `backend/src/controllers/auth.js`.
- When `sendEmail()` fails during registration or resend, before returning the failure response:
  - `console.error` a structured message including the error, recipient, and flow.
  - `emitToAdmins('system:email_failed', { email, flow: 'register|resend', error: error.message, time: new Date().toISOString() })`.
  - This causes the admin notification bell to light up in real time so staff know verification emails are failing without needing to check logs.
- If the Socket.IO instance is not available (e.g., during a script or rare race), the emit fails silently and the structured log remains.

### 5. DNS / deliverability note

Because the app sends mail **from `balportliquorstore@gmail.com` via Gmail's OAuth2 SMTP servers**, SPF, DKIM, and DMARC for that envelope sender are handled by Google. The store does **not** need to publish `_spf.google.com` or a DKIM record for `balportliquors.com` unless it later switches to a custom domain like `noreply@balportliquors.com`.

Recommended actions:
- Keep the Gmail OAuth2 refresh token under active monitoring.
- If/when the business wants branded `noreply@balportliquors.com` sending, set up Google Workspace / a custom SMTP provider and add:
  - SPF TXT record on `balportliquors.com`
  - DKIM TXT record provided by the mail provider
  - DMARC TXT record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@balportliquors.com`

---

## Files to Edit

| File | Change |
|------|--------|
| `backend/src/controllers/auth.js` | Add token helpers; new `verifyEmailToken` controller; update `registerUser` and `resendOtp` to generate token, handle send failures, emit admin alert |
| `backend/src/routes/auth.js` | Add `POST /api/auth/verify-email-token` |
| `backend/src/email-templates/otp.html` | Use signed token in verification link; keep OTP visible for manual entry |
| `backend/src/utils/mailer.js` | Return the actual error object to callers so the controller can log/emit the real message |
| `customer-panel/src/services/authServices.js` | Add `verifyEmailToken` and `resendOtp` |
| `customer-panel/src/pages/auth/VerifyEmail.jsx` | Support `?token=`; fall back to `?email=&otp=` |
| `customer-panel/src/pages/auth/Register.jsx` | Show warning and resend UI when `emailSent === false` |

---

## Testing Plan

1. Register a test user on the live customer panel.
2. Inspect the received email: verify the link is `/verify-email?token=...` and the manual OTP is still shown.
3. Click the link — account should verify and redirect to `/login`.
4. Register another user, then intentionally trigger an email failure (e.g., temporarily set `GOOGLE_REFRESH_TOKEN` to an invalid value, rebuild, register, then restore). Verify:
   - Frontend shows the "email not sent" warning with a resend button.
   - Admin panel receives a real-time `system:email_failed` alert.
5. Resend via the frontend UI and confirm success path works after restoring the token.
6. Test manual OTP verification still works from the old `/verify-otp?email=...&otp=...` path as a fallback.
7. Clean up all test users so only the two super admins remain.

---

## Rollback / Risks

- The old `?email=&otp=` link is preserved as a fallback, so any emails already in user inboxes will still work.
- Adding `emitToAdmins` is safe: if `io` is not initialized, the helper already guards against that.
- The only external dependency is the Gmail refresh token remaining valid; the plan does not change that, it only adds monitoring.
