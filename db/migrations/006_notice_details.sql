-- Migration 006 — Cache table for notice detail-page fetches
--
-- Paste into Supabase SQL editor and run. Idempotent.
--
-- One row per notice. Populated by the `fetch-notice-detail` Edge Function
-- on first click; subsequent opens of the modal hit the cache so the source
-- detail page is only fetched once per ~7 days per notice.

create table if not exists public.notice_details (
  notice_id   text         primary key,
  attachments jsonb        not null default '[]'::jsonb,
  status      text         not null default 'ok'
                check (status in ('ok', 'error')),
  error_text  text,
  fetched_at  timestamptz  not null default now()
);

create index if not exists notice_details_fetched_idx
  on public.notice_details (fetched_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — public read (notices are public).
-- All writes go through the Edge Function using the service role key,
-- so no public-facing INSERT/UPDATE/DELETE policy is needed.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.notice_details enable row level security;

drop policy if exists "public read" on public.notice_details;
create policy "public read"
  on public.notice_details for select
  to anon, authenticated
  using (true);
