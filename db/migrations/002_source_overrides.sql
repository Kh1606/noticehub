-- Migration 002 — Live endpoint overrides + audit log
--
-- Paste the whole file into the Supabase SQL editor and run.
-- Idempotent: safe to re-run.
--
-- Requires migration 001 to have been run already (uses public.profiles for the
-- admin RLS check).

-- ─────────────────────────────────────────────────────────────────────────
-- source_overrides: one row per (region, sub_entity, source_page) that has
-- been edited. Same sub_entity can have multiple pages (공지사항, 고시공고,
-- 입찰공고…) so the page name is part of the key.
-- Absence of a row = scraper uses its hardcoded default URL.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.source_overrides (
  region       text        not null,
  sub_entity   text        not null,
  source_page  text        not null,
  new_url      text        not null,
  changed_by   uuid        references auth.users(id) on delete set null,
  changed_at   timestamptz not null default now(),
  primary key (region, sub_entity, source_page)
);

-- ─────────────────────────────────────────────────────────────────────────
-- source_override_history: append-only audit (insert/update/delete).
-- Never modified by the API — only the trigger writes here.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.source_override_history (
  id           bigserial   primary key,
  region       text        not null,
  sub_entity   text        not null,
  source_page  text        not null,
  old_url      text,
  new_url      text,
  action       text        not null check (action in ('insert','update','delete')),
  changed_by   uuid,
  changed_email text,
  changed_at   timestamptz not null default now()
);

create index if not exists source_override_history_changed_at_idx
  on public.source_override_history (changed_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Audit trigger: writes one history row per insert/update/delete.
-- Captures the actor's email at the moment of the change so the history
-- stays readable even if a profile is later renamed/deleted.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.log_source_override_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id    uuid;
  actor_email text;
begin
  -- Prefer the actor recorded on the row; fall back to current session user
  actor_id := coalesce(
    case when tg_op = 'DELETE' then old.changed_by else new.changed_by end,
    auth.uid()
  );
  select email into actor_email from public.profiles where id = actor_id;

  if tg_op = 'INSERT' then
    insert into public.source_override_history
      (region, sub_entity, source_page, old_url, new_url, action, changed_by, changed_email)
    values
      (new.region, new.sub_entity, new.source_page, null, new.new_url, 'insert', actor_id, actor_email);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.source_override_history
      (region, sub_entity, source_page, old_url, new_url, action, changed_by, changed_email)
    values
      (new.region, new.sub_entity, new.source_page, old.new_url, new.new_url, 'update', actor_id, actor_email);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.source_override_history
      (region, sub_entity, source_page, old_url, new_url, action, changed_by, changed_email)
    values
      (old.region, old.sub_entity, old.source_page, old.new_url, null, 'delete', actor_id, actor_email);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists source_overrides_audit on public.source_overrides;
create trigger source_overrides_audit
  after insert or update or delete on public.source_overrides
  for each row execute function public.log_source_override_change();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: admins (per public.profiles.is_admin) have full access.
-- Service role (the scraper) bypasses RLS, so it can read overrides freely.
-- Anonymous and non-admin users see nothing.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.source_overrides         enable row level security;
alter table public.source_override_history  enable row level security;

drop policy if exists "admin all" on public.source_overrides;
create policy "admin all"
  on public.source_overrides
  for all
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and is_admin)
  )
  with check (
    exists (select 1 from public.profiles
            where id = auth.uid() and is_admin)
  );

drop policy if exists "admin read" on public.source_override_history;
create policy "admin read"
  on public.source_override_history
  for select
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and is_admin)
  );
-- No write policies on history = blocked except via the trigger (which runs
-- with definer privileges).
