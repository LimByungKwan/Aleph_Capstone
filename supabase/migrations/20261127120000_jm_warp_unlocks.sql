-- ============================================================================
-- 워프존 활성화 기록 (DB 담당: 지민 / 워프존 화면: 병관 bk_warpStore.js)
-- Supabase SQL Editor에 통째로 붙여 실행 (20261126120000_jm_admin_stats.sql 다음)
--
-- 왜 DB인가: 지금은 브라우저 localStorage에 계정별로 저장 → 다른 기기·브라우저에서 로그인하면 기록이 없음.
--   계정(DB)에 두면 어디서 로그인해도 미니맵 워프가 그대로 켜져 있다.
--
-- 판단
--   - 워프존 id는 정해진 4개만 (warp_bk·warp_jm·warp_sg·warp_hj). 새로 생기면 이 목록과 CHECK를 같이 늘린다
--   - "근처에 갔는지"는 화면이 판단해서 보내는 값이라 조작할 수 있다. 이동 편의 기능일 뿐이라
--     서버에서 위치를 검증하지는 않는다 (병관님과 합의). 대신 형식·로그인·본인 것만은 DB가 막는다
--   - 쓰기는 unlock_warp 함수로만 (표에 직접 insert·update·delete 정책 없음). 읽기는 본인 것만 (RLS)
--   - 이미 켠 워프를 다시 켜도 에러 없이 그대로 (처음 켠 시각 유지)
-- ============================================================================

create table public.warp_unlocks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  warp_id     text not null check (warp_id in ('warp_bk', 'warp_jm', 'warp_sg', 'warp_hj')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, warp_id)
);

alter table public.warp_unlocks enable row level security;
-- insert·update·delete 정책은 일부러 없음 → 화면이 표에 직접 쓰지 못하고 아래 함수만 거침
create policy warp_read_own on public.warp_unlocks for select to authenticated using (user_id = auth.uid());

-- 워프존 켜기
--   예) select public.unlock_warp('warp_bk');
-- 응답: 내가 켠 워프존 id 목록 (id 순서) ["warp_bk", "warp_jm"]
create or replace function public.unlock_warp(p_warp_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  if p_warp_id is null or p_warp_id not in ('warp_bk', 'warp_jm', 'warp_sg', 'warp_hj') then
    raise exception 'INVALID_INPUT' using detail = '워프존 id를 확인해 주세요.';
  end if;

  insert into public.warp_unlocks (user_id, warp_id) values (v_uid, p_warp_id)
  on conflict (user_id, warp_id) do nothing;

  return coalesce((select jsonb_agg(warp_id order by warp_id) from public.warp_unlocks where user_id = v_uid), '[]'::jsonb);
end;
$$;

revoke execute on function public.unlock_warp(text) from public, anon;
grant execute on function public.unlock_warp(text) to authenticated;
