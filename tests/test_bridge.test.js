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

test("Storefront Catalog API Endpoint", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/products`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.products.length, 10);
    assert.strictEqual(data.sizes.length, 4);

    // Verify first product has required fields
    const firstProduct = data.products[0];
    assert.ok(firstProduct.code);
    assert.ok(firstProduct.title);
    assert.ok(firstProduct.image_url);
  } finally {
    server.close();
  }
});

test("Stripe Checkout Session Request Validation", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // Missing selection
    const badRes = await fetch(`http://127.0.0.1:${port}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artworkCode: "INVALID" }),
    });
    assert.strictEqual(badRes.status, 400);

    // Valid selection without configured stripe key should return 503 error
    // (unless dummy key is active)
    const validSelectionRes = await fetch(`http://127.0.0.1:${port}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artworkCode: "MORRIS", sizeId: "A3" }),
    });
    assert.ok([200, 503, 500].includes(validSelectionRes.status));
  } finally {
    server.close();
  }
});

test("Google Shopping Free XML Feed Endpoint", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/feeds/google-shopping.xml`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("xml"));
    const text = await res.text();
    assert.ok(text.includes("<rss version=\"2.0\" xmlns:g=\"http://base.google.com/ns/1.0\">"));
    assert.ok(text.includes("<g:brand>Heritage Fine Art UK</g:brand>"));
    assert.ok(text.includes("<g:price>18.99 GBP</g:price>"));
    assert.ok(text.includes("<g:service>Royal Mail 48 Tracked</g:service>"));
    assert.ok(text.includes("<g:shipping>"));
  } finally {
    server.close();
  }
});

test("Sitemap and Robots Endpoints", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const sitemapRes = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
    assert.strictEqual(sitemapRes.status, 200);
    const sitemapText = await sitemapRes.text();
    assert.ok(sitemapText.includes("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"));
    assert.ok(sitemapText.includes("/product/vintage-william-morris-strawberry-thief-botanical-print"));

    const robotsRes = await fetch(`http://127.0.0.1:${port}/robots.txt`);
    assert.strictEqual(robotsRes.status, 200);
    const robotsText = await robotsRes.text();
    assert.ok(robotsText.includes("Sitemap:"));
  } finally {
    server.close();
  }
});

test("Programmatic SEO Product Landing Page", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/product/vintage-william-morris-strawberry-thief-botanical-print`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("William Morris - Strawberry Thief Fine Art Print"));
    assert.ok(html.includes("application/ld+json"));
    assert.ok(html.includes("Heritage Fine Art UK"));
    assert.ok(html.includes("HERITAGE10"));
  } finally {
    server.close();
  }
});

test("Social Syndication Feed Endpoint", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/feeds/social.json`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.itemsCount, 10);
    assert.ok(data.posts[0].pinterestPin);
    assert.ok(data.posts[0].socialPost.x_twitter);
    assert.ok(data.posts[0].socialPost.instagram_caption);
  } finally {
    server.close();
  }
});


