import csv

# High-converting public domain collection titles (British Library, Rijksmuseum, Met Open Access)
PRODUCTS = [
    {
        "handle": "vintage-william-morris-strawberry-thief-botanical-print",
        "title": "William Morris - Strawberry Thief Fine Art Print",
        "desc": "Museum-grade giclée print of William Morris' iconic Victorian textile illustration. Printed on 200gsm archival matte paper in the UK.",
        "tags": "Botanical, Victorian, William Morris, Wall Art, British Heritage"
    },
    {
        "handle": "hokusai-great-wave-kanagawa-fine-art-print",
        "title": "Katsushika Hokusai - The Great Wave off Kanagawa",
        "desc": "Classic Japanese ukiyo-e woodblock masterpiece reproduced with archival giclée pigments on heavy matte art paper. UK printed and dispatched.",
        "tags": "Japanese Art, Woodblock, Classic Art, Ocean, Wave"
    },
    {
        "handle": "vintage-camellia-japonica-botanical-print",
        "title": "Pierre-Joseph Redouté - Camellia Japonica Botanical Illustration",
        "desc": "Botanical court painter Redouté's delicate French study of flowering camellia blooms. Premium heavyweight fine art paper.",
        "tags": "Botanical, Floral, French Art, Vintage, Redoute"
    },
    {
        "handle": "bauhaus-exhibition-1923-typography-art-print",
        "title": "Bauhaus Exhibition Weimar 1923 Geometric Print",
        "desc": "Iconic German modernist exhibition poster featuring striking geometric typography and primary color blocking.",
        "tags": "Bauhaus, Modernist, Graphic Design, Typography, Minimalist"
    },
    {
        "handle": "vintage-london-underground-retro-travel-poster",
        "title": "Vintage London Underground Royal Botanic Gardens Poster",
        "desc": "Classic 1930s British transport poster celebrating Kew Gardens. Vibrant vintage lithograph reproduction.",
        "tags": "London, Retro Travel, British Rail, Kew Gardens, Vintage Poster"
    },
    {
        "handle": "van-gogh-almond-blossom-giclee-print",
        "title": "Vincent van Gogh - Almond Blossom Masterpiece",
        "desc": "Poetic post-impressionist floral branches against turquoise skies. Printed using genuine archival inks.",
        "tags": "Van Gogh, Impressionism, Floral, Classic Masterpiece"
    },
    {
        "handle": "claude-monet-water-lilies-giverny-art-print",
        "title": "Claude Monet - The Water Lily Pond (Giverny)",
        "desc": "Serene French impressionist landscape featuring the famous Japanese bridge and blooming water lilies.",
        "tags": "Monet, French Art, Water Lilies, Impressionism"
    },
    {
        "handle": "vintage-herbal-medicinal-plants-chart",
        "title": "Victorian Apothecary & Medicinal Plants Chart",
        "desc": "Detailed vintage botanical chart illustrating classic British medicinal flora, wildflowers, and herbs.",
        "tags": "Botanical, Wildflowers, Apothecary, Vintage Chart"
    },
    {
        "handle": "gustav-klimt-the-kiss-art-print",
        "title": "Gustav Klimt - The Kiss (Der Kuss)",
        "desc": "Vienna Secession gilded masterpiece depicting romantic intimacy in rich decorative symbolism.",
        "tags": "Klimt, Vienna Secession, Gold Leaf, Romantic"
    },
    {
        "handle": "mid-century-abstract-scandinavian-shapes-print",
        "title": "Scandinavian Minimalist Neutral Abstract Composition",
        "desc": "Soothing neutral beige, charcoal, and terracotta organic shapes tailored for modern Scandi interior decor.",
        "tags": "Abstract, Scandi, Minimalist, Earth Tones, Neutral"
    }
]

VARIANTS = [
    {"size": "A4 (21 x 29.7 cm)", "sku_suffix": "A4-MATTE", "price": "18.99", "grams": "150"},
    {"size": "A3 (29.7 x 42 cm)", "sku_suffix": "A3-MATTE", "price": "24.99", "grams": "250"},
    {"size": "A2 (42 x 59.4 cm)", "sku_suffix": "A2-MATTE", "price": "34.99", "grams": "400"},
    {"size": "A1 (59.4 x 84.1 cm)", "sku_suffix": "A1-MATTE", "price": "49.99", "grams": "600"}
]

csv_file = "shopify_catalog_import.csv"
fieldnames = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams", "Variant Inventory Tracker",
    "Variant Inventory Qty", "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price",
    "Variant Requires Shipping", "Variant Taxable", "Status"
]

with open(csv_file, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()

    for p in PRODUCTS:
        first = True
        for v in VARIANTS:
            writer.writerow({
                "Handle": p["handle"],
                "Title": p["title"] if first else "",
                "Body (HTML)": f"<p>{p['desc']}</p><p><strong>Specifications:</strong></p><ul><li>Paper: 200gsm Museum-Quality Archival Matte Paper</li><li>Printing: UK 12-colour Giclée Process</li><li>Dispatch: 24-48 Hours via Royal Mail 48 Tracked</li><li>Packaging: Heavy-duty cardboard postal tube with protective glassine wrap</li></ul>" if first else "",
                "Vendor": "Heritage Fine Art UK",
                "Product Category": "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork",
                "Type": "Fine Art Print",
                "Tags": p["tags"] if first else "",
                "Published": "TRUE",
                "Option1 Name": "Size",
                "Option1 Value": v["size"],
                "Variant SKU": v["sku_suffix"],
                "Variant Grams": v["grams"],
                "Variant Inventory Tracker": "",
                "Variant Inventory Qty": "999",
                "Variant Inventory Policy": "continue",
                "Variant Fulfillment Service": "manual",
                "Variant Price": v["price"],
                "Variant Requires Shipping": "TRUE",
                "Variant Taxable": "TRUE",
                "Status": "active"
            })
            first = False

print(f"Generated {len(PRODUCTS)} products across {len(PRODUCTS)*len(VARIANTS)} variants into {csv_file}")
