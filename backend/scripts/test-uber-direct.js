require('dotenv').config();
const axios = require('axios');

async function testDirectSpecificToken() {
  console.log('🔍 Testing Uber Direct sandbox/production token endpoints...\n');

  // Some Uber products use different auth endpoints entirely
  const endpoints = [
    'https://login.uber.com/oauth/v2/token',
    'https://auth.uber.com/oauth/v2/token',
    'https://api.uber.com/v1/auth/token',
  ];

  for (const ep of endpoints) {
    console.log(`Testing ${ep}...`);
    try {
      const response = await axios.post(
        ep,
        new URLSearchParams({
          client_id: process.env.UBER_DIRECT_CLIENT_ID,
          client_secret: process.env.UBER_DIRECT_CLIENT_SECRET,
          grant_type: 'client_credentials',
          scope: 'eats.deliveries',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
      );
      console.log('✅ SUCCESS:', JSON.stringify(response.data, null, 2).substring(0, 300));
    } catch (err) {
      console.log('❌', err.response?.status, JSON.stringify(err.response?.data || err.message).substring(0, 200));
    }
    console.log();
  }
}

testDirectSpecificToken();
