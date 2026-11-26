-- ============================================================================
-- 회원가입 코드 (담당: 지민, 11/26)
-- 아는 사람만 가입: 가입할 때 팀이 정한 코드를 넣어야 계정이 만들어짐
--
-- 어디서 막나: auth.users에 행이 들어가기 직전(BEFORE INSERT 트리거)
--   → 우리 서버(/auth/signup)를 거치지 않고 Supabase Auth에 바로 가입 요청을 보내도 같은 곳에서 막힘
-- 코드는 원문이 아니라 SHA-256 해시만 저장 (DB를 들여다봐도 코드가 보이지 않음)
-- 코드는 사용자 메타데이터에서 지워서 auth.users에도 남지 않게 함
--
-- 켜기·바꾸기 (SQL Editor, postgres 권한에서만):  select private.set_signup_code('새 코드');
-- 끄기:                                          select private.set_signup_code(null);
-- 코드를 정하지 않은 상태 = 꺼짐 (누구나 가입). 적용한 날 바로 코드를 넣고 아래 확인 쿼리로 확인
--   select exists (select 1 from private.signup_code) as "가입 코드 켜짐";
--
-- 검사 대상은 Supabase Auth가 넣는 행(supabase_auth_admin 역할)만:
--   대시보드·SQL Editor에서 postgres로 직접 넣는 행(검증 SQL의 가짜 사용자 등)은 검사하지 않음.
--   그 권한이 있으면 이미 DB 전체를 바꿀 수 있으므로 막는 의미가 없음
-- ※ 대시보드의 'Add user'도 Supabase Auth를 거치므로 코드가 켜져 있으면 막힘 → 게임 가입 화면에서 코드로 가입
-- ============================================================================

create schema if not exists private;  -- API(PostgREST)에 공개되지 않는 스키마
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;

create table if not exists private.signup_code (
  id         boolean primary key default true check (id),  -- 한 줄만
  code_hash  text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.signup_code from public, anon, authenticated;

create or replace function private.hash_signup_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select encode(pg_catalog.sha256(pg_catalog.convert_to(btrim(p_code), 'UTF8')), 'hex')
$$;

-- 코드 켜기·바꾸기·끄기 (postgres만 실행 가능)
create or replace function private.set_signup_code(p_code text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_code is null then
    delete from private.signup_code;
    return;
  end if;
  if char_length(btrim(p_code)) < 8 then
    raise exception '가입 코드는 8자 이상으로 정해 주세요';
  end if;
  insert into private.signup_code (id, code_hash) values (true, private.hash_signup_code(p_code))
  on conflict (id) do update set code_hash = excluded.code_hash, updated_at = now();
end $$;
revoke execute on function private.set_signup_code(text) from public, anon, authenticated;

-- 코드가 맞는지 (꺼져 있으면 항상 참). 표를 읽어야 해서 security definer
create or replace function private.signup_code_ok(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from private.signup_code)
      or exists (select 1 from private.signup_code s
                  where p_code is not null and s.code_hash = private.hash_signup_code(p_code))
$$;
revoke execute on function private.signup_code_ok(text) from public, anon, authenticated;
grant execute on function private.signup_code_ok(text) to supabase_auth_admin;

-- 가입 직전 검사. security invoker라 current_user가 실제로 넣는 역할(Supabase Auth = supabase_auth_admin)
create or replace function private.check_signup_code()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_code text := new.raw_user_meta_data ->> 'signup_code';
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'signup_code';
  if current_user = 'supabase_auth_admin' and not private.signup_code_ok(v_code) then
    raise exception 'INVALID_SIGNUP_CODE' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function private.check_signup_code() from public, anon, authenticated;
grant execute on function private.check_signup_code() to supabase_auth_admin;

drop trigger if exists before_auth_user_signup_code on auth.users;
create trigger before_auth_user_signup_code
  before insert on auth.users
  for each row execute function private.check_signup_code();
