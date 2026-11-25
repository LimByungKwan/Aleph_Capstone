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
  generated.push(collider(`wall_${i}`, (x0 + x1) / 2, (z0 + z1) / 2, [len, L.WALL_H + 0.5, L.WALL_T], { rotationDeg }))
})
L.GWANGHWAMUN_PIERS.forEach(([a, b], i) => {
  generated.push(collider(`gwanghwamun_pier_${i}`, (a + b) / 2, L.GWANGHWAMUN.az, [b - a, 3.05, L.GWANGHWAMUN.depth]))
})
for (const hall of L.HALLS.filter((x) => x.solid)) {
  generated.push(collider(hall.id, hall.ax, hall.az, [hall.w * 0.93, hall.h, hall.d * 0.81], { rotationDeg: hall.rotation ?? 0 }))
}
for (const c of L.CORRIDORS) {
  generated.push(collider(c.id, c.ax, c.az, [c.w, c.h, c.d], { rotationDeg: c.rotation ?? 0 }))
}
for (const pond of L.PONDS) {
  generated.push(collider(pond.id, pond.ax, pond.az, [pond.w + 0.4, 0.6, pond.d + 0.4]))
}
generated.push(collider('amisan', L.AMISAN.ax, L.AMISAN.az, [L.AMISAN.w, 1.6, L.AMISAN.d]))
L.TREES.forEach(([ax, az], i) => generated.push(collider(`pine_${i}`, ax, az, [0.45, 2, 0.45])))
L.HAETAE.forEach(([ax, az], i) => generated.push(collider(`haetae_${i}`, ax, az, [1.5, 2, 2.2])))

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
