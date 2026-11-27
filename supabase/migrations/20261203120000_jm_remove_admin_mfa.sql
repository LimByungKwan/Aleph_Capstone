-- ============================================================================
-- 관리자 2단계 인증(TOTP) 없애기 (담당: 지민, 11/27)
-- Supabase SQL Editor에 통째로 붙여 실행 (20261202120000_jm_signup_code.sql 다음)
--
-- 왜: 11/26에 넣은 20261201120000_jm_admin_mfa.sql은 팀 간트에 없던 선택 기능이었고,
--     누가 실수로 등록하면 시연(12/01) 중 관리자 화면이 휴대폰 코드를 요구하게 됨 → 지민 결정으로 없앰
--     서버(/auth/mfa/*, MFA_REQUIRED)와 화면(🔐 버튼·코드 창)도 같은 날 없앰
--
-- 하는 일
--   - my_role()을 처음(20261118120000_jm_core.sql)과 똑같이 되돌림: 역할만 보고 aal(2단계 인증 여부)은 안 봄
--   - mfa_ok() 삭제 (my_role만 쓰던 함수)
-- 안전: 등록한 관리자 0명(11/26 확인)이라 지금 동작은 바뀌지 않음. 몇 번 실행해도 같은 결과
-- ============================================================================

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

drop function if exists public.mfa_ok();

-- 확인 (결과: mfa_ok 0줄, my_role 정의에 mfa 없음)
-- select proname from pg_proc where proname = 'mfa_ok';
-- select pg_get_functiondef('public.my_role()'::regprocedure);
