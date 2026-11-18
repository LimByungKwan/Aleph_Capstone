import { create } from 'zustand'

// [3. 개발 > 프론트엔드] 광장과 모든 구역이 같은 계절을 사용해요.
export const SEASON_LABELS = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }
const monthInKorea = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' })

export function koreanSeason(date = new Date()) {
  const month = Number(monthInKorea.format(date))
  if (month < 3 || month === 12) return 'winter'
  if (month < 6) return 'spring'
  if (month < 9) return 'summer'
  return 'autumn'
}

const initialSeason = new URLSearchParams(globalThis.location?.search).get('season')
export const useSeasonStore = create((set) => ({
  automatic: koreanSeason(),
  preview: Object.hasOwn(SEASON_LABELS, initialSeason) ? initialSeason : null,
  refresh: () => set({ automatic: koreanSeason() }),
  setPreview: (preview) => set({ preview }),
}))

export const useSeason = () => useSeasonStore((state) => state.preview ?? state.automatic)
