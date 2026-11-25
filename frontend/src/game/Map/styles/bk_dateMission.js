import { create } from 'zustand'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useBadges } from '../../../store/badges.js'
import { useBkActivity } from './bk_activityStore.js'
import { EMPTY_EPISODE_BOOK, collectEpisodePostcard, getDateEpisode, recordEpisodeActivity } from './bk_dateEpisodes.js'
import { episodeRoom, useEpisodeRoom } from './bk_episodeRoom.js'
import { LETTER_ENDINGS, LETTER_STATIONS } from '@shared/bk_letterPuzzle.js'

// 데이트 코스 미션 (담당: 병관) — 영화·드라마 구역 "시간 탐정 역사 복원"과 같은 모양·흐름
//   데이트 코스 구역 안 7곳: 체험을 끝내면 ◐ → 장소 카드에서 [🔖 데이트 스탬프] → ✓
//   절반(4곳)이면 💗 배지, 7곳 다 모으면 💕 배지 + 완주 보상 창
// 완료 신호: 동전 던지기·인형뽑기 / 타로 결과 / 인생네컷 완성 / 망원경으로 명소 찾기 / 카페 주문 / 벽화 구도 맞추기
// 기록은 계정별로 이 브라우저에 저장 (영화·드라마 구역 시간 탐정과 같은 방식)

export const DATE_MISSIONS = [
  {
    id: 'fountain',
    short: '소원 분수 광장',
    icon: '⛲',
    kind: '🪙 동전 던지기',
    center: [68, 0],
    landingClearance: 0.55,
    mapAt: [72, 0],
    intro: '연인과 함께 소원을 빌며 동전을 던지는 분수 광장이에요.',
    how: '분수 앞에서 E 또는 안내 버튼을 누르세요. Space나 던지기 버튼을 꾹 눌렀다 떼서 위쪽 물받이에 동전 3개를 넣어요.',
    nearby: ['분수 공원', '산책하기 좋은 공원'],
  },
  {
    id: 'claw',
    short: '한옥 인형뽑기',
    icon: '🧸',
    kind: '🕹️ 인형뽑기',
    anchor: { name: 'BK/claw_booth', local: [0, 0, 2.5] },
    landingClearance: 0.48,
    mapAt: [59.5, 25.3],
    intro: '데이트 기념 인형을 뽑아 서로에게 선물하는 한옥 오락실이에요.',
    how: '기계 앞에서 E 또는 안내 버튼을 누르세요. 방향키나 화면 버튼으로 집게를 움직인 뒤 내려서 인형을 뽑아요.',
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
    kind: '상대 취향으로 한 잔',
    center: [75.5, 18.2], // 워프는 카운터 앞의 평평한 산책로로
    mapAt: LETTER_STATIONS.sequence.point,
    intro: '드라마 주인공이 아르바이트하던 골목 카페. 걷다가 쉬어 가기 좋아요.',
    how: '가게 앞 주문 카운터에서 E 또는 [주문하기]를 누르세요. 메뉴를 고르고 잔 위의 점을 이어 음료를 만든 뒤 토핑을 올려요.',
    nearby: ['카페', '디저트 카페'],
  },
  {
    id: 'mural',
    short: '날개 벽화 골목',
    icon: '🪽',
    kind: '엔딩 장면 맞추기',
    center: LETTER_STATIONS.palette.point, // 벽화 앞 발자국 (벽화 중심에서 +z 방향으로 6m)
    intro: '주인공이 꿈을 고백했던 영화의 엔딩 촬영지예요. 벽화 앞에서 마지막 장면의 구도를 찾아보세요.',
    how: '분홍 발자국에 서서 E 또는 [구도 맞추기]를 누르세요. 양쪽 날개 끝과 발자국을 프레임 안에 넣으면 사진을 찍거나 장면을 완성할 수 있어요.',
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
    if (!data || typeof data.accounts !== 'object' || !data.accounts) return { accounts: {} }
    // 예전 방문으로 받은 스탬프는 인정해요. 아직 받지 않았다면 새 체험부터 진행해요.
    for (const pass of Object.values(data.accounts)) {
      if (pass?.done?.cafe && !pass.stamps?.cafe && !pass.cafeOrder) delete pass.done.cafe
      if (pass?.done?.mural && !pass.stamps?.mural && !pass.muralFramed) delete pass.done.mural
    }
    return data
  } catch {
    return { accounts: {} }
  }
}
const empty = { done: {}, stamps: {} }

export const useDateMission = create((set, get) => ({
  saved: readSaved(), // { accounts: { [userId]: { done: {id: iso}, stamps: {id: iso} } } }
  card: null, // 열린 장소 카드 id | 'reward'
  mapOpen: false, // 데이트 코스 안내판(지도) 창
  episodeGuide: null, // 목적지 안내를 켠 계정
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
  /** 체험 완료 → ◐ (스탬프는 카드에서 받기) */
  markDone(id, cafeOrder) {
    const m = getMission(id)
    if (!m || (id === 'cafe' && !cafeOrder)) return false
    const pass = get().pass()
    const alreadyDone = pass.done[id]
    const shared = episodeRoom.complete(id, cafeOrder)
    const episodeBook = shared ? pass.episodeBook : recordEpisodeActivity(pass.episodeBook, id, cafeOrder)
    const episodeAdvanced = episodeBook !== pass.episodeBook
    if (alreadyDone && !cafeOrder && !episodeAdvanced) return false
    get().write((p) => ({
      ...p,
      done: { ...p.done, [id]: alreadyDone || new Date().toISOString() },
      ...(id === 'cafe' && { cafeOrder }),
      ...(id === 'mural' && { muralFramed: true }),
      ...(episodeAdvanced && { episodeBook }),
    }))
    if (episodeAdvanced) useUiStore.getState().toast?.('💌 에피소드가 진행됐어요. 다음 장소나 엽서를 확인해 보세요.', 'ok')
    if (alreadyDone) return true
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
  startEpisode(id) {
    if (!getDateEpisode(id)) return
    const book = get().pass().episodeBook ?? EMPTY_EPISODE_BOOK
    get().write((p) => ({
      ...p, episodeBook: { ...book, currentId: id, runs: { ...book.runs, [id]: book.runs[id] ?? { step: 0 } } },
    }))
  },
  savePostcard(id, line) {
    const current = get().pass().episodeBook
    const episodeBook = collectEpisodePostcard(current, id, line, new Date().toISOString())
    if (episodeBook !== current) get().write((p) => ({ ...p, episodeBook }))
  },
  saveSharedCheckpoint({ episodeId, step, order, finished }) {
    const book = get().pass().episodeBook ?? EMPTY_EPISODE_BOOK
    const previous = book.runs[episodeId]
    const run = !finished && previous?.step > step ? previous : { step, ...(order && { order }) }
    get().write((p) => ({
      ...p, episodeBook: { ...book, currentId: episodeId, runs: { ...book.runs, [episodeId]: run } },
    }))
  },
  saveLetterPostcard({ roundId, ending }) {
    if (!LETTER_ENDINGS[ending] || get().pass().letterPostcard?.roundId === roundId) return
    get().write((pass) => ({ ...pass, letterPostcard: { roundId, ending } }))
    useUiStore.getState().toast?.('💌 둘이 찾은 편지를 엔딩 엽서함에 저장했어요.', 'ok')
  },
  showEpisodeGuide: (visible = true) => set({ episodeGuide: visible ? useUiStore.getState().userId : null }),
}))

useEpisodeRoom.subscribe((state, previous) => {
  const date = useDateMission.getState()
  if (state.room && state.room.roomId !== previous.room?.roomId) {
    if (!state.room.letter) date.saveSharedCheckpoint({ episodeId: state.room.episodeId, step: 0 })
    date.showEpisodeGuide()
  }
  const letter = state.room?.letter
  if (letter?.solved && !previous.room?.letter?.solved) date.saveLetterPostcard(letter)
  if (state.checkpoint && state.checkpoint !== previous.checkpoint) {
    date.saveSharedCheckpoint(state.checkpoint)
    const message = state.checkpoint.finished ? '💌 함께 걸은 에피소드가 끝났어요. 각자의 엔딩 엽서를 써 보세요.' : '💌 두 사람 모두 완료했어요. 다음 장소로 가요.'
    useUiStore.getState().toast?.(message, 'ok')
  }
  if (state.notice && state.notice !== previous.notice && !state.invite) useUiStore.getState().toast?.(state.notice, 'info')
})

// ── 완료 신호 연결 ──
// 동전 던지기·인형뽑기: 원래 체험 완료 기록(bk_activityStore.completed)
const ACTIVITY_TO_MISSION = { bk_fountain_coin: 'fountain', bk_claw: 'claw' }
useBkActivity.subscribe((state, prev) => {
  if (state.completed === prev.completed) return
  for (const key of Object.keys(state.completed)) if (!prev.completed[key] && ACTIVITY_TO_MISSION[key]) useDateMission.getState().markDone(ACTIVITY_TO_MISSION[key])
})

// ── 📍 내 근처에서 실제로 가 보기 ──
// 브라우저에게 지금 위치를 물어 그 위치 중심으로 지도 검색을 엶. 위치는 우리 서버로 보내지 않음 (지도 주소에만 들어감)
// 위치 사용을 거절하거나 안 되면 카카오맵 일반 검색으로
export function openNearby(keyword) {
  const tab = window.open('about:blank', '_blank') // 팝업 차단을 피하려고 누른 순간에 창을 먼저 엶
  if (tab) tab.opener = null
  const go = (url) => {
    if (!tab) window.location.assign(url) // 새 탭이 차단되면 현재 탭에서 열기
    else if (!tab.closed) tab.location.replace(url)
  }
  const fallback = () => go(`https://map.kakao.com/link/search/${encodeURIComponent(keyword)}`)
  const withCoords = ({ latitude, longitude }) => go(`https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${latitude.toFixed(5)},${longitude.toFixed(5)},15z`)
  if (!navigator.geolocation) return fallback()
  navigator.geolocation.getCurrentPosition(
    (pos) => withCoords(pos.coords),
    fallback,
    { timeout: 8000, maximumAge: 5 * 60 * 1000 },
  )
}
