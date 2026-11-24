import * as THREE from 'three'

// 지형(언덕·데크 산책로) 계산. 화면에 그리는 쪽(Terrain.jsx)과 충돌(Colliders)이
// 같은 결과를 쓰도록 여기서 한 번만 계산하고 캐시해요.

// ── 언덕 높이 ─────────────────────────────────
// hill = { center: [x, z], radius: [가로 반지름, 세로 반지름], height, plateau(0~1, 평평한 꼭대기 비율) }
export function hillHeight(hill, x, z) {
  const [cx, cz] = hill.center
  const [rx, rz] = hill.radius
  const r = Math.hypot((x - cx) / rx, (z - cz) / rz)
  const plateau = hill.plateau ?? 0.5
  if (r >= 1) return 0
  if (r <= plateau) return hill.height
  const t = (r - plateau) / (1 - plateau)
  return hill.height * (1 - t * t * (3 - 2 * t))
}

// 여러 언덕 중 가장 높은 곳 (바닥 높이)
export function terrainHeightAt(terrain, x, z) {
  let height = 0
  for (const item of terrain) {
    if (item.type === 'hill') height = Math.max(height, hillHeight(item, x, z))
  }
  return height
}

function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GRASS = ['#8cc56b', '#7fbb60', '#9bd17a', '#86bf66']
const VISUAL_LIFT = 0.03 // 땅바닥과 겹쳐 깜빡이지 않게 살짝 띄움

// ── 언덕 메시 + 충돌용 삼각형 ────────────────
const hillCache = new Map()

export function buildHill(hill) {
  const key = JSON.stringify(hill)
  if (hillCache.has(key)) return hillCache.get(key)

  const [cx, cz] = hill.center
  const [rx, rz] = hill.radius
  const step = hill.step ?? 1.2
  const nx = Math.ceil((rx * 2) / step)
  const nz = Math.ceil((rz * 2) / step)
  const random = seeded(7)

  // 격자 꼭짓점 (경사면에만 살짝 울퉁불퉁하게 → 로우폴리 느낌)
  const heights = []
  const points = []
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = cx - rx + (i * rx * 2) / nx
      const z = cz - rz + (j * rz * 2) / nz
      let h = hillHeight(hill, x, z)
      if (h > 0.05 && h < hill.height - 0.05) h += (random() - 0.5) * 0.3
      heights.push(h)
      points.push(x, h, z)
    }
  }

  // 언덕이 있는 칸만 삼각형으로 (바깥 평지는 생략 → 삼각형 수 절약)
  const indices = []
  const index = (i, j) => j * (nx + 1) + i
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = index(i, j)
      const b = index(i + 1, j)
      const c = index(i, j + 1)
      const d = index(i + 1, j + 1)
      if (heights[a] + heights[b] + heights[c] + heights[d] <= 0) continue
      indices.push(a, c, b, b, c, d)
    }
  }

  // 화면용: 면마다 색이 다른 평면 셰이딩(로우폴리)
  const positions = new Float32Array(indices.length * 3)
  const colors = new Float32Array(indices.length * 3)
  const color = new THREE.Color()
  for (let f = 0; f < indices.length; f += 3) {
    const avgH = (heights[indices[f]] + heights[indices[f + 1]] + heights[indices[f + 2]]) / 3
    color.set(GRASS[Math.floor(random() * GRASS.length)])
    color.offsetHSL(0, 0, (avgH / hill.height) * 0.05)
    for (let k = 0; k < 3; k++) {
      const v = indices[f + k]
      positions.set([points[v * 3], points[v * 3 + 1] + VISUAL_LIFT, points[v * 3 + 2]], (f + k) * 3)
      colors.set([color.r, color.g, color.b], (f + k) * 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const result = {
    geometry,
    vertices: new Float32Array(points),
    indices: new Uint32Array(indices),
  }
  hillCache.set(key, result)
  return result
}

// ── 나무 데크 산책로 ──────────────────────────
// deck = { width, points: [[x, z, 높이], ...] } — 점을 이은 선을 따라 경사로·꺾이는 곳(층계참)·난간을 만듦
const deckCache = new Map()
const BOARD_THICK = 0.2
const RAIL_HEIGHT = 1.0

function eulerOf(yaw, pitch) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ')
  return [e.x, e.y, e.z]
}

export function buildDeck(deck, terrain) {
  const key = JSON.stringify(deck)
  if (deckCache.has(key)) return deckCache.get(key)
  if (deck.smooth) {
    const result = buildCurvedDeck(deck, terrain)
    deckCache.set(key, result)
    return result
  }

  const w = deck.width ?? 2.4
  const pts = deck.points
  const boards = [] // { p, r, s }  (발판, 충돌 있음)
  const rails = [] // { p, r, s }  (난간 손잡이 — 화면용)
  const railBlocks = [] // { p, r, s } (난간 충돌 — 보이지 않음)
  const railPosts = [] // { p, s }
  const supports = [] // { p, s }  (데크 아래 기둥)

  const addSupport = (x, z, top) => {
    const bottom = terrainHeightAt(terrain, x, z)
    if (top - bottom > 0.3) supports.push({ p: [x, (top + bottom) / 2, z], s: [0.12, top - bottom, 0.12] })
  }

  // 한쪽 난간 (from → to, 같은 기울기)
  const addRail = (ax, ay, az, bx, by, bz) => {
    const L = Math.hypot(bx - ax, bz - az)
    if (L < 0.05) return
    const len = Math.hypot(L, by - ay)
    const r = eulerOf(Math.atan2(bx - ax, bz - az), -Math.atan2(by - ay, L))
    const mid = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2]
    rails.push({ p: [mid[0], mid[1] + RAIL_HEIGHT, mid[2]], r, s: [0.08, 0.08, len] })
    rails.push({ p: [mid[0], mid[1] + RAIL_HEIGHT * 0.5, mid[2]], r, s: [0.05, 0.05, len] })
    railBlocks.push({ p: [mid[0], mid[1] + 0.55, mid[2]], r, s: [0.1, 1.1, len] })
    const count = Math.max(1, Math.round(L / 1.2))
    for (let k = 0; k <= count; k++) {
      const t = k / count
      railPosts.push({ p: [ax + (bx - ax) * t, ay + (by - ay) * t + RAIL_HEIGHT / 2, az + (bz - az) * t], s: [0.05, RAIL_HEIGHT, 0.05] })
    }
  }

  const last = pts.length - 1
  for (let i = 0; i < last; i++) {
    const [ax, az, ah] = pts[i]
    const [bx, bz, bh] = pts[i + 1]
    const L = Math.hypot(bx - ax, bz - az)
    // 꺾이는 점(층계참)과 겹치지 않게 양 끝을 반 폭만큼 잘라냄
    const t0 = i > 0 ? w / 2 / L : 0
    const t1 = i + 1 < last ? 1 - w / 2 / L : 1
    if (t1 <= t0) continue
    const at = (t) => [ax + (bx - ax) * t, ah + (bh - ah) * t, az + (bz - az) * t]
    const [sx, sy, sz] = at(t0)
    const [ex, ey, ez] = at(t1)
    const segL = L * (t1 - t0)
    const len = Math.hypot(segL, ey - sy)
    const yaw = Math.atan2(bx - ax, bz - az)
    const r = eulerOf(yaw, -Math.atan2(ey - sy, segL))
    boards.push({ p: [(sx + ex) / 2, (sy + ey) / 2 - BOARD_THICK / 2 + 0.05, (sz + ez) / 2], r, s: [w, BOARD_THICK, len] })

    // 양옆 난간 (진행 방향의 오른쪽 = (cos, -sin))
    const nx = Math.cos(yaw) * (w / 2 - 0.05)
    const nz = -Math.sin(yaw) * (w / 2 - 0.05)
    for (const side of [1, -1]) addRail(sx + nx * side, sy, sz + nz * side, ex + nx * side, ey, ez + nz * side)

    // 데크 아래 기둥 (약 2.5m마다)
    const count = Math.max(1, Math.round(segL / 2.5))
    for (let k = 0; k <= count; k++) {
      const [x, y, z] = at(t0 + ((t1 - t0) * k) / count)
      for (const side of [1, -1]) addSupport(x + nx * side * 0.85, z + nz * side * 0.85, y - 0.15)
    }
  }

  // 꺾이는 점: 평평한 정사각형 + 바깥쪽 두 면에만 난간
  for (let i = 1; i < last; i++) {
    const [x, z, h] = pts[i]
    boards.push({ p: [x, h - BOARD_THICK / 2 + 0.05, z], r: [0, 0, 0], s: [w, BOARD_THICK, w] })
    const connected = [pts[i - 1], pts[i + 1]].map(([px, pz]) => {
      const d = Math.hypot(px - x, pz - z)
      return [(px - x) / d, (pz - z) / d]
    })
    const sides = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    for (const [dx, dz] of sides) {
      if (connected.some(([cx, cz]) => cx * dx + cz * dz > 0.7)) continue
      const ox = x + dx * (w / 2 - 0.05)
      const oz = z + dz * (w / 2 - 0.05)
      addRail(ox - dz * (w / 2), h, oz + dx * (w / 2), ox + dz * (w / 2), h, oz - dx * (w / 2))
    }
    for (const [dx, dz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      addSupport(x + dx * (w / 2 - 0.2), z + dz * (w / 2 - 0.2), h - 0.15)
  }

  const result = { boards, rails, railBlocks, railPosts, supports }
  deckCache.set(key, result)
  return result
}

// ── 꼬불꼬불한 데크 (deck.smooth = true) ──────
// points를 지나는 부드러운 곡선(Catmull-Rom)을 약 1m 간격으로 잘라 발판을 이어 붙임.
// 높이는 처음 → 끝 높이로 고르게 오르되, 언덕 경사면(울퉁불퉁)에서는 땅 위 0.6m, 평평한 곳은 0.1m 위로 올림.
// 꺾이는 층계참 없이 자연스럽게 이어지고, 끝은 언덕 꼭대기 바닥과 거의 같은 높이로 붙어요.
// 반환 형식은 buildDeck과 같아서 화면·충돌 코드는 그대로 씀
function buildCurvedDeck(deck, terrain) {
  const w = deck.width ?? 2.4
  const ctrl = deck.points
  const curve = new THREE.CatmullRomCurve3(
    ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  )
  const n = Math.max(2, Math.ceil(curve.getLength() / (deck.step ?? 1)))
  const pts = curve.getSpacedPoints(n)
  const h0 = ctrl[0][2]
  const h1 = ctrl[ctrl.length - 1][2]
  // 언덕 경사면은 로우폴리 꼭짓점이 ±0.15 울퉁불퉁 + 삼각형 보간 오차 → 넉넉히 띄움
  const bumpy = (x, z) =>
    terrain.some((t) => {
      if (t.type !== 'hill') return false
      const h = hillHeight(t, x, z)
      return h > 0.02 && h < t.height - 0.02
    })
  const raw = pts.map((p, i) => {
    if (i === 0 || i === n) return i === 0 ? h0 : h1
    const ground = terrainHeightAt(terrain, p.x, p.z)
    return Math.max(h0 + ((h1 - h0) * i) / n, ground + (bumpy(p.x, p.z) ? (deck.clearance ?? 0.6) : 0.1))
  })
  // 높이를 살짝 고르게 (울컥거리지 않게), 양 끝은 그대로
  const H = raw.map((h, i) => {
    if (i === 0 || i === n) return h
    let sum = 0
    let count = 0
    for (let k = Math.max(0, i - 2); k <= Math.min(n, i + 2); k++) {
      sum += raw[k]
      count++
    }
    return Math.max(sum / count, raw[i])
  })
  const yawAt = (i) => Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z)
  const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

  const boards = []
  const rails = []
  const railBlocks = []
  const railPosts = []
  const supports = []

  // 발판: 굽은 곳 바깥쪽에 틈이 생기지 않게 조금 길게
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const L = Math.hypot(b.x - a.x, b.z - a.z)
    const yaw = yawAt(i)
    const bend = Math.max(i > 0 ? turn(yaw, yawAt(i - 1)) : 0, i + 1 < n ? turn(yaw, yawAt(i + 1)) : 0)
    const extra = Math.min(0.6, w * Math.tan(bend / 2))
    const dy = H[i + 1] - H[i]
    const len = Math.hypot(L, dy) + extra
    boards.push({
      p: [(a.x + b.x) / 2, (H[i] + H[i + 1]) / 2 - BOARD_THICK / 2 + 0.05, (a.z + b.z) / 2],
      r: eulerOf(yaw, -Math.atan2(dy, L)),
      s: [w, BOARD_THICK, len],
    })
  }

  // 난간: 각 점의 양옆(진행 방향 오른쪽 = (cos, -sin)) 점을 이어서
  const sidePoint = (i, side) => {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(n, i + 1)]
    const yaw = Math.atan2(next.x - prev.x, next.z - prev.z)
    const o = (w / 2 - 0.05) * side
    return [pts[i].x + Math.cos(yaw) * o, H[i], pts[i].z - Math.sin(yaw) * o]
  }
  for (const side of [1, -1]) {
    const S = range(n + 1).map((i) => sidePoint(i, side))
    for (let i = 0; i < n; i++) {
      const [ax, ay, az] = S[i]
      const [bx, by, bz] = S[i + 1]
      const L = Math.hypot(bx - ax, bz - az)
      if (L < 0.02) continue
      const len = Math.hypot(L, by - ay) + 0.04
      const r = eulerOf(Math.atan2(bx - ax, bz - az), -Math.atan2(by - ay, L))
      const mid = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2]
      rails.push({ p: [mid[0], mid[1] + RAIL_HEIGHT, mid[2]], r, s: [0.08, 0.08, len] })
      rails.push({ p: [mid[0], mid[1] + RAIL_HEIGHT * 0.5, mid[2]], r, s: [0.05, 0.05, len] })
      railBlocks.push({ p: [mid[0], mid[1] + 0.55, mid[2]], r, s: [0.1, 1.1, len] })
    }
    S.forEach(([x, y, z], i) => {
      if (i % 2 === 0 || i === n) railPosts.push({ p: [x, y + RAIL_HEIGHT / 2, z], s: [0.05, RAIL_HEIGHT, 0.05] })
    })
    // 기둥 (약 2.5m마다)
    for (let i = 0; i <= n; i += 3) {
      const [x, y, z] = sidePoint(i, side * 0.7)
      const bottom = terrainHeightAt(terrain, x, z)
      const top = y - 0.15
      if (top - bottom > 0.3) supports.push({ p: [x, (top + bottom) / 2, z], s: [0.12, top - bottom, 0.12] })
    }
  }

  // 시작점과 진행 방향 (입구 아치를 세울 자리)
  const start = { p: [pts[0].x, H[0], pts[0].z], yaw: yawAt(0) }
  return { boards, rails, railBlocks, railPosts, supports, start }
}

const range = (count) => Array.from({ length: count }, (_, i) => i)

// ── 계단 ─────────────────────────────────────
// stairs = { from: [x, z, 높이], to: [x, z, 높이], width }
// 보이는 건 계단 한 칸 한 칸, 충돌은 매끄러운 경사로 하나 (캐릭터가 걸려 넘어지지 않게)
const stairsCache = new Map()

export function buildStairs(stairs) {
  const key = JSON.stringify(stairs)
  if (stairsCache.has(key)) return stairsCache.get(key)
  const [ax, az, ah] = stairs.from
  const [bx, bz, bh] = stairs.to
  const w = stairs.width ?? 4
  const L = Math.hypot(bx - ax, bz - az)
  const rise = bh - ah
  // smooth: 완만한 경사로(휠체어용) — 아주 낮은 턱이 촘촘해서 비탈처럼 보임
  // stepHeight: 한 단 높이(기본 0.22m). 크게 주면 단이 적고 높아 보임 (충돌은 경사로라 오르기는 같음)
  const count = stairs.smooth ? Math.max(4, Math.round(L / 0.4)) : Math.max(1, Math.ceil(rise / (stairs.stepHeight ?? 0.22)))
  const yaw = Math.atan2(bx - ax, bz - az)
  const dirX = (bx - ax) / L
  const dirZ = (bz - az) / L

  const steps = []
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const top = ah + (rise * (i + 1)) / count
    steps.push({ p: [ax + (bx - ax) * t, (ah + top) / 2, az + (bz - az) * t], r: [0, yaw, 0], s: [w, top - ah, L / count + 0.01] })
  }
  const len = Math.hypot(L, rise)
  const ramp = {
    p: [(ax + bx) / 2, (ah + bh) / 2 - 0.1, (az + bz) / 2],
    r: eulerOf(yaw, -Math.atan2(rise, L)),
    s: [w, 0.2, len],
  }
  // 양옆 난간 벽 (낮은 돌 난간). walls: false 면 없음 (넓은 계단을 탁 트이게)
  const nx = Math.cos(yaw) * (w / 2 + 0.15)
  const nz = -Math.sin(yaw) * (w / 2 + 0.15)
  const walls = (stairs.walls === false ? [] : [1, -1]).map((side) => ({
    p: [(ax + bx) / 2 + nx * side, (ah + bh) / 2 + 0.3, (az + bz) / 2 + nz * side],
    r: eulerOf(yaw, -Math.atan2(rise, L)),
    s: [0.3, 1.2, len + 0.3],
  }))
  const result = { steps, ramp, walls, dir: [dirX, dirZ] }
  stairsCache.set(key, result)
  return result
}

// ── 계단식 테라스 단 (옹벽 + 난간 + 줄 전구) ───
// platform = { rect: [x0, z0, x1, z1], height, rails: [{ edge: "north"|"south"|"west"|"east", gaps: [[a, b], ...] }], lights }
// north = z0(작은 z) 쪽, south = z1 쪽, west = x0, east = x1. gaps는 그 변을 따라 비워 둘 구간(계단·경사로 자리).
const platformCache = new Map()
const RAIL_TOP = 1.0

export function buildPlatform(platform) {
  const key = JSON.stringify(platform)
  if (platformCache.has(key)) return platformCache.get(key)
  const [x0, z0, x1, z1] = platform.rect
  const h = platform.height
  const body = { p: [(x0 + x1) / 2, h / 2, (z0 + z1) / 2], s: [x1 - x0, h, z1 - z0] }
  const rails = []
  const railBlocks = []
  const railPosts = []
  const bulbs = []
  const lightPosts = []
  const inset = 0.15

  for (const rail of platform.rails ?? []) {
    const alongX = rail.edge === 'north' || rail.edge === 'south'
    const fixed =
      rail.edge === 'north' ? z0 + inset : rail.edge === 'south' ? z1 - inset : rail.edge === 'west' ? x0 + inset : x1 - inset
    const [start, end] = alongX ? [x0, x1] : [z0, z1]
    // 전체 변에서 gaps를 뺀 구간들
    let pieces = [[start, end]]
    for (const [ga, gb] of rail.gaps ?? []) {
      pieces = pieces.flatMap(([a, b]) => {
        if (gb <= a || ga >= b) return [[a, b]]
        return [
          [a, Math.max(a, ga)],
          [Math.min(b, gb), b],
        ].filter(([p, q]) => q - p > 0.3)
      })
    }
    for (const [a, b] of pieces) {
      const len = b - a
      const mid = (a + b) / 2
      const at = (t) => (alongX ? [t, fixed] : [fixed, t])
      const [mx, mz] = at(mid)
      const size = (thick, tall) => (alongX ? [len, tall, thick] : [thick, tall, len])
      rails.push({ p: [mx, h + RAIL_TOP, mz], s: size(0.08, 0.08) })
      rails.push({ p: [mx, h + RAIL_TOP * 0.5, mz], s: size(0.05, 0.05) })
      railBlocks.push({ p: [mx, h + 0.55, mz], s: size(0.12, 1.1) })
      const posts = Math.max(1, Math.round(len / 1.5))
      for (let k = 0; k <= posts; k++) {
        const [px, pz] = at(a + (len * k) / posts)
        railPosts.push({ p: [px, h + RAIL_TOP / 2, pz], s: [0.06, RAIL_TOP, 0.06] })
      }
      if (platform.lights) {
        const poles = Math.max(1, Math.round(len / 4.5))
        for (let k = 0; k <= poles; k++) {
          const [px, pz] = at(a + (len * k) / poles)
          lightPosts.push({ p: [px, h + 1.1, pz], s: [0.05, 2.2, 0.05] })
          if (k < poles) {
            const [qx, qz] = at(a + (len * (k + 1)) / poles)
            for (let i = 0; i < 8; i++) {
              const t = (i + 0.5) / 8
              bulbs.push({ p: [px + (qx - px) * t, h + 2.1 - 0.3 * Math.sin(Math.PI * t), pz + (qz - pz) * t], s: [0.07, 0.07, 0.07] })
            }
          }
        }
      }
    }
  }
  const result = { body, rails, railBlocks, railPosts, bulbs, lightPosts }
  platformCache.set(key, result)
  return result
}

// ── 들어갈 수 있는 전망 타워 ──────────────────
// tower = { position: [x, z], rotationDeg (문 방향 = 로컬 +z) }
// 크기(m): 1층 홀 반지름 6, 높이 4.5 / 엘리베이터 통로 반지름 2.45 / 전망대 반지름 7, 바닥 높이 18
export const TOWER = {
  hallRadius: 6,
  hallHeight: 4.5,
  doorHalfAngle: 0.22, // 문 폭의 절반(라디안) ≈ 문 폭 2.6m
  shaftRadius: 2.45,
  liftRadius: 2.2,
  tubeBottom: 2.7, // 이 높이부터 엘리베이터 통로 유리벽 (아래는 타는 입구)
  deckFloor: 23, // 전망층 바닥 높이 (타워 바닥 기준, 언덕 위라 실제로는 약 32m)
  deckRadius: 7,
  deckWallHeight: 3.5,
  // 엘리베이터 문: 1층은 홀 입구(+z, 각도 0), 전망층은 출구(-z, 각도 π). 문 자리 반각(라디안)·문 높이
  liftDoorHalf: 0.45,
  liftDoorHeight: 2.35,
}

// 원 둘레를 따라 박스 조각들 (벽·바닥 링). skip(angle)이 true면 그 자리는 비움(문)
export function ringPieces({ radius, thickness, y0, y1, count, skip, radialWidth }) {
  const pieces = []
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI * 2
    if (skip && skip(a)) continue
    if (radialWidth) {
      const r = radius - radialWidth / 2
      pieces.push({
        p: [Math.sin(a) * r, (y0 + y1) / 2, Math.cos(a) * r],
        r: [0, a, 0],
        s: [((Math.PI * 2 * radius) / count) * 1.06, y1 - y0, radialWidth],
      })
    } else {
      pieces.push({
        p: [Math.sin(a) * radius, (y0 + y1) / 2, Math.cos(a) * radius],
        r: [0, a, 0],
        s: [((Math.PI * 2 * radius) / count) * 1.06, y1 - y0, thickness],
      })
    }
  }
  return pieces
}

const angleNear = (a, center, half) => {
  const d = Math.atan2(Math.sin(a - center), Math.cos(a - center))
  return Math.abs(d) < half
}

// 타워 충돌 조각 (타워 기준 로컬 좌표)
export function towerColliderPieces() {
  const T = TOWER
  return [
    // 1층 홀 벽 (문 자리는 비움)
    ...ringPieces({ radius: T.hallRadius, thickness: 0.4, y0: 0, y1: T.hallHeight, count: 28, skip: (a) => angleNear(a, 0, T.doorHalfAngle) }),
    // 엘리베이터 통로 유리벽 (타는 입구 위부터 전망대 바닥까지)
    ...ringPieces({ radius: T.shaftRadius, thickness: 0.2, y0: T.tubeBottom, y1: T.deckFloor, count: 22 }),
    // 통로 아래 기둥 4개
    ...[0.25, 0.75, 1.25, 1.75].map((k) => ({
      p: [Math.sin(k * Math.PI) * (T.shaftRadius + 0.05), T.tubeBottom / 2, Math.cos(k * Math.PI) * (T.shaftRadius + 0.05)],
      r: [0, 0, 0],
      s: [0.36, T.tubeBottom, 0.36],
    })),
    // 전망대 바닥 (가운데 엘리베이터 구멍은 비움)
    ...ringPieces({ radius: T.deckRadius, y0: T.deckFloor - 0.3, y1: T.deckFloor, count: 28, radialWidth: T.deckRadius - T.shaftRadius - 0.05 }),
    // 전망대 유리벽
    ...ringPieces({ radius: T.deckRadius, thickness: 0.3, y0: T.deckFloor, y1: T.deckFloor + T.deckWallHeight, count: 32 }),
    // 1층 엘리베이터 통로 유리벽 (바닥 ~ 통로 시작 높이, 문 자리는 비움 — 문 충돌은 Elevator가 열고 닫음)
    ...ringPieces({ radius: T.shaftRadius, thickness: 0.2, y0: 0, y1: T.tubeBottom, count: 22, skip: (a) => angleNear(a, 0, T.liftDoorHalf) }),
    // 전망층 엘리베이터 통로 유리벽 (바닥 ~ 천장, 출구 문 자리는 비움)
    ...ringPieces({ radius: T.shaftRadius, thickness: 0.15, y0: T.deckFloor, y1: T.deckFloor + T.deckWallHeight, count: 22, skip: (a) => angleNear(a, Math.PI, T.liftDoorHalf) }),
  ]
}
