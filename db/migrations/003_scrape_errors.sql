-- Migration 003 — Scrape error log + Realtime publication
--
-- Paste into Supabase SQL editor and run. Idempotent.
-- Requires migration 001 (uses public.profiles for the admin RLS check).
--
-- Provides:
--   • scrape_errors table — one row per 4xx/5xx response (or other failure)
--     that the scraper hits during a run
--   • RLS so only admins can read/update; scrapers (service_role) bypass RLS
--   • Realtime publication so the admin UI can show a live toast banner

create table if not exists public.scrape_errors (
  id           bigserial   primary key,
  region       text,
  sub_entity   text,
  source_page  text,
  url_tried    text        not null,
  status_code  int         not null,            -- HTTP status, or 0 for non-HTTP failure
  error_text   text,                             -- exception class + message, truncated
  occurred_at  timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid        references auth.users(id) on delete set null
);

create index if not exists scrape_errors_occurred_idx
  on public.scrape_errors (occurred_at desc);
create index if not exists scrape_errors_unresolved_idx
  on public.scrape_errors (occurred_at desc)
  where resolved_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: admins read + update. Service role (scrapers) bypasses RLS for insert.
-- Nobody else has any access.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.scrape_errors enable row level security;

drop policy if exists "admin read" on public.scrape_errors;
create policy "admin read"
  on public.scrape_errors for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin update" on public.scrape_errors;
create policy "admin update"
  on public.scrape_errors for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: publish INSERT events so the admin UI can subscribe and pop a
-- toast banner the moment a new error lands.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scrape_errors'
  ) then
    execute 'alter publication supabase_realtime add table public.scrape_errors';
  end if;
end $$;
