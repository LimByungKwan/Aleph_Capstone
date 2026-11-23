-- ============================================================================
-- 감사 로그 (담당: 지민) — 누가, 언제, 무엇을 바꿨는지 남김
--
-- 왜: access_logs는 "로그인했다"만 남기고, 권한·데이터를 바꾼 기록은 없음
--   - 역할·가게 변경(권한 상승)은 지금 아무 흔적도 안 남음  ← 가장 민감
--   - 가게 대표 문구는 덮어쓰기라 이전 내용이 사라짐
--   - 쿠폰 사용은 coupons.used_by/used_at + redeem_requests로 이미 남지만, 한곳에서 보려고 같이 기록
--
-- 원칙
--   - 기록은 트리거가 자동으로 남김 (화면·서버 코드가 깜빡해도 빠지지 않음)
--   - 관리자만 읽기. 아무도(관리자 포함) 화면·API로 고치거나 지울 수 없음 = 정책 없음
--   - 개인정보 최소: 바뀐 칸만 before/after로 저장 (전체 행 복사 안 함)
--
-- 실행 순서: core → appearance → tarot → 이 파일. 다시 실행해도 안전하지 않음(처음 1번만)
-- ============================================================================

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  actor        uuid,                 -- 로그인한 사람 (SQL Editor·서버 키로 바꾸면 null)
  actor_db     text not null,        -- DB 역할: authenticated / postgres(SQL Editor) 등
  action       text not null check (action in ('role_change', 'promo_save', 'coupon_redeem')),
  target_table text not null,
  target_id    text not null,
  before       jsonb,
  after        jsonb
);
create index audit_logs_at_idx on public.audit_logs (at desc);

alter table public.audit_logs enable row level security;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.my_role() = 'admin');
-- INSERT·UPDATE·DELETE 정책 없음 → 클라이언트는 아무도 못 씀 (트리거만 씀)

create or replace function public.audit_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_id     text;
  v_before jsonb;
  v_after  jsonb;
begin
  if tg_table_name = 'profiles' then
    if new.role is not distinct from old.role and new.shop_id is not distinct from old.shop_id then
      return null;  -- 이름·꾸미기만 바뀐 건 기록 안 함
    end if;
    v_action := 'role_change';
    v_id     := new.id::text;
    v_before := jsonb_build_object('role', old.role, 'shop_id', old.shop_id);
    v_after  := jsonb_build_object('role', new.role, 'shop_id', new.shop_id);

  elsif tg_table_name = 'shop_promos' then
    v_action := 'promo_save';
    v_id     := new.shop_id;
    v_before := case when tg_op = 'UPDATE' then jsonb_build_object('text', old.text, 'tag', old.tag) end;
    v_after  := jsonb_build_object('text', new.text, 'tag', new.tag);

  elsif tg_table_name = 'coupons' then
    if old.used_at is not null or new.used_at is null then
      return null;  -- "안 씀 → 씀"으로 바뀔 때만
    end if;
    v_action := 'coupon_redeem';
    v_id     := new.id::text;
    v_before := null;
    v_after  := jsonb_build_object('shop_id', new.shop_id, 'used_by', new.used_by, 'used_at', new.used_at);
  else
    return null;
  end if;

  insert into public.audit_logs (actor, actor_db, action, target_table, target_id, before, after)
  -- security definer 안에서는 current_user가 함수 주인이 되므로, 호출한 쪽 역할은 세션의 role 설정으로 읽음
  values (auth.uid(), coalesce(nullif(current_setting('role', true), 'none'), session_user::text),
          v_action, tg_table_name, v_id, v_before, v_after);
  return null;
end;
$$;

create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_write();
create trigger shop_promos_audit after insert or update on public.shop_promos
  for each row execute function public.audit_write();
create trigger coupons_audit after update on public.coupons
  for each row execute function public.audit_write();

-- 트리거 함수는 직접 호출할 일이 없음 → 실행 권한 회수
revoke execute on function public.audit_write() from public, anon, authenticated;
