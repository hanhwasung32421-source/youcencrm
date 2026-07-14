-- 여왕개미미디어 CRM 최신 통합 패치
-- Supabase SQL Editor에서 한 번에 실행하세요.

-- 1) 회원가입 추가 컬럼
alter table public.crm_users
  add column if not exists login_id text;

alter table public.crm_users
  add column if not exists birth_date date;

alter table public.crm_users
  add column if not exists phone text;

alter table public.crm_users
  add column if not exists custom_role_code text;

update public.crm_users
set login_id = split_part(email, '@', 1)
where (login_id is null or login_id = '');

create unique index if not exists crm_users_login_id_uniq on public.crm_users (login_id);

alter table public.crm_users
  alter column login_id set not null;

-- 기본 직급 시드 보강
insert into public.roles (code, name)
values
  ('super_admin', '총 관리자'),
  ('admin', '관리자'),
  ('general_manager', '부장'),
  ('manager', '과장'),
  ('assistant_manager', '대리'),
  ('senior_staff', '주임'),
  ('staff', '직원'),
  ('retired', '퇴사')
on conflict (code) do update
set name = excluded.name;

-- 2) 역할별 메뉴 권한
create table if not exists public.role_menu_permissions (
  id uuid primary key default gen_random_uuid(),
  role_type text not null,
  menu_key text not null,
  can_view boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role_type, menu_key)
);

create index if not exists role_menu_permissions_role_idx on public.role_menu_permissions(role_type);

insert into public.role_menu_permissions (role_type, menu_key, can_view)
values
  ('super_admin', 'admin_dashboard', true),
  ('super_admin', 'admin_users', true),
  ('super_admin', 'admin_attendance', true),
  ('super_admin', 'admin_menu_permissions', true),
  ('admin', 'admin_dashboard', true),
  ('admin', 'admin_users', true),
  ('admin', 'admin_attendance', true),
  ('admin', 'admin_menu_permissions', false),
  ('general_manager', 'creator_dashboard', true),
  ('general_manager', 'creator_videos', true),
  ('manager', 'creator_dashboard', true),
  ('manager', 'creator_videos', true),
  ('assistant_manager', 'creator_dashboard', true),
  ('assistant_manager', 'creator_videos', true),
  ('senior_staff', 'creator_dashboard', true),
  ('senior_staff', 'creator_videos', true),
  ('staff', 'creator_dashboard', true),
  ('staff', 'creator_videos', true),
  ('retired', 'creator_dashboard', false),
  ('retired', 'creator_videos', false)
on conflict (role_type, menu_key) do update
set can_view = excluded.can_view,
    updated_at = now();

-- 3) 유튜브 계정 API 활성화/검증용 컬럼
alter table public.youtube_accounts
  add column if not exists api_active boolean not null default false;

alter table public.youtube_accounts
  add column if not exists api_last_error text null;

alter table public.youtube_accounts
  add column if not exists api_last_checked_at timestamptz null;
