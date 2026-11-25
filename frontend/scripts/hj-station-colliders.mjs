// [3. 개발 > 기초개발/서비스] 경성역 실내 충돌 박스 만들기 (혜진 영화·드라마 구역 전용 도구)
// 사용법 (frontend 폴더에서):  node scripts/hj-station-colliders.mjs
//
// stationLayout.js의 벽·기둥·벤치·가구 배치를 읽어 hj_drama.json에 gs_st_* 충돌 박스를 만들어요.
// 경성역 아이템(gs_station)의 위치·회전을 따라가니, 역을 옮긴 뒤에도 다시 실행하면 돼요. 여러 번 실행해도 결과가 같아요.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as L from '../src/game/Map/styles/hj/stationLayout.js'

const here = dirname(fileURLToPath(import.meta.url))
const file = resolve(here, '../src/game/data/zones/hj_drama.json')
const zone = JSON.parse(readFileSync(file, 'utf8'))
const round = (n) => Math.round(n * 1000) / 1000

const station = zone.props.find((p) => p.id === 'gs_station')
if (!station) throw new Error('hj_drama.json에 gs_station이 없어요')
station.collider = false // 통째 박스 대신 벽마다 충돌 박스
const [px, pz] = station.position
const rotDeg = station.rotationDeg ?? 0
const th = (rotDeg * Math.PI) / 180
// 역 기준 (x, z) → 구역 좌표 (three.js y축 회전과 같은 방향)
const toZone = (x, z) => [round(px + x * Math.cos(th) + z * Math.sin(th)), round(pz - x * Math.sin(th) + z * Math.cos(th))]

const out = []
const box = (id, x, z, size, localDeg = 0, extra = {}) =>
  out.push({ id: `gs_st_${id}`, style: 'hjBoothWallCollider', position: toZone(x, z), size: size.map(round), rotationDeg: round(rotDeg + localDeg), ...extra })

L.WALLS.forEach(([x0, z0, x1, z1, h], i) => {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const deg = (Math.atan2(-(z1 - z0), x1 - x0) * 180) / Math.PI
  box(`wall_${i}`, (x0 + x1) / 2, (z0 + z1) / 2, [len + L.STATION.T, h, L.STATION.T], deg)
})
L.HALL_COLUMNS.forEach(([x, z], i) => box(`hall_col_${i}`, x, z, [0.8, L.STATION.coreH, 0.8]))
L.WAITING_COLUMNS.forEach(([x, z], i) => box(`wait_col_${i}`, x, z, [0.6, L.STATION.wingH, 0.6]))
L.WAITING_BENCHES.forEach(([x, z, len], i) => box(`bench_${i}`, x, z, [len, 1.1, 0.7]))
box('ticket', -(L.STATION.w / 2 - L.STATION.T) + 0.45, 0, [0.9, 2.7, 3.4])
L.VIP_SOFAS.forEach(([x, z, w, d, deg], i) => box(`sofa_${i}`, x, z, [w, 1.0, d], deg))
box('vip_table', L.VIP_TABLE[0], L.VIP_TABLE[1], [L.VIP_TABLE[2], 0.6, L.VIP_TABLE[3]])
box('fireplace', L.FIREPLACE.x, L.FIREPLACE.z, [L.FIREPLACE.d, L.FIREPLACE.h, L.FIREPLACE.w])

zone.props = zone.props.filter((p) => !p.id.startsWith('gs_st_'))
const at = zone.props.findIndex((p) => p.id === 'gs_station')
zone.props.splice(at + 1, 0, ...out)

// 원래 파일 형식(항목 한 줄씩)으로 저장
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
console.log(`경성역 충돌 박스 ${out.length}개 생성`)
