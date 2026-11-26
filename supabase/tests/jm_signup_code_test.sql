-- ============================================================================
-- 회원가입 코드 검증 (담당: 지민) — 20261202120000_jm_signup_code.sql 실행 후
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터·코드 설정은 남지 않음
--   (실제 DB에 코드를 넣어 두었어도 이 파일이 잠깐 'test-code-1126'으로 바꿨다가 rollback으로 되돌림)
-- 실패하면 'FAIL: …' 에러로 멈춤. 성공하면 맨 끝에 '완료' 한 줄
-- ※ Supabase Auth가 가입을 넣는 역할(supabase_auth_admin)로 바꿔서 auth.users에 넣어 봄
-- ============================================================================
begin;

create function pg_temp.signup(p_id uuid, p_meta jsonb) returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_auth_admin', true);
  insert into auth.users (id, raw_user_meta_data) values (p_id, p_meta);
  perform set_config('role', 'none', true);
exception when others then
  perform set_config('role', 'none', true);
  raise;
end $$;
create function pg_temp.expect_error(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL: % — 에러가 나야 하는데 성공함', p_label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like '%' || p_code || '%' then
    raise exception 'FAIL: % — 기대 %, 실제 %', p_label, p_code, sqlerrm;
  end if;
  raise notice 'PASS: % (%)', p_label, p_code;
end $$;
grant execute on function pg_temp.signup(uuid, jsonb), pg_temp.expect_error(text, text, text) to supabase_auth_admin, anon, authenticated;

do $$
declare
  n int;
  meta jsonb;
begin
  -- ── 1. 코드가 꺼져 있으면 예전처럼 누구나 가입 ──
  perform private.set_signup_code(null);
  perform pg_temp.signup('00000000-0000-0000-0000-0000000000e1', '{"display_name":"꺼짐"}');
  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-0000000000e1';
  if n <> 1 then raise exception 'FAIL: 코드 꺼짐인데 가입(프로필 생성)이 안 됨'; end if;
  raise notice 'PASS: 코드 꺼짐 → 가입됨';

  -- ── 2. 코드를 켜면: 없음·틀림은 막힘 ──
  perform private.set_signup_code('test-code-1126');
  perform pg_temp.expect_error($q$select pg_temp.signup('00000000-0000-0000-0000-0000000000e2', '{"display_name":"코드없음"}')$q$,
    'INVALID_SIGNUP_CODE', '코드 없이 가입');
  perform pg_temp.expect_error($q$select pg_temp.signup('00000000-0000-0000-0000-0000000000e2', '{"display_name":"틀림","signup_code":"wrong-code"}')$q$,
    'INVALID_SIGNUP_CODE', '틀린 코드로 가입');
  perform pg_temp.expect_error($q$select pg_temp.signup('00000000-0000-0000-0000-0000000000e2', '{"signup_code":"TEST-CODE-1126"}')$q$,
    'INVALID_SIGNUP_CODE', '대소문자만 다른 코드');
  select count(*) into n from auth.users where id = '00000000-0000-0000-0000-0000000000e2';
  if n <> 0 then raise exception 'FAIL: 막힌 가입인데 auth.users에 행이 남음'; end if;

  -- ── 3. 맞는 코드(앞뒤 공백은 무시)는 가입되고, 코드는 저장되지 않음 ──
  perform pg_temp.signup('00000000-0000-0000-0000-0000000000e3', '{"display_name":"맞음","signup_code":"  test-code-1126 "}');
  select raw_user_meta_data into meta from auth.users where id = '00000000-0000-0000-0000-0000000000e3';
  if meta ? 'signup_code' then raise exception 'FAIL: 가입 코드가 auth.users 메타데이터에 남음: %', meta; end if;
  if meta ->> 'display_name' <> '맞음' then raise exception 'FAIL: 다른 메타데이터까지 지워짐: %', meta; end if;
  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-0000000000e3';
  if n <> 1 then raise exception 'FAIL: 맞는 코드인데 프로필이 안 생김'; end if;
  raise notice 'PASS: 맞는 코드 → 가입됨, 코드는 메타데이터에서 지워짐';

  -- ── 4. 코드 원문은 어디에도 없음 (해시만) ──
  select count(*) into n from private.signup_code where code_hash like '%test-code%';
  if n <> 0 then raise exception 'FAIL: 코드 원문이 저장됨'; end if;
  raise notice 'PASS: 저장된 건 SHA-256 해시뿐';

  -- ── 5. postgres로 직접 넣는 행(검증 SQL·관리 작업)은 검사하지 않음 ──
  insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e4', '{"display_name":"직접","signup_code":"x"}');
  select raw_user_meta_data into meta from auth.users where id = '00000000-0000-0000-0000-0000000000e4';
  if meta ? 'signup_code' then raise exception 'FAIL: 직접 넣은 행에도 코드가 남음'; end if;
  raise notice 'PASS: postgres 직접 삽입은 통과 (코드는 지움)';

  -- ── 6. 코드를 바꾸면 예전 코드는 안 됨, 너무 짧은 코드는 거절 ──
  perform private.set_signup_code('second-code-1126');
  perform pg_temp.expect_error($q$select pg_temp.signup('00000000-0000-0000-0000-0000000000e5', '{"signup_code":"test-code-1126"}')$q$,
    'INVALID_SIGNUP_CODE', '바꾸기 전 코드로 가입');
  perform pg_temp.expect_error($q$select private.set_signup_code('short')$q$, '8자 이상', '7자 이하 코드 설정');
  select count(*) into n from private.signup_code;
  if n <> 1 then raise exception 'FAIL: 코드 행이 %줄 (1줄이어야 함)', n; end if;
end $$;

-- ── 7. 순례객·비로그인은 코드 표·함수에 손대지 못함 ──
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    perform set_config('role', r, true);
    perform pg_temp.expect_error('select count(*) from private.signup_code', 'permission denied', r || ' → 코드 표 읽기');
    perform pg_temp.expect_error($q$select private.set_signup_code('hacked-code-0000')$q$, 'permission denied', r || ' → 코드 바꾸기');
    perform pg_temp.expect_error($q$select private.signup_code_ok('guess-code')$q$, 'permission denied', r || ' → 코드 맞혀 보기');
    perform set_config('role', 'none', true);
  end loop;
end $$;

select '완료' as result;
rollback;
