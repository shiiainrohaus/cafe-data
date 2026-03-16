/**
 * seed.ts
 *
 * Reads approved JSON from data/review-queue/ and inserts into Neon DB.
 *
 * Usage:
 *   DATABASE_URL=xxx tsx scripts/seed.ts --input ./data/review-queue/extracted-2025-xxx.json
 */

import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { brands, products } from '../packages/db/schema';

async function main() {
  const args = process.argv.slice(2);
  const inputFlag = args.indexOf('--input');
  if (inputFlag === -1 || !args[inputFlag + 1]) {
    console.error('Usage: tsx scripts/seed.ts --input <path-to-approved-json>');
    process.exit(1);
  }

  const inputPath = args[inputFlag + 1];
  const records = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log(`📥 Importing ${records.length} products...`);

  for (const record of records) {
    // Upsert brand
    const [brand] = await db
      .insert(brands)
      .values({
        name: record.brand,
        slug: record.brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        country: record.countryOfOrigin ?? null,
      })
      .onConflictDoUpdate({ target: brands.slug, set: { name: record.brand } })
      .returning();

    // Insert product
    const slug = `${brand.slug}-${record.name}`
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    await db
      .insert(products)
      .values({
        brandId: brand.id,
        name: record.name,
        slug,
        category: record.category,
        subcategory: record.subcategory ?? null,
        specs: record.specs ?? {},
        priceMin: record.priceMin ?? null,
        priceMax: record.priceMax ?? null,
        priceCurrency: record.priceCurrency ?? 'USD',
        availableInCn: record.availableInCn ?? false,
        sourceLevel: 'professional',
        sourceNote: record.sourceNote ?? null,
      })
      .onConflictDoNothing();

    console.log(`  ✅ ${record.brand} ${record.name}`);
  }

  console.log('🎉 Done!');
}

main().catch(console.error);
