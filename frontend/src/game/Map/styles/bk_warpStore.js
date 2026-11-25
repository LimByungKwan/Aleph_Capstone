import { create } from 'zustand'
import { USE_SERVER } from '../../../api/session.js'
import { listWarps, unlockWarp } from '../../../api/client.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'

// 구역 워프존 (담당: 병관) — K-POP · 데이트 코스 · 영화·드라마 · 애니메이션 구역 입구 안쪽에 하나씩
// - 처음엔 꺼져 있고, 로그인한 상태로 한 번이라도 근처(4m)에 가면 켜짐
// - 켠 기록은 계정에 저장 (지민 님 client.js listWarps·unlockWarp → 서버 모드: Supabase warp_unlocks / 시연 모드: 이 브라우저)
//   → 다른 기기·브라우저에서 같은 계정으로 로그인해도 그대로. 워프존을 늘리면 지민 님 DB 목록도 같이 늘려야 함
// - 미니맵의 워프 아이콘을 누르면 "이 지역으로 이동하겠습니까?" → 이동 (bk_warpZones.jsx가 캐릭터를 옮김)
// 위치는 구역 입구 바로 안쪽의 평평한 빈 땅 (미리보기에서 바닥 높이를 재서 고름). 숫자만 바꾸면 옮길 수 있어요

export const WARPS = [
  { id: 'warp_bk', zone: 'BK', name: '데이트 코스', icon: '💕', color: '#f472b6', position: [51, 0.02, 0] },
  { id: 'warp_jm', zone: 'JM', name: '애니메이션', icon: '🌸', color: '#a78bfa', position: [-10, 0, -49] },
  { id: 'warp_sg', zone: 'SG', name: 'K-POP', icon: '🎤', color: '#60a5fa', position: [-63, 0.02, -2] },
  { id: 'warp_hj', zone: 'HJ', name: '영화·드라마', icon: '🎬', color: '#fbbf24', position: [12, 0.15, 53] },
]
export const UNLOCK_RANGE = 4

/** 로그인했는지: 서버 모드는 로그인한 사람, 시연(mock) 모드는 시연 계정이라 항상 로그인 */
export function isLoggedIn() {
  const userId = useUiStore.getState().userId
  return USE_SERVER ? Boolean(userId) && userId !== 'guest' : true
}

// 예전(11/24)에 이 브라우저에만 저장했던 기록 → 계정으로 한 번 옮기고 지움
const oldKey = (userId) => `scenewalk.warps.${userId}`
function readOldLocal(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(oldKey(userId)))
    return Array.isArray(list) ? list.filter((id) => WARPS.some((w) => w.id === id)) : []
  } catch {
    return []
  }
}

export const useWarps = create((set, get) => ({
  unlocked: [], // 켜진 워프존 id (계정에서 불러옴)
  request: null, // 이동할 워프존 id (bk_warpZones.jsx가 처리하고 비움)
  /** 켜기: 화면에는 바로 켜고, 계정에 저장. 저장이 실패하면 다시 끔 */
  unlock(id) {
    if (!isLoggedIn() || get().unlocked.includes(id)) return false
    set({ unlocked: [...get().unlocked, id] })
    const userId = useUiStore.getState().userId
    unlockWarp({ userId, warpId: id })
      .then(({ warps }) => useUiStore.getState().userId === userId && set({ unlocked: warps }))
      .catch((error) => {
        console.warn('[워프존] 저장 실패', error)
        set({ unlocked: get().unlocked.filter((w) => w !== id) })
      })
    return true
  },
  /** 워프 요청. 안 되면 이유를 돌려줌: 'login' | 'locked' | null(성공) */
  warp(id) {
    if (!isLoggedIn()) return 'login'
    if (!get().unlocked.includes(id)) return 'locked'
    set({ request: id })
    return null
  },
  /** 구역 안 장소로 이동 (데이트 코스 미션 워프 등). 로그인 없이도 됨 (영화·드라마 구역 워프와 같음)
   *  target: { center: [x, z] } 또는 { anchor: { name, local: [x, y, z] } }, clearance?, label, isValid(), onArrive(), onFail() */
  goto: (target) => set({ request: target }),
  done: () => set({ request: null }),
}))

// 계정의 워프존 기록 불러오기 (처음 + 로그인·로그아웃·계정 전환 때마다)
async function loadWarps() {
  const userId = useUiStore.getState().userId
  useWarps.setState({ unlocked: [], request: null })
  if (!isLoggedIn()) return
  try {
    const old = readOldLocal(userId)
    let { warps } = await listWarps({ userId })
    for (const id of old.filter((w) => !warps.includes(w))) ({ warps } = await unlockWarp({ userId, warpId: id }))
    try {
      localStorage.removeItem(oldKey(userId)) // 계정으로 다 옮긴 뒤에 지움
    } catch {
      // 지우기가 막힌 브라우저면 다음에 다시 옮겨도 같은 결과(이미 켠 건 그대로)
    }
    if (useUiStore.getState().userId === userId) useWarps.setState({ unlocked: warps })
  } catch (error) {
    console.warn('[워프존] 기록을 불러오지 못했어요', error)
  }
}
loadWarps()
useUiStore.subscribe((state, prev) => {
  if (state.userId !== prev.userId) loadWarps()
})
