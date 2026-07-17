# Armaf Performance Intelligence

Executive Next.js intelligence dashboard combining real Meta organic behavior (Jul 2025–Jul 2026) with the existing paid Meta reporting snapshot. Google Display is represented only as a clearly labeled connection placeholder.

Organic pre/post comparisons use monthly averages: Jul 2025–Jan 2026 versus Feb–Jun 2026. Partial July 2026 remains visible in trends but is excluded from the normalized agency-era comparison.

## Stack

- Next.js on Vercel
- Supabase Lab backend table: `public.dashboard_snapshots`
- Static PDF and creative assets in `public/`

## Local

```bash
npm install
npm run snapshot
npm run build
```

## Supabase Seed

The backend stores the dashboard payload as a versioned JSON snapshot.

```bash
psql "$DATABASE_URL" < supabase-schema.sql
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." npm run seed:supabase
```

Browser/runtime only needs:

```bash
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```
