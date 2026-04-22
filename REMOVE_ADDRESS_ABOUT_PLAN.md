# Plan: Remove `address` and `about` Fields from Registration & User Profile

> **Purpose**: Remove the `address` and `about` input fields from the customer registration form, the User database model, and all backend/frontend code that references them in the context of user profiles.
>
> **Scope**: Only the **user profile `address`** and **`about`** fields. Do **NOT** touch `address` used in the **Billing/Checkout flow** (`Billing.jsx`) or the **Order system** — those are shipping/delivery addresses and must remain.

---

## File Index (Quick Reference)

| # | File | Purpose |
|---|------|---------|
| 1 | `customer-panel/src/pages/auth/Register.jsx` | Registration form UI |
| 2 | `backend/src/models/User.js` | Mongoose User schema |
| 3 | `backend/src/controllers/auth.js` | Register & Login controllers |
| 4 | `backend/src/controllers/user.js` | Update user profile controller |
| 5 | `customer-panel/src/pages/account/Account.jsx` | Account/profile page (verify no refs) |

---

## Step 1 — Frontend: Remove from Registration Form

**File**: `customer-panel/src/pages/auth/Register.jsx`

### 1A. Remove `address` and `about` from initial state (lines 9–23)

Find the `useState` initializer and remove the `address` and `about` properties:

```diff
 const [formData, setFormData] = useState({
   firstName: "",
   lastName: "",
   email: "",
   password: "",
   confirmPassword: "",
   gender: "",
   phone: "",
-  address: "",
   city: "",
   zip: "",
   country: "",
   state: "",
-  about: "",
 });
```

### 1B. Remove the Address input block (lines 258–272)

Delete the entire `{/* Address - Optional but included in form */}` block:

```diff
-            {/* Address - Optional but included in form */}
-            <div className="md:col-span-2">
-              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">
-                Address
-              </label>
-              <input
-                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
-                id="address"
-                name="address"
-                type="text"
-                value={formData.address}
-                onChange={handleChange}
-                placeholder="123 Main St"
-              />
-            </div>
```

### 1C. Remove the About textarea block (lines 338–352)

Delete the entire `{/* About */}` block:

```diff
-            {/* About */}
-            <div className="md:col-span-2">
-              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="about">
-                About
-              </label>
-              <textarea
-                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
-                id="about"
-                name="about"
-                rows="3"
-                value={formData.about}
-                onChange={handleChange}
-                placeholder="Tell us a bit about yourself..."
-              />
-            </div>
```

---

## Step 2 — Backend: Remove from User Model

**File**: `backend/src/models/User.js`

### 2A. Remove `address` field (lines 67–69)

```diff
-  address: {
-    type: String,
-  },
```

### 2B. Remove `about` field (lines 82–84)

```diff
-  about: {
-    type: String,
-  },
```

> **IMPORTANT**: Keep `city`, `zip`, `country`, and `state` — those are still used by the registration form and may be needed elsewhere.

---

## Step 3 — Backend: Clean Auth Controller (Login Response)

**File**: `backend/src/controllers/auth.js`

### 3A. Remove `address` and `about` from login response (lines 197–218)

In the `loginUser` function, the user response object includes `address` and `about`. Remove them:

```diff
 return res.status(201).json({
   success: true,
   message: 'Login Successfully',
   token,
   user: {
     _id: user._id,
     firstName: user.firstName,
     lastName: user.lastName,
     email: user.email,
     cover: user.cover,
     gender: user.gender,
     phone: user.phone,
-    address: user.address,
     city: user.city,
     country: user.country,
     zip: user.zip,
     state: user.state,
-    about: user.about,
     role: user.role,
     wishlist: products,
   },
 });
```

> **NOTE**: The `registerUser` function (line 40) uses `...request` spread to create the user. Since we removed the fields from the frontend form state, `address` and `about` will no longer be sent in the request body. No changes needed in `registerUser` itself — Mongoose will simply ignore unknown fields if they are not in the schema.

---

## Step 4 — Backend: Clean User Controller (Update Whitelist)

**File**: `backend/src/controllers/user.js`

### 4A. Remove `address` from the `ALLOWED_FIELDS` whitelist (line 80)

```diff
-  const ALLOWED_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'cover', 'address', 'city', 'country', 'zip'];
+  const ALLOWED_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'cover', 'city', 'country', 'zip'];
```

> **NOTE**: `about` is not in this whitelist, so no change needed for it here.

---

## Step 5 — Verify: Account Page Has No References

**File**: `customer-panel/src/pages/account/Account.jsx`

Verify that the Account page does **NOT** display or edit `address` or `about` fields. Based on the current code, the Account page only manages `firstName`, `lastName`, `phone`, and `email`. **No changes needed here.**

---

## Step 6 — Verify: No Side Effects

These files use `address` for **checkout/delivery purposes** and must **NOT** be modified:

| File | Why it is safe |
|------|---------------|
| `customer-panel/src/pages/Billing/Billing.jsx` | Uses `address` for **shipping/delivery**, not user profile |
| `src/pages/Billing/Billing.jsx` | Static template version of Billing — same reason |
| `customer-panel/src/pages/order/index.jsx` | Displays order **delivery address** |
| `backend/src/controllers/order.js` | Handles order **shipping address** |
| `backend/src/services/doorDashService.js` | DoorDash delivery **destination address** |
| `customer-panel/src/components/footer/index.jsx` | Store **physical address** in footer |
| `customer-panel/src/pages/Privacy/Privacy.jsx` | Privacy policy text mentioning "address" |

---

## Summary Checklist

- [ ] **Step 1A**: Remove `address` and `about` from `formData` state in `Register.jsx`
- [ ] **Step 1B**: Delete the Address `<input>` block in `Register.jsx` (lines 258–272)
- [ ] **Step 1C**: Delete the About `<textarea>` block in `Register.jsx` (lines 338–352)
- [ ] **Step 2A**: Remove `address` field from User schema in `User.js` (lines 67–69)
- [ ] **Step 2B**: Remove `about` field from User schema in `User.js` (lines 82–84)
- [ ] **Step 3A**: Remove `address` and `about` from login response in `auth.js` (lines 209, 214)
- [ ] **Step 4A**: Remove `'address'` from `ALLOWED_FIELDS` array in `user.js` (line 80)
- [ ] **Step 5**: Verify Account page — no changes needed
- [ ] **Step 6**: Verify Billing/Order/Footer files are untouched

---

## Database Cleanup (Optional)

> **CAUTION**: Existing users in MongoDB will still have `address` and `about` fields stored in their documents. Removing these fields from the Mongoose schema means they will simply be ignored on read/write going forward. If you want to clean up old data, run this **optional** migration script in the MongoDB shell:
>
> ```js
> db.users.updateMany({}, { $unset: { address: "", about: "" } });
> ```
>
> This is optional and non-urgent — stale fields will not cause any issues.
