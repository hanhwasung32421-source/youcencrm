-- Supabase SQL Editor에 그대로 실행하세요.
-- 유튜브 계정: API 활성화/검증용 컬럼 추가

alter table public.youtube_accounts
  add column if not exists api_active boolean not null default false;

alter table public.youtube_accounts
  add column if not exists api_last_error text null;

alter table public.youtube_accounts
  add column if not exists api_last_checked_at timestamptz null;

