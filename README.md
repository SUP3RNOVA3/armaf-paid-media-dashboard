# Armaf Paid Media Dashboard

Interactive Next.js dashboard for Armaf paid media reports.

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
