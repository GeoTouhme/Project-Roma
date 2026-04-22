# FIX PLAN: Register Function Security & Validation

> **INSTRUCTIONS FOR MINIMAX**: Follow these steps **IN EXACT ORDER**. Each step has the **exact file path**, **exact line numbers**, and **exact code** to find and replace. Do NOT skip steps. Do NOT add extra changes. Do NOT modify any files other than the ones listed below.

---

## Files You Will Edit (ONLY these 2 files)

1. `backend/src/controllers/auth.js`
2. `customer-panel/src/pages/auth/Register.jsx`

**DO NOT** touch any other files.

---

## Step 1 — FIX CRITICAL: Remove Mass Assignment & Role Escalation

**File**: `backend/src/controllers/auth.js`
**Lines**: 39–45

**FIND this exact code:**
```js
    // Create user with the generated OTP
    const user = await User.create({
      ...request,
      otp,
      role: Boolean(UserCount) ? request.role || 'user' : 'super admin',
      isVerified: false,
    });
```

**REPLACE with this exact code:**
```js
    // Create user with the generated OTP
    // SECURITY: Whitelist only allowed fields — prevents role escalation and field injection
    const user = await User.create({
      firstName: request.firstName,
      lastName: request.lastName,
      email: safeEmail,
      password: request.password,
      phone: request.phone,
      otp,
      role: UserCount > 0 ? 'user' : 'super admin',
      isVerified: false,
    });
```

**WHY**: The old code used `...request` which dumped all client input into the database. An attacker could send `"role": "admin"` in the request body and become admin instantly. The fix whitelists only the fields we actually need and hardcodes the role to `'user'` for all new registrations (except the very first user who becomes super admin).

---

## Step 2 — Remove UserCount Leak from Error Response

**File**: `backend/src/controllers/auth.js`
**Lines**: 25–31

**FIND this exact code:**
```js
    if (existingUser) {
      return res.status(400).json({
        UserCount,
        success: false,
        message: 'User With This Email Already Exists',
      });
    }
```

**REPLACE with this exact code:**
```js
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User With This Email Already Exists',
      });
    }
```

**WHY**: The `UserCount` field was leaking the total number of users in the system to anyone who hits this endpoint. Attackers can use this for reconnaissance.

---

## Step 3 — Fix Phishing Vector: Hardcode Verification Link Origin

**File**: `backend/src/controllers/auth.js`
**Line**: 75

**FIND this exact code:**
```js
      const verificationLink = `${request.origin || 'http://151.145.90.89'}/verify-otp?email=${encodeURIComponent(user.email)}&otp=${otp}`;
```

**REPLACE with this exact code:**
```js
      const verificationLink = `${process.env.FRONTEND_URL || 'https://balportliquors.com'}/verify-otp?email=${encodeURIComponent(user.email)}&otp=${otp}`;
```

**WHY**: The old code read the URL from `request.origin` (client-controlled). An attacker could send `origin: "https://evil-site.com"` and the verification email would contain a phishing link to their site. The fix uses a server-side environment variable instead.

---

## Step 4 — Exclude `confirmPassword` from API Payload

**File**: `customer-panel/src/pages/auth/Register.jsx`
**Lines**: 55–58

**FIND this exact code:**
```js
    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);

      AuthService.register(formData)
```

**REPLACE with this exact code:**
```js
    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);

      const { confirmPassword, ...submitData } = formData;
      AuthService.register(submitData)
```

**WHY**: `confirmPassword` was being sent to the server unnecessarily. Password comparison is done on the frontend already (line 44). There is no reason to transmit it over the network.

---

## Step 5 — Improve Frontend Validation

**File**: `customer-panel/src/pages/auth/Register.jsx`
**Lines**: 32–49

**FIND this exact code:**
```js
  const validate = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";

    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";

    return newErrors;
  };
```

**REPLACE with this exact code:**
```js
  const validate = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";

    // Email validation
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email)) newErrors.email = "Please enter a valid email address";

    // Password validation
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) newErrors.password = "Password must include uppercase, lowercase, and a number";

    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    // Phone validation
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[0-9+\s()-]{7,15}$/.test(formData.phone)) newErrors.phone = "Please enter a valid phone number";

    return newErrors;
  };
```

**WHY**: The old validation was too loose:
- Email regex accepted invalid formats like `a@b.c`
- Password only required 8 characters with no complexity
- Phone accepted any non-empty string including `"abc"`

The new validation:
- Email: requires proper format with a 2+ character TLD
- Password: requires at least one uppercase, one lowercase, and one number
- Phone: requires 7-15 characters of digits, spaces, parentheses, hyphens, and `+`

---

## Verification Checklist

After completing ALL 5 steps, verify:

- [ ] **Step 1**: `auth.js` line ~40 no longer has `...request` spread
- [ ] **Step 1**: `auth.js` line ~43 says `role: UserCount > 0 ? 'user' : 'super admin'` (NOT `request.role`)
- [ ] **Step 2**: `auth.js` line ~26 no longer has `UserCount,` in the error response
- [ ] **Step 3**: `auth.js` line ~75 uses `process.env.FRONTEND_URL` (NOT `request.origin`)
- [ ] **Step 4**: `Register.jsx` line ~58 has `const { confirmPassword, ...submitData } = formData;` before the API call
- [ ] **Step 5**: `Register.jsx` validate function has the improved email, password, and phone regex patterns

**DO NOT** change any other code in any other file. These 5 steps are the complete fix.
