import { layout } from '../../../data/mapData.js'
import { vehicles } from '../../../../components/movieZone/rideSeats.js'

// [2. 설계 > 화면 설계] 자동차가 다닐 수 있는 곳 + 부딪히는 것 (혜진 영화·드라마 구역 → 중앙 광장)
// 차는 물리 엔진 밖에서 움직여서, 여기서 직접 "갈 수 있는지"를 따져요.
//  1) DRIVE_RECTS: 차 앞·뒤 바퀴 중심이 이 네모들 중 하나 안에 있어야 해요 (길·광장·궁궐 둘레 길)
//  2) 맵의 충돌 박스(건물·가로등·벤치·나무 …)와 겹치면 못 가요 → 벽에 부딪히면 멈춰요
// 좌표는 월드 좌표. [x0, x1, z0, z1]

export const DRIVE_RECTS = [
  [-27.5, 37, 236.8, 247], // 경성 큰길 + 양쪽 인도 (경성거리는 북악산 너머로 60m 옮김)
  [-3.5, 3.5, 246, 284], // 총독부 대로
  [-11, 11, 284, 289], // 총독부 앞마당
  [-14, 14, 222, 237], // 시계탑 광장
  [-36, 41, 222, 300], // 1930 경성거리 한 구역 전체 (길·광장·공원 사이 빈 땅까지 — 건물·나무·가로등은 충돌로 막혀요)
  [-2.5, 11.5, 159, 223], // 북악산 고갯길 (궁궐 뒤 길 → 숙정문 → 시계탑 광장)
  [-39.5, 39.5, 158.9, 162.3], // 궁궐 뒤 길
  [37.5, 40, 47.3, 162], // 궁궐 동쪽 길
  [-40, -37.6, 47.3, 162], // 궁궐 서쪽 길
  [-39.5, 39.5, 47.3, 50.3], // 광화문 앞 길
  [-3, 3, 24, 48], // 영화·드라마 구역 입구 → 중앙 광장 길
  [-25, 25, -25, 25], // 중앙 광장
  // 중앙 광장 → 다른 구역 입구 (기존 흙길 위로만, 구역 안으로는 안 들어가요)
  [-3, 3, -46, -24], // 애니메이션 구역 입구 길 (남)
  [24, 46, -3, 3], // 데이트 코스 구역 입구 길 (동)
  [-46, -24, -3, 3], // K-pop 구역 입구 길 (서)
  // 경복궁 동쪽 길 → 해월 드림파크 입구 주차장·광장
  [39.5, 47.5, 51, 58], // 드림파크 들어가는 길 → 입구 문(가운데)
  [47.5, 64, 45.5, 61], // 드림파크 입구 광장 + 주차장(남동 구석)
]

// 충돌 박스로는 너무 작게 잡힌 큰 물건 (보이는 크기로 막아요): [x, z, 반지름]
const EXTRA_CIRCLES = [
  [0, 0, 4.6], // 중앙 광장 시계탑 받침
  // 드림파크 입구 (충돌은 ThemeParkColliders라 여기서 따로 막아요): 문 기둥 2 · 매표소 2
  [46.5, 50.9, 0.6], [46.5, 58.1, 0.6], [48, 48.7, 1.6], [48, 60.3, 1.6],
  // 북악산 고갯길 (충돌은 HjBugaksan 지형 몸체라 여기서 따로): 숙정문은 가운데 홍예(x 2.4~6.6)로만 지나가요
  ...[188, 190.5, 193, 195].flatMap((z) => [[-1.3, z, 1.2], [1.2, z, 1.2], [7.8, z, 1.2], [10.3, z, 1.2]]),
  // 고갯길 석등 (양쪽, 7m마다)
  ...[167.4, 174.4, 181.4, 188.4, 195.4, 202.4, 209.4, 216.4].flatMap((z) => [[-1.8, z, 0.45], [10.8, z, 0.45]]),
]

const near = (x, z, r) => DRIVE_RECTS.some(([x0, x1, z0, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r)
const SKIP = /^HJ\/gs_(car|rickshaw|tram|train)/ // 움직이는 것들은 빼요

let obstacles = null
// 차가 다니는 곳 근처의 충돌 박스만 미리 골라 둬요 (처음 한 번)
function getObstacles() {
  if (obstacles) return obstacles
  obstacles = []
  for (const item of [...layout.props, ...layout.buildings]) {
    if (item.collider === false || SKIP.test(item.id)) continue
    const [w, h, d] = item.collider ?? item.size ?? [0, 0, 0]
    if (!w || !d) continue
    if ((item.elevation ?? 0) < 0 || h < 0.35) continue // 바닥판·낮은 턱은 넘어가요
    if ((item.elevation ?? 0) > 1.6) continue // 머리 위 간판 등
    const [x, z] = item.position
    const r = Math.hypot(w, d) / 2
    // 가는 기둥(가로등·표지판·말뚝)은 차가 스치듯 지나가게 빼요 — 걸림돌이 너무 많지 않게
    if (Math.max(w, d) < 0.45) continue
    if (!near(x, z, r + 2)) continue
    const a = ((item.rotationDeg ?? 0) * Math.PI) / 180
    // 실제 크기보다 조금(10%) 작게 잡아 모서리에 덜 걸려요
    obstacles.push({ x, z, hw: w * 0.45, hd: d * 0.45, cos: Math.cos(a), sin: Math.sin(a) })
  }
  return obstacles
}

const inRects = (x, z) => DRIVE_RECTS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)

// 움직이는 탈것(전차·기차·인력거·다른 자동차): 차체 상자와 겹치면 못 가요 (selfId: 내 차는 빼요)
function hitsVehicle(x, z, r, selfId) {
  for (const v of vehicles.values()) {
    if (v.id === selfId || !v.toLocal || !v.w || !v.l) continue
    if (v.label === '열기구') continue // 하늘에 떠 있어요
    const p = v.toLocal(x, 1, z)
    if (Math.abs(p.y) > 4) continue
    if (Math.abs(p.x) < v.w / 2 + r && Math.abs(p.z) < v.l / 2 + r) return true
  }
  return false
}

// 반지름 r인 원(차 앞·뒤)이 이 자리에 있어도 되는지
export function circleFree(x, z, r, selfId) {
  if (!inRects(x, z)) return false
  if (hitsVehicle(x, z, r, selfId)) return false
  for (const [cx, cz, cr] of EXTRA_CIRCLES) if (Math.hypot(x - cx, z - cz) < cr + r) return false
  for (const o of getObstacles()) {
    const dx = x - o.x
    const dz = z - o.z
    // 박스 기준 좌표로 (아이템 회전의 반대로)
    const lx = dx * o.cos - dz * o.sin
    const lz = dx * o.sin + dz * o.cos
    const qx = Math.max(-o.hw, Math.min(o.hw, lx))
    const qz = Math.max(-o.hd, Math.min(o.hd, lz))
    if ((lx - qx) ** 2 + (lz - qz) ** 2 < r * r) return false
  }
  return true
}
