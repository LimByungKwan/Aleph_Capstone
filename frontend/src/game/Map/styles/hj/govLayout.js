// [2. 설계 > 화면 설계] 조선총독부 청사 안 배치 (혜진 영화·드라마 구역)
// 청사 기준 좌표: 가운데 (0, 0), 앞면 = +z (공원·대로 쪽), 가로 x. 1층만 들어가요 (위층은 겉모양만).
// 이 파일 하나로 3D 모양(HjGovernmentGeneral.jsx)과 충돌 박스(hj_drama.json의 gs_gg_*)를 만들어요.
// 배치를 바꾸면 frontend 폴더에서:  node scripts/hj-government-colliders.mjs
//
//   ┌──────────────── 뒤 ────────────────┐
//   │        │ ═ 2층 발코니(계단참) ═ │        │
//   │  로비  │ 계단↗   중앙홀   ↖계단 │ 사무실 │
//   │ (체크  ◇  나침반 무늬 바닥     ◇ (시계 │
//   │  바닥) │                        │  서류) │
//   │        ├──┬── 현관 홀 ──┬──┤        │
//   └────────┴──┘   ↑ 정문    └──┴────────┘
//                 기둥 현관·계단

export const GOV = {
  w: 24,
  d: 16,
  h: 16,
  body: 8, // 날개 벽 높이 (겉 4층)
  hallW: 12, // 중앙홀 폭
  hallH: 9.5, // 중앙홀 벽 높이 (위에 둥근 천장)
  roomH: 4.8, // 1층 방 천장 높이
  T: 0.35,
  frontDoor: 2.6, // 정문 폭
  sideDoor: 2.2, // 중앙홀 ↔ 로비·사무실 문 폭
  doorH: 3.6,
  vestZ: 5, // 현관 홀과 중앙홀 사이 칸막이 z
  floor: 0.6, // 1층 바닥 높이 (기단 위). 정문 앞 계단 4단으로 올라가요
}

const { w, d, hallW, hallH, body, T, frontDoor, sideDoor, vestZ } = GOV
const FZ = d / 2 - T / 2
const SX = w / 2 - T / 2
const HX = hallW / 2
const fd = frontDoor / 2
const sd = sideDoor / 2

// 벽: [x0, z0, x1, z1, 높이, 안쪽 방향('both' 또는 [nx, nz])]
export const WALLS = [
  // 앞 벽 (가운데 정문)
  [-SX, FZ, -HX, FZ, body, [0, -1]],
  [-HX, FZ, -fd, FZ, hallH, [0, -1]],
  [fd, FZ, HX, FZ, hallH, [0, -1]],
  [HX, FZ, SX, FZ, body, [0, -1]],
  // 뒤 벽
  [-SX, -FZ, -HX, -FZ, body, [0, 1]],
  [-HX, -FZ, HX, -FZ, hallH, [0, 1]],
  [HX, -FZ, SX, -FZ, body, [0, 1]],
  // 양 끝 벽
  [-SX, -FZ, -SX, FZ, body, [1, 0]],
  [SX, -FZ, SX, FZ, body, [-1, 0]],
  // 중앙홀 옆벽 (로비·사무실로 가는 문: z 0 근처)
  [-HX, -FZ, -HX, -sd + 1, hallH, 'both'],
  [-HX, sd + 1, -HX, FZ, hallH, 'both'],
  [HX, -FZ, HX, -sd + 1, hallH, 'both'],
  [HX, sd + 1, HX, FZ, hallH, 'both'],
  // 현관 홀 ↔ 중앙홀 칸막이 (가운데 큰 입구 + 양옆 작은 입구)
  [-HX, vestZ, -3.6, vestZ, 5.2, 'both'],
  [-1.9, vestZ, -1.6, vestZ, 5.2, 'both'],
  [1.6, vestZ, 1.9, vestZ, 5.2, 'both'],
  [3.6, vestZ, HX, vestZ, 5.2, 'both'],
  // 사무실 칸막이 (뒤쪽 작은 방, 가운데 문)
  [HX, -3.2, 8.2, -3.2, GOV.roomH + GOV.floor, 'both'],
  [9.6, -3.2, SX, -3.2, GOV.roomH + GOV.floor, 'both'],
]

// 문 위 벽 (보기용): [x0, z0, x1, z1, 아래 y, 위 y, 안쪽]
export const LINTELS = [
  [-fd, FZ, fd, FZ, GOV.doorH + 0.6, hallH, [0, -1]],
  [-HX, -sd + 1, -HX, sd + 1, GOV.doorH + GOV.floor, hallH, 'both'],
  [HX, -sd + 1, HX, sd + 1, GOV.doorH + GOV.floor, hallH, 'both'],
  [8.2, -3.2, 9.6, -3.2, 2.6 + GOV.floor, GOV.roomH + GOV.floor, 'both'],
]

// 정문 바깥 기둥 현관: 네모 기둥 [x], 앞 계단 (z = 앞면 바깥)
export const PORTICO = { pillars: [-4.6, -1.7, 1.7, 4.6], z: d / 2 + 1.6, depth: 3.2, steps: 4, rise: 0.12, run: 0.42 }

// 중앙홀 양쪽 계단 (옆벽을 따라 뒤로 올라가 2층 발코니로): 계단 하나 = [x 가운데, 폭]
export const STAIRS = { xs: [-4.6, 4.6], width: 1.9, fromZ: -0.6, steps: 17, rise: 0.155, run: 0.3 }
export const LANDING = { z0: -FZ + T / 2, depth: 1.8, h: 17 * 0.155 }

// 로비 (왼쪽 날개): 넓은 낮은 계단 → 뒤쪽 단, 진열장, 장식장
export const LOBBY_DAIS = { z0: -FZ + T / 2, depth: 3.4, steps: 4, rise: 0.15, run: 0.45 }
export const LOBBY_CASE = [-9.6, 4.2, 1.4, 0.7] // [x, z, 가로, 깊이]
export const LOBBY_CABINET = [-SX + T / 2 + 0.3, 0.6, 0.55, 2.2] // 끝 벽 앞 검은 장식장 [x, z, 깊이, 가로]

// 사무실 (오른쪽 날개): 책상 [x, z, 가로, 깊이], 서류장 [x, z, 가로, 깊이]
export const OFFICE_DESKS = [
  [8.6, 2.2, 1.6, 0.9],
  [10.2, 4.8, 1.6, 0.9],
  [9.6, -5.6, 1.8, 0.9],
]
export const OFFICE_CABINETS = [
  [7.2, FZ - T / 2 - 0.35, 1.4, 0.6],
  [8.8, FZ - T / 2 - 0.35, 1.4, 0.6],
  [11.45, 0.6, 0.6, 1.4],
  [11.45, -1.0, 0.6, 1.4],
]
