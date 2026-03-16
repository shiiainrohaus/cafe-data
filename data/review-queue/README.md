# Review Queue

JSON files here are extracted product data waiting for human review before DB import.

## Workflow

1. Run extraction: `tsx scripts/extract.ts --input <image-or-text-file>`
2. Open the generated JSON file in this folder
3. Review each product — correct fields, delete non-products, fill in blanks you know
4. Import: `node scripts/seed-v2.js --input <this-file.json>`

## Full Field Reference

```json
{
  "brand": "Brand name (required)",
  "name": "Model name (required)",
  "category": "grinder | espresso_machine | brewer | kettle | scale | accessory | other",
  "subcategory": "e.g. hand grinder | electric espresso grinder | pour over dripper | electric gooseneck kettle | gift set",
  "modelNumber": "Official SKU or null",
  "yearIntroduced": 2024,
  "yearDiscontinued": null,
  "status": "current | discontinued | limited_edition | prototype",
  "specs": {
    "burr_size_mm": 38,
    "burr_type": "conical",
    "burr_material": "titanium-coated stainless",
    "adjustment_increment_mm": 0.01,
    "power_w": 300,
    "anti_static": true
  },
  "priceMin": 299,
  "priceMax": 349,
  "priceCurrency": "USD",
  "priceCnMin": null,
  "priceCnMax": null,
  "countryOfOrigin": "Germany",
  "availableInCn": false,
  "cnDistributor": null,
  "competitionUsage": [
    {
      "competitionName": "WBC 2024",
      "competitionYear": 2024,
      "competitorName": "John Doe",
      "competitorCountry": "Australia",
      "placement": "1st",
      "role": "grinder"
    }
  ],
  "reviewMentions": [
    {
      "sourceType": "youtube | bilibili | reddit | blog | magazine",
      "authorName": "Lance Hedrick",
      "contentLocale": "en"
    }
  ],
  "tags": ["award-winner", "wbc-used", "cn-exclusive", "limited-edition", "collab", "beginner-friendly", "prosumer", "travel"],
  "sourceNote": "Coffee Salon Annual 2025, p.94",
  "rawExcerpt": "Original text from source (straight quotes only)"
}
```

## Category → Subcategory Reference

| category | subcategory options |
|----------|-------------------|
| grinder | hand grinder, electric espresso grinder, electric grinder, commercial espresso grinder, portable electric grinder, hybrid hand/electric grinder |
| brewer | pour over dripper, aeropress, hybrid dripper, siphon, french press |
| kettle | electric gooseneck kettle, stovetop gooseneck |
| espresso_machine | manual lever, semi-automatic, fully-automatic, commercial |
| accessory | gift set, tamper, distribution tool, portafilter |
| scale | (no subcategory needed) |
