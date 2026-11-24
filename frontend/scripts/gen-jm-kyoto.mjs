// 애니메이션 구역(JM) 「유아카리초(湯灯町)」 교토 온천 마을 배치 생성기 — 담당: 지민
// 실행: node frontend/scripts/gen-jm-kyoto.mjs  →  frontend/src/game/data/zones/jm_anime.json 을 통째로 다시 씀
//
// 큰 틀 (구역 좌표, 북쪽 = z 마이너스)
//   남쪽 입구(0,40) → 천 개의 도리이 터널 → 수로를 낀 온천 거리(여관이 양쪽으로)
//   → 맵 뒷부분 산넨자카식 계단 거리(옛 데이터, 단 3개 1.5 → 4.5m) → 고개(6m)
//   → 골짜기(0m, 개울과 붉은 다리)로 내려갔다가 → 중턱(5m) → 꼭대기(10m) 큰 여관 「湯灯屋」
//   장면 자리(스탬프) 4곳: ① 계단 거리 첫 단 서쪽 골목 끝 ② 셋째 단 동쪽 골목 끝 ③ 골짜기 개울가 ④ 중턱 쉼터
//   작품은 아직 미정 → 지금은 빈 마당 + 간판(jmSceneSpot)만. 작품이 정해지면 여기에 장면 소품을 채움
//   수로 거리의 갈래 4개는 풍경만 남김(옛 애니 장면·스탬프는 11/23에 뺌): 서1 마치야 골목 / 동1 잡화점 + 전망 무대(BK 흔들다리)
//   / 서2 호수 → 벚꽃 강변 / 동2 대나무 숲 산책길
// 북쪽 끝은 hub.json 바닥을 60m 늘려서 구역 좌표 z -185까지 써요.
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
// 1. 남쪽 입구 광장 + 천 개의 도리이 터널 (z 40 → 5)
// ─────────────────────────────────────────────
road('jm_entry_path', 'stone', [0, 22], [4.2, 0.08, 36])
road('jm_entry_plaza', 'stone', [0, 30], [13, 0.06, 10])
prop('jm_town_stone', 'jmStoneMonument', [7.6, 31], [2.2, 2.6, 0.5], { rotationDeg: -35, signs: [{ text: '湯灯町' }] })
for (const [i, x, z] of [[1, -6.2, 26], [2, 6.2, 26], [3, -6.2, 35], [4, 6.2, 35]]) stoneLantern(`jm_entry_lantern_${i}`, [x, z])
prop('jm_entry_sign', 'jmArrowSign', [-7.5, 31], [1.6, 2.1, 0.2], { rotationDeg: 30, signs: [{ text: '온천 거리', dir: 'right' }, { text: '천 개의 도리이', dir: 'right' }] })

prop('jm_torii_tunnel', 'jmToriiTunnel', [0, 12], [3.8, 4.2, 14], { collider: false, count: 13 })
wall('jm_torii_tunnel_wall_w', [-2.8, 12], [1.6, 3, 14]) // 대나무까지 막아 터널 옆으로 새지 않게
wall('jm_torii_tunnel_wall_e', [2.8, 12], [1.6, 3, 14])
for (const [i, z] of [[1, 7], [2, 11.5], [3, 16]]) {
  bamboo(`jm_tunnel_bamboo_w${i}`, [-4.6, z])
  bamboo(`jm_tunnel_bamboo_e${i}`, [4.6, z])
}
for (const [i, x, z] of [[1, -8.5, 8], [2, 8.5, 9], [3, -10, 15.5], [4, 10.5, 16], [5, -9, 21.5], [6, 9.5, 22]]) {
  tree(`jm_entry_maple_${i}`, i % 3 === 0 ? 'jmSakura' : 'jmMaple', [x, z])
}

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
prop('jm_vending_tram', 'jmVendingRow', [-30, -2.6], [3, 1.9, 0.8], { rotationDeg: 180 })

// ─────────────────────────────────────────────
// 4. 서2 갈래: 호수 → 「초속 5미터」 벚꽃 강변 (호수·강은 옛 데이터 그대로)
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
const ZAKA_DROP = new Set(['jm_zaka_fence_t1_w', 'jm_zaka_fence_t1_w_2', 'jm_zaka_fence_t3_e', 'jm_zaka_fence_t3_e_2', 'jm_zaka_maple_10', 'jm_zaka_nodate', 'jm_zaka_bamboo_7'])
props.push(...keep.zaka.props.filter((item) => !ZAKA_DROP.has(item.id) && !/^jm_zaka_torii_\d/.test(item.id)).map(shiftZaka))
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
// 7-1. 장면 자리 ①②: 계단 거리 상점 사이 골목 → 같은 높이의 작은 마당
//      (울타리는 상점 틈 자리만 비우고 다시 놓음)
// ─────────────────────────────────────────────
const fence = (id, position, len, elevation, rotationDeg = 90) => prop(id, 'jmBambooFence', position, [len, 1.1, 0.1], { rotationDeg, elevation })
fence('jm_zaka_fence_t1_w_a', [-11.3, -58.25], 5.5, zh(1.5))
fence('jm_zaka_fence_t1_w_b', [-11.3, -68.05], 8.9, zh(1.5))
fence('jm_zaka_fence_t3_e_a', [11.3, -92.25], 5.5, zh(4.5))
fence('jm_zaka_fence_t3_e_b', [11.3, -102.3], 9.4, zh(4.5))
terrain.push({ type: 'platform', id: 'jm_scene1_yard', rect: [-22, -65.5, -11.5, -59], height: zh(1.5), surface: 'stone', rails: [{ edge: 'west' }, { edge: 'north' }, { edge: 'south' }] })
terrain.push({ type: 'platform', id: 'jm_scene2_yard', rect: [11.5, -100, 22, -93], height: zh(4.5), surface: 'stone', rails: [{ edge: 'east' }, { edge: 'north' }, { edge: 'south' }] })
const sceneSpot = (n, position, size, rotationDeg, elevation = 0) =>
  prop(`jm_scene_${n}`, 'jmSceneSpot', position, size, { rotationDeg, elevation, collider: false, signs: [{ text: `장면 자리 ${n}` }, { text: '작품 준비 중' }] })
sceneSpot(1, [-17, -62.25], [6, 0.1, 9], 90, zh(1.5))
sceneSpot(2, [17, -96.5], [6, 0.1, 9], -90, zh(4.5))

// ─────────────────────────────────────────────
// 7-2. 고개 (옛 꼭대기 단, 높이 6) — 북쪽으로 골짜기가 내려다보임
// ─────────────────────────────────────────────
const PASS = 6
fence('jm_pass_fence_n_w', [-7.05, -125.2], 8.9, PASS, 0)
fence('jm_pass_fence_n_e', [9.05, -125.2], 12.9, PASS, 0)
prop('jm_pass_stone', 'jmStoneMonument', [9, -110.5], [2, 2.4, 0.5], { rotationDeg: -20, elevation: PASS, signs: [{ text: '湯灯峠' }] })
for (const [i, x] of [[1, -4], [2, 4]]) stoneLantern(`jm_pass_lantern_${i}`, [x, -122.6], { elevation: PASS })
prop('jm_pass_bench', 'jmBench', [11.5, -118], [1.8, 0.5, 0.5], { rotationDeg: -90, elevation: PASS })
tree('jm_pass_maple', 'jmMaple', [12.5, -123], { elevation: PASS })
// 고개 → 골짜기 내리막 계단 (계단 거리와 반대로 북쪽으로 내려감)
terrain.push({ type: 'stairs', id: 'jm_pass_stairs', from: [0, -139, 0], to: [0, -125.4, PASS], width: 5 })
// (11/24) 계단 옆 난간(jmStairRail)은 뺌 — 애니 구역 계단은 모두 옆 가드 없이

// ─────────────────────────────────────────────
// 7-3. 골짜기 (높이 0): 동서로 흐르는 개울 + 붉은 다리, 양쪽 강가 집 → 장면 자리 ③
// ─────────────────────────────────────────────
prop('jm_valley_stream_w', 'jmCanal', [-24, -144], [6, 0.1, 44], { rotationDeg: 90, natural: true, collider: [5.2, 1, 44] })
prop('jm_valley_stream_e', 'jmCanal', [24, -144], [6, 0.1, 44], { rotationDeg: 90, natural: true, collider: [5.2, 1, 44] })
prop('jm_valley_stream_bridge', 'jmCanal', [0, -144], [6, 0.1, 4], { rotationDeg: 90, natural: true, collider: false, curb: false })
road('jm_valley_bridge', null, [0, -144], [3.2, 0.14, 7], { color: '#7a5236' })
prop('jm_valley_bridge_rail', 'jmBridgeRail', [0, -144], [3.2, 0.1, 7], { collider: false })
road('jm_valley_path_s', 'stone', [0, -138.5], [10, 0.06, 3])
road('jm_valley_path_n', 'stone', [-2, -150.5], [48, 0.06, 3])
for (const [i, x, z] of [[1, -3.8, -140.4], [2, 3.8, -140.4], [3, -3.8, -148.4], [4, 3.8, -148.4]]) gasLamp(`jm_valley_lamp_${i}`, [x, z])
prop('jm_valley_house_sw', 'jmMachiya', [-17, -133], [7, 7, 7], { rotationDeg: 180, signs: [{ text: '宿 せせらぎ', bg: '#2b2f4a', fg: '#f5efe0' }] })
prop('jm_valley_house_se', 'jmMachiya', [17, -133], [7, 7, 7], { rotationDeg: 180, sugidama: true, signs: [{ text: '甘味 川辺', bg: '#7c2d12', fg: '#fde68a' }] })
prop('jm_valley_house_nw', 'jmMachiya', [-38, -155], [7, 7, 7], { signs: [{ text: '蕎麦 谷風', bg: '#3f2a1d', fg: '#f5e6c8' }] })
for (const [i, x, z, s] of [[1, -30, -137, 'jmMaple'], [2, 30, -137, 'jmMaple'], [3, -8, -129, 'jmSakura'], [4, 8, -129, 'jmSakura'], [5, -46, -149, 'jmMaple'], [6, 44, -150, 'jmGinkgo'], [7, 34, -157, 'jmMaple']]) tree(`jm_valley_tree_${i}`, s, [x, z])
light('jm_light_valley', [0, -145])
sceneSpot(3, [20, -153.5], [12, 0.1, 8], 0)

// ─────────────────────────────────────────────
// 7-4. 중턱 (높이 5) → 장면 자리 ④, 그리고 꼭대기(높이 10) 큰 여관 「湯灯屋」
// ─────────────────────────────────────────────
// 여관 가는 계단 2개: 폭 5m, 옆 난간 벽 없이, 경사 약 22°(예전 24~29°)로 완만하게
const MID = 5
const TOP = 9
const RYOKAN_STAIR_W = 5
terrain.push({ type: 'stairs', id: 'jm_mid_stairs', from: [-24, -147.6, 0], to: [-24, -160, MID], width: RYOKAN_STAIR_W, walls: false })
terrain.push({ type: 'platform', id: 'jm_mid_terrace', rect: [-34, -170, 20, -160], height: MID, surface: 'stone', lights: true,
  rails: [{ edge: 'south', gaps: [[-26.5, -21.5]] }, { edge: 'west' }, { edge: 'east', gaps: [[-164.6, -161.4]] }, { edge: 'north', gaps: [[-20, 20]] }] })
bamboo('jm_mid_bamboo_1', [-31, -167.5], { elevation: MID })
bamboo('jm_mid_bamboo_2', [-31, -163], { elevation: MID })
tree('jm_mid_maple', 'jmMaple', [18, -167], { elevation: MID })
for (const [i, x] of [[1, -19.5], [2, 9.5]]) gasLamp(`jm_mid_lamp_${i}`, [x, -161.6], { elevation: MID })
sceneSpot(4, [-6, -165], [12, 0.1, 7], 0, MID)
terrain.push({ type: 'stairs', id: 'jm_top_stairs', from: [14, -160, MID], to: [14, -170, TOP], width: RYOKAN_STAIR_W, walls: false })
terrain.push({ type: 'platform', id: 'jm_ryokan_top', rect: [-20, -184.8, 24, -170], height: TOP, surface: 'stone', lights: true,
  rails: [{ edge: 'south', gaps: [[-18.3, -13.7], [11.5, 16.5]] }, { edge: 'west' }, { edge: 'east' }, { edge: 'north' }] })
// 11/24 계단 루트 늘리기 (한 길로만 오르지 않게)
//   ① 동쪽 꺾인 계단: 골짜기 동쪽 → 쉼참(높이 2.5) → 서쪽으로 꺾어 중턱 동쪽 끝
//   ② 서쪽 계단: 중턱 서쪽 → 꼭대기 서쪽 (가운데 계단과 나란히 하나 더)
road('jm_valley_path_ne', 'stone', [27, -150.5], [10, 0.06, 3])
terrain.push({ type: 'stairs', id: 'jm_east_stairs_1', from: [30, -152, 0], to: [30, -160, 2.5], width: 3 })
terrain.push({ type: 'platform', id: 'jm_east_landing', rect: [27, -166, 33, -160], height: 2.5, surface: 'stone', rails: [] })
terrain.push({ type: 'stairs', id: 'jm_east_stairs_2', from: [27, -163, 2.5], to: [20, -163, MID], width: 3 })
stoneLantern('jm_east_landing_lantern', [31.8, -165], { elevation: 2.5 })
prop('jm_east_landing_bench', 'jmBench', [31.6, -161.4], [1.8, 0.5, 0.5], { rotationDeg: -90, elevation: 2.5 })
terrain.push({ type: 'stairs', id: 'jm_west_top_stairs', from: [-16, -161.5, MID], to: [-16, -170, TOP], width: 4.4 })
// 건물(buildings)은 100m 밖에서 생략되므로 소품(props)으로 둠: 16m보다 큰 소품은 늘 그려져서 마을 어디서나 보임 (충돌은 size 그대로)
// 11/24: 1층은 들어갈 수 있는 로비 (모양은 jm_kyoto.jsx GrandRyokanLobby). 통째 충돌을 끄고 벽·가구 충돌을 따로 깖
// 11/24: 5층 고층 여관 (독자 디자인). 층마다 높이가 다르고, 안쪽 뒷벽을 따라 지그재그 나무 계단으로 꼭대기까지 오름
//   1층 로비(3.6) / 2층 객실(3.0) / 3층 대욕장(3.8) / 4층 연회장(3.2) / 5층 전망실(4.4). 모양은 jm_kyoto.jsx JmGrandRyokan
const GR_FLOORS = [
  { h: 3.6, kind: 'lobby' },
  { h: 3.0, kind: 'rooms' },
  { h: 3.8, kind: 'bath' },
  { h: 3.2, kind: 'banquet' },
  { h: 4.4, kind: 'view' },
]
const GR = { x: 2, z: -180, w: 22, d: 8, door: 2.4, floor: 0.6, wt: 0.25 }
const GR_BASE = GR_FLOORS.reduce((acc, f) => [...acc, r2(acc[acc.length - 1] + f.h)], [GR.floor]) // 층 바닥 높이 (마지막 = 지붕 아래)
const GR_TOTAL = GR_BASE[GR_BASE.length - 1]
// 안쪽 계단 자리: 뒷벽 따라 x -10.5 ~ -3.9, 나란한 두 줄 (폭 1.2씩). 위층 바닥은 이 자리만 뚫림
//   뒷줄(zA): 1→2층, 3→4층은 서쪽에서 동쪽으로 / 앞줄(zB): 2→3층, 4→5층은 동쪽에서 서쪽으로
//   (한 줄에서 지그재그로 겹치면 도착 직전에 위 계단 밑면에 머리가 걸림 → 줄을 나눔)
const GR_STAIR = { x0: -10.5, x1: -3.9, zA: -3.15, zB: -1.9, w: 1.2, holeX: [-10.75, -3.75], holeZ: [-3.75, -1.25] }
prop('jm_grand_ryokan', 'jmGrandRyokan', [GR.x, GR.z], [GR.w, r2(GR_TOTAL + 4), GR.d], {
  model: null, elevation: TOP, collider: false, enterable: true, signs: [{ text: '湯灯屋' }], floors: GR_FLOORS, stair: GR_STAIR,
})
{
  const at = (lx, lz) => [r2(GR.x + lx), r2(GR.z + lz)]
  const side = (GR.w - GR.door) / 2
  const fz = GR.d / 2 - GR.wt / 2
  const H = r2(GR_TOTAL + 0.4)
  wall('jm_grand_ryokan_base', at(0, 0), [GR.w + 1, GR.floor, GR.d + 1], { elevation: TOP })
  // 현관 앞 돌계단 3단 (그림: 0.2m씩)
  for (let i = 0; i < 3; i++) wall(`jm_grand_ryokan_step_${i + 1}`, at(0, GR.d / 2 + 1.6 - i * 0.4), [8, r2(0.2 * (i + 1)), 0.4], { elevation: TOP })
  wall('jm_grand_ryokan_wall_back', at(0, -fz), [GR.w, H, GR.wt], { elevation: TOP })
  wall('jm_grand_ryokan_wall_w', at(-(GR.w / 2 - GR.wt / 2), 0), [GR.wt, H, GR.d], { elevation: TOP })
  wall('jm_grand_ryokan_wall_e', at(GR.w / 2 - GR.wt / 2, 0), [GR.wt, H, GR.d], { elevation: TOP })
  wall('jm_grand_ryokan_wall_front_w', at(-(GR.door / 2 + side / 2), fz), [side, H, GR.wt], { elevation: TOP })
  wall('jm_grand_ryokan_wall_front_e', at(GR.door / 2 + side / 2, fz), [side, H, GR.wt], { elevation: TOP })
  wall('jm_grand_ryokan_wall_lintel', at(0, fz), [GR.door, r2(H - 3.3), GR.wt], { elevation: TOP + 3.3 })
  // 층마다: 바닥판(계단 자리만 뚫림) + 뚫린 곳 가장자리 낮은 나무 난간(떨어짐 방지, 계단 들어가는 쪽만 비움) + 아래층에서 올라오는 계단
  const [hx0, hx1] = GR_STAIR.holeX
  const [hz0, hz1] = GR_STAIR.holeZ
  const inner = GR.w / 2 - GR.wt
  const innerD = GR.d / 2 - GR.wt
  for (let k = 1; k < GR_BASE.length; k++) {
    const y = r2(TOP + GR_BASE[k] - 0.25)
    const top = k === GR_BASE.length - 1
    if (top) {
      wall('jm_grand_ryokan_roof_slab', at(0, 0), [GR.w, 0.3, GR.d], { elevation: y })
      continue
    }
    wall(`jm_grand_ryokan_f${k + 1}_slab_a`, at(0, r2((hz1 + innerD) / 2)), [r2(inner * 2), 0.25, r2(innerD - hz1)], { elevation: y })
    wall(`jm_grand_ryokan_f${k + 1}_slab_b`, at(r2((hx1 + inner) / 2), r2((hz0 + hz1) / 2)), [r2(inner - hx1), 0.25, r2(hz1 - hz0)], { elevation: y })
    // 아래층 계단(k-1)이 짝수면 동쪽(x1)에 도착, 홀수면 서쪽(x0)에 도착 → 도착하는 끝 1.4m만 난간을 비움
    const arriveEast = (k - 1) % 2 === 0
    const railFrom = arriveEast ? hx0 : hx0 + 1.6
    const railTo = arriveEast ? hx1 - 1.4 : hx1
    wall(`jm_grand_ryokan_f${k + 1}_rail`, at(r2((railFrom + railTo) / 2), hz1), [r2(railTo - railFrom), 1.0, 0.1], { elevation: r2(TOP + GR_BASE[k]) })
  }
  for (let k = 0; k < GR_FLOORS.length - 1; k++) {
    const east = k % 2 === 0 // 1층→2층은 서쪽에서 동쪽으로(뒷줄), 다음 층은 반대로(앞줄)
    const [sx, ex] = east ? [GR_STAIR.x0, GR_STAIR.x1] : [GR_STAIR.x1, GR_STAIR.x0]
    const lz = east ? GR_STAIR.zA : GR_STAIR.zB
    const [fx, fz2] = at(sx, lz)
    const [tx, tz] = at(ex, lz)
    terrain.push({ type: 'stairs', id: `jm_ryokan_in_stairs_${k + 1}`, from: [fx, fz2, r2(TOP + GR_BASE[k])], to: [tx, tz, r2(TOP + GR_BASE[k + 1])], width: GR_STAIR.w })
  }
  // 가구 충돌 (그림 자리와 같게). [이름, 층(0부터), x, z, 크기]
  const solids = [
    ['counter', 0, -6, 0.6, [3.2, 1.1, 0.85]],
    ['irori', 0, 4.4, -0.9, [1.4, 1.2, 1.4]],
    ['shoes_w', 0, -2.6, 3.45, [1.4, 1.2, 0.5]],
    ['shoes_e', 0, 2.6, 3.45, [1.4, 1.2, 0.5]],
    ['bench', 0, 6.6, 3.3, [2.6, 0.5, 0.5]],
    ['fridge', 0, 10.3, 3.25, [0.7, 1.6, 0.6]],
    ['f3_tub', 2, 4.5, -0.8, [7.4, 0.65, 4.2]],
    ['f4_stage', 3, 8.9, -0.6, [3.2, 0.35, 5.4]],
  ]
  for (const [name, f, lx, lz, size] of solids) wall(`jm_grand_ryokan_${name}`, at(lx, lz), size, { elevation: r2(TOP + GR_BASE[f]) })
}
for (const [i, x] of [[1, -4], [2, 8]]) stoneLantern(`jm_ryokan_lantern_${i}`, [x, -172.6], { elevation: TOP })
prop('jm_ryokan_fox_w', 'jmFox', [-1, -173.6], [0.9, 1.8, 0.9], { mirror: true, elevation: TOP })
prop('jm_ryokan_fox_e', 'jmFox', [5, -173.6], [0.9, 1.8, 0.9], { elevation: TOP })
for (const [i, x] of [[1, -16], [2, 20]]) gasLamp(`jm_ryokan_lamp_${i}`, [x, -172], { elevation: TOP })
tree('jm_ryokan_maple', 'jmMaple', [-16.5, -181], { elevation: TOP })
tree('jm_ryokan_sakura', 'jmSakura', [20.5, -181], { elevation: TOP })
light('jm_light_ryokan', [2, -174], { elevation: TOP })

// ─────────────────────────────────────────────
// 8. 옛 데이터에서 가져오는 것: 호수·서쪽 벚꽃 강변·BK 전망대 흔들다리
// ─────────────────────────────────────────────
terrain.push(...keep.terrain)
// 물수제비(옛 「초속 5미터」 체험)와 작품 포스터는 뺌 — 강변 풍경만 남김
props.push(...keep.props.filter((item) => item.id !== 'jm_skip_spot' && item.id !== 'jm_poster_byousoku_river'))

// 11/24: 애니 구역 계단은 모두 옆 돌 난간 벽 없이 (지민 요청, 스크린샷의 갈색 옆벽)
for (const item of terrain) if (item.type === 'stairs') item.walls = false

// 11/24 계단 겉모습 (jm_stairs.jsx): 기본은 A 자연석, 여관 쪽으로 가는 긴 계단(고개→골짜기, 골짜기→중턱, 중턱→꼭대기)은 E 등불 계단
//   지민이 시안 A~E 중 고름. 다른 시안(B 붉은 목조·C 이끼 정원·D 참배길)도 jm_stairs.jsx에 남아 있어 id만 넣으면 바꿀 수 있음
const STAIR_LOOK = { jm_pass_stairs: 'E', jm_mid_stairs: 'E', jm_top_stairs: 'E', jm_east_stairs_1: 'E', jm_east_stairs_2: 'E', jm_west_top_stairs: 'E' }
// 여관 안 계단은 목조 건물 안이라 B 붉은 목조
for (let k = 1; k <= 4; k++) STAIR_LOOK[`jm_ryokan_in_stairs_${k}`] = 'B'
const STAIR_PREVIEW = Object.fromEntries(terrain.filter((t) => t.type === 'stairs').map((t) => [t.id, STAIR_LOOK[t.id] ?? 'A']))
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
