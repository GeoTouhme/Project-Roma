# Plan: Admin-Friendly Rate Limiting

## Goal
Make admin users effectively not hit rate limits during normal use, while preserving brute-force protection on auth and basic protection for public/authenticated user endpoints.

## Approach
1. **Decode the JWT inside the rate-limit `keyGenerator`** to determine the user's role.
2. If the role is `admin` or `super admin`, use a dedicated `adminLimiter` with a very high ceiling (effectively unlimited for real admin work).
3. If the user is authenticated but not admin, keep the current `apiLimiter`.
4. Unauthenticated requests keep the existing per-IP limits.

## Files to change
- `backend/src/index.js` — update the limiter factory to accept a role-aware admin limit, and decode JWT in the key generator.
- `backend/src/routes/auth.js` — keep strict auth limits, but allow admin login attempts a slightly higher ceiling than regular users (optional, but reasonable).

## Implementation details
- Use `jwt.decode` (not verify) in the key generator for performance; actual verification is still done by `verifyToken` middleware later.
- Add a new `adminLimiter` at 50,000 requests / 15 min.
- Update route mounting so admin-only routes use `adminLimiter`, and mixed routes (orders, user, upload) use the role-aware limiter.
- Keep auth routes on `authLimiter` but raise it for admins? Better: keep auth limiter simpler and raise its ceiling globally to 200 / 15 min for everyone, since we already fixed the IP bucketing.

## Trade-offs
- `jwt.decode` is fast and safe here because it only reads role, but it trusts the token payload without signature verification. However, the actual route still runs `verifyToken`, so a forged token cannot access admin data.
- Very high admin limit removes practical protection against accidental DoS from an admin's own script/browser, but that's acceptable per user request.
