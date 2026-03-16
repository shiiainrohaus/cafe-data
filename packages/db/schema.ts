import {
  pgTable, pgEnum, text, uuid, jsonb, timestamp,
  boolean, integer, smallint
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const sourceLevelEnum = pgEnum('source_level', [
  'official', 'professional', 'community', 'unverified',
]);

export const productStatusEnum = pgEnum('product_status', [
  'current', 'discontinued', 'limited_edition', 'prototype',
]);

export const brandTierEnum = pgEnum('brand_tier', [
  'boutique', 'prosumer', 'commercial', 'budget',
]);

export const sentimentEnum = pgEnum('sentiment', [
  'positive', 'neutral', 'negative', 'mixed',
]);

export const reviewSourceTypeEnum = pgEnum('review_source_type', [
  'youtube', 'bilibili', 'reddit', 'blog', 'magazine', 'competition',
]);

export const competitionRoleEnum = pgEnum('competition_role', [
  'grinder', 'espresso_machine', 'brewer', 'other',
]);

export const purchaseRegionEnum = pgEnum('purchase_region', [
  'CN', 'US', 'EU', 'GLOBAL',
]);

// ─── Categories (hierarchical) ────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id:        uuid('id').primaryKey().defaultRandom(),
  slug:      text('slug').notNull().unique(),
  parentId:  uuid('parent_id'),               // self-ref, null = top-level
  icon:      text('icon'),
  sortOrder: smallint('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const categoryTranslations = pgTable('category_translations', {
  id:         uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  locale:     text('locale').notNull(),       // zh-CN | en | ja | de
  name:       text('name').notNull(),
});

// ─── Brands ───────────────────────────────────────────────────────────────────

export const brands = pgTable('brands', {
  id:             uuid('id').primaryKey().defaultRandom(),
  slug:           text('slug').notNull().unique(),
  countryOfOrigin: text('country_of_origin'),
  foundedYear:    smallint('founded_year'),
  website:        text('website'),
  cnOfficialStore: text('cn_official_store'),
  tier:           brandTierEnum('tier'),
  logoUrl:        text('logo_url'),
  createdAt:      timestamp('created_at').defaultNow(),
});

export const brandTranslations = pgTable('brand_translations', {
  id:          uuid('id').primaryKey().defaultRandom(),
  brandId:     uuid('brand_id').references(() => brands.id).notNull(),
  locale:      text('locale').notNull(),
  name:        text('name').notNull(),
  description: text('description'),
  originStory: text('origin_story'),
});

// ─── Products ─────────────────────────────────────────────────────────────────

export const products = pgTable('products', {
  id:              uuid('id').primaryKey().defaultRandom(),
  slug:            text('slug').notNull().unique(),
  brandId:         uuid('brand_id').references(() => brands.id),
  categoryId:      uuid('category_id').references(() => categories.id),

  // Identity
  modelNumber:     text('model_number'),
  yearIntroduced:  smallint('year_introduced'),
  yearDiscontinued: smallint('year_discontinued'),
  status:          productStatusEnum('status').default('current'),

  // Pricing — international
  priceMin:        integer('price_min'),
  priceMax:        integer('price_max'),
  priceCurrency:   text('price_currency').default('USD'),

  // Pricing — CN market
  priceCnMin:      integer('price_cn_min'),
  priceCnMax:      integer('price_cn_max'),

  // Distribution
  availableInCn:   boolean('available_in_cn').default(false),
  cnDistributor:   text('cn_distributor'),

  // Technical specs (flexible per category)
  specs:           jsonb('specs').default({}),

  // Provenance
  sourceLevel:     sourceLevelEnum('source_level').default('professional'),
  sourceNote:      text('source_note'),

  lastVerifiedAt:  timestamp('last_verified_at'),
  createdAt:       timestamp('created_at').defaultNow(),
  updatedAt:       timestamp('updated_at').defaultNow(),
});

export const productTranslations = pgTable('product_translations', {
  id:          uuid('id').primaryKey().defaultRandom(),
  productId:   uuid('product_id').references(() => products.id).notNull(),
  locale:      text('locale').notNull(),      // zh-CN | en | ja | de
  name:        text('name').notNull(),
  tagline:     text('tagline'),               // one-liner
  description: text('description'),           // editorial paragraph
  highlights:  jsonb('highlights').default([]), // ["Award winner", "First to use X"]
});

// ─── Purchase Channels ────────────────────────────────────────────────────────

export const purchaseChannels = pgTable('purchase_channels', {
  id:         uuid('id').primaryKey().defaultRandom(),
  productId:  uuid('product_id').references(() => products.id).notNull(),
  platform:   text('platform').notNull(),     // taobao | jd | amazon | brand_site | other
  url:        text('url'),
  price:      integer('price'),
  currency:   text('currency').default('USD'),
  region:     purchaseRegionEnum('region'),
  isOfficial: boolean('is_official').default(false),
  verifiedAt: timestamp('verified_at'),
  updatedAt:  timestamp('updated_at').defaultNow(),
});

// ─── Layer 4: Reviews ─────────────────────────────────────────────────────────

export const productReviews = pgTable('product_reviews', {
  id:            uuid('id').primaryKey().defaultRandom(),
  productId:     uuid('product_id').references(() => products.id).notNull(),
  sourceType:    reviewSourceTypeEnum('source_type').notNull(),
  authorName:    text('author_name'),
  authorUrl:     text('author_url'),
  contentUrl:    text('content_url'),
  contentLocale: text('content_locale'),      // zh | en | ja
  sentiment:     sentimentEnum('sentiment'),
  summary:       text('summary'),
  publishedAt:   timestamp('published_at'),
  verified:      boolean('verified').default(false),
  createdAt:     timestamp('created_at').defaultNow(),
});

// ─── Layer 4: Competition Usage ───────────────────────────────────────────────

export const competitionUsage = pgTable('competition_usage', {
  id:                uuid('id').primaryKey().defaultRandom(),
  productId:         uuid('product_id').references(() => products.id).notNull(),
  competitionName:   text('competition_name').notNull(),  // "WBC 2024"
  competitionYear:   smallint('competition_year'),
  competitorName:    text('competitor_name'),
  competitorCountry: text('competitor_country'),
  placement:         text('placement'),        // "1st", "finalist"
  role:              competitionRoleEnum('role'),
  sourceUrl:         text('source_url'),
  createdAt:         timestamp('created_at').defaultNow(),
});

// ─── Layer 4: Tags ────────────────────────────────────────────────────────────

export const productTags = pgTable('product_tags', {
  id:        uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  tag:       text('tag').notNull(),
  // e.g. award-winner | wbc-used | cn-exclusive | beginner-friendly
  //      prosumer | travel | limited-edition | collab | discontinued | barista-choice | value-pick
});

// ─── Articles / Posts ─────────────────────────────────────────────────────────

export const posts = pgTable('posts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  slug:        text('slug').notNull().unique(),
  locale:      text('locale').notNull().default('zh-CN'),
  title:       text('title').notNull(),
  body:        text('body'),                  // MDX
  productIds:  jsonb('product_ids').default([]),
  publishedAt: timestamp('published_at'),
  createdAt:   timestamp('created_at').defaultNow(),
});
