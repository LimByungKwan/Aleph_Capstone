import { layout } from '../../game/data/mapData.js'
import { GUIDE_BOARD, PALACE_ORIGIN_Z } from '../../game/Map/styles/hj/gyeongbokLayout.js'
import { useZoneEntryStore } from './zoneEntryStore.js'

// [3. 개발 > 프론트엔드] 영화·드라마 구역 안의 작은 구역 (혜진)
// 경복궁 · 1930 경성거리. 캐릭터가 구역에 들어오면 입장 카드(EntranceWelcome)를 띄우고,
// 멀리 떠 있는 구역 이름표(📍)를 누르거나 안내판에서 고르면 그 구역 입구로 바로 옮겨 줘요.
// 좌표는 hj_drama.json 구역 기준(로컬) 값 → 월드 좌표로 바꿔 써요.

const palace = layout.props.find((item) => item.id === 'HJ/haewol_palace')
const PALACE_LOCAL = [0, -74] // hj_drama.json 안 경복궁 위치 (구역 기준)

/** 구역 기준 좌표 → 월드 좌표 [x, y, z] */
export function zoneToWorld(lx, lz, y = 1.4) {
  if (!palace) return null
  return [palace.position[0] - PALACE_LOCAL[0] + lx, y, palace.position[1] - PALACE_LOCAL[1] + lz]
}

/** 북악산 자리를 내려고 1930 경성거리(hj_drama.json의 gs_*)를 통째로 북쪽으로 옮긴 거리 (m) */
export const GS_SHIFT = 60

// 경복궁 배치(A 좌표) → 구역 기준 z: 궁 위치 - 기준점 + az
const palaceAz = (az) => PALACE_LOCAL[1] - PALACE_ORIGIN_Z + az

export const HJ_AREAS = [
  {
    id: 'palace',
    emoji: '🏯',
    name: '경복궁',
    eyebrow: 'Palace · 조선의 궁궐',
    tagline: '광화문 앞 안내판을 누르면 전각마다 바로 갈 수 있어요',
    // 구역 기준 [x0, x1, z0, z1] — 광화문 앞마당부터 신무문까지
    box: [-40, 40, palaceAz(-36), palaceAz(73)],
    arrive: () => zoneToWorld(GUIDE_BOARD.ax + 2.2, palaceAz(GUIDE_BOARD.az - 1.6)),
  },
  {
    id: 'gyeongseong',
    emoji: '🚃',
    name: '1930 경성거리',
    eyebrow: 'Retro Street · 1930 경성',
    tagline: '전차를 타고 경성역·종로·총독부 앞을 둘러보세요',
    box: [-56, 48, palaceAz(76) + GS_SHIFT, 112 + GS_SHIFT],
    arrive: () => zoneToWorld(0, 16.8 + GS_SHIFT),
  },
  {
    id: 'park',
    emoji: '🎡',
    name: '해월 드림파크',
    eyebrow: 'Dream Park · 놀이공원',
    tagline: '관람차·회전목마·회전그네, 열기구와 사파리 지프를 E로 타 보세요',
    // 경복궁 동쪽 빈 땅 (월드 x 42~130, z 42~250 = 구역 기준 z -103~105)
    box: [42, 130, -103, 105],
    arrive: () => zoneToWorld(57, -91.5),
  },
  {
    id: 'seoul',
    emoji: '🏙️',
    name: '2026 현대 서울',
    eyebrow: 'Time Train · 2026 서울',
    noGuide: true, // 안내판(경복궁·경성거리)은 여기엔 없어요
    tagline: '광화문 광장을 걷고, 역에서 시간 열차를 타면 1930 경성으로 돌아가요',
    // 현대 서울(timeTravel.SEOUL_CENTER, 월드 z 1400 = 구역 기준 z 1255) 둘레
    box: [-150, 150, 1255 - 112, 1255 + 90],
    arrive: () => zoneToWorld(6, 1255 - 96.5, 2.0),
  },
]

export const areaById = (id) => HJ_AREAS.find((a) => a.id === id) ?? null

/** 구역 이름표(hjAnalogLabel sceneId) → 구역 */
export const areaForScene = (sceneId) => areaById(sceneId === 'palace' ? 'palace' : sceneId === 'gyeongseong' ? 'gyeongseong' : '')

function areaAt(x, z) {
  if (!palace) return null
  const lx = x - (palace.position[0] - PALACE_LOCAL[0])
  const lz = z - (palace.position[1] - PALACE_LOCAL[1])
  return HJ_AREAS.find(({ box: [x0, x1, z0, z1] }) => lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1) ?? null
}

// ── 구역 들어오기 감지: palaceSeating.updatePalaceSeating이 매 프레임 캐릭터 위치를 넘겨 줘요 ──
let current = null
let lastPos = null
const shownAt = {} // 구역별 마지막으로 카드를 띄운 시각 (경계에서 서성일 때 계속 안 뜨게)
const AREA_COOLDOWN_MS = 30000

export function trackHjArea(position) {
  lastPos = position
  const area = areaAt(position.x, position.z)
  const id = area?.id ?? null
  if (id === current) return
  current = id
  if (!area) return
  const now = Date.now()
  if (now - (shownAt[id] ?? 0) < AREA_COOLDOWN_MS) return
  shownAt[id] = now
  useZoneEntryStore.getState().showArea(id)
}

/** 마지막으로 본 내 캐릭터 위치 {x,y,z} (없으면 null) */
export const lastPlayerPosition = () => lastPos
