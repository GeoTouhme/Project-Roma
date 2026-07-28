# Plan: TOTP MFA for Admin Login

## Goal
Add Google Authenticator / Microsoft Authenticator compatible TOTP-based multi-factor authentication to the admin panel login flow, with an opt-in setup page in the admin account area.

## Security decisions
- **Opt-in per admin user.** Existing admins keep working with password-only until they enable MFA.
- **Two-step login flow.** When MFA is enabled, `POST /api/auth/login` only validates credentials and returns `{ mfaRequired: true, tempToken: <...> }`; it does **not** set the HttpOnly auth cookie. The final cookie is issued only after `POST /api/auth/verify-mfa` validates the 6-digit TOTP.
- **Short-lived MFA token.** `tempToken` is a JWT with a distinct `mfa: true` claim, valid for 5 minutes, and usable only for the verify endpoint.
- **Encrypted secrets at rest.** The TOTP base32 secret is encrypted with AES-256-GCM before storage. Key comes from `MFA_SECRET_KEY` env var (fallback to `JWT_SECRET` for bootstrap, but a dedicated key is recommended).
- **Temp secret during enrollment.** MFA setup uses a temporary secret until the user verifies the first code, preventing lockout from a half-completed scan.
- **Rate-limited MFA endpoints.** `verify-mfa` and setup endpoints are protected by the existing strict auth rate limiter to slow brute-force attempts.

## Files to change

### 1. Backend — dependencies & model
| File | Change |
|------|--------|
| `backend/package.json` | Add `speakeasy` and `qrcode` dependencies. |
| `backend/src/models/User.js` | Add `mfaEnabled: Boolean` (default `false`), `mfaSecret: String` (encrypted base32), and `mfaTempSecret: String` (encrypted temporary secret during setup). |

### 2. Backend — MFA helpers and encryption
| File | Change |
|------|--------|
| `backend/src/controllers/auth.js` | Add MFA helper functions: `encryptSecret`/`decryptSecret` using `crypto`, `generateMfaSetup` using `speakeasy`, `verifyMfaCode`. Add controller methods: `setupMfa`, `confirmMfaSetup`, `verifyMfa`, `disableMfa`. Modify `loginUser` so that when `user.mfaEnabled` is true it issues a 5-minute `tempToken` and returns `{ success: true, mfaRequired: true, tempToken }` **without** calling `setAuthCookie`. |

### 3. Backend — routes
| File | Change |
|------|--------|
| `backend/src/routes/auth.js` | Add `POST /api/auth/setup-mfa` (verifyToken, authLimiter), `POST /api/auth/confirm-mfa` (verifyToken, authLimiter), `POST /api/auth/verify-mfa` (authLimiter), and `POST /api/auth/disable-mfa` (verifyToken, authLimiter). |

### 4. Backend — user profile MFA exposure
| File | Change |
|------|--------|
| `backend/src/controllers/user.js` | `getOneUser` / `updateUser` responses will naturally include the new booleans (they are not in `select('-password')` exclusion). No controller mass-assignment changes are needed because `mfaEnabled`/`mfaSecret` are not in the update whitelist. |

### 5. Admin panel — API helpers
| File | Change |
|------|--------|
| `admin-panel/src/lib/api.ts` | Add `authAPI.setupMfa()`, `authAPI.confirmMfa(code)`, `authAPI.verifyMfa(tempToken, code)`, `authAPI.disableMfa(code)`. |

### 6. Admin panel — login flow
| File | Change |
|------|--------|
| `admin-panel/src/context/AuthContext.tsx` | Extend `login` return signature to detect `mfaRequired`. Add `verifyMfa(tempToken, code)` method that calls the verify endpoint and, on success, stores user and navigates to dashboard. Keep existing localStorage-based user cache. |
| `admin-panel/src/pages/Login.tsx` | Add a second-step UI for the 6-digit MFA code. After the first-step password login returns `mfaRequired: true`, show the TOTP input and call `verifyMfa`. Use `input-otp` for a clean digit entry. |

### 7. Admin panel — MFA enrollment page
| File | Change |
|------|--------|
| `admin-panel/src/pages/MyAccount.tsx` | Add an "Authenticator App" card showing whether MFA is enabled. If disabled, show a "Enable MFA" button that calls `setupMfa`, displays the returned QR code (data URL), and prompts for the first 6-digit code via `confirmMfa`. If enabled, show a "Disable MFA" button that requires a code via `disableMfa`. |

### 8. Admin panel — routing
| File | Change |
|------|--------|
| `admin-panel/src/App.tsx` | No new route required; MFA enrollment lives inside the existing `/account` page. |

### 9. Environment secrets
| File | Change |
|------|--------|
| `backend/.env.example` | Add `MFA_SECRET_KEY` placeholder. |
| `/etc/project-roma/.env` | Add a 32-byte `MFA_SECRET_KEY` value (user must do this manually or we append during deployment). |
| `docker-compose.yml` | Pass `MFA_SECRET_KEY` into the backend container environment block. |

## Implementation details

### Encryption helper
```js
const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.MFA_SECRET_KEY || process.env.JWT_SECRET, 'project-roma-mfa', 32);
function encrypt(text) { /* IV + authTag + ciphertext, base64 */ }
function decrypt(encrypted) { /* reverse */ }
```

### TOTP setup
- `speakeasy.generateSecret({ name: 'Balport Liquors (user@email.com)', length: 32 })`.
- `otpauth_url` is converted to a QR code PNG data URL via `qrcode.toDataURL(...)`.
- Endpoint returns `{ qrCode, manualEntryKey: secret.base32 }`.

### TOTP verification
- `speakeasy.totp.verify({ secret: decryptedSecret, encoding: 'base32', token: code, window: 1 })`.
- Window of 1 allows 30-second clock skew.

### Login flow changes
1. User submits email + password.
2. `loginUser` validates password.
3. If `!user.mfaEnabled`: set auth cookie and return user (unchanged behavior for non-MFA users).
4. If `user.mfaEnabled`: issue `tempToken` JWT (claim `{ _id, mfa: true }`, expiry `5m`) and return `{ success: true, mfaRequired: true, tempToken }`.
5. Frontend prompts for TOTP code, sends `{ tempToken, code }` to `verify-mfa`.
6. Backend verifies tempToken, extracts `_id`, verifies TOTP, then sets the final HttpOnly auth cookie and returns user.

### Disable / re-enrollment safety
- `disable-mfa` requires a valid TOTP code (and the final auth cookie), then clears `mfaSecret`, `mfaTempSecret`, and `mfaEnabled`.
- `confirm-mfa` moves `mfaTempSecret` → `mfaSecret` and sets `mfaEnabled: true`.

## Testing checklist
- [ ] `npm install` succeeds in `backend/` with `speakeasy` + `qrcode`.
- [ ] Existing non-MFA admin login still works end-to-end.
- [ ] Enabling MFA in `/account` shows a scannable QR code and succeeds after entering a valid code.
- [ ] After enabling MFA, login requires the TOTP code.
- [ ] Invalid TOTP code returns 400 and does not set the auth cookie.
- [ ] `tempToken` expires after 5 minutes and cannot be reused for normal API calls.
- [ ] Disabling MFA requires a valid code and returns the account to password-only login.
- [ ] Docker builds (`docker compose up --build`) succeed for backend and admin-panel.

## Rollout steps
1. Install backend dependencies.
2. Add `MFA_SECRET_KEY` to `/etc/project-roma/.env` and `docker-compose.yml`.
3. Deploy backend changes.
4. Deploy admin-panel changes.
5. Log in as a super admin, navigate to Account, and enable MFA as a smoke test.
