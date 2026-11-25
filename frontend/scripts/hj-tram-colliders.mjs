// [3. 개발 > 기초개발/서비스] 전시 전차 충돌 박스 만들기 (혜진 영화·드라마 구역 전용 도구)
// 사용법 (frontend 폴더에서):  node scripts/hj-tram-colliders.mjs
// 전시 전차(gs_tram_exhibit)의 위치·회전을 따라 바닥·벽·의자·발판 충돌 박스(gs_tx_*)를 만들어요. 여러 번 실행해도 같아요.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRAM_EXHIBIT as T } from '../src/game/Map/styles/hj/tramLayout.js'

const here = dirname(fileURLToPath(import.meta.url))
const file = resolve(here, '../src/game/data/zones/hj_drama.json')
const zone = JSON.parse(readFileSync(file, 'utf8'))
const round = (n) => Math.round(n * 1000) / 1000
const tram = zone.props.find((p) => p.id === 'gs_tram_exhibit')
if (!tram) throw new Error('hj_drama.json에 gs_tram_exhibit이 없어요')
tram.collider = false
const [px, pz] = tram.position
const rotDeg = tram.rotationDeg ?? 0
const th = (rotDeg * Math.PI) / 180
const toZone = (x, z) => [round(px + x * Math.cos(th) + z * Math.sin(th)), round(pz - x * Math.sin(th) + z * Math.cos(th))]
const out = []
const box = (id, x, z, size, extra = {}) => out.push({ id: `gs_tx_${id}`, style: 'hjBoothWallCollider', position: toZone(x, z), size: size.map(round), rotationDeg: rotDeg, ...extra })

const { w, l, floorY, door } = T
const wallH = 3.2
box('floor', 0, 0, [w, floorY, l])
for (const s of [-1, 1]) box(`side_${s > 0 ? 'r' : 'l'}`, s * (w / 2 - 0.05), 0, [0.12, wallH, l])
box('front', 0, l / 2 - 0.06, [w, wallH, 0.12])
for (const s of [-1, 1]) box(`rear_${s > 0 ? 'r' : 'l'}`, s * (door / 2 + (w - door) / 4), -(l / 2 - 0.06), [(w - door) / 2, wallH, 0.12])
const seatLen = l - 0.2 - 2.6
for (const s of [-1, 1]) box(`seat_${s > 0 ? 'r' : 'l'}`, s * ((w - 0.24) / 2 - 0.25), 0, [0.5, floorY + 0.55, seatLen])
box('controller', 0.55, l / 2 - 0.5, [0.5, floorY + 1.1, 0.4])
box('step_0', 0, -l / 2 - 0.22, [door + 0.2, 0.34, 0.3])
box('step_1', 0, -l / 2 - 0.52, [door + 0.2, 0.17, 0.3])

zone.props = zone.props.filter((p) => !p.id.startsWith('gs_tx_'))
const at = zone.props.findIndex((p) => p.id === 'gs_tram_exhibit')
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
console.log(`전시 전차 충돌 박스 ${out.length}개 생성`)
