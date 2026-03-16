import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { brands, products } from '../packages/db/schema.ts';

const DB_URL = "postgresql://neondb_owner:npg_8Tn2CmvxQLXR@ep-soft-dust-a1qfouhl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
const args = process.argv.slice(2);
const inputFlag = args.indexOf('--input');
if (inputFlag === -1 || !args[inputFlag + 1]) {
  console.error('Usage: npx tsx scripts/seed-direct.ts --input <json-file>');
  process.exit(1);
}

const records = JSON.parse(fs.readFileSync(args[inputFlag + 1], 'utf-8'));
const sql = neon(DB_URL);
const db = drizzle(sql);

let inserted = 0;
let skipped = 0;

for (const record of records) {
  const brandSlug = record.brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 60);

  // Upsert brand
  await db.insert(brands).values({
    name: record.brand,
    slug: brandSlug,
    country: record.countryOfOrigin ?? null,
  }).onConflictDoUpdate({ target: brands.slug, set: { name: record.brand } });

  const [brand] = await db.select().from(brands).where(eq(brands.slug, brandSlug));

  const productSlug = `${brandSlug}-${record.name}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 120);

  const result = await db.insert(products).values({
    brandId: brand.id,
    name: record.name,
    slug: productSlug,
    category: record.category,
    subcategory: record.subcategory ?? null,
    specs: record.specs ?? {},
    priceMin: record.priceMin ?? null,
    priceMax: record.priceMax ?? null,
    priceCurrency: record.priceCurrency ?? 'USD',
    availableInCn: record.availableInCn ?? false,
    sourceLevel: 'professional',
    sourceNote: record.sourceNote ?? null,
  }).onConflictDoNothing().returning();

  if (result.length > 0) {
    console.log(`  ✅ ${record.brand} — ${record.name}`);
    inserted++;
  } else {
    console.log(`  ⏭️  skipped (already exists): ${record.name}`);
    skipped++;
  }
}

console.log(`\n🎉 Done! Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(console.error);
