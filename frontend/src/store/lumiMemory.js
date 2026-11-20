import { create } from 'zustand'
import places from '@shared/places.json'
import { useGameStore } from './gameStore.js'
import { useCourseStore } from './courseStore.js'

// 루미의 기억 (담당: 병관) — 이 브라우저에만 저장 (localStorage)
// visits      : 방문 횟수 (브라우저 탭을 새로 열 때마다 1번)
// lastZones   : 지난번 추천받은 코스의 구역들 (예: ['BK'])
// visitedZones: 실제로 걸어서 들러 본 구역 (촬영지·가게 원 안에 들어간 적 있는 구역)
// 루미 대화창이 이걸 보고 "또 오셨네요! 지난번엔 데이트 코스였죠?" 하고 인사함

const KEY = 'scenewalk.lumi'
const SESSION_KEY = 'scenewalk.lumi.session'
const ZONES = ['JM', 'BK', 'HJ', 'SG']
const placeZone = Object.fromEntries(places.map((p) => [p.id, p.zone]))

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}
function persist(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ visits: state.visits, lastZones: state.lastZones, visitedZones: state.visitedZones }))
  } catch {
    // 저장이 막힌 브라우저면 이번 접속에서만 기억
  }
}

// 이번 탭에서 처음 열었을 때만 방문 횟수 +1 (새로고침은 같은 방문)
function countVisit(saved) {
  let visits = saved.visits ?? 0
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1')
      visits += 1
    }
  } catch {
    visits = Math.max(visits, 1)
  }
  return visits
}

const saved = load()
export const useLumiMemory = create((set, get) => ({
  visits: countVisit(saved),
  lastZones: saved.lastZones ?? [],
  visitedZones: saved.visitedZones ?? [],
  rememberCourse: (course) => {
    const zones = [...new Set(course.map((c) => c.zone))]
    set({ lastZones: zones })
    persist(get())
  },
  visitZone: (zone) => {
    if (!ZONES.includes(zone) || get().visitedZones.includes(zone)) return
    set({ visitedZones: [...get().visitedZones, zone] })
    persist(get())
  },
}))
persist(useLumiMemory.getState())

// 아직 안 가 본 구역 (지난 코스 구역도 뺌). 다 가 봤으면 null
export function unvisitedZone(state) {
  const seen = new Set([...state.visitedZones, ...state.lastZones])
  return ZONES.find((z) => !seen.has(z)) ?? null
}

// 코스를 받으면 기억
useCourseStore.subscribe((state, prev) => {
  if (state.course.length && state.course !== prev.course) useLumiMemory.getState().rememberCourse(state.course)
})
// 촬영지·가게 원 안에 들어가면 그 구역은 "가 본 곳"
useGameStore.subscribe((state, prev) => {
  if (state.nearbyPlaceId && state.nearbyPlaceId !== prev.nearbyPlaceId) useLumiMemory.getState().visitZone(placeZone[state.nearbyPlaceId])
})
