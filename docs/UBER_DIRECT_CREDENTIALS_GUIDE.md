# Uber Direct — Getting Correct Credentials

## The Problem

Your `.env` file contains these credentials:
- `UBER_DIRECT_CLIENT_ID=sSXl_eLBRdcyyD2mcw_J4i5hlA1QeCI9`
- `UBER_DIRECT_CLIENT_SECRET=2MCkaVYY4KKC4aQt72J0wCgDJ6vcUMIHyJTP5I3a`
- `UBER_DIRECT_CUSTOMER_ID=19a81c63-38e4-5b2b-98d6-2499a048b61a`

When we call Uber's OAuth endpoint, we get `invalid_scope` — which means either:
1. The app doesn't exist in the dashboard you're logged into, OR
2. The app exists but isn't enabled for Uber Direct API access.

Since the dashboard shows "Create Application", it's likely #1.

---

## Step-by-Step: Create App & Get Credentials

### 1. Log into Uber Developer Dashboard
- Go to: https://developer.uber.com/dashboard
- Make sure you're logged into the **same Uber account** that owns your Uber Direct business account.

### 2. Create a New Application
- Click **"Create Application"**
- Fill in:
  - **App Name**: `Balport Liquors Delivery`
  - **Description**: `Delivery integration for Balport Liquors e-commerce`
  - **Privacy Policy URL**: `https://balportliquors.com/privacy`

### 3. Enable Uber Direct Product
- After creation, go to your app's page
- Look for **"Products"** or **"API Access"**
- Find **"Uber Direct"** or **"Delivery API"** and click **"Request Access"**
- Uber typically approves within 1–2 business days. You'll get an email.

### 4. Copy Client ID & Client Secret
- Once the app is created (even before Uber Direct approval), go to **Settings**
- Copy:
  - **Client ID** → `UBER_DIRECT_CLIENT_ID`
  - **Client Secret** → `UBER_DIRECT_CLIENT_SECRET`

### 5. Get your Customer ID

The `CUSTOMER_ID` is **NOT** from the Developer Dashboard. It's your Uber Direct **organization/customer account ID**.

- Log into your **Uber Direct Business Dashboard** (different URL — usually provided by Uber when you sign up for Uber Direct)
- Or contact your Uber Direct account manager / support to get your Customer ID
- It looks like: `19a81c63-38e4-5b2b-98d6-2499a048b61a`

If you don't have a Customer ID yet, you may need to:
- Apply for Uber Direct at https://www.uber.com/us/en/business/solutions/uber-direct/
- Or work with an Uber sales rep to onboard your business

---

## What Each Credential Does

| Credential | Where it comes from | What it's for |
|---|---|---|
| `CLIENT_ID` | Uber Developer Dashboard → your app | Identifies your app to Uber's OAuth server |
| `CLIENT_SECRET` | Uber Developer Dashboard → your app | Proves you own the app (keep secret!) |
| `CUSTOMER_ID` | Uber Direct Business Dashboard / account manager | Identifies YOUR store/business to the delivery API |
| `WEBHOOK_SECRET` | Uber Direct Dashboard → Webhooks settings | Used to verify webhook signatures we receive |

---

## After You Update Credentials

1. Update `backend/.env` with the new values
2. Run the diagnostic script:
   ```bash
   cd backend
   node scripts/test-uber-direct-diagnose.js
   ```
3. Once that passes (token retrieved successfully), run the full test:
   ```bash
   node scripts/test-uber-direct-full.js
   ```

---

## Quick Checklist

- [ ] App created in https://developer.uber.com/dashboard
- [ ] Uber Direct product access requested (and approved by Uber)
- [ ] Client ID and Secret copied to `.env`
- [ ] Customer ID obtained from Uber Direct dashboard or support
- [ ] Webhook secret configured (for receiving delivery status updates)
- [ ] Diagnostic script returns "Token retrieved successfully"
