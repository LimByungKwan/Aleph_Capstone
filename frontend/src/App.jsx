import { lazy, Suspense, useEffect, useState } from 'react'
import Scene from './game/Scene.jsx'
import UiRoot from './components/movieZone/UiRoot.jsx'
import AdminLauncher from './components/admin/AdminLauncher.jsx'
import { AuditionInteraction, CheerInteraction, StudioInteraction } from './components/sg/SgInteractionUi.jsx'
import KpopGuide from './components/sg/KpopGuide.jsx'
import KeyHints from './components/sg/KeyHints.jsx'
import ClockTowerMap from './components/sg/ClockTowerMap.jsx'
import KpopIntro from './components/sg/KpopIntro.jsx'
import { LoginModal } from './components/auth/LoginPage.jsx'
import { USE_SERVER, openLogin, useSessionStore } from './api/session.js'

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
  // [지민] 서버 모드(VITE_API_URL): 로그인 없이 맵을 둘러볼 수 있고, 스탬프를 받으려 할 때 로그인 창이 뜸
  //        사장님·관리자 화면은 계정이 있어야 의미가 있으니 들어오자마자 로그인 창을 띄움 (mock 모드는 예전 그대로)
  const loggedIn = useSessionStore((s) => Boolean(s.user))
  const staffRoute = route === '/owner' || route === '/admin'
  useEffect(() => {
    if (USE_SERVER && staffRoute && !loggedIn) openLogin({ title: '사장님·관리자 로그인', reason: '이 화면은 사장님·관리자 계정으로 로그인해야 볼 수 있어요.' })
  }, [staffRoute, loggedIn])

  if (staffRoute) {
    return (
      <>
        <Suspense fallback={null}>
          {route === '/owner' ? <OwnerPage /> : <AdminPage />}
        </Suspense>
        <LoginModal />
      </>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Scene />
      <UiRoot />
      <StudioInteraction />
      <AdminLauncher />
      <CheerInteraction />
      <AuditionInteraction />
      <KpopGuide />
      <KeyHints />
      <ClockTowerMap />
      <KpopIntro />
      <LoginModal />
    </div>
  )
}
