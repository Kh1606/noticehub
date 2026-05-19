-- Migration 004 — Scrape run + per-source attempt tables for the admin logs page
--
-- Paste into Supabase SQL editor and run. Idempotent.
-- Requires migration 001 (uses public.profiles for the admin RLS check).
--
-- One row in scrape_runs per `python -m scrapers.run_all` invocation.
-- One row in scrape_attempts per source tried during that run.

-- ─────────────────────────────────────────────────────────────────────────
-- scrape_runs — summary of one orchestrator invocation
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.scrape_runs (
  id               bigserial   primary key,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  source_filter    text,                                 -- e.g. "asan" if --only=asan
  total_attempted  int default 0,
  total_succeeded  int default 0,
  total_failed     int default 0,
  total_notices    int default 0,
  exit_status      text not null default 'running'
                     check (exit_status in ('running', 'ok', 'partial', 'failed'))
);

create index if not exists scrape_runs_started_idx
  on public.scrape_runs (started_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- scrape_attempts — per-source detail rows for a run
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.scrape_attempts (
  id            bigserial   primary key,
  run_id        bigint      not null references public.scrape_runs(id) on delete cascade,
  region        text,
  sub_entity    text,
  source_page   text,
  source_url    text,
  status        text        not null
                  check (status in ('ok', 'failed', 'skipped')),
  notice_count  int default 0,
  error_text    text,
  http_status   int,                                     -- non-null only when status='failed' on HTTPError
  duration_ms   int,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists scrape_attempts_run_idx
  on public.scrape_attempts (run_id, started_at);
create index if not exists scrape_attempts_failed_idx
  on public.scrape_attempts (started_at desc) where status = 'failed';

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — admins read, service_role (scrapers) bypasses
-- ─────────────────────────────────────────────────────────────────────────
alter table public.scrape_runs     enable row level security;
alter table public.scrape_attempts enable row level security;

drop policy if exists "admin read" on public.scrape_runs;
create policy "admin read"
  on public.scrape_runs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin read" on public.scrape_attempts;
create policy "admin read"
  on public.scrape_attempts for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime publication — frontend subscribes for live run + attempt updates
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scrape_runs'
  ) then
    execute 'alter publication supabase_realtime add table public.scrape_runs';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scrape_attempts'
  ) then
    execute 'alter publication supabase_realtime add table public.scrape_attempts';
  end if;
end $$;
