import { CatmullRomCurve3, Vector3 } from 'three'

// 선을 0.5m 간격 점으로 (위치·방향·누적 길이) → 매 프레임 거리로 바로 찾기
export function buildSeaLinePath(line) {
  const curve = new CatmullRomCurve3(line.pts.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal')
  const total = curve.getLength()
  const n = Math.ceil(total / 0.5)
  const P = new Float32Array((n + 1) * 2)
  const D = new Float32Array((n + 1) * 2)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = curve.getPointAt(t)
    const d = curve.getTangentAt(t)
    P[i * 2] = p.x
    P[i * 2 + 1] = p.z
    const l = Math.hypot(d.x, d.z) || 1
    D[i * 2] = d.x / l
    D[i * 2 + 1] = d.z / l
  }
  const step = total / n
  const near = (x, z) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i <= n; i++) {
      const dd = (P[i * 2] - x) ** 2 + (P[i * 2 + 1] - z) ** 2
      if (dd < bd) {
        bd = dd
        best = i
      }
    }
    return best * step
  }
  const sStation = near(...line.pts[line.station])
  let sMouth = 0
  for (let i = 0; i <= n; i++) {
    if (P[i * 2 + 1] < line.mouthZ) {
      sMouth = i * step
      break
    }
  }
  const at = (s, out) => {
    const f = Math.min(n, Math.max(0, s / step))
    const i = Math.min(n - 1, Math.floor(f))
    const u = f - i
    out.x = P[i * 2] + (P[i * 2 + 2] - P[i * 2]) * u
    out.z = P[i * 2 + 1] + (P[i * 2 + 3] - P[i * 2 + 1]) * u
    out.dx = D[i * 2] + (D[i * 2 + 2] - D[i * 2]) * u
    out.dz = D[i * 2 + 1] + (D[i * 2 + 3] - D[i * 2 + 1]) * u
    const l = Math.hypot(out.dx, out.dz) || 1
    out.dx /= l
    out.dz /= l
    return out
  }
  return { total, sStation, sMouth, trackStart: Math.max(0, sMouth - 2), at, step }
}

export function sampleOceanBoundary(pts, step = 3) {
  // 점 줄을 부드러운 닫힌 곡선으로 + 각 점이 열린 쪽인지
  const curve = new CatmullRomCurve3(pts.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal')
  const n = Math.max(64, Math.round(curve.getLength() / step)) // 열린 쪽은 멀리까지 이어져 길이가 길어도 계산량이 견딜 만큼
  const out = []
  for (let i = 0; i < n; i++) {
    const t = i / n
    const p = curve.getPointAt(t)
    // 원래 점 몇 번째 구간인지 → 그 구간의 open
    const seg = Math.min(pts.length - 1, Math.floor(curve.getUtoTmapping(t) * pts.length))
    const f = pts[seg][2]
    out.push([p.x, p.z, f === 'L' ? 'L' : f ? 'O' : 'B'])
  }
  return out
}
