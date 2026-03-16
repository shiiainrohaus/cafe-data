# ☕ cafe-data

A structured coffee equipment information aggregator, built from professional sources (Coffee Salon Annual, brand specs, community data).

## Goal

Bridge the information gap between professional coffee equipment knowledge and everyday consumers — especially for niche/imported gear that most people don't know exists or how to buy.

## Stack

- **Frontend:** Next.js (App Router) + Tailwind CSS + shadcn/ui
- **Database:** Neon Postgres
- **ORM:** Drizzle ORM
- **Deployment:** Vercel
- **Data Pipeline:** Claude API for structured extraction from source material

## Project Structure

```
cafe-data/
├── apps/
│   └── web/              ← Next.js site
├── packages/
│   └── db/               ← Drizzle schema + migrations
├── scripts/
│   ├── extract.ts        ← Claude-powered yearbook extraction
│   └── seed.ts           ← Import approved data to DB
└── data/
    └── review-queue/     ← JSON files pending human approval
```

## Phases

- **Phase 0:** Schema design + data extraction pipeline
- **Phase 1:** MVP site — product pages, category pages, compare
- **Phase 2:** Search, filters, full-text
- **Phase 3:** Content layer (articles, reviews, JSON-LD SEO)

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in: DATABASE_URL, ANTHROPIC_API_KEY

# Run DB migrations
pnpm db:migrate

# Start dev server
pnpm dev
```

## Data Sources

Primary: Coffee Salon Annual (咖啡沙龙年刊) — neutral, professional-grade.
Secondary: Brand official sites (spec verification only, added later).
