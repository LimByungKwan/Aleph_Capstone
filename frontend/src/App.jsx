import { useEffect, useState } from 'react'
import Scene from './game/Scene.jsx'
import UiRoot from './components/movieZone/UiRoot.jsx'
import OwnerPage from './components/boss/OwnerPage.jsx'
import StudioPanel from './components/sg/StudioPanel.jsx'
import LoginPage from './components/auth/LoginPage.jsx'
import { USE_SERVER, useSessionStore } from './api/session.js'

// 주소 # 뒤로 화면 전환 (라우터 라이브러리 없이)
//   #/       → 3D 맵 + 게임 UI(대화창·스탬프북·쿠폰함)  — 혜진
//   #/owner  → 사장님 화면                                — 혜진
//   (관리자 화면은 성근님 담당: 같은 방식으로 '/admin' 한 줄 추가하면 돼요)
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
  // [지민] 서버 모드(VITE_API_URL)에서는 로그인해야 3D 맵이 보임 (mock 모드는 예전 그대로)
  const loggedIn = useSessionStore((s) => Boolean(s.user))
  if (USE_SERVER && !loggedIn) return <LoginPage />

  if (route === '/owner') return <OwnerPage />

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Scene />
      <UiRoot />
      <StudioPanel />
    </div>
  )
}
