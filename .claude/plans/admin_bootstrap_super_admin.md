# Plan: Secure Admin Bootstrapping (Prevent Super-Admin Squatting)

## Problem

In `backend/src/controllers/auth.js::registerUser`:

```js
role: UserCount > 0 ? 'user' : 'super admin'
```

The very first account registered through the public storefront becomes `super admin`. If the site is publicly reachable before the real owner registers, an attacker can squat the super-admin role.

## Goal

Ensure the initial admin account is created through a controlled, non-public flow instead of the public registration form.

## Proposed Solution

### Option A — Environment-based initial admin (recommended)

1. Add `INITIAL_ADMIN_EMAIL` to `/etc/project-roma/.env`.
2. Change `registerUser` so **all public registrations are `role: 'user'`**.
3. Add a new private setup endpoint or startup script that promotes the user matching `INITIAL_ADMIN_EMAIL` to `super admin`.

This is the simplest and most secure approach. It requires the server owner to set the email in the env before going public.

### Option B — CLI seed script

Create a Node.js script that creates the first super admin from command-line arguments. The operator runs it once during deployment.

More secure than Option A because it doesn't rely on a public endpoint, but requires manual execution after deploy.

### Decision: Implement Option A with a private setup endpoint

Because you already have a running Docker deployment and want convenience, we'll do Option A but protect the setup endpoint so it can only be run from localhost/internal network.

## Detailed Implementation

### 1. Environment Variable

Add to `/etc/project-roma/.env`:

```bash
INITIAL_ADMIN_EMAIL=owner@example.com
```

This is the email address of the person who should become the first super admin.

### 2. Backend — `backend/src/controllers/auth.js::registerUser`

Change:

```js
role: UserCount > 0 ? 'user' : 'super admin',
```

To:

```js
role: 'user',
```

All public registrations now create regular customers.

### 3. New Setup Endpoint — `backend/src/controllers/auth.js`

Add `bootstrapAdmin` controller:

- Accepts `{ email, setupKey }`.
- Compares `setupKey` against `process.env.SETUP_SECRET_KEY`.
- If valid, finds user by email and sets `role: 'super admin'`.
- If no user exists yet, can optionally create one (out of scope for safety; we only promote existing verified users).

Mount it at `POST /api/admin/bootstrap`.

Add `SETUP_SECRET_KEY` to env. It can default to `JWT_SECRET` but ideally is a separate long random string.

Route file: `backend/src/routes/admin.js` or a dedicated `backend/src/routes/setup.js`.

### 4. Middleware / Route Protection

The setup route should:
- Not be exposed through Nginx to the public internet.
- Or require the setup key.
- Or be restricted to internal Docker IP / localhost.

For simplicity, we'll just require `SETUP_SECRET_KEY` and recommend blocking the route in Nginx. The key provides defense in depth.

### 5. Docker Compose Update

Pass new env vars to the backend container:

```yaml
- INITIAL_ADMIN_EMAIL=${INITIAL_ADMIN_EMAIL:-}
- SETUP_SECRET_KEY=${SETUP_SECRET_KEY:-${JWT_SECRET}}
```

### 6. Admin Promotion Flow

1. Owner sets `INITIAL_ADMIN_EMAIL` in `.env`.
2. Owner registers an account via the storefront using that exact email.
3. Owner verifies the email.
4. Owner hits the setup endpoint with the setup key:
   ```bash
   curl -X POST https://localhost:5001/api/admin/bootstrap \
     -H "Content-Type: application/json" \
     -d '{"email":"owner@example.com","setupKey":"..."}'
   ```
5. That user becomes `super admin`.

Alternatively, we can make `verifyOtp` automatically promote the user if their email matches `INITIAL_ADMIN_EMAIL` and no super admin exists yet. That removes the manual curl step.

### Decision: Auto-promote on verification

When `verifyOtp` succeeds, after setting `isVerified = true`:

```js
const superAdminExists = await User.exists({ role: 'super admin' });
if (!superAdminExists && process.env.INITIAL_ADMIN_EMAIL === safeEmail) {
  user.role = 'super admin';
}
```

This is the smoothest operator experience:
- Set env var.
- Register with that email.
- Verify email.
- Automatically becomes super admin.
- Subsequent registrations are regular users.

## Files to Edit

- `backend/src/controllers/auth.js`
  - `registerUser` — set `role: 'user'` unconditionally.
  - `verifyOtp` — auto-promote to `super admin` if email matches `INITIAL_ADMIN_EMAIL` and no super admin exists.
- `backend/.env.example` — add `INITIAL_ADMIN_EMAIL` and `SETUP_SECRET_KEY` documentation.
- `docker-compose.yml` — pass `INITIAL_ADMIN_EMAIL` to backend container.
- `/etc/project-roma/.env` — add the initial admin email.

## Out of Scope

- Separate setup endpoint with `SETUP_SECRET_KEY` (can be added later as extra defense).
- CLI seed script.
- Migration for existing first user who may already be super admin.

## Acceptance Criteria

- [ ] New public registrations always create `role: 'user'`.
- [ ] A user registering with `INITIAL_ADMIN_EMAIL` is promoted to `super admin` upon email verification.
- [ ] After one super admin exists, no further auto-promotions happen.
- [ ] Existing super admins keep their role.
- [ ] The change is backward compatible with current `User` schema.
