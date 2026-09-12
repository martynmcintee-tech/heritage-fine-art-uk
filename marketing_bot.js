/**
 * AUTONOMOUS MARKETING & SYNDICATION BOT
 * Heritage Fine Art UK
 * 
 * Functions:
 * 1. Generates curated social copy, hashtags, and Pinterest Rich Pin payloads.
 * 2. Pings Search Engines (IndexNow, Bing, Google) to index product pages for organic traffic.
 * 3. Rotates featured products for daily syndication.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const products = require('./products.json');
const sizes = require('./sizes.json');

const BASE_URL = process.env.APP_BASE_URL || 'https://heritage-fine-art-uk.onrender.com';

// High-performing UK interior design & fine art hashtags
const HASHTAG_BANK = [
  '#WallArtUK',
  '#FineArtPrints',
  '#MuseumEdition',
  '#GicleePrinting',
  '#BritishInteriors',
  '#HomeDecorUK',
  '#GalleryWallInspo',
  '#VintageArtPrints',
  '#LivingRoomDecor',
  '#ArchivalPaper'
];

/**
 * Generate marketing copy and Pinterest pins for each product
 */
function generateSocialQueue() {
  const queue = products.map((product) => {
    const productUrl = `${BASE_URL}/product/${product.handle}`;
    const minPrice = sizes[0].priceFormatted;
    
    return {
      id: `post-${product.code.toLowerCase()}-${Date.now()}`,
      artworkCode: product.code,
      title: product.title,
      artist: product.artist,
      productUrl,
      imageUrl: product.image_url,
      suggestedSize: 'A3 (29.7 x 42 cm)',
      pricing: `From ${minPrice} with Free UK Royal Mail 48 Tracked Delivery`,
      
      pinterestPin: {
        title: `${product.title} — Archival Museum Print`,
        description: `Bring British museum elegance into your home. "${product.title}" (${product.artist}), printed on 200gsm archival matte art paper in Alton, Hampshire. Free Royal Mail 48 Tracked delivery across the UK. Use code HERITAGE10 for 10% off.`,
        destinationUrl: `${productUrl}?utm_source=pinterest&utm_medium=organic_pin&utm_campaign=collection`,
        imageUrl: product.image_url,
        board: 'Curated Wall Art & Gallery Wall Inspiration'
      },
      
      xTwitterPost: `Elevate your living space with "${product.title}" (${product.artist}).\n\n🏛️ 12-colour archival giclée\n📜 200gsm heavyweight matte paper\n📮 Free Royal Mail 48 Tracked UK delivery\n\nClaim 10% off with code HERITAGE10:\n${productUrl}\n\n${HASHTAG_BANK.slice(0, 4).join(' ')}`,
      
      instagramCaption: `Curated Heritage: "${product.title}" by ${product.artist}.\n\nHandcrafted to order at our Alton, Hampshire print atelier on 200gsm museum-grade archival matte paper using 12-colour UltraChrome pigment inks.\n\n✓ 100+ year lightfast guarantee\n✓ Dispatched in protective heavy-duty postal tubes\n✓ Free Royal Mail 48 Tracked delivery to all UK addresses\n✓ Zero-touch transit damage replacement\n\nCollect your edition at the link in bio or visit ${productUrl} (Use code HERITAGE10 for 10% off today).\n.\n.\n.\n${HASHTAG_BANK.join(' ')}`
    };
  });

  const outputPath = path.join(__dirname, 'marketing_queue.json');
  fs.writeFileSync(outputPath, JSON.stringify(queue, null, 2), 'utf8');
  console.log(`[MARKETING BOT] Generated ${queue.length} ready-to-publish social & Pinterest posts in marketing_queue.json`);
  return queue;
}

/**
 * Ping search engines via IndexNow and Sitemap endpoints
 */
async function pingSearchEngines() {
  console.log('[SEARCH ENGINE BOT] Initiating search engine pings for organic traffic indexing...');
  
  const host = new URL(BASE_URL).hostname;
  const urlList = [
    `${BASE_URL}/`,
    `${BASE_URL}/sitemap.xml`,
    ...products.map(p => `${BASE_URL}/product/${p.handle}`)
  ];

  // IndexNow Ping (notifies Bing, Yandex, etc.)
  const indexNowPayload = JSON.stringify({
    host: host,
    key: "heritagefineartukindexnowkey2026",
    keyLocation: `${BASE_URL}/heritagefineartukindexnowkey2026.txt`,
    urlList: urlList
  });

  console.log(`[SEARCH ENGINE BOT] Pinging IndexNow with ${urlList.length} URLs for host ${host}...`);

  return new Promise((resolve) => {
    const req = https.request('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(indexNowPayload)
      },
      timeout: 10000
    }, (res) => {
      console.log(`[INDEXNOW RESPONSE]: Status ${res.statusCode} ${res.statusMessage}`);
      resolve({ status: res.statusCode });
    });

    req.on('error', (err) => {
      console.log(`[INDEXNOW NOTICE]: ${err.message} (Will re-try on next scheduled cron)`);
      resolve({ error: err.message });
    });

    req.write(indexNowPayload);
    req.end();
  });
}

// CLI Execution Handler
const action = process.argv[2] || '--all';

async function run() {
  if (action === '--action' && process.argv[3]) {
    const target = process.argv[3];
    if (target === 'generate_posts') {
      generateSocialQueue();
    } else if (target === 'ping_search_engines') {
      await pingSearchEngines();
    } else {
      console.log(`Unknown action ${target}. Use 'generate_posts' or 'ping_search_engines'.`);
    }
  } else {
    console.log('=== HERITAGE FINE ART UK: AUTONOMOUS MARKETING BOT ===');
    generateSocialQueue();
    await pingSearchEngines();
    console.log('=== MARKETING BOT CYCLE COMPLETED ===');
  }
}

if (require.main === module) {
  run();
}

module.exports = { generateSocialQueue, pingSearchEngines };
