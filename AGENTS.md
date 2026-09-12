# UK Zero-Touch Dropshipping Project (Antigravity Workspace)

## Project Overview
This project is an automated e-commerce engine operating in the UK market:
- **Niche**: Curated Museum & Botanical Fine Art Prints (Giclée on 200gsm Archival Matte).
- **Fulfillment Engine**: Prodigi Group Ltd (Alton/Farnham UK) via REST API v4.0.
- **Courier**: Royal Mail 48 Tracked / DPD Tracked.
- **Store Platform**: Shopify.
- **Support Automation**: Tidio Lyro AI / Gorgias Automate (100% autonomous resolution).
- **Return Policy**: Automated returnless replacements for transit damage.

## Key Files & Structure
- shopify_prodigi_bridge.js: Webhook bridge between Shopify and Prodigi UK.
- prodigi_client.js: Prodigi v4 API wrapper.
- catalog_generator.py: Script to generate Shopify-compatible CSV art collections.
- shopify_catalog_import.csv: Pre-generated 10-product / 40-variant CSV for instant Shopify import.
- i_support_knowledge_base.md: Autonomous AI customer service prompt and knowledge base.
- legal_policies/: UK-compliant shipping, returnless refund, and GDPR privacy policies.
- DEPLOYMENT_GUIDE.md: Full step-by-step launch manual.
