import { create } from 'zustand'
import { DEFAULT_TIME, SHOW_ZONES } from './config.js'

// 설정창(⚙) 값. 3D 화면 쪽에서만 쓰는 저장소예요. (팀 공용 약속인 store/gameStore.js와는 별개)
// - timeOfDay : 'morning' | 'noon' | 'night'  (하늘·햇빛·안개·별)
// - quality   : 'high' | 'low'                 (low = 그림자 끄기 + 화면 해상도 낮추기)
// - showZones : 구역 표시(색 바닥·테두리·입구 아치·이름표·범례) 켜기/끄기
// 이 브라우저에 저장돼서 새로고침해도 유지돼요.

const KEY = 'scenewalk-settings'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ timeOfDay: state.timeOfDay, quality: state.quality, showZones: state.showZones }))
  } catch {
    // 저장이 막힌 환경(시크릿 창 등)이면 그냥 넘어감
  }
}

const saved = load()

export const useSettings = create((set, get) => ({
  timeOfDay: saved.timeOfDay ?? DEFAULT_TIME,
  quality: saved.quality ?? 'low', // 기본은 낮음 (혜진 님 FPS 최적화 기준)
  showZones: saved.showZones ?? SHOW_ZONES,
  setTimeOfDay: (timeOfDay) => {
    set({ timeOfDay })
    save(get())
  },
  setQuality: (quality) => {
    set({ quality })
    save(get())
  },
  setShowZones: (showZones) => {
    set({ showZones })
    save(get())
  },
}))
