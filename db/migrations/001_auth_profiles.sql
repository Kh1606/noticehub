-- Migration 001 — Admin auth + profile table
--
-- Paste this whole file into the Supabase SQL editor (one shot) and run it.
-- Idempotent: safe to re-run.
--
-- After running:
--   1) Authentication > Users > "Add user" with email + password (for you and your senior)
--   2) Table editor > profiles > set is_admin = true on those user rows
--
-- Make sure Authentication > Providers > Email is ENABLED and "Confirm email" is OFF.

-- ─────────────────────────────────────────────────────────────────────────
-- profiles: one row per auth.users entry. Holds the is_admin flag.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  is_admin    boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: if any auth.users exist already without a profile row, create them now
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: every signed-in user can read their OWN profile row only.
--      Nobody can write via the REST API (admin flag must be set via SQL).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "self read" on public.profiles;
create policy "self read"
  on public.profiles
  for select
  using (auth.uid() = id);

-- No insert/update/delete policies = blocked for anon + authenticated.
-- Service role bypasses RLS, so the trigger and SQL editor still work.
