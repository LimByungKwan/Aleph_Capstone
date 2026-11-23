-- [지민] 관리자 통계 (성근님 관리자 화면 #/admin 이 서버 모드에서 읽음)
-- 응답 모양은 frontend/src/api/client.js getAdminStats 주석과 같음:
--   { todayVisitors, totalStamps, couponsIssued, couponsUsed,
--     dailyVisitors: [{ day, count }]   최근 7일, 오래된 날부터, 빈 날 0 (한국 날짜)
--     stampsByZone:  [{ zone, count }]  많은 순
--     topPlaces:     [{ placeId, name, zone, count }]  최대 5, 많은 순 }
--
-- 판단
--   - 스탬프·쿠폰은 RLS가 "내 것만"이라 관리자도 남의 행을 못 읽음 → security definer로 숫자만 모아서 돌려줌
--     (누가 찍었는지 같은 개인 정보는 내보내지 않음 — 집계 숫자만)
--   - 대신 함수 첫 줄에서 관리자인지 직접 검사 (아니면 NOT_ADMIN)
--   - 방문자 = 로그인 기록(access_logs, 하루 같은 사람 1명). 11/17 팀 결정대로 손님(비로그인)은 세지 않음

create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.kst_today();
begin
  perform public.require_user();
  if coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'NOT_ADMIN' using detail = '관리자 계정만 볼 수 있어요.';
  end if;

  return jsonb_build_object(
    'todayVisitors', (select count(distinct user_id) from public.access_logs where kst_date = v_today),
    'totalStamps',   (select count(*) from public.stamps),
    'couponsIssued', (select count(*) from public.coupons),
    'couponsUsed',   (select count(*) from public.coupons where used_at is not null),
    'dailyVisitors', (
      select jsonb_agg(jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'count', coalesce(v.cnt, 0)) order by d.day)
      from generate_series(v_today - 6, v_today, interval '1 day') as d(day)
      left join (
        select kst_date, count(distinct user_id) as cnt
        from public.access_logs
        where kst_date between v_today - 6 and v_today
        group by kst_date
      ) v on v.kst_date = d.day::date
    ),
    'stampsByZone', coalesce((
      select jsonb_agg(jsonb_build_object('zone', zone, 'count', cnt) order by cnt desc, zone)
      from (
        select p.zone, count(*) as cnt
        from public.stamps s join public.places p on p.id = s.place_id
        group by p.zone
      ) z), '[]'::jsonb),
    'topPlaces', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', id, 'name', name, 'zone', zone, 'count', cnt) order by cnt desc, id)
      from (
        select p.id, p.name, p.zone, count(*) as cnt
        from public.stamps s join public.places p on p.id = s.place_id
        group by p.id, p.name, p.zone
        order by cnt desc, p.id
        limit 5
      ) t), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_admin_stats() from public, anon;
grant execute on function public.get_admin_stats() to authenticated;
