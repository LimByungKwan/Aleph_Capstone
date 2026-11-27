-- 로컬 검증 전용: Supabase가 원래 갖고 있는 것(auth 스키마, anon/authenticated 역할, 기본 권한)을 흉내
-- 실제 Supabase에서는 실행하지 않습니다.
create role anon nologin;
create role authenticated nologin;
-- Supabase Auth(GoTrue)가 auth.users에 행을 넣을 때 쓰는 역할 (실제는 auth.users 소유자)
create role supabase_auth_admin nologin;
create schema auth;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
-- Supabase의 auth.uid()와 같은 동작: request.jwt.claims의 sub
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
-- Supabase Auth의 2단계 인증 수단 표 (필요한 칸만). 실제는 status가 enum(auth.factor_status)
create table auth.mfa_factors (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  factor_type text not null default 'totp',
  status text not null default 'unverified',
  created_at timestamptz not null,
  updated_at timestamptz not null
);
grant usage on schema auth to anon, authenticated;
grant usage on schema auth to supabase_auth_admin;
grant select, insert on auth.users to supabase_auth_admin;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
