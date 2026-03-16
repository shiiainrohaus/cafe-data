-- Schema v2 migration
-- Drop old tables and rebuild cleanly

DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS brands CASCADE;

-- Drop old enums
DROP TYPE IF EXISTS category CASCADE;
DROP TYPE IF EXISTS source_level CASCADE;

-- New enums
CREATE TYPE source_level AS ENUM ('official', 'professional', 'community', 'unverified');
CREATE TYPE product_status AS ENUM ('current', 'discontinued', 'limited_edition', 'prototype');
CREATE TYPE brand_tier AS ENUM ('boutique', 'prosumer', 'commercial', 'budget');
CREATE TYPE sentiment AS ENUM ('positive', 'neutral', 'negative', 'mixed');
CREATE TYPE review_source_type AS ENUM ('youtube', 'bilibili', 'reddit', 'blog', 'magazine', 'competition');
CREATE TYPE competition_role AS ENUM ('grinder', 'espresso_machine', 'brewer', 'other');
CREATE TYPE purchase_region AS ENUM ('CN', 'US', 'EU', 'GLOBAL');

-- Categories (hierarchical)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES categories(id),
  icon TEXT,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE category_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(category_id, locale)
);

-- Brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  country_of_origin TEXT,
  founded_year SMALLINT,
  website TEXT,
  cn_official_store TEXT,
  tier brand_tier,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE brand_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  origin_story TEXT,
  UNIQUE(brand_id, locale)
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  brand_id UUID REFERENCES brands(id),
  category_id UUID REFERENCES categories(id),
  model_number TEXT,
  year_introduced SMALLINT,
  year_discontinued SMALLINT,
  status product_status DEFAULT 'current',
  price_min INTEGER,
  price_max INTEGER,
  price_currency TEXT DEFAULT 'USD',
  price_cn_min INTEGER,
  price_cn_max INTEGER,
  available_in_cn BOOLEAN DEFAULT FALSE,
  cn_distributor TEXT,
  specs JSONB DEFAULT '{}',
  source_level source_level DEFAULT 'professional',
  source_note TEXT,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  highlights JSONB DEFAULT '[]',
  UNIQUE(product_id, locale)
);

-- Purchase channels
CREATE TABLE purchase_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  platform TEXT NOT NULL,
  url TEXT,
  price INTEGER,
  currency TEXT DEFAULT 'USD',
  region purchase_region,
  is_official BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Layer 4: Reviews
CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  source_type review_source_type NOT NULL,
  author_name TEXT,
  author_url TEXT,
  content_url TEXT,
  content_locale TEXT,
  sentiment sentiment,
  summary TEXT,
  published_at TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Layer 4: Competition usage
CREATE TABLE competition_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  competition_name TEXT NOT NULL,
  competition_year SMALLINT,
  competitor_name TEXT,
  competitor_country TEXT,
  placement TEXT,
  role competition_role,
  source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Layer 4: Tags
CREATE TABLE product_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  tag TEXT NOT NULL
);

-- Posts / articles
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  title TEXT NOT NULL,
  body TEXT,
  product_ids JSONB DEFAULT '[]',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
