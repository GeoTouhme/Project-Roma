# 🔄 Temporary DoorDash Redirect Plan

> **Goal:** Disable all ordering, billing, login, and cart functionality on the customer-panel. Replace with a single "Order Now" button that links to:  
> `https://order.online/business/balport-liquors-12921009`  
> **No code is deleted** — everything is commented out or feature-flagged.

---

## Overview — What Gets Disabled

| Area | What Changes | Files Affected |
|------|-------------|----------------|
| **Feature Flag** | Add `REACT_APP_ORDERING_DISABLED=true` | `.env` |
| **Cart page** | Disable checkout, show DoorDash redirect | `pages/cart/Cart.jsx` |
| **Product page** | Replace "Add to Cart" & "Buy Now" with "Order Now → DoorDash" | `pages/product/index.jsx` |
| **Product card** | Replace add-to-cart button with "Order Now → DoorDash" | `components/product-card/index.jsx` |
| **Home page** | Change "Order Now" hero button to link to DoorDash | `pages/home/index.jsx` |
| **Header** | Hide user/account icon & cart icon (desktop) | `components/header/index.jsx` |
| **Mobile nav** | Hide Wishlist, Account, Cart tabs | `components/mobile-bottom-nav/index.jsx` |
| **Routes** | Redirect `/login`, `/register`, `/billing`, `/cart`, `/orders` to home | `routes/PublicRoutes.jsx`, `routes/AuthenticatedRoutes.jsx` |
| **App.js** | Skip Stripe `<Elements>` wrapper when ordering disabled | `App.js` |
| **Backend** | Comment out order, payment, cart, auth routes | `backend/src/index.js` |

---

## Step-by-Step Implementation

### Step 1 — Add Feature Flag to `.env`

**File:** `customer-panel/.env`

Add:
```env
REACT_APP_ORDERING_DISABLED=true
```

This lets you **re-enable everything instantly** by setting it to `false` (or removing the line) once your own delivery API is ready.

> [!TIP]
> All frontend changes below will check `process.env.REACT_APP_ORDERING_DISABLED === 'true'` so you can toggle everything with a single env var.

---

### Step 2 — Create a Shared Config Constant

**File:** `customer-panel/src/config/orderingConfig.js` *(new file)*

```js
// Temporary flag — set to false (or remove REACT_APP_ORDERING_DISABLED from .env) 
// to re-enable native ordering when Delvri API is ready.
export const ORDERING_DISABLED = process.env.REACT_APP_ORDERING_DISABLED === 'true';
export const DOORDASH_ORDER_URL = 'https://order.online/business/balport-liquors-12921009';
```

> [!IMPORTANT]
> Every component below imports from this single file. When Delvri is ready, you flip ONE env var and everything comes back.

---

### Step 3 — Disable Cart Page Checkout

**File:** `customer-panel/src/pages/cart/Cart.jsx`

**What changes:**
- Import `ORDERING_DISABLED` and `DOORDASH_ORDER_URL`
- When `ORDERING_DISABLED === true`:
  - **Hide** the cart items table & summary entirely
  - **Show** a message: *"Online ordering is coming soon! For now, order through DoorDash"*
  - **Show** a prominent "Order Now on DoorDash" button linking to the DoorDash URL (opens in new tab)
- When `ORDERING_DISABLED === false`: the original cart renders exactly as before (no code deleted)

```diff
+import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from '../../config/orderingConfig';

 const Cart = () => {
+  if (ORDERING_DISABLED) {
+    return (
+      <div className="main">
+        <div className="container py-20 text-center">
+          <h2 className="text-2xl font-bold mb-4">Online Ordering Coming Soon!</h2>
+          <p className="text-gray-600 mb-8">Order now through our DoorDash partner for fast delivery.</p>
+          <a href={DOORDASH_ORDER_URL} target="_blank" rel="noopener noreferrer"
+             className="bg-[#B5223B] text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-red-700 transition">
+            🛒 Order Now on DoorDash
+          </a>
+        </div>
+      </div>
+    );
+  }
+
   // ... original cart code stays unchanged below ...
```

---

### Step 4 — Replace Product Page "Add to Cart" & "Buy Now"

**File:** `customer-panel/src/pages/product/index.jsx`

**What changes:**
- Import config
- Wrap the "Add To Cart" and "Buy Now" buttons (line 336-339) in a conditional:
  - When disabled: show a single **"Order Now on DoorDash"** `<a>` button (opens new tab)
  - When enabled: show original buttons

```diff
+import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from '../../config/orderingConfig';

 {/* Buttons */}
 <div className="mt-16 flex space-x-4">
+  {ORDERING_DISABLED ? (
+    <a href={DOORDASH_ORDER_URL} target="_blank" rel="noopener noreferrer"
+       className="w-full px-6 py-3 bg-[#B5223B] text-white text-center font-semibold rounded hover:bg-red-700 transition">
+      🛒 Order Now on DoorDash
+    </a>
+  ) : (
+    <>
       <button className="..." onClick={handleAddToCart}>Add To Cart</button>
       <button className="..." onClick={() => handleBillingNavigate()}>Buy Now</button>
+    </>
+  )}
 </div>
```

Also **hide the quantity selector** (lines 312-324) when ordering is disabled.

---

### Step 5 — Replace Product Card "Add to Cart" Icon

**File:** `customer-panel/src/components/product-card/index.jsx`

**What changes:**
- Import config
- Replace the round add-to-cart button (line 95) with a conditional:
  - When disabled: render an `<a>` tag to DoorDash with the same cart icon styling
  - When enabled: original `onClick={handleAddToCart}` behavior

```diff
+import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from '../../config/orderingConfig';

-<div className="product_grid_cart_btn ..." onClick={handleAddToCart}>
+{ORDERING_DISABLED ? (
+  <a href={DOORDASH_ORDER_URL} target="_blank" rel="noopener noreferrer"
+     className="product_grid_cart_btn md:w-10 w-8 md:h-10 h-8 bg-black rounded-full flex items-center justify-center">
+    <Icons name="add_to_cart" ... color="#FFFFFF" />
+  </a>
+) : (
+  <div className="product_grid_cart_btn ..." onClick={handleAddToCart}>
     <Icons name="add_to_cart" ... color="#FFFFFF" />
   </div>
+)}
```

---

### Step 6 — Update Home Page "Order Now" Hero Button

**File:** `customer-panel/src/pages/home/index.jsx`

**What changes:**
- Import config
- Change the **delivery slide** "Order Now" `<Link to="/products">` (line 443-448) to an `<a>` linking to DoorDash when disabled

```diff
+import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from '../../config/orderingConfig';

-<Link to="/products" className="bg-primary ...">
-  Order Now
-</Link>
+{ORDERING_DISABLED ? (
+  <a href={DOORDASH_ORDER_URL} target="_blank" rel="noopener noreferrer" className="bg-primary ...">
+    Order Now
+  </a>
+) : (
+  <Link to="/products" className="bg-primary ...">
+    Order Now
+  </Link>
+)}
```

---

### Step 7 — Hide Cart & Account Icons in Header

**File:** `customer-panel/src/components/header/index.jsx`

**What changes:**
- Import config
- Wrap the **User icon** (lines 390-395) in `{!ORDERING_DISABLED && ...}`
- Wrap the **Cart icon** (lines 408-418) in `{!ORDERING_DISABLED && ...}`
- Add an **"Order Now"** link button in their place when disabled

```diff
+import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from '../../config/orderingConfig';

 {/* User — HIDDEN when ordering disabled */}
+{!ORDERING_DISABLED && (
   <div className="cursor-pointer hidden xl:block" onClick={handleAccountNavigate}>
     <Icons name="user" height={22} width={22} color="#111111" />
   </div>
+)}

 {/* Cart — HIDDEN when ordering disabled */}
+{!ORDERING_DISABLED && (
   <div className="relative cursor-pointer" onClick={() => navigate("/cart")}>
     <Icons name="cart_bag" ... />
     ...
   </div>
+)}

+{/* DoorDash Order Button — SHOWN when ordering disabled */}
+{ORDERING_DISABLED && (
+  <a href={DOORDASH_ORDER_URL} target="_blank" rel="noopener noreferrer"
+     className="bg-[#B5223B] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition">
+    Order Now
+  </a>
+)}
```

---

### Step 8 — Simplify Mobile Bottom Nav

**File:** `customer-panel/src/components/mobile-bottom-nav/index.jsx`

**What changes:**
- Import config
- When disabled: hide **Wishlist**, **Account**, and **Cart** buttons
- Replace the floating Cart button with a **DoorDash "Order" button**

```diff
+import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from '../../config/orderingConfig';

 const navItems = [
   { name: "Home", icon: "home", link: "/" },
   { name: "Shop", icon: "products", link: "/products" },
-  { name: "Wishlist", icon: "wishlist", link: isAuthenticated ? "/wishlist" : "/login" },
-  { name: "Account", icon: "user", link: isAuthenticated ? "/account" : "/login" },
+  ...(!ORDERING_DISABLED ? [
+    { name: "Wishlist", icon: "wishlist", link: isAuthenticated ? "/wishlist" : "/login" },
+    { name: "Account", icon: "user", link: isAuthenticated ? "/account" : "/login" },
+  ] : []),
 ];

 {/* Replace floating cart button with DoorDash when disabled */}
+{ORDERING_DISABLED ? (
+  <a href={DOORDASH_ORDER_URL} target="_blank" rel="noopener noreferrer"
+     className="bg-[#B5223B] text-white rounded-full w-16 h-16 flex items-center justify-center text-xs font-bold shadow-lg">
+    Order
+  </a>
+) : (
   <div onClick={() => navigate("/cart")} className="...">
     <Icons name="cart_bag" ... />
     ...
   </div>
+)}
```

---

### Step 9 — Redirect Disabled Routes to Home

**File:** `customer-panel/src/routes/PublicRoutes.jsx`

**What changes:**
- Import config
- When disabled, redirect `/login`, `/register`, `/verify-otp`, `/cart` to `/`

```diff
+import { ORDERING_DISABLED } from '../../config/orderingConfig';

 <Routes>
   <Route path="/" element={<Home />} />
-  <Route path="/register" element={<Register />} />
-  <Route path="/login" element={<Login />} />
+  <Route path="/register" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Register />} />
+  <Route path="/login" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Login />} />
   ...
-  <Route path="/cart" element={<Cart />} />
-  <Route path="/verify-otp" element={<VerifyEmail />} />
+  <Route path="/cart" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Cart />} />
+  <Route path="/verify-otp" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <VerifyEmail />} />
 </Routes>
```

**File:** `customer-panel/src/routes/AuthenticatedRoutes.jsx`

Same pattern — redirect `/billing`, `/cart`, `/orders`, `/order/:id`, `/wishlist`, `/account` to `/`:

```diff
+import { ORDERING_DISABLED } from '../../config/orderingConfig';

-<Route path="/cart" element={<Cart />} />
-<Route path="/billing" element={<Billing />} />
-<Route path="/order/:id" element={<OrderPage />} />
-<Route path="/orders" element={<OrdersPage />} />
-<Route path="/wishlist" element={<WishlistPage />} />
+<Route path="/cart" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Cart />} />
+<Route path="/billing" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Billing />} />
+<Route path="/order/:id" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <OrderPage />} />
+<Route path="/orders" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <OrdersPage />} />
+<Route path="/wishlist" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <WishlistPage />} />
```

---

### Step 10 — Skip Stripe Wrapper When Disabled

**File:** `customer-panel/src/App.js`

**What changes:**
- Import config
- When `ORDERING_DISABLED`, skip the `<Elements stripe={stripePromise}>` wrapper (no need to load Stripe SDK)

```diff
+import { ORDERING_DISABLED } from './config/orderingConfig';

 function App() {
   if (MAINTENANCE) return <MaintenancePage />;

   return (
     <Provider store={store}>
-      <Elements stripe={stripePromise}>
+      {ORDERING_DISABLED ? (
         <Router>
           <AppContent />
         </Router>
-      </Elements>
+      ) : (
+        <Elements stripe={stripePromise}>
+          <Router>
+            <AppContent />
+          </Router>
+        </Elements>
+      )}
     </Provider>
   );
 }
```

---

### Step 11 — Comment Out Backend Routes (Optional)

**File:** `backend/src/index.js`

**What changes:**
- Comment out the route registrations for ordering, payments, cart, and auth
- Leave the `require()` imports in place (just comment the `app.use()` lines)

```diff
 // === TEMPORARILY DISABLED — Using DoorDash for ordering ===
-app.use('/api', skipRateLimitForAdmin, authLimiter, authRoutes);
+// app.use('/api', skipRateLimitForAdmin, authLimiter, authRoutes);
-app.use('/api', cartRoutes);
+// app.use('/api', cartRoutes);
-app.use('/api', OrderRoutes);
+// app.use('/api', OrderRoutes);
-app.use('/api', paymentRoutes);
+// app.use('/api', paymentRoutes);
-app.use('/api', wishlistRoutes);
+// app.use('/api', wishlistRoutes);
-app.use('/api', doorDashWebhookRoutes);
+// app.use('/api', doorDashWebhookRoutes);
-app.use('/api', uberDirectWebhookRoutes);
+// app.use('/api', uberDirectWebhookRoutes);
```

> [!WARNING]
> This step is **optional**. If the admin panel uses auth routes, **keep auth routes enabled**. Only disable cart/order/payment/webhook routes to reduce attack surface.

---

## Reversal Checklist (When Delvri API is Ready)

When you're ready to re-enable native ordering:

1. **Set** `REACT_APP_ORDERING_DISABLED=false` in `customer-panel/.env`
2. **Uncomment** backend routes in `backend/src/index.js`
3. **Rebuild & redeploy** both frontend and backend
4. **Done** — all original code is intact, nothing was deleted ✅

---

## File Change Summary

| # | File | Action |
|---|------|--------|
| 1 | `customer-panel/.env` | Add `REACT_APP_ORDERING_DISABLED=true` |
| 2 | `customer-panel/src/config/orderingConfig.js` | **New file** — shared constants |
| 3 | `customer-panel/src/pages/cart/Cart.jsx` | Early return with DoorDash redirect |
| 4 | `customer-panel/src/pages/product/index.jsx` | Conditional buttons + hide quantity |
| 5 | `customer-panel/src/components/product-card/index.jsx` | Conditional cart icon → DoorDash link |
| 6 | `customer-panel/src/pages/home/index.jsx` | Hero "Order Now" → DoorDash link |
| 7 | `customer-panel/src/components/header/index.jsx` | Hide cart/account, add "Order Now" button |
| 8 | `customer-panel/src/components/mobile-bottom-nav/index.jsx` | Simplify nav, DoorDash floating button |
| 9 | `customer-panel/src/routes/PublicRoutes.jsx` | Redirect disabled routes to `/` |
| 10 | `customer-panel/src/routes/AuthenticatedRoutes.jsx` | Redirect disabled routes to `/` |
| 11 | `customer-panel/src/App.js` | Skip Stripe `<Elements>` wrapper |
| 12 | `backend/src/index.js` | *(Optional)* Comment out order/cart/payment routes |

**Total: 11 files modified, 1 new file created, 0 files deleted**
