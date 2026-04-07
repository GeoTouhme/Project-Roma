# Plan: "Under Development" Maintenance Page

## Goal

Replace the live customer-facing site (`balportliquors.com`) with a professional "Under Development" landing page while keeping the backend API and admin panel fully functional for internal use.

---

## Option A — Nginx Static Page (Production-Grade)

Serves a static HTML page directly from Nginx, bypassing the React app entirely. Zero downtime, instant toggle, no rebuild needed.

### Steps

1. **Create the static HTML page**
   - File: `customer-panel/public/maintenance.html`
   - Self-contained (inline CSS, no external dependencies)
   - Branded Bal-Port Liquors design

2. **Update Nginx config** (`customer-panel/nginx.conf`)
   ```nginx
   server {
       listen 80;

       # Maintenance mode — serve static page for ALL requests
       location / {
           root /usr/share/nginx/html;
           try_files /maintenance.html =404;
       }
   }
   ```

3. **Toggle on/off**
   - **Enable:** use the maintenance nginx.conf above
   - **Disable:** restore the original nginx.conf that serves the React app
   - Reload: `docker exec balport-customer-panel nginx -s reload`

---

## Option B — React Route Override (Simpler, Recommended)

Wrap the entire app in a maintenance flag check. One component + one env var.

### Steps

1. **Add environment variable** to `customer-panel/.env`:
   ```
   REACT_APP_MAINTENANCE_MODE=true
   ```

2. **Create maintenance component**
   - File: `customer-panel/src/components/maintenance/MaintenancePage.js`
   - Full-page "Under Development" design

3. **Wrap App.js** — check the env var at the top level:
   ```jsx
   const MAINTENANCE = process.env.REACT_APP_MAINTENANCE_MODE === 'true';

   function App() {
     if (MAINTENANCE) return <MaintenancePage />;
     // ... normal app below
   }
   ```

4. **Toggle on/off**
   - Set `REACT_APP_MAINTENANCE_MODE=true` or `false` in `.env`
   - Rebuild: `cd customer-panel && npm run build`
   - Redeploy: `docker-compose up --build customer-panel`

---

## Recommended Approach

**Use Option B** (React route override):
- Fastest to implement (one component + one env var)
- No Nginx config changes
- Easy to test locally before deploying
- Clean toggle via environment variable

---

## Maintenance Page Design Requirements

- Bal-Port Liquors branding (logo, store colors — dark/elegant theme)
- Heading: **"We're Building Something Great"**
- Subtext: "Our online store is currently under development. Stay tuned!"
- Store physical address: 4521 W Coast Hwy, Newport Beach, CA 92663
- Phone number: (949) 642-1921
- Estimated launch timeframe (optional)
- Responsive layout (mobile + desktop)
- Subtle animation (e.g., fade-in or pulse on logo)

---

## What Stays Running

| Service | Status | Notes |
|---------|--------|-------|
| Customer site | 🔶 Maintenance page | Only shows "Under Development" |
| Admin panel | ✅ Fully operational | Accessible at `:5173` |
| Backend API | ✅ Fully operational | Accessible at `:5001` |
| MongoDB | ✅ Fully operational | No changes |

---

## Implementation Checklist

- [ ] Create `MaintenancePage.js` component with branded design
- [ ] Add `REACT_APP_MAINTENANCE_MODE=true` to `customer-panel/.env`
- [ ] Update `App.js` to check the maintenance flag
- [ ] Test locally: `cd customer-panel && npm start`
- [ ] Rebuild and deploy: `docker-compose up --build customer-panel`
- [ ] Verify admin panel still works at `:5173`
- [ ] Verify backend API still works at `:5001`
- [ ] When ready to launch: set `REACT_APP_MAINTENANCE_MODE=false`, rebuild, redeploy
