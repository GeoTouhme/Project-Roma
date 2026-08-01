# Plan: Google One-Click Sign-Up / Sign-In for Customer Panel

## Goal
Add a "Sign in with Google" button to the customer Login and Register pages so new and returning users can authenticate with one click. Google-authenticated users are created/verified immediately and issued the same HttpOnly JWT cookie as email/password users.

## Decisions made
1. **OAuth client:** Reuse the existing Gmail OAuth2 client ID (`GOOGLE_CLIENT_ID`) already in `/etc/project-roma/.env`.
2. **Phone number:** Make `phone` optional for Google-created users. Require a phone number on the account page or at checkout before an order can be placed.
3. **UX:** Add a Google button to both `/login` and `/register`. One Tap is **not** enabled in this phase to keep the change focused.

## High-level flow
1. Customer clicks "Sign in with Google" on `/login` or `/register`.
2. Frontend lazily loads the Google Identity Services (GIS) JS SDK (`accounts.google.com/gsi/client`) and renders the standard `google.accounts.id.renderButton`.
3. **ID-token flow** (implemented)
   - Google returns a signed JWT ID token directly to the frontend.
   - Frontend sends the ID token to `POST /api/auth/google`.
   - Backend verifies the token signature and claims with `google-auth-library` (`verifyIdToken`), then finds/creates the user.
   - The ID token cannot be used to call Google APIs; it only proves identity, and the client secret remains server-side for other Gmail/OAuth flows.
4. Backend finds or creates the user:
   - If email exists + `googleId` matches → sign in.
   - If email exists but no `googleId` → **optionally** link the account after verifying the user owns the email (Google already verified it), or reject to prevent account takeover. Decision: link automatically because Google verified the email.
   - If email does not exist → create a new user with `provider: 'google'`, `googleId`, `email`, `firstName`, `lastName`, `isVerified: true`, random placeholder password, `role: 'user'`, `phone: ''`.
5. Backend issues the standard `token` HttpOnly cookie and returns the user object.
6. Frontend stores user info in `localStorage`, dispatches `login()`, and redirects to `/`.
7. If the user is new and has no phone number, the account page and checkout show a prompt to add it. The order controller already enforces `user` details at checkout; we will add a guard for missing phone only when placing an order.

## Files to create
1. `backend/src/controllers/googleAuth.js` — verify ID token, fetch profile, find/create user, issue cookie.
2. `backend/src/routes/googleAuth.js` — mount `POST /api/auth/google`.
3. `customer-panel/src/components/google-signin/GoogleSignInButton.jsx` — reusable button component.
4. `customer-panel/src/services/authServices.js` — add `googleAuth({ idToken })` method.
5. (Optional) `customer-panel/src/pages/account/ProfileCompletion.jsx` — prompt for phone if missing.

## Files to modify
1. `backend/src/models/User.js`
   - Make `password` optional when `provider === 'google'` (or generate a long random password and allow missing/short values).
   - Make `phone` optional (remove `required`).
   - Make `otp` optional (remove `required`).
   - Add fields: `provider: { type: String, enum: ['local', 'google'], default: 'local' }`, `googleId: { type: String, sparse: true }`, `isVerified: true` for Google users.
   - Update pre-save password hook to skip bcrypt when password is absent or not modified.

2. `backend/src/controllers/auth.js`
   - Ensure the `setAuthCookie` / login response helpers can be reused. Extract a `finalizeAuthSession(res, user)` helper if it doesn't already exist.

3. `backend/src/routes/auth.js`
   - Mount `POST /api/auth/google` under the existing auth router.

4. `backend/src/index.js`
   - Add `https://accounts.google.com` to CSP `scriptSrc`.
   - Add `https://accounts.google.com` and `https://oauth2.googleapis.com` to CSP `connectSrc`.
   - Add `https://accounts.google.com` to CSP `frameSrc` (GIS may use a hidden iframe for some flows).

5. `customer-panel/src/pages/auth/Login.jsx`
   - Uncomment / replace the social login section with `<GoogleSignInButton />`.
   - Keep the existing email/password and MFA flow untouched.

6. `customer-panel/src/pages/auth/Register.jsx`
   - Add the same `<GoogleSignInButton />` above the form with text like "Or sign up with".

7. `customer-panel/src/index.js` or `App.js`
   - Load the GIS SDK script globally, or load it lazily inside `GoogleSignInButton`. Decision: lazy load inside the component to avoid blocking initial page load.

8. `docker-compose.yml` / `.env.example` / `CLAUDE.md`
   - Ensure `GOOGLE_CLIENT_ID` is passed to the customer panel build as `REACT_APP_GOOGLE_CLIENT_ID`.
   - Document the new env var.

9. `backend/src/controllers/order.js`
   - Add a guard: if the authenticated user has no phone, return `400` with message "Please add a phone number to your account before placing an order." (Only affects Google users until they complete their profile.)

10. `customer-panel/src/pages/account/Account.jsx`
    - If `user.phone` is missing/empty, show a persistent banner/form to add it.

## Security considerations
- Use **ID-token flow** with `verifyIdToken` from `google-auth-library`; the token is signed by Google and short-lived.
- Verify the Google `aud` claim matches `GOOGLE_CLIENT_ID`.
- Verify the `iss` claim is `https://accounts.google.com` or `accounts.google.com`.
- Never trust the frontend with profile creation; always decode the verified token server-side.
- For existing email/password accounts with the same email, automatically link only after confirming `email_verified === true` from Google.
- Rate-limit the new endpoint with the existing `authLimiter`.
- Google-authenticated users bypass email verification but still get `isVerified: true`.
- CSP must allow the GIS SDK and Google's OAuth endpoints.

## Configuration required (manual)
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) for the existing OAuth client:
   - Add `https://balportliquors.com` and `https://www.balportliquors.com` to **Authorized JavaScript origins**.
   - No redirect URI is needed for the ID-token button flow.
2. Ensure the **Google Identity Services API** is enabled in the project.
3. `REACT_APP_GOOGLE_CLIENT_ID` is already passed to the customer panel build from `${GOOGLE_CLIENT_ID}` in `docker-compose.yml`; no extra `.env` entry is needed as long as `GOOGLE_CLIENT_ID` is set in `/etc/project-roma/.env`.

## Testing checklist
- [ ] New Google user can click button, choose account, and land on homepage logged in.
- [ ] Returning Google user clicks button and is logged in without creating duplicate account.
- [ ] Existing email/password user with same Gmail can still log in with password after Google link.
- [ ] Google user without phone sees prompt on account page and cannot place order until added.
- [ ] CSP console errors from `accounts.google.com` are absent.
- [ ] Rate limiting still works on `/api/auth/google`.
- [ ] Backend container rebuild succeeds and `GET /api/store/status` returns 200.

## Open questions / follow-up
- Should we also add Google sign-in to the **admin** panel? (Out of scope for this plan; customer panel only.)
- Should we send a welcome email when a new Google user is created? (Can reuse existing `sendEmail` utility; not required for MVP.)
- Should we generate a random password for Google users or leave the field empty? Decision: generate a long random password so the pre-save hook and any legacy password checks don't break, but mark the account as `provider: 'google'` so password login is impossible.

## Out of scope
- Google One Tap popup (future phase).
- Password reset for Google-linked accounts (they use Google).
- Admin panel Google sign-in.
