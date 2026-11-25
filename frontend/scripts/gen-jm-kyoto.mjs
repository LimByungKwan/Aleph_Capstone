// 애니메이션 구역(JM) 「유아카리초(湯灯町)」 교토 온천 마을 배치 생성기 — 담당: 지민
// 실행: node frontend/scripts/gen-jm-kyoto.mjs  →  frontend/src/game/data/zones/jm_anime.json 을 통째로 다시 씀
//
// 큰 틀 (구역 좌표, 북쪽 = z 마이너스)
//   남쪽 입구(0,40) → 천 개의 도리이 터널 → 수로를 낀 온천 거리(여관이 양쪽으로)
//   → 맵 뒷부분 산넨자카식 계단 거리(옛 데이터, 단 3개 1.5 → 4.5m) → 고개(6m)
//   → (11/25) 고개에서 골짜기 위를 가로지르는 큰 붉은 다리(높이 6m)로 곧장 → 여관 앞마당(6m) 큰 여관 「湯灯屋」
//     골짜기(0m, 개울과 작은 붉은 다리)는 고개 동쪽 계단으로 내려감
//   (11/25) 명장면 ①~⑤(스탬프)는 가게 사이 골목 끝 흰 회벽 마당 (계단 거리 양옆, 입구 양옆) (9번)
//     골목 바로 옆 가게가 같은 작품 가게(쿠폰). 스탬프·가게 자리는 이 스크립트가 shared/places.json "position"에 맞춰 씀
//   수로 거리의 갈래 4개는 풍경만 남김(옛 애니 장면·스탬프는 11/23에 뺌): 서1 마치야 골목 / 동1 잡화점 + 전망 무대(BK 흔들다리)
//   / 서2 호수 → 벚꽃 강변 / 동2 대나무 숲 산책길
// 북쪽 끝은 hub.json 바닥을 늘려서 구역 좌표 z -185(11/23) → -225(11/25, 큰 여관 다시 지음)까지 써요.
// 옛 강변·호수·전망대 다리·계단 거리는 scripts/jm-kyoto-keep.json 에서 가져와요.

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

// 회전된 건물 기준 좌표(lx, lz) → 구역 좌표 (three.js rotation.y와 같은 방향)
function rotate([cx, cz], deg, lx, lz) {
  const a = (deg * Math.PI) / 180
  return [r2(cx + lx * Math.cos(a) + lz * Math.sin(a)), r2(cz - lx * Math.sin(a) + lz * Math.cos(a))]
}

const prop = (id, style, position, size, extra = {}) => props.push({ id, style, position, size, rotationDeg: 0, ...extra })
const road = (id, style, position, size, extra = {}) => roads.push({ id, ...(style && { style }), position, size, rotationDeg: 0, ...extra })
const wall = (id, position, size, extra = {}) => prop(id, 'jmCollider', position, size, extra)

// 들어갈 수 있는 가게: 건물 충돌은 끄고 벽 5장을 jmCollider로 (입구는 앞면 가운데 1.8m)
function shop(id, position, [w, h, d], rotationDeg, shopData, extra = {}) {
  buildings.push({ id, style: 'jmShopRoom', position, size: [w, h, d], rotationDeg, model: null, collider: false, shop: shopData, ...extra })
  const back = d / 2 - 0.15
  const side = w / 2 - 0.15
  const piece = (w - 1.8) / 2
  const walls = [
    ['back', 0, -back, [w, h, 0.3]],
    ['left', -side, 0, [0.3, h, d]],
    ['right', side, 0, [0.3, h, d]],
    ['front_l', -(0.9 + piece / 2), back, [piece, h, 0.3]],
    ['front_r', 0.9 + piece / 2, back, [piece, h, 0.3]],
  ]
  for (const [name, lx, lz, size] of walls) wall(`${id}_wall_${name}`, rotate(position, rotationDeg, lx, lz), size, { rotationDeg })
}

const ryokan = (id, position, size, rotationDeg, floors, sign, extra = {}) =>
  buildings.push({ id, style: 'jmRyokan', position, size, rotationDeg, floors, model: null, signs: [sign], ...extra })

const tree = (id, style, position, extra = {}) => {
  const size = style === 'jmSakura' ? [4, 6.5, 4] : [3.4, 7, 3.4]
  prop(id, style, position, size, { collider: [0.5, 3, 0.5], ...extra })
}
const bamboo = (id, position, extra = {}) => prop(id, 'jmBamboo', position, [3, 7, 2.5], { collider: [2.4, 7, 2], ...extra })
const gasLamp = (id, position, extra = {}) => prop(id, 'jmGasLamp', position, [0.45, 3.2, 0.45], { collider: [0.3, 3.2, 0.3], ...extra })
const stoneLantern = (id, position, extra = {}) => prop(id, 'jmLantern', position, [0.8, 2.2, 0.8], extra)
const light = (id, position, extra = {}) => prop(id, 'jmZoneLight', position, [0.1, 14, 0.1], { collider: false, ...extra })

// ─────────────────────────────────────────────
// 1. 남쪽 입구 광장 + (11/25) 붉은 터널 건물 (z 40 → 4)
//    예전: 천 개의 도리이 터널 → 지민 요청으로 「센과 치히로의 행방불명」 첫 장면 터널 입구처럼
//    숲길 끝 붉은 회벽 건물(탑) 아래 아치 → 어두운 굴(위는 풀 언덕) → 색유리 빛 대합실 홀 → 온천 거리
//    그림: jm_tunnel.jsx JmTunnelGate (소품 가운데 z 13, 로컬 +z = 남쪽), 걷는 판정은 아래 jmCollider
// ─────────────────────────────────────────────
road('jm_entry_path', 'stone', [0, 31], [4.2, 0.08, 18])
road('jm_entry_plaza', 'stone', [0, 30], [13, 0.06, 10])
prop('jm_town_stone', 'jmStoneMonument', [7.6, 31], [2.2, 2.6, 0.5], { rotationDeg: -35, signs: [{ text: '湯灯町' }] })
for (const [i, x, z] of [[1, -6.2, 26], [2, 6.2, 26], [3, -6.2, 35], [4, 6.2, 35]]) stoneLantern(`jm_entry_lantern_${i}`, [x, z])
prop('jm_entry_sign', 'jmArrowSign', [-7.5, 31], [1.6, 2.1, 0.2], { rotationDeg: 30, signs: [{ text: '온천 거리', dir: 'right' }, { text: '붉은 터널', dir: 'right' }] })

const TUN_Z = 13
prop('jm_tunnel_gate', 'jmTunnelGate', [0, TUN_Z], [20, 16, 18], { collider: false })
// 건물 양쪽 덩어리 (아치 3.6m만 비움) / 굴 벽 / 굴 위 언덕 / 홀 벽 (앞뒤는 가운데 3.6m만 비움)
for (const s of [-1, 1]) {
  const k = s < 0 ? 'w' : 'e'
  wall(`jm_tunnel_gate_${k}`, [s * 4.4, TUN_Z + 6], [5.2, 8.2, 6])
  wall(`jm_tunnel_tube_${k}`, [s * 2.0, TUN_Z], [0.4, 4, 6])
  wall(`jm_tunnel_mound_${k}`, [s * 5.6, TUN_Z], [6.8, 3, 6])
  wall(`jm_tunnel_hall_${k}`, [s * 4.8, TUN_Z - 6], [0.4, 5.2, 6])
  wall(`jm_tunnel_hall_back_${k}`, [s * 3.4, TUN_Z - 3.3], [3.2, 5.2, 0.6])
  wall(`jm_tunnel_hall_front_${k}`, [s * 3.4, TUN_Z - 8.7], [3.2, 5.2, 0.6])
}
prop('jm_tunnel_statue', 'jmTwoFaceStatue', [1.9, 24.6], [0.9, 1.8, 0.9], { rotationDeg: 10, collider: [0.8, 1.8, 0.8] })
for (const [i, x, z, r] of [[1, -5.2, 23.4, 20], [2, 5.4, 23.2, -15], [3, -3.6, 37.6, 0]]) prop(`jm_tunnel_hokora_${i}`, 'jmStoneHokora', [x, z], [0.8, 1.1, 0.7], { rotationDeg: r })
for (const [i, x, z] of [[5, -9, 21.5], [6, 9.5, 22]]) tree(`jm_entry_maple_${i}`, i % 3 === 0 ? 'jmSakura' : 'jmMaple', [x, z])
light('jm_light_tunnel', [0, TUN_Z])

// ─────────────────────────────────────────────
// 2. 수로를 낀 온천 거리 (z 4 → -46)
//    수로 x -2.5~2.5 / 양쪽 산책길 x ±(2.5~7) / 여관 줄 x ±(7~16)
// ─────────────────────────────────────────────
road('jm_canal_head', 'stone', [0, 1], [14, 0.08, 6])
road('jm_walk_w', 'stone', [-4.75, -21], [4.5, 0.06, 50])
road('jm_walk_e', 'stone', [4.75, -21], [4.5, 0.06, 50])
prop('jm_canal_head_wall', null, [0, -2.2], [5, 0.46, 0.4], { color: '#9d978c' })

// 수로 구간 (다리 자리는 충돌 없이 물만)
const BRIDGES = [-6, -24, -38]
const canalCuts = [-2, -4.5, -7.5, -22.5, -25.5, -36.5, -39.5, -44]
for (let i = 0; i < canalCuts.length - 1; i++) {
  const [a, b] = [canalCuts[i], canalCuts[i + 1]]
  const len = a - b
  const isBridge = i % 2 === 1
  prop(`jm_canal_${i}`, 'jmCanal', [0, r2((a + b) / 2)], [5, 0.1, len], isBridge ? { collider: false, curb: false } : { collider: [4.6, 1, len] })
}
BRIDGES.forEach((z, i) => {
  road(`jm_canal_bridge_${i + 1}`, null, [0, z], [6, 0.14, 3], { color: '#7a5236' })
  prop(`jm_canal_bridge_${i + 1}_rail`, 'jmBridgeRail', [0, z], [3, 0.1, 6], { rotationDeg: 90, collider: false })
})
for (const z of [-1, -10, -16, -20.5, -28, -33, -42]) {
  gasLamp(`jm_gaslamp_w${-z}`, [-3.05, z])
  gasLamp(`jm_gaslamp_e${-z}`, [3.05, z])
}

// 서쪽 줄 (앞면이 동쪽 = rotationDeg 90)
ryokan('jm_ryokan_tsukimi', [-11.5, 0], [6, 9, 9], 90, 2, { text: '月見屋', bg: '#2b2f4a' })
ryokan('jm_ryokan_shirasagi', [-11.5, -14], [10, 12, 9], 90, 3, { text: '白鷺館', roof: '旅館 白鷺' })
shop('jm_teahouse', [-10.5, -31], [8, 7, 7], 90, { look: 'machiya', interior: 'teahouse', enterable: true, sign: { text: '妖怪茶屋', bg: '#14532d', fg: '#f0fdf4' } })
ryokan('jm_ryokan_hanaakari', [-10.5, -40], [10, 11, 7], 90, 3, { text: '花灯り', bg: '#5b1a2a' }, { color: '#7a4a32' })
// 동쪽 줄 (앞면이 서쪽 = rotationDeg -90)
ryokan('jm_ryokan_tsuru', [11.5, 0], [6, 9, 9], -90, 2, { text: '鶴乃家', bg: '#1f3b2e' })
shop('jm_brewery', [10.5, -13], [8, 7, 7], -90, { look: 'machiya', interior: 'brewery', enterable: true, sign: { text: '氷華酒造', bg: '#1e3a5f', fg: '#f5f0e6' } }, { sugidama: true })
prop('jm_oden_yatai', 'jmYatai', [9.4, -19.2], [3, 2.6, 2], { rotationDeg: -90, signs: [{ text: 'おでん' }] })
ryokan('jm_ryokan_matsu', [11.5, -32], [10, 12, 9], -90, 3, { text: '松の湯', roof: '日帰り湯' })
ryokan('jm_ryokan_yuzuriha', [11.5, -41], [8, 10, 9], -90, 3, { text: 'ゆずりは', bg: '#4a2f1b' }, { color: '#5e3d2a' })

// ─────────────────────────────────────────────
// 3. 서1 갈래: 마치야 골목 (끝에 벤치 쉼터)
// ─────────────────────────────────────────────
road('jm_branch_w1', 'stone', [-19, -6], [24, 0.06, 4])
prop('jm_w1_bench', 'jmBench', [-30, -8.4], [1.8, 0.5, 0.5])
tree('jm_w1_sakura', 'jmSakura', [-33.5, -5.5])
stoneLantern('jm_w1_lantern', [-30.5, -3.4])
prop('jm_machiya_tram_n', 'jmMachiya', [-20.5, -12.6], [7, 7, 7], { signs: [{ text: '古典堂 書店', bg: '#3f2a1d', fg: '#f5e6c8' }] })
prop('jm_machiya_tram_s', 'jmMachiya', [-20.5, 0.6], [7, 7, 7], { rotationDeg: 180, signs: [{ text: '豆腐 ひかり', bg: '#f5f0e6', fg: '#1e3a5f' }] })
// (11/25) 자판기 자리는 명장면 ① 가게(どんぐり茶屋)로

// ─────────────────────────────────────────────
// 4. 서2 갈래: 호수 → 「초속 5센티미터」 벚꽃 강변 (호수·강은 옛 데이터 그대로)
// ─────────────────────────────────────────────
road('jm_branch_w2', 'stone', [-19.5, -21], [25, 0.06, 3.5])
prop('jm_sign_river', 'jmArrowSign', [-16.6, -18.8], [1.6, 2.1, 0.2], { signs: [{ text: '벚꽃 강변', dir: 'left' }, { text: '호수', dir: 'left' }] })
for (const [i, x, z] of [[1, -18, -17.5], [2, -30.5, -17.8], [3, -35.5, -24.6], [4, -13.6, -26.2]]) tree(`jm_lake_tree_${i}`, i % 2 ? 'jmSakura' : 'jmMaple', [x, z])

// ─────────────────────────────────────────────
// 5. 동1 갈래: 하레야 잡화점 + 전망 무대
// ─────────────────────────────────────────────
road('jm_branch_e1', 'asphalt', [18.5, -6], [23, 0.06, 4.4])
shop('jm_shop_hare', [21, -13], [8, 7, 7], 0, { look: 'zakka', enterable: true, sign: { text: '晴れ屋 雑貨店', bg: '#fff4d6', fg: '#1e40af' } })
prop('jm_vending_bus', 'jmVendingRow', [16.4, -2.6], [3, 1.9, 0.8], { rotationDeg: 180 })
prop('jm_pole_1', 'jmUtilityPole', [16, -8.6], [0.4, 8, 0.4], { collider: [0.35, 8, 0.35], wire: 12.6 })
prop('jm_pole_2', 'jmUtilityPole', [28.6, -8.6], [0.4, 8, 0.4], { collider: [0.35, 8, 0.35] })
// 전망 무대 (기요미즈 무대 느낌) — 동쪽 흔들다리가 BK 전망대로 이어짐
terrain.push({ type: 'platform', id: 'jm_stage', rect: [31, -13, 43, 1], height: 6.5, surface: 'paver', lights: true,
  rails: [{ edge: 'north' }, { edge: 'west' }, { edge: 'south', gaps: [[35.3, 38.7]] }, { edge: 'east', gaps: [[-6.4, -3.6]] }] })
terrain.push({ type: 'stairs', id: 'jm_stage_stairs', from: [37, 14, 0], to: [37, 1, 6.5], width: 3 })
road('jm_stage_path_a', 'stone', [28.6, 5], [3, 0.06, 20])
road('jm_stage_path_b', 'stone', [33, 15.6], [9, 0.06, 3])
prop('jm_sign_tower', 'jmArrowSign', [34.3, -2.6], [1.6, 2.1, 0.2], { elevation: 6.5, signs: [{ text: '전망대', dir: 'right' }, { text: '데이트 코스', dir: 'right' }] })
prop('jm_stage_sign', 'jmArrowSign', [30.4, 13], [1.6, 2.1, 0.2], { signs: [{ text: '전망 무대', dir: 'right' }] })
for (const [i, x, z] of [[1, 32.5, -0.8], [2, 41.5, -11.5]]) stoneLantern(`jm_stage_lantern_${i}`, [x, z], { elevation: 6.5 })
for (const [i, x, z] of [[1, 27.5, -15.5], [2, 44, 6], [3, 24.5, 12]]) tree(`jm_stage_maple_${i}`, 'jmMaple', [x, z])

// ─────────────────────────────────────────────
// 6. 동2 갈래: 대나무 숲 산책길 (끝에 벤치 쉼터)
// ─────────────────────────────────────────────
road('jm_branch_e2', 'stone', [18.5, -24], [23, 0.06, 3.5])
prop('jm_e2_bench', 'jmBench', [31.2, -24], [1.8, 0.5, 0.5], { rotationDeg: -90 })
prop('jm_e2_hokora', 'jmHokora', [33.6, -27], [0.9, 1.6, 0.7], { rotationDeg: -90 })
for (const [i, x] of [[1, 20.5], [2, 24]]) {
  stoneLantern(`jm_shrine_lantern_n${i}`, [x, -26.2])
  stoneLantern(`jm_shrine_lantern_s${i}`, [x, -21.8])
}
for (let i = 0; i < 7; i++) {
  bamboo(`jm_shrine_bamboo_n${i + 1}`, [17 + i * 3.6, -17.6])
  bamboo(`jm_shrine_bamboo_s${i + 1}`, [17 + i * 3.6, -31])
}
for (const [i, x, z] of [[1, 38.8, -17.6], [2, 39.5, -34.5], [3, 19, -35.5]]) tree(`jm_shrine_ginkgo_${i}`, 'jmGinkgo', [x, z])

// ─────────────────────────────────────────────
// 7. 북쪽(맵 뒷부분): 산넨자카식 계단 거리 → 고개 → 골짜기 → 중턱 → 꼭대기 큰 여관 「湯灯屋」
//    옛 계단 거리(단 4개: 1.5 → 3 → 4.5 → 6m, 마치야 12채, 서쪽 정원·연못, 동쪽 대나무·도리이 계단)를
//    온천 거리 축(x = 0)에 맞춰 x -14.5, z -6 옮겨서 그대로 씀. 옛 꼭대기 단(6m)은 고개가 됨
// ─────────────────────────────────────────────
const ZAKA_DX = -14.5
const ZAKA_DZ = -6
const MAP_NORTH = -184.8 // 땅 끝(-185, hub.json 바닥) 안쪽
// 11/24: 계단 거리 단 높이를 똑같은 1.5m 간격 대신 서로 다르게 (오르는 높이 1.2 / 2.1 / 1.1 / 1.6m)
//   옛 높이 → 새 높이. 꼭대기(6)는 고개라 그대로
const ZH = { 1.5: 1.2, 3: 3.3, 4.5: 4.4, 6: 6 }
const zh = (h) => ZH[h] ?? h
const mv = ([x, z]) => [r2(x + ZAKA_DX), r2(z + ZAKA_DZ)]
const mv3 = ([x, z, h]) => [r2(x + ZAKA_DX), r2(z + ZAKA_DZ), zh(h)]
function shiftZaka(item) {
  const out = { ...item }
  if (item.elevation !== undefined) out.elevation = zh(item.elevation)
  if (item.height !== undefined) out.height = zh(item.height)
  if (item.position) out.position = mv(item.position)
  if (item.center) out.center = mv(item.center)
  if (item.from) out.from = mv3(item.from)
  if (item.to) out.to = mv3(item.to)
  if (item.points) out.points = item.points.map(mv3)
  if (item.rect) out.rect = [r2(item.rect[0] + ZAKA_DX), Math.max(MAP_NORTH, r2(item.rect[1] + ZAKA_DZ)), r2(item.rect[2] + ZAKA_DX), r2(item.rect[3] + ZAKA_DZ)]
  return out
}
roads.push(...keep.zaka.roads.map(shiftZaka))
// 도리이 계단: 단을 높게(한 단 0.43m × 7단, 한 단 깊이 2.5m) → 아래에서 도리이를 단마다 하나씩 다시 세움
const TORII_STEP = 0.43
// 둘째 단(오르는 높이 2.1m)은 계단을 앞으로 1.5m 늘려 다른 계단과 비슷한 경사로
const ZAKA_STAIR_FIX = { jm_zaka_torii_stairs: (item) => ({ ...item, stepHeight: TORII_STEP }), jm_zaka_stairs_2: (item) => ({ ...item, from: [item.from[0], item.from[1] + 1.5, item.from[2]] }) }
terrain.push(...keep.zaka.terrain.map((item) => (ZAKA_STAIR_FIX[item.id] ? ZAKA_STAIR_FIX[item.id](item) : item)).map(shiftZaka))
buildings.push(...keep.zaka.buildings.map(shiftZaka))
// 장면 자리 골목을 내려고 빼는 옛 항목: 골목 쪽 대나무 울타리(아래에서 틈을 두고 다시 놓음), 장면 자리와 겹치는 나무·노다테
// (11/24) 장면 자리 마당을 치우면서 예전에 뺐던 골목 울타리·나무·노다테를 되돌림 → 지금은 빼는 항목 없음
// (11/25) 명장면 마당·골목 자리: 옛 연못·정원 소품·골목을 막는 울타리를 빼고, 울타리는 골목 자리만 비워 다시 놓음 (아래)
const ZAKA_DROP = new Set([
  'jm_zaka_fence_t1_w', 'jm_zaka_fence_t1_w_2', 'jm_zaka_fence_t3_w', 'jm_zaka_fence_t3_w_2', 'jm_zaka_landing_fence_e',
  'jm_zaka_pond', 'jm_zaka_pond_edge_n', 'jm_zaka_pond_edge_s', 'jm_zaka_pond_edge_e', 'jm_zaka_pond_edge_w', 'jm_zaka_pond_lantern',
  'jm_zaka_bench_pond_n', 'jm_zaka_bench_pond_s', 'jm_zaka_bench_pond_e', 'jm_zaka_bench_pond_w', 'jm_zaka_garden_flower_1', 'jm_zaka_garden_flower_2',
  'jm_zaka_rock_1', 'jm_zaka_rock_2', 'jm_zaka_rock_3', 'jm_zaka_garden_path_n', 'jm_zaka_garden_ground', 'jm_zaka_garden_hokora',
  'jm_zaka_maple_7', 'jm_zaka_maple_8', 'jm_zaka_maple_9', 'jm_zaka_maple_10', 'jm_zaka_sakura_2', 'jm_zaka_sakura_3', 'jm_zaka_bamboo_5',
])
props.push(...keep.zaka.props.filter((item) => !ZAKA_DROP.has(item.id) && !/^jm_zaka_torii_\d/.test(item.id)).map(shiftZaka))
// 골목 자리(z -61 ~ -63.6, -95 ~ -97.6, 쉼터 동쪽 -78 ~ -80.6)만 비운 울타리
for (const [id, x, z, len, e] of [
  ['jm_zaka_fence_t1_w_a', -11.3, -58.25, 5.5, 1.2], ['jm_zaka_fence_t1_w_b', -11.3, -68.05, 8.9, 1.2],
  ['jm_zaka_fence_t3_w_a', -11.3, -92.25, 5.5, 4.4], ['jm_zaka_fence_t3_w_b', -11.3, -102.3, 9.4, 4.4],
  ['jm_zaka_landing_fence_e_a', 21.3, -75.25, 5.5, 3.3], ['jm_zaka_landing_fence_e_b', 21.3, -81.3, 1.4, 3.3],
]) props.push({ id, style: 'jmBambooFence', position: [x, z], size: [len, 1.1, 0.1], rotationDeg: 90, elevation: e })
{
  const st = keep.zaka.terrain.find((item) => item.id === 'jm_zaka_torii_stairs')
  const [x, z0, h0] = st.from
  const [, z1, h1raw] = st.to
  const h1 = zh(h1raw)
  const n = Math.ceil((h1 - h0) / TORII_STEP)
  for (let i = 0; i < n; i++) {
    const z = r2(z0 + ((z1 - z0) * (i + 0.5)) / n)
    const elevation = r2(h0 + ((h1 - h0) * (i + 1)) / n)
    const id = `jm_zaka_torii_${i + 1}`
    props.push({ ...shiftZaka({ id, style: 'jmTorii', position: [x, z], size: [3.4, 4.2, 0.3], collider: false, rotationDeg: 0 }), elevation })
    for (const [side, dx] of [['l', -1.1], ['r', 1.1]]) {
      props.push({ ...shiftZaka({ id: `${id}_pillar_${side}`, style: 'jmCollider', position: [r2(x + dx), z], size: [0.25, 4.2, 0.25], rotationDeg: 0 }), elevation })
    }
  }
}

// 온천 거리 끝 → 계단 거리 입구(도리이) 잇는 바닥 + 수로 끝 돌막이
road('jm_zaka_link', 'stone', [0, -46], [14, 0.08, 4])
prop('jm_canal_end_wall', null, [0, -44.2], [5, 0.46, 0.4], { color: '#9d978c' })
for (const side of [-1, 1]) gasLamp(`jm_zaka_link_lamp_${side < 0 ? 'w' : 'e'}`, [side * 5.6, -47])


// 거리 조명 (가까운 것만 켜짐)
light('jm_light_street_s', [0, -12])
light('jm_light_street_n', [0, -36])
light('jm_light_zaka', [0, -78], { elevation: 3 })

// ─────────────────────────────────────────────
// 7-1. (11/24) 장면 자리 마당 4곳은 치움 — 장면은 계단 거리 가게 문으로 들어가는 명장면 공간으로 옮김 (아래 9번)
// ─────────────────────────────────────────────
const fence = (id, position, len, elevation, rotationDeg = 90) => prop(id, 'jmBambooFence', position, [len, 1.1, 0.1], { rotationDeg, elevation })

// ─────────────────────────────────────────────
// 7-2. 고개 (옛 꼭대기 단, 높이 6) — 북쪽으로 골짜기가 내려다보임
// ─────────────────────────────────────────────
const PASS = 6
// (11/25) 고개 북쪽 끝: 가운데(x -1 ~ 5)는 큰 다리 입구, 동쪽(x 8 ~ 12)은 골짜기로 내려가는 계단 입구
fence('jm_pass_fence_n_w', [-6.25, -125.2], 10.5, PASS, 0)
fence('jm_pass_fence_n_m', [6.5, -125.2], 3, PASS, 0)
fence('jm_pass_fence_n_e', [13.75, -125.2], 3.5, PASS, 0)
prop('jm_pass_stone', 'jmStoneMonument', [9, -110.5], [2, 2.4, 0.5], { rotationDeg: -20, elevation: PASS, signs: [{ text: '湯灯峠' }] })
for (const [i, x] of [[1, -2.4], [2, 6.4]]) stoneLantern(`jm_pass_lantern_${i}`, [x, -122.6], { elevation: PASS })
prop('jm_pass_bench', 'jmBench', [11.5, -118], [1.8, 0.5, 0.5], { rotationDeg: -90, elevation: PASS })
tree('jm_pass_maple', 'jmMaple', [12.5, -123], { elevation: PASS })
// 고개 → 골짜기 내리막 계단 (계단 거리와 반대로 북쪽으로 내려감)
terrain.push({ type: 'stairs', id: 'jm_pass_stairs', from: [10, -139, 0], to: [10, -125.4, PASS], width: 4 })
// (11/24) 계단 옆 난간(jmStairRail)은 뺌 — 애니 구역 계단은 모두 옆 가드 없이

// ─────────────────────────────────────────────
// 7-3. 골짜기 (높이 0): 동서로 흐르는 개울 + 붉은 다리, 양쪽 강가 집 → 장면 자리 ③
// ─────────────────────────────────────────────
prop('jm_valley_stream_w', 'jmCanal', [-24, -144], [6, 0.1, 44], { rotationDeg: 90, natural: true, collider: [5.2, 1, 44] })
prop('jm_valley_stream_e', 'jmCanal', [24, -144], [6, 0.1, 44], { rotationDeg: 90, natural: true, collider: [5.2, 1, 44] })
prop('jm_valley_stream_bridge', 'jmCanal', [0, -144], [6, 0.1, 4], { rotationDeg: 90, natural: true, collider: false, curb: false })
road('jm_valley_bridge', null, [0, -144], [3.2, 0.14, 7], { color: '#7a5236' })
prop('jm_valley_bridge_rail', 'jmBridgeRail', [0, -144], [3.2, 0.1, 7], { collider: false })
road('jm_valley_path_s', 'stone', [6, -140], [12, 0.06, 3])
road('jm_valley_path_n', 'stone', [-2, -150.5], [48, 0.06, 3])
for (const [i, x, z] of [[1, -3.8, -140.4], [2, 3.8, -140.4], [3, -3.8, -148.4], [4, 3.8, -148.4]]) gasLamp(`jm_valley_lamp_${i}`, [x, z])
prop('jm_valley_house_sw', 'jmMachiya', [-17, -133], [7, 7, 7], { rotationDeg: 180, signs: [{ text: '宿 せせらぎ', bg: '#2b2f4a', fg: '#f5efe0' }] })
prop('jm_valley_house_se', 'jmMachiya', [17, -133], [7, 7, 7], { rotationDeg: 180, sugidama: true, signs: [{ text: '甘味 川辺', bg: '#7c2d12', fg: '#fde68a' }] })
prop('jm_valley_house_nw', 'jmMachiya', [-38, -155], [7, 7, 7], { signs: [{ text: '蕎麦 谷風', bg: '#3f2a1d', fg: '#f5e6c8' }] })
for (const [i, x, z, s] of [[1, -30, -137, 'jmMaple'], [2, 30, -137, 'jmMaple'], [3, -8, -129, 'jmSakura'], [4, 15, -126.8, 'jmSakura'], [5, -46, -149, 'jmMaple'], [6, 44, -150, 'jmGinkgo'], [7, 34, -157, 'jmMaple']]) tree(`jm_valley_tree_${i}`, s, [x, z])
light('jm_light_valley', [0, -145])

// ─────────────────────────────────────────────
// 7-4. (11/25) 큰 붉은 다리 → 꼭대기 여관 앞마당 (높이 6, 고개와 같은 높이)
//   예전: 골짜기 → 중턱(5) → 꼭대기(9) 계단 5개 → 지민 요청으로 계단 대신 다리 (참고: 붉은 난간·가로등 다리 끝에 높은 건물)
//   다리 축 x = 2 (여관 현관 가운데), 고개 북쪽 끝(z -125.4) → 앞마당 남쪽 끝(z -170)
// ─────────────────────────────────────────────
const TOP = PASS
// arch: 가운데가 양 끝보다 1.5m 높은 둥근 다리 (지민 요청: 사진처럼 평평하지 않고 둥글게)
const BR = { x: 2, z0: -125.4, z1: -170, w: 6, arch: 1.5, seg: 8 }
{
  const len = r2(BR.z0 - BR.z1)
  const cz = r2((BR.z0 + BR.z1) / 2)
  // 교각: 개울(z -147 ~ -141)·골짜기 북쪽 길(z -152 ~ -149)을 피해서
  const piers = [-133, -156, -163.5]
  prop('jm_grand_bridge', 'jmGrandBridge', [BR.x, cz], [BR.w, 6, len], {
    collider: false, elevation: TOP, depth: TOP, arch: BR.arch, piers: piers.map((z) => r2(z - cz)),
  })
  // 걷는 바닥: 아치(사인 곡선)를 8토막 경사로로 (jm_kyoto.jsx archHeight와 같은 식). 경사로는 늘 낮은 끝 → 높은 끝으로 적음
  //   경사로 폭은 다리보다 0.6m 좁게 → 돌 단이 다리 바닥판·옆판 안에 가려짐. 난간 충돌은 토막마다 jmCollider (높은 끝 + 1.2m)
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
  for (const side of [-1, 1]) {
    piers.forEach((z, i) => wall(`jm_grand_bridge_pier_${side < 0 ? 'w' : 'e'}${i + 1}`, [r2(BR.x + side * (BR.w / 2 - 0.7)), z], [0.9, r2(TOP - 1), 0.9]))
  }
}
// 다리 밑 골짜기 북쪽(예전 중턱 자리)은 나무·대나무 숲으로
for (const [i, x, z, s] of [[1, -28, -162, 'jmMaple'], [2, -18, -166, 'jmSakura'], [3, 14, -160, 'jmMaple'], [4, 24, -165, 'jmGinkgo'], [5, -36, -168, 'jmMaple']]) tree(`jm_under_tree_${i}`, s, [x, z])
for (const [i, x, z] of [[1, -31, -158], [2, 30, -158], [3, 34, -166]]) bamboo(`jm_under_bamboo_${i}`, [x, z])
// (11/25) 맵 북쪽 끝을 40m 늘림 (hub.json 바닥 [260,440] 중심 [0,-90] → 구역 좌표 z -225까지). 큰 여관을 넓게 다시 지으려고
const MAP_NORTH_2 = -224.8
terrain.push({ type: 'platform', id: 'jm_ryokan_top', rect: [-20, MAP_NORTH_2, 24, -170], height: TOP, surface: 'stone', lights: true,
  rails: [{ edge: 'south', gaps: [[r2(BR.x - BR.w / 2), r2(BR.x + BR.w / 2)]] }, { edge: 'west' }, { edge: 'east' }, { edge: 'north' }] })

// ─────────────────────────────────────────────
// 7-5. 큰 여관 「湯灯屋」 (11/25 다시 지음) — 그림은 jm_yutoya.jsx JmYutoya, 걷는 판정은 여기서 jmCollider·지형 계단으로
//   참고: 지민이 보낸 사진들(붉은 벽·초록 기와·금 장식 외관 / 가운데가 뚫린 높은 홀, 홀 뒤 가운데 화려한 누각,
//   층마다 붉은 난간 회랑 + 금색 꽃 패널, 금 원형 격자 천장과 둥근 등 샹들리에, 홀을 가로지르는 붉은 아치 다리)
//   (11/25 지민 요청) 1층 로비 → 꺾어서 뒤채 목욕탕(앞에 탕 패 파는 번대), 2·3·4층 연회장, 꼭대기 층 여관 주인 집무실
//   간판 글자는 우리 것(湯灯屋·天楽)만 씀
//   로컬 좌표: 건물 가운데 기준, +z = 정면(다리 쪽), 높이는 앞마당(TOP) 기준
// ─────────────────────────────────────────────
const YU = { x: 2, front: -176, w: 26, d: 22, wt: 0.3, base: 0.6, door: 2.6, doorH: 3.6 }
YU.z = r2(YU.front - YU.d / 2)
const YU_LV = [0.6, 6.0, 9.6, 13.2, 16.8, 21.4] // 1층~5층 바닥 높이 + 지붕 밑
const YU_IN = { x: r2(YU.w / 2 - YU.wt), z: r2(YU.d / 2 - YU.wt) }
const YU_VOID = { x0: -7.5, x1: 7.5, z0: -7.0, z1: 6.5 } // 2~4층 바닥이 뚫린 홀
const YU_PAV = { x0: -3, x1: 3, z0: -7.0, z1: -3.0 } // 홀 뒤 가운데 누각 (1층 바닥 ~ 5층 바닥)
const YU_BRIDGE = { z: 1.0, w: 2.4, arch: 1.0, lv: 1 } // 2층 높이에서 홀을 가로지르는 아치 다리 (누각 앞을 가리지 않게 홀 가운데쯤)
const YU_STAIR_W = 1.8
// 계단: 회랑 바깥쪽 절반을 따라 서쪽·동쪽을 번갈아 (to = 도착하는 끝). 위층 바닥은 계단 위만 뚫림
const YU_STAIRS = [
  { x: 11.4, from: 7.0, to: -7.4 },
  { x: -11.4, from: -5.0, to: 5.0 },
  { x: 11.4, from: 5.0, to: -5.0 },
  { x: -11.4, from: -5.0, to: 5.0 },
]
// 홀 붉은 기둥 (1층 바닥 ~ 5층 바닥)
const YU_PILLARS = [[-7.5, 6.5], [7.5, 6.5], [-7.5, -7.0], [7.5, -7.0], [-7.5, 3.6], [7.5, 3.6], [-3.75, 6.5], [3.75, 6.5]]
const YU_HOLE_IN = 10.3 // 계단 구멍 안쪽 끝 |x|
// (11/25) 1층은 로비만 → 뒤 서쪽 문으로 꺾어 들어가는 뒤채 목욕탕 (번대 + 나무 패 판 + 나무 욕조) / 5층은 주인 집무실
const YU_BATH = {
  x0: -12, x1: 12, z0: -29, z1: -11, h: 6.2,
  door: { x: -10.5, w: 2.2, h: 2.8 }, // 본관 뒷벽의 문
  part: { z: -15, x0: -9.4 }, // 번대 앞 칸막이 (서쪽 끝 2.2m가 탕으로 들어가는 통로)
  counter: { x: -6, z: -13, w: 1.4, d: 2.4 },
  tubs: [[9.4, -17.6, 3], [9.4, -21.4, 3], [9.4, -25.2, 3], [-8.4, -26.8, 3], [-4.4, -26.8, 3]],
  center: { x: 1.5, z: -21.5, r: 2.6 },
}
const YU_OFFICE = { desk: [0, -7.6], chair: [0, -9.0], fire: [-12.3, -3], bookcases: [[12.3, -5], [12.3, 1]], vases: [[-3.4, -8.6], [3.4, -8.6]], door: [-9.8, 7.0] }
// 사각형 r에서 h를 뺀 조각들 ([x0, z0, x1, z1])
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
  const holes = YU_STAIRS.map((s) => {
    const [za, zb] = [Math.min(s.from, s.to) - 0.2, Math.max(s.from, s.to) + 0.2]
    return s.x > 0 ? [YU_HOLE_IN, za, ix, zb] : [-ix, za, -YU_HOLE_IN, zb]
  })
  const slabs = []
  for (let k = 1; k <= 4; k++) {
    let rects = k === 4 ? [full] : ring
    rects = rects.flatMap((r) => rectSub(r, holes[k - 1]))
    slabs.push({ lv: k, y: YU_LV[k], rects: rects.map((r) => r.map(r2)) })
  }
  // 난간 (선분): 홀 가장자리(2~4층) + 계단 구멍 가장자리(도착하는 끝 1.6m는 비움)
  const rails = []
  for (let k = 1; k <= 3; k++) {
    const y = YU_LV[k]
    rails.push({ y, a: [V.x0, V.z1], b: [V.x1, V.z1], face: 'void' })
    rails.push({ y, a: [V.x0, V.z0], b: [YU_PAV.x0, V.z0], face: 'void' })
    rails.push({ y, a: [YU_PAV.x1, V.z0], b: [V.x1, V.z0], face: 'void' })
    for (const x of [V.x0, V.x1]) {
      if (k === YU_BRIDGE.lv) {
        rails.push({ y, a: [x, V.z0], b: [x, r2(YU_BRIDGE.z - YU_BRIDGE.w / 2)], face: 'void' })
        rails.push({ y, a: [x, r2(YU_BRIDGE.z + YU_BRIDGE.w / 2)], b: [x, V.z1], face: 'void' })
      } else rails.push({ y, a: [x, V.z0], b: [x, V.z1], face: 'void' })
    }
  }
  YU_STAIRS.forEach((s, i) => {
    const y = YU_LV[i + 1]
    const sx = Math.sign(s.x)
    const dir = Math.sign(s.to - s.from)
    const zStart = r2(s.from - dir * 0.2)
    const zOpen = r2(s.to - dir * 1.6)
    rails.push({ y, a: [sx * YU_HOLE_IN, zStart], b: [sx * YU_HOLE_IN, zOpen], face: 'hole' })
    rails.push({ y, a: [sx * YU_HOLE_IN, zStart], b: [sx * YU_IN.x, zStart], face: 'hole' })
  })
  return { slabs, rails }
})()
prop('jm_yutoya', 'jmYutoya', [YU.x, YU.z], [YU.w, 30, YU.d], {
  collider: false, elevation: TOP, signs: [{ text: '湯灯屋' }],
  yutoya: { lv: YU_LV, wt: YU.wt, base: YU.base, door: YU.door, doorH: YU.doorH, void: YU_VOID, pav: YU_PAV, bridge: YU_BRIDGE,
    stairs: YU_STAIRS, stairW: YU_STAIR_W, bath: YU_BATH, office: YU_OFFICE, pillars: YU_PILLARS, ...yuLayout },
})
{
  const at = (lx, lz) => [r2(YU.x + lx), r2(YU.z + lz)]
  const el = (y) => r2(TOP + y)
  const H = r2(YU_LV[5] + 0.4)
  const side = r2((YU.w - YU.door) / 2)
  const fz = r2(YU.d / 2 - YU.wt / 2)
  wall('jm_yutoya_base', at(0, 0), [YU.w + 1, YU.base, YU.d + 1], { elevation: TOP })
  for (let i = 0; i < 3; i++) wall(`jm_yutoya_step_${i + 1}`, at(0, r2(YU.d / 2 + 1.7 - i * 0.4)), [9, r2(0.2 * (i + 1)), 0.4], { elevation: TOP })
  // 뒷벽: 서쪽 모서리 목욕탕 문(YU_BATH.door)만 비움
  {
    const dr = YU_BATH.door
    const a0 = r2(dr.x - dr.w / 2)
    const a1 = r2(dr.x + dr.w / 2)
    wall('jm_yutoya_wall_back_w', at(r2((-YU.w / 2 + a0) / 2), -fz), [r2(a0 + YU.w / 2), H, YU.wt], { elevation: TOP })
    wall('jm_yutoya_wall_back_e', at(r2((a1 + YU.w / 2) / 2), -fz), [r2(YU.w / 2 - a1), H, YU.wt], { elevation: TOP })
    wall('jm_yutoya_wall_back_lintel', at(dr.x, -fz), [dr.w, r2(H - YU.base - dr.h), YU.wt], { elevation: el(YU.base + dr.h) })
  }
  wall('jm_yutoya_wall_w', at(r2(-(YU.w / 2 - YU.wt / 2)), 0), [YU.wt, H, YU.d], { elevation: TOP })
  wall('jm_yutoya_wall_e', at(r2(YU.w / 2 - YU.wt / 2), 0), [YU.wt, H, YU.d], { elevation: TOP })
  wall('jm_yutoya_wall_front_w', at(r2(-(YU.door / 2 + side / 2)), fz), [side, H, YU.wt], { elevation: TOP })
  wall('jm_yutoya_wall_front_e', at(r2(YU.door / 2 + side / 2), fz), [side, H, YU.wt], { elevation: TOP })
  wall('jm_yutoya_wall_lintel', at(0, fz), [YU.door, r2(H - YU.base - YU.doorH), YU.wt], { elevation: el(YU.base + YU.doorH) })
  // 층 바닥판 (홀·계단 자리는 뚫림) + 지붕판
  for (const s of yuLayout.slabs) {
    s.rects.forEach(([x0, z0, x1, z1], j) => wall(`jm_yutoya_f${s.lv + 1}_slab_${j + 1}`, at(r2((x0 + x1) / 2), r2((z0 + z1) / 2)), [r2(x1 - x0), 0.25, r2(z1 - z0)], { elevation: el(s.y - 0.25) }))
  }
  wall('jm_yutoya_roof_slab', at(0, 0), [YU.w, 0.3, YU.d], { elevation: el(YU_LV[5]) })
  // 난간 충돌
  yuLayout.rails.forEach((r, j) => {
    const [ax, az] = r.a
    const [bx, bz] = r.b
    const len = r2(Math.hypot(bx - ax, bz - az))
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az)
    wall(`jm_yutoya_rail_${j + 1}`, at(r2((ax + bx) / 2), r2((az + bz) / 2)), alongX ? [len, 1.1, 0.15] : [0.15, 1.1, len], { elevation: el(r.y) })
  })
  // 계단 (1→2층 … 4→5층)
  YU_STAIRS.forEach((s, i) => {
    const [fx, fz2] = at(s.x, s.from)
    const [tx, tz] = at(s.x, s.to)
    terrain.push({ type: 'stairs', id: `jm_yutoya_stairs_${i + 1}`, from: [fx, fz2, el(YU_LV[i])], to: [tx, tz, el(YU_LV[i + 1])], width: YU_STAIR_W })
  })
  // 홀을 가로지르는 아치 다리 (2층): 4토막 경사로 + 토막마다 난간 충돌
  {
    const b = YU_BRIDGE
    const y0 = YU_LV[b.lv]
    const x0 = YU_VOID.x0
    const len = YU_VOID.x1 - YU_VOID.x0
    const ah = (x) => r2(y0 + b.arch * Math.sin((Math.PI * (x - x0)) / len))
    const n = 4
    for (let i = 0; i < n; i++) {
      const xa = r2(x0 + (len * i) / n)
      const xb = r2(x0 + (len * (i + 1)) / n)
      const [lo, hi] = ah(xa) <= ah(xb) ? [xa, xb] : [xb, xa]
      const [lx, lz] = at(lo, b.z)
      const [hx, hz] = at(hi, b.z)
      terrain.push({ type: 'stairs', id: `jm_yutoya_bridge_ramp_${i + 1}`, from: [lx, lz, el(ah(lo))], to: [hx, hz, el(ah(hi))], width: r2(b.w - 0.5), smooth: true, walls: false })
      const low = Math.min(ah(xa), ah(xb))
      const high = Math.max(ah(xa), ah(xb))
      for (const s of [-1, 1]) wall(`jm_yutoya_bridge_rail_${s < 0 ? 'n' : 's'}${i + 1}`, at(r2((xa + xb) / 2), r2(b.z + s * (b.w / 2 - 0.08))), [r2(len / n + 0.1), r2(high - low + 1.1), 0.15], { elevation: el(low) })
    }
  }
  // 1층 가구 충돌: 누각, 접수대, 신발장, 탕 칸막이·나무 욕조
  wall('jm_yutoya_pavilion', at(0, r2((YU_PAV.z0 + YU_PAV.z1) / 2)), [r2(YU_PAV.x1 - YU_PAV.x0), r2(YU_LV[4] - YU.base), r2(YU_PAV.z1 - YU_PAV.z0)], { elevation: el(YU.base) })
  wall('jm_yutoya_counter', at(-8.6, 8.4), [3.4, 1.1, 0.9], { elevation: el(YU.base) })
  for (const s of [-1, 1]) wall(`jm_yutoya_shoes_${s < 0 ? 'w' : 'e'}`, at(s * 3.2, 10.1), [1.6, 1.3, 0.5], { elevation: el(YU.base) })
  // 뒤채 목욕탕: 바닥 단, 벽 3면, 번대 앞 칸막이, 번대, 나무 욕조, 가운데 둥근 욕조
  {
    const B = YU_BATH
    const cz = r2((B.z0 + B.z1) / 2)
    const dd = r2(B.z1 - B.z0)
    const wh = r2(YU.base + B.h)
    wall('jm_yutoya_bath_base', at(0, cz), [r2(B.x1 - B.x0 + 0.6), YU.base, dd], { elevation: TOP })
    wall('jm_yutoya_bath_wall_n', at(0, r2(B.z0 + 0.15)), [r2(B.x1 - B.x0), wh, 0.3], { elevation: TOP })
    wall('jm_yutoya_bath_wall_w', at(r2(B.x0 + 0.15), cz), [0.3, wh, dd], { elevation: TOP })
    wall('jm_yutoya_bath_wall_e', at(r2(B.x1 - 0.15), cz), [0.3, wh, dd], { elevation: TOP })
    wall('jm_yutoya_bath_part', at(r2((B.part.x0 + B.x1) / 2), B.part.z), [r2(B.x1 - B.part.x0), r2(B.h), 0.2], { elevation: el(YU.base) })
    wall('jm_yutoya_bath_counter', at(B.counter.x, B.counter.z), [B.counter.w, 1.15, B.counter.d], { elevation: el(YU.base) })
    B.tubs.forEach(([x, z, sz], i) => wall(`jm_yutoya_bath_tub_${i + 1}`, at(x, z), [sz, 0.9, sz], { elevation: el(YU.base) }))
    wall('jm_yutoya_bath_tub_center', at(B.center.x, B.center.z), [r2(B.center.r * 1.8), 1.0, r2(B.center.r * 1.8)], { elevation: el(YU.base) })
    light('jm_light_yutoya_bath', at(0, cz), { elevation: el(3) })
  }
  for (const [i, [x, z]] of YU_PILLARS.entries()) wall(`jm_yutoya_pillar_${i + 1}`, at(x, z), [0.45, r2(YU_LV[4] - YU.base), 0.45], { elevation: el(YU.base) })
  // 바깥: 현관 기둥 2개, 소나무 줄기 2개, 굴뚝 (그림은 jm_yutoya.jsx YuExterior와 같은 자리)
  for (const s of [-1, 1]) wall(`jm_yutoya_porch_pillar_${s < 0 ? 'w' : 'e'}`, at(s * 3.2, r2(YU.d / 2 + 3.0)), [0.5, r2(YU.base + YU.doorH + 0.9), 0.5], { elevation: TOP })
  wall('jm_yutoya_pine_e', at(11.2, r2(YU.d / 2 + 2.6)), [0.8, 6, 0.8], { elevation: TOP })
  wall('jm_yutoya_pine_w', at(-11.2, r2(YU.d / 2 + 2.4)), [0.8, 6, 0.8], { elevation: TOP })
  wall('jm_yutoya_chimney', at(r2(-YU.w / 2 - 1.6), r2(YU.d / 2 - 3)), [1.5, 30, 1.5], { elevation: TOP })
  // 5층 주인 집무실 가구: 책상·의자·벽난로·책장·항아리·문틀 기둥
  {
    const O = YU_OFFICE
    const e5 = el(YU_LV[4])
    wall('jm_yutoya_office_desk', at(...O.desk), [4.6, 1.0, 1.75], { elevation: e5 })
    wall('jm_yutoya_office_chair', at(...O.chair), [1.4, 2.8, 1.2], { elevation: e5 })
    wall('jm_yutoya_office_fire', at(...O.fire), [0.8, 1.7, 2.9], { elevation: e5 })
    O.bookcases.forEach(([x, z], i) => wall(`jm_yutoya_office_books_${i + 1}`, at(x, z), [0.6, 2.7, 2.6], { elevation: e5 }))
    O.vases.forEach(([x, z], i) => wall(`jm_yutoya_office_vase_${i + 1}`, at(x, z), [1.1, 1.9, 1.1], { elevation: e5 }))
    for (const s of [-1, 1]) wall(`jm_yutoya_office_door_${s < 0 ? 's' : 'n'}`, at(O.door[0], r2(O.door[1] - s * 1.3)), [0.3, 3.2, 0.3], { elevation: e5 })
  }
  // 조명 (가까운 것만 켜짐): 홀 1층·홀 위·연회장
  light('jm_light_yutoya_hall', at(0, 3), { elevation: el(2) })
  light('jm_light_yutoya_upper', at(0, 1), { elevation: el(10) })
  light('jm_light_yutoya_office', at(0, 0), { elevation: el(17) })
}
for (const [i, x] of [[1, -4], [2, 8]]) stoneLantern(`jm_ryokan_lantern_${i}`, [x, -172.6], { elevation: TOP })
prop('jm_ryokan_fox_w', 'jmFox', [-1, -173.2], [0.9, 1.8, 0.9], { mirror: true, elevation: TOP })
prop('jm_ryokan_fox_e', 'jmFox', [5, -173.2], [0.9, 1.8, 0.9], { elevation: TOP })
for (const [i, x] of [[1, -16], [2, 20]]) gasLamp(`jm_ryokan_lamp_${i}`, [x, -172], { elevation: TOP })
// 여관 옆·뒤 마당
tree('jm_ryokan_maple', 'jmMaple', [-16.5, -181], { elevation: TOP })
tree('jm_ryokan_sakura', 'jmSakura', [-15.5, -173.5], { elevation: TOP })
for (const [i, x, z, s] of [[1, -16, -192, 'jmMaple'], [2, 20, -192, 'jmGinkgo'], [3, -14, -206, 'jmSakura'], [4, 18, -206, 'jmMaple'], [6, -8, -218, 'jmSakura'], [7, 12, -218, 'jmMaple']]) tree(`jm_ryokan_back_tree_${i}`, s, [x, z], { elevation: TOP })
for (const [i, x, z] of [[1, -17, -200], [2, 21, -200], [3, -17, -214], [4, 21, -214]]) bamboo(`jm_ryokan_back_bamboo_${i}`, [x, z], { elevation: TOP })
light('jm_light_ryokan', [2, -174], { elevation: TOP })

// ─────────────────────────────────────────────
// 8. 옛 데이터에서 가져오는 것: 호수·서쪽 벚꽃 강변·BK 전망대 흔들다리
// ─────────────────────────────────────────────
terrain.push(...keep.terrain)
// 물수제비(옛 「초속 5센티미터」 체험)와 작품 포스터는 뺌 — 강변 풍경만 남김
props.push(...keep.props.filter((item) => item.id !== 'jm_skip_spot' && item.id !== 'jm_poster_byousoku_river'))

// ─────────────────────────────────────────────
// 9. (11/25) 명장면 마당 5곳 — 가게 사이 골목으로 들어가면 나오는 흰 회벽 마당 (맵 안)
//    예전: 계단 거리 가게 문 → 맵 밖 장면 공간 순간 이동 → (11/25 오전) 서쪽 운하 거리 → 지민 요청으로 운하 거리는 되돌리고
//    지민이 스크린샷에 동그라미 친 자리(계단 거리 양옆, 입구 양옆) 사이사이로 옮김
//      ① 토토로: 입구 서쪽, 마치야 골목(서1) 가게 사이 골목 남쪽 끝
//      ② 신사 계단: 계단 거리 셋째 단 서쪽 가게 사이 골목 → 내리막 계단 → 정원 북쪽
//      ③ 갈라진 바위: 계단 거리 첫째 단 서쪽 가게 사이 골목 → 짧은 계단 → 정원 남쪽 (옛 연못 자리)
//      ④ 건널목: 입구 동쪽, 전망 무대 길(동1 갈래) 끝, 새 가게 옆
//      ⑤ 온천: 계단 거리 둘째 단 동쪽 가게 사이 골목 → 도리이 계단 쉼터 → 내리막 계단 → 대나무 숲 동쪽
//    골목 바로 옆 가게가 그 장면과 같은 작품 가게(쿠폰) — shared/places.json 의 cafe
//    장면 그림은 jm_portal.jsx JmSceneRoom(inMap). 로컬 +z = 마당 문 쪽, rot은 그 방향을 맞추는 rotationDeg
// ─────────────────────────────────────────────
const ZONE_ORIGIN_Z = -85
const COURT_WALL = { h: 3.4, t: 0.5, gate: 4.4 }
const SCENES = [
  { n: 1, kind: 'totoro', c: [-27, 22.5], rot: 180, w: 30, d: 33, title: '명장면 ① 「이웃집 토토로」', sub: '비 오는 숲속 정류장', stamp: 'spot_jm_crossing', spot: [4, 2, 0] },
  { n: 2, kind: 'stairs', c: [-34, -97], rot: 90, w: 28, d: 28, title: '명장면 ② 「너의 이름은.」', sub: '노을 지는 붉은 난간 계단', stamp: 'spot_jm_stairs', spot: [0, -9, 4],
    stair: { z0: 4, z1: -6, h: 4, w: 4, top: 6 } },
  { n: 3, kind: 'rock', c: [-34, -66], rot: 90, w: 24, d: 28, title: '명장면 ③ 「귀멸의 칼날」', sub: '안개 숲의 갈라진 바위', stamp: 'spot_jm_shrine', spot: [2.5, -1, 0] },
  { n: 4, kind: 'crossing', c: [28, 28.5], rot: 180, w: 32, d: 21, title: '명장면 ④ 「초속 5센티미터」', sub: '벚꽃 날리는 철길 건널목', stamp: 'spot_jm_sakura_river', spot: [2.6, 1, 0] },
  { n: 5, kind: 'onsen', c: [47, -79.3], rot: -90, w: 30, d: 34, title: '명장면 ⑤ 「센과 치히로의 행방불명」', sub: '붉은 다리 건너 옛 온천 본관', stamp: 'spot_jm_onsen', spot: [0, -8.5, 0],
    bridge: { z: -4, len: 6, w: 3, water: 5 } },
]
// 같은 작품 가게: 계단 거리 마치야는 간판만 바꾸고, 입구 양옆은 새 마치야
const SCENE_SHOPS = [
  { id: 'shop_jm_donguri', scene: 1, build: { id: 'jm_shop_donguri', position: [-31.5, 0.6], rotationDeg: 180 }, sign: { text: 'どんぐり茶屋', bg: '#2f4a2a', fg: '#fdf6e3' } },
  { id: 'shop_jm_kumihimo', scene: 2, zaka: 'jm_zaka_shop_9', sign: { text: '組紐 結び屋', bg: '#7a1d3a', fg: '#fdf6e3' } },
  { id: 'shop_jm_fuji', scene: 3, zaka: 'jm_zaka_shop_3', sign: { text: '藤の花茶屋', bg: '#4b2e6b', fg: '#fdf6e3' } },
  { id: 'shop_jm_sakura', scene: 4, build: { id: 'jm_shop_sakuramochi', position: [23.5, 6], rotationDeg: 90 }, sign: { text: '桜餅 花便り', bg: '#b8476a', fg: '#fdf6e3' } },
  { id: 'shop_jm_manju', scene: 5, zaka: 'jm_zaka_shop_8', sign: { text: '湯けむり饅頭', bg: '#7c2d12', fg: '#fdf6e3' } },
]
const placePositions = {}
// 로컬 모서리 → 월드 모서리 이름 (지형 platform rails용)
function worldEdge(rot, local) {
  const dir = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[local] // 로컬 (x, z) 방향
  const a = (rot * Math.PI) / 180
  const wx = Math.round(dir[0] * Math.cos(a) + dir[1] * Math.sin(a))
  const wz = Math.round(-dir[0] * Math.sin(a) + dir[1] * Math.cos(a))
  return wz < 0 ? 'north' : wz > 0 ? 'south' : wx < 0 ? 'west' : 'east'
}
for (const sc of SCENES) {
  const L = (lx, lz) => rotate(sc.c, sc.rot, lx, lz)
  const { h: WH, t: WT, gate: GATE } = COURT_WALL
  // 둘레 담: 뒤(로컬 -z)·양옆(로컬 ±x)·앞(로컬 +z, 가운데 문)
  prop(`jm_court_${sc.n}_wall_back`, 'jmPlasterWall', L(0, -sc.d / 2 + WT / 2), [sc.w, WH, WT], { rotationDeg: sc.rot })
  for (const side of [-1, 1]) {
    prop(`jm_court_${sc.n}_wall_${side < 0 ? 'l' : 'r'}`, 'jmPlasterWall', L(side * (sc.w / 2 - WT / 2), 0), [sc.d, WH, WT], { rotationDeg: sc.rot + 90 })
    const piece = r2((sc.w - GATE) / 2)
    prop(`jm_court_${sc.n}_wall_front_${side < 0 ? 'l' : 'r'}`, 'jmPlasterWall', L(side * (GATE / 2 + piece / 2), sc.d / 2 - WT / 2), [piece, WH, WT], { rotationDeg: sc.rot })
    wall(`jm_court_${sc.n}_gate_post_${side < 0 ? 'l' : 'r'}`, L(side * (GATE / 2 - 0.3), sc.d / 2), [0.4, 4.2, 0.4], { rotationDeg: sc.rot })
  }
  prop(`jm_court_${sc.n}_gate`, 'jmCourtGate', L(0, sc.d / 2), [GATE - 0.6, 4.2, 0.6], { rotationDeg: sc.rot, collider: false, signs: [{ text: `${sc.title.split(' 「')[0]} ${sc.sub}` }] })
  // 장면 그림
  prop(`jm_scene_${sc.n}`, 'jmSceneRoom', sc.c, [16, 12, 16], {
    rotationDeg: sc.rot, collider: false, elevation: 0.02,
    room: { kind: sc.kind, title: sc.title, sub: sc.sub, w: sc.w, d: sc.d, inMap: true, ...(sc.stair && { stair: sc.stair }), ...(sc.bridge && { bridge: sc.bridge }) },
  })
  // 걷는 판정 (장면 로컬 → 구역 좌표)
  if (sc.kind === 'stairs') {
    const st = sc.stair
    terrain.push({ type: 'stairs', id: `jm_scene${sc.n}_stairs`, from: [...L(0, st.z0), 0], to: [...L(0, st.z1), st.h], width: st.w })
    const corners = [L(-6, st.z1), L(6, st.z1), L(-6, st.z1 - st.top), L(6, st.z1 - st.top)]
    const xs = corners.map((p) => p[0])
    const zs = corners.map((p) => p[1])
    terrain.push({ type: 'platform', id: `jm_scene${sc.n}_top`, rect: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], height: st.h, surface: 'stone',
      rails: ['north', 'west', 'east'].map((e) => ({ edge: worldEdge(sc.rot, e) })) })
    for (const side of [-1, 1]) for (const k of [0, 1, 2]) wall(`jm_scene${sc.n}_house_${side < 0 ? 'l' : 'r'}${k}`, L(side * (st.w / 2 + 3.6), st.z0 - 2.5 - k * 5.2), [5.6, 9, 4.6], { rotationDeg: sc.rot })
  }
  if (sc.kind === 'rock') wall(`jm_scene${sc.n}_rock`, L(0, -4.5), [3.6, 2.8, 3.6], { rotationDeg: sc.rot })
  if (sc.kind === 'onsen') {
    const b = sc.bridge
    for (const side of [-1, 1]) {
      const len = r2(sc.w / 2 - b.w / 2 - WT)
      wall(`jm_scene${sc.n}_water_${side < 0 ? 'l' : 'r'}`, L(side * (b.w / 2 + len / 2), b.z), [len, 1, b.water], { rotationDeg: sc.rot })
      for (const k of [0, 1, 2]) wall(`jm_scene${sc.n}_shop_${side < 0 ? 'l' : 'r'}${k}`, L(side * 5.4, 13 - k * 4.4), [4.6, 6, 4], { rotationDeg: sc.rot })
    }
    wall(`jm_scene${sc.n}_bathhouse`, L(0, b.z - b.len / 2 - 6), [13, 12, 6], { rotationDeg: sc.rot })
  }
  const [sx, sz] = L(sc.spot[0], sc.spot[1])
  placePositions[sc.stamp] = [sx, sc.spot[2], r2(sz + ZONE_ORIGIN_Z)]
}

// 골목: 가게 사이 → 마당 문
// ③ 첫째 단(1.2m) 서쪽 가게 사이(z -62.3) → 짧은 내리막 계단 → 꺾어서 마당 문(-20, -66)
terrain.push({ type: 'stairs', id: 'jm_alley3_stairs', from: [-14.5, -62.3, 0], to: [-11.5, -62.3, 1.2], width: 2.4 })
road('jm_alley3_a', 'stone', [-17, -62.3], [5, 0.06, 2.4])
road('jm_alley3_b', 'stone', [-18.3, -64.3], [2.4, 0.06, 4])
// ② 셋째 단(4.4m) 서쪽 가게 사이(z -96.3) → 내리막 계단이 곧장 마당 문(-20, -97)으로
terrain.push({ type: 'stairs', id: 'jm_alley2_stairs', from: [-20, -96.6, 0], to: [-11.5, -96.6, 4.4], width: 2.2 })
// ⑤ 둘째 단(3.3m) 동쪽 가게 사이(z -79.3) → 도리이 계단 쉼터(3.3m) 건너 → 내리막 계단 → 마당 문(30, -79.3)
terrain.push({ type: 'stairs', id: 'jm_alley5_stairs', from: [29.6, -79.3, 0], to: [21.5, -79.3, 3.3], width: 2.4 })
// ① 서1 골목(z -6)에서 가게 사이로 남쪽 → 마당 문(-27, 6)
road('jm_alley1', 'stone', [-26.6, 1], [3, 0.06, 10])
// ④ 전망 무대 길(x 28.6) 끝이 곧장 마당 문(28, 18)
road('jm_alley4', 'stone', [28.3, 16.8], [3, 0.06, 2.6])
for (const [id, p, e] of [['jm_alley3_lamp', [-15.2, -60.6], 0], ['jm_alley2_lamp', [-19.4, -94.8], 0], ['jm_alley5_lamp', [30.5, -77.4], 0], ['jm_alley1_lamp', [-24.6, 4.8], 0], ['jm_alley4_lamp', [25.8, 16.6], 0]]) {
  prop(id, 'jmTwinLamp', p, [1.1, 3.4, 0.4], { collider: [0.3, 3.4, 0.3], elevation: e })
}

// 가게: 새 마치야 + 계단 거리 마치야 간판 바꿈
for (const s of SCENE_SHOPS) {
  if (s.build) {
    buildings.push({ id: s.build.id, style: 'jmMachiya', position: s.build.position, size: [6, 6.5, 6], rotationDeg: s.build.rotationDeg, model: null, signs: [s.sign] })
    const a = (s.build.rotationDeg * Math.PI) / 180
    placePositions[s.id] = [r2(s.build.position[0] + Math.sin(a) * 4), 0, r2(s.build.position[1] + Math.cos(a) * 4 + ZONE_ORIGIN_Z)]
  } else {
    const b = buildings.find((x) => x.id === s.zaka)
    b.signs = [s.sign]
    const a = (b.rotationDeg * Math.PI) / 180
    placePositions[s.id] = [r2(b.position[0] + Math.sin(a) * 4.2), b.elevation ?? 0, r2(b.position[1] + Math.cos(a) * 4.2 + ZONE_ORIGIN_Z)]
  }
}

// 11/24: 애니 구역 계단은 모두 옆 돌 난간 벽 없이 (지민 요청, 스크린샷의 갈색 옆벽)
for (const item of terrain) if (item.type === 'stairs') item.walls = false

// 11/24 계단 겉모습 (jm_stairs.jsx): 기본은 A 자연석, 고개→골짜기 계단은 E 등불 계단 (11/25 여관 가는 계단은 다리로 바뀜)
//   지민이 시안 A~E 중 고름. 다른 시안(B 붉은 목조·C 이끼 정원·D 참배길)도 jm_stairs.jsx에 남아 있어 id만 넣으면 바꿀 수 있음
const STAIR_LOOK = { jm_pass_stairs: 'E' }
// 여관 안 계단은 목조 건물 안이라 B 붉은 목조
for (let k = 1; k <= 4; k++) STAIR_LOOK[`jm_yutoya_stairs_${k}`] = 'B'
// 명장면 ② 신사 계단은 밝은 화강암(D 참배길)
STAIR_LOOK.jm_scene2_stairs = 'D'
// 큰 다리 경사로는 다리 그림이 덮으므로 계단 겉모습을 입히지 않음
const STAIR_PREVIEW = Object.fromEntries(terrain.filter((t) => t.type === 'stairs' && !/^jm_(grand|yutoya)_bridge_ramp/.test(t.id)).map((t) => [t.id, STAIR_LOOK[t.id] ?? 'A']))
for (const st of terrain.filter((t) => t.type === 'stairs' && STAIR_PREVIEW[t.id])) {
  // 소품 위치 = 계단 시작점 (거리 컬링이 소품 위치 기준이라), dress 좌표는 그 점 기준 상대값
  const [ax, az, ah] = st.from
  const [bx, bz, bh] = st.to
  prop(`${st.id}_dress`, 'jmStairDress', [ax, az], [st.width, 1, 1], { collider: false, dress: { from: [0, 0, ah], to: [r2(bx - ax), r2(bz - az), bh], width: st.width, variant: STAIR_PREVIEW[st.id], stepHeight: st.stepHeight ?? 0.22 } })
}

// 11/24: 벽·울타리를 보고 있던 벤치 방향 바로잡기 (앞 = 로컬 +z)
//   대나무 숲 벤치 2개: 남쪽 장면 자리 2 마당 옹벽 → 북쪽 대나무 숲 / 도리이 계단 위 벤치: 바로 앞 북쪽 울타리 → 남쪽 계단
const BENCH_FACE = { jm_zaka_bench_bamboo_1: 180, jm_zaka_bench_bamboo_2: 180, jm_zaka_landing_bench: 0 }
for (const item of props) if (BENCH_FACE[item.id] !== undefined) item.rotationDeg = BENCH_FACE[item.id]

// 겹치는 id 검사
const ids = new Set()
for (const item of [...roads, ...terrain, ...buildings, ...props]) {
  if (ids.has(item.id)) throw new Error(`id 겹침: ${item.id}`)
  ids.add(item.id)
}
for (const item of props) if (item.style === null) delete item.style

const zone = {
  zoneId: 'JM',
  owner: '지민',
  name: '애니메이션',
  origin: [0, -85],
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

// (11/25) 명장면 스탬프·가게 자리를 shared/places.json 에 맞춰 씀 (좌표만, 이름·설명은 그 파일에서)
{
  const PLACES = join(here, '../../shared/places.json')
  const raw = readFileSync(PLACES, 'utf8')
  // 공용 파일이라 모양(줄바꿈·배열 한 줄)은 그대로 두고 해당 항목의 "position" 줄만 바꿈
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
