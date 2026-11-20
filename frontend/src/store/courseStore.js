import { create } from 'zustand'
import { useGameStore } from './gameStore.js'

// 루미가 추천한 코스 (담당: 병관)
// course    : [{ placeId, name, zoneName, type, position, reason }] 걷는 순서대로, 없으면 []
// index     : 지금 가야 할 장소 순서 (course.length면 코스 완주)
// meta      : 코스 정보 (예: { daily: '2026-11-20' } = 오늘의 코스) — 배지 판단에 씀
// celebrate : 완주한 순간의 시각 (색종이 효과가 이 값이 바뀌면 터짐)
// 캐릭터가 목적지 감지 범위(places.json radius)에 들어가면 자동으로 다음 장소로 넘어감
export const useCourseStore = create((set, get) => ({
  course: [],
  index: 0,
  meta: null,
  celebrate: 0,
  setCourse: (course, meta = null) => set({ course, index: 0, meta }),
  clear: () => set({ course: [], index: 0, meta: null }),
  arrive: (placeId) => {
    const { course, index } = get()
    if (course[index]?.placeId !== placeId) return
    const next = index + 1
    set({ index: next, ...(next === course.length ? { celebrate: Date.now() } : {}) })
  },
}))

export const currentTarget = (state) => state.course[state.index] ?? null

// 목적지에 도착했는지는 gameStore.nearbyPlaceId(지점 센서)로 판단
useGameStore.subscribe((state, prev) => {
  if (state.nearbyPlaceId && state.nearbyPlaceId !== prev.nearbyPlaceId) {
    useCourseStore.getState().arrive(state.nearbyPlaceId)
  }
})
