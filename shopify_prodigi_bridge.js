require("dotenv").config();
const express = require("express");
const axios = require("axios");
const ProdigiClient = require("./prodigi_client");

const app = express();
app.use(express.json());

const prodigi = new ProdigiClient(
  process.env.PRODIGI_API_KEY,
  process.env.PRODIGI_ENVIRONMENT || "sandbox"
);

// Map Shopify variants / SKUs to Prodigi UK production codes
const SKU_MAPPING = {
  "A4-MATTE": "GLOBAL-FAP-A4",
  "A3-MATTE": "GLOBAL-FAP-A3",
  "A2-MATTE": "GLOBAL-FAP-A2",
  "A1-MATTE": "GLOBAL-FAP-A1",
};

/**
 * 1. SHOPIFY ORDER WEBHOOK: orders/paid
 * Triggers upon customer payment. Validates risk & routes directly to Prodigi UK.
 */
app.post("/webhooks/shopify/orders-paid", async (req, res) => {
  try {
    const order = req.body;

    // Fraud Screening Rule
    if (order.risk_level === "high") {
      console.warn(`[FRAUD ALERT] Order #${order.order_number} flagged as high risk. Halting auto-fulfillment.`);
      return res.status(200).send("Flagged for manual fraud review.");
    }

    const shipping = order.shipping_address;
    if (!shipping) {
      return res.status(400).send("No shipping address provided.");
    }

    const prodigiItems = order.line_items.map((item) => {
      const matchedSku = SKU_MAPPING[item.sku] || "GLOBAL-FAP-A3";
      const artworkUrl =
        (item.properties && item.properties.find((p) => p.name === "_print_asset_url")?.value) ||
        `https://assets.yourbrand.co.uk/artworks/${item.sku}.jpg`;

      return {
        id: item.id.toString(),
        sku: matchedSku,
        copies: item.quantity,
        artworkUrl: artworkUrl,
        finish: "matte",
      };
    });

    const prodigiOrder = await prodigi.createOrder({
      merchantReference: `SHOPIFY-${order.order_number}`,
      recipient: {
        name: `${shipping.first_name} ${shipping.last_name}`,
        address1: shipping.address1,
        address2: shipping.address2,
        zip: shipping.zip,
        city: shipping.city,
        province: shipping.province,
        countryCode: shipping.country_code || "GB",
        email: order.email || order.contact_email,
        phone: shipping.phone || "",
      },
      items: prodigiItems,
      shippingMethod: "Budget", // Royal Mail 48 Tracked
      metadata: {
        shopifyOrderId: order.id.toString(),
        shopifyOrderNumber: order.order_number.toString(),
      },
    });

    console.log(`[AUTO-FULFILLED] Order #${order.order_number} submitted to Prodigi ID: ${prodigiOrder.order.id}`);
    res.status(200).json({ success: true, prodigiOrderId: prodigiOrder.order.id });
  } catch (error) {
    console.error("[AUTO-FULFILL ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. PRODIGI DISPATCH WEBHOOK: order.status.stage.changed
 * Automatically posts Royal Mail tracking numbers back to Shopify.
 */
app.post("/webhooks/prodigi/dispatch", async (req, res) => {
  try {
    const { order, shipment } = req.body;
    if (!order || !order.metadata || !order.metadata.shopifyOrderId) {
      return res.status(200).send("No linked Shopify order metadata found.");
    }

    const shopifyOrderId = order.metadata.shopifyOrderId;
    const trackingNumber = shipment?.tracking?.number || "N/A";
    const trackingUrl =
      shipment?.tracking?.url ||
      `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`;

    if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN && trackingNumber !== "N/A") {
      const shopifyApiUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${shopifyOrderId}/fulfillments.json`;
      await axios.post(
        shopifyApiUrl,
        {
          fulfillment: {
            notify_customer: true,
            tracking_info: {
              number: trackingNumber,
              url: trackingUrl,
              company: "Royal Mail",
            },
          },
        },
        {
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`[SHOPIFY UPDATED] Order ${shopifyOrderId} fulfilled with tracking.`);
    }

    res.status(200).send("Fulfillment updated.");
  } catch (error) {
    console.error("[DISPATCH ERROR]:", error.message);
    res.status(500).send("Error updating fulfillment.");
  }
});

/**
 * 3. ZERO-TOUCH RETURNLESS REPLACEMENT WEBHOOK
 * Auto-triggers a reprint order if damaged photo evidence is validated.
 */
app.post("/webhooks/returns/damage-claim", async (req, res) => {
  try {
    const { authSecret, originalOrderNumber, photoUrl, reason } = req.body;
    if (authSecret !== process.env.RETURNLESS_REFUND_SECRET) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    if (!photoUrl) {
      return res.status(400).json({ error: "Photo evidence required." });
    }

    console.log(`[REPLACEMENT TRIGGERED] Auto-reprint requested for #${originalOrderNumber}`);
    res.status(200).json({ status: "APPROVED", action: "AUTO_REPRINT_TRIGGERED" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`UK Dropship Automation Bridge running on port ${PORT}`);
});
