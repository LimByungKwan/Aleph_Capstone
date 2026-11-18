-- ============================================================================
-- jm_core 규칙 검증 (담당: 지민)
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터는 남지 않음
-- 실패하면 그 자리에서 'FAIL: …' 에러로 멈춤. 성공하면 NOTICE로 PASS 목록이 보임
--
-- 사용자 흉내: request.jwt.claims(sub) + role authenticated  ← Supabase가 실제로 쓰는 방식과 같음
-- ============================================================================
begin;

-- 테스트용 사용자 5명 (가입 트리거가 profiles를 만들어 줌)
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"display_name":"순례객A"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"display_name":"순례객B"}'),
  ('00000000-0000-0000-0000-0000000000c1', '{"display_name":"분식 사장님"}'),
  ('00000000-0000-0000-0000-0000000000c2', '{"display_name":"소란 사장님"}'),
  ('00000000-0000-0000-0000-0000000000ad', '{"display_name":"관리자"}');
-- 역할 지정은 관리자(여기서는 DB 소유자)만
update public.profiles set role = 'owner', shop_id = 'shop_hj_snack' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set role = 'owner', shop_id = 'cafe_soran'    where id = '00000000-0000-0000-0000-0000000000c2';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';

-- 도우미: 특정 사용자로 전환 / 원래대로
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
grant execute on function pg_temp.login(uuid), pg_temp.logout() to authenticated, anon;

-- 도우미: 이 SQL이 이 에러 코드로 실패해야 함
create function pg_temp.expect_error(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL: % — 에러가 나야 하는데 성공함', p_label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm <> p_code and sqlerrm not like '%' || p_code || '%' then
    raise exception 'FAIL: % — 기대 %, 실제 %', p_label, p_code, sqlerrm;
  end if;
  raise notice 'PASS: % (%)', p_label, p_code;
end $$;
grant execute on function pg_temp.expect_error(text, text, text) to authenticated, anon;

do $$
declare
  a  uuid := '00000000-0000-0000-0000-00000000000a';
  b  uuid := '00000000-0000-0000-0000-00000000000b';
  o1 uuid := '00000000-0000-0000-0000-0000000000c1';
  o2 uuid := '00000000-0000-0000-0000-0000000000c2';
  ad uuid := '00000000-0000-0000-0000-0000000000ad';
  r jsonb; v_code text; n int; sid uuid;
  k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid();
begin
  -- ── 스탬프 ──
  perform pg_temp.login(a);
  r := public.collect_stamp('spot_busstop');
  if jsonb_array_length(r -> 'issuedCoupons') <> 1 then raise exception 'FAIL: 쿠폰 1장 발급 기대, 실제 %', r; end if;
  if r -> 'issuedCoupons' -> 0 ->> 'shopId' <> 'shop_hj_snack' then raise exception 'FAIL: 같은 구역·작품 가게 쿠폰이어야 함 %', r; end if;
  raise notice 'PASS: 촬영지 스탬프 → 같은 구역+작품 가게 쿠폰 1장 (다른 구역 cafe_soran은 제외)';
  v_code := r -> 'issuedCoupons' -> 0 ->> 'code';

  perform pg_temp.expect_error($q$ select public.collect_stamp('spot_busstop') $q$, 'ALREADY_STAMPED', '같은 스탬프 두 번');
  perform pg_temp.expect_error($q$ select public.collect_stamp('npc_guide') $q$, 'NOT_STAMPABLE', 'NPC 스탬프');
  perform pg_temp.expect_error($q$ select public.collect_stamp('nope') $q$, 'NOT_FOUND', '없는 장소');

  -- 직접 쓰기는 막힘 (RPC로만)
  perform pg_temp.expect_error(
    format($q$ insert into public.stamps (user_id, place_id) values (%L, 'spot_mural') $q$, a),
    'row-level security', '스탬프 테이블 직접 INSERT');
  -- UPDATE는 정책이 없으면 에러 대신 0행이 됨
  update public.coupons c set used_at = now(), used_by = a where c.code = v_code;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: 순례객이 쿠폰을 직접 사용 처리함 (% 행)', n; end if;
  raise notice 'PASS: 쿠폰 직접 UPDATE → 0행 (RLS 쓰기 정책 없음)';

  -- 역할 스스로 올리기 차단
  perform pg_temp.expect_error(format($q$ update public.profiles set role = 'admin' where id = %L $q$, a), 'FORBIDDEN', '스스로 관리자 되기');

  -- 남의 데이터는 안 보임
  select count(*) into n from public.coupons; if n <> 1 then raise exception 'FAIL: A는 자기 쿠폰 1장만 봐야 함 (%)', n; end if;
  perform pg_temp.login(b);
  select count(*) into n from public.coupons; if n <> 0 then raise exception 'FAIL: B가 남의 쿠폰을 봄 (%)', n; end if;
  select count(*) into n from public.stamps;  if n <> 0 then raise exception 'FAIL: B가 남의 스탬프를 봄 (%)', n; end if;
  select count(*) into n from public.profiles; if n <> 1 then raise exception 'FAIL: B는 자기 프로필만 (%)', n; end if;
  raise notice 'PASS: 다른 순례객의 쿠폰·스탬프·프로필 안 보임 (RLS)';
  perform pg_temp.expect_error(format($q$ select public.redeem_coupon(%L, gen_random_uuid()) $q$, v_code), 'NOT_OWNER', '순례객이 쿠폰 사용 처리');

  -- ── 쿠폰 사용 (사장님) ──
  perform pg_temp.login(o2);   -- 다른 가게(BK 소란 커피) 사장님
  select count(*) into n from public.coupons; if n <> 0 then raise exception 'FAIL: 다른 가게 사장님이 쿠폰을 봄 (%)', n; end if;
  perform pg_temp.expect_error(format($q$ select public.redeem_coupon(%L, gen_random_uuid()) $q$, v_code), 'WRONG_SHOP', '다른 가게 쿠폰 사용 처리');

  perform pg_temp.login(o1);
  select count(*) into n from public.coupons; if n <> 1 then raise exception 'FAIL: 우리 가게 쿠폰은 보여야 함 (%)', n; end if;
  perform pg_temp.expect_error($q$ select public.redeem_coupon('ab', gen_random_uuid()) $q$, 'INVALID_CODE', '잘못된 형식 코드');
  perform pg_temp.expect_error($q$ select public.redeem_coupon('ZZZZZZ', gen_random_uuid()) $q$, 'NOT_FOUND', '없는 코드');
  r := public.redeem_coupon(lower(v_code), k1);           -- 소문자로 입력해도 됨
  if (r ->> 'replayed')::boolean then raise exception 'FAIL: 첫 사용이 replayed로 나옴'; end if;
  r := public.redeem_coupon(v_code, k1);                  -- 같은 요청 재시도
  if not (r ->> 'replayed')::boolean then raise exception 'FAIL: 같은 멱등성 키는 처음 결과를 돌려줘야 함'; end if;
  raise notice 'PASS: 같은 멱등성 키로 재시도 → 에러 없이 같은 결과 (replayed)';
  perform pg_temp.expect_error(format($q$ select public.redeem_coupon(%L, %L) $q$, v_code, k2), 'COUPON_USED', '새 요청으로 두 번째 사용');

  r := public.get_shop_stats();
  if (r ->> 'issued')::int <> 1 or (r ->> 'used')::int <> 1 or (r ->> 'visitors')::int <> 1 then raise exception 'FAIL: 통계 %', r; end if;
  raise notice 'PASS: 사장님 통계 issued=1 used=1 visitors=1';

  -- 유효기간 지난 쿠폰
  perform pg_temp.logout();
  insert into public.coupons (code, user_id, shop_id, title, discount, valid_until)
  values ('EXPRD2', b, 'shop_hj_snack', '지난 쿠폰', 'GIFT', public.kst_today() - 1);
  perform pg_temp.login(o1);
  perform pg_temp.expect_error($q$ select public.redeem_coupon('EXPRD2', gen_random_uuid()) $q$, 'COUPON_EXPIRED', '유효기간 지난 쿠폰');

  -- ── 체험 완료 ──
  perform pg_temp.login(a);
  sid := public.start_activity('jm_hoop');
  perform pg_temp.expect_error(format($q$ select public.complete_activity(%L) $q$, sid), 'TOO_FAST', '시작하자마자 완료 (가짜 기록)');
  perform pg_temp.logout();
  update public.activity_sessions set started_at = now() - interval '1 minute' where id = sid;   -- 1분 지난 것으로
  perform pg_temp.login(a);
  r := public.complete_activity(sid);
  if (r ->> 'alreadyCompleted')::boolean then raise exception 'FAIL: 첫 완료인데 alreadyCompleted %', r; end if;
  r := public.complete_activity(sid);
  if not (r ->> 'alreadyCompleted')::boolean then raise exception 'FAIL: 두 번째는 alreadyCompleted여야 함 %', r; end if;
  raise notice 'PASS: 체험 완료 1회만 기록, 두 번째는 alreadyCompleted';
  perform pg_temp.login(b);
  perform pg_temp.expect_error(format($q$ select public.complete_activity(%L) $q$, sid), 'NOT_FOUND', '남의 체험 기록으로 완료');

  -- ── 접속 기록 · 일일 순 방문자 (한국 날짜) ──
  perform pg_temp.login(a); perform public.log_access(); perform public.log_access();
  perform pg_temp.login(b); perform public.log_access();
  select count(*) into n from public.access_logs; if n <> 0 then raise exception 'FAIL: 순례객이 접속 기록을 봄 (%)', n; end if;
  perform pg_temp.login(ad);
  select visitors into n from public.daily_visitors where kst_date = public.kst_today();
  if n <> 2 then raise exception 'FAIL: 순 방문자 2명이어야 함 (%)', n; end if;
  raise notice 'PASS: 일일 순 방문자 = 2명 (A 2번 + B 1번), 관리자만 조회';

  -- ── 로그인 안 한 사람 ──
  perform pg_temp.logout();
  perform set_config('role', 'anon', true);
  perform pg_temp.expect_error($q$ select public.collect_stamp('spot_mural') $q$, 'permission denied', '비로그인 스탬프 (실행 권한 없음)');
  select count(*) into n from public.places; if n = 0 then raise exception 'FAIL: 비로그인도 장소 목록은 봐야 함'; end if;
  raise notice 'PASS: 비로그인은 장소만 읽기 가능';
  perform pg_temp.logout();

  raise notice '========== 모든 검사 통과 ==========';
end $$;

rollback;
