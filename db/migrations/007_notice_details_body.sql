-- Migration 007 — Add body_text column to notice_details
--
-- v2 of the notice-detail popup extracts the announcement body too,
-- in addition to attachments. Old (v1) cached rows have body_text=NULL;
-- the Edge Function treats them as stale and re-fetches on next open,
-- so no manual backfill is needed.

alter table public.notice_details
  add column if not exists body_text text;
