require('dotenv').config();
const axios = require('axios');

const CLIENT_ID = process.env.UBER_DIRECT_CLIENT_ID;
const CLIENT_SECRET = process.env.UBER_DIRECT_CLIENT_SECRET;
const CUSTOMER_ID = process.env.UBER_DIRECT_CUSTOMER_ID;

const AUTH_URL = 'https://login.uber.com/oauth/v2/token';
const BASE_URL = `https://api.uber.com/v1/customers/${CUSTOMER_ID}/deliveries`;

async function diagnose() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Uber Direct Diagnostic Tool');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check env vars
  console.log('🔍 Environment Variables:');
  console.log('   UBER_DIRECT_CLIENT_ID:', CLIENT_ID ? '✅ set' : '❌ missing');
  console.log('   UBER_DIRECT_CLIENT_SECRET:', CLIENT_SECRET ? '✅ set' : '❌ missing');
  console.log('   UBER_DIRECT_CUSTOMER_ID:', CUSTOMER_ID ? '✅ set' : '❌ missing');
  console.log();

  if (!CLIENT_ID || !CLIENT_SECRET || !CUSTOMER_ID) {
    console.log('❌ Missing required environment variables. Please check your .env file.\n');
    process.exit(1);
  }

  // 2. Test OAuth2 token
  console.log('🔑 Testing OAuth2 Token...');
  let token = null;
  try {
    const response = await axios.post(
      AUTH_URL,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'eats.deliveries',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );
    token = response.data.access_token;
    console.log('✅ Token retrieved successfully');
    console.log('   Expires in:', response.data.expires_in, 'seconds');
  } catch (err) {
    const data = err.response?.data;
    if (data?.error === 'invalid_scope') {
      console.log('❌ INVALID SCOPE — Your Uber app exists but is NOT provisioned for Uber Direct.');
      console.log('   → Go to https://developer.uber.com/dashboard and request "Uber Direct" API access.\n');
    } else if (data?.error === 'invalid_client') {
      console.log('❌ INVALID CLIENT — Your CLIENT_ID or CLIENT_SECRET is incorrect.\n');
    } else {
      console.log('❌ Token error:', data?.error, '-', data?.error_description, '\n');
    }
    process.exit(1);
  }

  // 3. Test delivery endpoint access
  console.log('\n📦 Testing Delivery API Access...');
  try {
    const response = await axios.get(BASE_URL, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    console.log('✅ Delivery API is accessible');
    console.log('   Deliveries:', Array.isArray(response.data) ? response.data.length : 'N/A');
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      console.log('❌ 403 Forbidden — Token works but customer ID lacks delivery permissions.\n');
    } else if (status === 404) {
      console.log('❌ 404 Not Found — Customer ID may be incorrect.\n');
    } else {
      console.log('❌ Error:', status, JSON.stringify(err.response?.data).substring(0, 300), '\n');
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Diagnostics complete');
  console.log('═══════════════════════════════════════════════════════════════');
}

diagnose();
