# CLAUDE.md — Project Roma (Bal-Port Liquors)

## Project Overview

**Project Roma** is a full-stack e-commerce platform for **Bal-Port Liquors**, a liquor store located at 4521 W Coast Hwy, Newport Beach, CA 92663. The platform consists of three independently deployable services plus a MongoDB database, all orchestrated via Docker Compose.

**Live domain:** `balportliquors.com` (IP: `31.97.132.106`)

---

## Architecture

```
Project-Roma/
├── backend/          # Express.js REST API (Node.js, port 5001)
├── admin-panel/      # Admin dashboard (Vite + React + TypeScript + shadcn/ui, port 5173)
├── customer-panel/   # Customer storefront (Create React App + Redux, port 3000)
├── docker-compose.yml
└── package.json      # Root-level CRA (legacy, mostly unused — customer-panel is the real storefront)
```

### Service Map

| Service | Tech Stack | Port | Container |
|---------|-----------|------|-----------|
| Backend API | Express.js 4, Mongoose 8, Node.js | 5001 | `balport-backend` |
| Admin Panel | Vite 5, React 18, TypeScript, TailwindCSS 3, shadcn/ui (Radix), TanStack Query | 5173 → nginx:80 | `balport-admin-panel` |
| Customer Panel | CRA, React 19, Redux Toolkit, TailwindCSS 3, Stripe Elements, Framer Motion | 3000 → nginx:80 | `balport-customer-panel` |
| MongoDB | mongo:latest | 27017 | `balport-mongo` |

---

## Quick Start

### Docker (Production)

```bash
docker-compose up --build
```

Environment variables to set (or use defaults):
- `REACT_APP_API_URL` — customer panel API endpoint (default: `http://localhost:5001`)
- `VITE_API_URL` — admin panel API endpoint (default: `http://localhost:5001`)
- `BACKEND_PORT` — backend port (default: `5001`)
- `CUSTOMER_PANEL_PORT` — customer panel port (default: `3000`)
- `ADMIN_PANEL_PORT` — admin panel port (default: `5173`)

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev          # nodemon src/index.js

# Admin Panel
cd admin-panel
npm install
npm run dev          # vite dev server

# Customer Panel
cd customer-panel
npm install
npm start            # react-scripts start
```

---

## Backend (`backend/`)

### Entry Point

`src/index.js` — Express app with security hardening applied.

### Key Security Measures

- **Query parser set to `'simple'`** — disables `qs` bracket-object parsing to prevent NoSQL injection (`?key[$ne]=x` attacks). This is critical; do NOT change it back to `'extended'`.
- **CORS origin whitelist** — reads from `ALLOWED_ORIGINS` env var (comma-separated). Falls back to `balportliquors.com` domains.
- **Body parser size limit** — `1mb` max payload to prevent DoS.
- **Rate limiting** — 100 requests per 15 minutes on auth routes.
- **Input validation** — allow-list validators in `src/utils/validators.js`. All controllers should type-check user inputs.

### Directory Structure

```
backend/src/
├── index.js              # App entry, middleware, route mounting
├── config/
│   ├── cloudinary.js     # Cloudinary SDK config
│   ├── getBlurDataURL.js # Generate blur placeholders for images
│   ├── getUser.js        # JWT → user extraction helper
│   ├── jwt.js            # JWT sign/verify utilities
│   └── uploader.js       # Multer + Cloudinary upload pipeline
├── controllers/          # Route handlers (one file per domain)
│   ├── auth.js           # Registration, login, OTP, password reset
│   ├── product.js        # CRUD, filtering, pagination, bulk ops
│   ├── order.js          # Order lifecycle + DoorDash dispatch, cancel, refresh
│   ├── doorDashWebhook.js # DoorDash webhook handler (status updates)
│   ├── cart.js, wishlist.js, review.js, search.js
│   ├── category.js, subcategory.js, brand.js
│   ├── dashboard.js      # Admin analytics
│   ├── home.js           # Homepage data aggregation
│   ├── coupon-code.js    # Promo code management
│   ├── newsletter.js, notification.js
│   ├── settings.js       # Store settings (hours, delivery config)
│   ├── upload.js         # Image upload endpoint
│   └── payment-intents.js # Stripe payment intents
├── middleware/
│   ├── adminCheck.js     # Role-based access (super admin / admin)
│   ├── checkStoreHours.js # Block orders outside operating hours
│   └── upload.js         # Multer config
├── models/               # Mongoose schemas
│   ├── User.js           # firstName, lastName, email, password (bcrypt hashed), role, OTP, wishlist, orders
│   ├── Product.js        # name, sku, slug, price, priceSale, images (Cloudinary), category ref (required), subCategory ref (optional)
│   ├── Order.js          # paymentMethod (Stripe/PayPal/COD), items, user snapshot, DoorDash delivery fields, estimatedPickupTime, estimatedDeliveryTime
│   ├── Category.js, SubCategory.js, Brand.js
│   ├── Review.js, CouponCode.js, Newsletter.js, Notification.js
│   └── settings.js       # Store hours, delivery settings
├── routes/
│   ├── doorDashWebhook.js # POST /api/webhooks/doordash — no auth (DoorDash Basic Auth)
│   └── ...
├── services/
│   ├── cloudinary.service.js  # Upload/delete/transform images
│   └── doorDashService.js     # DoorDash Drive API v2 integration
├── utils/
│   ├── mailer.js         # Nodemailer email sender
│   └── validators.js     # Input sanitization & type-checking
└── scripts/              # One-off data migration & seeding scripts
    ├── seed-products.js, seed-categories.js
    ├── pro-migrator-*.js  # CSV→MongoDB product migration (multiple versions)
    ├── clean_db.js
    └── inventory.csv      # Source inventory data
```

### Environment Variables (backend/.env)

Required:
- `PORT` — server port (default 5001)
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret
- `ALLOWED_ORIGINS` — comma-separated CORS origins
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `STRIPE_SECRET_KEY` — Stripe server-side key
- `DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET` — DoorDash Drive API credentials
- Email config for Nodemailer (SMTP host, user, pass)

### API Route Prefix

All routes are mounted under `/api/`. Examples:
- `POST /api/login`, `POST /api/register`
- `GET /api/products`, `GET /api/products/:slug`
- `POST /api/orders`, `GET /api/orders/:id`
- `POST /api/webhooks/doordash` — DoorDash delivery status webhook (no JWT)
- `PUT /api/admin/orders/:id/cancel` — cancel order + DoorDash delivery
- `GET /api/admin/orders/:id/delivery-status` — refresh delivery status from DoorDash
- `GET /api/dashboard/stats`
- `GET /api/store/status` — returns `isOpen`, `message`, `schedule`
- `GET /api/admin/products/export-csv` — downloads full inventory as CSV (admin-only)
- `POST /api/admin/products/import-csv` — uploads CSV to upsert products by UPC/SKU (admin-only, multipart/form-data)
- `GET /api/settings`

### DoorDash Drive Integration

`src/services/doorDashService.js` handles delivery dispatch:
- JWT-signed requests using HS256 with base64url-decoded signing secret
- Pickup address hardcoded to the store location
- Alcohol-aware: sets `containsAlcohol` flag → requires ID verification, signature, no contactless delivery, return-to-pickup if undeliverable
- `createDelivery()` — dispatches a delivery order
- `getDeliveryQuote()` — gets a delivery fee quote
- `cancelDelivery(externalDeliveryId)` — cancels an active delivery
- `getDeliveryStatus(externalDeliveryId)` — polls DoorDash for latest status

**Webhook** (`POST /api/webhooks/doordash`) — receives DoorDash status pushes and maps them to internal order statuses (`shipped`, `delivered`, `delivery_failed`, `returned`). Always returns 200 to prevent retries. Creates admin notifications on `DELIVERY_CANCELLED` and `DELIVERY_RETURNED`.

### Database

- **MongoDB** via Mongoose 8
- Database name: `liquor_shop`
- Schemas use `{ timestamps: true }` for `createdAt` / `updatedAt`
- Product model uses `{ strict: true }` to reject unknown fields
- User passwords are bcrypt-hashed via pre-save hook (10 salt rounds)

---

## Admin Panel (`admin-panel/`)

### Tech Stack
- **Vite 5** + **React 18** + **TypeScript**
- **shadcn/ui** — component library built on Radix UI primitives
- **TailwindCSS 3** with `tailwindcss-animate`
- **TanStack Query** (React Query v5) — server state management
- **React Hook Form** + **Zod** — form handling & validation
- **Recharts** — dashboard charts
- **Axios** — HTTP client
- **React Router v6** — routing with `ProtectedRoute` wrapper

### Key Pages
- `/login` — admin authentication
- `/dashboard` — sales analytics, charts, recent orders
- `/orders`, `/orders/:id` — order management with DoorDash status
- `/products`, `/products/new`, `/products/edit/:id` — product CRUD + CSV download/upload buttons
- `/categories`, `/sub-categories` — taxonomy management
- `/customers` — customer management
- `/newsletters` — email subscriber management
- `/store-settings` — store hours, delivery configuration
- `/account` — admin profile

### Auth Pattern
Uses `AuthContext` with `ProtectedRoute` and `RedirectIfAuthenticated` components. JWT stored client-side.

---

## Customer Panel (`customer-panel/`)

### Tech Stack
- **Create React App** (react-scripts 5) + **React 19**
- **Redux Toolkit** — state management (slices: `authSlice`, `cartSlice`)
- **TailwindCSS 3**
- **Stripe Elements** (`@stripe/react-stripe-js`) — payment processing
- **Framer Motion** — animations
- **React Router v7**
- **Axios** — HTTP client
- **react-hot-toast** — notifications
- **react-slick** — carousels

### Key Features
- Age verification gate (`AgeGate` component) — required for liquor store
- Product browsing with categories/collections
- Shopping cart with persistent state
- Wishlist
- Stripe checkout integration
- Order tracking with DoorDash delivery status
- User account management (orders, profile, billing)
- Privacy policy & Terms of Service pages

### State Management
Redux store with two slices:
- `authSlice` — authentication state
- `cartSlice` — shopping cart items and quantities

### Config
`src/config/AppConfig.js` contains:
- `STRIPE_PUBLIC_KEY` — Stripe publishable key
- API base URL configuration

---

## Conventions & Patterns

### Code Style
- Backend: CommonJS (`require`/`module.exports`), no TypeScript
- Admin Panel: ESM imports, TypeScript strict mode
- Customer Panel: ESM imports, JavaScript (JSX)
- All panels use TailwindCSS for styling

### API Communication
- All API calls go through Axios
- Admin panel uses TanStack Query for caching/invalidation
- Customer panel uses direct Axios calls + Redux for state
- JWT tokens sent via Authorization header

### Image Handling
- All product/category images uploaded to **Cloudinary**
- Each image stores: `url`, `_id` (Cloudinary public ID), `blurDataURL` (base64 blur placeholder)
- Upload pipeline: Multer (memory storage) → Cloudinary upload → save URL to MongoDB

### Error Handling
- Backend controllers use try/catch with consistent `{ success: false, message: '...' }` response format
- Frontend shows toast notifications on errors

### Naming Conventions
- Backend models: PascalCase singular (`Product`, `User`, `Order`)
- Backend routes/controllers: kebab-case filenames (`coupon-code.js`, `payment-intents.js`)
- Admin panel: PascalCase for pages/components (`.tsx`)
- Customer panel: PascalCase for components, kebab-case for page directories

---

## Security Notes

A security audit was conducted (March 2026). Key findings & remediations:

### Applied Fixes
- ✅ Query parser set to `'simple'` to prevent NoSQL injection
- ✅ CORS restricted to explicit origin whitelist
- ✅ Body parser size limit (1mb)
- ✅ Rate limiting on auth endpoints
- ✅ Input validators enforce string types (block `$ne`, `$gt` operator injection)

### Ongoing Concerns
- ⚠️ Port 5001 should NOT be exposed directly to the internet — route through Nginx reverse proxy only
- ⚠️ Google Maps API key must be restricted via HTTP referrers in Google Cloud Console
- ⚠️ Admin panel relies on client-side route protection — server-side auth is enforced at the API level, but the static HTML loads without authentication

---

## AIDesigner Integration

An `aidesigner` MCP server is configured (`.mcp.json`) for frontend design work. Key files:

- `.mcp.json` — MCP server config pointing to `https://api.aidesigner.ai/api/v1/mcp`
- `.claude/agents/aidesigner-frontend.md` — agent definition with design workflow rules
- `.claude/commands/aidesigner.md` — slash command definition for `/aidesigner`
- `.aidesigner/` — design output directory (`.aidesigner/DESIGN.md` for design briefs)

Use `/aidesigner` in Claude Code to invoke AIDesigner for frontend page designs. The agent reads repo design context first (Tailwind tokens, existing components, route structure) before generating.

---

## Data Migration Scripts

Located in `backend/scripts/`. These are one-off scripts for seeding/migrating data:
- `seed-products.js` / `seed_products.js` — Seed products from CSV with Cloudinary image upload
- `seed-categories.js` — Seed category taxonomy
- `pro-migrator-*.js` (v5–v10, final) — Iterative product data migration scripts
- `update-inventory-sku-desc.js` — Update SKU and descriptions from inventory CSV
- `update-prices-null.js` — Fix null price fields
- `clean_db.js` — Database cleanup utility

Run with: `node backend/scripts/<script-name>.js` (requires `MONGODB_URI` in env)

---

## Deployment

### Docker Compose (Primary)
All three services + MongoDB are defined in `docker-compose.yml`. The frontend panels build to static files and are served via Nginx containers.

### Vercel (Backend Alternative)
`backend/vercel.json` is configured for serverless deployment on Vercel, routing all requests to `src/index.js`.

### Build Commands
```bash
# Admin Panel
cd admin-panel && npm run build     # → dist/

# Customer Panel
cd customer-panel && npm run build  # → build/

# Backend has no build step (plain Node.js)
```

---

## Common Tasks

### Add a new API endpoint
1. Create or update the controller in `backend/src/controllers/`
2. Add the route in `backend/src/routes/`
3. Mount the route in `backend/src/index.js` if it's a new route file
4. Add input validation using patterns from `src/utils/validators.js`

### Add a new admin page
1. Create the page component in `admin-panel/src/pages/`
2. Add the route in `admin-panel/src/App.tsx` (wrap with `ProtectedRoute`)
3. Add navigation link in `admin-panel/src/components/Layout.tsx`

### Add a new product field
1. Update `backend/src/models/Product.js` schema
2. Update `backend/src/controllers/product.js` (create/update handlers)
3. Update `admin-panel/src/pages/ProductForm.tsx`
4. Update `customer-panel` product display components as needed

### CSV Inventory Operations
The admin Products page (`/products`) has two CSV buttons:
- **Download Inventory CSV** — exports all products with: UPC, Name, Price, Sale Price, Stock, Category, SubCategory, Status, Code, Description, Image URL (Cloudinary)
- **Upload Inventory CSV** — imports a CSV file. Matches products by UPC (`sku` field):
  - Existing UPC → updates only the provided fields
  - New UPC → creates a new product (requires at least: UPC, Name, Sale Price, Stock, Category)
  - Slugs are auto-generated from product name for new products
  - Category/SubCategory matched by name (case-insensitive)
  - Image URL column is optional

Backend routes: `GET /api/admin/products/export-csv`, `POST /api/admin/products/import-csv` (multer memory storage, 10MB max, CSV-only)

### Run database scripts
```bash
cd backend
# Ensure MONGODB_URI is set in .env or environment
node scripts/seed-products.js
```
