// [3. 개발 > 기초개발/서비스] 조선총독부 실내 충돌 박스 만들기 (혜진 영화·드라마 구역 전용 도구)
// 사용법 (frontend 폴더에서):  node scripts/hj-government-colliders.mjs
//
// govLayout.js의 벽·계단·발코니·가구 배치를 읽어 hj_drama.json에 gs_gg_* 충돌 박스를 만들어요.
// 총독부 아이템(gs_government)의 위치·회전을 따라가요. 여러 번 실행해도 결과가 같아요.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as L from '../src/game/Map/styles/hj/govLayout.js'

const here = dirname(fileURLToPath(import.meta.url))
const file = resolve(here, '../src/game/data/zones/hj_drama.json')
const zone = JSON.parse(readFileSync(file, 'utf8'))
const round = (n) => Math.round(n * 1000) / 1000

const gov = zone.props.find((p) => p.id === 'gs_government')
if (!gov) throw new Error('hj_drama.json에 gs_government가 없어요')
gov.collider = false
const [px, pz] = gov.position
const rotDeg = gov.rotationDeg ?? 0
const th = (rotDeg * Math.PI) / 180
const toZone = (x, z) => [round(px + x * Math.cos(th) + z * Math.sin(th)), round(pz - x * Math.sin(th) + z * Math.cos(th))]

const { GOV } = L
const FL = GOV.floor
const out = []
const box = (id, x, z, size, localDeg = 0, extra = {}) =>
  out.push({ id: `gs_gg_${id}`, style: 'hjBoothWallCollider', position: toZone(x, z), size: size.map(round), rotationDeg: round(rotDeg + localDeg), ...extra })

// 1층 바닥(기단) + 현관 기단 + 앞 계단
box('floor', 0, 0, [GOV.w, FL, GOV.d])
const P = L.PORTICO
box('portico', 0, P.z, [GOV.hallW - 1, FL, P.depth])
for (let i = 0; i < P.steps; i += 1) box(`front_step_${i}`, 0, P.z + P.depth / 2 + (P.steps - i - 0.5) * P.run, [GOV.hallW - 2, P.rise * (i + 1), P.run])
P.pillars.forEach((x, i) => box(`pillar_${i}`, x, P.z + P.depth / 2 - 0.6, [0.9, FL + 6.4, 0.9]))
// 벽
L.WALLS.forEach(([x0, z0, x1, z1, h], i) => {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const deg = (Math.atan2(-(z1 - z0), x1 - x0) * 180) / Math.PI
  box(`wall_${i}`, (x0 + x1) / 2, (z0 + z1) / 2, [len + GOV.T, h, GOV.T], deg)
})
// 중앙홀 계단 (한 단씩, 바닥부터 쌓인 박스) + 발코니 + 발코니 앞 난간
const S = L.STAIRS
S.xs.forEach((x, k) => {
  for (let i = 0; i < S.steps; i += 1) box(`stair_${k}_${i}`, x, S.fromZ - (i + 0.5) * S.run, [S.width, FL + S.rise * (i + 1), S.run])
})
const LD = L.LANDING
box('landing', 0, LD.z0 + LD.depth / 2, [GOV.hallW - GOV.T, FL + LD.h, LD.depth])
box('landing_rail', 0, LD.z0 + LD.depth - 0.1, [7.3, 1.0, 0.2], 0, { elevation: FL + LD.h })
// 큰 네모 기둥
const pz0 = LD.z0 + LD.depth + 0.4
for (const [i, [x, z]] of [[-2.9, pz0], [2.9, pz0], [-GOV.hallW / 2 + 0.55, GOV.vestZ - 0.5], [GOV.hallW / 2 - 0.55, GOV.vestZ - 0.5]].entries()) {
  box(`hall_pillar_${i}`, x, z, [1.0, GOV.hallH, 1.0])
}
// 로비: 단 + 낮은 계단 + 진열장 + 장식장
const D = L.LOBBY_DAIS
const lx = -(GOV.hallW / 2 + (GOV.w / 2 - GOV.hallW / 2) / 2)
const lw = GOV.w / 2 - GOV.hallW / 2 - GOV.T
box('dais', lx, D.z0 + D.depth / 2, [lw, FL + D.steps * D.rise, D.depth])
for (let i = 0; i < D.steps; i += 1) box(`dais_step_${i}`, lx, D.z0 + D.depth + (D.steps - i - 0.5) * D.run, [lw, FL + D.rise * (i + 1), D.run])
box('case', L.LOBBY_CASE[0], L.LOBBY_CASE[1], [L.LOBBY_CASE[2], FL + 1.0, L.LOBBY_CASE[3]])
box('cabinet', L.LOBBY_CABINET[0], L.LOBBY_CABINET[1], [L.LOBBY_CABINET[2], FL + 1.1, L.LOBBY_CABINET[3]])
// 사무실: 책상 · 서류장
L.OFFICE_DESKS.forEach(([x, z, w, d], i) => box(`desk_${i}`, x, z, [w, FL + 0.8, d]))
L.OFFICE_CABINETS.forEach(([x, z, w, d], i) => box(`file_${i}`, x, z, [w, FL + 1.9, d]))

zone.props = zone.props.filter((p) => !p.id.startsWith('gs_gg_'))
const at = zone.props.findIndex((p) => p.id === 'gs_government')
zone.props.splice(at + 1, 0, ...out)

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
console.log(`총독부 충돌 박스 ${out.length}개 생성`)
