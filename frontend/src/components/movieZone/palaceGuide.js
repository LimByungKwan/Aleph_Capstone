import { palaceQuestions } from './palaceQuestions.js'
import { SEOUL_GATE_Z, seoulToWorld } from './timeTravel.js'
import { create } from 'zustand'
import { layout } from '../../game/data/mapData.js'
import { GWANGHWAMUN, GYEONGHOERU, GYEONGHOERU_DECK_Y, HALLS, HYANGWON, HYANGWON_Y1, PALACE_ORIGIN_Z, PONDS, pyeonjeonSpots } from '../../game/Map/styles/hj/gyeongbokLayout.js'
import { registerPalaceSeat, registerWarpSpot } from './palaceSeating.js'
import { useHallDoors } from './hjSync.js'
import { GS_SHIFT, zoneToWorld } from './hjAreas.js'

// [3. 개발 > 프론트엔드] 경복궁 관람 안내판 (혜진 영화·드라마 구역)
// 광화문 앞 안내판을 누르면 목록이 뜨고, 고른 전각 앞으로 바로 옮겨 줘요 (PalaceGuideMenu.jsx).
// 좌표는 배치 파일(gyeongbokLayout.js)의 A 좌표를 월드 좌표로 바꿔 계산해요.

// tab: 위쪽 탭 — 'palace' 경복궁 · 'gyeongseong' 1930 경성거리
export const usePalaceGuide = create((set) => ({
  open: false,
  tab: 'palace',
  quizId: null,
  showQuiz: (quizId) => set({ open: true, tab: 'palace', quizId }),
  show: (tab) => set(typeof tab === 'string' ? { open: true, tab, quizId: null } : { open: true, quizId: null }),
  setTab: (tab) => set({ tab }),
  hide: () => set({ open: false, quizId: null }),
}))

const palace = layout.props.find((item) => item.id === 'HJ/haewol_palace')
// 배치 A 좌표 → 월드 좌표
export function palaceToWorld(ax, az, y = 1.4) {
  if (!palace) return null
  return [palace.position[0] + ax, y, palace.position[1] - PALACE_ORIGIN_Z + az]
}

// 전각 정면 계단 앞 (월대·계단 길이까지 띄워서)
function front(id, extra = 0) {
  const h = HALLS.find((x) => x.id === id)
  const base = h.base ?? 0.45
  const steps = Math.max(1, Math.ceil(base / 0.16)) * 0.3
  return palaceToWorld(h.ax, h.az - h.d / 2 - 0.65 - (h.woldae ?? 0) - steps - 1.2 - extra)
}

// 향원정 안쪽 계단: 아래에서 E → 2층, 2층 계단 구멍 옆에서 E → 1층 (좁은 육각 방이라 직접 오르는 대신)
if (palace) {
  // 현대 광화문 앞에서 실내가 있는 궁궐로 연결하고 같은 문으로 돌아온다.
  const plazaGate = seoulToWorld(0, 1, SEOUL_GATE_Z - 2.8)
  const palaceGate = palaceToWorld(0, GWANGHWAMUN.az + 2.8)
  registerWarpSpot({ id: 'seoul_palace_enter', position: plazaGate, radius: 2.2,
    prompt: '광화문으로 경복궁 입장', warpTo: palaceGate })
  registerWarpSpot({ id: 'seoul_palace_return', position: palaceGate, radius: 2.2,
    prompt: '광화문광장으로 돌아가기', warpTo: plazaGate })
  const floor1 = 0.17 + HYANGWON.base + 1.0 // 캐릭터 몸통 높이
  const floor2 = 0.17 + HYANGWON_Y1 + 1.0
  const at = (lx, lz, y) => palaceToWorld(HYANGWON.ax + lx, HYANGWON.az + lz, y)
  registerWarpSpot({ id: 'hyangwon_up', position: at(0.3, 0.25, floor1), radius: 0.75, prompt: '계단 올라 2층으로', warpTo: at(-0.4, -0.45, floor2 + 0.2) })
  registerWarpSpot({ id: 'hyangwon_down', position: at(0, 0.1, floor2), radius: 0.6, prompt: '계단 내려 1층으로', warpTo: at(0.25, -0.45, floor1 + 0.2) })
}

export const GUIDE_STOPS = palace
  ? [
      { id: 'court', name: '근정전 앞마당', note: '품계석·박석 마당', pos: palaceToWorld(0, -12.5) },
      { id: 'throne', name: '근정전 안 (어좌)', note: '일월오봉도·황룡 천장', pos: palaceToWorld(0, -2.6, 1.6) },
      { id: 'gyeonghoeru', name: '경회루 (연못가)', note: '1997년 연못에서 화재를 막아 달라며 넣어 둔 청동 용이 발견됐어요.', pos: palaceToWorld(PONDS[0].ax + PONDS[0].w / 2 + 1, GYEONGHOERU.az) },
      { id: 'gyeonghoeru_up', name: '경회루 2층 누각', note: '우물마루·번개살 칸막이', pos: palaceToWorld(GYEONGHOERU.ax + 3.3, GYEONGHOERU.az, GYEONGHOERU_DECK_Y + 1) },
      { id: 'hyangwon', name: '향원정 (연못가)', note: '육각 정자·취향교', pos: palaceToWorld(HYANGWON.ax, PONDS[1].az - PONDS[1].d / 2 - 1.2) },
      { id: 'sajeongjeon', name: '사정전', note: '임금이 일하던 편전', pos: front('sajeongjeon') },
      { id: 'gangnyeongjeon', name: '강녕전', note: '임금의 침전 (용마루 없음)', pos: front('gangnyeongjeon') },
      { id: 'gyotaejeon', name: '교태전 · 아미산', note: '왕비의 침전', pos: front('gyotaejeon') },
      { id: 'sujeongjeon', name: '수정전', note: '세종 때 이 자리에는 학자들이 연구하던 집현전이 있었어요.', pos: front('sujeongjeon') },
      { id: 'donggung', name: '자선당 (동궁)', note: '세자가 살던 곳', pos: front('donggung') },
      { id: 'jagyeongjeon', name: '자경전', note: '대비의 침전', pos: front('jagyeongjeon') },
      { id: 'geoncheonggung', name: '건청궁', note: '고종 때 향원지의 물을 이용한 발전 설비로 궁궐에 전깃불을 밝혔어요.', pos: front('geoncheonggung') },
      { id: 'sojubang', name: '소주방 (수라간)', note: '궁중 잔칫상을 준비하던 부엌이에요. 실록 속 장금은 중종을 치료한 의녀였어요.', pos: front('sojubang') },
    ]
  : []

for (const stop of GUIDE_STOPS.filter(stop => palaceQuestions[stop.id])) {
  registerWarpSpot({
    id: 'quiz_' + stop.id, position: stop.pos, radius: 1.35,
    prompt: stop.name + ' 역사 퀴즈',
    action: () => usePalaceGuide.getState().showQuiz(stop.id),
  })
}

// 1930 경성거리 (경복궁 신무문 북쪽). 좌표는 hj_drama.json 구역 기준 → zoneToWorld
const gs = (lx, lz) => zoneToWorld(lx, lz)
export const GYEONGSEONG_STOPS = palace
  ? [
      { id: 'gs_pass', name: '북악산 고갯길 · 숙정문', note: '성곽과 바위산 사이 돌길', pos: zoneToWorld(4.5, 20) },
      { id: 'gs_clock', name: '시계탑 광장', note: '경성거리 입구 · 꽃밭과 벤치', pos: gs(0, 16.8) },
      { id: 'gs_station', name: '경성역 앞', note: '전차 정류장 · 돔 지붕 역사', pos: gs(-25.4, 35) },
      { id: 'gs_platform', name: '기차 승강장', note: '증기기관차 타는 곳', pos: gs(-40.1, 40) },
      { id: 'gs_jongno', name: '종로 전차 정류장', note: '땡땡 전차 타는 곳', pos: gs(-1.6, 47.2) },
      { id: 'gs_west', name: '극장·호텔 거리', note: '서쪽 거리 · 극장과 호텔', pos: gs(-27.5, 60) },
      { id: 'gs_east', name: '백화점·빵집 거리', note: '동쪽 거리 · 백화점과 레코드 가게', pos: gs(27.5, 60) },
      { id: 'gs_gov', name: '총독부 앞', note: '돌계단과 기둥 현관', pos: gs(-7.5, 77) },
    ]
  : []

// 안내판 위쪽 탭: 구역마다 갈 곳 목록
export const GUIDE_AREAS = [
  { id: 'palace', name: '🏯 경복궁', stops: GUIDE_STOPS },
  { id: 'gyeongseong', name: '🚃 경성거리', stops: GYEONGSEONG_STOPS },
]

// ── 전각 문 열고 닫기 ─────────────────────────────
// 들어갈 수 있는 전각(solid)마다 가운데 칸 문을 E로 열고 닫아요. 닫히면 문 자리에 충돌 박스가 생겨 못 지나가요.
// 처음엔 모두 열려 있어요. closed: { [전각 id]: true }
// 문 상태 저장소는 멀티 동기화(hjSync.js)에 있어요 — 누가 닫으면 다른 사람 화면에서도 닫혀요
export { useHallDoors }

// 문 자리 (HanokHall과 같은 치수 계산): 가운데 칸 너비·높이, 월드 좌표
export const HALL_DOORS = palace
  ? HALLS.filter((h) => h.solid).map((h) => {
      const base = h.base ?? 0.45
      const W2 = h.w / 2 - 0.1
      const D2 = h.d / 2 - 0.1
      const nb = h.bays ?? Math.max(3, Math.round(h.w / 2.2) | 1)
      const colR = 0.11 + h.h * 0.016
      const width = (2 * W2) / nb - colR * 2
      const height = h.h * 0.72
      const [x, , z] = palaceToWorld(h.ax, h.az - D2)
      return { id: h.id, title: h.title, x, z, floor: 0.17 + base, width, height }
    })
  : []

for (const door of HALL_DOORS) {
  registerWarpSpot({
    id: `door_${door.id}`,
    position: [door.x, door.floor + 1.0, door.z],
    radius: 1.15,
    get prompt() {
      return useHallDoors.getState().closed[door.id] ? `${door.title} 문 열기` : `${door.title} 문 닫기`
    },
    action: () => useHallDoors.getState().toggle(door.id),
  })
}

// ── 사정전 앉는 자리: 어좌(용상, 어탑 위)만 ──
// 좌판 높이·자리는 gyeongbokLayout.js pyeonjeonSpots와 같아요. 모두 앞(-z, 문 쪽)을 바라보고 앉아요.
const STAND = 0.91 // 발 → 서 있는 몸통 높이
const sajeong = HALLS.find((h) => h.id === 'sajeongjeon')
if (palace && sajeong) {
  const W2 = sajeong.w / 2 - 0.1
  const D2 = sajeong.d / 2 - 0.1
  const floor = 0.17 + (sajeong.base ?? 0.45)
  const P = pyeonjeonSpots(W2, D2)
  const at = (x, z) => palaceToWorld(sajeong.ax + x, sajeong.az + z)
  const seat = (id, label, x, z, standOn, top) => {
    const [wx, , wz] = at(x, z)
    registerPalaceSeat({ id, label, position: [wx, floor + standOn + STAND, wz], yaw: Math.PI, surfaceY: floor + top })
  }
  seat('sajeong_throne', '어좌', P.throne.x, P.throne.z, P.platformTop, P.throne.top)
}

// ── 실내 판정 (안에 들어가면 1인칭) ─────────────────
// 들어갈 수 있는 곳의 바닥 범위: 전각들 · 근정전 실내 · 향원정 1·2층 · 경회루 2층 마루
// { kind: 'rect', x0, x1, z0, z1, floor } / { kind: 'circle', x, z, r, floor }. floor 위 2.5m 안에 있으면 실내
export const INDOOR_AREAS = []
if (palace) {
  for (const h of HALLS.filter((x) => x.solid)) {
    const [x0, , z0] = palaceToWorld(h.ax - (h.w / 2 - 0.25), h.az - (h.d / 2 - 0.25))
    const [x1, , z1] = palaceToWorld(h.ax + (h.w / 2 - 0.25), h.az + (h.d / 2 - 0.25))
    INDOOR_AREAS.push({ id: h.id, kind: 'rect', x0, x1, z0, z1, floor: 0.17 + (h.base ?? 0.45) })
  }
  // 근정전 실내 (방 13.2 × 6.56, 정전 기준 z 13)
  {
    const [x0, , z0] = palaceToWorld(-6.4, PALACE_ORIGIN_Z + 13 - 3.1)
    const [x1, , z1] = palaceToWorld(6.4, PALACE_ORIGIN_Z + 13 + 3.1)
    INDOOR_AREAS.push({ id: 'geunjeongjeon', kind: 'rect', x0, x1, z0, z1, floor: 0.92 })
  }
  const [hx, , hz] = palaceToWorld(HYANGWON.ax, HYANGWON.az)
  INDOOR_AREAS.push({ id: 'hyangwon1', kind: 'circle', x: hx, z: hz, r: HYANGWON.R * 0.86, floor: 0.17 + HYANGWON.base })
  INDOOR_AREAS.push({ id: 'hyangwon2', kind: 'circle', x: hx, z: hz, r: HYANGWON.R * 0.78, floor: 0.17 + HYANGWON_Y1 })
  const [gx0, , gz0] = palaceToWorld(GYEONGHOERU.ax - GYEONGHOERU.w / 2, GYEONGHOERU.az - GYEONGHOERU.d / 2)
  const [gx1, , gz1] = palaceToWorld(GYEONGHOERU.ax + GYEONGHOERU.w / 2, GYEONGHOERU.az + GYEONGHOERU.d / 2)
  INDOOR_AREAS.push({ id: 'gyeonghoeru2', kind: 'rect', x0: gx0, x1: gx1, z0: gz0, z1: gz1, floor: GYEONGHOERU_DECK_Y })
}
// 발 높이(feetY)로 실내인지
export function indoorAt(x, feetY, z) {
  for (const a of INDOOR_AREAS) {
    if (feetY < a.floor - 0.3 || feetY > a.floor + 1.2) continue
    if (a.kind === 'rect' ? x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1 : Math.hypot(x - a.x, z - a.z) < a.r) return a.id
  }
  return null
}
