# Plan: Debug Admin Login Stuck on Login Page

## Problem
User reports: after entering password, no errors appear, but the page stays on `/login` instead of redirecting to `/dashboard`.

## Likely causes
1. The login API succeeds and returns `mfaRequired: true` + `tempToken`, but the frontend does **not** show the MFA step because the response is still `success: true` and the user has MFA disabled? Wait — if MFA is disabled, login should set the cookie and navigate. If it stays, maybe the cookie is not being accepted by the browser because the cookie domain is wrong or `secure`/`sameSite` prevents it on the current origin.
2. The user may have **MFA enabled** from a previous attempt, so the backend returns `mfaRequired: true`, but the UI doesn't visibly switch to the MFA form (maybe state doesn't update).
3. The cookie `domain=.balportliquors.com` + `sameSite=strict` may not be sent when the request is cross-origin from `admin.balportliquors.com` to `balportliquors.com` because `SameSite=Strict` blocks cross-site cookies on cross-origin navigations/AJAX. However, the request is initiated by JS from `admin.balportliquors.com` to `balportliquors.com` (subdomain → apex). Browsers treat subdomains as cross-site for SameSite unless they are the same registrable domain? Actually, for cookie purposes, `SameSite` considers the site as registrable domain. `.balportliquors.com` with `SameSite=Strict` should be sent for same-site requests, including `admin.balportliquors.com` to `balportliquors.com`. But the **first** navigation after login may be considered cross-site? No, they are same-site.
4. More likely: the user **does not have MFA enabled**, the login sets the cookie, but the response body still contains `token` and the frontend `AuthContext` expects `user` in response and navigates. Wait, we removed token from body? We still return `token` in login response for non-MFA. So that should work.
5. Maybe the issue is the **basic auth popup** in nginx for admin subdomain? The user already passed basic auth to load the page, so subsequent API calls should work.
6. The user might be using the **customer panel** login or a saved old URL.

## Diagnostic steps to ask the user
We need browser network tab data. Specifically:
1. Open browser DevTools → Network tab → log in.
2. Find the `login` request to `https://balportliquors.com/api/auth/login`.
3. Share:
   - Response status
   - Response body (or whether it shows `mfaRequired: true`)
   - Response headers tab: whether `Set-Cookie: token=...` appears
4. If `mfaRequired: true`, check whether the login form changes to the MFA code input.
5. If it does change, find the `verify-mfa` request and share status/response/headers.

We should not guess further. Instead, add quick client-side debug logging to make diagnosis faster, then ask the user to reproduce and report.

## Minimal code change
Add `console.log` in `AuthContext.tsx` login and verifyMfa to expose the exact server response, and in `Login.tsx` to log the `result` object and `step` transitions. This is temporary diagnostic instrumentation.

## Files
- `admin-panel/src/context/AuthContext.tsx`
- `admin-panel/src/pages/Login.tsx`

## Note
We must not modify the login logic permanently; just add logs so the user can tell us whether the server returns `mfaRequired`, a cookie, or an error.
