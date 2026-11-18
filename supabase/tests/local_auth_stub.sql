-- 로컬 검증 전용: Supabase가 원래 갖고 있는 것(auth 스키마, anon/authenticated 역할, 기본 권한)을 흉내
-- 실제 Supabase에서는 실행하지 않습니다.
create role anon nologin;
create role authenticated nologin;
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
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
