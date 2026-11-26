-- ============================================================================
-- 계정당 로그인 1곳 검증 (담당: 지민) — 20261130120000_jm_single_session.sql 실행 후
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터는 남지 않음
-- 실패하면 'FAIL: …' 에러로 멈춤. 성공하면 NOTICE로 PASS 목록이 보이고 맨 끝에 '완료' 한 줄
-- ============================================================================
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', '{"display_name":"세션A"}'),
  ('00000000-0000-0000-0000-0000000000f2', '{"display_name":"세션B"}');

-- p_session: 토큰의 session_id (로그인 1번 = 새 값). null이면 session_id 없는 토큰 흉내
create function pg_temp.login(p_user uuid, p_session uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_strip_nulls(jsonb_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_session))::text, true);
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
grant execute on function pg_temp.login(uuid, uuid), pg_temp.as_anon(), pg_temp.logout(),
  pg_temp.expect_error(text, text, text) to authenticated, anon;

do $$
declare
  a  uuid := '00000000-0000-0000-0000-0000000000f1';
  b  uuid := '00000000-0000-0000-0000-0000000000f2';
  s1 uuid := '11111111-1111-1111-1111-111111111111';  -- A의 첫 기기
  s2 uuid := '22222222-2222-2222-2222-222222222222';  -- A의 두 번째 기기
  s3 uuid := '33333333-3333-3333-3333-333333333333';  -- A의 세 번째 로그인
  sb uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  r jsonb;
  n int;
begin
  -- ── 1. 기능 배포 전부터 로그인해 있던 사람(기록 없음)은 그대로 통과 ──
  perform pg_temp.login(a, s1);
  if not public.session_ok() then raise exception 'FAIL: 기록이 없는데 session_ok가 거짓'; end if;
  perform public.save_appearance('{"hat":"red"}');
  raise notice 'PASS: 기록 없음 → 통과 (배포 전 로그인한 사람이 갑자기 끊기지 않음)';

  -- ── 2. 첫 로그인 기록 ──
  r := public.claim_session();
  if r <> '{"replaced": false}'::jsonb then raise exception 'FAIL: 첫 claim 응답 %', r; end if;
  if not public.session_ok() then raise exception 'FAIL: 방금 기록한 세션이 거짓'; end if;
  r := public.claim_session();  -- 같은 세션으로 다시 (재시도)
  if r <> '{"replaced": false}'::jsonb then raise exception 'FAIL: 같은 세션 재claim이 replaced로 나옴 %', r; end if;
  raise notice 'PASS: 첫 로그인 → replaced=false, 같은 세션 재시도도 false';

  -- ── 3. 다른 기기에서 로그인 → 이전 기기를 끊고 감사 로그 ──
  perform pg_temp.login(a, s2);
  r := public.claim_session();
  if r <> '{"replaced": true}'::jsonb then raise exception 'FAIL: 두 번째 기기 claim 응답 %', r; end if;
  perform pg_temp.logout();
  select count(*) into n from public.audit_logs
   where action = 'session_replaced' and actor = a and target_id = a::text
     and before = '{"session": "11111111"}'::jsonb and after = '{"session": "22222222"}'::jsonb;
  if n <> 1 then raise exception 'FAIL: session_replaced 감사 로그 %건 (1건이어야 함)', n; end if;
  raise notice 'PASS: 두 번째 기기 로그인 → replaced=true + 감사 로그(세션 앞 8자리만)';

  -- ── 4. 끊긴 첫 기기: 서버를 건너뛰고 DB를 직접 불러도 쓰기 막힘 (두 번째 겹) ──
  perform pg_temp.login(a, s1);
  if public.session_ok() then raise exception 'FAIL: 끊긴 세션이 session_ok 참'; end if;
  perform pg_temp.expect_error($q$select public.save_appearance('{"hat":"blue"}')$q$, 'SESSION_REPLACED', '끊긴 기기 꾸미기 저장');
  perform pg_temp.expect_error($q$select public.collect_stamp('spot_busstop')$q$, 'SESSION_REPLACED', '끊긴 기기 스탬프');
  perform pg_temp.expect_error($q$select public.unlock_warp('warp_jm')$q$, 'SESSION_REPLACED', '끊긴 기기 워프');
  -- 끊긴 기기가 로그아웃을 눌러도 새 기기 기록은 그대로
  perform public.release_session();
  perform pg_temp.login(a, s2);
  if not public.session_ok() then raise exception 'FAIL: 옛 기기 로그아웃이 새 기기를 끊음'; end if;
  raise notice 'PASS: 옛 기기 로그아웃은 새 기기 기록을 건드리지 않음';

  -- ── 5. 지금 기기는 정상 ──
  perform public.save_appearance('{"hat":"green"}');
  perform public.collect_stamp('spot_busstop');
  raise notice 'PASS: 현재 기기는 꾸미기·스탬프 정상';

  -- ── 6. 로그아웃하면 아무 토큰도 유효하지 않음 (옛 기기가 되살아나지 않음) ──
  perform public.release_session();
  if public.session_ok() then raise exception 'FAIL: 로그아웃한 세션이 아직 참'; end if;
  perform pg_temp.login(a, s1);
  if public.session_ok() then raise exception 'FAIL: 로그아웃 뒤 옛 기기(s1)가 되살아남'; end if;
  raise notice 'PASS: 로그아웃 뒤에는 이전·옛 세션 모두 거짓';

  -- 로그아웃 뒤 새로 로그인 → replaced=false, 감사 로그 안 늘어남
  perform pg_temp.login(a, s3);
  r := public.claim_session();
  if r <> '{"replaced": false}'::jsonb then raise exception 'FAIL: 로그아웃 뒤 로그인이 replaced로 나옴 %', r; end if;
  perform pg_temp.logout();
  select count(*) into n from public.audit_logs where action = 'session_replaced' and actor = a;
  if n <> 1 then raise exception 'FAIL: 로그아웃 뒤 로그인에 감사 로그가 생김 (%건)', n; end if;
  raise notice 'PASS: 로그아웃 → 다시 로그인은 "끊음"으로 기록되지 않음';

  -- ── 7. 다른 사람은 영향 없음 + 표는 아무도 직접 못 봄·못 씀 ──
  perform pg_temp.login(b, sb);
  perform public.claim_session();
  perform public.save_appearance('{"hat":"b"}');
  select count(*) into n from public.user_sessions;
  if n <> 0 then raise exception 'FAIL: user_sessions가 %건 보임 (함수 전용이어야 함)', n; end if;
  perform pg_temp.expect_error(format($q$insert into public.user_sessions (user_id, session_id) values (%L, %L)$q$, b, s1),
    'row-level security', 'user_sessions 직접 쓰기');
  -- 다른 사람의 세션 id를 알아도 내 계정 기록만 바뀜 (claim은 auth.uid() 기준)
  perform pg_temp.login(a, s3);
  if not public.session_ok() then raise exception 'FAIL: B의 로그인이 A를 끊음'; end if;
  raise notice 'PASS: B 로그인은 A와 무관, user_sessions는 0건 보임·직접 쓰기 막힘';

  -- ── 8. session_id 없는 토큰(SQL Editor·로컬 검증)과 비로그인 ──
  perform pg_temp.login(a, null);
  if not public.session_ok() then raise exception 'FAIL: session_id 없는 요청이 거짓'; end if;
  perform pg_temp.expect_error('select public.claim_session()', 'UNAUTHORIZED', 'session_id 없는 claim');
  perform pg_temp.as_anon();
  perform pg_temp.expect_error('select public.claim_session()', 'permission denied', '비로그인 claim');
  perform pg_temp.expect_error('select public.require_user()', 'permission denied', '비로그인 require_user (실행 권한부터 없음)');
  perform pg_temp.logout();
end $$;

select '완료' as result;
rollback;
