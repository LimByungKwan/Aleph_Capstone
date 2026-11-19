import { create } from 'zustand'

// [3. 개발 > 기초개발/서비스] 영화 속 포털 상태 (혜진 영화·드라마 구역 전용)
// 3D 포털(game/Map/styles/hj/FilmPortal.jsx)이 캐릭터가 들어오고 나가는 걸 알려 주고,
// 화면 연출(CinemaOverlay.jsx)이 이 값을 보고 레터박스·장면 소개를 띄워요.
// 팀 공용 gameStore와는 따로 관리해요.
export const usePortalStore = create((set, get) => ({
  // 지금 들어가 있는 포털 { id, title, work, synopsis, points } 또는 null
  active: null,
  // 닫기(ESC)를 누른 포털 id — 나갔다 다시 들어오기 전까지 다시 안 띄움
  dismissedId: null,
  warpRequest: null,

  enter: (portal) => {
    if (get().active?.id === portal.id) return
    set({ active: portal })
  },
  leave: (id) => {
    if (get().active?.id !== id && get().dismissedId !== id) return
    set({ active: null, dismissedId: null })
  },
  dismiss: () => set({ dismissedId: get().active?.id ?? null }),
  requestWarp: () => {
    const { active, dismissedId, warpRequest } = get()
    if (!active?.warpDestination || dismissedId === active.id || warpRequest) return
    set({ warpRequest: active.warpDestination.position })
  },
  finishWarp: () => set({ active: null, dismissedId: null, warpRequest: null }),
}))
