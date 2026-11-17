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
}))
