import { USE_SERVER, useSessionStore } from './session.js'
import { currentUser, useUiStore } from '../components/movieZone/uiStore.js'

// [지민] 지금 사용자가 관리자인지 (화면에서 관리자 전용 항목을 숨길 때 사용)
// - 서버 모드: 로그인한 계정의 role (DB profiles.role)
// - mock 모드: 왼쪽 위 "시연 계정"에서 고른 사람의 role (운영 관리자를 고르면 보임)
// 주의: 화면에서 숨기는 것뿐이라 보안 장치가 아님. 진짜로 막아야 하는 데이터는 서버·DB(RLS)가 막는다
export function useIsAdmin() {
  const sessionRole = useSessionStore((s) => s.user?.role)
  const userId = useUiStore((s) => s.userId)
  return USE_SERVER ? sessionRole === 'admin' : currentUser(userId).role === 'admin'
}
