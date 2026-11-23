-- ============================================================================
-- 권한 우회 매트릭스 검증 (담당: 지민)
-- 모든 public 테이블 × 역할(비로그인·순례객·다른 가게 사장님) × 읽기/쓰기를 한 번에 확인
-- + 실수로 새 테이블·함수를 열어 두지 않았는지 자동 점검
--
-- 실행: 마이그레이션 3개(core → appearance → tarot)와 seed 실행 후 Supabase SQL Editor에 통째로 붙여 실행
--       마지막에 rollback이라 데이터는 남지 않음
-- 결과: 실패하면 그 자리에서 'FAIL: …' 에러로 멈춤. 성공하면 NOTICE로 PASS 목록이 보임
--
-- 막혔을 때 나오는 모양 (구조마다 다름)
--   읽기   → 에러가 아니라 0건 (RLS가 행을 걸러냄)
--   INSERT → 42501 new row violates row-level security policy
--   UPDATE·DELETE → 에러 없이 0행 변경
--   함수   → 비로그인: permission denied / 권한 없는 역할: NOT_OWNER 같은 코드
-- ============================================================================
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000050a', '{"display_name":"매트릭스 순례객A"}'),
  ('00000000-0000-0000-0000-00000000050b', '{"display_name":"매트릭스 순례객B"}'),
  ('00000000-0000-0000-0000-0000000005c1', '{"display_name":"매트릭스 분식 사장님"}'),
  ('00000000-0000-0000-0000-0000000005c2', '{"display_name":"매트릭스 소란 사장님"}'),
  ('00000000-0000-0000-0000-0000000005ad', '{"display_name":"매트릭스 관리자"}');
update public.profiles set role = 'owner', shop_id = 'shop_hj_snack' where id = '00000000-0000-0000-0000-0000000005c1';
update public.profiles set role = 'owner', shop_id = 'cafe_soran'    where id = '00000000-0000-0000-0000-0000000005c2';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000005ad';

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- 쓰기 매트릭스: 지금 역할로 모든 public 테이블에 직접 INSERT·UPDATE·DELETE를 시도
-- 허용된 것은 "내 프로필 수정"과 "내 타로 기록 삭제"뿐이라, 그 둘은 "남의 행" 조건으로 시도
create function pg_temp.write_matrix(p_who text) returns int language plpgsql as $$
declare
  t text; col text; cond text; n int; checked int := 0;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    -- INSERT: RLS가 42501로 막아야 함 (값을 안 채워도 RLS 검사가 NOT NULL보다 먼저)
    begin
      execute format('insert into public.%I default values', t);
      raise exception 'FAIL: [%] % 에 직접 INSERT 성공', p_who, t;
    exception when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlstate <> '42501' then
        raise exception 'FAIL: [%] % INSERT — 기대 42501, 실제 % %', p_who, t, sqlstate, sqlerrm;
      end if;
    end;

    -- 남의 행 조건 (내 것 수정·삭제가 허용된 테이블만 좁힘)
    cond := case t
      when 'profiles'       then 'id is distinct from auth.uid()'
      when 'tarot_readings' then 'user_id is distinct from auth.uid()'
      else 'true' end;

    -- UPDATE: 0행이어야 함
    select column_name into col from information_schema.columns
     where table_schema = 'public' and table_name = t and is_generated = 'NEVER' and identity_generation is null
     order by ordinal_position limit 1;
    execute format('update public.%I set %I = %I where %s', t, col, col, cond);
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: [%] % 직접 UPDATE % 행 바뀜', p_who, t, n; end if;

    -- DELETE: 0행이어야 함
    execute format('delete from public.%I where %s', t, cond);
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: [%] % 직접 DELETE % 행 지움', p_who, t, n; end if;

    checked := checked + 1;
  end loop;
  raise notice 'PASS: [%] 테이블 %개 직접 INSERT 42501 / UPDATE·DELETE 0행', p_who, checked;
  return checked;
end $$;

-- 읽기 매트릭스: 남의 개인 데이터가 0건이어야 함
-- user_id가 있는 테이블은 "내 것이 아닌 행", profiles는 "내가 아닌 사람", 정책이 없는 테이블은 전체
create function pg_temp.read_matrix(p_who text, p_skip text[] default '{}') returns int language plpgsql as $$
declare
  t text; n int; checked int := 0;
begin
  for t in
    select c.table_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'user_id'
       and c.table_name in (select tablename from pg_tables where schemaname = 'public')
     order by 1
  loop
    if t = any(p_skip) then continue; end if;
    execute format('select count(*) from public.%I where user_id is distinct from auth.uid()', t) into n;
    if n <> 0 then raise exception 'FAIL: [%] % 에서 남의 행 %건이 보임', p_who, t, n; end if;
    checked := checked + 1;
  end loop;

  select count(*) into n from public.profiles where id is distinct from auth.uid();
  if n <> 0 then raise exception 'FAIL: [%] 남의 프로필 %건이 보임', p_who, n; end if;
  select count(*) into n from public.redeem_requests;
  if n <> 0 then raise exception 'FAIL: [%] redeem_requests(함수 전용) %건이 보임', p_who, n; end if;
  select count(*) into n from public.daily_visitors;
  if n <> 0 then raise exception 'FAIL: [%] 일일 방문자 통계 %건이 보임 (관리자 전용)', p_who, n; end if;
  if to_regclass('public.audit_logs') is not null then
    execute 'select count(*) from public.audit_logs' into n;
    if n <> 0 then raise exception 'FAIL: [%] 감사 로그 %건이 보임 (관리자 전용)', p_who, n; end if;
  end if;

  raise notice 'PASS: [%] 남의 데이터 0건 (user_id 테이블 %개 + 프로필 + redeem_requests + daily_visitors + audit_logs)', p_who, checked;
  return checked;
end $$;

grant execute on function pg_temp.login(uuid), pg_temp.as_anon(), pg_temp.logout(),
  pg_temp.write_matrix(text), pg_temp.read_matrix(text, text[]) to authenticated, anon;

do $$
declare
  a  uuid := '00000000-0000-0000-0000-00000000050a';
  b  uuid := '00000000-0000-0000-0000-00000000050b';
  o1 uuid := '00000000-0000-0000-0000-0000000005c1';
  o2 uuid := '00000000-0000-0000-0000-0000000005c2';
  ad uuid := '00000000-0000-0000-0000-0000000005ad';
  v_code text; n int; t text; f text;
begin
  -- ── 0-1. 실수 방지 자동 점검 (새 테이블·함수를 추가할 때 열어 두는 실수를 잡음) ──
  select count(*), string_agg(c.relname, ', ') into n, t
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if n <> 0 then raise exception 'FAIL: RLS가 꺼진 테이블: %', t; end if;
  raise notice 'PASS: public 테이블 전부 RLS 켜짐';

  select count(*), string_agg(p.proname, ', ') into n, t
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');
  if n <> 0 then raise exception 'FAIL: search_path 고정 안 된 SECURITY DEFINER 함수: %', t; end if;
  raise notice 'PASS: SECURITY DEFINER 함수 전부 search_path 고정';

  select count(*), string_agg(p.proname, ', ') into n, t
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prosecdef
     and p.proname not in ('my_role', 'my_shop')
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n <> 0 then raise exception 'FAIL: 비로그인이 실행할 수 있는 SECURITY DEFINER 함수: %', t; end if;
  raise notice 'PASS: 비로그인이 실행 가능한 SECURITY DEFINER 함수 = my_role·my_shop(정책용)뿐';

  select count(*), string_agg(c.relname, ', ') into n, t
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any(c.reloptions), false);
  if n <> 0 then raise exception 'FAIL: security_invoker 없는 뷰(만든 사람 권한으로 RLS 우회): %', t; end if;
  raise notice 'PASS: public 뷰 전부 security_invoker';

  -- ── 0-2. A가 모든 종류의 개인 데이터를 하나씩 만든다 ──
  perform pg_temp.login(a);
  perform public.collect_stamp('spot_busstop');          -- stamps + coupons(분식)
  perform public.start_activity('jm_hoop');              -- activity_sessions
  perform public.log_access();                           -- access_logs
  perform public.save_appearance('{"hat":"red"}');       -- profiles.appearance
  perform public.save_tarot_reading('couple', array['major_06'], '매트릭스 검증', null);  -- tarot_readings
  select code into v_code from public.coupons where user_id = a limit 1;
  if v_code is null then raise exception 'FAIL: 준비 단계에서 A의 쿠폰이 안 만들어짐'; end if;
  perform pg_temp.login(o1);
  perform public.redeem_coupon(v_code, gen_random_uuid());  -- redeem_requests
  raise notice 'PASS: 준비 — A의 스탬프·쿠폰·체험·접속·꾸미기·타로·쿠폰 사용 기록 생성';

  -- ── 1. 다른 순례객 B: 남의 것 못 보고, 어떤 테이블도 직접 못 씀 ──
  perform pg_temp.login(b);
  perform pg_temp.read_matrix('순례객B');
  perform pg_temp.write_matrix('순례객B');

  -- ── 2. 다른 가게 사장님 o2: A의 쿠폰은 분식 가게 것이라 안 보여야 함 ──
  perform pg_temp.login(o2);
  perform pg_temp.read_matrix('소란 사장님');
  perform pg_temp.write_matrix('소란 사장님');

  -- ── 3. 그 가게 사장님 o1: 자기 가게 쿠폰만 보이고, 나머지 개인 데이터는 0건 ──
  perform pg_temp.login(o1);
  select count(*) into n from public.coupons where user_id = a;
  if n <> 1 then raise exception 'FAIL: 분식 사장님이 자기 가게 쿠폰을 못 봄 (%)', n; end if;
  perform pg_temp.read_matrix('분식 사장님', array['coupons']);
  perform pg_temp.write_matrix('분식 사장님');
  raise notice 'PASS: [분식 사장님] 자기 가게 쿠폰 1건만 보임 (의도된 권한)';

  -- ── 4. 비로그인 ──
  perform pg_temp.as_anon();
  perform pg_temp.read_matrix('비로그인');
  perform pg_temp.write_matrix('비로그인');
  for f in select unnest(array[
      $q$select public.collect_stamp('spot_mural')$q$,
      $q$select public.redeem_coupon('ABCDEF', gen_random_uuid())$q$,
      $q$select public.get_shop_stats()$q$,
      $q$select public.start_activity('jm_hoop')$q$,
      $q$select public.log_access()$q$,
      $q$select public.save_shop_promo('x', null)$q$,
      $q$select public.save_appearance('{}')$q$,
      $q$select public.save_tarot_reading('couple', array['major_00'], 'x', null)$q$])
  loop
    begin
      execute f;
      raise exception 'FAIL: [비로그인] 실행 성공: %', f;
    exception when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%permission denied%' then
        raise exception 'FAIL: [비로그인] % — 기대 permission denied, 실제 %', f, sqlerrm;
      end if;
    end;
  end loop;
  raise notice 'PASS: [비로그인] 쓰기 함수 8개 모두 permission denied';

  -- ── 5. 관리자: 접속 기록·통계는 보여야 함 (막기만 하고 정작 필요한 사람이 못 보면 안 됨) ──
  perform pg_temp.login(ad);
  select count(*) into n from public.access_logs where user_id = a;
  if n <> 1 then raise exception 'FAIL: 관리자가 접속 기록을 못 봄 (%)', n; end if;
  select count(*) into n from public.daily_visitors;
  if n = 0 then raise exception 'FAIL: 관리자가 일일 방문자 통계를 못 봄'; end if;
  perform pg_temp.write_matrix('관리자');
  raise notice 'PASS: [관리자] 접속 기록·통계 조회 가능, 직접 쓰기는 관리자도 막힘';

  perform pg_temp.logout();
  raise notice '========== 권한 우회 매트릭스 모두 통과 ==========';
end $$;

rollback;
