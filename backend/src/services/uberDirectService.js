const axios = require('axios');

class UberDirectService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.customerId = process.env.UBER_DIRECT_CUSTOMER_ID;
    this.baseUrl = `https://api.uber.com/v1/customers/${this.customerId}/deliveries`;
  }

  async getAccessToken() {
    // Return cached token if still valid (with 60s safety buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const response = await axios.post(
      'https://login.uber.com/oauth/v2/token',
      new URLSearchParams({
        client_id: process.env.UBER_DIRECT_CLIENT_ID,
        client_secret: process.env.UBER_DIRECT_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'eats.deliveries',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return this.accessToken;
  }

  formatPhone(phone) {
    if (!phone) return '+10000000000';
    const clean = phone.replace(/\D/g, '');
    return clean.startsWith('1') ? `+${clean}` : `+1${clean}`;
  }

  async createDelivery(orderData) {
    try {
      const token = await this.getAccessToken();

      const payload = {
        external_id: orderData.orderNo,
        pickup_address: '4521 W Coast Hwy, Newport Beach, CA 92663',
        pickup_business_name: 'Balport Liquors',
        pickup_phone_number: '+19496421921',
        dropoff_address: `${orderData.user.address}, ${orderData.user.city}, ${orderData.user.state} ${orderData.user.zip}`,
        dropoff_address_components: {
          street_address: orderData.user.address,
          city: orderData.user.city,
          state: orderData.user.state,
          zip_code: orderData.user.zip,
          country: 'US',
        },
        dropoff_contact_given_name: orderData.user.firstName,
        dropoff_contact_family_name: orderData.user.lastName,
        dropoff_phone_number: this.formatPhone(orderData.user.phone),
        dropoff_instructions: orderData.containsAlcohol
          ? 'Please hand to customer. SIGNATURE AND ID VERIFICATION REQUIRED. DO NOT LEAVE AT DOOR.'
          : 'Please hand to customer.',
        pickup_instructions: 'Please come to the main counter and ask for Balport Liquors online pickup.',
        order_value: Math.round(orderData.total * 100),
        manifest_items: orderData.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          description: item.name,
          price: Math.round((item.priceSale || item.price) * 100),
        })),
        manifest: {
          total_value: Math.round(orderData.total * 100),
        },
      };

      if (orderData.containsAlcohol) {
        payload.dropoff_verification = {
          identification: {
            enabled: true,
          },
        };
      }

      console.log('📦 Creating Uber Direct delivery for order:', payload.external_id);

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Uber Direct API Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async getDeliveryQuote(deliveryData) {
    try {
      const token = await this.getAccessToken();

      const payload = {
        external_id: 'QUOTE-' + Date.now(),
        pickup_address: '4521 W Coast Hwy, Newport Beach, CA 92663',
        pickup_phone_number: '+19496421921',
        dropoff_address: `${deliveryData.user.address}, ${deliveryData.user.city}, ${deliveryData.user.state} ${deliveryData.user.zip}`,
        dropoff_phone_number: this.formatPhone(deliveryData.user.phone),
        order_value: 1000, // Placeholder $10 for quote
        manifest_items: [
          {
            name: 'Quote Item',
            quantity: 1,
            description: 'Delivery quote',
            price: 1000,
          },
        ],
        manifest: {
          total_value: 1000,
        },
      };

      console.log('📦 Requesting Uber Direct delivery quote for:', payload.dropoff_address);

      const response = await axios.post(`${this.baseUrl}/quote`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Uber Direct Quote Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async cancelDelivery(externalDeliveryId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/${externalDeliveryId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Uber Direct Cancel Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async getDeliveryStatus(externalDeliveryId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/${externalDeliveryId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Uber Direct Status Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}

module.exports = new UberDirectService();
