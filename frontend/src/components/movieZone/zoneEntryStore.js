import { create } from 'zustand'

// [3. 개발 > 기초개발/서비스] 영화·드라마 구역 입장 이벤트 (혜진 구역 전용)
// 3D 입구 게이트(game/Map/styles/hj/HjEntranceGate.jsx)가 캐릭터 통과·클릭을 알려 주면
// EntranceWelcome.jsx가 페이드 + 환영 배너를 띄워요. 팀 공용 gameStore와 분리.
const COOLDOWN_MS = 8000 // 입구에서 서성일 때 배너가 계속 뜨지 않게

export const useZoneEntryStore = create((set, get) => ({
  welcomeAt: 0, // 마지막으로 환영 배너를 띄운 시각 (0이면 안 보임)
  lastEnteredAt: 0,

  // handleEnterMovieZone: 게이트를 지나가거나 클릭하면 호출
  handleEnterMovieZone: ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && now - get().lastEnteredAt < COOLDOWN_MS) return
    set({ welcomeAt: now, lastEnteredAt: now })
  },
  dismissWelcome: () => set({ welcomeAt: 0 }),

  // 구역 안 작은 구역(경복궁·경성거리) 입장 카드 — hjAreas.js가 캐릭터가 들어온 걸 알려 줘요
  // 방금 세트장 입장 배너가 떴으면(게이트 바로 뒤가 경복궁) 겹치지 않게 건너뛰어요
  areaWelcome: null, // { at, id }
  showArea: (id) => {
    const now = Date.now()
    if (now - get().lastEnteredAt < COOLDOWN_MS) return
    set({ areaWelcome: { at: now, id } })
  },
  dismissArea: () => set({ areaWelcome: null }),
}))
