-- ============================================================================
-- 캐릭터 꾸미기 저장 검증 (담당: 지민) — 20261123120000_jm_appearance.sql 실행 후
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터는 남지 않음
-- 실패하면 'FAIL: …' 에러로 멈춤. 성공하면 NOTICE로 PASS 목록이 보임
-- ============================================================================
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', '{"display_name":"꾸미기A"}'),
  ('00000000-0000-0000-0000-0000000000e2', '{"display_name":"꾸미기B"}');

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
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
grant execute on function pg_temp.login(uuid), pg_temp.logout(), pg_temp.expect_error(text, text, text) to authenticated, anon;

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000e1';
  b uuid := '00000000-0000-0000-0000-0000000000e2';
  r jsonb;
begin
  -- 처음엔 빈 객체
  perform pg_temp.login(a);
  select appearance into r from public.profiles where id = a;
  if r <> '{}'::jsonb then raise exception 'FAIL: 기본값이 {}가 아님: %', r; end if;
  raise notice 'PASS: 가입 직후 appearance = {}';

  -- 보낸 항목만 합쳐짐
  perform public.save_appearance('{"characterId":"female"}');
  r := public.save_appearance('{"hat":"red","color":"#ff8800"}');
  if r <> '{"characterId":"female","hat":"red","color":"#ff8800"}'::jsonb then raise exception 'FAIL: 합치기 결과 %', r; end if;
  raise notice 'PASS: 보낸 항목만 바뀌고 나머지 유지';

  -- null이면 그 항목 삭제
  r := public.save_appearance('{"hat":null}');
  if r ? 'hat' then raise exception 'FAIL: null 항목이 안 지워짐: %', r; end if;
  raise notice 'PASS: null로 보낸 항목 삭제';

  -- 객체가 아니면 거부
  perform pg_temp.expect_error($q$select public.save_appearance('"female"'::jsonb)$q$, 'INVALID_INPUT', '문자열 거부');
  perform pg_temp.expect_error($q$select public.save_appearance('[1,2]'::jsonb)$q$, 'INVALID_INPUT', '배열 거부');
  perform pg_temp.expect_error($q$select public.save_appearance(null)$q$, 'INVALID_INPUT', 'null 거부');

  -- 2KB 넘으면 거부 (함수)
  perform pg_temp.expect_error(format($q$select public.save_appearance('{"big":"%s"}'::jsonb)$q$, repeat('x', 2100)), 'TOO_LARGE', '2KB 초과 거부(함수)');

  -- 함수를 거치지 않고 테이블을 직접 고쳐도 제약이 막음 (RLS상 본인 줄 수정은 허용되므로)
  perform pg_temp.expect_error(format($q$update public.profiles set appearance = '{"big":"%s"}'::jsonb where id = auth.uid()$q$, repeat('x', 2100)), 'appearance_small_object', '2KB 초과 거부(직접 수정)');
  perform pg_temp.expect_error($q$update public.profiles set appearance = '"x"'::jsonb where id = auth.uid()$q$, 'appearance_small_object', '객체 아님 거부(직접 수정)');

  -- 남의 꾸미기는 안 바뀜: 함수는 auth.uid() 줄만 고침
  perform pg_temp.login(b);
  perform public.save_appearance('{"characterId":"male"}');
  perform pg_temp.login(a);
  select appearance into r from public.profiles where id = a;
  if r ->> 'characterId' <> 'female' then raise exception 'FAIL: B 저장이 A를 바꿈: %', r; end if;
  -- RLS: A는 B 줄을 읽을 수 없음
  if exists (select 1 from public.profiles where id = b) then raise exception 'FAIL: 남의 프로필이 보임'; end if;
  raise notice 'PASS: 남의 꾸미기 읽기·쓰기 불가';

  -- 꾸미기 저장으로 역할이 바뀌지 않음 (appearance에 role을 넣어도 그냥 꾸미기 값)
  r := public.save_appearance('{"role":"admin"}');
  if public.my_role() <> 'pilgrim' then raise exception 'FAIL: 역할이 바뀜'; end if;
  raise notice 'PASS: appearance에 role을 넣어도 권한 그대로';

  -- 로그인 안 하면 거부
  perform pg_temp.logout();
  perform set_config('role', 'anon', true);
  perform pg_temp.expect_error($q$select public.save_appearance('{}'::jsonb)$q$, 'permission denied', '비로그인(anon) 실행 권한 없음');
  perform pg_temp.logout();

  raise notice '=== jm_appearance 검증 모두 통과 ===';
end $$;

rollback;
