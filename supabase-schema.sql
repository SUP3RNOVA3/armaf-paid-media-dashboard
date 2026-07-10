create table if not exists public.dashboard_snapshots (
  brand text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_snapshots enable row level security;

drop policy if exists "Public read dashboard snapshots" on public.dashboard_snapshots;
create policy "Public read dashboard snapshots"
  on public.dashboard_snapshots
  for select
  using (true);

create index if not exists dashboard_snapshots_updated_at_idx
  on public.dashboard_snapshots (updated_at desc);
