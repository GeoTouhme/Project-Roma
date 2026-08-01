# Plan: Don't Issue Auth Cookie Until Email Is Verified

## Problem

`backend/src/controllers/auth.js::registerUser` currently:
1. Creates the user with `isVerified: false`.
2. Generates a 47-day JWT.
3. Sets it as an HttpOnly `token` cookie on the response.
4. Returns `success` with the user object.

Because the cookie is set, the browser is logged in immediately even though `isVerified === false`. An unverified user can browse, add to cart, and reach checkout before clicking the verification email.

## Goal

Registration should create the user and send the verification email, but **not issue a session cookie**. The user must verify their email (via `verifyOtp`) before they can authenticate. After verification, they log in normally.

## Scope

This plan covers only the first critical finding from the sign-up audit:
> "Account is created and logged in before the email is verified."

Other findings (OTP expiry, super-admin squatting, resend cooldown, email failure feedback) are out of scope for this task.

## Proposed Changes

### 1. Backend — `backend/src/controllers/auth.js::registerUser`

**Remove** the JWT generation and `setAuthCookie` call from the registration flow.

**Keep**:
- User creation
- OTP generation
- Email template + verification link
- `sendEmail()` call (still silent fail for now; out of scope)

**Change response** to indicate the user is not yet authenticated:
- Remove `token` if it was being returned.
- Return `isVerified: false`.
- Keep the same success message: "Created User Successfully. Please check your email..."

**Edge case — already verified users**:
There is currently no path where `isVerified: true` on creation. If that changes later, we can add a conditional cookie there. For now, simply remove the unconditional cookie.

### 2. Backend — `backend/src/controllers/auth.js::verifyOtp`

**Add** optional auto-login after successful verification.

When `otp` matches and `isVerified` is set to `true`:
- Generate a normal 7-day JWT.
- Call `setAuthCookie(res, token, 7 * 24 * 60 * 60 * 1000)`.
- Return the same `success: true` response, optionally including the user object (without sensitive fields).

This preserves the current frontend behavior where `VerifyEmail.jsx` redirects to `/login` — but also allows us later to change it to redirect to `/` if we want auto-login.

**Backward compatibility**: existing `verifyOtp` callers that don’t expect a cookie will still work; the cookie is just an extra header.

### 3. Frontend — `customer-panel/src/pages/auth/Register.jsx`

Currently the component already correctly handles unverified registration by redirecting to `/login` when `response.user.isVerified === false`.

No change needed here.

However, we should remove the dead branch that calls `dispatch(login(response.token))` and stores the user in `localStorage`, because the backend will no longer return a token. We can simplify to always navigate to `/login`.

### 4. Frontend — `customer-panel/src/pages/auth/VerifyEmail.jsx`

Read the current file to confirm behavior.

Expected change:
- After successful verification, show a toast and redirect to `/login` (current behavior is already this).
- Optionally, if we want auto-login after verification, we can store the user and dispatch login, then redirect to `/`. But since the backend cookie is HttpOnly and not readable from JS, we can rely on the cookie being set and the next API call being authenticated.

**Decision**: keep redirecting to `/login` for now to match existing UX. The user can log in with the verified email/password.

### 5. Backend — `backend/src/controllers/auth.js::loginUser`

Ensure login still rejects unverified users if the cookie was somehow missing or if they try to log in before verifying.

Currently `loginUser` does **not** check `isVerified`. After this change, a user could still type their email/password and log in without verifying, because the login endpoint only checks password match.

**Decision**: add an `isVerified` check in `loginUser`. If `!user.isVerified`, return:

```json
{ success: false, message: 'Please verify your email before logging in. Check your inbox for the verification code.' }
```

This closes the gap where a user manually logs in before verification.

## Files to Edit

- `backend/src/controllers/auth.js`
  - `registerUser` — remove JWT/cookie.
  - `verifyOtp` — add optional cookie on success.
  - `loginUser` — reject unverified users.
- `customer-panel/src/pages/auth/Register.jsx` — simplify success handler.

## Acceptance Criteria

- [ ] After registration, no `token` cookie is set in the browser.
- [ ] Registration response still returns `success: true` and user object with `isVerified: false`.
- [ ] A newly registered user cannot access `/account` or `/cart` (already protected by `isAuthenticated` Redux state, which is not set on registration).
- [ ] `verifyOtp` still verifies the user and sets `isVerified: true`.
- [ ] After successful verification, a `token` cookie is set and the user can log in.
- [ ] `loginUser` rejects unverified users with a clear message.

## Test Plan

1. Register a new test account.
2. Inspect browser cookies / network response — confirm no `token` cookie.
3. Try to visit `/account` — should redirect to `/login` because Redux auth state was not set.
4. Click the verification link/email → verify.
5. Log in with the verified account → should succeed and set cookie.
6. Try logging in with an unverified account (if possible) → should be rejected.
