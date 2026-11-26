-- ============================================================================
-- 관리자 2단계 인증(TOTP) — "등록한 관리자만" (담당: 지민, 11/26)
-- Supabase SQL Editor에 통째로 붙여 실행 (20261130120000_jm_single_session.sql 다음)
-- ★ 배포 순서: 이 migration → Render 서버 → 화면. 이 파일만 먼저 실행해도 안전함
--   (아무도 TOTP를 등록하지 않았으면 my_role()은 예전과 똑같이 동작)
--
-- 정책
--   - TOTP를 등록(검증까지 끝낸)한 관리자는, 이번 로그인에서 6자리 코드를 넣어야(aal2) 관리자 권한이 생김
--   - 등록하지 않은 관리자·사장님·순례객은 지금과 같음
--   왜 전원 강제가 아닌가: 제출(11/30)·시연(12/01) 직전에 관리자 4명이 모두 인증 앱을 깔고 등록해야 해서,
--     한 명이라도 못 하면 시연 중 관리자 화면이 막힘. 등록한 사람부터 보호하고, 시연 뒤 전원 강제로 바꾸기 쉬운 구조로 둠
--     (전원 강제로 바꾸려면 mfa_ok()의 "등록한 factor가 없으면 통과" 줄만 지우면 됨)
--
-- 어디서 막나 (두 겹)
--   ① 서버 requireRole('admin'): aal1이면 403 MFA_REQUIRED (화면이 코드 입력 창을 띄움)
--   ② DB my_role(): 관리자라도 등록했는데 aal1이면 'pilgrim'으로 봄
--      → 관리자 통계(get_admin_stats)·감사 로그 읽기·남의 프로필 읽기·역할 변경 모두 막힘
--      (서버를 건너뛰고 공개 키 + aal1 토큰으로 Supabase를 직접 불러도 같음)
--
-- aal: Supabase 토큰(JWT) 안의 인증 수준. 비밀번호만 = aal1, 비밀번호 + TOTP 코드 = aal2
-- auth.mfa_factors: Supabase Auth가 관리하는 표 (등록한 인증 수단). status = 'verified'면 등록 완료
-- ============================================================================

-- 이 요청이 2단계 인증 조건을 만족하나
--   true: 토큰이 aal2 / 등록(검증 완료)한 TOTP가 없음
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                      where f.user_id = auth.uid() and f.status = 'verified')
$$;

-- 기존 my_role()에 2단계 인증 조건을 더함 (정책·함수 11곳이 이 함수를 씀 → 한 곳만 바꿔서 전부 적용)
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.role = 'admin' and not public.mfa_ok() then 'pilgrim' else p.role end
    from public.profiles p where p.id = auth.uid()
$$;

revoke execute on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;
