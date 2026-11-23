-- ============================================================================
-- 커플 타로 결과 저장 검증 (담당: 지민) — 20261124120000_jm_tarot_readings.sql 실행 후
-- Supabase SQL Editor에 통째로 붙여 실행 → 마지막에 rollback이라 데이터는 남지 않음
-- 실패하면 'FAIL: …' 에러로 멈춤. 성공하면 NOTICE로 PASS 목록이 보임
-- ============================================================================
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', '{"display_name":"타로A"}'),
  ('00000000-0000-0000-0000-0000000000f2', '{"display_name":"타로B"}');

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
  a uuid := '00000000-0000-0000-0000-0000000000f1';
  b uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb;
  n int;
  first_id uuid;
begin
  -- 저장하면 화면용 모양으로 돌려줌
  perform pg_temp.login(a);
  r := public.save_tarot_reading('couple', array['major_06','major_17'], '  서로의 속도를 맞춰 가는 시기예요.  ', '{"questionIds":["q03","q07"]}');
  if r->>'spread' <> 'couple' or r->'cards' <> '["major_06","major_17"]'::jsonb
     or r->>'summary' <> '서로의 속도를 맞춰 가는 시기예요.' or r->'detail' <> '{"questionIds":["q03","q07"]}'::jsonb
     or r->>'createdAt' is null or r->>'id' is null then
    raise exception 'FAIL: 저장 응답 %', r;
  end if;
  first_id := (r->>'id')::uuid;
  raise notice 'PASS: 저장 → { id, spread, cards, summary(앞뒤 공백 제거), detail, createdAt }';

  r := public.save_tarot_reading('couple', array['major_00'], '새 출발', null);
  if r->'detail' <> '{}'::jsonb then raise exception 'FAIL: detail null → {} 아님: %', r; end if;
  raise notice 'PASS: detail 생략(null) → {}';

  -- 형식 검사
  perform pg_temp.expect_error($q$select public.save_tarot_reading('Couple!', array['major_00'], 'x')$q$, 'INVALID_INPUT', 'spread 형식 거부');
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array[]::text[], 'x')$q$, 'INVALID_INPUT', '카드 0장 거부');
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array['a','b','c','d','e','f','g','h','i','j','k'], 'x')$q$, 'INVALID_INPUT', '카드 11장 거부');
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array['<script>'], 'x')$q$, 'INVALID_INPUT', '카드 id 형식 거부');
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array['major_00', null], 'x')$q$, 'INVALID_INPUT', '카드 null 거부');
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array['major_00'], '   ')$q$, 'INVALID_INPUT', '빈 요약 거부');
  perform pg_temp.expect_error(format('select public.save_tarot_reading(%L, array[%L], %L)', 'couple', 'major_00', repeat('가', 1001)), 'INVALID_INPUT', '요약 1001자 거부');
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array['major_00'], 'x', '[1]')$q$, 'INVALID_INPUT', 'detail 배열 거부');
  perform pg_temp.expect_error(format('select public.save_tarot_reading(%L, array[%L], %L, %L::jsonb)', 'couple', 'major_00', 'x',
    json_build_object('memo', repeat('a', 5000))::text), 'TOO_LARGE', 'detail 4KB 초과 거부');

  -- 표에 직접 쓰기 막힘 (함수 검사 우회 방지)
  perform pg_temp.expect_error(format($q$insert into public.tarot_readings (user_id, spread, cards, summary) values (%L, 'couple', array['major_00'], 'x')$q$, a),
    'row-level security', '직접 insert 거부');
  update public.tarot_readings set summary = '조작' where id = first_id;
  if exists (select 1 from public.tarot_readings where summary = '조작') then raise exception 'FAIL: 직접 update가 됨'; end if;
  raise notice 'PASS: 직접 update는 0줄 (정책 없음)';

  -- 다른 사람 것은 안 보이고 못 지움
  perform pg_temp.login(b);
  select count(*) into n from public.tarot_readings;
  if n <> 0 then raise exception 'FAIL: B에게 A 기록이 보임 (%개)', n; end if;
  delete from public.tarot_readings where id = first_id;
  perform pg_temp.login(a);
  if not exists (select 1 from public.tarot_readings where id = first_id) then raise exception 'FAIL: B가 A 기록을 지움'; end if;
  raise notice 'PASS: 남의 기록은 안 보이고 못 지움';

  -- 본인 것은 지울 수 있음
  delete from public.tarot_readings where id = first_id;
  if exists (select 1 from public.tarot_readings where id = first_id) then raise exception 'FAIL: 본인 삭제 안 됨'; end if;
  raise notice 'PASS: 본인 기록 삭제';

  -- 1시간 20번 제한 (지금 1개 남아 있음 → 19개 더 저장 후 21번째는 거부)
  for i in 1..19 loop perform public.save_tarot_reading('couple', array['major_01'], '반복 ' || i); end loop;
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array['major_01'], '21번째')$q$, 'TOO_MANY_REQUESTS', '1시간 20번 넘으면 거부');

  -- 최근 30개만 남김: 기존 20개를 하루 전으로 옮기고(관리자 권한) 15개 더 저장 → 35개가 아니라 30개
  perform pg_temp.logout();
  update public.tarot_readings set created_at = now() - interval '1 day' where user_id = a;
  perform pg_temp.login(a);
  for i in 1..15 loop perform public.save_tarot_reading('couple', array['major_02'], '새 기록 ' || i); end loop;
  select count(*) into n from public.tarot_readings where user_id = a;
  if n <> 30 then raise exception 'FAIL: 보관 개수 % (30이어야 함)', n; end if;
  select count(*) into n from public.tarot_readings where user_id = a and cards = array['major_02'];
  if n <> 15 then raise exception 'FAIL: 새 기록이 지워짐 (남은 새 기록 %)', n; end if;
  raise notice 'PASS: 최근 30개만 남고 오래된 것부터 지워짐';

  -- 로그인 안 하면 거부
  perform pg_temp.logout();
  perform set_config('role', 'anon', true);
  perform pg_temp.expect_error($q$select public.save_tarot_reading('couple', array['major_00'], 'x')$q$, 'permission denied', '로그인 안 한 사람(anon) 거부');
  perform pg_temp.logout();
  raise notice '=== jm_tarot_readings 검증 모두 통과 ===';
end $$;

rollback;
