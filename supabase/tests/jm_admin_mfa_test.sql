-- ============================================================================
-- 관리자 2단계 인증 검증 (담당: 지민) — 20261201120000_jm_admin_mfa.sql 실행 후
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터는 남지 않음
-- 실패하면 'FAIL: …' 에러로 멈춤. 성공하면 맨 끝에 '완료' 한 줄
-- ※ auth.mfa_factors에 가짜 인증 수단을 넣어 "등록한 관리자"를 흉내 냄 (rollback으로 지워짐)
-- ============================================================================
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', '{"display_name":"등록한관리자"}'),
  ('00000000-0000-0000-0000-0000000000d2', '{"display_name":"미등록관리자"}'),
  ('00000000-0000-0000-0000-0000000000d3', '{"display_name":"순례객"}');
update public.profiles set role = 'admin'
 where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-0000000000d1', 'totp', 'verified', now(), now()),
  ('00000000-0000-0000-0000-00000000f0d2', '00000000-0000-0000-0000-0000000000d2', 'totp', 'unverified', now(), now());  -- 등록하다 만 것

-- p_aal: 'aal1'(비밀번호만) / 'aal2'(코드까지)
create function pg_temp.login(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
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
grant execute on function pg_temp.login(uuid, text), pg_temp.logout(), pg_temp.expect_error(text, text, text) to authenticated, anon;

do $$
declare
  enrolled   uuid := '00000000-0000-0000-0000-0000000000d1';
  unenrolled uuid := '00000000-0000-0000-0000-0000000000d2';
  pilgrim    uuid := '00000000-0000-0000-0000-0000000000d3';
  n int;
begin
  -- ── 1. 등록한 관리자 + 비밀번호만(aal1) → 관리자 권한 없음 ──
  perform pg_temp.login(enrolled, 'aal1');
  if public.mfa_ok() then raise exception 'FAIL: 등록한 관리자 aal1인데 mfa_ok 참'; end if;
  if public.my_role() <> 'pilgrim' then raise exception 'FAIL: 등록한 관리자 aal1의 my_role = % (pilgrim이어야 함)', public.my_role(); end if;
  perform pg_temp.expect_error('select public.get_admin_stats()', 'NOT_ADMIN', '등록한 관리자 aal1 → 관리자 통계');
  select count(*) into n from public.audit_logs;
  if n <> 0 then raise exception 'FAIL: 등록한 관리자 aal1이 감사 로그 %건을 봄', n; end if;
  select count(*) into n from public.profiles where id <> enrolled;
  if n <> 0 then raise exception 'FAIL: 등록한 관리자 aal1이 남의 프로필 %건을 봄', n; end if;
  -- 남의 프로필은 RLS(본인만 수정)에 걸려 0행 수정으로 조용히 막힘
  update public.profiles set role = 'owner', shop_id = 'shop_hj_snack' where id = pilgrim;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: 등록한 관리자 aal1이 남의 역할을 바꿈 (%행)', n; end if;
  -- 자기 역할 내리기·올리기도 막힘 (guard_profile_update가 관리자 아님으로 봄)
  perform pg_temp.expect_error(format($q$update public.profiles set shop_id = 'shop_hj_snack' where id = %L$q$, enrolled),
    'FORBIDDEN', '등록한 관리자 aal1 → 자기 가게 바꾸기');
  raise notice 'PASS: 등록한 관리자 aal1 → 통계·감사 로그·남의 프로필·역할 변경 모두 막힘';

  -- ── 2. 같은 관리자 + 코드까지(aal2) → 관리자 권한 ──
  perform pg_temp.login(enrolled, 'aal2');
  if not public.mfa_ok() or public.my_role() <> 'admin' then raise exception 'FAIL: 등록한 관리자 aal2가 관리자가 아님'; end if;
  perform public.get_admin_stats();
  select count(*) into n from public.profiles where id <> enrolled;
  if n = 0 then raise exception 'FAIL: 등록한 관리자 aal2가 남의 프로필을 못 봄'; end if;
  raise notice 'PASS: 등록한 관리자 aal2 → 관리자 통계·남의 프로필 읽기 가능';

  -- ── 3. 등록 안 한(하다 만) 관리자는 예전처럼 aal1로도 관리자 ──
  perform pg_temp.login(unenrolled, 'aal1');
  if not public.mfa_ok() or public.my_role() <> 'admin' then raise exception 'FAIL: 미등록 관리자가 관리자 권한을 잃음'; end if;
  perform public.get_admin_stats();
  raise notice 'PASS: 등록 안 한 관리자(검증 안 된 factor만 있음)는 aal1로도 관리자 — 시연 직전 갑자기 막히지 않음';

  -- ── 4. 순례객·사장님은 영향 없음 ──
  perform pg_temp.login(pilgrim, 'aal1');
  if public.my_role() <> 'pilgrim' then raise exception 'FAIL: 순례객 my_role = %', public.my_role(); end if;
  perform public.save_appearance('{"hat":"red"}');
  raise notice 'PASS: 순례객 영향 없음';

  -- ── 5. 다른 사람의 factor는 내 판단에 안 섞임 + 비로그인 ──
  perform pg_temp.logout();
  select count(*) into n from auth.mfa_factors where status = 'verified';
  if n = 0 then raise exception 'FAIL: 준비 — verified factor가 없음'; end if;
  perform pg_temp.login(unenrolled, 'aal1');
  if not public.mfa_ok() then raise exception 'FAIL: 남(등록한 관리자)의 factor 때문에 내가 막힘'; end if;
  perform pg_temp.logout();
  perform set_config('role', 'anon', true);
  perform pg_temp.expect_error('select public.mfa_ok()', 'permission denied', '비로그인 mfa_ok 직접 호출');
  if public.my_role() is not null then raise exception 'FAIL: 비로그인 my_role이 null이 아님'; end if;
  perform pg_temp.logout();
  raise notice 'PASS: 남의 factor와 무관, 비로그인은 mfa_ok 못 부름·my_role null';
end $$;

select '완료' as result;
rollback;
