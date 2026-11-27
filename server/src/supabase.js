import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 만들기
//
// 판단: 서버는 service_role(모든 RLS를 무시하는 키)을 쓰지 않는다.
//   - 로그인한 요청은 "그 사람의 토큰"을 그대로 실어서 DB를 부른다 → DB 안에서 auth.uid()가 그 사람
//   - 그래서 RLS·역할 검사가 DB에서 그대로 적용되고, 서버 코드에 버그가 있어도 남의 데이터는 못 건드린다
//   - 서버에 있는 키는 공개돼도 되는 publishable(anon) 키뿐 → 키가 새도 피해가 작다

export function createSupabaseFactory({ url, key }) {
  if (!url || !key) throw new Error('SUPABASE_URL 과 SUPABASE_PUBLISHABLE_KEY(또는 SUPABASE_ANON_KEY)가 필요해요.')
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

  return {
    /** 로그인 전(가입·로그인·공개 데이터)용 */
    anon: () => createClient(url, key, options),
    /** 로그인한 사람 권한으로 DB를 부르는 클라이언트 */
    asUser: (accessToken) =>
      createClient(url, key, { ...options, global: { headers: { Authorization: `Bearer ${accessToken}` } } }),
  }
}
