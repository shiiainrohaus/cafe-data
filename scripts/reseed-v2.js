const { Client } = require('pg');
const fs = require('fs');

const DB_URL = "postgresql://neondb_owner:npg_8Tn2CmvxQLXR@ep-soft-dust-a1qfouhl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Category seed data
const CATEGORIES = [
  // Top level
  { slug: 'grinder',         parent: null, zh: '磨豆机',   en: 'Grinder' },
  { slug: 'espresso-machine',parent: null, zh: '意式咖啡机', en: 'Espresso Machine' },
  { slug: 'brewer',          parent: null, zh: '冲煮器具',  en: 'Brewer' },
  { slug: 'kettle',          parent: null, zh: '手冲壶',    en: 'Kettle' },
  { slug: 'scale',           parent: null, zh: '咖啡秤',    en: 'Scale' },
  { slug: 'accessory',       parent: null, zh: '配件',      en: 'Accessory' },
  // Grinder subs
  { slug: 'hand-grinder',              parent: 'grinder', zh: '手摇磨豆机',      en: 'Hand Grinder' },
  { slug: 'electric-espresso-grinder', parent: 'grinder', zh: '意式电动磨豆机',  en: 'Electric Espresso Grinder' },
  { slug: 'electric-pour-over-grinder',parent: 'grinder', zh: '手冲电动磨豆机',  en: 'Electric Pour-over Grinder' },
  { slug: 'portable-electric-grinder', parent: 'grinder', zh: '便携电动磨豆机',  en: 'Portable Electric Grinder' },
  { slug: 'hybrid-grinder',            parent: 'grinder', zh: '手电一体磨豆机',  en: 'Hybrid Hand/Electric Grinder' },
  { slug: 'commercial-grinder',        parent: 'grinder', zh: '商用磨豆机',      en: 'Commercial Grinder' },
  // Brewer subs
  { slug: 'pour-over-dripper', parent: 'brewer', zh: '手冲滤杯', en: 'Pour Over Dripper' },
  { slug: 'aeropress',         parent: 'brewer', zh: '爱乐压',   en: 'AeroPress' },
  { slug: 'hybrid-dripper',    parent: 'brewer', zh: '多功能滤杯', en: 'Hybrid Dripper' },
  // Kettle subs
  { slug: 'electric-gooseneck', parent: 'kettle', zh: '电动细口壶', en: 'Electric Gooseneck Kettle' },
  // Accessory subs
  { slug: 'gift-set', parent: 'accessory', zh: '礼盒套装', en: 'Gift Set' },
];

// Map from old category strings to slugs
const CATEGORY_MAP = {
  'grinder': {
    'hand grinder': 'hand-grinder',
    'electric espresso grinder': 'electric-espresso-grinder',
    'electric grinder': 'electric-espresso-grinder',
    'commercial espresso grinder': 'commercial-grinder',
    'portable electric grinder': 'portable-electric-grinder',
    'hybrid hand/electric grinder': 'hybrid-grinder',
  },
  'brewer': {
    'pour over dripper': 'pour-over-dripper',
    'aeropress': 'aeropress',
    'hybrid dripper': 'hybrid-dripper',
  },
  'kettle': {
    'electric gooseneck kettle': 'electric-gooseneck',
  },
  'accessory': {
    'gift set': 'gift-set',
  },
};

function toSlug(str) {
  return str.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 100);
}

function getCategorySlug(category, subcategory) {
  if (!subcategory) return category;
  const sub = subcategory.toLowerCase();
  const map = CATEGORY_MAP[category] || {};
  for (const [key, slug] of Object.entries(map)) {
    if (sub.includes(key)) return slug;
  }
  return category;
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to Neon\n');

  // 1. Seed categories
  console.log('📁 Seeding categories...');
  const catIdMap = {};
  for (const cat of CATEGORIES) {
    const parentId = cat.parent ? catIdMap[cat.parent] : null;
    const res = await client.query(
      `INSERT INTO categories (slug, parent_id) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING id`,
      [cat.slug, parentId]
    );
    const id = res.rows[0].id;
    catIdMap[cat.slug] = id;

    // Translations
    for (const [locale, name] of [['zh-CN', cat.zh], ['en', cat.en]]) {
      await client.query(
        `INSERT INTO category_translations (category_id, locale, name) VALUES ($1, $2, $3)
         ON CONFLICT (category_id, locale) DO UPDATE SET name = EXCLUDED.name`,
        [id, locale, name]
      );
    }
  }
  console.log(`  ✅ ${CATEGORIES.length} categories seeded\n`);

  // 2. Load and seed products from review queue JSON
  const records = JSON.parse(fs.readFileSync('/tmp/cafe-data/data/review-queue/extracted-yearbook-p92-97.json', 'utf8'));
  console.log(`📦 Seeding ${records.length} products...\n`);

  for (const r of records) {
    const brandSlug = toSlug(r.brand).substring(0, 60);

    // Upsert brand
    await client.query(
      `INSERT INTO brands (slug, country_of_origin) VALUES ($1, $2)
       ON CONFLICT (slug) DO NOTHING`,
      [brandSlug, r.countryOfOrigin || null]
    );
    const brandRes = await client.query(`SELECT id FROM brands WHERE slug = $1`, [brandSlug]);
    const brandId = brandRes.rows[0].id;

    // Brand translation (zh-CN = original name)
    await client.query(
      `INSERT INTO brand_translations (brand_id, locale, name) VALUES ($1, $2, $3)
       ON CONFLICT (brand_id, locale) DO UPDATE SET name = EXCLUDED.name`,
      [brandId, 'zh-CN', r.brand]
    );

    // Get category id
    const catSlug = getCategorySlug(r.category, r.subcategory);
    const catRes = await client.query(`SELECT id FROM categories WHERE slug = $1`, [catSlug]);
    const categoryId = catRes.rows[0]?.id || null;

    // Product slug
    const productSlug = `${brandSlug}-${toSlug(r.name)}`.substring(0, 120);

    // Upsert product
    await client.query(
      `INSERT INTO products (slug, brand_id, category_id, specs, available_in_cn, source_level, source_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         brand_id = EXCLUDED.brand_id,
         category_id = EXCLUDED.category_id,
         specs = EXCLUDED.specs,
         available_in_cn = EXCLUDED.available_in_cn,
         source_note = EXCLUDED.source_note,
         updated_at = NOW()`,
      [productSlug, brandId, categoryId, JSON.stringify(r.specs || {}),
       r.availableInCn || false, 'professional', r.sourceNote || null]
    );
    const prodRes = await client.query(`SELECT id FROM products WHERE slug = $1`, [productSlug]);
    const productId = prodRes.rows[0].id;

    // Product translation (zh-CN)
    await client.query(
      `INSERT INTO product_translations (product_id, locale, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name`,
      [productId, 'zh-CN', r.name]
    );

    console.log(`  ✅ [${catSlug}] ${r.brand} — ${r.name}`);
  }

  // Verify counts
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM brands) AS brands,
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM product_translations) AS translations
  `);
  console.log('\n📊 DB Summary:', counts.rows[0]);

  await client.end();
  console.log('\n🎉 Done!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
