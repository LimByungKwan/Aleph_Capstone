-- ============================================================================
-- 계정당 로그인 1곳 (담당: 지민, 11/26)
-- Supabase SQL Editor에 통째로 붙여 실행 (20261129120000_jm_canal_village.sql 다음)
-- ★ 배포 순서: 이 migration → Render 서버 → 화면. 서버가 먼저 배포되면 로그인(claim_session 호출)이 실패함
--   반대로 이 파일만 먼저 실행하는 건 안전: 기록(user_sessions)이 하나도 없으면 모두 통과로 봄
--
-- 정책: "새 로그인 우선". 같은 계정으로 다른 기기에서 로그인하면 이전 기기는 다음 요청부터 SESSION_REPLACED
--   비교한 방식
--   - 기존 세션 우선(새 로그인 거절): 비밀번호를 훔친 사람이 먼저 들어오면 진짜 사용자가 못 들어옴.
--     탭만 닫고 로그아웃 안 한 정상 사용자도 막힘
--   - 새 로그인 우선(이 파일): 진짜 사용자가 다시 로그인하면 훔친 쪽이 끊김. 끊긴 쪽 화면에
--     "다른 기기에서 로그인됨"이 떠서 도난을 알아챌 수 있음 + 감사 로그(session_replaced)
--   사장님 공용 계정도 예외 없음 → 시연 때 사장님 화면은 한 사람만 연다(운영 규칙, docs/jm-demo-checklist.md)
--
-- 어떻게 구분하나: Supabase 로그인 토큰(JWT)에는 로그인 1번마다 새로 생기는 session_id가 들어 있고,
--   토큰을 refresh해도 session_id는 그대로다. 계정마다 "지금 유효한 session_id" 하나만 DB에 둔다
--
-- 어디서 막나 (두 겹)
--   ① 서버(server/src/app.js requireAuth): 모든 로그인 API 앞에서 session_ok() → 아니면 401 SESSION_REPLACED
--   ② DB(require_user): 스탬프·쿠폰·꾸미기 등 쓰기 함수 첫 줄이 쓰는 require_user가 같은 검사
--      → 끊긴 기기가 서버를 건너뛰고 공개 키 + 옛 토큰으로 Supabase를 직접 불러도 쓰기는 막힘
--   남는 것(알고 정한 위험): 끊긴 토큰으로 Supabase를 직접 부르면 "본인 데이터 읽기"(RLS)는 1시간 만료 전까지 됨.
--   Auth 세션 자체를 끊으려면 service_role 키가 필요한데, 서버는 그 키를 갖지 않는 설계라 하지 않음
-- ============================================================================

create table public.user_sessions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  session_id uuid,  -- null = 로그아웃함 (어떤 토큰도 유효하지 않음). 행을 지우지 않는 이유는 release_session 주석
  claimed_at timestamptz not null default now()
);
alter table public.user_sessions enable row level security;
-- 정책 없음 = 화면·API로 아무도 읽거나 쓰지 못함. 아래 함수만 씀

-- 지금 요청한 토큰의 session_id (토큰 없이 SQL Editor에서 부르면 null)
create or replace function public.current_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id', '')::uuid
$$;

-- 이 토큰이 "지금 유효한 로그인"인가
--   true: 기록과 같음 / 기록 행이 아예 없음(이 기능 배포 전부터 로그인해 있던 사람) / 토큰에 session_id 없음(SQL Editor·로컬 검증)
--   false: 다른 기기가 로그인함 / 로그아웃해서 기록이 null
--   Supabase가 서명한 실제 토큰에는 session_id가 항상 있으므로 마지막 true 경우는 화면에서 만들 수 없음
create or replace function public.session_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_session_id() is null
      or not exists (select 1 from public.user_sessions s where s.user_id = auth.uid())
      or exists (select 1 from public.user_sessions s
                  where s.user_id = auth.uid() and s.session_id = public.current_session_id())
$$;

-- 로그인·가입 직후 서버가 부름: 이 토큰을 그 계정의 유일한 로그인으로 기록
-- 응답: { replaced: true } = 다른 기기의 로그인을 끊었음 (감사 로그에 남김)
-- require_user를 쓰지 않는 이유: 새 토큰은 아직 기록과 달라서 session_ok가 거짓 → 로그인 자체를 못 하게 됨
create or replace function public.claim_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sid  uuid := public.current_session_id();
  v_prev uuid;
begin
  if v_uid is null or v_sid is null then
    raise exception 'UNAUTHORIZED' using detail = '로그인이 필요해요.';
  end if;

  -- 같은 계정 로그인 두 개가 동시에 와도 차례로 처리 (기록이 이미 있으면 그 행을 잠금)
  select session_id into v_prev from public.user_sessions where user_id = v_uid for update;

  insert into public.user_sessions (user_id, session_id) values (v_uid, v_sid)
  on conflict (user_id) do update set session_id = excluded.session_id, claimed_at = now();

  if v_prev is not null and v_prev <> v_sid then
    -- session_id 전체는 남기지 않음 (앞 8자리만: 같은 세션인지 구분하는 정도)
    insert into public.audit_logs (actor, actor_db, action, target_table, target_id, before, after)
    values (v_uid, coalesce(nullif(current_setting('role', true), 'none'), session_user::text),
            'session_replaced', 'user_sessions', v_uid::text,
            jsonb_build_object('session', left(v_prev::text, 8)),
            jsonb_build_object('session', left(v_sid::text, 8)));
    return jsonb_build_object('replaced', true);
  end if;
  return jsonb_build_object('replaced', false);
end;
$$;

-- 로그아웃 버튼: 내 기록을 null(= 유효한 로그인 없음)로 바꿈
--   - 다음 로그인이 "다른 기기를 끊음"으로 감사 로그에 잘못 남지 않게
--   - 행을 지우지 않는 이유: 지우면 "기록 없음 = 통과" 규칙 때문에, 앞서 끊겼던 옛 기기(훔친 토큰일 수 있음)가 다시 살아남
--   - 이미 다른 기기가 로그인해 있으면(기록이 내 것이 아니면) 아무것도 바꾸지 않음
create or replace function public.release_session()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using detail = '로그인이 필요해요.';
  end if;
  update public.user_sessions set session_id = null, claimed_at = now()
   where user_id = auth.uid() and session_id = public.current_session_id();
end;
$$;

-- 쓰기 함수들이 첫 줄에 부르는 require_user에 같은 검사를 넣음 (두 번째 겹)
create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using detail = '로그인이 필요해요.';
  end if;
  if not public.session_ok() then
    raise exception 'SESSION_REPLACED' using detail = '다른 기기에서 로그인해서 이 기기는 로그아웃됐어요.';
  end if;
  return auth.uid();
end;
$$;

-- 감사 로그 종류에 session_replaced 추가
alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action in ('role_change', 'promo_save', 'coupon_redeem', 'session_replaced'));

revoke execute on function public.current_session_id(), public.session_ok(), public.claim_session(), public.release_session() from public, anon;
grant execute on function public.current_session_id(), public.session_ok(), public.claim_session(), public.release_session() to authenticated;
