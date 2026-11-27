import { create } from 'zustand'
import { API_URL, USE_SERVER } from '../../api/session.js'

// [지민] 첫 접속 흐름 (11/27, 지민 결정: "맵 위 로그인 창")
//   ① 게임 코드(GameRoot 묶음, three.js·물리 엔진 약 7MB)를 받는 동안: 병관님 로딩 화면과 같은 모양(MapLoading)
//   ② 맵을 받는 동안: 병관님 로딩 화면(LoadingScreen.jsx) — 로딩 화면은 이렇게 한 번만 보임
//   ③ 로딩이 끝나면 캐릭터 없이 맵 전체가 보이고, 그 위에 로그인 창 (LoginGate)
//   ④ 로그인하면 그 자리에서 캐릭터가 생기고 시작 (Scene locked → false)
//   그동안 Render 서버를 깨워 두고, 로그인 창에 준비 상태를 표시

export const loadGame = () => import('../../GameRoot.jsx')

const HEALTH_TIMEOUT_MS = 70_000
const SLOW_AFTER_MS = 90_000 // 이만큼 지나도 안 깨어나면 "늦어요" 안내 (계속 시도는 함)

/**
 * server: 'waking'(깨우는 중) | 'ready'(준비됨) | 'slow'(오래 걸림 — 계속 시도 중) | 'off'(mock 모드)
 * tip: 루미의 팁 번호 — ①에서 보던 팁을 ②가 이어 감
 * fallbackShown: ①이 보였음 → ②의 카드가 다시 아래에서 올라오지 않게 (같은 화면이 이어지는 것처럼)
 * loadingDone: ②가 사라짐 → 로그인 창의 이메일 칸에 커서
 */
export const usePreload = create(() => ({ server: USE_SERVER ? 'waking' : 'off', tip: null, fallbackShown: false, loadingDone: false }))

let started = false
/** 서버 깨우기 시작 (여러 번 불러도 한 번만) */
export function startServerWake() {
  if (started || !USE_SERVER) return
  started = true
  wakeUntilReady()
}

async function wakeUntilReady() {
  const begin = Date.now()
  for (;;) {
    try {
      const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
      if (res.ok) return usePreload.setState({ server: 'ready' })
    } catch {
      // 잠에서 깨는 중(연결 끊김·시간 초과) → 잠깐 쉬고 다시
    }
    if (Date.now() - begin > SLOW_AFTER_MS) usePreload.setState({ server: 'slow' })
    await new Promise((r) => setTimeout(r, 3000))
  }
}
