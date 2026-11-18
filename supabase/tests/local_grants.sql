-- 로컬 검증 전용: Supabase가 public 테이블에 기본으로 주는 권한을 흉내 (실제 접근은 RLS가 막음)
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
