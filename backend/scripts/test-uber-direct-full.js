require('dotenv').config();
const axios = require('axios');

const CUSTOMER_ID = process.env.UBER_DIRECT_CUSTOMER_ID;
const CLIENT_ID = process.env.UBER_DIRECT_CLIENT_ID;
const CLIENT_SECRET = process.env.UBER_DIRECT_CLIENT_SECRET;

const BASE_URL = `https://api.uber.com/v1/customers/${CUSTOMER_ID}/deliveries`;
const QUOTE_URL = `https://api.uber.com/v1/customers/${CUSTOMER_ID}/delivery_quotes`;
const AUTH_URL = 'https://login.uber.com/oauth/v2/token';

// ─── Test Data ──────────────────────────────────────────────────────────────
const TEST_ORDER_NO = 'TEST-' + Date.now();
const TEST_ADDRESS = {
  firstName: 'Test',
  lastName: 'User',
  phone: '+15555555555',
  address: '30 Lincoln Center Plaza',
  city: 'New York',
  state: 'NY',
  zip: '10023',
};

let accessToken = null;
let testDeliveryId = null;

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getAccessToken() {
  console.log('\n🔑 [1/5] Testing OAuth2 Token Retrieval...\n');
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

    accessToken = response.data.access_token;
    console.log('✅ Token retrieved successfully');
    console.log('   Token type:', response.data.token_type);
    console.log('   Expires in:', response.data.expires_in, 'seconds');
    console.log('   Scope:', response.data.scope);
    return accessToken;
  } catch (err) {
    console.error('❌ Token retrieval failed:', err.response?.status, err.response?.data || err.message);
    throw err;
  }
}

async function testDeliveryQuote() {
  console.log('\n📦 [2/5] Testing Delivery Quote...\n');
  try {
    const payload = {
      external_id: 'QUOTE-' + Date.now(),
      pickup_address: '4521 W Coast Hwy, Newport Beach, CA 92663',
      pickup_phone_number: '+19496421921',
      dropoff_address: `${TEST_ADDRESS.address}, ${TEST_ADDRESS.city}, ${TEST_ADDRESS.state} ${TEST_ADDRESS.zip}`,
      dropoff_phone_number: TEST_ADDRESS.phone,
      order_value: 1000,
      manifest_items: [{ name: 'Test Item', quantity: 1, description: 'Delivery quote test', price: 1000 }],
      manifest: { total_value: 1000 },
    };

    const response = await axios.post(QUOTE_URL, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    const quote = response.data;
    console.log('✅ Quote retrieved successfully');
    console.log('   Quote ID:', quote.quote_id || quote.id);
    console.log('   Fee:', quote.fee ? `$${(quote.fee / 100).toFixed(2)}` : 'N/A');
    console.log('   Currency:', quote.currency);
    console.log('   ETA:', quote.dropoff_eta || 'N/A');
    return quote;
  } catch (err) {
    console.error('❌ Quote failed:', err.response?.status, JSON.stringify(err.response?.data || err.message).substring(0, 500));
    throw err;
  }
}

async function testCreateDeliveryWithRoboCourier() {
  console.log('\n🤖 [3/5] Creating Test Delivery with Robo Courier (auto mode)...\n');
  try {
    const payload = {
      external_id: TEST_ORDER_NO,
      pickup_address: '4521 W Coast Hwy, Newport Beach, CA 92663',
      pickup_business_name: 'Balport Liquors',
      pickup_phone_number: '+19496421921',
      dropoff_address: `${TEST_ADDRESS.address}, ${TEST_ADDRESS.city}, ${TEST_ADDRESS.state} ${TEST_ADDRESS.zip}`,
      dropoff_address_components: {
        street_address: TEST_ADDRESS.address,
        city: TEST_ADDRESS.city,
        state: TEST_ADDRESS.state,
        zip_code: TEST_ADDRESS.zip,
        country: 'US',
      },
      dropoff_contact_given_name: TEST_ADDRESS.firstName,
      dropoff_contact_family_name: TEST_ADDRESS.lastName,
      dropoff_phone_number: TEST_ADDRESS.phone,
      dropoff_instructions: 'Please hand to customer. TEST ORDER — Robo Courier.',
      pickup_instructions: 'Please come to the main counter and ask for Balport Liquors online pickup.',
      order_value: 1000,
      manifest_items: [
        { name: 'Test Wine', quantity: 1, description: 'Testing Uber Direct', price: 1000 },
      ],
      manifest: { total_value: 1000 },
      // Enable Robo Courier for automated testing
      test_specifications: {
        robo_courier_specification: {
          mode: 'auto',
        },
      },
    };

    const response = await axios.post(BASE_URL, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    const delivery = response.data;
    testDeliveryId = delivery.delivery_id || delivery.id;
    console.log('✅ Delivery created successfully');
    console.log('   Delivery ID:', testDeliveryId);
    console.log('   Tracking URL:', delivery.tracking_url || 'N/A');
    console.log('   Status:', delivery.status);
    console.log('   External ID:', delivery.external_id);
    console.log('   Live Mode:', delivery.live_mode);
    console.log('   Fee:', delivery.fee ? `$${(delivery.fee / 100).toFixed(2)}` : 'N/A');
    console.log('   Estimated Pickup:', delivery.pickup_time_estimated || 'N/A');
    console.log('   Estimated Dropoff:', delivery.dropoff_time_estimated || 'N/A');

    return delivery;
  } catch (err) {
    console.error('❌ Delivery creation failed:', err.response?.status, JSON.stringify(err.response?.data || err.message).substring(0, 800));
    throw err;
  }
}

async function pollDeliveryStatus(iterations = 6, delayMs = 30000) {
  console.log(`\n🔄 [4/5] Polling delivery status (${iterations} times, every ${delayMs / 1000}s)...\n`);

  for (let i = 0; i < iterations; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/${testDeliveryId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });

      const d = response.data;
      const status = d.status;
      const courier = d.courier ? `${d.courier.name} (${d.courier.vehicle_type})` : 'Not assigned yet';

      console.log(`   [Poll ${i + 1}/${iterations}] Status: ${status} | Courier: ${courier}`);

      if (status === 'delivered') {
        console.log('\n✅ Delivery completed!');
        return d;
      }
      if (status === 'canceled' || status === 'returned') {
        console.log('\n⚠️ Delivery ended with status:', status);
        return d;
      }
    } catch (err) {
      console.error(`   [Poll ${i + 1}] Error:`, err.response?.status, err.response?.data?.message || err.message);
    }

    if (i < iterations - 1) {
      console.log(`   ... waiting ${delayMs / 1000}s ...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log('\n⏱️ Polling complete — delivery may still be in progress.');
  return null;
}

async function testCancelDelivery() {
  console.log('\n🚫 [5/5] Testing Delivery Cancellation...\n');
  try {
    const response = await axios.post(
      `${BASE_URL}/${testDeliveryId}/cancel`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    console.log('✅ Delivery cancelled successfully');
    console.log('   Response:', JSON.stringify(response.data, null, 2).substring(0, 300));
    return response.data;
  } catch (err) {
    // Cancellation may fail if already delivered/cancelled — that's expected
    console.error('❌ Cancel failed:', err.response?.status, JSON.stringify(err.response?.data || err.message).substring(0, 300));
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Uber Direct Integration Test Suite');
  console.log('   Order No:', TEST_ORDER_NO);
  console.log('   Customer ID:', CUSTOMER_ID);
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    await getAccessToken();
    await testDeliveryQuote();
    await testCreateDeliveryWithRoboCourier();

    // Poll status — with Robo Courier auto mode, delivery completes in ~2.5 min
    const finalStatus = await pollDeliveryStatus(6, 30000);

    // If not delivered after polling, try to cancel
    if (!finalStatus || (finalStatus.status !== 'delivered' && finalStatus.status !== 'canceled')) {
      await testCancelDelivery();
    } else {
      console.log('\n⏭️ Skipping cancellation — delivery already in terminal state.');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   ✅ All tests completed');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('\n═══════════════════════════════════════════════════════════════');
    console.error('   ❌ Test suite failed');
    console.error('═══════════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

runTests();
