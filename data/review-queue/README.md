# Review Queue

This folder contains extracted product data waiting for human review before being imported into the database.

## Workflow

1. Run `tsx scripts/extract.ts --input <yearbook-text-file>`
2. Open the generated JSON file here
3. Review each product:
   - ✅ Correct any wrong fields
   - ❌ Delete records that are not actual products
   - Add any missing info you know
4. Run `tsx scripts/seed.ts --input <this-file.json>`

## Field Reference

```json
{
  "brand": "Brand name",
  "name": "Model name",
  "category": "grinder|espresso_machine|brewer|kettle|scale|accessory|other",
  "subcategory": "e.g. hand grinder, single boiler",
  "specs": { "burr_size_mm": 83, "material": "stainless" },
  "priceMin": 299,
  "priceMax": 349,
  "priceCurrency": "USD",
  "countryOfOrigin": "Germany",
  "availableInCn": false,
  "sourceNote": "Coffee Salon Annual 2025, p.42",
  "rawExcerpt": "original text from source"
}
```
