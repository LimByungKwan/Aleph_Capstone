import { useEffect, useState } from 'react'
import Scene from './game/Scene.jsx'
import UiRoot from './components/movieZone/UiRoot.jsx'
import OwnerPage from './components/boss/OwnerPage.jsx'
import StudioPanel from './components/sg/StudioPanel.jsx'
import AdminPage from './components/admin/AdminPage.jsx'
import AdminLauncher from './components/admin/AdminLauncher.jsx'
import CheerGame from './components/sg/CheerGame.jsx'
import AuditionPanel from './components/sg/AuditionPanel.jsx'
import KpopGuide from './components/sg/KpopGuide.jsx'
import KeyHints from './components/sg/KeyHints.jsx'
import ClockTowerMap from './components/sg/ClockTowerMap.jsx'
import KpopIntro from './components/sg/KpopIntro.jsx'
import { LoginGate, LoginModal } from './components/auth/LoginPage.jsx'
import { USE_SERVER, openLogin, useSessionStore } from './api/session.js'

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
  // [지민] 서버 모드(VITE_API_URL): 손님 없음 (11/27) — 로그인해야 맵에 들어감. 로그인 전엔 맵 대신 로그인·회원가입 화면
  //        사장님·관리자 화면은 들어오자마자 로그인 창을 띄움 (mock 모드는 예전 그대로 로그인 없이)
  const loggedIn = useSessionStore((s) => Boolean(s.user))
  const staffRoute = route === '/owner' || route === '/admin'
  useEffect(() => {
    if (USE_SERVER && staffRoute && !loggedIn) openLogin({ title: '사장님·관리자 로그인', reason: '이 화면은 사장님·관리자 계정으로 로그인해야 볼 수 있어요.' })
  }, [staffRoute, loggedIn])

  if (staffRoute) {
    return (
      <>
        {route === '/owner' ? <OwnerPage /> : <AdminPage />}
        <LoginModal />
      </>
    )
  }

  // 로그인 전에는 3D 맵을 아예 불러오지 않음 (로그아웃·다른 기기 로그인으로 끊기면 이 화면으로 돌아옴)
  if (USE_SERVER && !loggedIn) return <LoginGate />

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Scene />
      <UiRoot />
      <StudioPanel />
      <AdminLauncher />
      <CheerGame />
      <AuditionPanel />
      <KpopGuide />
      <KeyHints />
      <ClockTowerMap />
      <KpopIntro />
      <LoginModal />
    </div>
  )
}
