import { pgTable, text, uuid, jsonb, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';

// --- Enums ---

export const categoryEnum = pgEnum('category', [
  'grinder',
  'espresso_machine',
  'brewer',
  'kettle',
  'scale',
  'accessory',
  'other',
]);

export const sourceLevelEnum = pgEnum('source_level', [
  'official',       // brand's own site
  'professional',   // yearbook, barista magazine etc.
  'community',      // forums, reddit
  'unverified',
]);

// --- Tables ---

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  country: text('country'),
  website: text('website'),
  cnDistributor: text('cn_distributor'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id').references(() => brands.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  category: categoryEnum('category').notNull(),
  subcategory: text('subcategory'),

  // Flexible specs per category (e.g. grinder: burr size, RPM; machine: boiler type, pressure)
  specs: jsonb('specs').default({}),

  priceMin: integer('price_min'),   // in USD
  priceMax: integer('price_max'),
  priceCurrency: text('price_currency').default('USD'),

  availableInCn: boolean('available_in_cn').default(false),
  sourceLevel: sourceLevelEnum('source_level').default('professional'),
  sourceNote: text('source_note'),   // e.g. "Coffee Salon Annual 2025, p.42"

  lastVerifiedAt: timestamp('last_verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id),
  platform: text('platform').notNull(),  // e.g. "taobao", "amazon", "brand_site"
  url: text('url'),
  price: integer('price'),
  currency: text('currency').default('USD'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  body: text('body'),  // MDX content
  productIds: jsonb('product_ids').default([]),  // array of product UUIDs
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
