-- ============================================================================
-- 캐릭터 꾸미기 저장 칸 (담당: 지민)
-- Supabase SQL Editor에 통째로 붙여 실행 (20261118120000_jm_core.sql 다음)
--
-- 판단: 꾸미기 항목(색·옷·모자 …)은 아직 정해지지 않았다.
--   → 항목마다 컬럼을 만들지 않고 jsonb 한 칸에 담는다. 항목이 늘어도 DB·서버를 다시 고치지 않음
--   → 대신 "객체일 것 + 2KB 이하"만 DB가 강제 (이미지·긴 글을 몰래 넣어 DB를 채우는 것 방지)
--   항목의 의미(어떤 값이 유효한지)는 화면이 정한다 — 꾸미기는 권한·돈과 상관없어서 서버가 막을 이유가 없음
-- ============================================================================

alter table public.profiles
  add column appearance jsonb not null default '{}'::jsonb;

alter table public.profiles
  add constraint appearance_small_object
  check (jsonb_typeof(appearance) = 'object' and octet_length(appearance::text) <= 2048);

-- 꾸미기 저장: 보낸 항목만 바꾸고 나머지는 유지 (값을 null로 보내면 그 항목 삭제)
--   예) {"characterId":"female"} 저장 후 {"hat":"red"} 저장 → {"characterId":"female","hat":"red"}
-- 응답: 저장된 전체 appearance
create or replace function public.save_appearance(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public.require_user();
  v_next jsonb;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'INVALID_INPUT' using detail = '꾸미기 값을 확인해 주세요.';
  end if;

  -- for update: 같은 사람이 두 탭에서 동시에 저장해도 한쪽 변경이 사라지지 않게 줄을 잠그고 합침
  select appearance into v_next from public.profiles where id = v_uid for update;
  if not found then raise exception 'NOT_FOUND' using detail = '프로필이 없어요.'; end if;

  v_next := jsonb_strip_nulls(v_next || p_patch);
  if octet_length(v_next::text) > 2048 then
    raise exception 'TOO_LARGE' using detail = '꾸미기 정보가 너무 커요.';
  end if;

  update public.profiles set appearance = v_next where id = v_uid;
  return v_next;
end;
$$;

revoke execute on function public.save_appearance(jsonb) from public, anon;
grant execute on function public.save_appearance(jsonb) to authenticated;
