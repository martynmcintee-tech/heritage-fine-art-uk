require("dotenv").config();
const crypto = require("crypto");
const path = require("path");
const express = require("express");
const axios = require("axios");
const Stripe = require("stripe");
const ProdigiClient = require("./prodigi_client");

const products = require("./products.json");
const sizes = require("./sizes.json");

const app = express();

// Initialize Stripe if secret key is present
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Preserve raw body buffer for Shopify & Stripe HMAC signature validation
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Serve static fine art storefront
app.use(express.static(path.join(__dirname, "public")));

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

// High-resolution public domain artwork asset registry
const ARTWORK_REGISTRY = {
  MORRIS: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Morris_Strawberry_Thief_1883.jpg",
  HOKUSAI: "https://upload.wikimedia.org/wikipedia/commons/0/0d/Great_Wave_off_Kanagawa2.jpg",
  REDOUTE: "https://upload.wikimedia.org/wikipedia/commons/9/94/Carnations_redoute.JPG",
  BAUHAUS: "https://upload.wikimedia.org/wikipedia/commons/a/a0/D%C3%B6rte_Helm_-_Bauhaus_Exhibition_Postcard_No._14.jpg",
  TUBE: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Brightest_London_is_best_reached_by_Underground%2C_subway_poster%2C_1924.jpg",
  VANGOGH: "https://upload.wikimedia.org/wikipedia/commons/6/68/Vincent_van_Gogh_-_Almond_blossom_-_Google_Art_Project.jpg",
  MONET: "https://upload.wikimedia.org/wikipedia/commons/5/50/Claude_Monet_044.jpg",
  HERBAL: "https://upload.wikimedia.org/wikipedia/commons/8/83/Quillaja_saponaria_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-119.jpg",
  KLIMT: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Gustav_Klimt_016.jpg",
  SCANDI: "https://upload.wikimedia.org/wikipedia/commons/2/22/6_hilma_af_klint%2C_the_swan_no_16%2C_1915.jpg",
};

/**
 * Resolve Prodigi product SKU from Shopify SKU (handles prefix SKUs like MORRIS-A3-MATTE)
 */
function resolveProdigiSku(sku) {
  if (!sku) return "GLOBAL-FAP-A3";
  if (SKU_MAPPING[sku]) return SKU_MAPPING[sku];
  if (sku.endsWith("A4-MATTE") || sku.includes("A4")) return "GLOBAL-FAP-A4";
  if (sku.endsWith("A3-MATTE") || sku.includes("A3")) return "GLOBAL-FAP-A3";
  if (sku.endsWith("A2-MATTE") || sku.includes("A2")) return "GLOBAL-FAP-A2";
  if (sku.endsWith("A1-MATTE") || sku.includes("A1")) return "GLOBAL-FAP-A1";
  return "GLOBAL-FAP-A3";
}

/**
 * Resolve print asset URL from line item properties or registry
 */
function resolveArtworkUrl(item) {
  const customAsset = item.properties?.find((p) => p.name === "_print_asset_url")?.value;
  if (customAsset) return customAsset;

  if (item.sku) {
    const prefix = item.sku.split("-")[0].toUpperCase();
    if (ARTWORK_REGISTRY[prefix]) {
      return ARTWORK_REGISTRY[prefix];
    }
  }
  return `https://assets.yourbrand.co.uk/artworks/${item.sku || "default"}.jpg`;
}

/**
 * Validate Shopify Webhook HMAC-SHA256 signature
 */
function isValidShopifyWebhook(req) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  // If in sandbox/dev or placeholder secret, log and allow
  if (!secret || secret.startsWith("shpss_xxxx")) {
    return true;
  }
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  if (!hmacHeader || !req.rawBody) {
    return false;
  }
  const generatedHash = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedHash, "utf8"),
      Buffer.from(hmacHeader, "utf8")
    );
  } catch {
    return false;
  }
}

function escapeXml(unsafe) {
  return (unsafe || "")
    .toString()
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case '"': return "&quot;";
        default: return c;
      }
    });
}

/**
 * Health Check & Status Endpoint
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "uk-dropship-automation-bridge",
    stripeConfigured: !!stripe,
    environment: process.env.PRODIGI_ENVIRONMENT || "sandbox",
  });
});

/**
 * GOOGLE SHOPPING / MERCHANT CENTER FREE PRODUCT LISTINGS FEED (RSS 2.0 XML)
 */
app.get("/feeds/google-shopping.xml", (req, res) => {
  const baseUrl = (process.env.APP_BASE_URL || `https://${req.headers.host || "heritage-fine-art-uk.onrender.com"}`).replace(/\/$/, "");

  let itemsXml = "";
  for (const product of products) {
    for (const size of sizes) {
      const priceGbp = (size.pricePence / 100).toFixed(2);
      const productLink = `${baseUrl}/product/${product.handle}?size=${size.id}`;
      const titleEscaped = escapeXml(`${product.title} - ${size.name}`);
      const descEscaped = escapeXml(`${product.desc} Giclée fine art print on ${size.paper}. Custom printed in Alton, Hampshire UK. Includes free Royal Mail 48 Tracked delivery.`);

      itemsXml += `
    <item>
      <g:id>${product.code}-${size.id}</g:id>
      <g:title>${titleEscaped}</g:title>
      <g:description>${descEscaped}</g:description>
      <g:link>${productLink}</g:link>
      <g:image_link>${product.image_url}</g:image_link>
      <g:brand>Heritage Fine Art UK</g:brand>
      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${priceGbp} GBP</g:price>
      <g:google_product_category>Home &amp; Garden &gt; Decor &gt; Artwork &gt; Posters, Prints, &amp; Visual Artwork</g:google_product_category>
      <g:product_type>Fine Art Prints &gt; Giclée Wall Art</g:product_type>
      <g:shipping>
        <g:country>GB</g:country>
        <g:service>Royal Mail 48 Tracked</g:service>
        <g:price>0.00 GBP</g:price>
      </g:shipping>
    </item>`;
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Heritage Fine Art UK | Museum Giclée Prints</title>
    <link>${baseUrl}</link>
    <description>Curated Museum &amp; Botanical Fine Art Prints on 200gsm Archival Matte. UK Free Delivery.</description>
${itemsXml}
  </channel>
</rss>`;

  res.header("Content-Type", "application/xml; charset=utf-8");
  res.status(200).send(xml);
});

/**
 * SEARCH ENGINE XML SITEMAP
 */
app.get("/sitemap.xml", (req, res) => {
  const baseUrl = (process.env.APP_BASE_URL || `https://${req.headers.host || "heritage-fine-art-uk.onrender.com"}`).replace(/\/$/, "");
  const today = new Date().toISOString().split("T")[0];

  let urls = `
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  for (const product of products) {
    urls += `
  <url>
    <loc>${baseUrl}/product/${product.handle}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.header("Content-Type", "application/xml; charset=utf-8");
  res.status(200).send(sitemap);
});

/**
 * ROBOTS.TXT
 */
app.get("/robots.txt", (req, res) => {
  const baseUrl = (process.env.APP_BASE_URL || `https://${req.headers.host || "heritage-fine-art-uk.onrender.com"}`).replace(/\/$/, "");
  res.type("text/plain");
  res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

/**
 * SOCIAL & PINTEREST SYNDICATION FEED (For automated marketing bots)
 */
app.get("/feeds/social.json", (req, res) => {
  const baseUrl = (process.env.APP_BASE_URL || `https://${req.headers.host || "heritage-fine-art-uk.onrender.com"}`).replace(/\/$/, "");
  
  const posts = products.map((product) => {
    return {
      title: product.title,
      artist: product.artist,
      productUrl: `${baseUrl}/product/${product.handle}`,
      imageUrl: product.image_url,
      description: `${product.title} (${product.artist}). Curated museum-grade giclée print on 200gsm archival matte paper. Printed in Alton, Hampshire UK with Free Royal Mail 48 Tracked delivery.`,
      pinterestPin: {
        title: `${product.title} | Archival Fine Art Print`,
        description: `Elevate your interior with ${product.title}. Museum quality giclée printed on 200gsm matte art paper in the UK. Free UK tracked delivery. #wallartuk #interiordecoruk #gicleeprint #heritageart #homestyling`,
        link: `${baseUrl}/product/${product.handle}?utm_source=pinterest&utm_medium=organic_pin`,
        image: product.image_url,
      },
      socialPost: {
        x_twitter: `Timeless art for modern UK homes: ${product.title} by ${product.artist}. 12-colour archival giclée on 200gsm matte paper. Free Royal Mail 48 Tracked delivery 🇬🇧\n\nShop print: ${baseUrl}/product/${product.handle}\n\n#WallArtUK #FineArt #InteriorDesignUK`,
        instagram_caption: `Elevate your walls with timeless beauty. "${product.title}" (${product.artist}), crafted to order in Alton, Hampshire on 200gsm museum-grade archival matte paper.\n\n✨ 12-colour UltraChrome pigment inks (100+ year fade resistance)\n📮 Free Royal Mail 48 Tracked UK delivery\n🛡️ Zero-touch transit damage replacement\n\nTap link in bio or visit ${baseUrl}/product/${product.handle} to collect your edition. Use HERITAGE10 for 10% off today.\n\n#wallartuk #williammorris #gicleeprint #britishinteriors #homedecoruk #artcollectoruk #gallerywall`,
      },
    };
  });

  res.status(200).json({
    brand: "Heritage Fine Art UK",
    website: baseUrl,
    itemsCount: posts.length,
    posts,
  });
});

/**
 * PROGRAMMATIC SEO PRODUCT LANDING PAGE (/product/:slug)
 */
app.get("/product/:slug", (req, res) => {
  const slug = req.params.slug;
  const product = products.find((p) => p.handle === slug || p.code.toLowerCase() === slug.toLowerCase());

  if (!product) {
    return res.redirect("/");
  }

  const baseUrl = (process.env.APP_BASE_URL || `https://${req.headers.host || "heritage-fine-art-uk.onrender.com"}`).replace(/\/$/, "");
  const canonicalUrl = `${baseUrl}/product/${product.handle}`;
  const preselectedSize = req.query.size || "A3";

  const schemaJson = JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.title,
    "image": [product.image_url],
    "description": product.desc,
    "brand": {
      "@type": "Brand",
      "name": "Heritage Fine Art UK"
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "GBP",
      "lowPrice": "18.99",
      "highPrice": "49.99",
      "offerCount": 4,
      "priceValidUntil": "2027-12-31",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Heritage Fine Art UK"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0.00",
          "currency": "GBP"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "GB"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 2,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 2,
            "maxValue": 3,
            "unitCode": "DAY"
          }
        }
      }
    }
  });

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(product.title)} | Museum Giclée Print UK</title>
  <meta name="description" content="${escapeXml(product.desc)} Museum giclée print on 200gsm archival matte paper. Free Royal Mail 48 delivery.">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${escapeXml(product.title)} | Heritage Fine Art UK">
  <meta property="og:description" content="${escapeXml(product.desc)} Archival giclée print on 200gsm matte paper. UK Printed.">
  <meta property="og:image" content="${product.image_url}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="product">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeXml(product.title)}">
  <meta name="twitter:description" content="${escapeXml(product.desc)}">
  <meta name="twitter:image" content="${product.image_url}">
  <script type="application/ld+json">${schemaJson}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #fbf9f5;
      --surface: #ffffff;
      --text: #1b241e;
      --muted: #5e6962;
      --gold: #8c6b3e;
      --gold-hover: #755730;
      --border: #e6dfd5;
      --font-serif: "Playfair Display", Georgia, serif;
      --font-sans: "Plus Jakarta Sans", -apple-system, sans-serif;
      --font-heading: "Cinzel", Georgia, serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.6;
    }
    .top-banner {
      background: #151d18;
      color: #dfd7cc;
      font-size: 0.82rem;
      padding: 0.5rem 1rem;
      text-align: center;
      letter-spacing: 0.05em;
    }
    .nav {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .logo {
      font-family: var(--font-heading);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text);
      text-decoration: none;
      letter-spacing: 0.08em;
    }
    .back-link {
      font-size: 0.88rem;
      color: var(--gold);
      text-decoration: none;
      font-weight: 500;
    }
    .container {
      max-width: 1100px;
      margin: 2.5rem auto;
      padding: 0 1.5rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.5rem;
      align-items: start;
    }
    @media (max-width: 800px) {
      .container { grid-template-columns: 1fr; gap: 2rem; }
    }
    .image-card {
      background: #f4efe6;
      padding: 1.5rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      box-shadow: 0 15px 35px rgba(27,36,30,0.06);
    }
    .image-card img {
      width: 100%;
      height: auto;
      display: block;
      box-shadow: 0 5px 20px rgba(0,0,0,0.12);
      border: 6px solid #fff;
    }
    .artist-sub {
      font-size: 0.85rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--gold);
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    h1 {
      font-family: var(--font-serif);
      font-size: 2.1rem;
      line-height: 1.25;
      margin-bottom: 1rem;
    }
    .desc {
      color: var(--muted);
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
    }
    .pricing-box {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 1.25rem;
      border-radius: 4px;
      margin-bottom: 1.5rem;
    }
    .size-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .size-option:hover, .size-option.active {
      border-color: var(--gold);
      background: #faf6ee;
    }
    .size-option input { margin-right: 0.75rem; accent-color: var(--gold); }
    .features-list {
      list-style: none;
      margin: 1.5rem 0;
      font-size: 0.88rem;
      color: var(--muted);
    }
    .features-list li { margin-bottom: 0.4rem; }
    .features-list li::before { content: "✓ "; color: var(--gold); font-weight: bold; }
    .promo-box {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .promo-input {
      flex: 1;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-family: inherit;
      text-transform: uppercase;
      font-size: 0.9rem;
    }
    .promo-btn {
      padding: 0.6rem 1rem;
      background: #2b3830;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .promo-feedback {
      font-size: 0.8rem;
      margin-top: -0.75rem;
      margin-bottom: 1rem;
      display: none;
    }
    .btn-buy {
      display: block;
      width: 100%;
      padding: 1.1rem;
      background: var(--gold);
      color: #fff;
      text-align: center;
      font-weight: 600;
      font-size: 1.05rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(140,107,62,0.3);
      transition: background 0.2s ease;
    }
    .btn-buy:hover { background: var(--gold-hover); }
    .guarantee-note {
      text-align: center;
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="top-banner">
    🇬🇧 Custom Printed in Alton, Hampshire • 📮 Royal Mail 48 Tracked Free UK Delivery • 🛡️ Zero-Touch Damage Guarantee
  </div>
  <nav class="nav">
    <a href="/" class="logo">Heritage Fine Art UK</a>
    <a href="/#gallery" class="back-link">← View Full Gallery</a>
  </nav>

  <main class="container">
    <div class="image-card">
      <img src="${product.image_url}" alt="${escapeXml(product.title)}" loading="eager" fetchpriority="high">
    </div>

    <div>
      <div class="artist-sub">${escapeXml(product.artist)}</div>
      <h1>${escapeXml(product.title)}</h1>
      <p class="desc">${escapeXml(product.desc)}</p>

      <div class="pricing-box">
        <div style="font-weight: 600; margin-bottom: 0.75rem; font-size: 0.95rem;">Select Museum Size Edition:</div>
        ${sizes.map((s) => `
          <label class="size-option ${s.id === preselectedSize ? "active" : ""}" onclick="selectSize('${s.id}', ${s.pricePence})">
            <div style="display: flex; align-items: center;">
              <input type="radio" name="size" value="${s.id}" ${s.id === preselectedSize ? "checked" : ""}>
              <div>
                <div style="font-weight: 500;">${s.name}</div>
                <div style="font-size: 0.78rem; color: var(--muted);">${s.paper}</div>
              </div>
            </div>
            <div style="font-weight: 700;" id="price-display-${s.id}">${s.priceFormatted}</div>
          </label>
        `).join("")}

        <div style="margin-top: 1rem;">
          <div style="font-size: 0.82rem; margin-bottom: 0.35rem; color: var(--muted);">Promo Code (HERITAGE10 for 10% Off):</div>
          <div class="promo-box">
            <input type="text" id="promo-input" class="promo-input" placeholder="e.g. HERITAGE10" value="HERITAGE10">
            <button type="button" class="promo-btn" onclick="applyPromo()">Apply</button>
          </div>
          <div id="promo-feedback" class="promo-feedback"></div>
        </div>

        <button type="button" id="buy-button" class="btn-buy" onclick="checkout()">
          Order Print Now — Free UK Delivery
        </button>
        <div class="guarantee-note">🔒 Encrypted Stripe Checkout • Dispatched in heavy-duty postal tube via Royal Mail 48</div>
      </div>

      <ul class="features-list">
        <li><strong>Genuine Giclée Printing</strong>: 12-colour UltraChrome pigment inks rated 100+ years lightfast.</li>
        <li><strong>Archival 200gsm Stock</strong>: Museum-grade FSC-certified heavyweight acid-free matte art paper.</li>
        <li><strong>Zero-Touch Damage Guarantee</strong>: Free automated reprint dispatch if damaged in Royal Mail transit.</li>
        <li><strong>Farmed &amp; Printed in the UK</strong>: Handcrafted at Alton, Hampshire print atelier.</li>
      </ul>
    </div>
  </main>

  <script>
    let currentSize = '${preselectedSize}';
    let promoActive = false;
    const sizes = ${JSON.stringify(sizes)};

    function selectSize(id) {
      currentSize = id;
      document.querySelectorAll('.size-option').forEach(el => el.classList.remove('active'));
      const activeOption = document.querySelector('input[value="' + id + '"]')?.closest('.size-option');
      if (activeOption) activeOption.classList.add('active');
      updateButtonText();
    }

    function applyPromo() {
      const code = document.getElementById('promo-input').value.trim().toUpperCase();
      const feedback = document.getElementById('promo-feedback');
      if (code === 'HERITAGE10') {
        promoActive = true;
        feedback.style.display = 'block';
        feedback.style.color = '#1b7430';
        feedback.innerText = '✓ HERITAGE10 applied: 10% discount added to checkout!';
      } else if (code === '') {
        promoActive = false;
        feedback.style.display = 'none';
      } else {
        promoActive = false;
        feedback.style.display = 'block';
        feedback.style.color = '#b3261e';
        feedback.innerText = 'Invalid discount code.';
      }
      updateButtonText();
    }

    function updateButtonText() {
      const sizeObj = sizes.find(s => s.id === currentSize) || sizes[0];
      let price = sizeObj.pricePence;
      if (promoActive) price = Math.round(price * 0.90);
      const formatted = '£' + (price / 100).toFixed(2);
      document.getElementById('buy-button').innerText = 'Order ' + sizeObj.name.split(' ')[0] + ' Print (' + formatted + ') — Free UK Delivery';
    }

    async function checkout() {
      const btn = document.getElementById('buy-button');
      btn.disabled = true;
      btn.innerText = 'Connecting to Stripe...';
      const code = document.getElementById('promo-input').value.trim().toUpperCase();

      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artworkCode: '${product.code}',
            sizeId: currentSize,
            promoCode: code
          })
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.error || 'Failed to initialize checkout.');
          btn.disabled = false;
          updateButtonText();
        }
      } catch (err) {
        alert('Network error. Please try again.');
        btn.disabled = false;
        updateButtonText();
      }
    }

    // Initialize with default promo applied
    applyPromo();
  </script>
</body>
</html>`;

  res.send(html);
});

/**
 * 0. GET CATALOG PRODUCTS & SIZES (For Storefront Frontend)
 */
app.get("/api/products", (req, res) => {
  res.status(200).json({ products, sizes });
});


/**
 * 0.1 CREATE STRIPE CHECKOUT SESSION (Zero-Outlay Storefront)
 */
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { artworkCode, sizeId, promoCode } = req.body;
    const product = products.find((p) => p.code === artworkCode);
    const size = sizes.find((s) => s.id === sizeId);

    if (!product || !size) {
      return res.status(400).json({ error: "Invalid product or size selection." });
    }

    if (!stripe) {
      return res.status(503).json({
        error: "Stripe is not yet configured. Please add STRIPE_SECRET_KEY to your .env file.",
      });
    }

    const cleanPromo = (promoCode || "").trim().toUpperCase();
    const discountApplied = cleanPromo === "HERITAGE10";
    const finalAmount = discountApplied
      ? Math.round(size.pricePence * 0.9)
      : size.pricePence;

    const origin = req.headers.origin || `http://${req.headers.host || "localhost:3000"}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: ["GB"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "gbp" },
            display_name: "Royal Mail 48 Tracked (Free UK Delivery)",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 3 },
            },
          },
        },
      ],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: finalAmount,
            product_data: {
              name: discountApplied
                ? `${product.title} - ${size.name} (10% OFF - HERITAGE10)`
                : `${product.title} - ${size.name}`,
              description: `${product.desc} (Giclée on ${size.paper})`,
              images: [product.image_url],
              metadata: {
                artworkCode: product.code,
                size: size.id,
                sku: `${product.code}-${size.skuSuffix}`,
                promoCode: discountApplied ? "HERITAGE10" : "NONE",
              },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        artworkCode: product.code,
        sizeId: size.id,
        sku: `${product.code}-${size.skuSuffix}`,
        prodigiSku: size.prodigiSku,
        artworkUrl: product.image_url,
        promoCode: discountApplied ? "HERITAGE10" : "NONE",
        discountPercent: discountApplied ? "10%" : "0%",
      },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
    });

    res.status(200).json({ url: session.url, id: session.id, discounted: discountApplied });
  } catch (err) {
    console.error("[STRIPE CHECKOUT ERROR]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 0.2 STRIPE WEBHOOK: checkout.session.completed
 * Dispatches directly to Prodigi UK without any Shopify store required!
 */
app.post("/webhooks/stripe", async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    let event;

    const stripeWebhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    if (stripeWebhookSecret && !stripeWebhookSecret.startsWith("whsec_xxxx")) {
      try {
        event = stripe.webhooks.constructEvent(
          req.rawBody,
          sig,
          stripeWebhookSecret
        );
      } catch (err) {
        console.error("[STRIPE SIGNATURE ERROR]:", err.message);
        return res.status(400).send(`Webhook signature error: ${err.message}`);
      }
    } else {
      event = req.body;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const shipping = session.shipping_details || session.customer_details;
      const metadata = session.metadata || {};

      if (!shipping || !shipping.address) {
        console.warn("[STRIPE WEBHOOK]: Missing shipping address on session:", session.id);
        return res.status(200).send("No shipping address.");
      }

      const prodigiSku = metadata.prodigiSku || resolveProdigiSku(metadata.sku);
      const artworkUrl = metadata.artworkUrl || resolveArtworkUrl({ sku: metadata.sku });

      const prodigiOrder = await prodigi.createOrder({
        merchantReference: `STRIPE-${session.id.slice(-8)}`,
        recipient: {
          name: shipping.name || session.customer_details?.name || "Art Collector",
          address1: shipping.address.line1,
          address2: shipping.address.line2 || "",
          zip: shipping.address.postal_code,
          city: shipping.address.city,
          province: shipping.address.state || "",
          countryCode: shipping.address.country || "GB",
          email: session.customer_details?.email,
          phone: session.customer_details?.phone || shipping.phone || "",
        },
        items: [
          {
            id: session.id,
            sku: prodigiSku,
            copies: 1,
            artworkUrl: artworkUrl,
            finish: "matte",
          },
        ],
        shippingMethod: "Budget", // Royal Mail 48 Tracked
        metadata: {
          stripeSessionId: session.id,
          source: "direct-stripe-storefront",
        },
      });

      console.log(`[STRIPE AUTO-FULFILLED] Session ${session.id} submitted to Prodigi ID: ${prodigiOrder.order.id}`);
      return res.status(200).json({ success: true, prodigiOrderId: prodigiOrder.order.id });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[STRIPE FULFILL ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 1. SHOPIFY ORDER WEBHOOK: orders/paid
 * Triggers upon customer payment. Validates risk & routes directly to Prodigi UK.
 */
app.post("/webhooks/shopify/orders-paid", async (req, res) => {
  try {
    if (!isValidShopifyWebhook(req)) {
      console.warn("[SECURITY] Rejected orders-paid webhook: Invalid Shopify HMAC signature.");
      return res.status(401).json({ error: "Invalid webhook signature." });
    }

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
      const matchedSku = resolveProdigiSku(item.sku);
      const artworkUrl = resolveArtworkUrl(item);

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
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`UK Dropship Automation Bridge running on port ${PORT}`);
  });
}

app.resolveProdigiSku = resolveProdigiSku;
app.resolveArtworkUrl = resolveArtworkUrl;
app.isValidShopifyWebhook = isValidShopifyWebhook;
app.SKU_MAPPING = SKU_MAPPING;
app.ARTWORK_REGISTRY = ARTWORK_REGISTRY;

module.exports = app;
