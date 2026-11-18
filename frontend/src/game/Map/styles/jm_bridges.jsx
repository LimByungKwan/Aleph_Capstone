import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// 애니메이션 구역(JM) 다리 꾸미기 — 담당: 지민
// 걷는 바닥·난간 충돌은 BK님 지형 데크(terrain "deck")가 그대로 맡고, 여기서는 그 위에 겉모습만 덧입힘
// (공용 Terrain.jsx를 고치지 않으려고 "옷 입히기" 방식). item.dress = { points: [[x, z, 높이], ...], width, kind }
//   kind "vermilion"  : 강변으로 내려가는 일본식 붉은 다리 (주홍 난간 + 금색 기보시 + 짙은 나무 기둥)
//   kind "stairs"     : 짧은 붉은 난간 계단 (지형 계단 옆벽 위에 난간만)
//   kind "suspension" : 전망대로 건너가는 흔들다리 (양끝 나무 탑 + 늘어진 밧줄 + 발판 + 살짝 흔들림)
// item.position은 [0, 0] (점이 구역 좌표)

const VERMILION = '#c8452f'
const BRASS = '#c9a54a'
const DARK_WOOD = '#3a2a20'
const ROPE = '#b8a07a'
const RAIL_H = 1.0
const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpS = new THREE.Vector3()
const tmpP = new THREE.Vector3()

// 두 점을 잇는 막대(박스)의 위치·회전
function beam(a, b, thick) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const L = Math.hypot(dx, dy, dz)
  const yaw = Math.atan2(dx, dz)
  const pitch = -Math.atan2(dy, Math.hypot(dx, dz))
  return { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r: [pitch, yaw, 0], s: [thick, thick, L], order: 'YXZ' }
}

function Beam({ a, b, t = 0.1, c }) {
  const { p, r, s } = beam(a, b, t)
  return (
    <mesh position={p} rotation={[r[0], r[1], 0, 'YXZ']}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} />
    </mesh>
  )
}

// 기보시 (난간 기둥 위 양파 모양 장식)
function Giboshi({ p }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.06, 10]} />
        <meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <coneGeometry args={[0.05, 0.14, 10]} />
        <meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  )
}

// 직선 구간마다 양쪽 가장자리 선 (데크와 같은 방식: 진행 방향 오른쪽 = (cos, -sin))
function edges(points, width, inset = 0.05) {
  const segs = []
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az, ah] = points[i]
    const [bx, bz, bh] = points[i + 1]
    const L = Math.hypot(bx - ax, bz - az)
    const t0 = i > 0 ? width / 2 / L : 0
    const t1 = i + 1 < points.length - 1 ? 1 - width / 2 / L : 1
    const at = (t) => [ax + (bx - ax) * t, ah + (bh - ah) * t, az + (bz - az) * t]
    const s = at(t0)
    const e = at(t1)
    const yaw = Math.atan2(bx - ax, bz - az)
    const nx = Math.cos(yaw) * (width / 2 - inset)
    const nz = -Math.sin(yaw) * (width / 2 - inset)
    segs.push({ s, e, nx, nz, yaw, len: L * (t1 - t0) })
  }
  return segs
}

// ── 일본식 붉은 다리 ──────────────────────────────
function VermilionBridge({ points, width }) {
  const parts = useMemo(() => {
    const rails = []
    const posts = []
    const pillars = []
    for (const seg of edges(points, width, 0.02)) {
      for (const side of [1, -1]) {
        const a = [seg.s[0] + seg.nx * side, seg.s[1], seg.s[2] + seg.nz * side]
        const b = [seg.e[0] + seg.nx * side, seg.e[1], seg.e[2] + seg.nz * side]
        rails.push({ a: [a[0], a[1] + RAIL_H + 0.02, a[2]], b: [b[0], b[1] + RAIL_H + 0.02, b[2]], t: 0.14 })
        rails.push({ a: [a[0], a[1] + 0.55, a[2]], b: [b[0], b[1] + 0.55, b[2]], t: 0.09 })
        rails.push({ a: [a[0], a[1] + 0.12, a[2]], b: [b[0], b[1] + 0.12, b[2]], t: 0.12 })
        const n = Math.max(2, Math.round(seg.len / 1.8))
        for (let k = 0; k <= n; k++) {
          const t = k / n
          posts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
        }
      }
      // 아래 기둥 (짙은 나무, 땅까지)
      const n = Math.max(1, Math.round(seg.len / 3))
      for (let k = 0; k <= n; k++) {
        const t = k / n
        const x = seg.s[0] + (seg.e[0] - seg.s[0]) * t
        const y = seg.s[1] + (seg.e[1] - seg.s[1]) * t
        const z = seg.s[2] + (seg.e[2] - seg.s[2]) * t
        if (y > 0.6) for (const side of [1, -1]) pillars.push([x + seg.nx * side * 0.8, y, z + seg.nz * side * 0.8])
      }
    }
    // 꺾이는 곳(층계참) 바깥 두 면 난간
    for (let i = 1; i < points.length - 1; i++) {
      const [x, z, h] = points[i]
      const toPrev = [points[i - 1][0] - x, points[i - 1][1] - z]
      const toNext = [points[i + 1][0] - x, points[i + 1][1] - z]
      const half = width / 2 - 0.02
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        // 이 면 방향으로 데크가 이어지면(앞·뒤 구간 방향과 거의 같으면) 난간을 두지 않음
        const used = [toPrev, toNext].some(([px, pz]) => (px * dx + pz * dz) / Math.hypot(px, pz) > 0.7)
        if (used) continue
        const cx = x + dx * half
        const cz = z + dz * half
        const ax = dx ? [cx, h, z - half] : [x - half, h, cz]
        const bx = dx ? [cx, h, z + half] : [x + half, h, cz]
        rails.push({ a: [ax[0], h + RAIL_H + 0.02, ax[2]], b: [bx[0], h + RAIL_H + 0.02, bx[2]], t: 0.14 })
        rails.push({ a: [ax[0], h + 0.55, ax[2]], b: [bx[0], h + 0.55, bx[2]], t: 0.09 })
        posts.push(ax, bx)
      }
      pillars.push([x - half * 0.8, h, z - half * 0.8], [x + half * 0.8, h, z + half * 0.8], [x - half * 0.8, h, z + half * 0.8], [x + half * 0.8, h, z - half * 0.8])
    }
    return { rails, posts, pillars }
  }, [points, width])
  return (
    <group>
      {parts.rails.map((r, i) => (
        <Beam key={i} a={r.a} b={r.b} t={r.t} c={VERMILION} />
      ))}
      {parts.posts.map((p, i) => (
        <group key={i}>
          <mesh position={[p[0], p[1] + 0.6, p[2]]}>
            <boxGeometry args={[0.16, 1.2, 0.16]} />
            <meshStandardMaterial color={VERMILION} />
          </mesh>
          <Giboshi p={[p[0], p[1] + 1.2, p[2]]} />
        </group>
      ))}
      {parts.pillars.map((p, i) => (
        <mesh key={i} position={[p[0], p[1] / 2 - 0.1, p[2]]}>
          <boxGeometry args={[0.26, p[1], 0.26]} />
          <meshStandardMaterial color={DARK_WOOD} />
        </mesh>
      ))}
    </group>
  )
}

// ── 흔들다리 ─────────────────────────────────────
// 양끝 나무 탑(높이 3.4m) 사이로 굵은 밧줄이 늘어지고(가운데가 처짐), 1.4m마다 내려오는 밧줄이 난간을 잡음
// 발판 판자는 InstancedMesh 하나. 밧줄·판자 묶음이 아주 살짝 좌우로 흔들림(보기만, 충돌은 그대로)
const SLATS_GAP = 0.34
function SuspensionBridge({ points, width }) {
  const swayRef = useRef(null)
  const slatRef = useRef(null)
  const seg = useMemo(() => edges(points, width, 0.02)[0], [points, width])
  const data = useMemo(() => {
    const { s, e, nx, nz } = seg
    const L = Math.hypot(e[0] - s[0], e[2] - s[2])
    const towerH = 3.4
    const sag = 2.0
    // 데크 난간이 가운데에서 1.25m라서, 탑·밧줄은 그 바깥 1.45m에 둠 (겹치지 않게)
    const k = 1.45 / (width / 2 - 0.02)
    const cable = (side, t) => {
      const x = s[0] + (e[0] - s[0]) * t + nx * side * k
      const z = s[2] + (e[2] - s[2]) * t + nz * side * k
      const deck = s[1] + (e[1] - s[1]) * t
      const top = deck + towerH - sag * 4 * t * (1 - t)
      return [x, top, z, deck]
    }
    const cables = []
    const hangers = []
    for (const side of [1, -1]) {
      const n = 24
      for (let k = 0; k < n; k++) {
        const a = cable(side, k / n)
        const b = cable(side, (k + 1) / n)
        cables.push({ a: [a[0], a[1], a[2]], b: [b[0], b[1], b[2]] })
      }
      const h = Math.max(4, Math.round(L / 1.4))
      for (let j = 1; j < h; j++) {
        const t = j / h
        const c = cable(side, t)
        const rx = s[0] + (e[0] - s[0]) * t + nx * side
        const rz = s[2] + (e[2] - s[2]) * t + nz * side
        hangers.push({ a: [c[0], c[1], c[2]], b: [rx, c[3] + RAIL_H, rz] })
      }
    }
    const towers = []
    for (const t of [0, 1]) {
      const base = cable(1, t)
      const other = cable(-1, t)
      towers.push({ a: [base[0], base[3], base[2]], top: base[3] + towerH + 0.2, b: [other[0], other[3], other[2]] })
    }
    const count = Math.floor(L / SLATS_GAP)
    return { cables, hangers, towers, count, L }
  }, [seg])

  const placeSlats = (m) => {
    if (!m) return
    slatRef.current = m
    const { s, e, yaw } = seg
    const pitch = -Math.atan2(e[1] - s[1], Math.hypot(e[0] - s[0], e[2] - s[2]))
    tmpQ.setFromEuler(tmpE.set(pitch, yaw, 0, 'YXZ'))
    for (let i = 0; i < data.count; i++) {
      const t = (i + 0.5) / data.count
      tmpP.set(s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t + 0.07, s[2] + (e[2] - s[2]) * t)
      tmpS.set(1, 1, 1)
      tmpM.compose(tmpP, tmpQ, tmpS)
      m.setMatrixAt(i, tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  }

  useFrame(({ clock }) => {
    if (swayRef.current) swayRef.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.004
  })

  return (
    <group>
      {/* 발판 (데크 바닥 위에 짙은 판자) */}
      <instancedMesh ref={placeSlats} args={[null, null, data.count]}>
        <boxGeometry args={[width + 0.1, 0.05, SLATS_GAP * 0.78]} />
        <meshStandardMaterial color="#6e4b33" />
      </instancedMesh>
      {/* 양끝 탑 */}
      {data.towers.map((tw, i) => (
        <group key={i}>
          {[tw.a, tw.b].map((p, j) => (
            <mesh key={j} position={[p[0], (p[1] + tw.top) / 2, p[2]]}>
              <boxGeometry args={[0.24, tw.top - p[1], 0.24]} />
              <meshStandardMaterial color={DARK_WOOD} />
            </mesh>
          ))}
          <Beam a={[tw.a[0], tw.top - 0.1, tw.a[2]]} b={[tw.b[0], tw.top - 0.1, tw.b[2]]} t={0.22} c={DARK_WOOD} />
          <Beam a={[tw.a[0], tw.top - 0.7, tw.a[2]]} b={[tw.b[0], tw.top - 0.7, tw.b[2]]} t={0.14} c={DARK_WOOD} />
        </group>
      ))}
      {/* 밧줄 (살짝 흔들림) */}
      <group ref={swayRef}>
        {data.cables.map((c, i) => (
          <Beam key={i} a={c.a} b={c.b} t={0.07} c={ROPE} />
        ))}
        {data.hangers.map((h, i) => (
          <Beam key={i} a={h.a} b={h.b} t={0.03} c={ROPE} />
        ))}
      </group>
    </group>
  )
}

// ── 붉은 난간 계단 ───────────────────────────────
// 지형 계단(terrain "stairs")의 옆벽(가운데에서 폭/2+0.15m, 경사면 위 0.9m까지) 위에 주홍 난간과 기보시를 얹음
function VermilionStairs({ points, width }) {
  const parts = useMemo(() => {
    const [[ax, az, ah], [bx, bz, bh]] = points
    const yaw = Math.atan2(bx - ax, bz - az)
    const off = width / 2 + 0.15
    const nx = Math.cos(yaw) * off
    const nz = -Math.sin(yaw) * off
    const rails = []
    const posts = []
    const L = Math.hypot(bx - ax, bz - az)
    const n = Math.max(2, Math.round(L / 1.6))
    for (const side of [1, -1]) {
      const a = [ax + nx * side, ah + 0.9, az + nz * side]
      const b = [bx + nx * side, bh + 0.9, bz + nz * side]
      rails.push({ a: [a[0], a[1] + 0.45, a[2]], b: [b[0], b[1] + 0.45, b[2]], t: 0.13 })
      for (let k = 0; k <= n; k++) {
        const t = k / n
        posts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
      }
    }
    return { rails, posts }
  }, [points, width])
  return (
    <group>
      {parts.rails.map((r, i) => (
        <Beam key={i} a={r.a} b={r.b} t={r.t} c={VERMILION} />
      ))}
      {parts.posts.map((p, i) => (
        <group key={i}>
          <mesh position={[p[0], p[1] + 0.28, p[2]]}>
            <boxGeometry args={[0.15, 0.56, 0.15]} />
            <meshStandardMaterial color={VERMILION} />
          </mesh>
          <Giboshi p={[p[0], p[1] + 0.56, p[2]]} />
        </group>
      ))}
    </group>
  )
}

export function JmBridgeDress({ item }) {
  const { points, width = 2.6, kind } = item.dress
  if (kind === 'suspension') return <SuspensionBridge points={points} width={width} />
  if (kind === 'stairs') return <VermilionStairs points={points} width={width} />
  return <VermilionBridge points={points} width={width} />
}

export const JM_BRIDGE_STYLES = { jmBridgeDress: JmBridgeDress }
