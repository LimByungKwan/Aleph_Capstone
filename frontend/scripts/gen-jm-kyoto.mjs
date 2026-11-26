// 애니메이션 구역(JM) 배치 생성기 — 담당: 지민
// 실행: node frontend/scripts/gen-jm-kyoto.mjs  →  frontend/src/game/data/zones/jm_anime.json 을 통째로 다시 씀
//
// (11/25 오후) 교토 온천 마을 → 「센과 치히로의 행방불명」 배경 마을로 구역 전체를 다시 짬 (지민 요청: "배치까지 새로")
//   영화 순서대로 (구역 좌표, 북쪽 = z 마이너스)
//   남쪽 입구(0,40) → 붉은 탑 터널(z 13) → 풀밭 언덕(z 4 → -36) → 마른 강 징검돌(z -36 → -46)
//   → 긴 돌계단(0 → 6m) → 음식점 거리(높이 6, z -60 → -150, 붉은 등·간판, 가운데 큰길 + 가로 거리)
//   → 붉은 다리(z -150 → -186, 밑 골짜기는 바다 위 철길) → 온천장 「湯灯屋」(높이 6)
//   온천장 서쪽 바깥 계단을 내려가면 물가 보일러실(높이 0). 온천장 안 엘리베이터 ↔ 보일러실
//   다른 작품 명장면 ①~④는 음식점 거리 골목 끝 흰 회벽 마당 (가로 거리 양 끝 ①④, 큰길 북쪽 골목 ②③). 골목 옆 가게 = 같은 작품 가게(쿠폰)
//   ⑤ 「센과 치히로」 스탬프는 붉은 다리 위
//   스탬프·가게 자리는 이 스크립트가 shared/places.json "position"에 맞춰 씀
// 전망 무대(풀밭 동쪽)와 BK 전망대로 가는 흔들다리 데크(jm-kyoto-keep.json terrain)는 그대로 둠 (병관 님 구역과 이어짐)
// 북쪽 끝은 hub.json 바닥을 늘려서 구역 좌표 z -225까지 써요.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const keep = JSON.parse(readFileSync(join(here, 'jm-kyoto-keep.json'), 'utf8'))
const OUT = join(here, '../src/game/data/zones/jm_anime.json')

const roads = []
const terrain = []
const buildings = []
const props = []
const r2 = (n) => Math.round(n * 100) / 100
const ZONE_ORIGIN_Z = -85

// 회전된 건물 기준 좌표(lx, lz) → 구역 좌표 (three.js rotation.y와 같은 방향)
function rotate([cx, cz], deg, lx, lz) {
  const a = (deg * Math.PI) / 180
  return [r2(cx + lx * Math.cos(a) + lz * Math.sin(a)), r2(cz - lx * Math.sin(a) + lz * Math.cos(a))]
}

const prop = (id, style, position, size, extra = {}) => props.push({ id, style, position, size, rotationDeg: 0, ...extra })
// 높은 곳(elevation)의 길은 공용 Roads.jsx가 높이를 무시해 땅에 묻힘 → 그림은 우리 소품(jmFloor), 걷는 바닥은 아래 단(platform)이 맡음
const road = (id, style, position, size, extra = {}) => {
  if (extra.elevation) return props.push({ id, style: 'jmFloor', position, size, rotationDeg: 0, collider: false, ...extra, floor: style ?? null })
  return roads.push({ id, ...(style && { style }), position, size, rotationDeg: 0, ...extra })
}
const wall = (id, position, size, extra = {}) => prop(id, 'jmCollider', position, size, extra)
const tree = (id, style, position, extra = {}) => {
  const size = style === 'jmSakura' ? [4, 6.5, 4] : [3.4, 7, 3.4]
  prop(id, style, position, size, { collider: [0.5, 3, 0.5], ...extra })
}
const bamboo = (id, position, extra = {}) => prop(id, 'jmBamboo', position, [3, 7, 2.5], { collider: [2.4, 7, 2], ...extra })
const gasLamp = (id, position, extra = {}) => prop(id, 'jmGasLamp', position, [0.45, 3.2, 0.45], { collider: [0.3, 3.2, 0.3], ...extra })
const stoneLantern = (id, position, extra = {}) => prop(id, 'jmLantern', position, [0.8, 2.2, 0.8], extra)
const light = (id, position, extra = {}) => prop(id, 'jmZoneLight', position, [0.1, 14, 0.1], { collider: false, ...extra })
const toWorld = ([x, y, z]) => [r2(x), r2(y), r2(z + ZONE_ORIGIN_Z)]
const bench = (id, position, rotationDeg, elevation = 0) => prop(id, 'jmBench', position, [1.8, 0.5, 0.5], { rotationDeg, elevation })
// (11/25 밤) 바닥 풀: 장면 로컬 사각형을 14m 이하 조각으로 잘라 jmGrassTufts 소품으로 (조각마다 거리 숨기기)

const NO_GRASS_OBJECTS = true
// (11/25 밤 지민 요청: 돌바닥만이라 딱딱함) 돌바닥 위에 드문드문 이끼 조각 + 풀 포기 (14m 조각, 높은 단 아래 바닥 조각은 건너뜀)
function mossCover(id, [x0, z0, x1, z1], elevation, skip = []) {
  if (NO_GRASS_OBJECTS) return // (11/25 밤 지민 요청) 잔디·녹색 이끼 덩어리 오브젝트 없앰 — 이끼는 바닥 질감(mossyStone)에만
  const nx = Math.ceil((x1 - x0) / 14)
  const nz = Math.ceil((z1 - z0) / 14)
  const tw = r2((x1 - x0) / nx)
  const td = r2((z1 - z0) / nz)
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = r2(x0 + tw * (i + 0.5))
    const cz = r2(z0 + td * (j + 0.5))
    if (skip.some(([a0, b0, a1, b1]) => cx > a0 && cx < a1 && cz > b0 && cz < b1)) continue
    prop(`${id}_${i}_${j}`, 'jmGrassTufts', [cx, cz], [tw, 0.6, td], { elevation: r2(elevation + 0.07), collider: false, grass: { origin: [cx, cz], density: 0, moss: 0.05 } }) // 풀잎 없이 이끼 조각만
  }
}
function grassPatch(id, c, rot, w, d, elevation, avoid = [], density = 1.2) {
  if (NO_GRASS_OBJECTS) return
  const nx = Math.ceil(w / 14)
  const nz = Math.ceil(d / 14)
  const tw = r2(w / nx)
  const td = r2(d / nz)
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lx = r2(-w / 2 + tw * (i + 0.5))
    const lz = r2(-d / 2 + td * (j + 0.5))
    prop(`${id}_${i}_${j}`, 'jmGrassTufts', rotate(c, rot, lx, lz), [tw, 0.6, td], { rotationDeg: rot, elevation, collider: false, grass: { origin: [lx, lz], avoid, density } })
  }
}


// ─────────────────────────────────────────────
// 1. 붉은 탑 터널 (구역 입구 z 40 바로 앞에서 시작 → z 4.2)
//    영화 첫 장면: 숲길 끝 붉은 회벽 건물(탑) 아래 아치 → 어두운 굴(위는 풀 언덕) → 색유리 빛 대합실 → 풀밭
//    그림: jm_tunnel.jsx JmTunnelGate (로컬 +z = 남쪽). 터널 1.6배
//    (11/25 밤 지민 요청) 애니 구역에 들어서면 바로 터널: 입구 광장을 없애고 터널 앞면을 구역 입구에서 7m 안쪽(z 33)에
//    입구 앞 7m(z 33 ~ 40)는 숲길 + 병관 님 워프 도착 자리(구역 x -10, z 36)
// ─────────────────────────────────────────────
const ENTRY_TRUNKS = [] // 입구 숲길 나무 (뒤의 양옆 숲이 겹치지 않게 같이 봄)
//    (11/26 지민 요청) 구역에 들어서면 먼저 작은 숲길(z 40 → 24), 그 끝에 숲에 숨은 터널 입구. 터널은 1.6배 → 1배로 줄이고
//    뒤(풀밭 쪽) z 4.2는 그대로 두어 터널 앞면이 z 22.2로 물러남. 숲길 그림 = jm_tunnel.jsx JmForestPath (나무 목록은 여기서 만들어 넘김)
for (const [i, x, z] of [[1, -2.3, 38.6], [2, 2.3, 38.6]]) stoneLantern(`jm_entry_lantern_${i}`, [x, z])

const TUN_S = 1 // 터널 그림·판정 배율 (jm_tunnel.jsx TUNNEL 숫자 × TUN_S)
const TUN_Z = r2(4.2 + 9 * TUN_S) // 터널 뒤(풀밭 쪽)를 z 4.2에 고정
{
  // 숲길: 가운데 길(|x| < 1.6) 양옆 안쪽 줄·바깥 줄 나무 + 멀리 듬성듬성 큰 나무. 건물 앞 z 22 ~ 24.5는 창이 보이게 비움
  const FC = [0, 31] // 숲길 소품 가운데 (z 22 ~ 40)
  let seed = 26
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const avoid = [[-10, 36.5, 3.2], [-2.3, 38.6, 1], [2.3, 38.6, 1], [0, 23.7, 1.2], [-2.7, 30.5, 1], [2.8, 34.4, 1]] // 워프 도착 자리·석등·석상·돌 사당
  const ok = (x, z, r) => z > 24.5 && z < 39.6 && Math.abs(x) > 1.9 + r && !avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + r)
  const trunks = ENTRY_TRUNKS
  const add = (x, z, h, r) => {
    if (!ok(x, z, r) || trunks.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 1.3)) return
    trunks.push([x, z, h, r])
  }
  for (let z = 25.2; z < 39.6; z += 2.0) {
    for (const s of [-1, 1]) {
      add(r2(s * (2.5 + rnd() * 0.9)), r2(z + rnd() * 0.8), r2(5.7 + rnd() * 1.1), r2(0.16 + rnd() * 0.1))
      add(r2(s * (4.8 + rnd() * 2.0)), r2(z + 0.9 + rnd() * 0.6), r2(4.9 + rnd() * 1.6), r2(0.2 + rnd() * 0.12))
    }
  }
  for (let z = 26; z < 39.6; z += 3.2)
    for (let ax = 8.5; ax < 19.5; ax += 3.4)
      for (const s of [-1, 1]) add(r2(s * (ax + rnd() * 1.6)), r2(z + rnd() * 1.4), r2(5.6 + rnd() * 2), r2(0.24 + rnd() * 0.14))
  trunks.forEach(([x, z, , r], i) => wall(`jm_forest_tree_${i}`, [x, z], [r2(r * 2 + 0.1), 3, r2(r * 2 + 0.1)]))
  prop('jm_forest_path', 'jmForestPath', FC, [40, 9, 18], {
    collider: false,
    trunks: trunks.map(([x, z, h, r]) => [r2(x - FC[0]), r2(z - FC[1]), h, r]),
    avoid: avoid.map(([x, z, r]) => [r2(x - FC[0]), r2(z - FC[1]), r]),
  })
}
const ts = (n) => r2(n * TUN_S)
prop('jm_tunnel_gate', 'jmTunnelGate', [0, TUN_Z], [ts(20), ts(16), ts(18)], { collider: false, scale: TUN_S })
for (const s of [-1, 1]) {
  const k = s < 0 ? 'w' : 'e'
  // (11/26 영화 장면 모양) 앞 덩어리 폭 9: 아치 양옆 x 1.8 ~ 4.5
  wall(`jm_tunnel_gate_${k}`, [s * ts(3.15), r2(TUN_Z + ts(6))], [ts(2.7), ts(9.6), ts(6)])
  // (11/25 밤) 양옆 날개채 + 끝 망루 (jm_tunnel.jsx TUNNEL.wing과 같은 숫자)
  // 양옆 낮고 긴 벽: x 4.5 ~ 14.5, 앞면 z 8.4, 깊이 5 (jm_tunnel.jsx TUNNEL.wing)
  wall(`jm_tunnel_wing_${k}`, [s * ts(9.5), r2(TUN_Z + ts(5.9))], [ts(10), ts(6.8), ts(5)], { camera: true })
  // (11/26) 굴 6m → 3m, 대합실 10×6 → 14×9 (jm_tunnel.jsx TUNNEL.tube·hall과 같은 숫자)
  wall(`jm_tunnel_tube_${k}`, [s * ts(2.25), r2(TUN_Z + ts(1.5))], [ts(0.9), ts(4.5), ts(3)], { camera: true })
  wall(`jm_tunnel_hall_${k}`, [s * ts(6.8), r2(TUN_Z - ts(4.5))], [ts(0.4), ts(6.4), ts(9)])
  wall(`jm_tunnel_hall_back_${k}`, [s * ts(4.4), r2(TUN_Z - ts(0.3))], [ts(5.2), ts(6.4), ts(0.6)])
  wall(`jm_tunnel_hall_front_${k}`, [s * ts(4.4), r2(TUN_Z - ts(8.7))], [ts(5.2), ts(6.4), ts(0.6)])
  // 대합실 기둥 + 기둥을 등진 의자 한 쌍 (jm_tunnel.jsx JmWaitingHall COLS_X·COLS_Z)
  for (const cx of [-2.6, 2.6]) for (const dz of [-1.9, 1.9]) if (s < 0) wall(`jm_hall_col_${cx < 0 ? 'w' : 'e'}${dz < 0 ? 'n' : 's'}`, [ts(cx), r2(TUN_Z + ts(-4.5 + dz))], [ts(1.9), 1.1, ts(1.7)])
}
const TUN_FRONT = r2(TUN_Z + ts(9))
const TUN_BACK = r2(TUN_Z - ts(9))
// (사진 참고) 석상은 아치 바로 오른쪽, 건물 둘레는 우거진 숲·덤불
// (11/26 지민 요청) 석상은 터널 큰 아치 바로 앞 한가운데 (양옆으로 1.3m씩 지나갈 틈)
prop('jm_tunnel_statue', 'jmTwoFaceStatue', [0, r2(TUN_FRONT + 1.5)], [0.9, 1.25, 0.8], { collider: [0.85, 1.25, 0.75] })
for (const [i, x, z] of [[1, -30, 30.6], [2, 30.5, 29.6], [3, -19, 37.5], [4, 19.5, 37.5], [5, -30, 21.6], [6, 30.5, 19.6]]) prop(`jm_tunnel_bush_${i}`, 'jmFlowerBush', [x, z], [3.6, 2.4, 3.2], { seed: 9 + i, green: true, collider: [2.6, 2, 2.2] })
for (const [i, x, z, r] of [[1, -2.7, 30.5, 75], [2, 2.8, 34.4, -80]]) prop(`jm_tunnel_hokora_${i}`, 'jmStoneHokora', [x, z], [0.8, 1.1, 0.7], { rotationDeg: r })
for (const [i, x, z] of [[5, -15, 39], [6, 15.5, 39], [7, -33, 26], [8, 33, 25], [11, -28, 35], [12, 28.5, 36], [13, -22, 15.6], [14, 22.5, 13.6], [15, -26, 38], [16, 26, 38.5]]) {
  tree(`jm_entry_maple_${i}`, i % 3 === 0 ? 'jmSakura' : 'jmMaple', [x, z])
}
light('jm_light_tunnel', [0, TUN_Z])
// (11/26) 입장 안내: 터널 안은 화면 가장자리 어둡게, 풀밭 쪽 출구를 나서면 세로쓰기 제목 (jm_entryTitle.jsx)
prop('jm_entry_title', 'jmEntryTitle', [0, TUN_BACK], [0.1, 0.1, 0.1], { collider: false, tunnel: r2(TUN_FRONT - TUN_BACK), halfWidth: ts(6.6) })
light('jm_light_entry', [0, 36])

// ─────────────────────────────────────────────
// 2. 풀밭 언덕 (z 4.2 → -28): 터널을 나오면 바람 부는 초록 언덕, 군데군데 돌 사당
//    언덕은 풍경(올라가지 않음, 가운데만 막음). 가운데 흙길이 강으로
// ─────────────────────────────────────────────
road('jm_field_path', 'stone', [0, -11.9], [3.4, 0.06, 32.2], { color: '#a8946e' })
for (const [i, x, z, w, h, d] of [
  [1, -30, -16, 26, 5, 16], [2, -58, -16, 24, 4, 14], [3, 20, -20, 20, 3.5, 10], [4, -82, -14, 28, 5, 16],
  [5, -14, -24, 10, 2.2, 6], [7, -44, 4, 18, 3.5, 12],
]) prop(`jm_field_hill_${i}`, 'jmGrassHill', [x, z], [w, h, d], { collider: [r2(w * 0.62), r2(h * 0.8), r2(d * 0.62)], color: i % 2 ? '#6f9a4e' : '#7ea657' })
for (const [i, x, z, r] of [[4, -4, -6, 15], [5, 4.2, -14, -20], [6, -4.6, -21, 10], [7, 5, -26, -5], [8, -9, -12, 30], [9, 8.5, -2, -30]]) {
  prop(`jm_field_hokora_${i}`, 'jmStoneHokora', [x, z], [0.8, 1.1, 0.7], { rotationDeg: r })
}
for (const [i, x, z, s] of [[1, -14, -5, 'jmMaple'], [2, 12, -26.5, 'jmSakura'], [3, -30, -26.5, 'jmMaple'], [4, 34, -26.5, 'jmMaple'], [5, -60, -4, 'jmSakura']]) tree(`jm_field_tree_${i}`, s, [x, z])
for (const [i, x, z, r] of [[1, 16, -7, -10], [2, -36, -6, 15], [3, 21, 2, 25]]) prop(`jm_field_hut_${i}`, 'jmFieldHut', [x, z], [4.2, 3, 3.6], { rotationDeg: r })
// (11/26 지민 요청) 팻말은 「전망대」만, 동쪽 돌길 바로 옆(길 안에 서지 않게 북쪽 가)
prop('jm_field_sign', 'jmArrowSign', [3.2, -12.2], [1.6, 2.1, 0.2], { rotationDeg: -20, signs: [{ text: '전망대', dir: 'right' }] })
light('jm_light_field', [0, -18])
grassPatch('jm_grass_field', [0, -12], 0, 112, 30, 0.02, [{ strip: 2.2 }], 0.5)

// 전망 무대 (BK 전망대 흔들다리와 이어짐 — 자리·높이 그대로)
// (11/26 지민 요청) 동쪽 돌길을 가운데 돌길(x 1.7)까지 이어 붙임 (옛 시작 x 4 → 1.7)
road('jm_field_east', 'stone', [15.15, -10], [26.9, 0.06, 3], { color: '#a8946e' })
terrain.push({ type: 'platform', id: 'jm_stage', rect: [31, -13, 43, 1], height: 6.5, surface: 'paver', lights: true,
  rails: [{ edge: 'north' }, { edge: 'west' }, { edge: 'south', gaps: [[35.3, 38.7]] }, { edge: 'east', gaps: [[-6.4, -3.6]] }] })
terrain.push({ type: 'stairs', id: 'jm_stage_stairs', from: [37, 14, 0], to: [37, 1, 6.5], width: 3 })
road('jm_stage_path_a', 'stone', [28.6, 2.5], [3, 0.06, 25])
road('jm_stage_path_b', 'stone', [33, 15.6], [9, 0.06, 3])
prop('jm_sign_tower', 'jmArrowSign', [34.3, -2.6], [1.6, 2.1, 0.2], { elevation: 6.5, signs: [{ text: '전망대', dir: 'right' }, { text: '데이트 코스', dir: 'right' }] })
prop('jm_stage_sign', 'jmArrowSign', [30.4, 13], [1.6, 2.1, 0.2], { signs: [{ text: '전망 무대', dir: 'right' }] })
for (const [i, x, z] of [[1, 32.5, -0.8], [2, 41.5, -11.5]]) stoneLantern(`jm_stage_lantern_${i}`, [x, z], { elevation: 6.5 })
for (const [i, x, z] of [[1, 27.5, -15.5], [2, 44, 6], [3, 31, 18]]) tree(`jm_stage_maple_${i}`, 'jmMaple', [x, z])
terrain.push(...keep.terrain) // jm_tower_deck: 무대 → BK 전망대

// ─────────────────────────────────────────────
// 3. 강 + 징검돌 (z -28 → -50, 폭 22m): (11/25 밤 지민 요청) 물에 걸어 들어갈 수 있음 (물높이 0.45m, 걸으면 물방울·물결). 징검돌로 건너도 됨
// ─────────────────────────────────────────────
const RIVER = { z: -39, w: 22 }
// (11/26 지민 요청: 강물이 너무 많음 → 장면 사진처럼 바위 사이 틈에만 얕게) 물높이 0.3 → 0.14, 바위 아래쪽만 잠김
const RIVER_WATER = 0.14
// (11/26 지민 요청) 일직선 강(jmCanal 띠)은 없애고, 바위 사이 물은 마을 둘레 물길과 한 줄기로 이은 굽이치는 물길(JmChannelWater)로 — 아래 '마을을 둘러싼 물길'
// (11/25 밤) 물에 잠기던 징검돌을 물(0.3) 위로: 양 끝은 0.35(둑에서 한 걸음), 가운데는 0.55
for (let i = 0; i < 10; i++) {
  const h = i === 0 || i === 9 ? 0.35 : 0.55
  // (11/26) 걷는 상자는 조금 작게 + 위에 윗면 평평한 바위(jmBoulderRiver 모양 5)를 덮어 상자 모서리가 안 보이게
  road(`jm_river_stone_${i + 1}`, null, [i % 2 ? -0.5 : 0.5, r2(RIVER.z + RIVER.w / 2 - 1.3 - i * 2.15)], [1.2, h, 1.0], { color: '#9f967f' })
}

// (11/26 지민 요청: 장면 사진처럼 이끼 낀 바위 강바닥 → 2차: 작은 돌만 많아 정신없음 → 큰 바위를 많이 섞어 돌길처럼)
//   범위: 강(남쪽 둑 ~ 북쪽 둑) + 강 북쪽 둑에서 마을 남쪽 끝 단(z -60)까지 (그림의 초록 부분), 폭 |x| < 64
//   큰 바위(반지름 1.2 ~ 2.3)는 윗면이 평평한 모양(5·6·7)으로 돌길처럼, 중간·작은 바위는 둥근 모양(0~4)으로 틈을 메움
//   돌계단 발치(|x| < 6.8, 북쪽 띠)·징검돌 길(|x| < 1.7)·소나무 자리는 비움. 굽이치는 물길 하나는 남김
//   걷기: 가운데 건너는 쪽(|x| < 22)의 낮은 큰 바위는 윗면 높이 상자(길)를 깔아 밟고 건넘, 나머지 큰·중간 바위는 jmCollider로 막음
{
  let seed = 3911
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const z0 = -59.6 // 마을 남쪽 끝 단 바로 앞 (북쪽)
  const z1 = RIVER.z + RIVER.w / 2 // 강 남쪽 둑
  const XMAX = 64
  const channel = (x) => RIVER.z + 2.6 * Math.sin(x / 8.5) + 1.2 * Math.sin(x / 3.1 + 1)
  const rocks = []
  const slabs = [] // 밟는 상자
  const placed = []
  // (11/26 지민 요청: 돌이 너무 많음 → 개수는 줄이고 간격은 넓게, 자연스럽게) 바위 사이 최소 간격을 넓히고,
  //   자리마다 '모임 정도'(느린 물결 무늬)를 둬서 바위가 군데군데 무리 짓고 그 사이는 물이 트이게
  const free = (x, z, r) => !placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < (pr + r) * 1.15 + 0.4)
  const cluster = (x, z) => 0.5 + 0.5 * Math.sin(x / 9.3 + 0.7) * Math.cos(z / 6.1 - 0.4) + 0.25 * Math.sin((x + z) / 4.3)
  // (11/26 지민 요청: 병관 님 데이트 코스 구역 침범 금지) 그 구역 = 월드 x 45 ~ 125, 당긴 뒤 구역 z -35부터 남쪽 (여기는 당기기 전 좌표라 z -48)
  //   바위 띠 동쪽 끝은 x 41 언저리에서 들쭉날쭉하게 끝나고, 마을 단 앞 좁은 띠(당기기 전 z -49 북쪽)만 동쪽 바다까지 이어짐
  const BK_Z = -48 - 1
  const eastEdge = (z) => 40.5 + 2.2 * Math.sin(z / 3.7) + 1.2 * Math.sin(z / 1.9 + 0.8)
  const bkZone = (x, z, r) => x + r > eastEdge(z) && z + r > BK_Z
  const blocked = (x, z, r) =>
    (z < RIVER.z - RIVER.w / 2 + 0.6 && Math.abs(x) < 6.8 + r) || // 돌계단 발치
    Math.abs(x) < 1.7 + r * 0.6 || // 징검돌 길
    Math.hypot(x - 10.5, z + 55) < 2.4 + r || // 큰 소나무
    bkZone(x, z, r) // 병관 님 구역
  const flatTop = (top) => r2((top + 0.22) / (1.28 * 0.85))
  // 1) 큰 평평한 바위부터 (먼저 자리를 잡아 돌길 뼈대)
  for (let z = z0 + 1.6; z < z1 - 0.8; z += 3.6) {
    for (let x = -XMAX; x < XMAX; x += 4.0) {
      const px = r2(x + (rnd() - 0.5) * 1.6)
      const pz = r2(z + (rnd() - 0.5) * 1.4)
      const r = r2(1.2 + rnd() * 1.1)
      if (Math.abs(pz - channel(px)) < 1.0 + r * 0.7 || blocked(px, pz, r) || !free(px, pz, r) || rnd() > 0.25 + 0.6 * cluster(px, pz)) continue
      const top = r2(0.28 + rnd() * 0.4)
      placed.push([px, pz, r])
      rocks.push([px, pz, r, flatTop(top), Math.round(rnd() * 360), 5 + Math.floor(rnd() * 3), top])
    }
  }
  // 2) 중간 둥근 바위 → 3) 작은 돌 (틈 메우기, 물길 둘레는 작은 돌만)
  for (const [step, rMin, rMax, keep] of [[2.8, 0.7, 1.1, 0.4], [2.2, 0.35, 0.6, 0.28]]) {
    for (let z = z0 + 1; z < z1 - 0.6; z += step) {
      for (let x = -XMAX; x < XMAX; x += step) {
        const px = r2(x + (rnd() - 0.5) * step)
        const pz = r2(z + (rnd() - 0.5) * step)
        let r = rMin + rnd() * (rMax - rMin)
        const dc = Math.abs(pz - channel(px))
        if (dc < 0.75) continue
        if (dc < 1.8) r = Math.min(r, 0.5)
        r = r2(r)
        if (rnd() > keep * (0.4 + cluster(px, pz)) || blocked(px, pz, r) || !free(px, pz, r)) continue
        placed.push([px, pz, r])
        rocks.push([px, pz, r, r2(r * (0.55 + rnd() * 0.5)), Math.round(rnd() * 360), Math.floor(rnd() * 5), 0])
      }
    }
  }
  // 4) 징검돌 위 평평한 바위 (윗면 = 길 상자 윗면 + 1cm)
  const FORD = []
  for (let i = 0; i < 10; i++) {
    const top = i === 0 || i === 9 ? 0.35 : 0.55
    FORD.push([i % 2 ? -0.5 : 0.5, r2(RIVER.z + RIVER.w / 2 - 1.3 - i * 2.15), 0.98, flatTop(top + 0.01), Math.round(rnd() * 360), 5, -1])
  }
  rocks.forEach(([x, z, r, hh, rot, v, top], i) => {
    if (v >= 5 && Math.abs(x) < 22 && top <= 0.55) {
      // 밟고 건너는 큰 평평한 바위: 윗면 높이 상자 (바위 윗면 안쪽에 숨는 크기)
      road(`jm_river_slab_${i}`, null, [x, z], [r2(r * 0.9), r2(top - 0.02), r2(r * 0.78)], { color: '#958c7a' })
      slabs.push(i)
    } else if (r > 0.55) {
      wall(`jm_river_rock_${i}`, [x, z], [r2(r * 1.5), r2(Math.max(0.6, (v >= 5 ? top : hh) + 0.2)), r2(r * 1.3)])
    }
  })
  rocks.push(...FORD)
  // 바위 밑 젖은 자갈 바닥 (가장자리가 흐려져 풀밭과 섞임, jm_spirit.jsx JmDirtFloor tint)
  // 병관 님 구역을 빼고 두 장: 본 띠(x -67 ~ 42) + 마을 단 앞 좁은 띠(x 40 ~ 67, 구역 경계보다 북쪽)
  prop('jm_riverbed_floor', 'jmDirtFloor', [-12.5, r2((z0 + z1) / 2)], [109, 0.02, r2(z1 - z0 + 4)], { collider: false, tint: '#7a7462', fade: 3, y: 0.03 }) // 물(0.2)보다 아래, 먼저 그림
  prop('jm_riverbed_floor_e', 'jmDirtFloor', [53.5, r2((z0 - 2 + BK_Z + 0.5) / 2)], [27, 0.02, r2(BK_Z + 0.5 - z0 + 2)], { collider: false, tint: '#7a7462', fade: 3, y: 0.03 })
  const RC = [0, r2((z0 + z1) / 2)]
  prop('jm_riverbed', 'jmBoulderRiver', RC, [XMAX * 2, 2, r2(z1 - z0)], { collider: false, waterY: RIVER_WATER, rocks: rocks.map(([x, z, r, hh, rot, v]) => [r2(x - RC[0]), r2(z - RC[1]), r, hh, rot, v]) })
  console.log(`바위 강바닥: 바위 ${rocks.length} (밟는 큰 바위 ${slabs.length})`)
}

// (11/25 밤 지민 승인) 물수제비: 강 남쪽 둑 돌무더기 앞에서 E → Space로 힘 조절 → 강 하류(서쪽)로 던짐 (jm_skipstone.jsx)
//   물 높이 0.3m에 맞춰 소품 높이 0.25 (체험은 소품 높이 + 0.05를 수면으로 계산)
prop('jm_skip_spot', 'jmSkipSpot', [-14, -27.6], [1.4, 0.3, 1], {
  collider: false, rotationDeg: 200, elevation: r2(RIVER_WATER - 0.05), // 물수제비 수면 = 소품 높이 + 0.05
  skip: { start: [-14.4, -29], dir: [-0.894, -0.447], width: 19, points: [[-14, -37], [-24, -38.5], [-34, -39], [-46, -39], [-58, -39], [-72, -39], [-86, -39], [-100, -39]] },
})
bench('jm_bench_river_1', [-20, -26.8], 180)
bench('jm_bench_river_2', [12, -26.8], 180)

// ─────────────────────────────────────────────
// 4. 긴 돌계단 (0 → 6m) + 마을 입구 문
// ─────────────────────────────────────────────
const TOWN = 6
// (11/25 거리 장면 참고) 넓은 돌계단 + 계단 옆 큰 소나무
terrain.push({ type: 'stairs', id: 'jm_town_stairs', from: [0, -50.2, 0], to: [0, -60, TOWN], width: 12 })
prop('jm_town_pine', 'jmBigTree', [10.5, -55], [7, 14, 7], { collider: [1.2, 8, 1.2] })
// (11/26 점검) 문 폭 13 → 10.4: 기둥이 입구 분홍 집·베란다 가게 옆벽(큰길 쪽 면 x ±5.5)에 0.8m 파묻혀 있었음
prop('jm_town_gate', 'jmTownGate', [0, -62.5], [10.4, 8, 1], { elevation: TOWN, collider: false, signs: [{ text: '灯籠横丁' }] })
for (const s of [-1, 1]) wall(`jm_town_gate_pillar_${s < 0 ? 'w' : 'e'}`, [s * 4.8, -62.5], [0.8, 8, 0.8], { elevation: TOWN })
// ─────────────────────────────────────────────
// 5. 음식점 거리 (바닥 높이 6 + 계단식 단): 가운데 큰길(x -5 ~ 5, z -60 → -150) + 가로 거리(z -87 ~ -93)
//    (11/25 지민 요청) 평평하지 않게 단을 나눔: 큰길 북쪽 7.4m / 가로 거리 서쪽 7.2m / 동쪽 8.4m, 단 사이는 계단
//    텅 빈 음식점들: 1층은 트인 카운터에 그릇, 처마 밑 붉은 등 줄, 위층 불 켜진 창, 세로 간판 (그림: jm_spirit.jsx JmEatery)
// ─────────────────────────────────────────────
terrain.push({ type: 'platform', id: 'jm_town', rect: [-95, -150, 95, -60], height: TOWN, surface: 'stone', lights: true,
  rails: [{ edge: 'south', gaps: [[-6.2, 6.2]] }, { edge: 'north', gaps: [[-3.2, 3.2]] }, { edge: 'west' }, { edge: 'east' }] })
const T_N = 7.4 // 큰길 북쪽 단 (다리·온천장 섬과 같은 높이)
const T_W = 7.2 // 가로 거리 서쪽 단
const T_E = 8.4 // 가로 거리 동쪽 단
terrain.push({ type: 'platform', id: 'jm_town_north', rect: [-15.5, -150, 15.5, -97], height: T_N, surface: 'stone',
  rails: [{ edge: 'south', gaps: [[-5, 5]] }, { edge: 'west', gaps: [[-126.5, -123.5]] }, { edge: 'east', gaps: [[-126.5, -123.5], [-148.5, -145.5]] }, { edge: 'north', gaps: [[-3.2, 3.2]] }] })
terrain.push({ type: 'platform', id: 'jm_town_west', rect: [-95, -108, -16, -76], height: T_W, surface: 'stone',
  rails: [{ edge: 'east', gaps: [[-93, -87]] }, { edge: 'north' }, { edge: 'south' }] })
terrain.push({ type: 'platform', id: 'jm_town_east', rect: [16, -108, 64, -76], height: T_E, surface: 'stone',
  rails: [{ edge: 'west', gaps: [[-93, -87]] }, { edge: 'east', gaps: [[-94.5, -89.5]] }, { edge: 'north' }, { edge: 'south' }] })
// (11/25) 동쪽 단(8.4) 끝에서 긴 비탈로 바닥(6)까지 내려가면 ④ 「원령공주」 이끼 숲 (숲으로 내려가는 길)
terrain.push({ type: 'stairs', id: 'jm_crossing_slope', from: [72, -92, TOWN], to: [64, -92, T_E], width: 5, smooth: true })
prop('jm_crossing_slope_road', 'jmSlopeRoad', [72, -92], [5, r2(T_E - TOWN), 8], { rotationDeg: 90, elevation: TOWN, collider: false })
terrain.push({ type: 'stairs', id: 'jm_town_stairs_n', from: [0, -93, TOWN], to: [0, -97, T_N], width: 10 })
// (11/26 지민이 보낸 큰길 사진) 큰길 끝 계단 위: 큰 소나무 + 붉은 등대 모양 석등 (가운데를 막지 않게 살짝 동쪽·서쪽)
prop('jm_town_top_pine', 'jmBigTree', [3.6, -100.5], [7, 13, 7], { elevation: T_N, collider: [1.1, 8, 1.1] })
prop('jm_town_top_lantern', 'jmRedLanternTower', [-1.4, -99.6], [1.3, 4.2, 1.3], { elevation: T_N, collider: [0.9, 4, 0.9] })
terrain.push({ type: 'stairs', id: 'jm_town_stairs_w', from: [-12, -90, TOWN], to: [-16, -90, T_W], width: 6 })
terrain.push({ type: 'stairs', id: 'jm_town_stairs_e', from: [10, -90, TOWN], to: [16, -90, T_E], width: 6 })
for (const s of [-1, 1]) terrain.push({ type: 'stairs', id: `jm_alley_stairs_${s < 0 ? 'w' : 'e'}`, from: [s * 19.5, -125, TOWN], to: [s * 15.5, -125, T_N], width: 3 })
// (11/26 지민이 보낸 거리 사진) 큰길·가로 거리는 돌길 대신 다져진 모래빛 흙길
road('jm_town_main_s', null, [0, -78], [10, 0.06, 36], { elevation: TOWN, color: '#d6bf96' })
road('jm_town_main_n', null, [0, -123.5], [10, 0.06, 53], { elevation: T_N, color: '#d6bf96' })
road('jm_town_cross', null, [0, -90], [32, 0.06, 6], { elevation: TOWN, color: '#d6bf96' })

// 가게 이름 (간판, 노렌, 세로 간판) — 모두 우리가 지은 이름
const EAT_NAMES = [
  ['灯籠亭', 'うどん', '狐火うどん'], ['千鳥屋', '焼鳥', '炭火焼鳥'], ['月見庵', 'そば', '月見そば'], ['花饅頭', '甘味', '蒸したて饅頭'],
  ['夜市亭', 'おでん', '夜通しおでん'], ['赤提灯', '酒', '地酒 赤提灯'], ['湯花堂', '団子', '三色団子'], ['海老天', '天ぷら', '揚げたて天ぷら'],
  ['薬膳房', '薬膳', '薬膳スープ'], ['竜宮軒', '点心', '焼売 点心'], ['鯛焼屋', '鯛焼', '鯛焼 あんこ'], ['肉饅亭', '肉まん', '大きな肉まん'],
  ['星屑茶屋', '茶', '星屑茶屋'], ['蛙屋', '焼魚', '川魚の塩焼'], ['稲荷堂', 'いなり', 'いなり寿司'], ['金魚亭', '寿司', '握り寿司'],
  ['桃源楼', '麺', '汁なし麺'], ['宵宮屋', '飴', 'べっこう飴'], ['柳月', '甘酒', '甘酒 冷やし'], ['朧亭', '鍋', 'もつ鍋'],
]
const SIGN_COLORS = [['#f4ead2', '#2a1a10'], ['#7a1d12', '#fdf6e3'], ['#1e3a5f', '#f5f0e6'], ['#2f4a2a', '#fdf6e3'], ['#e8c35a', '#2a1a10']]
let eatN = 0
const eateryAt = {}
function eatery(id, position, rotationDeg, { w = 8, d = 10, h, floors, look, sign, elevation = TOWN } = {}) {
  const n = eatN++
  const [name, noren, vs] = EAT_NAMES[n % EAT_NAMES.length]
  const fl = floors ?? (n % 3 === 0 ? 3 : 2)
  const [bg, fg] = SIGN_COLORS[n % SIGN_COLORS.length]
  const item = {
    id, style: 'jmEatery', position, size: [w, h ?? (fl === 3 ? 11.5 : 8.5), d], rotationDeg, elevation,
    seed: n, floors: fl, look: look ?? ['pastel', 'pastel', 'retro', 'pastel', 'wood'][n % 5], // (11/26) 거리 사진처럼 알록달록한 서양식 앞면을 더 많이 sign: sign ?? { text: name, bg, fg }, noren, vsign: vs,
  }
  props.push(item)
  // 카메라 막이 (음식점 몸통을 카메라가 뚫지 않게, 걷는 판정은 위 item 상자)
  props.push({ id: `${id}_cam`, style: 'jmCollider', position, size: item.size, rotationDeg, elevation, collider: false, camera: true })
  eateryAt[id] = item
  return item
}
// 큰길 양쪽 (서쪽 줄 앞면 동쪽 = 90, 동쪽 줄 = -90). 남쪽 3채는 바닥(6), 북쪽 5채는 북쪽 단(7.4). ②③ 골목(z -123 ~ -127)은 비움
const MAIN_Z = [-65, -74, -83, -101, -110, -119, -131, -140]
MAIN_Z.forEach((z, i) => {
  const elevation = i < 3 ? TOWN : T_N
  // (11/26 지민이 보낸 마을 첫 장면) 문 바로 안 첫 집: 서쪽 = 분홍 회벽 집(초록 아치 문), 동쪽 = 나무 툇마루 가게
  if (i === 0) {
    prop('jm_pink_house', 'jmPinkHouse', [-10, z], [8, 7.5, 9], { rotationDeg: 90, elevation })
    prop('jm_veranda_shop', 'jmVerandaShop', [10, z], [8, 6.5, 9], { rotationDeg: -90, elevation })
    return
  }
  if (i !== 1) eatery(`jm_eat_w${i + 1}`, [-10, z], 90, { elevation }) // (11/25) z -74 자리는 ⑥ 언덕 계단 골목
  eatery(`jm_eat_e${i + 1}`, [10, z], -90, { elevation })
})
// 가로 거리 양쪽 (남쪽 줄 앞면 북쪽 = 180, 북쪽 줄 = 0): 서쪽 단 7.2 / 동쪽 단 8.4
const ARM_X = [21, 30, 39, 48, 57]
ARM_X.forEach((x, i) => {
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'w' : 'e'
    const elevation = s < 0 ? T_W : T_E
    const it = eatery(`jm_eat_arm_${k}s${i + 1}`, [s * x, -82], 180, { elevation })
    // (11/26 지민 요청) 큰길에서 오른쪽(동쪽) 골목에 들어서자마자 오른편 가게 = 음식 산더미·찜통 가게 (가게 안 사진 참고)
    if (s > 0 && i === 0) Object.assign(it, { feast: true, look: 'wood' })
    eatery(`jm_eat_arm_${k}n${i + 1}`, [s * x, -98], 0, { elevation })
  }
})
for (const s of [-1, 1]) {
  const k = s < 0 ? 'w' : 'e'
  // ②③ 골목 양옆 뒷줄 (골목을 보고 섬)
  // (11/25 밤 마을 압축) 뒷줄 가게·먼 서쪽 큰 건물은 뺌
  // 마을 남쪽 끝 (풀밭에서 올려다보이는 앞면, 난간과 겹치지 않게 1.5m 안쪽) + 바깥쪽 큰 건물
  // (11/25 지민 요청: 골목마다 가게를 채우지 않음) 남쪽 끝 줄은 동쪽 2채만, 서쪽은 ⑥ 언덕 계단 자리
  if (s > 0) [-30, -44].forEach((x, i) => eatery(`jm_eat_edge_${k}${i + 1}`, [s * -x, -68.5], 0, { w: 11, d: 11, floors: 3, h: 12.5 }))
}
// 큰길·가로 거리 위 등 줄
// (11/26 지민 요청: 등불이 너무 많음) 가로지르는 등 줄은 큰길 3줄 + 가로 거리 양쪽 2줄씩만
for (const [z, e] of [[-71.5, TOWN], [-81.5, TOWN], [-106.5, T_N]]) prop(`jm_lantern_line_${-z}`, 'jmLanternLine', [0, z], [10, 5.4], { elevation: e, collider: false })
for (const x of [25.5, 43.5]) for (const s of [-1, 1]) prop(`jm_lantern_line_x${s < 0 ? 'w' : 'e'}${x}`, 'jmLanternLine', [s * x, -90], [6, 5.4], { rotationDeg: 90, elevation: s < 0 ? T_W : T_E, collider: false })
for (const [i, z, e] of [[1, -64, TOWN], [2, -88, TOWN], [3, -112, T_N], [4, -140, T_N]]) light(`jm_light_town_${i}`, [0, z], { elevation: e })
for (const s of [-1, 1]) light(`jm_light_town_arm_${s < 0 ? 'w' : 'e'}`, [s * 40, -90], { elevation: s < 0 ? T_W : T_E })
// 다리 앞 광장 (북쪽 단) — (11/25 밤 마을 압축) 광장이 6m로 얕아져서 압축 뒤 좌표로 직접 둠: 다리 쪽 난간 앞에 한 줄
const NO_REMAP = new Set()
const fixedAt = (id) => { NO_REMAP.add(id); return id }
for (const s of [-1, 1]) {
  gasLamp(fixedAt(`jm_plaza_lamp_${s < 0 ? 'w' : 'e'}`), [s * 7.4, -134.3], { elevation: T_N })
  stoneLantern(fixedAt(`jm_plaza_lantern_${s < 0 ? 'w' : 'e'}`), [s * 14.4, -130.2], { elevation: T_N })
  bench(fixedAt(`jm_bench_plaza_${s < 0 ? 'w' : 'e'}`), [s * 10.6, -134.3], 180, T_N) // 다리·바다 쪽을 보고 앉음
}

// (11/25 지민이 보낸 주먹밥 장면 참고) 다리 앞 동쪽 정원: 꽃 핀 키 큰 덤불 울타리, 풀밭, 흙길, 배추밭, 빨간 지붕 창고
//   다리 앞 광장 동쪽 계단(7.4 → 6)으로 내려가 흙길을 따라감
// (11/25 밤 마을 압축) 정원은 압축 뒤 좌표로 직접 둠 (아래 압축 단계에서 건드리지 않음: NO_REMAP)
//   자리: x 55 ~ 77, z -135 ~ -109. 북쪽 단 동쪽 계단(z -133.2) → 흙길 → 정원
terrain.push({ type: 'stairs', id: fixedAt('jm_garden_stairs'), from: [19.5, -133.2, TOWN], to: [15.5, -133.2, T_N], width: 3 })
road(fixedAt('jm_garden_lawn'), 'grass', [66.5, -122], [20, 0.04, 24], { elevation: r2(TOWN + 0.05) })
road(fixedAt('jm_garden_path'), null, [38.5, -133.2], [38, 0.06, 2.4], { elevation: TOWN, color: '#a8946e' })
road(fixedAt('jm_garden_path_n'), null, [57.2, -122.5], [2.4, 0.06, 22], { elevation: TOWN, color: '#a8946e' })
for (const [i, x, z, len, r] of [[1, 67, -110.2, 18, 0], [2, 76, -121, 20, 90], [3, 55, -119, 14, 90]]) {
  prop(fixedAt(`jm_garden_hedge_${i}`), 'jmHedge', [x, z], [len, 2.4, 1.6], { rotationDeg: r, elevation: TOWN, seed: i })
}
prop(fixedAt('jm_garden_veggies'), 'jmVeggiePatch', [67.5, -127], [12, 0.5, 7], { elevation: TOWN, collider: false })
prop(fixedAt('jm_garden_shed_1'), 'jmShed', [69, -115.5], [6, 4.2, 5], { elevation: TOWN })
tree(fixedAt('jm_garden_sakura'), 'jmSakura', [60.5, -131.5], { elevation: TOWN })
tree(fixedAt('jm_garden_maple'), 'jmMaple', [74.5, -132], { elevation: TOWN })
light(fixedAt('jm_light_garden'), [66, -122], { elevation: TOWN })
bench(fixedAt('jm_bench_garden_1'), [65, -132.2], 0, TOWN)
bench(fixedAt('jm_bench_garden_2'), [74.6, -112.5], -90, TOWN)
{
  const TER = [[-15.5, -150, 15.5, -97], [-95, -108, -16, -76], [16, -108, 64, -76]]
  mossCover('jm_moss_town', [-95, -150, 95, -60], TOWN, TER)
  mossCover('jm_moss_north', TER[0], T_N)
  mossCover('jm_moss_west', TER[1], T_W)
  mossCover('jm_moss_east', TER[2], T_E)
  // 돌·이끼 섞인 바닥 판 (공용 지형 돌바닥 위에 한 겹, 큰길 돌길보다 조금 아래)
  const cut = (r, holes) => holes.reduce((pcs, hh) => pcs.flatMap(([x0, z0, x1, z1]) => {
    const [a0, b0, a1, b1] = [Math.max(x0, hh[0]), Math.max(z0, hh[1]), Math.min(x1, hh[2]), Math.min(z1, hh[3])]
    if (a0 >= a1 || b0 >= b1) return [[x0, z0, x1, z1]]
    const o = []
    if (z0 < b0) o.push([x0, z0, x1, b0])
    if (b1 < z1) o.push([x0, b1, x1, z1])
    if (x0 < a0) o.push([x0, b0, a0, b1])
    if (a1 < x1) o.push([a1, b0, x1, b1])
    return o
  }), [r])
  const floors = [
    ...cut([-95, -150, 95, -60], TER).map((r) => [r, TOWN]),
    [TER[0], T_N], [TER[1], T_W], [TER[2], T_E],
  ]
  floors.forEach(([[x0, z0, x1, z1], hgt], i) => road(`jm_mossy_floor_${i + 1}`, 'mossyStone', [r2((x0 + x1) / 2), r2((z0 + z1) / 2)], [r2(x1 - x0), 0.06, r2(z1 - z0)], { elevation: r2(hgt - 0.02) }))
}

// ─────────────────────────────────────────────
// 6. 다른 작품 명장면 ①~④ — 담 없이 거리 사이사이 빈터에 (11/25 지민 요청: 담이 세트장 같다 → 뺌, 자리를 섞고 높이도 다르게)
//    ① 토토로: 가로 거리 서쪽 단 끝 (7.2) / ④ 건널목: 가로 거리 동쪽 단 끝 (8.4)
//    ② 신사 계단: 큰길 서쪽 가게 사이 골목(z -125) 끝 (6) / ③ 갈라진 바위: 동쪽 골목 끝 (6)
//    장면 그림은 jm_portal.jsx JmSceneRoom(inMap). 로컬 +z = 골목·거리 쪽
// ─────────────────────────────────────────────
// (11/25 밤 지민이 다시 고름) 마을(낡은 일본 요괴 마을) 분위기에 맞는 옛 일본·신령·숲 장면으로. 스탬프·가게 id는 그대로 다시 씀
const SCENES = [
  { n: 1, kind: 'totoro', c: [-78, -92], rot: 90, w: 30, d: 28, e: T_W, title: '명장면 ① 「이웃집 토토로」', sub: '비 오는 숲속 정류장', stamp: 'spot_jm_crossing', spot: [4, 2, 0] },
  { n: 2, kind: 'shintai', c: [-37, -125], rot: 90, w: 22, d: 22, e: TOWN, title: '명장면 ② 「너의 이름은.」', sub: '산 위 신체 사당', stamp: 'spot_jm_stairs', spot: [0, -9, 4],
    stair: { z0: 4, z1: -6, h: 4, w: 4, top: 6 } },
  { n: 3, kind: 'wisteria', c: [40, -126], rot: -90, w: 24, d: 26, e: TOWN, title: '명장면 ③ 「귀멸의 칼날」', sub: '등나무 꽃 숲길', stamp: 'spot_jm_shrine', spot: [0, -6, 0] },
  { n: 4, kind: 'forest', c: [80, -92], rot: -90, w: 30, d: 20, e: TOWN, title: '명장면 ④ 「원령공주」', sub: '이끼 숲과 신령의 연못', stamp: 'spot_jm_sakura_river', spot: [-5, 4, 0],
    pond: { x: 3, z: -2, rx: 6, rz: 4.5 } },
  { n: 6, kind: 'natsume', c: [-40, -68], rot: 90, w: 14, d: 30, e: TOWN, title: '명장면 ⑥ 「나츠메 우인장」', sub: '여름 숲 속 작은 신사', stamp: 'spot_jm_hill', spot: [0, -8, 4.4],
    stair: { z0: 9, z1: -3, h: 4.4, w: 3, top: 10 }, shop: { id: 'shop_jm_antique', at: [3.5, -9] } },
]
// 같은 작품 가게(쿠폰): 장면 바로 옆 음식점 간판을 바꿈. ⑤는 다리 앞 마지막 가게
const SCENE_SHOPS = [
  { id: 'shop_jm_donguri', eat: 'jm_eat_arm_wn3', sign: { text: 'どんぐり茶屋', bg: '#2f4a2a', fg: '#fdf6e3' } },
  { id: 'shop_jm_kumihimo', eat: 'jm_eat_w6', sign: { text: '組紐 結び屋', bg: '#7a1d3a', fg: '#fdf6e3' } },
  { id: 'shop_jm_fuji', eat: 'jm_eat_e6', sign: { text: '藤の花茶屋', bg: '#4b2e6b', fg: '#fdf6e3' } },
  { id: 'shop_jm_sakura', eat: 'jm_eat_arm_en3', sign: { text: '苔むす茶屋', bg: '#2f4a2a', fg: '#e8f0d8' } },
  { id: 'shop_jm_manju', eat: 'jm_eat_e7', sign: { text: '湯けむり饅頭', bg: '#7c2d12', fg: '#fdf6e3' } },
]
const placePositions = {}
function worldEdge(rot, local) {
  const dir = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[local]
  const a = (rot * Math.PI) / 180
  const wx = Math.round(dir[0] * Math.cos(a) + dir[1] * Math.sin(a))
  const wz = Math.round(-dir[0] * Math.sin(a) + dir[1] * Math.cos(a))
  return wz < 0 ? 'north' : wz > 0 ? 'south' : wx < 0 ? 'west' : 'east'
}
for (const sc of SCENES) {
  const L = (lx, lz) => rotate(sc.c, sc.rot, lx, lz)
  const E = { elevation: sc.e }
  // 장면 이름 팻말 하나 (담·문 대신)
  // (11/26 지민 요청: 장면 이름은 골목 입구 아치의 붉은 띠에 씀) 골목 안 화살표 팻말은 아치 띠와 겹쳐 없앰
  prop(`jm_scene_${sc.n}`, 'jmSceneRoom', sc.c, [16, 12, 16], {
    rotationDeg: sc.rot, collider: false, elevation: r2(sc.e + 0.02),
    room: { kind: sc.kind, title: sc.title, sub: sc.sub, w: sc.w, d: sc.d, inMap: true, open: true, ...(sc.stair && { stair: sc.stair }), ...(sc.pond && { pond: sc.pond }) },
  })
  if (sc.kind === 'shintai' || sc.kind === 'natsume') {
    const st = sc.stair
    terrain.push({ type: 'stairs', id: `jm_scene${sc.n}_stairs`, from: [...L(0, st.z0), sc.e], to: [...L(0, st.z1), sc.e + st.h], width: st.w })
    const corners = [L(-6, st.z1), L(6, st.z1), L(-6, st.z1 - st.top), L(6, st.z1 - st.top)]
    const xs = corners.map((p) => p[0])
    const zs = corners.map((p) => p[1])
    terrain.push({ type: 'platform', id: `jm_scene${sc.n}_top`, rect: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], height: sc.e + st.h, surface: 'stone',
      rails: ['north', 'west', 'east'].map((e) => ({ edge: worldEdge(sc.rot, e) })) })
    for (const side of [-1, 1]) for (const k of [0, 1, 2]) wall(`jm_scene${sc.n}_trunk_${side < 0 ? 'l' : 'r'}${k}`, L(side * (st.w / 2 + 2.4), st.z0 - 2 - k * 4.6), [1.4, 9, 1.4], { rotationDeg: sc.rot, ...E })
  }
  // 장면별 판정: ② 신체(큰 나무·바위), ⑥ 작은 사당, ③ 등나무 줄기, ④ 연못·거목
  if (sc.kind === 'shintai') {
    wall(`jm_scene${sc.n}_shintai`, L(0, -9.5), [3.2, 6, 3.2], { rotationDeg: sc.rot, elevation: r2(sc.e + sc.stair.h) })
  }
  if (sc.kind === 'natsume') {
    wall(`jm_scene${sc.n}_hokora`, L(0, -10.6), [2.2, 2.4, 1.8], { rotationDeg: sc.rot, elevation: r2(sc.e + sc.stair.h) })
    for (const side of [-1, 1]) wall(`jm_scene${sc.n}_torii_${side < 0 ? 'l' : 'r'}`, L(side * 1.3, -4.2), [0.3, 3, 0.3], { rotationDeg: sc.rot, elevation: r2(sc.e + sc.stair.h) })
  }
  if (sc.kind === 'wisteria') {
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) wall(`jm_scene${sc.n}_trunk_${side < 0 ? 'l' : 'r'}${k}`, L(side * 3.4, 9 - k * 4.4), [0.7, 4, 0.7], { rotationDeg: sc.rot, ...E })
  }
  if (sc.kind === 'forest') {
    const pd = sc.pond
    wall(`jm_scene${sc.n}_pond`, L(pd.x, pd.z), [r2(pd.rx * 1.7), 1, r2(pd.rz * 1.7)], { rotationDeg: sc.rot, ...E })
    for (const [k, x, z] of [[0, -9, -6], [1, 10.5, 5], [2, -11, 6]]) wall(`jm_scene${sc.n}_giant_${k}`, L(x, z), [2.4, 12, 2.4], { rotationDeg: sc.rot, ...E })
  }
  // 장면 안 앉는 자리 (E로 앉기)
  if (sc.kind === 'shintai') bench(`jm_bench_s${sc.n}`, L(-3.6, -6.9), sc.rot + 180, r2(sc.e + sc.stair.h))
  if (sc.kind === 'natsume') bench(`jm_bench_s${sc.n}`, L(-3.2, -6.2), sc.rot + 180, r2(sc.e + sc.stair.h))
  if (sc.kind === 'wisteria') for (const [k, x, z, r] of [[1, 2.6, 2.4, -90], [2, -2.6, -2, 90]]) bench(`jm_bench_s${sc.n}_${k}`, L(x, z), sc.rot + r, sc.e)
  if (sc.kind === 'forest') bench(`jm_bench_s${sc.n}`, L(-4.6, 3.2), sc.rot + 180, sc.e)
  // 풀이 많은 장면은 바닥 풀 (길·계단·연못 자리는 비움)
  if (sc.kind === 'totoro') grassPatch(`jm_grass_s${sc.n}`, sc.c, sc.rot, sc.w - 2, sc.d - 2, r2(sc.e + 0.02), [{ strip: 2.2 }], 1.0)
  if (sc.kind === 'shintai' || sc.kind === 'natsume') grassPatch(`jm_grass_s${sc.n}`, sc.c, sc.rot, sc.w - 2, sc.d - 2, r2(sc.e + 0.02), [{ strip: sc.stair.w / 2 + 0.6 }], 1.1)
  if (sc.kind === 'wisteria') grassPatch(`jm_grass_s${sc.n}`, sc.c, sc.rot, sc.w - 2, sc.d - 2, r2(sc.e + 0.02), [{ strip: 2 }], 0.9)
  if (sc.kind === 'forest') grassPatch(`jm_grass_s${sc.n}`, sc.c, sc.rot, sc.w - 2, sc.d - 2, r2(sc.e + 0.02), [{ ellipse: [sc.pond.x, sc.pond.z, sc.pond.rx + 0.8, sc.pond.rz + 0.8] }], 1.4)
  const [sx, sz] = L(sc.spot[0], sc.spot[1])
  placePositions[sc.stamp] = toWorld([sx, sc.e + sc.spot[2], sz])
  if (sc.shop) {
    const [hx, hz] = L(...sc.shop.at)
    placePositions[sc.shop.id] = toWorld([hx, r2(sc.e + (sc.stair?.h ?? 0)), hz])
  }
}
// 골목 쌍둥이 등
for (const [id, p, e] of [['jm_alley2_lamp', [-22.6, -123.2], TOWN], ['jm_alley3_lamp', [22.6, -123.2], TOWN], ['jm_alley1_lamp', [-62.4, -88], T_W], ['jm_alley4_lamp', [62.6, -88.6], T_E], ['jm_alley6_lamp', [-17, -71], TOWN]]) {
  prop(id, 'jmTwinLamp', p, [1.1, 3.4, 0.4], { collider: [0.3, 3.4, 0.3], elevation: e })
}
// (11/26 지민 요청) 장면 골목이 시작하는 곳마다 가게 줄을 뚫고 들어가는 둥근 지붕 짧은 터널 (앞 문틀 띠에 작품 이름, 안에 장면 설명) — jm_spirit.jsx JmAlleyArch
//   [장면 번호, 자리(큰길 쪽 앞면), 앞이 보는 방향(도), 골목 폭, 터널 깊이, 바닥 높이, 문틀 색]. 터널은 앞에서 골목 안쪽(-z)으로
{
  // (11/26 지민 요청: 건물 사이에 틈 없이) ②③⑥은 큰길 가게 앞면 줄(x ±5.4)에 바로 붙이고 가게 깊이만큼 뚫고 들어감, 남는 틈은 건물로 채움(fill)
  const ARCHES = [
    [1, [-63.4, -90], 90, 5.0, 3, T_W, '#c9573a', null],
    [2, [-5.4, -125], 90, 3.4, 9.8, T_N, '#b8863a', { w: 4, h: 8.5, color: '#9cc3d6' }],
    [3, [5.4, -125], -90, 3.4, 9.8, T_N, '#9a5a8a', { w: 4, h: 8.5, color: '#86c7a8' }],
    [4, [63.6, -90], -90, 5.0, 3, T_E, '#3f7a5a', null],
    [6, [-5.4, -74.25], 90, 5.0, 9.8, TOWN, '#c9573a', { w: 9.5, h: 8.5, color: '#d9b45e' }],
  ]
  for (const [n, p, rot, span, depth, e, color, fill] of ARCHES) {
    const sc = SCENES.find((x) => x.n === n)
    // (11/26 지민 요청) 붉은 아치 띠 글자 = 장면 번호 + 장면 이름 (예: ① 비 오는 숲속 정류장), 작품 이름은 work로
    const num = (sc.title.match(/[①-⑩]/) ?? [''])[0]
    const work = (sc.title.match(/「(.+)」/) ?? [null, sc.title])[1]
    prop(`jm_scene_${n}_arch`, 'jmAlleyArch', p, [span, 6, depth], { rotationDeg: rot, elevation: e, collider: false, title: `${num} ${sc.sub}`.trim(), work, color, // 안쪽 설명 팻말(sub)은 띠 글자와 겹쳐 뺌
      ...(fill && { fill }) })
    // 양옆 벽 판정 (로컬 x = ±(폭/2 + 0.45), z = -(0.45 + 깊이/2))
    const a = (rot * Math.PI) / 180
    for (const sd of [-1, 1]) {
      const lx = sd * (span / 2 + 0.45)
      const lz = -(0.45 + depth / 2) + 0.25
      const side = fill ? Math.max(0, fill.w / 2 - (span / 2 + 0.3)) : 0
      const wx = side > 0.05 ? sd * (span / 2 + 0.3 + side / 2) : lx
      const ww = side > 0.05 ? r2(side + 0.6) : 1.0
      wall(`jm_scene_${n}_arch_wall_${sd < 0 ? 'l' : 'r'}`, [r2(p[0] + wx * Math.cos(a) + lz * Math.sin(a)), r2(p[1] - wx * Math.sin(a) + lz * Math.cos(a))], [ww, 4.5, r2(depth + 0.5)], { rotationDeg: rot, elevation: e })
    }
  }
}
for (const s of SCENE_SHOPS) {
  const e = eateryAt[s.eat]
  e.sign = s.sign
  const a = (e.rotationDeg * Math.PI) / 180
  const out = e.size[2] / 2 + 1
  placePositions[s.id] = toWorld([e.position[0] + Math.sin(a) * out, e.elevation, e.position[1] + Math.cos(a) * out])
}
// ─────────────────────────────────────────────
// 7. 붉은 다리 (z -150 → -179, 높이 7.4, 가운데가 1.5m 솟은 둥근 다리) + 다리 밑·섬 둘레 바다 (바다 위 철길)
// ─────────────────────────────────────────────
const TOP = T_N // 다리·온천장 섬 높이 (큰길 북쪽 단과 같음)
const BR = { x: 0, z0: -150, z1: -179, w: 6, arch: 1.5, seg: 8 }
{
  const len = r2(BR.z0 - BR.z1)
  const cz = r2((BR.z0 + BR.z1) / 2)
  const piers = [-160, -170]
  prop('jm_grand_bridge', 'jmGrandBridge', [BR.x, cz], [BR.w, 6, len], {
    collider: false, elevation: TOP, depth: TOP, arch: BR.arch, piers: piers.map((z) => r2(z - cz)),
  })
  const archAt = (z) => r2(TOP + BR.arch * Math.sin((Math.PI * (BR.z0 - z)) / len))
  for (let i = 0; i < BR.seg; i++) {
    const za = r2(BR.z0 - (len * i) / BR.seg)
    const zb = r2(BR.z0 - (len * (i + 1)) / BR.seg)
    const [lo, hi] = archAt(za) <= archAt(zb) ? [za, zb] : [zb, za]
    terrain.push({ type: 'stairs', id: `jm_grand_bridge_ramp_${i + 1}`, from: [BR.x, lo, archAt(lo)], to: [BR.x, hi, archAt(hi)], width: r2(BR.w - 0.6), smooth: true, walls: false })
    const low = Math.min(archAt(za), archAt(zb))
    const high = Math.max(archAt(za), archAt(zb))
    for (const side of [-1, 1]) {
      wall(`jm_grand_bridge_rail_${side < 0 ? 'w' : 'e'}${i + 1}`, [r2(BR.x + side * (BR.w / 2 - 0.12)), r2((za + zb) / 2)], [0.3, r2(high - low + 1.2), r2(len / BR.seg + 0.1)], { elevation: low })
    }
  }
  for (const side of [-1, 1]) piers.forEach((z, i) => wall(`jm_grand_bridge_pier_${side < 0 ? 'w' : 'e'}${i + 1}`, [r2(BR.x + side * (BR.w / 2 - 0.7)), z], [0.9, r2(TOP - 1), 0.9]))
  placePositions.spot_jm_onsen = toWorld([BR.x, r2(TOP + BR.arch), cz])
}
// (11/25 지민 요청: 여관 마당 너머는 다 바다) 섬(x -36 ~ 36, z -179 ~ -225)만 남기고 다리 밑·섬 둘레는 모두 바다
//   보일러실 앞 나무 선착장(x -36 ~ -8, z -164 ~ -179)만 물을 비움. 바다 조각은 물결 판 + 걷기 막음
const ISLAND = { x0: -36, x1: 36, z0: -224.8, z1: -179 }
const DOCK = { x0: -36, x1: -8, z0: -179, z1: -164 }
// (11/25 지민이 보낸 전차 장면 참고) 선착장에서 바다 위 작은 정거장 부두 → 세워 둔 2량 전차 (문으로 들어가 안을 볼 수 있음)
// (11/25 밤 지민 요청) 역은 바다 한가운데로: 선착장 → 짧은 돌 턱 → 물에 잠긴 선로를 따라 얕은 물(발목 깊이)을 걸어 서쪽 역까지
const RIVER_Z = -39
const PIER = { x0: -91, x1: -69, z0: -164, z1: -159.4, h: 0.75 }
const TRAIN = { x: -80, z: -158, len: 11, w: 2.6, floor: 0.9 }
const LINK = { x0: -36, x1: -30, z0: -164, z1: -161 } // 선착장 북쪽 끝 돌 턱
const SHOAL = { x0: PIER.x1, x1: LINK.x1, z0: -161, z1: -155 } // 걸을 수 있는 얕은 물 띠 (선로 위)
for (const [k, x0, x1, z0, z1] of [
  ['s_w', -128, PIER.x0, -164, -152], ['s_m', PIER.x0, PIER.x1, -155.4, -152],
  ['s_a', SHOAL.x0, LINK.x0, -164, SHOAL.z0], ['s_b', SHOAL.x0, SHOAL.x1, SHOAL.z1, -152], ['s_e', SHOAL.x1, 128, -164, -152],
  ['w', -128, DOCK.x0, DOCK.z0, DOCK.z1], ['e', DOCK.x1, 128, DOCK.z0, DOCK.z1],
  ['nw', -128, ISLAND.x0, ISLAND.z0, ISLAND.z1], ['ne', ISLAND.x1, 128, ISLAND.z0, ISLAND.z1],
]) {
  const w = r2(z1 - z0)
  const len = r2(x1 - x0)
  prop(`jm_sea_${k}`, 'jmCanal', [r2((x0 + x1) / 2), r2((z0 + z1) / 2)], [w, 0.1, len], { rotationDeg: 90, curb: false, beach: 'sea', collider: [w, 1, len] })
}
// 얕은 물 띠: 모래 바닥이 비치는 발목 깊이 물, 걸으면 물 튐 (둑 없음)
prop('jm_sea_shoal', 'jmCanal', [r2((SHOAL.x0 + SHOAL.x1) / 2), r2((SHOAL.z0 + SHOAL.z1) / 2)], [r2(SHOAL.z1 - SHOAL.z0), 0.1, r2(SHOAL.x1 - SHOAL.x0)], { rotationDeg: 90, natural: true, wade: true, depth: 0.12, banks: false, curb: false, collider: false })
road('jm_pier_link', null, [r2((LINK.x0 + LINK.x1) / 2), r2((LINK.z0 + LINK.z1) / 2)], [r2(LINK.x1 - LINK.x0), 0.2, r2(LINK.z1 - LINK.z0)], { color: '#8d877c' })
road('jm_pier_step', null, [r2(PIER.x1 + 0.6), r2((SHOAL.z0 + PIER.z1) / 2)], [1.2, 0.38, r2(PIER.z1 - SHOAL.z0)], { color: '#8d877c' })
// (11/25 밤 지민 선택: 보이기만 하는 물길) 여관 바다 → 서쪽 벽 밖 강 → SG 해변 바다. 맵 벽(x -130) 바깥이라 걸어갈 수는 없음
//   벽 안쪽 풀밭 강(z -39)도 서쪽 끝에서 이 강으로 흘러듦. 월드 z = 구역 z - 85
prop('jm_outer_bay', 'jmCanal', [-140, -188.5], [73, 0.1, 24], { rotationDeg: 90, curb: false, beach: 'sea', collider: false })
// 굽이치는 강: 여관 바다(만) → 남쪽으로 구불구불 → SG 해변 바다. 흐를수록 넓어짐(12 → 34m). 점은 구역 좌표
// (11/26) 'jm_outer_river'는 넓힌 바다 밑에 겹쳐 비쳐서 뺌
// 풀밭 강(벽 안, 물 높이 0.3)이 서쪽 끝에서 벽을 넘어 휘어 내려가 큰 강에 합쳐짐 (합쳐질수록 넓어짐)
// (11/26) 'jm_outer_join'는 넓힌 바다 밑에 겹쳐 비쳐서 뺌
prop('jm_sea_rail', 'jmSeaRail', [0, TRAIN.z], [3, 0.3, 250], { rotationDeg: 90, collider: false, submerged: true })
road('jm_pier', null, [r2((PIER.x0 + PIER.x1) / 2), r2((PIER.z0 + PIER.z1) / 2)], [r2(PIER.x1 - PIER.x0), PIER.h, r2(PIER.z1 - PIER.z0)], { color: '#8d877c' })
prop('jm_pier_sign', 'jmStationSign', [r2(PIER.x1 - 1.5), -162], [1.6, 2.4, 0.3], { rotationDeg: 0, elevation: PIER.h, signs: [{ text: '湯灯駅' }] })
// 전차 2량: 로컬 +z = 진행 방향(동쪽, rotationDeg 90), 문은 남쪽(부두 쪽) 옆면
for (const [k, cx] of [['a', TRAIN.x - 6], ['b', TRAIN.x + 6]]) {
  prop(`jm_train_${k}`, 'jmSeaTrain', [r2(cx), TRAIN.z], [TRAIN.w, 3.4, TRAIN.len], { rotationDeg: 90, collider: false, floor: TRAIN.floor, head: k === 'b' ? 1 : -1, sign: '湯灯' })
  const x0 = r2(cx - TRAIN.len / 2)
  const x1 = r2(cx + TRAIN.len / 2)
  // 바닥판 + 벽: 남쪽 옆면 통째, 북쪽(부두 쪽) 옆면은 문 2곳(차 양 끝에서 2m 안쪽, 폭 1.2) 비움, 앞뒤 끝
  wall(`jm_train_${k}_floor`, [r2(cx), TRAIN.z], [TRAIN.len, TRAIN.floor, TRAIN.w])
  wall(`jm_train_${k}_wall_s`, [r2(cx), r2(TRAIN.z + TRAIN.w / 2 - 0.1)], [TRAIN.len, 2.6, 0.2], { elevation: TRAIN.floor })
  const doors = [r2(x0 + 2), r2(x1 - 2)]
  const pieces = [[x0, doors[0] - 0.6], [doors[0] + 0.6, doors[1] - 0.6], [doors[1] + 0.6, x1]]
  pieces.forEach(([a, b], i) => wall(`jm_train_${k}_wall_n${i + 1}`, [r2((a + b) / 2), r2(TRAIN.z - TRAIN.w / 2 + 0.1)], [r2(b - a), 2.6, 0.2], { elevation: TRAIN.floor }))
  for (const [e, x] of [['w', x0], ['e', x1]]) wall(`jm_train_${k}_end_${e}`, [r2(x + (e === 'w' ? 0.1 : -0.1)), TRAIN.z], [0.2, 2.6, TRAIN.w], { elevation: TRAIN.floor })
  // 긴 의자 (남쪽 벽 따라)
  wall(`jm_train_${k}_bench`, [r2(cx), r2(TRAIN.z + TRAIN.w / 2 - 0.55)], [r2(TRAIN.len - 5.4), 0.5, 0.6], { elevation: TRAIN.floor })
}
// (지민이 보낸 장면 참고) 섬 아래는 물에서 솟은 돌 옹벽 + 골짜기를 가로지르는 굵은 관 다리
prop('jm_pipe_bridge', 'jmPipeBridge', [-14, -164.5], [3, 3.2, 29], { collider: false, elevation: 2.2 })
light('jm_light_valley', [0, -166])

// ─────────────────────────────────────────────
// 8. 온천장 「湯灯屋」 (섬, 높이 7.4) — 그림은 jm_yutoya.jsx JmYutoya, 걷는 판정은 여기서
//   (11/25 지민 요청) 더 크게: 48 × 38m, 5층. 섬 둘레는 정원(풀밭·소나무·꽃), 그 너머는 바다
//   1층: 가운데 로비(위로 뚫린 홀) → 서쪽 「ゆ」 문으로 꺾으면 목욕탕 (번대에서 약탕 패 → 칸막이 너머 나무 욕조)
//        동쪽: 帳場, 2층 가는 계단, 엘리베이터
//   2·3·4층: 홀 둘레 회랑 + 앞뒤 연회장 (장지문 줄, 방마다 한 칸 열린 문) — 松·竹·梅の間
//   5층 (영화 설명 참고): 엘리베이터가 동쪽 끝 모자이크 바닥 방으로 열림 → 큰 문(오른쪽) → 문 하나 더 → 주인 집무실, 옆에 아기 방
//        서쪽 계단으로 오면 대기실 → 금빛 문. 엘리베이터는 동쪽 뒤 구석 직원용 (모든 층 + 보일러실)
//   간판 글자는 우리 것(湯灯屋·天楽)만. 로컬 좌표: 건물 가운데 기준, +z = 정면(다리 쪽), 높이는 TOP 기준
// ─────────────────────────────────────────────
// (11/25 지민 요청) 지하 보일러실: 섬 지대 안을 비움 (온천장 앞쪽 동쪽 밑, 구역 x 6 ~ 23.7, z -199 ~ -185.6). 로비 구석 작은 문 → 꺾인 계단으로 내려감
const BASEMENT = { x0: 6, x1: 23.7, z0: -199, z1: -185.6 }
for (const [k, rect, rails] of [
  ['', [ISLAND.x0, ISLAND.z0, ISLAND.x1, BASEMENT.z0], [{ edge: 'north' }, { edge: 'west' }, { edge: 'east' }]],
  ['_s', [ISLAND.x0, BASEMENT.z1, ISLAND.x1, ISLAND.z1], [{ edge: 'south', gaps: [[-3, 3], [-36, -33]] }, { edge: 'west' }, { edge: 'east' }]],
  ['_w', [ISLAND.x0, BASEMENT.z0, BASEMENT.x0, BASEMENT.z1], [{ edge: 'west' }]],
  ['_e', [BASEMENT.x1, BASEMENT.z0, ISLAND.x1, BASEMENT.z1], [{ edge: 'east' }]],
]) terrain.push({ type: 'platform', id: `jm_ryokan_top${k}`, rect, height: TOP, surface: 'grass', lights: true, rails })
const YU = { x: 0, front: -185, w: 48, d: 38, wt: 0.3, base: 0.6, door: 3.2, doorH: 4.2 }
YU.z = r2(YU.front - YU.d / 2)
const YU_LV = [0.6, 7.6, 12.4, 17.2, 22.0, 27.6]
const YU_IN = { x: r2(YU.w / 2 - YU.wt), z: r2(YU.d / 2 - YU.wt) }
const YU_VOID = { x0: -9, x1: 9, z0: -8, z1: 7.5 }
const YU_PAV = { x0: -3, x1: 3, z0: -8, z1: -4 }
const YU_BRIDGE = { z: 1.0, w: 2.4, arch: 1.0, lv: 1 }
const YU_STAIR_W = 2.0
// (11/25 밤 지민 요청) 계단은 가운데 뚫린 네모(void)를 따라 빙 돌아 올라감
//   1→2층: void 안 동쪽 가장자리 (로비 앞 → 뒤 회랑) / 2→3층: void 안 앞쪽 가장자리 (동쪽 회랑 → 서쪽 회랑)
//   3→4층: 서쪽 회랑의 void 바로 옆 (앞 → 뒤) / 4→5층(집무실): 예전처럼 서쪽 끝 따로 (5층은 주인 층)
//   a → b = 아래 → 위 (로컬). hole: 위층 바닥에서 뚫을 자리 [x0, z0, x1, z1]. gaps: 위·아래층 void 난간에서 비울 자리
const YU_STAIRS = [
  { a: [7.5, 7.3], b: [7.5, -8], w: 2.0 },
  { a: [9, 6.3], b: [-9, 6.3], w: 1.8 },
  { a: [-10.5, 5], b: [-10.5, -8], w: 2.0, hole: [-11.7, -8.2, -9, 5.2], open: 'z-' },
  { a: [-16, -5.5], b: [-16, 5.5], w: 2.0, hole: [-23.7, -5.7, -14.8, 5.7], open: 'z+' },
]
const YU_PILLARS = [[-9, 7.5], [9, 7.5], [-9, -8], [9, -8], [-9, 3.6], [9, 3.6], [-4.5, 7.5], [4.5, 7.5]]
const YU_HOLE_IN = 14.8
// 1층 서쪽 목욕탕 (로비와 x -10 벽으로 나뉨, 13.7 × 37m)
const YU_BATH = {
  x0: -YU_IN.x, x1: -10, z0: -YU_IN.z, z1: YU_IN.z, h: r2(YU_LV[1] - YU.base), inside: true,
  door: { z: 5.4, w: 2.4, h: 3.0 }, // 로비 → 목욕탕 문 (x -10 벽, 홀 기둥 사이)
  part: { z: 2.5, gap: [-13.6, -11.2] }, // 번대 자리 ↔ 탕 칸막이 (가운데 노렌 통로)
  counter: { x: -20.5, z: 10, w: 1.4, d: 2.4 },
  tubs: [[-21.6, 0, 3.4], [-21.6, -4, 3.4], [-21.6, -8, 3.4], [-21.6, -12, 3.4], [-21.6, -16, 3.4], [-17.4, -16.6, 3.4], [-13.2, -16.6, 3.4]],
  center: { x: -14.8, z: -6.5, r: 2.6 },
}
// 2~4층 연회장: 앞뒤 띠에 방, 회랑 쪽 장지문 벽(방마다 가운데 2.4m 열림) + 방 사이 칸막이
const YU_ROOMS = {
  front: { z: 10.5, x0: -YU_IN.x, x1: YU_IN.x, splits: [-8, 8] },
  back: { z: -10.5, x0: -YU_IN.x, x1: 17, splits: [-8, 4.5] },
  doorW: 2.4,
}
// 엘리베이터 칸 (동쪽 뒤 구석, 열린 쪽 = 서쪽)
const YU_ELEV = { x: 20.4, z: -15, w: 2.8, h: 3.4 } // 직원용: 보일러실·1~5층(집무실)
// (11/25 지민 요청) 홀 뒤 가운데 누각 = 손님용 엘리베이터 (1층 로비 ↔ 2~4층 연회장). 집무실·보일러실은 구석 직원용으로만
const YU_GUEST = { x: 0, z: -6, w: 2.8, h: 3.4 }
// 로비 앞쪽 동쪽 구석 지하 계단실 (로컬): 작은 문은 서쪽 벽 z 16.3 ~ 17.7. 바닥 구멍 = 계단 위 (꺾인 두 단)
// (11/25 밤 정리) 문으로 들어오면 넓은 바닥(z 16~18.7) → 동쪽 계단으로 내려감 → 2m 쉼터 → 서쪽 계단 → 보일러실 미닫이문 바로 앞
const YU_BASE_ROOM = { x0: 18.2, x1: 23.7, z0: 7, z1: 18.7, door: [16.3, 17.7], doorH: 2.4 }
const YU_FLOOR_HOLES = [[18.2, 7, 23.7, 16]]
// 5층: 서쪽 칸막이(x -13, 금빛 문) | 집무실 | 안쪽 문(x 7) | 문 사이 복도 | 큰 문(x 13) | 동쪽 모자이크 방(엘리베이터)
const YU_OFFICE = {
  west: { x: -13, gap: [-1.4, 1.4] }, inner: { x: 7, gap: [2.6, 5.4] }, east: { x: 13, gap: [2.6, 5.4], fakeZ: -8 },
  boh: { x0: -13, x1: -4, z1: -9, doorX: -8.5, doorW: 2.2, pile: [-8.5, -14] },
  desk: [1.5, -12], chair: [1.5, -13.6], fire: [6.6, -4], bookcases: [[-12.6, 4], [-12.6, 10]], sofa: [-4, 11], table: [-4, 8.6], cabinets: [[-6, 18.1], [2, 18.1]],
  vases: [[-12.2, -6], [-12.2, 15.6], [6.2, 15.6], [6.2, -16.6], [-2.5, -17.9], [4.5, -17.9], [22.9, 4], [22.9, 12], [16.5, 17.9], [14.2, -17.9]],
  door: [-13, 0],
}
const rectSub = (r, h) => {
  const [x0, z0, x1, z1] = r
  const [a0, b0, a1, b1] = [Math.max(x0, h[0]), Math.max(z0, h[1]), Math.min(x1, h[2]), Math.min(z1, h[3])]
  if (a0 >= a1 || b0 >= b1) return [r]
  const out = []
  if (z0 < b0) out.push([x0, z0, x1, b0])
  if (b1 < z1) out.push([x0, b1, x1, z1])
  if (x0 < a0) out.push([x0, b0, a0, b1])
  if (a1 < x1) out.push([a1, b0, x1, b1])
  return out
}
const yuLayout = (() => {
  const { x: ix, z: iz } = YU_IN
  const V = YU_VOID
  const full = [-ix, -iz, ix, iz]
  const ring = [[-ix, V.z1, ix, iz], [-ix, -iz, ix, V.z0], [-ix, V.z0, V.x0, V.z1], [V.x1, V.z0, ix, V.z1]]
  const holes = YU_STAIRS.map((s) => s.hole ?? null)
  const slabs = []
  for (let k = 1; k <= 4; k++) {
    let rects = k === 4 ? [full] : ring
    if (holes[k - 1]) rects = rects.flatMap((r) => rectSub(r, holes[k - 1]))
    slabs.push({ lv: k, y: YU_LV[k], rects: rects.map((r) => r.map(r2)) })
  }
  const rails = []
  // void 난간 (층별로 계단 드나드는 자리는 비움)
  const S1 = YU_STAIRS[0]
  const S2 = YU_STAIRS[1]
  const s1x = [r2(S1.a[0] - S1.w / 2 - 0.1), r2(S1.a[0] + S1.w / 2 + 0.1)]
  const s2z = [r2(S2.a[1] - S2.w / 2 - 0.1), V.z1]
  for (let k = 1; k <= 3; k++) {
    const y = YU_LV[k]
    rails.push({ y, a: [V.x0, V.z1], b: [V.x1, V.z1], face: 'void' })
    rails.push({ y, a: [V.x0, V.z0], b: [YU_PAV.x0, V.z0], face: 'void' })
    if (k === 1) {
      // 2층 뒤 회랑: 1→2층 계단 꼭대기 자리 비움
      rails.push({ y, a: [YU_PAV.x1, V.z0], b: [s1x[0], V.z0], face: 'void' })
      rails.push({ y, a: [s1x[1], V.z0], b: [V.x1, V.z0], face: 'void' })
    } else rails.push({ y, a: [YU_PAV.x1, V.z0], b: [V.x1, V.z0], face: 'void' })
    for (const x of [V.x0, V.x1]) {
      // 2층 동쪽 = 2→3층 계단 시작, 3층 서쪽 = 2→3층 계단 끝 → 앞쪽 끝 비움
      const cutFront = (k === 1 && x === V.x1) || (k === 2 && x === V.x0)
      const zEnd = cutFront ? s2z[0] : V.z1
      if (k === YU_BRIDGE.lv) {
        rails.push({ y, a: [x, V.z0], b: [x, r2(YU_BRIDGE.z - YU_BRIDGE.w / 2)], face: 'void' })
        rails.push({ y, a: [x, r2(YU_BRIDGE.z + YU_BRIDGE.w / 2)], b: [x, zEnd], face: 'void' })
      } else rails.push({ y, a: [x, V.z0], b: [x, zEnd], face: 'void' })
    }
  }
  // 바닥 구멍 난간: 계단 시작 쪽 변 + 회랑 쪽 긴 변 (꼭대기 1.6m는 드나들게 비움)
  YU_STAIRS.forEach((s, i) => {
    if (!s.hole) return
    const y = YU_LV[i + 1]
    const [x0, z0, x1, z1] = s.hole
    const inner = s.a[0] < 0 ? (x0 === -ix ? x1 : x0) : x0
    if (s.open === 'z-') {
      rails.push({ y, a: [inner, z1], b: [inner, r2(z0 + 1.6)], face: 'hole' })
      rails.push({ y, a: [x0, z1], b: [x1, z1], face: 'hole' })
    } else {
      rails.push({ y, a: [inner, z0], b: [inner, r2(z1 - 1.6)], face: 'hole' })
      rails.push({ y, a: [x0, z0], b: [x1, z0], face: 'hole' })
    }
  })
  return { slabs, rails }
})()
// 연회장 벽 조각 ([x0, x1] 구간들): 방 가운데 문 자리를 뺌
function roomWallPieces(band) {
  const xs = [band.x0, ...band.splits, band.x1]
  const out = []
  for (let i = 0; i < xs.length - 1; i++) {
    const c = (xs[i] + xs[i + 1]) / 2
    out.push([xs[i], c - YU_ROOMS.doorW / 2], [c + YU_ROOMS.doorW / 2, xs[i + 1]])
  }
  return out.map((p) => p.map(r2))
}
prop('jm_yutoya', 'jmYutoya', [YU.x, YU.z], [YU.w, 34, YU.d], {
  collider: false, elevation: TOP, signs: [{ text: '湯灯屋' }],
  yutoya: { lv: YU_LV, wt: YU.wt, base: YU.base, door: YU.door, doorH: YU.doorH, void: YU_VOID, pav: YU_PAV, bridge: YU_BRIDGE,
    stairs: YU_STAIRS, stairW: YU_STAIR_W, bath: YU_BATH, rooms: YU_ROOMS, elev: YU_ELEV, guest: YU_GUEST, floorHoles: YU_FLOOR_HOLES, baseRoom: YU_BASE_ROOM, office: YU_OFFICE, pillars: YU_PILLARS, ...yuLayout },
})
{
  const at = (lx, lz) => [r2(YU.x + lx), r2(YU.z + lz)]
  const el = (y) => r2(TOP + y)
  const H = r2(YU_LV[5] + 0.4)
  const side = r2((YU.w - YU.door) / 2)
  const fz = r2(YU.d / 2 - YU.wt / 2)
  {
    let pieces = [[r2(-(YU.w + 1) / 2), r2(-(YU.d + 1) / 2), r2((YU.w + 1) / 2), r2((YU.d + 1) / 2)]]
    for (const hole of YU_FLOOR_HOLES) pieces = pieces.flatMap((r) => rectSub(r, hole))
    pieces.forEach(([x0, z0, x1, z1], j) => wall(`jm_yutoya_base_${j + 1}`, at(r2((x0 + x1) / 2), r2((z0 + z1) / 2)), [r2(x1 - x0), YU.base, r2(z1 - z0)], { elevation: TOP }))
  }
  for (let i = 0; i < 3; i++) wall(`jm_yutoya_step_${i + 1}`, at(0, r2(YU.d / 2 + 1.7 - i * 0.4)), [9, r2(0.2 * (i + 1)), 0.4], { elevation: TOP })
  wall('jm_yutoya_wall_back', at(0, -fz), [YU.w, H, YU.wt], { elevation: TOP })
  wall('jm_yutoya_wall_w', at(r2(-(YU.w / 2 - YU.wt / 2)), 0), [YU.wt, H, YU.d], { elevation: TOP })
  wall('jm_yutoya_wall_e', at(r2(YU.w / 2 - YU.wt / 2), 0), [YU.wt, H, YU.d], { elevation: TOP })
  wall('jm_yutoya_wall_front_w', at(r2(-(YU.door / 2 + side / 2)), fz), [side, H, YU.wt], { elevation: TOP })
  wall('jm_yutoya_wall_front_e', at(r2(YU.door / 2 + side / 2), fz), [side, H, YU.wt], { elevation: TOP })
  wall('jm_yutoya_wall_lintel', at(0, fz), [YU.door, r2(H - YU.base - YU.doorH), YU.wt], { elevation: el(YU.base + YU.doorH) })
  for (const s of yuLayout.slabs) {
    s.rects.forEach(([x0, z0, x1, z1], j) => wall(`jm_yutoya_f${s.lv + 1}_slab_${j + 1}`, at(r2((x0 + x1) / 2), r2((z0 + z1) / 2)), [r2(x1 - x0), 0.25, r2(z1 - z0)], { elevation: el(s.y - 0.25) }))
  }
  wall('jm_yutoya_roof_slab', at(0, 0), [YU.w, 0.3, YU.d], { elevation: el(YU_LV[5]) })
  yuLayout.rails.forEach((r, j) => {
    const [ax, az] = r.a
    const [bx, bz] = r.b
    const len = r2(Math.hypot(bx - ax, bz - az))
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az)
    wall(`jm_yutoya_rail_${j + 1}`, at(r2((ax + bx) / 2), r2((az + bz) / 2)), alongX ? [len, 1.1, 0.15] : [0.15, 1.1, len], { elevation: el(r.y) })
  })
  YU_STAIRS.forEach((s, i) => {
    const [fx, fz2] = at(...s.a)
    const [tx, tz] = at(...s.b)
    terrain.push({ type: 'stairs', id: `jm_yutoya_stairs_${i + 1}`, from: [fx, fz2, el(YU_LV[i])], to: [tx, tz, el(YU_LV[i + 1])], width: s.w ?? YU_STAIR_W })
  })
  {
    const b = YU_BRIDGE
    const y0 = YU_LV[b.lv]
    const x0 = YU_VOID.x0
    const len = YU_VOID.x1 - YU_VOID.x0
    const ah = (x) => r2(y0 + b.arch * Math.sin((Math.PI * (x - x0)) / len))
    // (11/26 점검) 걷는 계단 판이 굽은 다리 바닥 위로 군데군데 허옇게 비쳐 보였음 → 8칸으로 곡선을 더 따라가고 12cm 낮춰 바닥 밑에 숨김
    const n = 8
    for (let i = 0; i < n; i++) {
      const xa = r2(x0 + (len * i) / n)
      const xb = r2(x0 + (len * (i + 1)) / n)
      const [lo, hi] = ah(xa) <= ah(xb) ? [xa, xb] : [xb, xa]
      const [lx, lz] = at(lo, b.z)
      const [hx, hz] = at(hi, b.z)
      terrain.push({ type: 'stairs', id: `jm_yutoya_bridge_ramp_${i + 1}`, from: [lx, lz, r2(el(ah(lo)) - 0.12)], to: [hx, hz, r2(el(ah(hi)) - 0.12)], width: r2(b.w - 0.5), smooth: true, walls: false })
      const low = Math.min(ah(xa), ah(xb))
      const high = Math.max(ah(xa), ah(xb))
      for (const s of [-1, 1]) wall(`jm_yutoya_bridge_rail_${s < 0 ? 'n' : 's'}${i + 1}`, at(r2((xa + xb) / 2), r2(b.z + s * (b.w / 2 - 0.08))), [r2(len / n + 0.1), r2(high - low + 1.1), 0.15], { elevation: el(low) })
    }
  }
  // 1층: 누각(속은 손님용 엘리베이터 칸 — 1층은 앞(로비), 2~4층은 뒤(회랑)로 열림), 접수대, 신발장
  {
    const pz = r2((YU_PAV.z0 + YU_PAV.z1) / 2)
    const ph = r2(YU_LV[4] - YU.base)
    const cw = YU_GUEST.w + 0.2
    const side = r2((YU_PAV.x1 - YU_PAV.x0 - cw) / 2)
    for (const s of [-1, 1]) wall(`jm_yutoya_pavilion_${s < 0 ? 'w' : 'e'}`, at(r2(s * (cw / 2 + side / 2)), pz), [side, ph, r2(YU_PAV.z1 - YU_PAV.z0)], { elevation: el(YU.base) })
    for (let k = 0; k <= 3; k++) {
      const hh = r2(YU_LV[k + 1] - YU_LV[k])
      if (k === 0) wall('jm_yutoya_pavilion_back_1', at(0, r2(YU_PAV.z0 + 0.15)), [cw, hh, 0.3], { elevation: el(YU_LV[0]) })
      else {
        wall(`jm_yutoya_pavilion_front_${k + 1}`, at(0, r2(YU_PAV.z1 - 0.15)), [cw, hh, 0.3], { elevation: el(YU_LV[k]) })
        wall(`jm_yutoya_pavilion_floor_${k + 1}`, at(0, pz), [cw, 0.25, r2(YU_PAV.z1 - YU_PAV.z0)], { elevation: el(YU_LV[k] - 0.25) })
      }
    }
  }
  wall('jm_yutoya_counter', at(12.6, 11.4), [3.4, 1.1, 0.9], { elevation: el(YU.base) })
  for (const s of [-1, 1]) wall(`jm_yutoya_shoes_${s < 0 ? 'w' : 'e'}`, at(s * 3.2, r2(YU_IN.z - 0.6)), [1.6, 1.3, 0.5], { elevation: el(YU.base) })
  // 1층 목욕탕: 로비 쪽 벽(문 자리 비움) + 칸막이(통로 비움) + 번대 + 욕조
  {
    const B = YU_BATH
    const h = B.h
    const d0 = r2(B.door.z - B.door.w / 2)
    const d1 = r2(B.door.z + B.door.w / 2)
    wall('jm_yutoya_bath_wall_s', at(B.x1, r2((d1 + B.z1) / 2)), [0.3, h, r2(B.z1 - d1)], { elevation: el(YU.base) })
    wall('jm_yutoya_bath_wall_n', at(B.x1, r2((B.z0 + d0) / 2)), [0.3, h, r2(d0 - B.z0)], { elevation: el(YU.base) })
    wall('jm_yutoya_bath_wall_lintel', at(B.x1, B.door.z), [0.3, r2(h - B.door.h), B.door.w], { elevation: el(YU.base + B.door.h) })
    const [g0, g1] = B.part.gap
    wall('jm_yutoya_bath_part_w', at(r2((B.x0 + g0) / 2), B.part.z), [r2(g0 - B.x0), h, 0.2], { elevation: el(YU.base) })
    wall('jm_yutoya_bath_part_e', at(r2((g1 + B.x1) / 2), B.part.z), [r2(B.x1 - g1), h, 0.2], { elevation: el(YU.base) })
    wall('jm_yutoya_bath_counter', at(B.counter.x, B.counter.z), [B.counter.w, 1.15, B.counter.d], { elevation: el(YU.base) })
    // (11/25 밤 지민 요청) 네모 욕조는 들어갈 수 있게: 테두리(높이 0.9, 점프로 넘음) + 안쪽 바닥 0.35 → 물(0.88)에 허리까지, 걸으면 물 튐
    B.tubs.forEach(([x, z, sz], i) => {
      const t = 0.15
      const o = r2(sz / 2 - t / 2)
      for (const [k, dx, dz, w, d] of [['n', 0, -o, sz, t], ['s', 0, o, sz, t], ['w', -o, 0, t, sz], ['e', o, 0, t, sz]])
        wall(`jm_yutoya_bath_tub_${i + 1}_${k}`, at(r2(x + dx), r2(z + dz)), [w, 0.9, d], { elevation: el(YU.base) })
      wall(`jm_yutoya_bath_tub_${i + 1}_floor`, at(x, z), [r2(sz - 2 * t), 0.35, r2(sz - 2 * t)], { elevation: el(YU.base) })
    })
    wall('jm_yutoya_bath_tub_center', at(B.center.x, B.center.z), [r2(B.center.r * 1.8), 1.0, r2(B.center.r * 1.8)], { elevation: el(YU.base) })
    light('jm_light_yutoya_bath', at(-15, -4), { elevation: el(3) })
  }
  for (const [i, [x, z]] of YU_PILLARS.entries()) wall(`jm_yutoya_pillar_${i + 1}`, at(x, z), [0.45, r2(YU_LV[4] - YU.base), 0.45], { elevation: el(YU.base) })
  // 2~4층 연회장 벽: 회랑 쪽 장지문 벽(문 자리 비움) + 방 사이 칸막이 + 엘리베이터 앞 칸막이
  for (let k = 1; k <= 3; k++) {
    const y = el(YU_LV[k])
    const hh = r2(YU_LV[k + 1] - YU_LV[k] - 0.25)
    for (const [bk, band] of Object.entries({ f: YU_ROOMS.front, b: YU_ROOMS.back })) {
      roomWallPieces(band).forEach(([a, b], j) => wall(`jm_yutoya_room${k + 1}_${bk}${j + 1}`, at(r2((a + b) / 2), band.z), [r2(b - a), hh, 0.2], { elevation: y }))
      const outer = band.z > 0 ? YU_IN.z : -YU_IN.z
      band.splits.forEach((x, j) => wall(`jm_yutoya_room${k + 1}_${bk}_part${j + 1}`, at(x, r2((band.z + outer) / 2)), [0.2, hh, r2(Math.abs(outer - band.z))], { elevation: y }))
    }
    wall(`jm_yutoya_room${k + 1}_b_lobby`, at(YU_ROOMS.back.x1, r2((YU_ROOMS.back.z - YU_IN.z) / 2)), [0.2, hh, r2(YU_IN.z + YU_ROOMS.back.z)], { elevation: y })
  }
  // 엘리베이터 칸 옆벽 (1층 ~ 5층 지붕 밑까지, 열린 쪽 = 서쪽)
  for (const s of [-1, 1]) wall(`jm_yutoya_elev_side_${s < 0 ? 'n' : 's'}`, at(YU_ELEV.x, r2(YU_ELEV.z + s * (YU_ELEV.w / 2 + 0.06))), [YU_ELEV.w, r2(YU_LV[5] - YU.base), 0.12], { elevation: el(YU.base) })
  // 바깥: 현관 기둥 2개, 소나무 줄기 2개, 굴뚝
  for (const s of [-1, 1]) wall(`jm_yutoya_porch_pillar_${s < 0 ? 'w' : 'e'}`, at(s * 3.2, r2(YU.d / 2 + 3.0)), [0.5, r2(YU.base + YU.doorH + 0.9), 0.5], { elevation: TOP })
  wall('jm_yutoya_pine_e', at(r2(YU.w / 2 - 1.8), r2(YU.d / 2 + 2.6)), [0.8, 6, 0.8], { elevation: TOP })
  wall('jm_yutoya_pine_w', at(r2(-(YU.w / 2 - 1.8)), r2(YU.d / 2 + 2.4)), [0.8, 6, 0.8], { elevation: TOP })
  // 현관 양옆 격자 담 (그림: jm_yutoya.jsx YuFacadeExtras)
  for (const s of [-1, 1]) wall(`jm_yutoya_fence_${s < 0 ? 'w' : 'e'}`, at(r2(s * (YU.door / 2 + 8.2)), r2(YU.d / 2 + 2.2)), [11.2, 2.5, 0.9], { elevation: TOP })
  // 5층: 칸막이 3줄(문 자리 비움) + 아기 방 벽 + 집무실 가구
  {
    const O = YU_OFFICE
    const e5 = el(YU_LV[4])
    const hh = r2(YU_LV[5] - YU_LV[4])
    const zWall = (id, x, [g0, g1]) => {
      wall(`${id}_n`, at(x, r2((-YU_IN.z + g0) / 2)), [0.25, hh, r2(g0 + YU_IN.z)], { elevation: e5 })
      wall(`${id}_s`, at(x, r2((g1 + YU_IN.z) / 2)), [0.25, hh, r2(YU_IN.z - g1)], { elevation: e5 })
    }
    zWall('jm_yutoya_office_part_w', O.west.x, O.west.gap)
    zWall('jm_yutoya_office_part_in', O.inner.x, O.inner.gap)
    zWall('jm_yutoya_office_part_e', O.east.x, O.east.gap)
    const B = O.boh
    wall('jm_yutoya_boh_wall_e', at(B.x1, r2((-YU_IN.z + B.z1) / 2)), [0.2, hh, r2(B.z1 + YU_IN.z)], { elevation: e5 })
    const d0 = r2(B.doorX - B.doorW / 2)
    const d1 = r2(B.doorX + B.doorW / 2)
    wall('jm_yutoya_boh_wall_n_w', at(r2((B.x0 + d0) / 2), B.z1), [r2(d0 - B.x0), hh, 0.2], { elevation: e5 })
    wall('jm_yutoya_boh_wall_n_e', at(r2((d1 + B.x1) / 2), B.z1), [r2(B.x1 - d1), hh, 0.2], { elevation: e5 })
    wall('jm_yutoya_boh_pile', at(...B.pile), [3.2, 1.3, 3.2], { elevation: e5 })
    wall('jm_yutoya_office_desk', at(...O.desk), [4.6, 1.0, 1.75], { elevation: e5 })
    wall('jm_yutoya_office_chair', at(...O.chair), [1.4, 2.8, 1.2], { elevation: e5 })
    wall('jm_yutoya_office_fire', at(...O.fire), [0.8, 1.7, 2.9], { elevation: e5 })
    wall('jm_yutoya_office_sofa', at(...O.sofa), [3.0, 1.0, 1.0], { elevation: e5 })
    wall('jm_yutoya_office_table', at(...O.table), [1.6, 0.5, 0.9], { elevation: e5 })
    O.cabinets.forEach(([x, z], i) => wall(`jm_yutoya_office_cab_${i + 1}`, at(x, z), [2.2, 1.9, 0.6], { elevation: e5 }))
    O.bookcases.forEach(([x, z], i) => wall(`jm_yutoya_office_books_${i + 1}`, at(x, z), [0.6, 2.7, 2.6], { elevation: e5 }))
    O.vases.forEach(([x, z], i) => wall(`jm_yutoya_office_vase_${i + 1}`, at(x, z), [1.1, 1.9, 1.1], { elevation: e5 }))
  }
  // 지하(보일러실) 가는 길 안내: 로비 동쪽 뒤 엘리베이터 앞 + 현관 안쪽
  prop('jm_yutoya_sign_elev', 'jmArrowSign', at(18.4, -11), [1.6, 2.1, 0.2], { elevation: el(YU.base), rotationDeg: 180, signs: [{ text: '직원용 엘리베이터', dir: 'right' }, { text: '5층 주인의 방', dir: 'right' }] })
  prop('jm_yutoya_sign_lobby', 'jmArrowSign', at(6, 15.4), [1.6, 2.1, 0.2], { elevation: el(YU.base), rotationDeg: 200, signs: [{ text: '손님 엘리베이터·연회장', dir: 'left' }, { text: '지하 보일러실', dir: 'right' }] })
  light('jm_light_yutoya_hall', at(0, 3), { elevation: el(2) })
  light('jm_light_yutoya_upper', at(0, 1), { elevation: el(12) })
  light('jm_light_yutoya_office', at(0, -4), { elevation: el(24) })
  light('jm_light_yutoya_mosaic', at(18, 0), { elevation: el(24) })
  light('jm_light_yutoya_rooms', at(0, 13), { elevation: el(14) })
}
// 섬 정원: 현관 앞 돌길, 양옆 정원(풀밭 + 꽃덤불 + 나무 + 가스등), 서쪽 끝에서 선착장으로 내려가는 바깥 계단
prop(fixedAt('jm_ryokan_fox_w'), 'jmFox', [-4.6, -134.2], [0.9, 1.8, 0.9], { mirror: true, elevation: T_N })
prop(fixedAt('jm_ryokan_fox_e'), 'jmFox', [4.6, -134.2], [0.9, 1.8, 0.9], { elevation: T_N })
road('jm_ryokan_path', 'stone', [0, -182], [4, 0.06, 6], { elevation: TOP })
road('jm_ryokan_path_w', 'gardenPath', [-17.5, -180.4], [33, 0.06, 2], { elevation: TOP })
for (const s of [-1, 1]) road(`jm_ryokan_path_side_${s < 0 ? 'w' : 'e'}`, 'gardenPath', [s * 29.5, -202], [2, 0.06, 40], { elevation: TOP })
for (const [i, x, z] of [[1, -27, -181.6], [2, 27, -181.6], [3, -32.5, -200], [4, 32.5, -200], [5, -32.5, -216], [6, 32.5, -216]]) gasLamp(`jm_ryokan_lamp_${i}`, [x, z], { elevation: TOP })
const GARDEN_FLOWERS = [[-26.5, -192], [-26.5, -206], [-26.5, -218], [-33.5, -195], [-33.5, -209], [26.5, -192], [26.5, -206], [26.5, -218], [33.5, -195], [33.5, -209], [-20, -224], [20, -224]]
GARDEN_FLOWERS.forEach(([x, z], i) => prop(`jm_flower_${i + 1}`, 'jmFlowerBush', [x, z], [2.6, 1.5, 2.2], { elevation: TOP, seed: i, collider: [1.8, 1.2, 1.6] }))
for (const [i, x, z, s] of [[1, -33.5, -187.5, 'jmSakura'], [2, 33.5, -187.5, 'jmMaple'], [3, -33.5, -203, 'jmMaple'], [4, 33.5, -203, 'jmSakura'], [5, -33.5, -219, 'jmGinkgo'], [6, 33.5, -219, 'jmMaple']]) tree(`jm_ryokan_tree_${i}`, s, [x, z], { elevation: TOP })
prop('jm_ryokan_sign_stairs', 'jmArrowSign', [-31.5, -181.9], [1.6, 2.1, 0.2], { elevation: TOP, rotationDeg: 20, signs: [{ text: '선착장', dir: 'left' }, { text: '바다 위 전차', dir: 'left' }] })
light('jm_light_ryokan', [0, -182], { elevation: TOP })
light('jm_light_ryokan_garden', [-30, -205], { elevation: TOP })
for (const s of [-1, 1]) bench(`jm_bench_ryokan_${s < 0 ? 'w' : 'e'}`, [s * 32, -199], s < 0 ? 90 : -90, TOP)

// ─────────────────────────────────────────────
// 9. 지하 보일러실 (로비 구석 작은 문 → 꺾인 나무 계단 8 → 4 → 0m) + 섬 앞 바깥 계단(선착장·전차)
//   지민이 보낸 장면 참고: 벽 가득 약초 서랍장(아래 작은 어두운 구멍 + 낮은 마루·상), 큰 쇠 바퀴 달린 높은 작업대(유리 항아리 3개, 노란 주전자, 사다리),
//   둥근 계기판 달린 보일러 화덕(바닥 높이 불구멍 + 흩어진 석탄), 들어오는 길의 굵은 관·밸브 바퀴·작은 세면대, 꽃무늬 이불 더미. 캐릭터는 넣지 않음
// ─────────────────────────────────────────────
terrain.push({ type: 'stairs', id: 'jm_dock_stairs', from: [-34.5, -165, 0], to: [-34.5, -179, TOP], width: 3 })
road('jm_dock', null, [-22, -171.5], [28, 0.12, 15], { color: '#6b4a30' })
{
  const at = (lx, lz) => [r2(YU.x + lx), r2(YU.z + lz)]
  const F1 = r2(TOP + YU.base)
  const MID = r2(F1 / 2)
  const R = YU_BASE_ROOM
  // 꺾인 계단 두 단 + 가운데 쉼터
  // 난간 벽 없는 계단(walls: false) + 두 계단 사이 칸막이: 옆으로 막히는 일 없이 꼭대기·바닥으로만 드나듦
  terrain.push({ type: 'stairs', id: 'jm_basement_stairs_1', from: [...at(22.45, 9.0), MID], to: [...at(22.45, 16.0), F1], width: 2.3, walls: false })
  terrain.push({ type: 'stairs', id: 'jm_basement_stairs_2', from: [...at(19.75, 16.0), 0], to: [...at(19.75, 9.0), MID], width: 2.3, walls: false })
  wall('jm_basement_divider', at(21.1, 12.5), [0.25, F1, 7])
  wall('jm_basement_back', at(20.95, 7.05), [5.5, F1, 0.25]) // 쉼터 북쪽 (아래로 떨어지지 않게)
  wall('jm_basement_top_rail', at(19.65, 16.05), [2.9, 1.0, 0.15], { elevation: F1 }) // 1층 바닥 끝 (서쪽 계단 위로 떨어지지 않게)
  {
    const [ax, az] = at(18.35, 7.2)
    const [bx, bz] = at(23.6, 9.0)
    terrain.push({ type: 'platform', id: 'jm_basement_landing', rect: [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)], height: MID, surface: 'paver' })
  }
  // 로비 쪽 계단실 벽 (서쪽 벽에 작은 문, 북쪽 벽)
  const hh = r2(YU_LV[1] - YU.base)
  const [d0, d1] = R.door
  wall('jm_basement_room_w_n', at(R.x0, r2((R.z0 + d0) / 2)), [0.25, hh, r2(d0 - R.z0)], { elevation: F1 })
  wall('jm_basement_room_w_s', at(R.x0, r2((d1 + R.z1) / 2)), [0.25, hh, r2(R.z1 - d1)], { elevation: F1 })
  wall('jm_basement_room_w_lintel', at(R.x0, r2((d0 + d1) / 2)), [0.25, r2(hh - R.doorH), r2(d1 - d0)], { elevation: r2(F1 + R.doorH) })
  wall('jm_basement_room_n', at(r2((R.x0 + R.x1) / 2), R.z0), [r2(R.x1 - R.x0), hh, 0.25], { elevation: F1 })
  prop('jm_basement_door', 'jmBasementDoor', at(r2((R.x0 + R.x1) / 2), r2((R.z0 + R.z1) / 2)), [r2(R.x1 - R.x0), hh, r2(R.z1 - R.z0)], {
    collider: false, elevation: F1, door: [r2((d0 + d1) / 2 - (R.z0 + R.z1) / 2), r2(d1 - d0), R.doorH],
    // 계단실 안쪽 그림 (방 가운데 기준): 두 계단 사이 칸막이, 쉼터 뒤 벽, 1층 바닥 끝 난간. depth = 1층 ~ 지하 바닥
    well: { depth: F1, divider: [r2(21.1 - (R.x0 + R.x1) / 2), r2(12.5 - (R.z0 + R.z1) / 2), 7], back: r2(7.05 - (R.z0 + R.z1) / 2), rail: [r2(19.65 - (R.x0 + R.x1) / 2), r2(16.05 - (R.z0 + R.z1) / 2), 2.9] },
  })
  // 지하 보일러실 (그림: jm_spirit.jsx JmBoilerBasement, 가운데 기준 상대 좌표)
  const C = { x: 14.85, z: 11.7 }
  const rel = (lx, lz) => [r2(lx - C.x), r2(lz - C.z)]
  prop('jm_boiler', 'jmBoilerBasement', at(C.x, C.z), [17.7, TOP, 13.4], {
    collider: false,
    boiler: {
      furnace: rel(7.8, 12), platform: rel(12.5, 7.6), jars: rel(12.5, 8.8), deck: rel(16.4, 6.1), hole: rel(16.4, 5.2), futon: rel(16.5, 11.2), chest: rel(17.3, 8.6),
      pipes: { z: r2(17.9 - C.z), x0: r2(7 - C.x), x1: r2(18 - C.x) }, sink: rel(17.2, 16.9), stairX: r2(18.2 - C.x), part: { x: r2(18.2 - C.x), door: [r2(15.6 - C.z), r2(16.8 - C.z)], h: 1.9 }, coal: rel(9.9, 13.6),
    },
  })
  // (지민이 보낸 장면 참고) 계단 쪽 ↔ 보일러실은 나무 칸막이 벽의 작은 미닫이문(폭 1.2, 높이 1.9)으로만 드나듦
  const PART = { x: 18.2, z0: 5, z1: 18.4, door: [15.6, 16.8], h: 1.9 }
  wall('jm_boiler_part_n', at(PART.x, r2((PART.z0 + PART.door[0]) / 2)), [0.25, TOP, r2(PART.door[0] - PART.z0)])
  wall('jm_boiler_part_s', at(PART.x, r2((PART.door[1] + PART.z1) / 2)), [0.25, TOP, r2(PART.z1 - PART.door[1])])
  wall('jm_boiler_part_lintel', at(PART.x, r2((PART.door[0] + PART.door[1]) / 2)), [0.25, r2(TOP - PART.h), r2(PART.door[1] - PART.door[0])], { elevation: PART.h })
  wall('jm_boiler_furnace', at(7.8, 12), [3, 4, 4])
  wall('jm_boiler_coal', at(9.9, 13.6), [1.6, 0.5, 1.4])
  wall('jm_boiler_platform', at(12.5, 7.6), [3.2, 2.2, 1.6])
  wall('jm_boiler_jars', at(12.5, 8.8), [3.2, 0.6, 0.8])
  wall('jm_boiler_deck', at(16.4, 6.1), [3, 0.4, 1.6])
  wall('jm_boiler_futon', at(16.5, 11.2), [2, 0.6, 1.4])
  wall('jm_boiler_chest', at(17.3, 8.6), [1.2, 1.1, 0.6])
  wall('jm_boiler_pipes', at(12.5, 17.9), [11, 1, 0.9])
  light('jm_light_boiler', at(12, 11), { elevation: 3 })
  light('jm_light_basement_stairs', at(21, 14), { elevation: 4 })
}
// 깃발 단 굴뚝 (보일러실 굴뚝 — 섬 서쪽 정원에서 솟음)
prop('jm_chimney', 'jmChimney', [-26, -213], [1.8, 42, 1.8], { elevation: TOP, collider: [1.8, 42, 1.8] })
// (지민이 보낸 장면 참고) 섬 아래는 물에서 솟은 돌 옹벽
prop('jm_yutoya_lower', 'jmYuLowerFacade', [0, -178.7], [72, TOP, 0.6], { collider: false })
// 엘리베이터: 직원용 1~5층 (지하 보일러실은 로비 구석 작은 문 계단으로). 칸마다 같은 정류장 목록, me만 다름
{
  const yuAt = (k) => toWorld([YU.x + YU_ELEV.x, TOP + YU_LV[k] + 0.05, YU.z + YU_ELEV.z])
  const stops = [
    { key: '1', label: '1층 로비·목욕탕', sign: '一階', pos: yuAt(0) },
    { key: '2', label: '2층 연회장 松の間', sign: '二階', pos: yuAt(1) },
    { key: '3', label: '3층 연회장 竹の間', sign: '三階', pos: yuAt(2) },
    { key: '4', label: '4층 연회장 梅の間', sign: '四階', pos: yuAt(3) },
    { key: '5', label: '5층 주인의 방', sign: '五階', pos: yuAt(4) },
  ]
  const cab = (id, position, elevation, me) => prop(id, 'jmElevator', position, [YU_ELEV.w, YU_ELEV.h, YU_ELEV.w], {
    rotationDeg: -90, collider: false, elevation, elevator: { me, stops, kind: 'staff' },
  })
  for (let k = 0; k <= 4; k++) cab(`jm_elev_${k + 1}`, [r2(YU.x + YU_ELEV.x), r2(YU.z + YU_ELEV.z)], r2(TOP + YU_LV[k] + 0.02), String(k + 1))
  // 손님용 (가운데 누각): 1층은 앞(+z)으로, 2~4층은 뒤(-z) 회랑으로 열림
  const gAt = (k) => toWorld([YU.x + YU_GUEST.x, TOP + YU_LV[k] + 0.05, YU.z + YU_GUEST.z])
  const guestStops = [
    { key: '1', label: '1층 로비', sign: '客用', pos: gAt(0) },
    { key: '2', label: '2층 연회장 松の間', sign: '客用', pos: gAt(1) },
    { key: '3', label: '3층 연회장 竹の間', sign: '客用', pos: gAt(2) },
    { key: '4', label: '4층 연회장 梅の間', sign: '客用', pos: gAt(3) },
  ]
  for (let k = 0; k <= 3; k++) {
    prop(`jm_gelev_${k + 1}`, 'jmElevator', [r2(YU.x + YU_GUEST.x), r2(YU.z + YU_GUEST.z)], [YU_GUEST.w, YU_GUEST.h, YU_GUEST.w], {
      rotationDeg: k === 0 ? 0 : 180, collider: false, elevation: r2(TOP + YU_LV[k] + 0.02), elevator: { me: String(k + 1), stops: guestStops, kind: 'guest' },
    })
  }
}

// ─────────────────────────────────────────────
// 마무리: 계단 겉모습, 겹치는 id 검사, 저장
// ─────────────────────────────────────────────
for (const item of terrain) if (item.type === 'stairs') item.walls = false
// 계단 겉모습 (jm_stairs.jsx 시안): A 자연석(기본) / B 붉은 목조 / D 밝은 화강암 / E 등불 계단
const STAIR_LOOK = { jm_town_stairs: 'E', jm_dock_stairs: 'B', jm_scene2_stairs: 'C', jm_scene6_stairs: 'C', jm_basement_stairs_1: 'B', jm_basement_stairs_2: 'B' }
for (let k = 1; k <= 4; k++) STAIR_LOOK[`jm_yutoya_stairs_${k}`] = 'B'
const STAIR_PREVIEW = Object.fromEntries(terrain.filter((t) => t.type === 'stairs' && !/^jm_(grand|yutoya)_bridge_ramp|_slope$/.test(t.id)).map((t) => [t.id, STAIR_LOOK[t.id] ?? 'A']))
for (const st of terrain.filter((t) => t.type === 'stairs' && STAIR_PREVIEW[t.id])) {
  const [ax, az, ah] = st.from
  const [bx, bz, bh] = st.to
  prop(`${st.id}_dress`, 'jmStairDress', [ax, az], [st.width, 1, 1], { collider: false, dress: { from: [0, 0, ah], to: [r2(bx - ax), r2(bz - az), bh], width: st.width, variant: STAIR_PREVIEW[st.id], stepHeight: st.stepHeight ?? 0.22 } })
}

const ids = new Set()
for (const item of [...roads, ...terrain, ...buildings, ...props]) {
  if (ids.has(item.id)) throw new Error(`id 겹침: ${item.id}`)
  ids.add(item.id)
}
for (const item of props) if (item.style === null) delete item.style

// ─────────────────────────────────────────────
// (11/25 밤 지민 승인) 마을 압축: 위에서 만든 배치에서 '띠'를 잘라내고 나머지를 당겨 붙임 (건물 크기는 그대로)
//   세로: z -114 ~ -108 (큰길 가게 한 줄), z -147 ~ -138 (다리 앞 가게 한 줄) → 마을 90m → 75m, 다리·섬·바다·역은 15m 남쪽으로
//   가로: 가로 거리 띠(z -108 ~ -76)에서 |x| 43.2 ~ 61.2 (가게 두 칸씩) → 마을 190m → 154m, ①·④ 장면은 18m 안쪽으로
//   띠 안에 가운데가 있는 가게·등 줄·구역 등은 없앰. 길·바닥·단(네모)은 양 끝을 옮겨 줄임. 그 밖은 가운데만 옮김
// ─────────────────────────────────────────────
{
  const Z_CUTS = [[-114, -108], [-147, -138]]
  const X_CUT = [43.2, 61.2]
  const BAND = [-108, -76]
  const inBand = (z) => z >= BAND[0] && z <= BAND[1]
  const inZCut = (z) => Z_CUTS.some(([n, sth]) => z > n && z < sth)
  const inXCut = (x) => Math.abs(x) > X_CUT[0] && Math.abs(x) < X_CUT[1]
  const mapZ = (z) => {
    let base = z
    let shift = 0
    for (const [n, sth] of Z_CUTS) {
      if (z <= n) shift += sth - n
      else if (z < sth) base = sth
    }
    return r2(base + shift)
  }
  const mapX = (x) => {
    const a = Math.abs(x)
    const m = a >= X_CUT[1] ? a - (X_CUT[1] - X_CUT[0]) : a > X_CUT[0] ? X_CUT[0] : a
    return r2(Math.sign(x) * m)
  }
  const skip = (id) => [...NO_REMAP].some((k) => id === k || id.startsWith(`${k}_`))
  const DELETABLE = new Set(['jmEatery', 'jmLanternLine', 'jmZoneLight'])
  const gone = new Set()
  // 네모(길·바닥): 양 끝을 옮김
  const rect = (it) => {
    const turned = Math.abs((it.rotationDeg ?? 0) % 180) === 90
    const [sx, sz] = turned ? [it.size[2], it.size[0]] : [it.size[0], it.size[2]]
    const [cx, cz] = it.position
    const useX = inBand(cz) || sx >= 100
    const x0 = useX ? mapX(cx - sx / 2) : cx - sx / 2
    const x1 = useX ? mapX(cx + sx / 2) : cx + sx / 2
    const z0 = mapZ(cz - sz / 2)
    const z1 = mapZ(cz + sz / 2)
    it.position = [r2((x0 + x1) / 2), r2((z0 + z1) / 2)]
    const [nx, nz] = [r2(x1 - x0), r2(z1 - z0)]
    it.size = turned ? [nz, it.size[1], nx] : [nx, it.size[1], nz]
    return nx > 0.05 && nz > 0.05
  }
  for (let i = roads.length - 1; i >= 0; i--) if (!skip(roads[i].id) && !rect(roads[i])) roads.splice(i, 1)
  for (let i = props.length - 1; i >= 0; i--) {
    const it = props[i]
    if (skip(it.id)) continue
    const [x, z] = it.position
    if (it.style === 'jmFloor') {
      if (!rect(it)) props.splice(i, 1)
      continue
    }
    const cut = inZCut(z) || (inBand(z) && inXCut(x))
    if (cut && DELETABLE.has(it.style)) {
      gone.add(it.id)
      props.splice(i, 1)
      continue
    }
    it.position = [inBand(z) ? mapX(x) : x, mapZ(z)]
    // 엘리베이터 층 자리(월드 좌표)도 같이
    if (it.elevator?.stops) for (const st of it.elevator.stops) st.pos = [st.pos[0], st.pos[1], r2(mapZ(st.pos[2] - ZONE_ORIGIN_Z) + ZONE_ORIGIN_Z)]
  }
  // 없앤 가게의 카메라 막이도 없앰
  for (let i = props.length - 1; i >= 0; i--) if (props[i].id.endsWith('_cam') && gone.has(props[i].id.slice(0, -4))) props.splice(i, 1)
  for (const t of terrain) {
    if (skip(t.id)) continue
    if (t.rect) {
      const [x0, z0, x1, z1] = t.rect
      const useX = inBand((z0 + z1) / 2) || x1 - x0 >= 100
      t.rect = [useX ? mapX(x0) : x0, mapZ(z0), useX ? mapX(x1) : x1, mapZ(z1)]
      for (const rl of t.rails ?? []) if (rl.gaps) rl.gaps = rl.gaps.map((g) => g.map((v) => (rl.edge === 'west' || rl.edge === 'east' ? mapZ(v) : v)))
    }
    for (const k of ['from', 'to']) if (t[k]) t[k] = [inBand(t[k][1]) ? mapX(t[k][0]) : t[k][0], mapZ(t[k][1]), ...t[k].slice(2)]
    if (t.position) t.position = [t.position[0], mapZ(t.position[1])]
  }
  // 정원 계단 자리에 맞춰 북쪽 단 동쪽 난간 틈을 다시
  const north = terrain.find((t) => t.id === 'jm_town_north')
  for (const rl of north.rails) if (rl.edge === 'east') rl.gaps = [[-120.5, -117.5], [-134.7, -131.7]]
  for (const [id, pos] of Object.entries(placePositions)) {
    const z = pos[2] - ZONE_ORIGIN_Z
    placePositions[id] = [inBand(z) ? mapX(pos[0]) : pos[0], pos[1], r2(mapZ(z) + ZONE_ORIGIN_Z)]
  }
}

// ─────────────────────────────────────────────
// (11/26 지민 요청: 터널에서 나와 마을 가는 길이 너무 멂 → 「마을 전체 당기기」)
//   강·징검돌·돌계단·마을 문·마을·다리·여관 섬·바다·역(옛 풀밭 북쪽 끝 z -28보다 북쪽 전부)을 PULL m 남쪽(입구 쪽)으로 당기고,
//   그 사이 풀밭(z 4.2 ~ -28)은 비율대로 줄임 (32.2m → 19.2m). 터널·숲길(z 4.2보다 남쪽)은 그대로
//   그대로 두는 것: 전망 무대·무대 계단·무대 길·BK 전망대 데크(병관 님 구역과 이어짐) → NO_PULL
//   길·바닥·충돌 벽(네모)은 양 끝을 옮겨 길이도 맞춤, 나머지는 가운데만. 안에 든 월드/구역 좌표(물수제비 길, 바깥 강 줄기, 엘리베이터 층, 장소 자리)도 같이
// ─────────────────────────────────────────────
const PULL = 13
const FIELD_N = -28 // 옛 풀밭 북쪽 끝 (= 강 남쪽 둑)
const FIELD_S = 4.2 // 터널 출구
{
  const k = (FIELD_S - FIELD_N - PULL) / (FIELD_S - FIELD_N)
  const pz = (z) => r2(z <= FIELD_N ? z + PULL : z < FIELD_S ? FIELD_S + (z - FIELD_S) * k : z)
  const fixed = (id) => /^jm_(stage|sign_tower|tower_deck)/.test(id)
  const RECT = new Set(['jmCollider', 'jmFloor'])
  const pullRect = (it) => {
    const turned = Math.abs((it.rotationDeg ?? 0) % 180) === 90
    const straight = Math.abs((it.rotationDeg ?? 0) % 90) < 0.01
    const [cx, cz] = it.position
    if (!straight) return void (it.position = [cx, pz(cz)])
    const sz = turned ? it.size[0] : it.size[2]
    const z0 = pz(cz - sz / 2)
    const z1 = pz(cz + sz / 2)
    it.position = [cx, r2((z0 + z1) / 2)]
    const nz = r2(z1 - z0)
    if (turned) it.size = [nz, it.size[1], it.size[2]]
    else it.size = [it.size[0], it.size[1], nz]
  }
  for (const rd of roads) if (!fixed(rd.id)) pullRect(rd)
  for (const it of props) {
    if (fixed(it.id)) continue
    if (RECT.has(it.style)) pullRect(it)
    else it.position = [it.position[0], pz(it.position[1])]
    if (it.skip) {
      it.skip.start = [it.skip.start[0], pz(it.skip.start[1])]
      it.skip.points = it.skip.points.map(([x, z]) => [x, pz(z)])
    }
    if (it.river?.points) it.river.points = it.river.points.map(([x, z]) => [x, pz(z)])
    if (it.elevator?.stops) for (const st of it.elevator.stops) st.pos = [st.pos[0], st.pos[1], r2(pz(st.pos[2] - ZONE_ORIGIN_Z) + ZONE_ORIGIN_Z)]
  }
  for (const t of terrain) {
    if (fixed(t.id)) continue
    if (t.rect) {
      const [x0, z0, x1, z1] = t.rect
      t.rect = [x0, pz(z0), x1, pz(z1)]
      for (const rl of t.rails ?? []) if (rl.gaps && (rl.edge === 'west' || rl.edge === 'east')) rl.gaps = rl.gaps.map((g) => g.map(pz))
    }
    for (const kk of ['from', 'to']) if (t[kk]) t[kk] = [t[kk][0], pz(t[kk][1]), ...t[kk].slice(2)]
    if (t.position) t.position = [t.position[0], pz(t.position[1])]
    if (t.points) t.points = t.points.map(([x, z, ...rest]) => [x, pz(z), ...rest])
  }
  for (const [id, pos] of Object.entries(placePositions)) placePositions[id] = [pos[0], pos[1], r2(pz(pos[2] - ZONE_ORIGIN_Z) + ZONE_ORIGIN_Z)]
}
const RIVER_BANK_S = FIELD_N + PULL // 당긴 뒤 강 남쪽 둑 (숲이 여기까지)

// (11/26 지민 요청: 여관을 두른 바다도 강물처럼 자연스러운 경계) 네모 바다 판들은 걷기 막는 판정만 남기고(hideWater),
//   그 자리를 모서리가 둥글고 물가가 일렁이는 큰 바다 하나(jm_water.jsx JmSeaLake)로. 남쪽은 마을 단 밑으로 들어가 물가 띠 없음
for (const p of props) if (p.style === 'jmCanal' && p.beach === 'sea') p.hideWater = true
// (11/26 지민 요청: 강 대신 바다를 넓힘 — 도안 확인 받음) 여관 둘레 ~ 북쪽 ~ 서쪽 ~ 남서쪽 기존 바다까지 한 덩어리 (jm_water.jsx JmOcean)
//   물빛·물가는 기존 해변 바다와 같은 색 단계(모래 → 물거품 → 옥빛 → 짙은 바다). 남서쪽 열린 쪽(open)은 모래 없이 흐려져 기존 바다(지도 밖 바다)와 섞임
//   동쪽 물가는 마을 북동쪽 모서리, 서쪽 물가는 마을·숲 서쪽 바깥 ~ K-pop 구역 서쪽 바깥(그 구역 서쪽 끝 월드 x -125보다 바깥)
//   (구역 좌표: 월드 z = 구역 z - 85. 마을 북쪽 끝 아래로 지나는 물가는 마을 단 밑이라 안 보임)
{
  const O = 1
  // (11/26 지민 요청 2차) ① 북서쪽은 물가 없이 끝없이 이어지는 바다(열린 쪽을 멀리) ② 북동쪽은 지도 북쪽 끝(구역 z -225) 안에서 호수처럼 둥근 물가로 마무리
  //   (그 너머는 산 지형이라 넘어가면 물이 산비탈을 자름) ③ 서쪽 물가를 40m쯤 더 서쪽으로 → K-pop 구역 뒤에 땅을 남김
  //   ④ 남쪽 끝 물가는 지도 밖 해변 모래 줄(기존 해안선)과 만나는 자리에서 끝내고 그 남쪽은 열린 쪽 → K-pop 해변 모래와 겹치지 않음
  // (11/26 지민 요청 3차) 물가 종류: 표시 없음 = 모래 해변, L = 호수식(진흙·풀 둑, 모래 없음), O = 열린 쪽(기존 바다와 섞임)
  //   북동쪽(여관 동쪽)·마을 북쪽 = 섬 느낌이라 호수식 / 서쪽 = 모래 해변 / 해변과 만나는 곶은 둥글게 돌아 기존 해안선 모래로 이어짐
  const L = 'L'
  const pts = [
    // (11/26 4차) 동쪽은 지도 동쪽 끝(월드 x 130) 너머 산 지형이 물을 잘라서 → x 120 안쪽에서 둥글게 마무리, 북쪽도 지도 끝(구역 z -225) 안쪽
    [116, -121, L], [123, -140, L], [121, -164, L], [110, -188, L], [88, -207, L], [55, -217, L], [15, -221, L], [-35, -222, O],
    [-90, -400, O], [-440, -400, O], [-440, 330, O], [-280, 330, O], [-150, 178, O],
    // (11/26 7차 지민 요청: 다 어색함 → 도안 확인 받음, 꺾이는 곳은 라운드로)
    //   ④ K-pop 남서쪽: 해변이 기존 해안선(구역 z 128 언저리)을 따라 동쪽에서 부드럽게 들어와 서쪽으로 이어짐 (튀어나온 혹 없앰)
    //   (8차) 기존 해변은 모래 시작선(구역 z 128)에서 11.5m 남쪽(z 140)이 물가 → 내 해변 물가도 같은 선(z 140)에서 시작, 모래 폭도 같게(11.5m)
    [-118, 162, O], [-124, 147, O], [-134, 140], [-150, 139], [-167, 133], [-181, 117], [-188, 92], [-187, 60], [-186, 40], [-180, 18],
    //   ① 뾰족한 곶을 없애고 서쪽 해안에서 바위 강까지 한 번에 휘는 넓은 만. 해변 → 호수식 둑은 24m에 걸쳐 섞임
    [-166, -4, L], [-146, -18, L], [-122, -20, L], [-100, -16, L], [-82, -13, L],
    //   ② 마을 남서쪽 모서리: 꺾임 없이 둥글게 돌아 마을 서쪽 단 밑으로
    //   (8차) 바위 강 서쪽 끝은 강어귀(M): 바다 물과 물길 물이 10m에 걸쳐 서로 흐려지며 이어짐 (두 물이 겹쳐 물가 선이 비치던 것 없앰)
    [-68, -12, 'M'], [-66, -48, L], [-71, -64, L], [-73, -90, L],
    //   ③ 동쪽: 마을 동쪽을 따라 좁아지는 물굽이, 끝은 둥글게 (병관 님 구역 z -35보다 11m 위)
    [73, -90, L], [74.5, -62, L], [75, -50, 'M'], [76, -39.5, L], [86, -39.5, L], [97, -44, L], [108, -56, L], [118, -82, L],
  ]
  prop('jm_ocean', 'jmOcean', [0, 0], [480, 0.2, 420], { collider: false, ocean: { pts, sand: 11.5, y: 0.05 } })
}

// (11/26 지민 요청) 마을 단(x ±77) 밖으로 삐져나와 물 위에 떠 있던 이끼 돌바닥 판(마을 압축 때 남은 것)을 마을 단 안으로 자름
{
  const town = terrain.find((q) => q.id === 'jm_town')
  if (town) {
    const [tx0, tz0, tx1, tz1] = town.rect
    for (const p of props) {
      if (!p.id.startsWith('jm_mossy_floor')) continue
      const [cx, cz] = p.position
      const hw = p.size[0] / 2
      const hd = p.size[2] / 2
      const x0 = Math.max(cx - hw, tx0), x1 = Math.min(cx + hw, tx1)
      const z0 = Math.max(cz - hd, tz0), z1 = Math.min(cz + hd, tz1)
      if (x1 - x0 < 0.5 || z1 - z0 < 0.5) continue
      p.position = [r2((x0 + x1) / 2), r2((z0 + z1) / 2)]
      p.size = [r2(x1 - x0), p.size[1], r2(z1 - z0)]
    }
  }
}

// (11/26 점검: 지민 요청 — 아치 터널과 계단이 엇나감) ④ 골목: 계단(z -79)이 가게 사이 골목·아치(z -77)보다 2m 옆으로 비껴 가게에 파고들고,
//   아치 터널(깊이 3m)이 계단 내려가는 곳 위로 삐져나와 공중에 떠 있었음 → 계단을 골목 가운데(z -77)로, 아치는 터널 끝이 계단 꼭대기(x 46)에 닿게 3m 안쪽으로
{
  const st = terrain.find((t) => t.id === 'jm_crossing_slope')
  const arch = props.find((q) => q.id === 'jm_scene_4_arch')
  if (st && arch) {
    const zc = arch.position[1]
    st.from = [st.from[0], zc, ...st.from.slice(2)]
    st.to = [st.to[0], zc, ...st.to.slice(2)]
    const road = props.find((q) => q.id === 'jm_crossing_slope_road')
    if (road) road.position = [road.position[0], zc]
    const top = Math.min(st.from[0], st.to[0]) // 계단 꼭대기 x
    const depth = arch.size[2]
    const nx = r2(top - 0.45 - depth) // 터널 끝 = 계단 꼭대기
    const dx = r2(nx - arch.position[0])
    arch.position = [nx, zc]
    for (const id of ['jm_scene_4_arch_wall_l', 'jm_scene_4_arch_wall_r']) {
      const w = props.find((q) => q.id === id)
      if (w) w.position = [r2(w.position[0] + dx), w.position[1]]
    }
    const lamp = props.find((q) => q.id === 'jm_alley4_lamp')
    if (lamp) lamp.position = [r2(nx - 8.6), r2(zc + 3.2)] // 아치 앞길을 막지 않게 가로 거리 쪽 가게 모퉁이로
  }
}

// (11/26 점검) 장면 마당 바닥(ScenePad: 높이 + 0.03)이 겹치는 마을 이끼 돌바닥(JmFloor: 높이 + 0.09)보다 낮아서 덮여 보이던 것
//   → 장면 마당을 겹치는 돌바닥 윗면 바로 위로 올림 (① 논·흙길·풀밭이 돌바닥에 묻혀 벼 모만 삐죽 나와 보였음)
{
  const floorsAll = props.filter((q) => q.style === 'jmFloor')
  for (const sc of props.filter((q) => q.style === 'jmSceneRoom')) {
    const turned = Math.abs((sc.rotationDeg ?? 0) % 180) === 90
    const rw = sc.room?.w ?? sc.size[0]
    const rd = sc.room?.d ?? sc.size[2]
    const hx = (turned ? rd : rw) / 2
    const hz = (turned ? rw : rd) / 2
    const e = sc.elevation ?? 0
    let top = -Infinity
    for (const f of floorsAll) {
      const ft = (f.elevation ?? 0) + 0.03 + Math.min(f.size[1] ?? 0.06, 0.06)
      if (ft < e - 0.02 || ft > e + 0.2) continue
      if (Math.abs(f.position[0] - sc.position[0]) < f.size[0] / 2 + hx && Math.abs(f.position[1] - sc.position[1]) < f.size[2] / 2 + hz) top = Math.max(top, ft)
    }
    if (top > e) sc.elevation = r2(top + 0.02)
  }
}

// (11/26 지민 요청: 큰길 흙바닥이 한 색이라 어색, 골목은 돌바닥이라 따로 놂) 큰길·가로 거리는 무늬 있는 다져진 흙(jm_spirit.jsx JmDirtFloor),
//   폭을 2m 넓혀 처마 밑까지 덮고 가장자리를 흐리게 → 돌바닥과 섞임. 골목 입구엔 흙이 골목 안으로 번진 자국(같은 흙, 사방이 흐림)
{
  for (const id of ['jm_town_main_s', 'jm_town_main_n', 'jm_town_cross']) {
    const it = props.find((q) => q.id === id)
    if (!it) continue
    const turned = id === 'jm_town_cross'
    Object.assign(it, { style: 'jmDirtFloor', size: turned ? [it.size[0], it.size[1], r2(it.size[2] + 2.4)] : [r2(it.size[0] + 2.4), it.size[1], it.size[2]] })
    delete it.floor
    delete it.color
  }
  // 골목 입구마다 흙이 번진 자국 (장면 골목 아치 앞)
  for (const n of [2, 3, 6]) {
    const a = props.find((q) => q.id === `jm_scene_${n}_arch`)
    if (!a) continue
    const ang = (a.rotationDeg * Math.PI) / 180
    const lz = -2.5
    prop(`jm_scene_${n}_spill`, 'jmDirtFloor', [r2(a.position[0] + lz * Math.sin(ang)), r2(a.position[1] + lz * Math.cos(ang))], [5, 0.02, 6], { rotationDeg: a.rotationDeg, elevation: a.elevation, collider: false })
  }
}

// (11/26 지민 요청: 마을이 물에 둘러싸이게 — 그림의 빨간 부분) 돌 강 양 끝에서 마을 서쪽·동쪽을 따라 북쪽 바다까지 물길
//   선은 직선이 아니라 굽이치고 폭도 점마다 다르게(jm_water.jsx JmChannelWater). 돌 강 쪽은 좁고 얕게 → 바다 쪽으로 넓게
//   (당긴 뒤 좌표로 바로 둠: 마을 단 x ±77, z -47 ~ -122 / 바다 남쪽 끝 z ≈ -124)
{
  // 한 줄기: 서쪽 바다 → 마을 서쪽 → 바위 사이 굽이치는 물길(폭 2.4 ~ 5, 군데군데 웅덩이) → 마을 동쪽 → 동쪽 바다
  const chan = (x) => r2(RIVER.z + PULL + 2.6 * Math.sin(x / 8.5) + 1.2 * Math.sin(x / 3.1 + 1)) // 바위 강 물길과 같은 선 (당긴 뒤 z)
  // 바다 쪽 끝은 바다가 내려온 자리(z -96) 안에서 끝나 바다로 녹아듦
  // (6차) 마을 양옆은 바다가 맡음 → 물길은 바위 강 띠만, 양 끝은 바다 안으로 들어가 흐려짐
  const side = [[86, -31, 28, 0.1], [75, -31, 30, 0.14]] // 동쪽 끝은 병관 님 구역(z -35) 위에서 끝남
  const mid = []
  // (11/26 지민 요청) 바위 돌길 넓이만큼 물이 흐르게: 바위 띠(강 남쪽 둑 ~ 마을 끝 단, 폭 약 31m) 전체를 덮는 얕은 물, 가장자리는 굽이침
  const bandC = r2((-59.6 + RIVER.z + RIVER.w / 2) / 2 + PULL)
  const bandW = r2(RIVER.z + RIVER.w / 2 + 59.6)
  for (let x = -62; x <= 34; x += 6) mid.push([x, r2(bandC + 1.2 * Math.sin(x / 11 + 0.4)), r2(bandW - 1 + 1.5 * Math.sin(x / 9.5 + 1.2)), 0.16])
  // (11/26 지민 요청) 동쪽 끝은 병관 님 구역(x 45 ~, z -35 ~) 밖으로: 바위 띠 끝(x 40)에서 좁아지며 마을 단 앞(z -42)을 따라 동쪽 바다로
  const eastTail = [[38, -37, 13, 0.16], [47, -42.5, 5.5, 0.15], [56, -43.5, 5, 0.14], [65, -44, 5, 0.13], [73, -44.5, 6.5, 0.11], [80, -46, 9, 0.09], [88, -49, 10, 0.08]]
  const pts = [...side.map(([x, z, w, y]) => [-x, z, w, y]), ...mid, ...eastTail]
  prop('jm_channel_ring', 'jmChannelWater', [0, 0], [200, 0.2, 110], { collider: false, river: { points: pts.map(([x, z]) => [x, z]), widths: pts.map((p) => p[2]), y: pts.map((p) => p[3]), fadeStart: 18, fadeEnd: 12, palette: 'ocean' } }) // (11/26) 바다와 같은 색 단계
}

// (11/26 지민 요청: 돌길이 맨 돌바닥이라 숲길과 안 어울림) 풀밭 돌길 위에 이끼 조각·줄눈 이끼·가장자리 풀 (jm_tunnel.jsx JmMossPath)
for (const id of ['jm_field_path', 'jm_field_east']) {
  const rd = roads.find((r) => r.id === id)
  if (rd) prop(`${id}_moss`, 'jmMossPath', rd.position, [rd.size[0], 0.1, rd.size[2]], { rotationDeg: rd.rotationDeg ?? 0, collider: false, seed: id.length * 7 })
}

// (11/26 지민 요청: 숲 규모를 터널 양옆·풀밭 양쪽까지, 그림의 초록 선) 왼쪽(x -39 ~ -4.5)·오른쪽(x 4.5 ~ 26.5, 전망 무대 길 앞까지),
//   강 남쪽 둑(RIVER_BANK_S) ~ z 39.6. 가운데 길(|x| < 4.5)·터널 건물·건물 앞 마당·다른 소품·길·단 자리는 비움. 3.3m 간격 + 흔들기, 16m 칸마다 jmForest 소품 하나
{
  let seed = 1126
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const SKIP_STYLES = new Set(['jmZoneLight', 'jmForestPath', 'jmForest', 'jmEntryTitle', 'jmMossPath', 'jmGrassTufts', 'jmCanal', 'jmFloor'])
  const blocks = []
  for (const p of props) {
    if (SKIP_STYLES.has(p.style) || p.id.startsWith('jm_forest_tree_')) continue
    const r = Math.max(p.size[0], p.size[2]) / 2 + 0.7
    if (r < 15) blocks.push(['c', p.position[0], p.position[1], r])
  }
  for (const rd of roads) blocks.push(['r', rd.position[0], rd.position[1], rd.size[0] / 2 + 0.9, rd.size[2] / 2 + 0.9, rd.rotationDeg ?? 0])
  for (const t of terrain) {
    if (t.rect) blocks.push(['b', t.rect[0] - 1, t.rect[1] - 1, t.rect[2] + 1, t.rect[3] + 1])
    if (t.from && t.to) {
      const hw = (t.width ?? 3) / 2 + 1
      blocks.push(['b', Math.min(t.from[0], t.to[0]) - hw, Math.min(t.from[1], t.to[1]) - 1, Math.max(t.from[0], t.to[0]) + hw, Math.max(t.from[1], t.to[1]) + 1])
    }
  }
  const hitBlock = (x, z, r) =>
    blocks.some((b) => {
      if (b[0] === 'c') return Math.hypot(x - b[1], z - b[2]) < b[3] + r
      if (b[0] === 'b') return x > b[1] - r && x < b[3] + r && z > b[2] - r && z < b[4] + r
      const a = (-b[5] * Math.PI) / 180
      const dx = x - b[1]
      const dz = z - b[2]
      const lx = dx * Math.cos(a) - dz * Math.sin(a)
      const lz = dx * Math.sin(a) + dz * Math.cos(a)
      return Math.abs(lx) < b[3] + r && Math.abs(lz) < b[4] + r
    })
  const inLobe = (x, z) => z > RIVER_BANK_S + 1.2 && z < 39.6 && ((x > -39 && x < -4.5) || (x > 4.5 && x < 26.5))
  const open = (x, z) => (Math.abs(x) < 15.2 && z > 3.2 && z < 24.6) || (z > 22 && Math.abs(x) < 2.2) || Math.hypot(x + 10, z - 36.5) < 3.4
  const all = [...ENTRY_TRUNKS]
  const trees = []
  const bushes = []
  for (let z = RIVER_BANK_S + 2; z < 39.6; z += 3.3)
    for (let x = -38.5; x < 26.5; x += 3.3) {
      const tx = r2(x + (rnd() - 0.5) * 2.2)
      const tz = r2(z + (rnd() - 0.5) * 2.2)
      const h = r2(4.6 + rnd() * 2.4)
      const r = r2(0.18 + rnd() * 0.14)
      if (!inLobe(tx, tz) || open(tx, tz) || hitBlock(tx, tz, 0.6)) continue
      if (all.some(([ax, az]) => Math.hypot(ax - tx, az - tz) < 2.2)) continue
      all.push([tx, tz, h, r])
      trees.push([tx, tz, h, r])
      for (let k = 0; k < 2; k++) {
        const bx = r2(tx + (rnd() - 0.5) * 3)
        const bz = r2(tz + (rnd() - 0.5) * 3)
        if (inLobe(bx, bz) && !open(bx, bz) && !hitBlock(bx, bz, 0.4) && Math.hypot(bx - tx, bz - tz) > r + 0.5) bushes.push([bx, bz, r2(0.4 + rnd() * 0.6)])
      }
    }
  trees.forEach(([x, z, , r], i) => wall(`jm_forest_side_tree_${i}`, [x, z], [r2(r * 2 + 0.1), 3, r2(r * 2 + 0.1)]))
  const tiles = new Map()
  const tileOf = (x, z) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`
  const tileFor = (x, z) => {
    const k = tileOf(x, z)
    if (!tiles.has(k)) tiles.set(k, { trunks: [], bushes: [] })
    return tiles.get(k)
  }
  for (const t of trees) tileFor(t[0], t[1]).trunks.push(t)
  for (const b of bushes) tileFor(b[0], b[1]).bushes.push(b)
  for (const [k, v] of tiles) {
    const [ix, iz] = k.split(',').map(Number)
    const c = [ix * 16 + 8, iz * 16 + 8]
    prop(`jm_forest_${ix}_${iz}`, 'jmForest', c, [16, 8, 16], {
      collider: false,
      trunks: v.trunks.map(([x, z, h, r]) => [r2(x - c[0]), r2(z - c[1]), h, r]),
      bushes: v.bushes.map(([x, z, sz]) => [r2(x - c[0]), r2(z - c[1]), sz]),
    })
  }
  console.log(`양옆 숲: 나무 ${trees.length}, 덤불 ${bushes.length}, 칸 ${tiles.size}`)
}

// (11/26 지민 요청: 등불이 너무 많아 정신없음) 등불 소품(석등·등 줄·가스등·쌍등)을 차례로 세어 4개마다 1개씩 뺌 (1/4 줄임)
const LAMP_STYLES = new Set(['jmLantern', 'jmLanternLine', 'jmGasLamp', 'jmTwinLamp'])
{
  let n = 0
  const kept = props.filter((p) => !(LAMP_STYLES.has(p.style) && ++n % 4 === 0))
  props.length = 0
  props.push(...kept)
}
const zone = {
  zoneId: 'JM',
  owner: '지민',
  name: '애니메이션',
  origin: [0, ZONE_ORIGIN_Z],
  size: [80, 80],
  color: '#7cc8ff',
  colorName: '하늘',
  entrance: { position: [0, 40], rotationDeg: 0, width: 6 },
  roads,
  markings: [],
  terrain,
  buildings,
  props,
}
writeFileSync(OUT, JSON.stringify(zone, null, 0).replace(/\},\{"/g, '},\n{"') + '\n')
console.log(`jm_anime.json: roads ${roads.length}, terrain ${terrain.length}, buildings ${buildings.length}, props ${props.length}`)

// 명장면 스탬프·가게 자리를 shared/places.json 에 맞춰 씀 (좌표만, 이름·설명은 그 파일에서)
{
  const PLACES = join(here, '../../shared/places.json')
  const raw = readFileSync(PLACES, 'utf8')
  let next = raw
  for (const [id, pos] of Object.entries(placePositions)) {
    const at = next.indexOf(`"id": "${id}"`)
    if (at < 0) throw new Error(`shared/places.json 에 ${id} 가 없어요`)
    const end = next.indexOf('}', at)
    const block = next.slice(at, end)
    const fixed = block.replace(/"position": \[[^\]]*\]/, `"position": [${pos.join(', ')}]`)
    next = next.slice(0, at) + fixed + next.slice(end)
  }
  JSON.parse(next)
  if (next !== raw) writeFileSync(PLACES, next)
  console.log(`places.json: 명장면·가게 자리 ${Object.keys(placePositions).length}곳 맞춤`)
}
