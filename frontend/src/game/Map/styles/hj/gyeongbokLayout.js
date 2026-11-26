// [2. 설계 > 화면 설계] 압축 경복궁 배치 (혜진 영화·드라마 구역)
// 실제 경복궁 안내도(광화문 → 흥례문 → 근정문 → 근정전 → 사정전 → 강녕전 → 교태전, 서쪽 경회루·수정전, 동쪽 동궁·자경전·향원정)를
// 약 74 × 103m 땅에 맞게 줄인 배치예요. 뒤쪽(후원)에는 향원정·건청궁·태원전과 소나무 숲이 있어요.
//
// 좌표계 "A": ax = 궁궐 가운데 축(x = -8)에서 좌우 거리, az = 궁궐 깊이 방향 거리.
//   - 근정전 아이템(haewol_palace)이 az = PALACE_ORIGIN_Z 자리에 있어요. 구역 z = 아이템 z + (az - PALACE_ORIGIN_Z).
//   - 구역 입구에서 들어오면 광화문이 맨 앞, az가 커질수록 궁궐 깊숙한 곳이에요.
// 이 파일 하나로 3D 모양(HjGyeongbokPalace.jsx)과 충돌 박스(hj_drama.json의 gb_* 항목)를 만들어요.
// 배치를 바꾸면 충돌 박스도 다시 만들어야 해요 (만드는 방법은 HjGyeongbokPalace.jsx 맨 위 설명 참고).

export const AXIS_X = 0 // 궁궐 가운데 축 (구역 좌표 x)
export const PALACE_ORIGIN_Z = -14 // haewol_palace 아이템 위치 z (근정전 실내·착석 좌표의 기준)

// 담장 바깥 테두리
export const BOUNDS = { minX: -37, maxX: 37, minZ: -31, maxZ: 72 }
export const WALL_H = 2.4
export const WALL_T = 1

// 광화문: 석축(무지개문 3개) + 2층 문루
export const GWANGHWAMUN = { az: -31, width: 13.3, depth: 2.5, title: '광화문' }
// 무지개문 사이 기둥(지나갈 수 없는 부분) x 범위
export const GWANGHWAMUN_PIERS = [
  [-6.65, -4.97],
  [-2.83, -1.45],
  [1.45, 2.83],
  [4.97, 6.65],
]

// 담장 (지나갈 수 없음). [시작ax, 시작az, 끝ax, 끝az]
export const WALLS = [
  // 앞 담장 (광화문 양옆)
  [-37, -31, -6.65, -31],
  [6.65, -31, 37, -31],
  // 옆 담장 (영추문·건춘문 자리 3m 비움)
  [-37, -31, -37, -22.5],
  [-37, -19.5, -37, 72],
  [37, -31, 37, -22.5],
  [37, -19.5, 37, 72],
  // 뒤 담장 (신무문 자리 3.2m 비움)
  [-37, 72, -1.6, 72],
  [1.6, 72, 37, 72],
  // 흥례문 줄 (가운데 흥례문 9m)
  [-14, -25.8, -4.5, -25.8],
  [4.5, -25.8, 14, -25.8],
  // 침전(강녕전·교태전)과 후원 사이 담장 (가운데 4m 비움)
  [-14, 45.6, -2, 45.6],
  [2, 45.6, 14, 45.6],
]

// plain: 단청 없는 나무색 백골집(건청궁·소주방) · lattice: 창살(tti 띠살 / bit 빗살 / jeongja 정자살)
// solid 전각은 모두 들어갈 수 있어요 (가운데 칸 문 열림). furnish: 실내 살림 (throne 편전 / kitchen 소주방 / 기본 room 침전)
// 구조 옵션: bays 정면 칸 수 · base 기단 높이 · roof 지붕(hipgable 팔작 / hip 우진각 / gable 맞배)
//            mode(gate 대문) · upper 2층 · woldae 앞 월대 깊이 · ridge:false 용마루 없음(무량각) · japsang 잡상 수
export const HALLS = [
  { id: 'heungnyemun', title: '흥례문', ax: 0, az: -25.8, w: 9, d: 3.2, h: 2.6, mode: 'gate', bays: 3, sideBays: 2, base: 0.15, roof: 'hip', upper: true, japsang: 5 },
  { id: 'geunjeongmun', title: '근정문', ax: 0, az: -19.5, w: 8.6, d: 4.1, h: 2.74, mode: 'gate', bays: 3, sideBays: 2, base: 0.15, roof: 'hip', upper: true, japsang: 5 },
  // 사정전(편전): 천장이 높고 네 벽이 모두 창호(정자살 + 초록 머름 + 빗살 교창), 안은 돗자리·어탑·일월오봉도·운룡도
  { id: 'sajeongjeon', title: '사정전', ax: 0, az: 18.25, w: 10.5, d: 6, h: 3.8, bays: 5, base: 0.5, roof: 'hipgable', japsang: 5, furnish: 'throne', windows: 'all', lattice: 'jeongja', latticeBar: '#8f8a7e', merumColor: '#3c6b55', solid: true },
  // 강녕전·교태전: 왕과 왕비의 침전. 용마루 없는 무량각 지붕 + 앞에 넓은 월대
  { id: 'gangnyeongjeon', title: '강녕전', ax: 0, az: 29, w: 12.5, d: 5.0, h: 3.0, bays: 7, base: 0.5, roof: 'hipgable', ridge: false, woldae: 1.4, solid: true },
  { id: 'gyotaejeon', title: '교태전', ax: 0, az: 39.1, w: 11, d: 4.6, h: 3.0, bays: 7, base: 0.5, roof: 'hipgable', ridge: false, woldae: 1.4, solid: true },
  { id: 'sujeongjeon', title: '수정전', ax: -26, az: -16.5, w: 12, d: 4.8, h: 2.8, bays: 7, base: 0.6, roof: 'hipgable', woldae: 1.6, solid: true },
  { id: 'donggung', title: '자선당', ax: 26, az: -14, w: 12, d: 5, h: 2.8, bays: 7, base: 0.45, roof: 'hipgable', solid: true },
  { id: 'jagyeongjeon', title: '자경전', ax: 27, az: 34, w: 12, d: 5, h: 2.8, bays: 7, base: 0.45, roof: 'hipgable', solid: true },
  // 넓힌 양옆: 동궁 비현각 · 소주방(궁중 부엌) · 흥복전
  { id: 'bihyeongak', title: '비현각', ax: 26, az: -5, w: 10, d: 4.5, h: 2.6, bays: 5, base: 0.4, roof: 'hipgable', solid: true },
  { id: 'sojubang', title: '소주방', ax: 27, az: 18, w: 11, d: 4.5, h: 2.5, bays: 5, base: 0.3, roof: 'gable', ornate: false, plain: true, lattice: 'jeongja', furnish: 'kitchen', solid: true },
  { id: 'heungbokjeon', title: '흥복전', ax: -26, az: 38, w: 13, d: 5, h: 2.9, bays: 7, base: 0.5, roof: 'hipgable', solid: true },
  // 후원: 건청궁(향원정 북쪽) · 태원전(서북쪽)
  { id: 'geoncheonggung', title: '건청궁', ax: 16, az: 66, w: 12, d: 4.4, h: 2.6, bays: 7, base: 0.35, roof: 'hipgable', ornate: false, plain: true, lattice: 'jeongja', solid: true },
  { id: 'taewonjeon', title: '태원전', ax: -24, az: 60, w: 13, d: 5, h: 2.9, bays: 7, base: 0.5, roof: 'hipgable', solid: true },
  // 옆·뒤 문 (열린 문)
  { id: 'yeongchumun', title: '영추문', ax: -37, az: -21, w: 3.6, d: 1.8, h: 2.3, mode: 'gate', bays: 1, sideBays: 1, base: 0, roof: 'hip', ornate: false, rotation: 90 },
  { id: 'geonchunmun', title: '건춘문', ax: 37, az: -21, w: 3.6, d: 1.8, h: 2.3, mode: 'gate', bays: 1, sideBays: 1, base: 0, roof: 'hip', ornate: false, rotation: 90 },
  { id: 'sinmumun', title: '신무문', ax: 0, az: 72, w: 4.4, d: 1.8, h: 2.3, mode: 'gate', bays: 1, sideBays: 1, base: 0, roof: 'hip', ornate: false },
]

// 근정전을 둘러싼 행각(회랑). 가운데 벽을 두고 양쪽이 트인 복도(복랑) — 걸어 들어가 지나다닐 수 있어요.
// 근정전 월대(±9)에서 넉넉히 떨어지게 바깥(±15.5)으로 넓혔어요
export const CORRIDORS = [
  { id: 'cloister_w', ax: -15.5, az: -4.75, w: 29.5, d: 2.4, h: 2.3, rotation: 90 },
  { id: 'cloister_e', ax: 15.5, az: -4.75, w: 29.5, d: 2.4, h: 2.3, rotation: 90 },
  { id: 'cloister_fw', ax: -9.75, az: -19.5, w: 9.9, d: 2.4, h: 2.3 },
  { id: 'cloister_fe', ax: 9.75, az: -19.5, w: 9.9, d: 2.4, h: 2.3 },
  { id: 'cloister_bw', ax: -8.75, az: 10, w: 13.9, d: 2.4, h: 2.3 },
  { id: 'cloister_be', ax: 8.75, az: 10, w: 13.9, d: 2.4, h: 2.3 },
]

// 연못: 경회루(서쪽, 큰 네모 연못) · 향원정(동쪽 뒤, 둥근 섬)
export const PONDS = [
  { id: 'gyeonghoeru_pond', ax: -26, az: 16, w: 17, d: 18 },
  { id: 'hyangwon_pond', ax: 12, az: 54, w: 14, d: 12 },
]

// 경회루: 연못 가운데 장대석 축대(섬) 위, 돌기둥 48개(바깥 네모 24 + 안쪽 둥근 24) 위에 올린 2층 누각.
// 정면 7칸(연못 az 방향) × 옆 5칸. 동쪽(궁궐 쪽)으로 돌다리 3개. 축대 윗면이 마당 높이와 같아 걸어서 건너가요
export const GYEONGHOERU = {
  ax: -26,
  az: 16,
  w: 8.4, // ax 방향 (옆 5칸)
  d: 11, // az 방향 (정면 7칸)
  platform: [10.6, 13.8], // 축대 [ax 방향, az 방향]
  pillarH: 2.4, // 아래층 돌기둥 높이
  upperH: 2.5, // 위층 나무 기둥 높이
  bridges: [-4, 0, 4], // 돌다리 az 위치 (경회루 가운데 기준)
  bridgeW: 1.8,
}

// 돌기둥 48개 위치 [ax, az, 바깥 네모기둥?]
export function gyeonghoeruPillars() {
  const { ax, az, w, d } = GYEONGHOERU
  const list = []
  for (let i = 0; i <= 5; i += 1) {
    for (let j = 0; j <= 7; j += 1) {
      const outer = i === 0 || i === 5 || j === 0 || j === 7
      list.push([ax - w / 2 + 0.3 + (i * (w - 0.6)) / 5, az - d / 2 + 0.3 + (j * (d - 0.6)) / 7, outer])
    }
  }
  return list
}

// 경회루 축대 둘레 돌난간 (돌다리 자리 비움) [시작ax, 시작az, 끝ax, 끝az]
export function gyeonghoeruRails() {
  const { ax, az, platform, bridges, bridgeW } = GYEONGHOERU
  const x0 = ax - platform[0] / 2 + 0.15
  const x1 = ax + platform[0] / 2 - 0.15
  const z0 = az - platform[1] / 2 + 0.15
  const z1 = az + platform[1] / 2 - 0.15
  const segs = [
    [x0, z0, x1, z0],
    [x0, z1, x1, z1],
    [x0, z0, x0, z1],
  ]
  let z = z0
  for (const b of bridges) {
    segs.push([x1, z, x1, az + b - bridgeW / 2])
    z = az + b + bridgeW / 2
  }
  segs.push([x1, z, x1, z1])
  return segs
}

// ── 경회루 2층 (걸어서 올라가요) ──
// 마루 윗면 높이 (마당 바닥 0.17 기준, 월드 y)
export const GYEONGHOERU_DECK_Y = 0.17 + 2.4 + 0.32
// 나무 계단: 축대 남·북 끝에서 서쪽으로 올라가요 (경회루 가운데 기준 x, 월드 y)
export const GYEONGHOERU_STAIR = { xBottom: 1.7, xTop: -1.8, zOff: 6.05, width: 0.8, steps: 18 }
// 마루 둘레 난간 (계단 꼭대기 자리 비움) — 월드 A 좌표 [x0, z0, x1, z1]
export function gyeonghoeruDeckRails() {
  const { ax, az, w, d } = GYEONGHOERU
  const x = w / 2 + 0.18
  const z = d / 2 + 0.18
  const S = GYEONGHOERU_STAIR
  const local = [
    [x, -z, x, z],
    [-x, -z, -x, z],
    [-x, -z, S.xTop - 0.2, -z],
    [S.xTop + 1.1, -z, x, -z],
    [-x, z, S.xTop - 0.2, z],
    [S.xTop + 1.1, z, x, z],
  ]
  return local.map(([a, b, c, e]) => [ax + a, az + b, ax + c, az + e])
}
// 2층 안쪽 칸(내진) 둘레: 기둥 위치 + 칸마다 양옆 좁은 창살 칸막이 (가운데는 문을 들어 올려 열려 있어요)
// 바깥 기둥에서 한 칸 들어온 자리 (옆 5칸 중 1~4, 정면 7칸 중 1~6)
export function gyeonghoeruInnerRing() {
  const { ax, az, w, d } = GYEONGHOERU
  const xs = Array.from({ length: 6 }, (_, i) => -(w / 2 - 0.1) + (i * (w - 0.2)) / 5)
  const zs = Array.from({ length: 8 }, (_, j) => -(d / 2 - 0.1) + (j * (d - 0.2)) / 7)
  const x0 = xs[1]
  const x1 = xs[4]
  const z0 = zs[1]
  const z1 = zs[6]
  const cols = []
  for (const x of xs.slice(1, 5)) cols.push([ax + x, az + z0], [ax + x, az + z1])
  for (const z of zs.slice(2, 6)) cols.push([ax + x0, az + z], [ax + x1, az + z])
  // 칸 [시작, 끝] (경회루 기준 로컬) — 양옆 0.32m 창살 칸막이
  const bays = []
  for (let i = 1; i < 4; i += 1) for (const z of [z0, z1]) bays.push({ a: [xs[i], z], b: [xs[i + 1], z] })
  for (let j = 1; j < 6; j += 1) for (const x of [x0, x1]) bays.push({ a: [x, zs[j]], b: [x, zs[j + 1]] })
  return { cols, bays, rect: [x0, x1, z0, z1] }
}

// 향원정: 둥근 섬 위 육각 2층 정자. 북쪽 건청궁 쪽으로 나무다리(취향교)
// 1층은 남쪽 문으로 들어가 볼 수 있어요 (기단 0.42m → 앞 디딤돌로 올라가요)
// h1·h2: 1층·2층 기둥 높이 (사람 키보다 넉넉하게). 2층은 안쪽 나무 계단(북쪽 벽을 따라 동→서)으로 올라가요
export const HYANGWON = { ax: 12, az: 54, islandR: 2.7, R: 1.45, bridgeW: 1.0, base: 0.42, doorFace: 4, h1: 2.2, h2: 2.0 }
// 2층 마루 윗면 (정자 기준 높이, 마당 0.17 위)
export const HYANGWON_Y1 = HYANGWON.base + HYANGWON.h1 + 0.22
// 안쪽 계단: x 0.75(아래, 동쪽) → -0.75(위, 서쪽), z 0.85 (정자 기준), 폭 0.5
export const HYANGWON_STAIR = { xBottom: 0.75, xTop: -0.75, z: 0.85, width: 0.5, steps: 14 }
// 2층 마루에 뚫린 계단 구멍 [x0, x1, z0, z1] (정자 기준)
export const HYANGWON_HOLE = [-0.82, 0.82, 0.58, 1.12]
// 2층에서 열려 있는 면 (북·남) — 밖 툇마루(난간 안)로 나갈 수 있어요
export const HYANGWON_UPPER_OPEN = [1, 4]
// 1층 육각 벽 (문 있는 남쪽 면 빼고) — 월드 A 좌표 [x0, z0, x1, z1]
export function hyangwonWalls() {
  const { ax, az, R, doorFace } = HYANGWON
  const out = []
  for (let k = 0; k < 6; k += 1) {
    if (k === doorFace) continue
    const a = (k * Math.PI) / 3
    const b = ((k + 1) * Math.PI) / 3
    out.push([ax + Math.cos(a) * R, az + Math.sin(a) * R, ax + Math.cos(b) * R, az + Math.sin(b) * R])
  }
  return out
}

// 연못 물 위를 막는 충돌 박스. 경회루 축대·돌다리, 향원정 섬·다리 자리는 비워서 걸어 들어갈 수 있어요
// [ax, az, w, d, 회전°]
export function pondWaterBoxes() {
  const out = []
  const rect = (a, b, c, d) => out.push([(a + b) / 2, (c + d) / 2, b - a, d - c, 0])
  // 경회루
  const g = PONDS[0]
  const G = GYEONGHOERU
  const px0 = g.ax - g.w / 2
  const px1 = g.ax + g.w / 2
  const pz0 = g.az - g.d / 2
  const pz1 = g.az + g.d / 2
  const fx0 = G.ax - G.platform[0] / 2
  const fx1 = G.ax + G.platform[0] / 2
  const fz0 = G.az - G.platform[1] / 2
  const fz1 = G.az + G.platform[1] / 2
  rect(px0, fx0, pz0, pz1)
  rect(fx0, px1, pz0, fz0)
  rect(fx0, px1, fz1, pz1)
  let z = fz0
  for (const b of G.bridges) {
    rect(fx1, px1, z, G.az + b - G.bridgeW / 2)
    z = G.az + b + G.bridgeW / 2
  }
  rect(fx1, px1, z, fz1)
  // 향원정
  const h = PONDS[1]
  const Y = HYANGWON
  const hx0 = h.ax - h.w / 2
  const hx1 = h.ax + h.w / 2
  const hz0 = h.az - h.d / 2
  const hz1 = h.az + h.d / 2
  const r = Y.islandR
  rect(hx0, hx1, hz0, Y.az - r)
  rect(hx0, Y.ax - r, Y.az - r, hz1)
  rect(Y.ax + r, hx1, Y.az - r, hz1)
  rect(Y.ax - r, Y.ax - Y.bridgeW / 2, Y.az + r, hz1)
  rect(Y.ax + Y.bridgeW / 2, Y.ax + r, Y.az + r, hz1)
  // 둥근 섬 바깥 네 귀퉁이 물 (45° 돌린 네모)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push([Y.ax + sx * r, Y.az + sz * r, 1.5, 1.5, 45])
  return out
}

// 아미산: 교태전 뒤 계단식 꽃동산 + 육각 굴뚝
export const AMISAN = { ax: 0, az: 43.6, w: 9, d: 2.0, h: 1.0 }

// 관람 안내판 (광화문 앞 서쪽, 길을 바라봄). 누르면 전각 목록 → 고른 곳으로 이동 (PalaceGuideMenu)
export const GUIDE_BOARD = { ax: -10.5, az: -33.1, w: 2.6 }

// 해태 한 쌍 (광화문 앞)
export const HAETAE = [
  [-7.6, -33.6],
  [7.6, -33.6],
]

// 품계석 (근정문 ~ 근정전 계단 사이, 가운데 길 양옆)
export const PUMGYE_ROWS = { axOffset: 3.2, fromAz: -16.6, toAz: -10.4, count: 7 }

// 근정전 윗단 월대 돌난간 (근정전 아이템 기준 좌표 [x0, z0, x1, z1], 가운데 계단 자리 비움)
export const GEUNJEONG_UPPER_RAILS = [
  [-7.75, 7.6, -7.75, 19.6],
  [7.75, 7.6, 7.75, 19.6],
  [-7.75, 7.6, -2.1, 7.6],
  [2.1, 7.6, 7.75, 7.6],
  [-7.75, 19.6, 7.75, 19.6],
]

// 근정전 마당 박석 (행각 안쪽, 근정문 ~ 월대 앞) [x0, x1, z0, z1]
export const COURT = [-14.2, 14.2, -18.2, -7.8]

// 가운데 박석길 뒤쪽: 근정전 뒤 행각 ~ 신무문
export const BACK_PATH = { fromAz: 9.5, toAz: 72 }

// 경회루 연못가 버드나무 [ax, az, 크기]
export const WILLOWS = [
  [-35.6, 9, 1],
  [-35.6, 22.5, 0.95],
  [-30.5, 26.3, 1],
  [-21.5, 26.3, 0.9],
]

// 후원 소나무 [ax, az, 크기]
export const TREES = [
  [-31.2, 47, 1.1], [-26, 49.5, 0.9], [-31.8, 53, 1], [-11.7, 47.5, 0.85], [-7.1, 51, 1],
  [-10.4, 56, 0.9], [-31.2, 66, 1.05], [-25.3, 68.5, 0.9], [-9.1, 64, 1], [-5.9, 68.5, 0.85],
  [3.6, 47.2, 0.75], [2.6, 58, 1], [29.3, 47.5, 1], [31.2, 52, 0.9], [29.9, 58.5, 1.05],
  [31.9, 44, 0.85], [29.3, 26, 0.9], [22.1, 22, 0.85], [-31.2, 34, 0.95],
]

// ── 사정전(편전) 실내 자리 (전각 기준 좌표, 앞 -z) ──
// 3D(HjHallFurniture Pyeonjeon)와 앉기(palaceGuide.js)가 같은 값을 써요.
// 앉을 수 있는 건 어좌(용상)뿐. 좌판은 엉덩이 뒤쪽으로만 깊어서 앉은 다리가 앞으로 나와 보여요.
export function pyeonjeonSpots(W2, D2) {
  const back = D2 - 0.12
  const pz = back - 1.0 // 어탑(용상 단) 가운데
  return {
    back,
    pz,
    platformTop: 0.485, // 어탑 윗면 (전각 마루 위)
    throne: { x: 0, z: pz, top: 0.935 }, // 용상 좌판 윗면
  }
}
