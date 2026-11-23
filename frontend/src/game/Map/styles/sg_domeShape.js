// K-POP 돔 바닥선 계약. 담당: 성근(SG)
// 돔(sg_dome.jsx)과 바닥 서치라이트·폭죽(sg_domeShow.jsx)이 같은 선을 쓰도록 여기 한 곳에만 둠
// 좌표는 K-POP 구역 기준(sg_kpop.json의 position과 같은 단위, 구역 가운데가 0,0)
//
// - 바닥선 = 돔 바깥 외곽선. 둥근 사각형
// - 동쪽(x+)은 중앙 광장 나무(월드 x -42.5)까지 여유가 2m뿐 → 바깥으로는 더 나가지 않음
// - 땅에 닿는 구조물은 바닥선에서 안쪽 BAND m 띠 안에만 (구역 건물·길과 겹치지 않게)
// - 높이 OVERHANG_FROM m 이상은 안쪽으로 OVERHANG m까지 내밀어도 됨 (지붕 캐노피)
// - 동쪽 입구(z -GATE_HALF ~ +GATE_HALF)는 땅 구조물 없이 비워 둠 (sg_entry 길)

export const DOME = {
  minX: -44,
  maxX: 40.5,
  minZ: -44,
  maxZ: 46,
  cornerRadius: 14,
  height: 18, // 지붕 테두리 꼭대기 높이(m). 폭죽은 이보다 20m 위
  band: 3,
  overhangFrom: 7,
  overhang: 12,
  gateHalf: 6,
}

export const FIREWORK_HEIGHT = DOME.height + 20

// 바닥선을 따라 step m 간격 점들. { x, z, nx, nz }: 위치와 바깥 방향 단위벡터
// 입구 구간(동쪽 변의 |z| < gateHalf)은 skipGate가 true면 뺌
export function domeBasePoints(step, { skipGate = false } = {}) {
  const { minX, maxX, minZ, maxZ, cornerRadius: r } = DOME
  const cx = [minX + r, maxX - r]
  const cz = [minZ + r, maxZ - r]
  // 변 4개(직선) + 모서리 4개(사분원)를 시계 반대 방향으로 이어 붙인 경로
  const parts = [
    { line: [[maxX, cz[0]], [maxX, cz[1]]], n: [1, 0] },
    { arc: [cx[1], cz[1], 0] },
    { line: [[cx[1], maxZ], [cx[0], maxZ]], n: [0, 1] },
    { arc: [cx[0], cz[1], Math.PI / 2] },
    { line: [[minX, cz[1]], [minX, cz[0]]], n: [-1, 0] },
    { arc: [cx[0], cz[0], Math.PI] },
    { line: [[cx[0], minZ], [cx[1], minZ]], n: [0, -1] },
    { arc: [cx[1], cz[0], (3 * Math.PI) / 2] },
  ]
  const lengths = parts.map((p) => (p.line ? Math.hypot(p.line[1][0] - p.line[0][0], p.line[1][1] - p.line[0][1]) : (Math.PI / 2) * r))
  const total = lengths.reduce((a, b) => a + b, 0)
  const count = Math.round(total / step)
  const points = []
  for (let i = 0; i < count; i++) {
    let s = (i * total) / count
    let k = 0
    while (s > lengths[k]) s -= lengths[k++]
    const p = parts[k]
    let point
    if (p.line) {
      const t = s / lengths[k]
      const [[x0, z0], [x1, z1]] = p.line
      point = { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx: p.n[0], nz: p.n[1] }
    } else {
      const [ax, az, a0] = p.arc
      const a = a0 + s / r
      point = { x: ax + Math.cos(a) * r, z: az + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }
    }
    if (skipGate && point.nx === 1 && Math.abs(point.z) < DOME.gateHalf) continue
    points.push(point)
  }
  return points
}
