import { create } from 'zustand'
import { useCourseStore } from './courseStore.js'
import { useUiStore } from '../components/movieZone/uiStore.js'

// 루미가 주는 배지 + 코스 도착·완주 알림 (담당: 병관)
// 배지는 이 브라우저에만 저장 (localStorage). 쿠폰은 지민·혜진님 영역이라 배지만 줌
// 보여 주는 곳: 루미 대화창 아래 "내 배지" (components/course/LumiCourse.jsx)

export const BADGES = [
  { id: 'first_course', icon: '🥇', name: '첫 코스 완주', desc: '루미가 추천한 코스를 처음으로 끝까지 걸었어요' },
  { id: 'date_course', icon: '💕', name: '데이트 코스 완주', desc: '데이트 코스 구역 장소로만 된 코스를 완주했어요' },
  { id: 'explorer', icon: '🧭', name: '구역 탐험가', desc: '3개 이상 구역을 지나는 코스를 완주했어요' },
  { id: 'daily', icon: '🎁', name: '오늘의 코스 완주', desc: '루미의 "오늘의 코스"를 완주했어요' },
]

const KEY = 'scenewalk.badges'

function readSaved() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export const useBadges = create((set, get) => ({
  earned: readSaved(), // [{ id, at: 'YYYY-MM-DD', note? }]
  has: (id) => get().earned.some((b) => b.id === id),
  award: (id, note) => {
    // 같은 배지는 한 번만 (오늘의 코스는 날짜(note)마다 하나씩)
    if (get().earned.some((b) => b.id === id && (b.note ?? null) === (note ?? null))) return false
    const earned = [...get().earned, { id, at: new Date().toISOString().slice(0, 10), ...(note ? { note } : {}) }]
    set({ earned })
    try {
      localStorage.setItem(KEY, JSON.stringify(earned))
    } catch {
      // 저장이 막힌 브라우저면 이번 접속에서만
    }
    return true
  },
}))

// 완주한 코스로 받을 배지 고르기
function badgesFor(course, meta) {
  const zones = new Set(course.map((c) => c.zone))
  const ids = [['first_course']]
  if (course.length && [...zones].every((z) => z === 'BK')) ids.push(['date_course'])
  if (zones.size >= 3) ids.push(['explorer'])
  if (meta?.daily) ids.push(['daily', meta.daily])
  return ids
}

// 도착할 때마다 알림, 마지막 장소면 완주 + 배지
useCourseStore.subscribe((state, prev) => {
  if (state.index <= prev.index || state.course !== prev.course) return
  const { toast } = useUiStore.getState()
  const total = state.course.length
  if (state.index < total) {
    const next = state.course[state.index]
    toast(`📍 ${state.index}/${total} 도착! 다음은 '${next.name}'이에요`, 'ok')
    return
  }
  toast(`🎉 코스 완주! ${total}곳을 모두 걸었어요`, 'ok')
  const { award } = useBadges.getState()
  for (const [id, note] of badgesFor(state.course, state.meta)) {
    const badge = BADGES.find((b) => b.id === id)
    const label = note ? `${badge.name} (${note.slice(5).replace('-', '/')})` : badge.name
    if (award(id, note)) setTimeout(() => toast(`${badge.icon} 배지 획득: ${label}`, 'ok'), 700)
  }
})
