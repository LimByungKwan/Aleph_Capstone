-- ============================================================================
-- 감사 로그 검증 (담당: 지민) — 20261125120000_jm_audit_log.sql 실행 후
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터는 남지 않음
-- 실패하면 'FAIL: …' 에러로 멈춤. 성공하면 NOTICE로 PASS 목록이 보임
-- ============================================================================
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000060a', '{"display_name":"감사 순례객"}'),
  ('00000000-0000-0000-0000-0000000006c1', '{"display_name":"감사 사장님"}'),
  ('00000000-0000-0000-0000-0000000006ad', '{"display_name":"감사 관리자"}');

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

do $$
declare
  a  uuid := '00000000-0000-0000-0000-00000000060a';
  o1 uuid := '00000000-0000-0000-0000-0000000006c1';
  ad uuid := '00000000-0000-0000-0000-0000000006ad';
  r public.audit_logs; n int; v_code text;
begin
  -- ── 1. 역할 변경 (SQL Editor에서 관리자가 바꾸는 상황) → 기록됨 ──
  update public.profiles set role = 'owner', shop_id = 'shop_hj_snack' where id = o1;
  update public.profiles set role = 'admin' where id = ad;
  select * into r from public.audit_logs where action = 'role_change' and target_id = o1::text;
  if not found then raise exception 'FAIL: 사장님 지정이 기록 안 됨'; end if;
  if r.before <> '{"role":"pilgrim","shop_id":null}'::jsonb or r.after <> '{"role":"owner","shop_id":"shop_hj_snack"}'::jsonb then
    raise exception 'FAIL: 역할 변경 before/after 이상: % → %', r.before, r.after;
  end if;
  if r.actor is not null or r.actor_db = 'authenticated' then
    raise exception 'FAIL: SQL Editor 변경인데 actor=% actor_db=%', r.actor, r.actor_db;
  end if;
  raise notice 'PASS: 역할 변경 기록 (before/after, SQL Editor라 actor 없음 · actor_db=%)', r.actor_db;

  -- ── 2. 이름만 바꾸면 기록 안 함 ──
  perform pg_temp.login(a);
  update public.profiles set display_name = '이름만 바꿈' where id = a;
  perform pg_temp.logout();
  select count(*) into n from public.audit_logs where target_id = a::text;
  if n <> 0 then raise exception 'FAIL: 이름 변경까지 기록됨 (%)', n; end if;
  raise notice 'PASS: 이름만 바꾸면 기록 안 함 (개인정보 최소)';

  -- ── 3. 스스로 관리자 되기 시도는 막히고, 막힌 시도는 기록되지 않음(롤백) ──
  perform pg_temp.login(a);
  begin
    update public.profiles set role = 'admin' where id = a;
    raise exception 'FAIL: 스스로 관리자 되기 성공';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  perform pg_temp.logout();
  select count(*) into n from public.audit_logs where target_id = a::text;
  if n <> 0 then raise exception 'FAIL: 막힌 시도가 기록으로 남음 (%)', n; end if;
  raise notice 'PASS: 권한 상승 시도는 FORBIDDEN으로 막히고 기록도 안 남음';

  -- ── 4. 가게 문구: 처음 저장 → 덮어쓰기. 이전 내용이 before에 남아야 함 ──
  perform pg_temp.login(o1);
  perform public.save_shop_promo('첫 문구', 'v1');
  perform public.save_shop_promo('바뀐 문구', 'v2');
  perform pg_temp.logout();
  select count(*) into n from public.audit_logs where action = 'promo_save' and target_id = 'shop_hj_snack';
  if n <> 2 then raise exception 'FAIL: 문구 저장 기록 2건이어야 함 (%)', n; end if;
  select * into r from public.audit_logs where action = 'promo_save' and target_id = 'shop_hj_snack' order by id desc limit 1;
  if r.before->>'text' <> '첫 문구' or r.after->>'text' <> '바뀐 문구' or r.actor <> o1 or r.actor_db <> 'authenticated' then
    raise exception 'FAIL: 문구 덮어쓰기 기록 이상: % → % (actor %, %)', r.before, r.after, r.actor, r.actor_db;
  end if;
  raise notice 'PASS: 문구 덮어쓰기 → 이전 문구가 before에 남음, actor = 사장님';

  -- ── 5. 쿠폰 사용 → 기록 1건, 재시도(같은 키)는 추가 기록 없음 ──
  perform pg_temp.login(a);
  perform public.collect_stamp('spot_busstop');
  select code into v_code from public.coupons where user_id = a;
  perform pg_temp.login(o1);
  declare k uuid := gen_random_uuid(); begin
    perform public.redeem_coupon(v_code, k);
    perform public.redeem_coupon(v_code, k);
  end;
  perform pg_temp.logout();
  select count(*) into n from public.audit_logs where action = 'coupon_redeem';
  if n <> 1 then raise exception 'FAIL: 쿠폰 사용 기록 1건이어야 함 (%)', n; end if;
  raise notice 'PASS: 쿠폰 사용 1건 기록, 같은 요청 재시도는 중복 기록 없음';

  -- ── 6. 읽기: 관리자만. 쓰기: 아무도 못 함 (관리자 포함) ──
  perform pg_temp.login(o1);
  select count(*) into n from public.audit_logs;
  if n <> 0 then raise exception 'FAIL: 사장님이 감사 로그를 봄 (%)', n; end if;
  perform pg_temp.login(a);
  select count(*) into n from public.audit_logs;
  if n <> 0 then raise exception 'FAIL: 순례객이 감사 로그를 봄 (%)', n; end if;
  perform pg_temp.login(ad);
  select count(*) into n from public.audit_logs;
  if n < 4 then raise exception 'FAIL: 관리자가 감사 로그를 못 봄 (%)', n; end if;
  delete from public.audit_logs;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: 관리자가 감사 로그를 지움 (%)', n; end if;
  update public.audit_logs set action = action;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: 관리자가 감사 로그를 고침 (%)', n; end if;
  begin
    insert into public.audit_logs (actor_db, action, target_table, target_id) values ('x', 'role_change', 'profiles', 'fake');
    raise exception 'FAIL: 관리자가 가짜 감사 로그를 넣음';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  perform pg_temp.logout();
  raise notice 'PASS: 감사 로그는 관리자만 읽고, 관리자도 고치기·지우기·가짜 넣기 불가';

  raise notice '=== jm_audit_log 검증 모두 통과 ===';
end $$;

rollback;
