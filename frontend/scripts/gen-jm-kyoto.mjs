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

// ─────────────────────────────────────────────
// 1. 남쪽 입구 광장 + 붉은 탑 터널 (z 40 → -8.4)
//    영화 첫 장면: 숲길 끝 붉은 회벽 건물(탑) 아래 아치 → 어두운 굴(위는 풀 언덕) → 색유리 빛 대합실 → 풀밭
//    그림: jm_tunnel.jsx JmTunnelGate (로컬 +z = 남쪽). (11/25 지민 요청) 터널을 1.6배로 키우고 입구 광장·숲을 넓힘
//    구역 입구(0,40)는 다른 구역과 이어지는 자리라 그대로 → 터널을 북쪽으로 밀어 공간을 만듦
// ─────────────────────────────────────────────
road('jm_entry_plaza', 'stone', [0, 30], [22, 0.06, 14])
road('jm_entry_path', 'stone', [0, 21.6], [6.4, 0.08, 3])
prop('jm_town_stone', 'jmStoneMonument', [11.5, 31], [2.2, 2.6, 0.5], { rotationDeg: -35, signs: [{ text: '湯灯町' }] })
for (const [i, x, z] of [[1, -9.2, 25.5], [2, 9.2, 25.5], [3, -9.2, 35], [4, 9.2, 35]]) stoneLantern(`jm_entry_lantern_${i}`, [x, z])
prop('jm_entry_sign', 'jmArrowSign', [-11.5, 31], [1.6, 2.1, 0.2], { rotationDeg: 30, signs: [{ text: '붉은 터널', dir: 'right' }, { text: '음식점 거리', dir: 'right' }] })

const TUN_Z = 6
const TUN_S = 1.6 // 터널 그림·판정 배율 (jm_tunnel.jsx TUNNEL 숫자 × TUN_S)
const ts = (n) => r2(n * TUN_S)
prop('jm_tunnel_gate', 'jmTunnelGate', [0, TUN_Z], [ts(20), ts(16), ts(18)], { collider: false, scale: TUN_S })
for (const s of [-1, 1]) {
  const k = s < 0 ? 'w' : 'e'
  wall(`jm_tunnel_gate_${k}`, [s * ts(4.4), r2(TUN_Z + ts(6))], [ts(5.2), ts(8.2), ts(6)])
  wall(`jm_tunnel_tube_${k}`, [s * ts(2.0), TUN_Z], [ts(0.4), ts(4), ts(6)])
  wall(`jm_tunnel_mound_${k}`, [s * ts(5.6), TUN_Z], [ts(6.8), ts(3), ts(6)])
  wall(`jm_tunnel_hall_${k}`, [s * ts(4.8), r2(TUN_Z - ts(6))], [ts(0.4), ts(5.2), ts(6)])
  wall(`jm_tunnel_hall_back_${k}`, [s * ts(3.4), r2(TUN_Z - ts(3.3))], [ts(3.2), ts(5.2), ts(0.6)])
  wall(`jm_tunnel_hall_front_${k}`, [s * ts(3.4), r2(TUN_Z - ts(8.7))], [ts(3.2), ts(5.2), ts(0.6)])
}
const TUN_FRONT = r2(TUN_Z + ts(9))
const TUN_BACK = r2(TUN_Z - ts(9))
// (사진 참고) 석상은 아치 바로 오른쪽, 건물 둘레는 우거진 숲·덤불
prop('jm_tunnel_statue', 'jmTwoFaceStatue', [3.7, r2(TUN_FRONT + 1)], [0.9, 1.8, 0.9], { collider: [0.8, 1.8, 0.8] })
for (const [i, x, z] of [[1, -16, 16], [2, 16.5, 15], [3, -14.5, 24], [4, 15.5, 25], [5, -20, 8], [6, 20.5, 6]]) prop(`jm_tunnel_bush_${i}`, 'jmFlowerBush', [x, z], [3.6, 2.4, 3.2], { seed: 9 + i, green: true, collider: [2.6, 2, 2.2] })
for (const [i, x, z, r] of [[1, -7.8, 22.4, 20], [2, 8.4, 22.6, -15], [3, -5, 37.6, 0]]) prop(`jm_tunnel_hokora_${i}`, 'jmStoneHokora', [x, z], [0.8, 1.1, 0.7], { rotationDeg: r })
for (const [i, x, z] of [[5, -14, 20.5], [6, 14.5, 21], [7, -19, 12], [8, 19.5, 10.5], [9, -18, 29], [10, 19, 30], [11, -24, 20], [12, 24, 22], [13, -22, 3], [14, 22.5, 1], [15, -26, 34], [16, 26, 35]]) {
  tree(`jm_entry_maple_${i}`, i % 3 === 0 ? 'jmSakura' : 'jmMaple', [x, z])
}
light('jm_light_tunnel', [0, TUN_Z])
light('jm_light_entry', [0, 30])

// ─────────────────────────────────────────────
// 2. 풀밭 언덕 (z -8.4 → -28): 터널을 나오면 바람 부는 초록 언덕, 군데군데 돌 사당
//    언덕은 풍경(올라가지 않음, 가운데만 막음). 가운데 흙길이 강으로
// ─────────────────────────────────────────────
road('jm_field_path', 'stone', [0, -18.2], [3.4, 0.06, 19.6], { color: '#a8946e' })
for (const [i, x, z, w, h, d] of [
  [1, -30, -16, 26, 5, 16], [2, -58, -16, 24, 4, 14], [3, 20, -20, 20, 3.5, 10], [4, -82, -14, 28, 5, 16],
  [5, -14, -24, 10, 2.2, 6], [7, -44, 4, 18, 3.5, 12],
]) prop(`jm_field_hill_${i}`, 'jmGrassHill', [x, z], [w, h, d], { collider: [r2(w * 0.62), r2(h * 0.8), r2(d * 0.62)], color: i % 2 ? '#6f9a4e' : '#7ea657' })
for (const [i, x, z, r] of [[4, -4, -12, 15], [5, 4.2, -17, -20], [6, -4.6, -23, 10], [7, 5, -26, -5], [8, -9, -19, 30], [9, 8.5, -11, -30]]) {
  prop(`jm_field_hokora_${i}`, 'jmStoneHokora', [x, z], [0.8, 1.1, 0.7], { rotationDeg: r })
}
for (const [i, x, z, s] of [[1, -14, -5, 'jmMaple'], [2, 12, -26.5, 'jmSakura'], [3, -30, -26.5, 'jmMaple'], [4, 34, -26.5, 'jmMaple'], [5, -60, -4, 'jmSakura']]) tree(`jm_field_tree_${i}`, s, [x, z])
for (const [i, x, z, r] of [[1, 16, -13, -10], [2, -36, -6, 15], [3, 22, -3, 25]]) prop(`jm_field_hut_${i}`, 'jmFieldHut', [x, z], [4.2, 3, 3.6], { rotationDeg: r })
prop('jm_field_sign', 'jmArrowSign', [3.4, -10.5], [1.6, 2.1, 0.2], { rotationDeg: -20, signs: [{ text: '음식점 거리', dir: 'left' }, { text: '전망 무대', dir: 'right' }] })
light('jm_light_field', [0, -18])

// 전망 무대 (BK 전망대 흔들다리와 이어짐 — 자리·높이 그대로)
road('jm_field_east', 'stone', [16.3, -10], [24.6, 0.06, 3], { color: '#a8946e' })
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
// 3. 강 + 징검돌 (z -28 → -50, 폭 22m — 11/25 지민 요청으로 넓힘): 가운데 4m만 징검돌로 건넘 (나머지는 물이 막음)
// ─────────────────────────────────────────────
const RIVER = { z: -39, w: 22 }
for (const [k, cx, len] of [['w', -65, 126], ['e', 65, 126]]) {
  prop(`jm_river_${k}`, 'jmCanal', [cx, RIVER.z], [RIVER.w, 0.1, len], { rotationDeg: 90, natural: true, collider: [RIVER.w - 0.8, 1, len] })
}
prop('jm_river_ford', 'jmCanal', [0, RIVER.z], [RIVER.w, 0.1, 4], { rotationDeg: 90, natural: true, collider: false, curb: false })
for (let i = 0; i < 10; i++) {
  road(`jm_river_stone_${i + 1}`, null, [i % 2 ? -0.5 : 0.5, r2(RIVER.z + RIVER.w / 2 - 1.3 - i * 2.15)], [1.5, 0.3, 1.2], { color: '#8d877c' })
}

// ─────────────────────────────────────────────
// 4. 긴 돌계단 (0 → 6m) + 마을 입구 문
// ─────────────────────────────────────────────
const TOWN = 6
// (11/25 거리 장면 참고) 넓은 돌계단 + 계단 옆 큰 소나무
terrain.push({ type: 'stairs', id: 'jm_town_stairs', from: [0, -50.2, 0], to: [0, -60, TOWN], width: 12 })
prop('jm_town_pine', 'jmBigTree', [10.5, -55], [7, 14, 7], { collider: [1.2, 8, 1.2] })
prop('jm_town_gate', 'jmTownGate', [0, -62.5], [13, 8, 1], { elevation: TOWN, collider: false, signs: [{ text: '灯籠横丁' }] })
for (const s of [-1, 1]) wall(`jm_town_gate_pillar_${s < 0 ? 'w' : 'e'}`, [s * 6.1, -62.5], [0.8, 8, 0.8], { elevation: TOWN })
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
terrain.push({ type: 'platform', id: 'jm_town_east', rect: [16, -108, 95, -76], height: T_E, surface: 'stone',
  rails: [{ edge: 'west', gaps: [[-93, -87]] }, { edge: 'north' }, { edge: 'south' }] })
terrain.push({ type: 'stairs', id: 'jm_town_stairs_n', from: [0, -93, TOWN], to: [0, -97, T_N], width: 10 })
terrain.push({ type: 'stairs', id: 'jm_town_stairs_w', from: [-12, -90, TOWN], to: [-16, -90, T_W], width: 6 })
terrain.push({ type: 'stairs', id: 'jm_town_stairs_e', from: [10, -90, TOWN], to: [16, -90, T_E], width: 6 })
for (const s of [-1, 1]) terrain.push({ type: 'stairs', id: `jm_alley_stairs_${s < 0 ? 'w' : 'e'}`, from: [s * 19.5, -125, TOWN], to: [s * 15.5, -125, T_N], width: 3 })
road('jm_town_main_s', 'stone', [0, -78], [10, 0.06, 36], { elevation: TOWN })
road('jm_town_main_n', 'stone', [0, -123.5], [10, 0.06, 53], { elevation: T_N })
road('jm_town_cross', 'stone', [0, -90], [32, 0.06, 6], { elevation: TOWN })

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
    seed: n, floors: fl, look: look ?? ['pastel', 'wood', 'retro', 'pastel', 'wood'][n % 5], sign: sign ?? { text: name, bg, fg }, noren, vsign: vs,
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
  eatery(`jm_eat_w${i + 1}`, [-10, z], 90, { elevation })
  eatery(`jm_eat_e${i + 1}`, [10, z], -90, { elevation })
})
// 가로 거리 양쪽 (남쪽 줄 앞면 북쪽 = 180, 북쪽 줄 = 0): 서쪽 단 7.2 / 동쪽 단 8.4
const ARM_X = [21, 30, 39, 48, 57]
ARM_X.forEach((x, i) => {
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'w' : 'e'
    const elevation = s < 0 ? T_W : T_E
    eatery(`jm_eat_arm_${k}s${i + 1}`, [s * x, -82], 180, { elevation })
    eatery(`jm_eat_arm_${k}n${i + 1}`, [s * x, -98], 0, { elevation })
  }
})
for (const s of [-1, 1]) {
  const k = s < 0 ? 'w' : 'e'
  // ②③ 골목 양옆 뒷줄 (골목을 보고 섬)
  eatery(`jm_eat_back_${k}a`, [s * 20.5, -115], 180, { w: 10, d: 12 })
  eatery(`jm_eat_back_${k}b`, [s * 20.5, -133], 0, { w: 10, d: 12 })
  // 마을 남쪽 끝 (풀밭에서 올려다보이는 앞면, 난간과 겹치지 않게 1.5m 안쪽) + 바깥쪽 큰 건물
  ;[-30, -44, -58, -72].forEach((x, i) => eatery(`jm_eat_edge_${k}${i + 1}`, [s * -x, -68.5], 0, { w: 11, d: 11, floors: 3, h: 12.5 }))
  if (s < 0) [-115, -127, -139].forEach((z, i) => eatery(`jm_eat_far_${k}${i + 1}`, [s * 64, z], 90, { w: 10, d: 12, floors: 3, h: 13 }))
}
// 큰길·가로 거리 위 등 줄
for (const [z, e] of [[-69.5, TOWN], [-78.5, TOWN], [-105.5, T_N], [-114.5, T_N], [-135.5, T_N]]) prop(`jm_lantern_line_${-z}`, 'jmLanternLine', [0, z], [10, 5.4], { elevation: e, collider: false })
for (const x of [25.5, 34.5, 43.5, 52.5]) for (const s of [-1, 1]) prop(`jm_lantern_line_x${s < 0 ? 'w' : 'e'}${x}`, 'jmLanternLine', [s * x, -90], [6, 5.4], { rotationDeg: 90, elevation: s < 0 ? T_W : T_E, collider: false })
for (const [i, z, e] of [[1, -64, TOWN], [2, -88, TOWN], [3, -112, T_N], [4, -140, T_N]]) light(`jm_light_town_${i}`, [0, z], { elevation: e })
for (const s of [-1, 1]) light(`jm_light_town_arm_${s < 0 ? 'w' : 'e'}`, [s * 40, -90], { elevation: s < 0 ? T_W : T_E })
// 다리 앞 광장 (북쪽 단)
for (const s of [-1, 1]) {
  gasLamp(`jm_plaza_lamp_${s < 0 ? 'w' : 'e'}`, [s * 4.2, -143], { elevation: T_N })
  stoneLantern(`jm_plaza_lantern_${s < 0 ? 'w' : 'e'}`, [s * 7.5, -145], { elevation: T_N })
}

// (11/25 지민이 보낸 주먹밥 장면 참고) 다리 앞 동쪽 정원: 꽃 핀 키 큰 덤불 울타리, 풀밭, 흙길, 배추밭, 빨간 지붕 창고
//   다리 앞 광장 동쪽 계단(7.4 → 6)으로 내려가 흙길을 따라감
terrain.push({ type: 'stairs', id: 'jm_garden_stairs', from: [19.5, -147, TOWN], to: [15.5, -147, T_N], width: 3 })
road('jm_garden_lawn', 'grass', [76, -129], [37, 0.04, 40], { elevation: r2(TOWN + 0.05) })
road('jm_garden_path', null, [38.5, -147], [38, 0.06, 2.4], { elevation: TOWN, color: '#a8946e' })
road('jm_garden_path_n', null, [66, -129], [2.4, 0.06, 34], { elevation: TOWN, color: '#a8946e' })
for (const [i, x, z, len, r] of [[1, 76, -110.5, 30, 0], [2, 82, -123, 18, 0], [3, 59.5, -122, 16, 90], [4, 72.5, -138, 10, 90], [5, 84, -146, 16, 0], [6, 92, -130, 24, 90]]) {
  prop(`jm_garden_hedge_${i}`, 'jmHedge', [x, z], [len, 2.4, 1.6], { rotationDeg: r, elevation: TOWN, seed: i })
}
prop('jm_garden_veggies', 'jmVeggiePatch', [82, -135], [14, 0.5, 8], { elevation: TOWN, collider: false })
for (const [i, x, z, r] of [[1, 86, -116.5, 0], [2, 74, -117, 0]]) prop(`jm_garden_shed_${i}`, 'jmShed', [x, z], [6, 4.2, 5], { rotationDeg: r, elevation: TOWN })
tree('jm_garden_sakura', 'jmSakura', [62, -143], { elevation: TOWN })
tree('jm_garden_maple', 'jmMaple', [90, -142], { elevation: TOWN })
light('jm_light_garden', [76, -130], { elevation: TOWN })

// ─────────────────────────────────────────────
// 6. 다른 작품 명장면 ①~④ — 담 없이 거리 사이사이 빈터에 (11/25 지민 요청: 담이 세트장 같다 → 뺌, 자리를 섞고 높이도 다르게)
//    ① 토토로: 가로 거리 서쪽 단 끝 (7.2) / ④ 건널목: 가로 거리 동쪽 단 끝 (8.4)
//    ② 신사 계단: 큰길 서쪽 가게 사이 골목(z -125) 끝 (6) / ③ 갈라진 바위: 동쪽 골목 끝 (6)
//    장면 그림은 jm_portal.jsx JmSceneRoom(inMap). 로컬 +z = 골목·거리 쪽
// ─────────────────────────────────────────────
const SCENES = [
  { n: 1, kind: 'totoro', c: [-78, -92], rot: 90, w: 30, d: 28, e: T_W, title: '명장면 ① 「이웃집 토토로」', sub: '비 오는 숲속 정류장', stamp: 'spot_jm_crossing', spot: [4, 2, 0] },
  { n: 2, kind: 'stairs', c: [-37, -125], rot: 90, w: 22, d: 22, e: TOWN, title: '명장면 ② 「너의 이름은.」', sub: '노을 지는 붉은 난간 계단', stamp: 'spot_jm_stairs', spot: [0, -9, 4],
    stair: { z0: 4, z1: -6, h: 4, w: 4, top: 6 } },
  { n: 3, kind: 'rock', c: [40, -126], rot: -90, w: 24, d: 26, e: TOWN, title: '명장면 ③ 「귀멸의 칼날」', sub: '안개 숲의 갈라진 바위', stamp: 'spot_jm_shrine', spot: [2.5, -1, 0] },
  { n: 4, kind: 'crossing', c: [79, -92], rot: -90, w: 30, d: 21, e: T_E, title: '명장면 ④ 「초속 5센티미터」', sub: '벚꽃 날리는 철길 건널목', stamp: 'spot_jm_sakura_river', spot: [2.6, 1, 0] },
]
// 같은 작품 가게(쿠폰): 장면 바로 옆 음식점 간판을 바꿈. ⑤는 다리 앞 마지막 가게
const SCENE_SHOPS = [
  { id: 'shop_jm_donguri', eat: 'jm_eat_arm_wn5', sign: { text: 'どんぐり茶屋', bg: '#2f4a2a', fg: '#fdf6e3' } },
  { id: 'shop_jm_kumihimo', eat: 'jm_eat_w6', sign: { text: '組紐 結び屋', bg: '#7a1d3a', fg: '#fdf6e3' } },
  { id: 'shop_jm_fuji', eat: 'jm_eat_e6', sign: { text: '藤の花茶屋', bg: '#4b2e6b', fg: '#fdf6e3' } },
  { id: 'shop_jm_sakura', eat: 'jm_eat_arm_en5', sign: { text: '桜餅 花便り', bg: '#b8476a', fg: '#fdf6e3' } },
  { id: 'shop_jm_manju', eat: 'jm_eat_e8', sign: { text: '湯けむり饅頭', bg: '#7c2d12', fg: '#fdf6e3' } },
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
  prop(`jm_scene_${sc.n}_sign`, 'jmArrowSign', L(sc.w / 2 - 2.5, sc.d / 2 - 1.2), [1.6, 2.1, 0.2], { rotationDeg: sc.rot + 15, ...E, signs: [{ text: `${sc.title.split(' 「')[0]}`, dir: 'right' }, { text: sc.sub, dir: 'right' }] })
  prop(`jm_scene_${sc.n}`, 'jmSceneRoom', sc.c, [16, 12, 16], {
    rotationDeg: sc.rot, collider: false, elevation: r2(sc.e + 0.02),
    room: { kind: sc.kind, title: sc.title, sub: sc.sub, w: sc.w, d: sc.d, inMap: true, open: true, ...(sc.stair && { stair: sc.stair }) },
  })
  if (sc.kind === 'stairs') {
    const st = sc.stair
    terrain.push({ type: 'stairs', id: `jm_scene${sc.n}_stairs`, from: [...L(0, st.z0), sc.e], to: [...L(0, st.z1), sc.e + st.h], width: st.w })
    const corners = [L(-6, st.z1), L(6, st.z1), L(-6, st.z1 - st.top), L(6, st.z1 - st.top)]
    const xs = corners.map((p) => p[0])
    const zs = corners.map((p) => p[1])
    terrain.push({ type: 'platform', id: `jm_scene${sc.n}_top`, rect: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], height: sc.e + st.h, surface: 'stone',
      rails: ['north', 'west', 'east'].map((e) => ({ edge: worldEdge(sc.rot, e) })) })
    for (const side of [-1, 1]) for (const k of [0, 1, 2]) wall(`jm_scene${sc.n}_house_${side < 0 ? 'l' : 'r'}${k}`, L(side * (st.w / 2 + 3.6), st.z0 - 2.5 - k * 5.2), [5.6, 9, 4.6], { rotationDeg: sc.rot, ...E })
  }
  if (sc.kind === 'rock') wall(`jm_scene${sc.n}_rock`, L(0, -4.5), [3.6, 2.8, 3.6], { rotationDeg: sc.rot, ...E })
  const [sx, sz] = L(sc.spot[0], sc.spot[1])
  placePositions[sc.stamp] = toWorld([sx, sc.e + sc.spot[2], sz])
}
// 골목 쌍둥이 등
for (const [id, p, e] of [['jm_alley2_lamp', [-22.6, -123.2], TOWN], ['jm_alley3_lamp', [22.6, -123.2], TOWN], ['jm_alley1_lamp', [-62.4, -88], T_W], ['jm_alley4_lamp', [63.4, -88], T_E]]) {
  prop(id, 'jmTwinLamp', p, [1.1, 3.4, 0.4], { collider: [0.3, 3.4, 0.3], elevation: e })
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
const PIER = { x0: -32, x1: -10, z0: -164, z1: -159.4, h: 0.75 }
const TRAIN = { x: -21, z: -158, len: 11, w: 2.6, floor: 0.9 }
for (const [k, x0, x1, z0, z1] of [
  ['s_w', -128, PIER.x0, -164, -152], ['s_e', PIER.x1, 128, -164, -152], ['s_m', PIER.x0, PIER.x1, -152, -155.4],
  ['w', -128, DOCK.x0, DOCK.z0, DOCK.z1], ['e', DOCK.x1, 128, DOCK.z0, DOCK.z1],
  ['nw', -128, ISLAND.x0, ISLAND.z0, ISLAND.z1], ['ne', ISLAND.x1, 128, ISLAND.z0, ISLAND.z1],
]) {
  const w = r2(z1 - z0)
  const len = r2(x1 - x0)
  prop(`jm_sea_${k}`, 'jmCanal', [r2((x0 + x1) / 2), r2((z0 + z1) / 2)], [w, 0.1, len], { rotationDeg: 90, curb: false, collider: [w, 1, len] })
}
prop('jm_sea_rail', 'jmSeaRail', [0, TRAIN.z], [3, 0.3, 250], { rotationDeg: 90, collider: false, submerged: true })
road('jm_pier', null, [r2((PIER.x0 + PIER.x1) / 2), r2((PIER.z0 + PIER.z1) / 2)], [r2(PIER.x1 - PIER.x0), PIER.h, r2(PIER.z1 - PIER.z0)], { color: '#8d877c' })
prop('jm_pier_sign', 'jmStationSign', [-30.5, -162], [1.6, 2.4, 0.3], { rotationDeg: 0, elevation: PIER.h, signs: [{ text: '湯灯駅' }] })
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
road('jm_dock', null, [-22, -166], [28, 0.12, 4], { color: '#6b4a30' })
road('jm_dock_w', null, [-34.5, -173.5], [3, 0.12, 11], { color: '#6b4a30' })
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
terrain.push({ type: 'platform', id: 'jm_ryokan_top', rect: [ISLAND.x0, ISLAND.z0, ISLAND.x1, ISLAND.z1], height: TOP, surface: 'grass', lights: true,
  rails: [{ edge: 'south', gaps: [[-3, 3], [-36, -33]] }, { edge: 'west' }, { edge: 'east' }, { edge: 'north' }] })
const YU = { x: 0, front: -185, w: 48, d: 38, wt: 0.3, base: 0.6, door: 3.2, doorH: 4.2 }
YU.z = r2(YU.front - YU.d / 2)
const YU_LV = [0.6, 7.6, 12.4, 17.2, 22.0, 27.6]
const YU_IN = { x: r2(YU.w / 2 - YU.wt), z: r2(YU.d / 2 - YU.wt) }
const YU_VOID = { x0: -9, x1: 9, z0: -8, z1: 7.5 }
const YU_PAV = { x0: -3, x1: 3, z0: -8, z1: -4 }
const YU_BRIDGE = { z: 1.0, w: 2.4, arch: 1.0, lv: 1 }
const YU_STAIR_W = 2.0
const YU_STAIRS = [
  { x: 16, from: 8, to: -8 },
  { x: -16, from: -5.5, to: 5.5 },
  { x: 16, from: 5.5, to: -5.5 },
  { x: -16, from: -5.5, to: 5.5 },
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
    stairs: YU_STAIRS, stairW: YU_STAIR_W, bath: YU_BATH, rooms: YU_ROOMS, elev: YU_ELEV, guest: YU_GUEST, office: YU_OFFICE, pillars: YU_PILLARS, ...yuLayout },
})
{
  const at = (lx, lz) => [r2(YU.x + lx), r2(YU.z + lz)]
  const el = (y) => r2(TOP + y)
  const H = r2(YU_LV[5] + 0.4)
  const side = r2((YU.w - YU.door) / 2)
  const fz = r2(YU.d / 2 - YU.wt / 2)
  wall('jm_yutoya_base', at(0, 0), [YU.w + 1, YU.base, YU.d + 1], { elevation: TOP })
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
    const [fx, fz2] = at(s.x, s.from)
    const [tx, tz] = at(s.x, s.to)
    terrain.push({ type: 'stairs', id: `jm_yutoya_stairs_${i + 1}`, from: [fx, fz2, el(YU_LV[i])], to: [tx, tz, el(YU_LV[i + 1])], width: YU_STAIR_W })
  })
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
    B.tubs.forEach(([x, z, sz], i) => wall(`jm_yutoya_bath_tub_${i + 1}`, at(x, z), [sz, 0.9, sz], { elevation: el(YU.base) }))
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
  prop('jm_yutoya_sign_elev', 'jmArrowSign', at(18.4, -11), [1.6, 2.1, 0.2], { elevation: el(YU.base), rotationDeg: 180, signs: [{ text: '직원용 엘리베이터', dir: 'right' }, { text: '집무실·보일러실', dir: 'right' }] })
  prop('jm_yutoya_sign_lobby', 'jmArrowSign', at(6, 15.4), [1.6, 2.1, 0.2], { elevation: el(YU.base), rotationDeg: 200, signs: [{ text: '손님 엘리베이터 ↑ 연회장', dir: 'left' }, { text: '목욕탕', dir: 'right' }] })
  light('jm_light_yutoya_hall', at(0, 3), { elevation: el(2) })
  light('jm_light_yutoya_upper', at(0, 1), { elevation: el(12) })
  light('jm_light_yutoya_office', at(0, -4), { elevation: el(24) })
  light('jm_light_yutoya_mosaic', at(18, 0), { elevation: el(24) })
  light('jm_light_yutoya_rooms', at(0, 13), { elevation: el(14) })
}
// 섬 정원: 현관 앞 돌길, 양옆 정원(풀밭 + 꽃덤불 + 나무 + 가스등), 서쪽 끝에서 선착장으로 내려가는 바깥 계단
prop('jm_ryokan_fox_w', 'jmFox', [-6.2, -148.4], [0.9, 1.8, 0.9], { mirror: true, elevation: T_N })
prop('jm_ryokan_fox_e', 'jmFox', [6.2, -148.4], [0.9, 1.8, 0.9], { elevation: T_N })
road('jm_ryokan_path', 'stone', [0, -182], [4, 0.06, 6], { elevation: TOP })
road('jm_ryokan_path_w', 'gardenPath', [-17.5, -180.4], [33, 0.06, 2], { elevation: TOP })
for (const s of [-1, 1]) road(`jm_ryokan_path_side_${s < 0 ? 'w' : 'e'}`, 'gardenPath', [s * 29.5, -202], [2, 0.06, 40], { elevation: TOP })
for (const [i, x, z] of [[1, -27, -181.6], [2, 27, -181.6], [3, -32.5, -200], [4, 32.5, -200], [5, -32.5, -216], [6, 32.5, -216]]) gasLamp(`jm_ryokan_lamp_${i}`, [x, z], { elevation: TOP })
const GARDEN_FLOWERS = [[-26.5, -192], [-26.5, -206], [-26.5, -218], [-33.5, -195], [-33.5, -209], [26.5, -192], [26.5, -206], [26.5, -218], [33.5, -195], [33.5, -209], [-20, -224], [20, -224]]
GARDEN_FLOWERS.forEach(([x, z], i) => prop(`jm_flower_${i + 1}`, 'jmFlowerBush', [x, z], [2.6, 1.5, 2.2], { elevation: TOP, seed: i, collider: [1.8, 1.2, 1.6] }))
for (const [i, x, z, s] of [[1, -33.5, -187.5, 'jmSakura'], [2, 33.5, -187.5, 'jmMaple'], [3, -33.5, -203, 'jmMaple'], [4, 33.5, -203, 'jmSakura'], [5, -33.5, -219, 'jmGinkgo'], [6, 33.5, -219, 'jmMaple']]) tree(`jm_ryokan_tree_${i}`, s, [x, z], { elevation: TOP })
prop('jm_ryokan_sign_stairs', 'jmArrowSign', [-31.5, -181.9], [1.6, 2.1, 0.2], { elevation: TOP, rotationDeg: 20, signs: [{ text: '보일러실', dir: 'left' }, { text: '선착장·전차', dir: 'left' }] })
light('jm_light_ryokan', [0, -182], { elevation: TOP })
light('jm_light_ryokan_garden', [-30, -205], { elevation: TOP })

// ─────────────────────────────────────────────
// 9. 바깥 계단 → 물가 보일러실 (높이 0) + 엘리베이터
//   섬 앞마당 서쪽 끝(x -34.5)에서 벼랑을 따라 내려가는 긴 나무 계단 → 나무 선착장 → 보일러실 문 (섬 아래 바다 높이)
// ─────────────────────────────────────────────
terrain.push({ type: 'stairs', id: 'jm_boiler_stairs', from: [-34.5, -165, 0], to: [-34.5, -179, TOP], width: 3 })
const BOIL = { c: [-21, -173.5], w: 22, h: 6, d: 11, door: { x: -7, w: 2.2, h: 3 }, furnace: [-2, -3], drawers: [5, -5.1, 7], deck: [5, -3.2, 6, 2.4], chimney: [-8, -4.6, 42], elev: [8, 2.6] }
{
  const at = (lx, lz) => [r2(BOIL.c[0] + lx), r2(BOIL.c[1] + lz)]
  prop('jm_boiler', 'jmBoilerRoom', BOIL.c, [BOIL.w, BOIL.h, BOIL.d], {
    collider: false, boiler: { door: BOIL.door, furnace: BOIL.furnace, drawers: BOIL.drawers, deck: BOIL.deck, chimney: BOIL.chimney },
  })
  const front = BOIL.d / 2 - 0.2
  const a = BOIL.door.x - BOIL.door.w / 2
  const b = BOIL.door.x + BOIL.door.w / 2
  wall('jm_boiler_wall_w', at(r2(-BOIL.w / 2 + 0.2), 0), [0.4, BOIL.h, BOIL.d])
  wall('jm_boiler_wall_e', at(r2(BOIL.w / 2 - 0.2), 0), [0.4, BOIL.h, BOIL.d])
  wall('jm_boiler_wall_front_w', at(r2((-BOIL.w / 2 + a) / 2), front), [r2(a + BOIL.w / 2), BOIL.h, 0.4])
  wall('jm_boiler_wall_front_e', at(r2((b + BOIL.w / 2) / 2), front), [r2(BOIL.w / 2 - b), BOIL.h, 0.4])
  wall('jm_boiler_wall_lintel', at(BOIL.door.x, front), [BOIL.door.w, r2(BOIL.h - BOIL.door.h), 0.4], { elevation: BOIL.door.h })
  wall('jm_boiler_roof', at(0, 0), [BOIL.w, 0.3, BOIL.d], { elevation: BOIL.h })
  wall('jm_boiler_furnace', at(...BOIL.furnace), [5, 4, 2.6])
  wall('jm_boiler_drawers', at(BOIL.drawers[0], BOIL.drawers[1]), [r2(BOIL.drawers[2] + 0.3), BOIL.h, 0.8])
  wall('jm_boiler_deck', at(BOIL.deck[0], BOIL.deck[1]), [BOIL.deck[2], 0.6, BOIL.deck[3]])
  wall('jm_boiler_chimney', at(BOIL.chimney[0], BOIL.chimney[1]), [1.8, BOIL.chimney[2], 1.8])
  light('jm_light_boiler', at(0, 0), { elevation: 3 })
  for (const s of [-1, 1]) wall(`jm_boiler_elev_side_${s < 0 ? 'n' : 's'}`, at(BOIL.elev[0], r2(BOIL.elev[1] + s * (YU_ELEV.w / 2 + 0.06))), [YU_ELEV.w, YU_ELEV.h, 0.12])
}
// (11/25 지민이 보낸 사진 참고) 온천장이 물에서부터 솟은 것처럼: 지대 남쪽 벼랑(z -186)에 붉은 아래층 외벽 + 초록 처마
prop('jm_yutoya_lower', 'jmYuLowerFacade', [14, -178.7], [44, TOP, 0.6], { collider: false })
// 엘리베이터: 보일러실(B) ↔ 1~5층. 칸마다 같은 정류장 목록, me만 다름
{
  const yuAt = (k) => toWorld([YU.x + YU_ELEV.x, TOP + YU_LV[k] + 0.05, YU.z + YU_ELEV.z])
  const stops = [
    { key: 'B', label: '보일러실 (직원용)', sign: '釜場', pos: toWorld([BOIL.c[0] + BOIL.elev[0], 0.15, BOIL.c[1] + BOIL.elev[1]]) },
    { key: '1', label: '1층 로비·목욕탕', sign: '一階', pos: yuAt(0) },
    { key: '2', label: '2층 연회장 松の間', sign: '二階', pos: yuAt(1) },
    { key: '3', label: '3층 연회장 竹の間', sign: '三階', pos: yuAt(2) },
    { key: '4', label: '4층 연회장 梅の間', sign: '四階', pos: yuAt(3) },
    { key: '5', label: '5층 주인의 방', sign: '五階', pos: yuAt(4) },
  ]
  const cab = (id, position, elevation, me) => prop(id, 'jmElevator', position, [YU_ELEV.w, YU_ELEV.h, YU_ELEV.w], {
    rotationDeg: -90, collider: false, elevation, elevator: { me, stops, kind: 'staff' },
  })
  cab('jm_elev_b', [r2(BOIL.c[0] + BOIL.elev[0]), r2(BOIL.c[1] + BOIL.elev[1])], 0.1, 'B')
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
const STAIR_LOOK = { jm_town_stairs: 'E', jm_boiler_stairs: 'B', jm_scene2_stairs: 'D' }
for (let k = 1; k <= 4; k++) STAIR_LOOK[`jm_yutoya_stairs_${k}`] = 'B'
const STAIR_PREVIEW = Object.fromEntries(terrain.filter((t) => t.type === 'stairs' && !/^jm_(grand|yutoya)_bridge_ramp/.test(t.id)).map((t) => [t.id, STAIR_LOOK[t.id] ?? 'A']))
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
