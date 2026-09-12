const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const http = require("node:http");
const app = require("../shopify_prodigi_bridge");

test("Health Check Endpoint", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, "healthy");
    assert.strictEqual(body.service, "uk-dropship-automation-bridge");
  } finally {
    server.close();
  }
});

test("SKU Resolution", (t) => {
  assert.strictEqual(app.resolveProdigiSku("A4-MATTE"), "GLOBAL-FAP-A4");
  assert.strictEqual(app.resolveProdigiSku("MORRIS-A4-MATTE"), "GLOBAL-FAP-A4");
  assert.strictEqual(app.resolveProdigiSku("HOKUSAI-A3-MATTE"), "GLOBAL-FAP-A3");
  assert.strictEqual(app.resolveProdigiSku("KLIMT-A2-MATTE"), "GLOBAL-FAP-A2");
  assert.strictEqual(app.resolveProdigiSku("SCANDI-A1-MATTE"), "GLOBAL-FAP-A1");
  assert.strictEqual(app.resolveProdigiSku("UNKNOWN-SKU"), "GLOBAL-FAP-A3");
});

test("Artwork Asset URL Resolution", (t) => {
  // Custom print asset property takes precedence
  const itemWithCustomProp = {
    sku: "MORRIS-A3-MATTE",
    properties: [{ name: "_print_asset_url", value: "https://custom.cdn/asset.jpg" }],
  };
  assert.strictEqual(app.resolveArtworkUrl(itemWithCustomProp), "https://custom.cdn/asset.jpg");

  // Lookup by SKU prefix
  const itemHokusai = { sku: "HOKUSAI-A2-MATTE" };
  assert.strictEqual(app.resolveArtworkUrl(itemHokusai), app.ARTWORK_REGISTRY.HOKUSAI);

  const itemVanGogh = { sku: "VANGOGH-A4-MATTE" };
  assert.strictEqual(app.resolveArtworkUrl(itemVanGogh), app.ARTWORK_REGISTRY.VANGOGH);

  // Fallback for unregistered SKU
  const itemFallback = { sku: "CUSTOM-DESIGN-A3-MATTE" };
  assert.strictEqual(
    app.resolveArtworkUrl(itemFallback),
    "https://assets.yourbrand.co.uk/artworks/CUSTOM-DESIGN-A3-MATTE.jpg"
  );
});

test("Shopify Webhook HMAC Signature Validation", (t) => {
  const secret = "test_shopify_webhook_secret_key_12345";
  process.env.SHOPIFY_WEBHOOK_SECRET = secret;

  const rawPayload = JSON.stringify({ id: 12345, order_number: 1001 });
  const rawBuffer = Buffer.from(rawPayload, "utf8");

  const validHmac = crypto
    .createHmac("sha256", secret)
    .update(rawBuffer)
    .digest("base64");

  const mockReqValid = {
    get: (header) => (header.toLowerCase() === "x-shopify-hmac-sha256" ? validHmac : null),
    rawBody: rawBuffer,
  };
  assert.strictEqual(app.isValidShopifyWebhook(mockReqValid), true);

  const mockReqInvalid = {
    get: (header) => (header.toLowerCase() === "x-shopify-hmac-sha256" ? "wrong_hmac" : null),
    rawBody: rawBuffer,
  };
  assert.strictEqual(app.isValidShopifyWebhook(mockReqInvalid), false);

  // Restore env
  delete process.env.SHOPIFY_WEBHOOK_SECRET;
});

test("Zero-Touch Damage Replacement Endpoint Validation", async (t) => {
  process.env.RETURNLESS_REFUND_SECRET = "test_return_secret_999";
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Unauthorized request
    const unauthRes = await fetch(`http://127.0.0.1:${port}/webhooks/returns/damage-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authSecret: "wrong_secret" }),
    });
    assert.strictEqual(unauthRes.status, 401);

    // 2. Missing photo evidence
    const missingPhotoRes = await fetch(`http://127.0.0.1:${port}/webhooks/returns/damage-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authSecret: "test_return_secret_999",
        originalOrderNumber: 1001,
      }),
    });
    assert.strictEqual(missingPhotoRes.status, 400);

    // 3. Valid damage claim
    const validRes = await fetch(`http://127.0.0.1:${port}/webhooks/returns/damage-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authSecret: "test_return_secret_999",
        originalOrderNumber: 1001,
        photoUrl: "https://customer-uploads.tidio.co/claims/damaged_tube.jpg",
        reason: "Bent corner from transit",
      }),
    });
    assert.strictEqual(validRes.status, 200);
    const body = await validRes.json();
    assert.strictEqual(body.status, "APPROVED");
    assert.strictEqual(body.action, "AUTO_REPRINT_TRIGGERED");
  } finally {
    server.close();
    delete process.env.RETURNLESS_REFUND_SECRET;
  }
});
