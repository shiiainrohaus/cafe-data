/**
 * seed-v2.js
 *
 * Reads approved JSON from data/review-queue/ and inserts into Neon DB (schema v2).
 * Handles: brands, brand_translations, products, product_translations,
 *          competition_usage, product_tags
 *
 * Usage:
 *   node scripts/seed-v2.js --input ./data/review-queue/extracted-xxx.json
 */

const { Client } = require('pg');
const fs = require('fs');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("❌ DATABASE_URL not set"); process.exit(1); }

const CATEGORY_MAP = {
  'grinder': {
    'hand grinder': 'hand-grinder',
    'electric espresso grinder': 'electric-espresso-grinder',
    'electric grinder': 'electric-espresso-grinder',
    'commercial espresso grinder': 'commercial-grinder',
    'commercial grinder': 'commercial-grinder',
    'portable electric grinder': 'portable-electric-grinder',
    'hybrid hand/electric grinder': 'hybrid-grinder',
    'hybrid grinder': 'hybrid-grinder',
  },
  'brewer': {
    'pour over dripper': 'pour-over-dripper',
    'aeropress': 'aeropress',
    'hybrid dripper': 'hybrid-dripper',
    'siphon': 'brewer',
    'french press': 'brewer',
  },
  'kettle': {
    'electric gooseneck kettle': 'electric-gooseneck',
    'electric gooseneck': 'electric-gooseneck',
    'stovetop': 'kettle',
  },
  'espresso_machine': { default: 'espresso-machine' },
  'scale':     { default: 'scale' },
  'accessory': {
    'gift set': 'gift-set',
    default: 'accessory',
  },
  'other': { default: 'accessory' },
};

function toSlug(str) {
  return (str || '').toLowerCase()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
}

function getCategorySlug(category, subcategory) {
  const map = CATEGORY_MAP[category] || {};
  if (subcategory) {
    const sub = subcategory.toLowerCase();
    for (const [key, slug] of Object.entries(map)) {
      if (key !== 'default' && sub.includes(key)) return slug;
    }
  }
  return map.default || category.replace('_', '-');
}

async function main() {
  const args = process.argv.slice(2);
  const inputFlag = args.indexOf('--input');
  if (inputFlag === -1 || !args[inputFlag + 1]) {
    console.error('Usage: node scripts/seed-v2.js --input <json-file>');
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(args[inputFlag + 1], 'utf-8'));
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log(`📥 Seeding ${records.length} products...\n`);

  let inserted = 0, skipped = 0;

  for (const r of records) {
    const brandSlug = toSlug(r.brand).substring(0, 60);

    // Upsert brand
    await client.query(
      `INSERT INTO brands (slug, country_of_origin) VALUES ($1, $2)
       ON CONFLICT (slug) DO NOTHING`,
      [brandSlug, r.countryOfOrigin || null]
    );
    const { rows: [brand] } = await client.query(`SELECT id FROM brands WHERE slug = $1`, [brandSlug]);

    // Brand translation
    await client.query(
      `INSERT INTO brand_translations (brand_id, locale, name) VALUES ($1, 'zh-CN', $2)
       ON CONFLICT (brand_id, locale) DO UPDATE SET name = EXCLUDED.name`,
      [brand.id, r.brand]
    );

    // Category lookup
    const catSlug = getCategorySlug(r.category, r.subcategory);
    const { rows: catRows } = await client.query(`SELECT id FROM categories WHERE slug = $1`, [catSlug]);
    const categoryId = catRows[0]?.id || null;

    // Product slug
    const productSlug = `${brandSlug}-${toSlug(r.name)}`.substring(0, 120);

    // Check if exists
    const existing = await client.query(`SELECT id FROM products WHERE slug = $1`, [productSlug]);
    if (existing.rows.length > 0) {
      console.log(`  ⏭  skipped (exists): ${r.brand} — ${r.name}`);
      skipped++;
      continue;
    }

    // Insert product
    await client.query(
      `INSERT INTO products (
        slug, brand_id, category_id, model_number,
        year_introduced, year_discontinued, status,
        price_min, price_max, price_currency,
        price_cn_min, price_cn_max,
        available_in_cn, cn_distributor,
        specs, source_level, source_note
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        productSlug, brand.id, categoryId, r.modelNumber || null,
        r.yearIntroduced || null, r.yearDiscontinued || null, r.status || 'current',
        r.priceMin || null, r.priceMax || null, r.priceCurrency || 'USD',
        r.priceCnMin || null, r.priceCnMax || null,
        r.availableInCn || false, r.cnDistributor || null,
        JSON.stringify(r.specs || {}), 'professional', r.sourceNote || null,
      ]
    );

    const { rows: [product] } = await client.query(`SELECT id FROM products WHERE slug = $1`, [productSlug]);

    // Product translation (zh-CN)
    await client.query(
      `INSERT INTO product_translations (product_id, locale, name) VALUES ($1, 'zh-CN', $2)
       ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name`,
      [product.id, r.name]
    );

    // Competition usage
    for (const cu of (r.competitionUsage || [])) {
      await client.query(
        `INSERT INTO competition_usage
           (product_id, competition_name, competition_year, competitor_name, competitor_country, placement, role, source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [product.id, cu.competitionName, cu.competitionYear || null,
         cu.competitorName || null, cu.competitorCountry || null,
         cu.placement || null, cu.role || 'other', cu.sourceUrl || null]
      );
    }

    // Tags
    for (const tag of (r.tags || [])) {
      await client.query(
        `INSERT INTO product_tags (product_id, tag) VALUES ($1, $2)`,
        [product.id, tag]
      );
    }

    console.log(`  ✅ [${catSlug}] ${r.brand} — ${r.name}`);
    inserted++;
  }

  // Summary
  const { rows: [counts] } = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM brands) AS brands,
      (SELECT COUNT(*) FROM product_translations) AS translations,
      (SELECT COUNT(*) FROM competition_usage) AS competitions,
      (SELECT COUNT(*) FROM product_tags) AS tags
  `);
  console.log(`\n📊 DB totals:`, counts);
  console.log(`\n🎉 Done! Inserted: ${inserted}, Skipped: ${skipped}`);

  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
