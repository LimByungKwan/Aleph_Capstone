-- ============================================================================
-- 워프존 활성화 기록 검증 (담당: 지민) — 20261127120000_jm_warp_unlocks.sql 실행 후
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터는 남지 않음
-- 실패하면 'FAIL: …' 에러로 멈춤. 성공하면 NOTICE로 PASS 목록이 보이고 맨 끝에 '완료' 한 줄
-- ============================================================================
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', '{"display_name":"워프A"}'),
  ('00000000-0000-0000-0000-0000000000e2', '{"display_name":"워프B"}');

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
  n int;
  first_at timestamptz;
begin
  -- 켜기 → 내 목록
  perform pg_temp.login(a);
  r := public.unlock_warp('warp_jm');
  if r <> '["warp_jm"]'::jsonb then raise exception 'FAIL: 첫 켜기 응답 %', r; end if;
  r := public.unlock_warp('warp_bk');
  if r <> '["warp_bk", "warp_jm"]'::jsonb then raise exception 'FAIL: 두 번째 켜기 응답 % (id 순서여야 함)', r; end if;
  raise notice 'PASS: 켜기 → 내가 켠 id 목록 (id 순서)';

  -- 중복 켜기: 에러 없이 그대로, 처음 켠 시각 유지
  select unlocked_at into first_at from public.warp_unlocks where user_id = a and warp_id = 'warp_jm';
  r := public.unlock_warp('warp_jm');
  if r <> '["warp_bk", "warp_jm"]'::jsonb then raise exception 'FAIL: 중복 켜기 응답 %', r; end if;
  select count(*) into n from public.warp_unlocks where user_id = a;
  if n <> 2 then raise exception 'FAIL: 중복 켜기로 줄이 늘어남 (%)', n; end if;
  if (select unlocked_at from public.warp_unlocks where user_id = a and warp_id = 'warp_jm') <> first_at then
    raise exception 'FAIL: 중복 켜기로 처음 시각이 바뀜';
  end if;
  raise notice 'PASS: 중복 켜기는 그대로 (줄·시각 유지)';

  -- 이상한 id 거부
  perform pg_temp.expect_error($q$select public.unlock_warp('warp_xx')$q$, 'INVALID_INPUT', '목록에 없는 id 거부');
  perform pg_temp.expect_error($q$select public.unlock_warp('WARP_BK')$q$, 'INVALID_INPUT', '대문자 id 거부');
  perform pg_temp.expect_error($q$select public.unlock_warp(null)$q$, 'INVALID_INPUT', 'null 거부');
  perform pg_temp.expect_error($q$select public.unlock_warp('<script>')$q$, 'INVALID_INPUT', '스크립트 문자열 거부');

  -- 표에 직접 쓰기 막힘 (함수 검사 우회 방지)
  perform pg_temp.expect_error(format($q$insert into public.warp_unlocks (user_id, warp_id) values (%L, 'warp_sg')$q$, a),
    'row-level security', '직접 insert 거부');
  delete from public.warp_unlocks where user_id = a;
  select count(*) into n from public.warp_unlocks where user_id = a;
  if n <> 2 then raise exception 'FAIL: 직접 delete가 됨 (남은 %)', n; end if;
  raise notice 'PASS: 직접 delete는 0줄 (정책 없음)';

  -- 남의 기록은 안 보임
  perform pg_temp.login(b);
  select count(*) into n from public.warp_unlocks;
  if n <> 0 then raise exception 'FAIL: B에게 A 기록이 보임 (%개)', n; end if;
  r := public.unlock_warp('warp_hj');
  if r <> '["warp_hj"]'::jsonb then raise exception 'FAIL: B 응답에 A 기록이 섞임 %', r; end if;
  raise notice 'PASS: 남의 기록은 안 보이고, 응답에도 내 것만';

  -- 손님(비로그인) 거부
  perform pg_temp.logout();
  perform set_config('role', 'anon', true);
  perform pg_temp.expect_error($q$select public.unlock_warp('warp_bk')$q$, 'permission denied', '로그인 안 한 사람(anon) 함수 거부');
  select count(*) into n from public.warp_unlocks;
  if n <> 0 then raise exception 'FAIL: anon에게 기록이 보임 (%개)', n; end if;
  raise notice 'PASS: 로그인 안 한 사람(anon)에게 기록 0건';
  perform pg_temp.logout();
  raise notice '=== jm_warp_unlocks 검증 모두 통과 ===';
end $$;

rollback;
select '완료' as result;
