import { layout } from '../../../data/mapData.js'

// [2. 설계 > 화면 설계] 자동차가 다닐 수 있는 곳 + 부딪히는 것 (혜진 영화·드라마 구역 → 중앙 광장)
// 차는 물리 엔진 밖에서 움직여서, 여기서 직접 "갈 수 있는지"를 따져요.
//  1) DRIVE_RECTS: 차 앞·뒤 바퀴 중심이 이 네모들 중 하나 안에 있어야 해요 (길·광장·궁궐 둘레 길)
//  2) 맵의 충돌 박스(건물·가로등·벤치·나무 …)와 겹치면 못 가요 → 벽에 부딪히면 멈춰요
// 좌표는 월드 좌표. [x0, x1, z0, z1]

export const DRIVE_RECTS = [
  [-27.5, 37, 176.8, 187], // 경성 큰길 + 양쪽 인도
  [-3.5, 3.5, 186, 224], // 총독부 대로
  [-11, 11, 224, 229], // 총독부 앞마당
  [-14, 14, 162, 177], // 시계탑 광장
  [-39.5, 39.5, 158.9, 162.3], // 궁궐 뒤 길
  [37.5, 40, 47.3, 162], // 궁궐 동쪽 길
  [-40, -37.6, 47.3, 162], // 궁궐 서쪽 길
  [-39.5, 39.5, 47.3, 50.3], // 광화문 앞 길
  [-3, 3, 24, 48], // 영화·드라마 구역 입구 → 중앙 광장 길
  [-25, 25, -25, 25], // 중앙 광장
]

// 충돌 박스로는 너무 작게 잡힌 큰 물건 (보이는 크기로 막아요): [x, z, 반지름]
const EXTRA_CIRCLES = [[0, 0, 4.6]] // 중앙 광장 시계탑 받침

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
    if (!near(x, z, r + 2)) continue
    const a = ((item.rotationDeg ?? 0) * Math.PI) / 180
    obstacles.push({ x, z, hw: w / 2, hd: d / 2, cos: Math.cos(a), sin: Math.sin(a) })
  }
  return obstacles
}

const inRects = (x, z) => DRIVE_RECTS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)

// 반지름 r인 원(차 앞·뒤)이 이 자리에 있어도 되는지
export function circleFree(x, z, r) {
  if (!inRects(x, z)) return false
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
