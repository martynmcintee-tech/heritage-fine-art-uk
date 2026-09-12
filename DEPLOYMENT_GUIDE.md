# UK Zero-Interaction Fine Art Dropshipping Store: Deployment Guide

Follow this step-by-step master checklist to get your store live and running completely hands-off.

---

## Step 1: Shopify Store Setup (15 Mins)
1. Sign up for Shopify (use the £1/month trial promotion if available).
2. Set store currency to **GBP (£)** and measurements to **Metric (cm, kg)**.
3. In **Settings > Payments**, activate **Shopify Payments** (enables Apple Pay, Google Pay, Visa, Mastercard, Klarna).
4. In **Settings > Shipping and Delivery**:
   - Set domestic UK shipping: **Free Shipping on all orders** (or Free over £30).
5. In **Settings > Policies**, paste the pre-written policies from the `legal_policies/` folder:
   - `shipping_policy.md`
   - `refund_policy.md`
   - `privacy_policy.md`

---

## Step 2: Catalog Import (5 Mins)
1. In your terminal inside this folder, run:
   ```bash
   python catalog_generator.py
   ```
2. This creates `shopify_catalog_import.csv` with 10 high-converting art collections across 40 variants (A4, A3, A2, A1).
3. In Shopify Admin, go to **Products > Import** and upload `shopify_catalog_import.csv`.
4. All 10 products will be imported with variant SKUs, tags, and prices.

---

## Step 3: Connect Prodigi UK (10 Mins)
1. Go to **apps.shopify.com/prodigi** and install the official Prodigi App.
2. Sign in or register at [prodigi.com](https://www.prodigi.com).
3. In Prodigi Dashboard:
   - Add a credit/debit card under **Billing** (this auto-charges wholesale costs when an order comes in).
   - Go to **Settings > Automatic Order Submission** and toggle it **ON**.
4. In the Prodigi Shopify App, match your imported SKUs:
   - `A4-MATTE` -> `GLOBAL-FAP-A4` (Enhanced Matte Art Paper)
   - `A3-MATTE` -> `GLOBAL-FAP-A3`
   - `A2-MATTE` -> `GLOBAL-FAP-A2`
   - `A1-MATTE` -> `GLOBAL-FAP-A1`
5. Prodigi will now automatically accept orders, print them in Alton/Farnham UK, package them in postal tubes, and ship via Royal Mail.

---

## Step 4: Autonomous AI Customer Support (15 Mins)
1. Install **Tidio** from the Shopify App Store.
2. In Tidio, activate **Lyro AI**.
3. Go to **Lyro Knowledge Base > Add Knowledge**:
   - Copy and paste the contents of `ai_support_knowledge_base.md`.
4. Enable the **Shopify Integration** inside Tidio:
   - Lyro will now automatically look up order numbers and provide real-time Royal Mail tracking links without you lifting a finger.

---

## Step 5: Self-Service Returnless Refunds (10 Mins)
1. Install **AfterShip Returns** (or **Loop Returns**) from the Shopify App Store.
2. Set up Return Policy Rule:
   - If reason is "Damaged in transit" and photo is provided -> **Auto-approve replacement / refund without requiring return shipment**.

---

## Step 6: Automated Performance Marketing (Hands-Off Traffic)
1. Install the **Google & YouTube** app in Shopify.
2. Sync your product catalog with **Google Merchant Center**.
3. Launch a **Google Performance Max (PMax)** campaign:
   - Target: United Kingdom
   - Bidding Strategy: Maximize Conversion Value with Target ROAS (e.g., 250% - 300%).
   - Budget: Start at £10 - £15/day. Google’s machine learning algorithm handles bidding, placement (Shopping, Search, Display, YouTube), and optimization automatically.

---

## Financial Model (Per A3 Print Unit)
- **Retail Price:** £24.99 (Free UK Delivery)
- **Prodigi Print Cost (A3 Matte):** £4.50
- **Royal Mail 48 Tracked Shipping:** £3.25
- **Shopify & Payment Processing (2% + 25p):** ~£0.75
- **Target Ad Cost per Acquisition (CPA):** £7.00
- **Net Profit per Sale:** **~£9.49 (38% Net Margin)**

Zero inventory, zero post office trips, zero manual customer service emails.
