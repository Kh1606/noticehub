-- Migration 005 — Postgres trigger that calls the notify-scrape-error Edge
-- Function on every INSERT into scrape_errors. This replaces Supabase's
-- UI-based Database Webhooks, which aren't available in every project tier.
--
-- ONLY needed if the 4xx alert email isn't already arriving via a UI-configured
-- Database Webhook. If your project HAS the Webhooks UI and you set up a hook
-- there already, you can skip this migration.
--
-- Prereqs:
--   • Migration 003 has run (scrape_errors table exists)
--   • Edge Function "notify-scrape-error" is deployed with verify_jwt = OFF
--   • Edge Function has secrets set: RESEND_API_KEY, ALERT_TO, ALERT_FROM
--
-- Idempotent. Safe to re-run.

create extension if not exists pg_net;

create or replace function public.notify_scrape_error_via_edge_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_url text := 'https://fjxbwerapxmgppqlpmhw.supabase.co/functions/v1/notify-scrape-error';
begin
  -- Fire-and-forget POST to the Edge Function. pg_net does this async so
  -- the INSERT isn't blocked waiting for the email send.
  perform net.http_post(
    url     := edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'scrape_errors',
      'schema', 'public',
      'record', row_to_json(new)
    )
  );
  return new;
exception when others then
  -- Best-effort: a notify failure must never block the INSERT itself
  -- (we want the row in scrape_errors regardless of whether email worked).
  raise notice 'notify_scrape_error_via_edge_fn: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists scrape_errors_notify on public.scrape_errors;
create trigger scrape_errors_notify
  after insert on public.scrape_errors
  for each row execute function public.notify_scrape_error_via_edge_fn();
