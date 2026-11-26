// [3. 개발 > 기초개발/서비스] 압축 경복궁 충돌 박스 만들기 (혜진 영화·드라마 구역 전용 도구)
// 사용법 (frontend 폴더에서):  node scripts/hj-gyeongbok-colliders.mjs
//
// gyeongbokLayout.js 배치를 읽어서 hj_drama.json을 고쳐요.
//  1) haewol_palace → 압축 경복궁(style "hjGyeongbokPalace"), 위치·크기를 배치 기준에 맞춤
//  2) 근정전 월대·계단·실내 충돌 박스(haewol_terrace/throne/room_*)를 새 위치로 옮기고 gb_core_* 로 이름 바꿈 (처음 한 번만)
//  3) 예전 해월궁 충돌 박스(haewol_* 의 나머지)를 지우고, 담장·전각·행각·연못 충돌 박스(gb_*)를 새로 만듦
// 여러 번 실행해도 결과가 같아요.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as L from '../src/game/Map/styles/hj/gyeongbokLayout.js'

const here = dirname(fileURLToPath(import.meta.url))
const file = resolve(here, '../src/game/data/zones/hj_drama.json')
const zone = JSON.parse(readFileSync(file, 'utf8'))

const OLD_SCALE_Z = 66 / 53 // 예전 해월궁 size [53, 9, 66]
const round = (n) => Math.round(n * 1000) / 1000
// 배치 파일의 az → 구역 z (궁궐 아이템이 놓인 자리 기준)
let zShift = 0
const world = (ax, az) => [round(L.AXIS_X + ax), round(az + zShift)]
const collider = (id, ax, az, size, extra = {}) => ({
  id: `gb_${id}`,
  style: 'hjBoothWallCollider',
  position: world(ax, az),
  size: size.map(round),
  ...extra,
})

// ── 1·2) 궁궐 아이템 + 근정전 충돌 박스 옮기기 (예전 배치일 때만) ──
const palace = zone.props.find((p) => p.id === 'haewol_palace')
const wasOld = palace && palace.style === 'hjPalace'
const CORE = /^haewol_(terrace|throne|room)/
zone.props = zone.props.map((p) => {
  if (wasOld && (CORE.test(p.id) || p.id === 'haewol_label')) {
    const [x, z] = p.position
    const moved = { ...p, position: [x, round(L.PALACE_ORIGIN_Z + z / OLD_SCALE_Z)] }
    if (p.size && p.id !== 'haewol_label') moved.size = [p.size[0], p.size[1], round(p.size[2] / OLD_SCALE_Z)]
    if (p.id !== 'haewol_label') moved.id = p.id.replace(/^haewol_/, 'gb_core_')
    return moved
  }
  return p
})
// 궁궐 가운데 축(AXIS_X)이 바뀌었으면 근정전 충돌 박스·이름표도 같이 옆으로 옮김
if (palace && !wasOld && palace.position[0] !== L.AXIS_X) {
  const dx = L.AXIS_X - palace.position[0]
  for (const p of zone.props) {
    if (p.id.startsWith('gb_core_') || p.id === 'haewol_label') p.position = [round(p.position[0] + dx), p.position[1]]
  }
}
if (palace) {
  const p = zone.props.find((item) => item.id === 'haewol_palace')
  p.position = [L.AXIS_X, p.position[1]]
  p.style = 'hjGyeongbokPalace'
  // 아이템 z는 그대로 둠 (구역을 옮겨도 궁궐이 따라감). 처음 바꿀 때만 배치 기준 자리로
  if (wasOld) p.position = [L.AXIS_X, L.PALACE_ORIGIN_Z]
  zShift = p.position[1] - L.PALACE_ORIGIN_Z
  p.size = [53, 9, 53]
  p.collider = false
}

// ── 3) 예전 해월궁 충돌·소품 지우고 gb_* 새로 만들기 ──
const KEEP = new Set(['haewol_palace', 'haewol_label', 'haewol_approach_sign'])
zone.props = zone.props.filter((p) => {
  if (p.id.startsWith('haewol_')) return KEEP.has(p.id)
  if (p.id.startsWith('gb_') && !p.id.startsWith('gb_core_')) return false
  return true
})

const generated = []
const { minX, maxX, minZ, maxZ } = L.BOUNDS
generated.push(collider('court_floor', (minX + maxX) / 2, (minZ + maxZ) / 2, [maxX - minX, 0.18, maxZ - minZ], { elevation: -0.022 }))
L.WALLS.forEach(([x0, z0, x1, z1], i) => {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const rotationDeg = round((Math.atan2(-(z1 - z0), x1 - x0) * 180) / Math.PI)
  generated.push(collider(`wall_${i}`, (x0 + x1) / 2, (z0 + z1) / 2, [len + L.WALL_T, L.WALL_H + 0.5, L.WALL_T], { rotationDeg })) // 끝을 두께만큼 늘려 모서리 틈 막기
})
L.GWANGHWAMUN_PIERS.forEach(([a, b], i) => {
  generated.push(collider(`gwanghwamun_pier_${i}`, (a + b) / 2, L.GWANGHWAMUN.az, [b - a, 3.05, L.GWANGHWAMUN.depth]))
})
// 두 점을 잇는 얇은 벽 (난간)
const segment = (id, x0, z0, x1, z1, h, thick = 0.3, extra = {}) => {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const rotationDeg = round((Math.atan2(-(z1 - z0), x1 - x0) * 180) / Math.PI)
  return collider(id, (x0 + x1) / 2, (z0 + z1) / 2, [len, h, thick], { rotationDeg, ...extra })
}
for (const hall of L.HALLS) {
  const rotationDeg = hall.rotation ?? 0
  if (hall.solid) {
    // 들어갈 수 있는 전각 (HanokHall enterable과 같은 치수 계산)
    //  기단·월대(위에 올라설 수 있음) + 앞 계단(한 단씩) + 벽(가운데 칸 문만 비움)
    const base = hall.base ?? 0.45
    const W2 = hall.w / 2 - 0.1
    const D2 = hall.d / 2 - 0.1
    const nb = hall.bays ?? Math.max(3, Math.round(hall.w / 2.2) | 1)
    const colR = 0.11 + hall.h * 0.016
    const woldae = hall.woldae ?? 0
    const at = (lx, lz) => [hall.ax + lx, hall.az + lz] // 이 전각들은 회전 없음
    const top = 0.17 + base // 마당 0.17 위 기단 높이
    generated.push(collider(`${hall.id}_base`, ...at(0, 0), [W2 * 2 + 1.2, top, D2 * 2 + 1.2], { elevation: 0 }))
    if (woldae > 0) generated.push(collider(`${hall.id}_woldae`, ...at(0, -(D2 + 0.65) - woldae / 2), [W2 * 1.72, top, woldae + 0.1], { elevation: 0 }))
    const n = Math.max(1, Math.ceil(base / 0.16))
    const front = -(D2 + 0.65) - woldae
    const sw = Math.min(3, (W2 * 2) / nb + 0.4)
    const stairXs = woldae > 0 ? [0, -W2 * 0.55, W2 * 0.55] : [0]
    stairXs.forEach((sx, si) => {
      for (let k = 0; k < n; k += 1) {
        generated.push(collider(`${hall.id}_step_${si}_${k}`, ...at(sx, front - 0.3 * (n - k) + 0.15), [sw, 0.17 + (base * (k + 1)) / (n + 1), 0.3], { elevation: 0 }))
      }
    })
    const xs = Array.from({ length: nb + 1 }, (_, i) => -W2 + (i * 2 * W2) / nb)
    const c = (nb - 1) / 2
    const wallH = hall.h + 0.2
    const wall = (id, x0, z0, x1, z1) => {
      const [ax0, az0] = at(x0, z0)
      const [ax1, az1] = at(x1, z1)
      generated.push(segment(`${hall.id}_${id}`, ax0, az0, ax1, az1, wallH, 0.3, { elevation: top }))
    }
    if (hall.furnish === 'throne') {
      // 편전 실내: 어탑(용상 단)과 안쪽 높은 기둥 4개·어좌 뒤 붉은 기둥 2개 (HjHallFurniture Pyeonjeon과 같은 자리)
      const back = D2 - 0.12
      generated.push(collider(`${hall.id}_eotap`, ...at(0, back - 1.0), [2.9, 0.49, 1.5], { elevation: top })) // 단 높이만 (용상에 앉으면 단 위에 놓여요)
      for (const x of [-W2 * 0.45, W2 * 0.45]) for (const z of [-D2 * 0.45, D2 * 0.25]) generated.push(collider(`${hall.id}_incol_${x > 0 ? 'e' : 'w'}${z > 0 ? 'n' : 's'}`, ...at(x, z), [0.4, hall.h, 0.4], { elevation: top }))
      for (const s of [-1, 1]) generated.push(collider(`${hall.id}_frame_${s}`, ...at(s * 2.0, back - 0.25), [0.35, hall.h, 0.35], { elevation: top }))
    }
    if (hall.furnish === 'kitchen') {
      // 소주방(수라간) 실내: 부뚜막·찬장·선반·손질 상·소반 받침·옹기·물통·뒤주 (HjKitchen.jsx와 같은 자리)
      const K = L.kitchenSpots(W2, D2)
      const box = (id, x, z, sx, sz, h) => generated.push(collider(`${hall.id}_${id}`, ...at(x, z), [sx, h, sz], { elevation: top }))
      box('hearth', (K.hearth.x0 + K.hearth.x1) / 2, K.hearth.z, K.hearth.x1 - K.hearth.x0, K.hearth.d, K.hearth.h + 0.35)
      box('cupboard', K.cupboard.x, K.cupboard.z, K.cupboard.w, K.cupboard.l, K.cupboard.h)
      box('shelf', K.shelf.x, K.shelf.z, K.shelf.w, K.shelf.d, K.shelf.h)
      box('table', K.table.x, K.table.z, K.table.w, K.table.d, K.table.h)
      box('trays', K.trays.x, K.trays.z, K.trays.w, K.trays.d, K.trays.h + 0.2)
      box('chest', K.chest.x, K.chest.z, K.chest.w, K.chest.d, K.chest.h)
      K.jars.forEach(([x, z, r], i) => box(`jar_${i}`, x, z, r * 2, r * 2, r * 2.2))
      K.buckets.forEach(([x, z], i) => box(`bucket_${i}`, x, z, 0.4, 0.4, 0.45))
    }
    wall('wall_back', -W2, D2, W2, D2)
    wall('wall_left', -W2, -D2, -W2, D2)
    wall('wall_right', W2, -D2, W2, D2)
    wall('wall_front_l', -W2, -D2, xs[c] + colR, -D2)
    wall('wall_front_r', xs[c + 1] - colR, -D2, W2, -D2)
  }
  if (hall.mode === 'gate' && (hall.bays ?? 1) > 1) {
    // 대문 양옆 칸 벽 (가운데 칸만 지나가요)
    const n = hall.bays
    const W = hall.w - 0.2
    const bw = W / n
    for (let i = 0; i < n; i += 1) {
      if (Math.abs(i - (n - 1) / 2) < 0.6) continue
      const xc = -W / 2 + (i + 0.5) * bw
      generated.push(collider(`${hall.id}_wall_${i}`, hall.ax + xc, hall.az, [bw, hall.h, 0.4]))
    }
  }
}
// 행각(복랑): 낮은 기단(한 걸음) + 가운데 벽 + 양쪽 기둥 — 양쪽 복도를 걸어 다녀요 (HanokHall corridor와 같은 치수)
for (const c of L.CORRIDORS) {
  const rot = ((c.rotation ?? 0) * Math.PI) / 180
  const rotationDeg = c.rotation ?? 0
  // 로컬(x, z) → A 좌표 (y축 회전)
  const at = (lx, lz) => [c.ax + lx * Math.cos(rot) + lz * Math.sin(rot), c.az - lx * Math.sin(rot) + lz * Math.cos(rot)]
  const W2 = c.w / 2 - 0.1
  const D2 = c.d / 2 - 0.1
  const base = 0.15
  generated.push(collider(`${c.id}_base`, c.ax, c.az, [W2 * 2 + 1.2, 0.17 + base, D2 * 2 + 1.2], { rotationDeg, elevation: 0 }))
  generated.push(collider(`${c.id}_wall`, c.ax, c.az, [W2 * 2, c.h + 0.2, 0.3], { rotationDeg, elevation: 0.17 + base }))
  const nb = Math.max(2, Math.round(c.w / 2.4))
  for (let i = 0; i <= nb; i += 1) {
    const lx = -W2 + (i * 2 * W2) / nb
    for (const lz of [-D2, D2]) generated.push(collider(`${c.id}_col_${i}_${lz < 0 ? 'f' : 'b'}`, ...at(lx, lz), [0.3, c.h, 0.3], { elevation: 0.17 + base }))
  }
}
// 연못 물 (경회루 축대·돌다리, 향원정 섬·취향교 자리는 비움)
L.pondWaterBoxes().forEach(([ax, az, w, d, rot], i) => generated.push(collider(`pond_water_${i}`, ax, az, [w, 2.5, d], rot ? { rotationDeg: rot } : {})))
// 경회루: 돌기둥 48개 + 축대 돌난간 + 나무 계단
L.gyeonghoeruPillars().forEach(([ax, az], i) => generated.push(collider(`gyeonghoeru_pillar_${i}`, ax, az, [0.46, L.GYEONGHOERU.pillarH, 0.46])))
L.gyeonghoeruRails().forEach(([x0, z0, x1, z1], i) => generated.push(segment(`gyeonghoeru_rail_${i}`, x0, z0, x1, z1, 0.8, 0.28)))
// 경회루 2층: 나무 계단(한 단씩) + 마루 + 마루 난간 + 바깥·안쪽 기둥 + 안쪽 칸 양옆 칸막이
{
  const G = L.GYEONGHOERU
  const S = L.GYEONGHOERU_STAIR
  const deckTop = L.GYEONGHOERU_DECK_Y
  const run = (S.xBottom - S.xTop) / S.steps
  const rise = (deckTop - 0.17) / S.steps
  for (const s of [-1, 1]) {
    for (let k = 0; k < S.steps; k += 1) {
      generated.push(collider(`gyeonghoeru_step_${s < 0 ? 's' : 'n'}_${k}`, G.ax + S.xBottom - (k + 0.5) * run, G.az + s * S.zOff, [run + 0.02, 0.17 + (k + 1) * rise, S.width], { elevation: 0 }))
    }
    // 계단 꼭대기 끝 난간 (그대로 걸어가 떨어지지 않게 → 마루 쪽으로 돌아서 올라가요)
    generated.push(collider(`gyeonghoeru_stair_head_${s < 0 ? 's' : 'n'}`, G.ax + S.xTop - 0.08, G.az + s * S.zOff, [0.14, deckTop + 1, S.width + 0.1], { elevation: 0 }))
    // 계단 바깥쪽 난간
    generated.push(segment(`gyeonghoeru_stair_rail_${s < 0 ? 's' : 'n'}`, G.ax + S.xBottom, G.az + s * (S.zOff + S.width / 2 + 0.05), G.ax + S.xTop, G.az + s * (S.zOff + S.width / 2 + 0.05), deckTop + 1, 0.12, { elevation: 0 }))
  }
  generated.push(collider('gyeonghoeru_deck', G.ax, G.az, [G.w + 0.5, 0.3, G.d + 0.5], { elevation: deckTop - 0.3 }))
  L.gyeonghoeruDeckRails().forEach(([x0, z0, x1, z1], i) => generated.push(segment(`gyeonghoeru_deck_rail_${i}`, x0, z0, x1, z1, 1.0, 0.16, { elevation: deckTop })))
  // 바깥 기둥 (누각 기둥 격자: az 방향 8줄 × ax 방향 6줄의 둘레)
  const xs = Array.from({ length: 6 }, (_, i) => -(G.w / 2 - 0.1) + (i * (G.w - 0.2)) / 5)
  const zs = Array.from({ length: 8 }, (_, j) => -(G.d / 2 - 0.1) + (j * (G.d - 0.2)) / 7)
  let c = 0
  for (const x of xs) for (const z of zs) {
    if (x !== xs[0] && x !== xs[5] && z !== zs[0] && z !== zs[7]) continue
    generated.push(collider(`gyeonghoeru_upper_col_${c++}`, G.ax + x, G.az + z, [0.3, 2.4, 0.3], { elevation: deckTop }))
  }
  const ring = L.gyeonghoeruInnerRing()
  ring.cols.forEach(([x, z], i) => generated.push(collider(`gyeonghoeru_inner_col_${i}`, x, z, [0.3, 2.4, 0.3], { elevation: deckTop })))
  ring.bays.forEach(({ a, b }, i) => {
    const alongX = a[1] === b[1]
    const L2 = Math.abs(alongX ? b[0] - a[0] : b[1] - a[1]) - 0.26
    for (const sgn of [-1, 1]) {
      const u = sgn * (L2 / 2 - 0.17)
      const x = G.ax + (a[0] + b[0]) / 2 + (alongX ? u : 0)
      const z = G.az + (a[1] + b[1]) / 2 + (alongX ? 0 : u)
      generated.push(collider(`gyeonghoeru_screen_${i}_${sgn < 0 ? 'a' : 'b'}`, x, z, alongX ? [0.36, 1.5, 0.12] : [0.12, 1.5, 0.36], { elevation: deckTop }))
    }
  })
}
// 향원정: 1층 육각 벽(남쪽 문 비움) + 기단 바닥 + 남쪽 디딤돌 + 2층(못 올라감)
{
  const Y = L.HYANGWON
  const floorTop = 0.17 + Y.base
  // 1층 벽은 1층 높이까지만 (2층 툇마루를 막지 않게)
  L.hyangwonWalls().forEach(([x0, z0, x1, z1], i) => generated.push(segment(`hyangwon_wall_${i}`, x0, z0, x1, z1, Y.h1, 0.2, { elevation: floorTop })))
  const half = (Y.R + 0.42) * Math.cos(Math.PI / 6)
  generated.push(collider('hyangwon_floor', Y.ax, Y.az, [half * 2, floorTop, half * 2], { elevation: 0 }))
  generated.push(collider('hyangwon_step', Y.ax, Y.az - (half + 0.22), [0.95, 0.17 + 0.2, 0.42], { elevation: 0 }))
  // 안쪽 계단 (한 단씩)
  const S = L.HYANGWON_STAIR
  const top2 = 0.17 + L.HYANGWON_Y1
  const run = (S.xBottom - S.xTop) / S.steps
  const rise = (top2 - floorTop) / S.steps
  for (let k = 0; k < S.steps; k += 1) {
    generated.push(collider(`hyangwon_stair_${k}`, Y.ax + S.xBottom - (k + 0.5) * run, Y.az + S.z, [run + 0.02, floorTop + (k + 1) * rise, S.width], { elevation: 0 }))
  }
  // 계단 꼭대기 너머 (서쪽 끝) 막기 — 계단 구멍 바깥으로 떨어지지 않게 마루가 이어져요
  // 2층 마루: 계단 구멍([x0,x1]×[z0,z1])만 비우고 네 조각
  const [hx0, hx1, hz0, hz1] = L.HYANGWON_HOLE
  const D = Y.R + 0.28
  const plate = (id, x0, x1, z0, z1) =>
    generated.push(collider(`hyangwon_deck_${id}`, Y.ax + (x0 + x1) / 2, Y.az + (z0 + z1) / 2, [x1 - x0, 0.16, z1 - z0], { elevation: top2 - 0.16 }))
  plate('s', -D, D, -D, hz0)
  plate('n', -D, D, hz1, D)
  plate('w', -D, hx0, hz0, hz1)
  plate('e', hx1, D, hz0, hz1)
  // 2층 벽 (열린 북·남 면 빼고) + 툇마루 난간
  for (let k = 0; k < 6; k += 1) {
    const a = (k * Math.PI) / 3
    const b = ((k + 1) * Math.PI) / 3
    const r2 = Y.R * 0.9
    if (!L.HYANGWON_UPPER_OPEN.includes(k)) {
      generated.push(segment(`hyangwon_upper_wall_${k}`, Y.ax + Math.cos(a) * r2, Y.az + Math.sin(a) * r2, Y.ax + Math.cos(b) * r2, Y.az + Math.sin(b) * r2, Y.h2, 0.16, { elevation: top2 }))
    }
    const rr = Y.R + 0.22
    generated.push(segment(`hyangwon_rail_${k}`, Y.ax + Math.cos(a) * rr, Y.az + Math.sin(a) * rr, Y.ax + Math.cos(b) * rr, Y.az + Math.sin(b) * rr, 1.0, 0.14, { elevation: top2 }))
  }
  // 2층 천장 위 (지붕에 올라가지 않게)
  generated.push(collider('hyangwon_roof', Y.ax, Y.az, [Y.R * 2.2, 0.3, Y.R * 2.2], { elevation: top2 + Y.h2 + 0.1 }))
}
// 근정전 윗단 월대 돌난간 (근정전 아이템 기준 좌표 → A 좌표)
L.GEUNJEONG_UPPER_RAILS.forEach(([x0, z0, x1, z1], i) =>
  generated.push(segment(`geunjeong_upper_rail_${i}`, x0, z0 + L.PALACE_ORIGIN_Z, x1, z1 + L.PALACE_ORIGIN_Z, 0.6, 0.22, { elevation: 0.92 })),
)
generated.push(collider('amisan', L.AMISAN.ax, L.AMISAN.az, [L.AMISAN.w, 1.6, L.AMISAN.d]))
L.TREES.forEach(([ax, az], i) => generated.push(collider(`pine_${i}`, ax, az, [0.45, 2, 0.45])))
L.WILLOWS.forEach(([ax, az], i) => generated.push(collider(`willow_${i}`, ax, az, [0.45, 2, 0.45])))
L.HAETAE.forEach(([ax, az], i) => generated.push(collider(`haetae_${i}`, ax, az, [1.5, 2, 2.2])))
generated.push(collider('guide_board', L.GUIDE_BOARD.ax, L.GUIDE_BOARD.az, [L.GUIDE_BOARD.w + 0.2, 2.6, 0.4]))

// 궁궐 아이템 바로 뒤에 끼워 넣기 (파일에서 찾기 쉽게)
const at = zone.props.findIndex((p) => p.id === 'haewol_palace')
zone.props.splice(at + 1, 0, ...generated)

// ── 원래 파일 형식(항목 한 줄씩)으로 저장 ──
const fmt = (v) => JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/\[[-0-9.,\[\] ]+\]/g, (m) => m.replace(/,(?! )/g, ', '))
const lines = ['{']
const keys = Object.keys(zone)
keys.forEach((k, ki) => {
  const v = zone[k]
  const end = ki === keys.length - 1 ? '' : ','
  if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
    lines.push(`  ${JSON.stringify(k)}: [`)
    v.forEach((it, i) => lines.push(`    ${fmt(it)}${i === v.length - 1 ? '' : ','}`))
    lines.push(`  ]${end}`)
  } else lines.push(`  ${JSON.stringify(k)}: ${fmt(v)}${end}`)
})
lines.push('}')
writeFileSync(file, `${lines.join('\n')}\n`)
console.log(`경복궁 충돌 박스 ${generated.length}개 생성${wasOld ? ' (근정전 충돌 박스 이동 포함)' : ''}`)
