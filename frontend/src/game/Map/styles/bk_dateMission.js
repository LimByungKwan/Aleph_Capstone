import { create } from 'zustand'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useGameStore } from '../../../store/gameStore.js'
import { useBadges } from '../../../store/badges.js'
import { useBkActivity } from './bk_activityStore.js'

// 데이트 코스 미션 (담당: 병관) — 영화·드라마 구역 "시간 탐정 역사 복원"과 같은 모양·흐름
//   데이트 코스 구역 안 7곳: 체험(또는 방문)을 끝내면 ◐ → 장소 카드에서 [🔖 데이트 스탬프] → ✓
//   절반(4곳)이면 💗 배지, 7곳 다 모으면 💕 배지 + 완주 보상 창
// 완료 신호: 동전 던지기·인형뽑기(bk_activityStore.completed) / 타로 결과 / 인생네컷 완성 / 망원경으로 명소 찾기 / 카페·벽화 골목 방문
// 기록은 계정별로 이 브라우저에 저장 (영화·드라마 구역 시간 탐정과 같은 방식)

export const DATE_MISSIONS = [
  {
    id: 'fountain',
    short: '소원 분수 광장',
    icon: '⛲',
    kind: '🪙 동전 던지기',
    center: [72, 0],
    intro: '연인과 함께 소원을 빌며 동전을 던지는 분수 광장이에요.',
    how: '분수 앞에서 E → Space를 눌렀다 떼서 힘을 정하고, 위쪽 물받이에 동전 3개를 넣어요.',
    nearby: ['분수 공원', '산책하기 좋은 공원'],
  },
  {
    id: 'claw',
    short: '한옥 인형뽑기',
    icon: '🧸',
    kind: '🕹️ 인형뽑기',
    center: [59.5, 25.3],
    intro: '데이트 기념 인형을 뽑아 서로에게 선물하는 한옥 오락실이에요.',
    how: '인형뽑기 기계 앞에서 E → 집게를 움직여 인형 하나를 뽑아요.',
    nearby: ['인형뽑기', '오락실'],
  },
  {
    id: 'tarot',
    short: '커플 타로 텐트',
    icon: '🔮',
    kind: '🃏 커플 타로',
    anchor: { name: 'BK/tarot_booth', local: [0, 0, 3.2] },
    mapAt: [49.5, 9],
    intro: '두 사람이 서로를 얼마나 아는지 질문 카드로 확인하고 타로 카드 3장으로 풀어 보는 텐트예요.',
    how: '텐트 앞에서 E → 두 사람이 질문 10개씩 답하고 카드를 펼쳐요 (혼자 한 기기 또는 접속 중인 사람 초대).',
    nearby: ['타로 카페', '사주 카페'],
  },
  {
    id: 'photo',
    short: '커플 포토존',
    icon: '📸',
    kind: '🎞️ 인생네컷',
    anchor: { name: 'BK/couple_photo', local: [0, 0, 2.6] },
    mapAt: [121, -32.5],
    intro: '하트 아치 앞에서 둘이 함께 인생네컷을 남기는 포토존이에요.',
    how: '포토존 앞에서 E → 혼자 찍기 또는 같이 찍기 → 발자국에 서면 3·2·1 × 4컷.',
    nearby: ['인생네컷', '셀프 사진관'],
  },
  {
    id: 'telescope',
    short: '별빛 전망대',
    icon: '🔭',
    kind: '🔭 망원경',
    anchor: { name: 'BK/tower', local: [0, 0, 8.5] },
    mapAt: [85, -82],
    intro: '엘리베이터로 올라가 망원경으로 다른 구역 명소를 찾아보는 전망대예요.',
    how: '엘리베이터로 전망층 → 망원경 앞에서 E → 명소 하나를 십자선에 맞춰요.',
    nearby: ['전망대', '야경 명소'],
  },
  {
    id: 'cafe',
    short: '소란 커피',
    icon: '☕',
    kind: '🚶 방문',
    center: [78.5, 17],
    intro: '드라마 주인공이 아르바이트하던 골목 카페. 걷다가 쉬어 가기 좋아요.',
    how: '카페 앞까지 걸어가면 완료돼요.',
    nearby: ['카페', '디저트 카페'],
  },
  {
    id: 'mural',
    short: '날개 벽화 골목',
    icon: '🪽',
    kind: '🚶 방문',
    center: [120.5, 2.5],
    intro: '날개 벽화 앞에서 사진을 남기는 골목. 드라마 엔딩 장면의 촬영지예요.',
    how: '벽화 골목까지 걸어가면 완료돼요.',
    nearby: ['벽화 거리', '사진 명소'],
  },
]
export const DATE_STAMP_COUNT = DATE_MISSIONS.length
export const DATE_BADGE_COUNT = 4
/** 미니 지도에 찍을 위치 (월드 x, z) */
export const mapPoint = (m) => m.mapAt ?? m.center
export const getMission = (id) => DATE_MISSIONS.find((m) => m.id === id) ?? null

// 데이트 코스 구역 범위 (bk_date.json origin [85, -40], size [80, 160])
export const inDateZone = (x, z) => x >= 45 && x <= 125 && z >= -120 && z <= 40

const KEY = 'scenewalk.date-mission'
function readSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY))
    return data && typeof data === 'object' && data.accounts ? data : { accounts: {} }
  } catch {
    return { accounts: {} }
  }
}
const empty = { done: {}, stamps: {} }

export const useDateMission = create((set, get) => ({
  saved: readSaved(), // { accounts: { [userId]: { done: {id: iso}, stamps: {id: iso} } } }
  card: null, // 열린 장소 카드 id | 'reward'
  mapOpen: false, // 데이트 코스 안내판(지도) 창
  pass: () => get().saved.accounts[useUiStore.getState().userId] ?? empty,
  write(fn) {
    const userId = useUiStore.getState().userId
    const saved = get().saved
    const next = { ...saved, accounts: { ...saved.accounts, [userId]: fn(saved.accounts[userId] ?? empty) } }
    set({ saved: next })
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // 저장이 막힌 브라우저면 이번 접속에서만
    }
  },
  /** 체험·방문 완료 → ◐ (스탬프는 카드에서 받기) */
  markDone(id) {
    if (!getMission(id) || get().pass().done[id]) return false
    get().write((p) => ({ ...p, done: { ...p.done, [id]: new Date().toISOString() } }))
    const m = getMission(id)
    useUiStore.getState().toast?.(`${m.icon} 데이트 미션 완료: ${m.short} — 오른쪽 목록에서 스탬프를 받아 보세요`, 'ok')
    return true
  },
  /** 스탬프 받기 → 받은 개수 (못 받으면 0) */
  collect(id) {
    const p = get().pass()
    if (!p.done[id] || p.stamps[id]) return 0
    get().write((q) => ({ ...q, stamps: { ...q.stamps, [id]: new Date().toISOString() } }))
    const count = Object.keys(get().pass().stamps).length
    const { award } = useBadges.getState()
    const { toast } = useUiStore.getState()
    if (count >= DATE_BADGE_COUNT && award('date_mission_half')) toast?.('💗 배지 획득: 데이트 탐험가', 'ok')
    if (count >= DATE_STAMP_COUNT && award('date_mission_all')) toast?.('💕 배지 획득: 데이트 코스 마스터', 'ok')
    return count
  },
  openCard: (id) => set({ card: id, mapOpen: false }),
  openMap: () => set({ mapOpen: true, card: null }),
  close: () => set({ card: null, mapOpen: false }),
}))

// ── 완료 신호 연결 ──
// 동전 던지기·인형뽑기: 원래 체험 완료 기록(bk_activityStore.completed)
const ACTIVITY_TO_MISSION = { bk_fountain_coin: 'fountain', bk_claw: 'claw' }
useBkActivity.subscribe((state, prev) => {
  if (state.completed === prev.completed) return
  for (const key of Object.keys(state.completed)) if (!prev.completed[key] && ACTIVITY_TO_MISSION[key]) useDateMission.getState().markDone(ACTIVITY_TO_MISSION[key])
})
// 카페·벽화 골목: 그 장소 지점에 들어가면 방문 완료 (지점 센서 = gameStore.nearbyPlaceId)
const VISIT = { cafe_soran: 'cafe', spot_mural: 'mural' }
useGameStore.subscribe((state, prev) => {
  if (state.nearbyPlaceId !== prev.nearbyPlaceId && VISIT[state.nearbyPlaceId]) useDateMission.getState().markDone(VISIT[state.nearbyPlaceId])
})

// ── 📍 내 근처에서 실제로 가 보기 ──
// 브라우저에게 지금 위치를 물어 그 위치 중심으로 지도 검색을 엶. 위치는 우리 서버로 보내지 않음 (지도 주소에만 들어감)
// 위치 사용을 거절하거나 안 되면 카카오맵 일반 검색으로
let lastCoords = null
export function openNearby(keyword) {
  const tab = window.open('about:blank', '_blank') // 팝업 차단을 피하려고 누른 순간에 창을 먼저 엶
  const go = (url) => {
    if (tab) tab.location.href = url
    else window.open(url, '_blank', 'noopener')
  }
  const fallback = () => go(`https://map.kakao.com/link/search/${encodeURIComponent(keyword)}`)
  const withCoords = ({ latitude, longitude }) => go(`https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${latitude.toFixed(5)},${longitude.toFixed(5)},15z`)
  if (lastCoords) return withCoords(lastCoords)
  if (!navigator.geolocation) return fallback()
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lastCoords = pos.coords
      withCoords(pos.coords)
    },
    fallback,
    { timeout: 8000, maximumAge: 5 * 60 * 1000 },
  )
}
