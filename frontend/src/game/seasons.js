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

export const SEASON_LOOK = {
  spring: { sky: ['#94bce9', '#e6cce8', '#ffe1cd'], fog: '#f4dce4', ground: '#b9b4a8', meadow: '#c9dcb0', sun: '#fff4e6', leaves: ['#9ec573', '#7eac60', '#b5ce83'] },
  summer: { sky: ['#609ee2', '#a8d8f0', '#e7f2dd'], fog: '#dcefe9', ground: '#aaa698', meadow: '#9cc47b', sun: '#fff9df', leaves: ['#4f8f45', '#5fa24f', '#3f7a3a'] },
  autumn: { sky: ['#8c9acb', '#ecc0aa', '#ffd59f'], fog: '#f1d6b8', ground: '#c1ad94', meadow: '#c2aa77', sun: '#ffdeb7', leaves: ['#bd542e', '#e08a35', '#e4b44b'] },
  winter: { sky: ['#9baecb', '#c8d7e4', '#e9e9ef'], fog: '#e3eaf3', ground: '#ecf1f5', meadow: '#dfe8ed', sun: '#edf4ff', leaves: ['#d9e3ea', '#edf4f8', '#c8d6df'] },
}
