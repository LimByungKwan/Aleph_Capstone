// [2. 설계 > 화면 설계] 경성역 안 배치 (혜진 영화·드라마 구역)
// 역 기준 좌표: 가운데 (0, 0), 앞면 = +z (큰길 쪽), 뒷면 = -z (승강장 쪽), 가로 x.
// 이 파일 하나로 3D 모양(HjGyeongseongStreet.jsx의 경성역)과 충돌 박스(hj_drama.json의 gs_st_*)를 만들어요.
// 배치를 바꾸면 frontend 폴더에서:  node scripts/hj-station-colliders.mjs
//
//   ┌──────────── 뒤(승강장) ─────────────┐
//   │  대합실   │   중앙홀   │   귀빈실   │
//   │ (벤치)    ◇  (기둥·돔)  ◇ (벽난로)  │
//   └──────────── 앞(큰길) ── 문 ─────────┘

export const STATION = {
  w: 22, // 가로
  d: 10, // 깊이
  h: 12,
  coreW: 6.6, // 중앙홀 폭
  coreH: 7.4, // 중앙홀 벽 높이 (위에 둥근 천장)
  wingH: 6, // 양옆 방 높이
  T: 0.3, // 벽 두께
  door: { w: 2.2, h: 3.4 }, // 앞·뒤 큰 문 (가운데)
  innerDoor: { w: 1.9, h: 3.0 }, // 중앙홀 ↔ 양옆 방 문
}

const { w, d, coreW, coreH, wingH, T, door, innerDoor } = STATION
const FZ = d / 2 - T / 2 // 앞 벽 중심선 z
const SX = w / 2 - T / 2 // 옆 벽 중심선 x
const CX = coreW / 2 // 중앙홀 옆벽 x
const dw = door.w / 2
const iw = innerDoor.w / 2

// 벽: [x0, z0, x1, z1, 높이, 안쪽 방향] — 안쪽 방향: 'both'(양쪽 다 실내) 또는 [nx, nz]
export const WALLS = [
  // 앞 벽 (가운데 문)
  [-SX, FZ, -CX, FZ, wingH, [0, -1]],
  [-CX, FZ, -dw, FZ, coreH, [0, -1]],
  [dw, FZ, CX, FZ, coreH, [0, -1]],
  [CX, FZ, SX, FZ, wingH, [0, -1]],
  // 뒤 벽 (가운데 문 → 승강장)
  [-SX, -FZ, -CX, -FZ, wingH, [0, 1]],
  [-CX, -FZ, -dw, -FZ, coreH, [0, 1]],
  [dw, -FZ, CX, -FZ, coreH, [0, 1]],
  [CX, -FZ, SX, -FZ, wingH, [0, 1]],
  // 양 끝 벽
  [-SX, -FZ, -SX, FZ, wingH, [1, 0]],
  [SX, -FZ, SX, FZ, wingH, [-1, 0]],
  // 중앙홀 옆벽 (가운데 문)
  [-CX, -FZ, -CX, -iw, coreH, 'both'],
  [-CX, iw, -CX, FZ, coreH, 'both'],
  [CX, -FZ, CX, -iw, coreH, 'both'],
  [CX, iw, CX, FZ, coreH, 'both'],
]

// 문 위 벽 (보기용, 충돌 없음): [x0, z0, x1, z1, 아래 y, 위 y]
export const LINTELS = [
  [-dw, FZ, dw, FZ, door.h, coreH],
  [-dw, -FZ, dw, -FZ, door.h, coreH],
  [-CX, -iw, -CX, iw, innerDoor.h, coreH],
  [CX, -iw, CX, iw, innerDoor.h, coreH],
]

// 중앙홀 기둥 [x, z] (반지름 0.3)
export const HALL_COLUMNS = [-3.2, -1.5, 1.5, 3.2].flatMap((z) => [[-2.4, z], [2.4, z]])

// 대합실 (왼쪽 방, x < -CX): 긴 나무 벤치 [x, z, 길이] + 기둥
export const WAITING_BENCHES = [-3.2, -1.5, 1.5, 3.2].map((z) => [-7.6, z, 4.2])
export const WAITING_COLUMNS = [[-5.2, 0], [-10, 0]]

// 귀빈실 (오른쪽 방, x > CX): 소파 [x, z, 가로, 깊이, 돌림(도)], 탁자, 벽난로(오른쪽 끝 벽 가운데)
export const VIP_SOFAS = [
  [8.4, -1.9, 2.2, 0.9, 0],
  [8.4, 1.9, 2.2, 0.9, 180],
  [6.2, 0, 2.0, 0.9, 90],
]
export const VIP_TABLE = [8.4, 0, 1.6, 1.0]
export const FIREPLACE = { x: SX - T / 2 - 0.35, z: 0, w: 2.2, h: 1.5, d: 0.7 }
