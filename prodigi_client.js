const axios = require("axios");

class ProdigiClient {
  constructor(apiKey, environment = "sandbox") {
    this.apiKey = apiKey;
    this.baseUrl =
      environment === "live"
        ? "https://api.prodigi.com/v4.0"
        : "https://api.sandbox.prodigi.com/v4.0";
  }

  getHeaders() {
    return {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Submit an order directly to Prodigi UK for automatic printing & dispatch
   */
  async createOrder({
    merchantReference,
    recipient,
    items,
    shippingMethod = "Budget", // Budget in UK defaults to Royal Mail 48 Tracked
    metadata = {},
  }) {
    const payload = {
      shippingMethod,
      merchantReference,
      recipient: {
        name: recipient.name,
        address: {
          line1: recipient.address1,
          line2: recipient.address2 || "",
          postalOrZipCode: recipient.zip,
          countryCode: recipient.countryCode || "GB",
          townOrCity: recipient.city,
          stateOrCounty: recipient.province || "",
        },
        email: recipient.email,
        phoneNumber: recipient.phone || "",
      },
      items: items.map((item) => ({
        merchantReference: item.merchantReference || item.id,
        sku: item.sku,
        copies: item.copies || 1,
        sizing: "fillPrintArea",
        attributes: {
          finish: item.finish || "matte",
        },
        assets: [
          {
            printArea: "default",
            url: item.artworkUrl,
          },
        ],
      })),
      metadata,
    };

    try {
      const response = await axios.post(`${this.baseUrl}/orders`, payload, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      const errorDetails = error.response ? error.response.data : error.message;
      console.error("Prodigi Order Creation Error:", JSON.stringify(errorDetails, null, 2));
      throw new Error(`Failed to create Prodigi order: ${error.message}`);
    }
  }

  /**
   * Fetch real-time status of an order
   */
  async getOrder(orderId) {
    try {
      const response = await axios.get(`${this.baseUrl}/orders/${orderId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching Prodigi order ${orderId}:`, error.message);
      throw error;
    }
  }
}

module.exports = ProdigiClient;
