const axios = require('axios');
const jwt = require('jsonwebtoken');

class DoorDashService {
  constructor() {
    this.developerId = process.env.DOORDASH_DEVELOPER_ID;
    this.keyId = process.env.DOORDASH_KEY_ID;
    this.signingSecret = process.env.DOORDASH_SIGNING_SECRET;
    this.baseUrl = 'https://openapi.doordash.com/drive/v2/deliveries';
    this.quoteUrl = 'https://openapi.doordash.com/drive/v2/quotes';
  }

  generateToken() {
    const data = {
      aud: 'doordash',
      iss: this.developerId,
      kid: this.keyId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes expiration
    };

    const header = {
      alg: 'HS256',
      typ: 'JWT',
      'dd-ver': 'DD-JWT-V1',
      kid: this.keyId,
    };

    // DoorDash signing secret needs to be base64url decoded
    const secret = Buffer.from(this.signingSecret, 'base64url');

    return jwt.sign(data, secret, { header });
  }

  formatPhone(phone) {
    if (!phone) return "+10000000000";
    const clean = phone.replace(/\D/g, '');
    return clean.startsWith('1') ? `+${clean}` : `+1${clean}`;
  }

  async createDelivery(orderData) {
    try {
      const token = this.generateToken();
      
      // Calculate pickup time (e.g., 15 minutes from now)
      const pickupTime = new Date();
      pickupTime.setMinutes(pickupTime.getMinutes() + 15);

      const payload = {
        external_delivery_id: orderData.orderNo,
        pickup_address: "4521 W Coast Hwy, Newport Beach, CA 92663",
        pickup_business_name: "Balport Liquors",
        pickup_phone_number: "+19496421921",
        dropoff_address: `${orderData.user.address}, ${orderData.user.city}, ${orderData.user.state} ${orderData.user.zip}`,
        dropoff_address_components: {
          street_address: orderData.user.address,
          city: orderData.user.city,
          state: orderData.user.state,
          zip_code: orderData.user.zip,
          country: "US"
        },
        dropoff_contact_given_name: orderData.user.firstName,
        dropoff_contact_family_name: orderData.user.lastName,
        dropoff_phone_number: this.formatPhone(orderData.user.phone),
        dropoff_instructions: orderData.containsAlcohol 
          ? "Please hand to customer. SIGNATURE AND ID VERIFICATION REQUIRED. DO NOT LEAVE AT DOOR." 
          : "Please hand to customer.",
        pickup_instructions: "Please come to the main counter and ask for Balport Liquors online pickup.",
        order_value: Math.round(orderData.total * 100),
        pickup_time: pickupTime.toISOString(),
        tip: Math.round((orderData.tip || 0) * 100), // DoorDash expects tip in cents
        contactless_dropoff: orderData.containsAlcohol ? false : true,
        items: orderData.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          description: item.name,
          price: Math.round((item.priceSale || item.price) * 100)
        })),
        order_contains: {
          alcohol: orderData.containsAlcohol || false
        },
        dropoff_options: {
          id_verification: orderData.containsAlcohol ? "required" : "none"
        },
        action_if_undeliverable: orderData.containsAlcohol ? "return_to_pickup" : "dispose"
      };

      console.log('📦 Creating DoorDash delivery for order:', payload.external_delivery_id);

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('DoorDash API Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async getDeliveryQuote(deliveryData) {
    try {
      const token = this.generateToken();

      const payload = {
        external_delivery_id: "QUOTE-" + Date.now(),
        pickup_address: "4521 W Coast Hwy, Newport Beach, CA 92663",
        pickup_phone_number: "+19496421921",
        dropoff_address: deliveryData.user.address + ", " + deliveryData.user.city + ", " + deliveryData.user.state + " " + deliveryData.user.zip,
        dropoff_phone_number: this.formatPhone(deliveryData.user.phone),
        order_value: 1000, // Placeholder 10$ for quote
        order_contains: {
          alcohol: deliveryData.containsAlcohol || false
        },
        action_if_undeliverable: deliveryData.containsAlcohol ? "return_to_pickup" : "dispose"
      };

      console.log('📦 Requesting DoorDash delivery quote for:', payload.dropoff_address);

      const response = await axios.post(this.quoteUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('DoorDash Quote Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async cancelDelivery(externalDeliveryId) {
    try {
      const token = this.generateToken();

      const response = await axios.put(
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
      console.error('DoorDash Cancel Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async getDeliveryStatus(externalDeliveryId) {
    try {
      const token = this.generateToken();

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
      console.error('DoorDash Status Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}

module.exports = new DoorDashService();
