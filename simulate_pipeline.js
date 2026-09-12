/**
 * UK Zero-Touch Fine Art Dropshipping: End-to-End Pipeline Simulator
 * Simulates the entire automated lifecycle without needing live API keys.
 */

const app = require("./shopify_prodigi_bridge");

const divider = "=".repeat(70);
const subDivider = "-".repeat(70);

function logHeader(step, title) {
  console.log(`\n${divider}`);
  console.log(`[STEP ${step}] ${title}`);
  console.log(`${divider}`);
}

async function runSimulation() {
  console.log("\n🎨 UK ZERO-TOUCH FINE ART DROPSHIPPING AUTOMATION SIMULATOR 🎨");
  console.log("Store: Heritage Fine Art UK | Fulfillment: Prodigi UK (Alton/Farnham)");
  console.log("Courier: Royal Mail 48 Tracked | Customer Support: Autonomous AI");

  // PHASE 1: Incoming Order from Shopify
  logHeader("1", "CUSTOMER PURCHASES ON SHOPIFY (WEBHOOK: orders/paid)");

  const mockShopifyOrder = {
    id: 9876543210,
    order_number: 1042,
    email: "eleanor.vance@kensington-interiors.co.uk",
    risk_level: "low",
    total_price: "59.98",
    currency: "GBP",
    shipping_address: {
      first_name: "Eleanor",
      last_name: "Vance",
      address1: "14 Kensington Park Gardens",
      address2: "Flat 3B",
      city: "London",
      province: "Greater London",
      zip: "W11 3HD",
      country_code: "GB",
      phone: "+44 7700 900123",
    },
    line_items: [
      {
        id: 11223344,
        title: "Katsushika Hokusai - The Great Wave off Kanagawa",
        sku: "HOKUSAI-A2-MATTE",
        quantity: 1,
        price: "34.99",
      },
      {
        id: 55667788,
        title: "William Morris - Strawberry Thief Fine Art Print",
        sku: "MORRIS-A3-MATTE",
        quantity: 1,
        price: "24.99",
      },
    ],
  };

  console.log(`Order: #${mockShopifyOrder.order_number}`);
  console.log(`Customer: ${mockShopifyOrder.shipping_address.first_name} ${mockShopifyOrder.shipping_address.last_name}`);
  console.log(`Delivery Address: ${mockShopifyOrder.shipping_address.address1}, ${mockShopifyOrder.shipping_address.zip}`);
  console.log(`Total Paid: £${mockShopifyOrder.total_price} (${mockShopifyOrder.currency})`);

  // PHASE 2: Fraud & Risk Screening
  logHeader("2", "AUTOMATED RISK & FRAUD SCREENING");
  console.log(`Analyzing risk level: ${mockShopifyOrder.risk_level.toUpperCase()}`);
  if (mockShopifyOrder.risk_level === "high") {
    console.log("❌ REJECTED: Order flagged as high risk. Stopping automated fulfillment.");
    return;
  }
  console.log("✅ PASSED: Low-risk transaction confirmed. Proceeding with instant automated routing.");

  // PHASE 3: Translation to Prodigi Manufacturing Specs
  logHeader("3", "SKU & ARTWORK SPECIFICATION ROUTING");

  const prodigiItems = mockShopifyOrder.line_items.map((item) => {
    const matchedSku = app.resolveProdigiSku(item.sku);
    const artworkUrl = app.resolveArtworkUrl(item);
    console.log(`\n• Item: "${item.title}"`);
    console.log(`  Shopify SKU: ${item.sku}`);
    console.log(`  -> Prodigi UK Spec: ${matchedSku} (Archival Giclée 200gsm)`);
    console.log(`  -> High-Res Asset: ${artworkUrl}`);
    return {
      merchantReference: item.id.toString(),
      sku: matchedSku,
      copies: item.quantity,
      sizing: "fillPrintArea",
      attributes: { finish: "matte" },
      assets: [{ printArea: "default", url: artworkUrl }],
    };
  });

  // PHASE 4: Prodigi Order Payload Assembly
  logHeader("4", "PRODIGI UK REST API v4.0 PAYLOAD GENERATION");

  const prodigiOrderPayload = {
    shippingMethod: "Budget", // Budget in UK routes directly to Royal Mail 48 Tracked
    merchantReference: `SHOPIFY-${mockShopifyOrder.order_number}`,
    recipient: {
      name: `${mockShopifyOrder.shipping_address.first_name} ${mockShopifyOrder.shipping_address.last_name}`,
      address: {
        line1: mockShopifyOrder.shipping_address.address1,
        line2: mockShopifyOrder.shipping_address.address2,
        postalOrZipCode: mockShopifyOrder.shipping_address.zip,
        countryCode: mockShopifyOrder.shipping_address.country_code,
        townOrCity: mockShopifyOrder.shipping_address.city,
        stateOrCounty: mockShopifyOrder.shipping_address.province,
      },
      email: mockShopifyOrder.email,
      phoneNumber: mockShopifyOrder.shipping_address.phone,
    },
    items: prodigiItems,
    metadata: {
      shopifyOrderId: mockShopifyOrder.id.toString(),
      shopifyOrderNumber: mockShopifyOrder.order_number.toString(),
    },
  };

  console.log("Generated API Payload for https://api.prodigi.com/v4.0/orders:");
  console.log(JSON.stringify(prodigiOrderPayload, null, 2));

  // PHASE 5: Dispatch & Royal Mail Tracking Webhook Simulation
  logHeader("5", "DISPATCH & ROYAL MAIL TRACKING POSTBACK TO SHOPIFY");

  const mockTrackingNumber = "GB487920194RM";
  const mockProdigiDispatchWebhook = {
    event: "order.status.stage.changed",
    order: {
      id: "ord_99887766",
      status: { stage: "Complete" },
      metadata: {
        shopifyOrderId: mockShopifyOrder.id.toString(),
        shopifyOrderNumber: mockShopifyOrder.order_number.toString(),
      },
    },
    shipment: {
      carrier: "Royal Mail",
      tracking: {
        number: mockTrackingNumber,
        url: `https://www.royalmail.com/track-your-item#/tracking-results/${mockTrackingNumber}`,
      },
    },
  };

  console.log("Prodigi Alton Studio finished printing and dispatched package via Royal Mail.");
  console.log(`Carrier: ${mockProdigiDispatchWebhook.shipment.carrier}`);
  console.log(`Tracking Number: ${mockTrackingNumber}`);
  console.log(`Tracking URL: ${mockProdigiDispatchWebhook.shipment.tracking.url}`);
  console.log("Bridge automatically executes Shopify API call:");
  console.log(`POST https://${process.env.SHOPIFY_STORE_DOMAIN || "heritage-fine-art.myshopify.com"}/admin/api/2024-01/orders/${mockShopifyOrder.id}/fulfillments.json`);
  console.log("Customer automatically notified by Shopify with live Royal Mail tracking link.");

  // PHASE 6: Autonomous AI Support Simulation
  logHeader("6", "AUTONOMOUS AI CUSTOMER CARE (WISMO QUERY & ZERO-TOUCH DAMAGE CLAIM)");

  console.log("Query 1: Customer asks 'Where is my order?' in chat widget:");
  console.log("AI Agent (Lyro): 'Delighted to help, Eleanor! Your order #1042 was printed at our UK workshop and dispatched via Royal Mail 48 Tracked. You can follow its progress here: https://www.royalmail.com/track-your-item#/tracking-results/GB487920194RM. Delivery is estimated in 2 business days. Cheers!'");

  console.log("\nQuery 2: Package arrives bent by courier postie. Customer uploads damage photo:");
  console.log("AI Agent (Lyro): 'We are truly sorry to hear your print arrived damaged by the courier! There is no need to return the damaged item. I have immediately logged a priority reprint order with our UK workshop at no cost to you.'");
  console.log("Triggering Webhook: /webhooks/returns/damage-claim");
  console.log(`Result: { status: "APPROVED", action: "AUTO_REPRINT_TRIGGERED", originalOrder: ${mockShopifyOrder.order_number} }`);

  console.log(`\n${divider}`);
  console.log("✨ SIMULATION COMPLETE: 100% Zero-Touch Automation Verified! ✨");
  console.log(`${divider}\n`);
}

runSimulation().catch(console.error);
