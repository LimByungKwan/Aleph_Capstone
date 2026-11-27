import { Suspense, lazy, useEffect, useState } from 'react'
import { LoginGate, LoginModal, MapLoading } from './components/auth/LoginPage.jsx'
import { loadGame } from './components/auth/jm_preload.js'
import { USE_SERVER, openLogin, useSessionStore } from './api/session.js'

// [지민] 게임 화면(3D 맵 + 게임 UI, three.js·물리 엔진 포함 약 7MB)은 따로 떼어 받음 (11/27)
//   → 받는 동안 첫 화면 묶음(약 220KB)만으로 로딩 화면을 먼저 보여 줌 (흐름: components/auth/jm_preload.js). 게임 화면 목록은 GameRoot.jsx
const GameRoot = lazy(loadGame)
// 사장님·관리자 화면도 따로 (첫 화면에 필요 없는 큰 묶음을 같이 받지 않게)
const OwnerPage = lazy(() => import('./components/boss/OwnerPage.jsx'))
const AdminPage = lazy(() => import('./components/admin/AdminPage.jsx'))

// 주소 # 뒤로 화면 전환 (라우터 라이브러리 없이)
//   #/       → 3D 맵 + 게임 UI(대화창·스탬프북·쿠폰함)  — 혜진
//   #/owner  → 사장님 화면                                — 혜진
//   #/admin  → 관리자 화면                                — 성근
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export default function App() {
  const route = useHashRoute()
  // [지민] 서버 모드(VITE_API_URL): 손님 없음 (11/27) — 로그인해야 캐릭터로 들어감. 로그인 전엔 맵 전체 + 로그인 창
  //        사장님·관리자 화면은 들어오자마자 로그인 창을 띄움 (mock 모드는 예전 그대로 로그인 없이)
  const loggedIn = useSessionStore((s) => Boolean(s.user))
  const staffRoute = route === '/owner' || route === '/admin'
  useEffect(() => {
    if (USE_SERVER && staffRoute && !loggedIn) openLogin({ title: '사장님·관리자 로그인', reason: '이 화면은 사장님·관리자 계정으로 로그인해야 볼 수 있어요.' })
  }, [staffRoute, loggedIn])

  if (staffRoute) {
    return (
      <>
        <Suspense fallback={null}>{route === '/owner' ? <OwnerPage /> : <AdminPage />}</Suspense>
        <LoginModal />
      </>
    )
  }

  // 로그인 전(서버 모드): 맵은 그리되 캐릭터·게임 UI 없이(locked) → 로딩이 끝나면 맵 위에 로그인 창
  //   로그인하면 같은 맵에서 바로 캐릭터가 생김 (로딩 화면은 처음 한 번만)
  const locked = USE_SERVER && !loggedIn
  //   로그인 버튼을 누른 뒤 "입장하는 중…" 카드는 GameRoot.jsx가 띄우고 걷음 (캐릭터가 서고 첫 화면이 그려질 때까지)
  return (
    <>
      <Suspense fallback={<MapLoading />}>
        <GameRoot locked={locked} />
      </Suspense>
      {locked ? <LoginGate /> : <LoginModal />}
    </>
  )
}
