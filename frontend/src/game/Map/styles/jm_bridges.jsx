import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// 애니메이션 구역(JM) 다리 꾸미기 — 담당: 지민
// 걷는 바닥·난간 충돌은 BK님 지형 데크(terrain "deck")가 그대로 맡고, 여기서는 그 위에 겉모습만 덧입힘
// (공용 Terrain.jsx를 고치지 않으려고 "옷 입히기" 방식). item.dress = { points: [[x, z, 높이], ...], width, kind }
//   kind "vermilion"  : 강변으로 내려가는 일본식 붉은 다리 (주홍 난간 + 금색 기보시 + 짙은 나무 기둥)
//   kind "stairs"     : 짧은 붉은 난간 계단 (지형 계단 옆벽 위에 난간만)
//   kind "suspension" : 전망대로 건너가는 흔들다리 (양끝 나무 탑 + 늘어진 밧줄 + 발판 + 살짝 흔들림)
// item.position은 [0, 0] (점이 구역 좌표)

const VERMILION = '#a9543a'
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
// 흔들림 (실제 출렁다리처럼):
//  - 양끝(탑)은 고정, 가운데로 갈수록 크게 움직이는 활 모양 흔들림 (sin(πu), u = 다리 위 위치 0~1)
//  - 좌우 흔들림은 느리게(약 0.4Hz), 높이 있는 밧줄일수록 조금 더 크게 → 판자·밧줄·내림줄이 같이 움직여 끊어져 보이지 않음
//  - 위아래 출렁임도 같은 활 모양으로 부드럽게. 건너는 중이면 걸음 같은 출렁임이 조금 더해짐
//  - 바람: 잔잔하다가 가끔 돌풍. 걷는 바닥 충돌·난간(BK 데크)은 고정이라 판자는 바닥 위로만, 좌우는 조금만 움직이고
//    내림줄 아래 끝은 난간에 붙여 둠 → 위 밧줄이 흔들리면 내림줄이 기울어지는 모양 (떨어져 보이지 않게)
const SLATS_GAP = 0.34
// 밧줄은 둥글게: 길이 방향(z)으로 누운 6각 원기둥 (지름 1 → setBeam에서 굵기로 늘림)
const ROPE_GEO = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateX(Math.PI / 2)
const SLAT_COLORS = ['#6e4b33', '#7a5638', '#5f4029', '#6a4a30', '#83603f', '#584032'].map((c) => new THREE.Color(c))
const swayTmp = { a: new THREE.Vector3(), p: new THREE.Vector3(), d: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1) }
function SuspensionBridge({ points, width }) {
  const anchor = useRef(null)
  const slatRef = useRef(null)
  const cableRef = useRef(null)
  const hangerRef = useRef(null)
  const lineRef = useRef(null)
  const stringerRef = useRef(null)
  const playerRef = useRef(null)
  const lastLookup = useRef(-Infinity)
  const amp = useRef(0.3)
  const walk = useRef(0)
  const lateral = useRef(0)
  const vertical = useRef(0)
  const va = useMemo(() => new THREE.Vector3(), [])
  const vb = useMemo(() => new THREE.Vector3(), [])
  const seg = useMemo(() => edges(points, width, 0.02)[0], [points, width])
  const data = useMemo(() => {
    const { s, e, nx, nz } = seg
    const L = Math.hypot(e[0] - s[0], e[2] - s[2])
    const towerH = 3.4
    const sag = 2.0
    // 데크 난간이 가운데에서 1.25m라서, 탑·밧줄은 그 바깥 1.45m에 둠 (겹치지 않게)
    const k = 1.45 / (width / 2 - 0.02)
    // 밧줄 손잡이는 데크 나무 난간 바로 바깥 (1.37m)
    const kr = 1.37 / (width / 2 - 0.02)
    const deckAt = (t) => s[1] + (e[1] - s[1]) * t
    const cable = (side, t) => {
      const x = s[0] + (e[0] - s[0]) * t + nx * side * k
      const z = s[2] + (e[2] - s[2]) * t + nz * side * k
      const top = deckAt(t) + towerH - sag * 4 * t * (1 - t)
      return { p: [x, top, z], u: t, h: top - deckAt(t) }
    }
    const cables = []
    const hangers = []
    for (const side of [1, -1]) {
      const n = 24
      for (let j = 0; j < n; j++) cables.push({ a: cable(side, j / n), b: cable(side, (j + 1) / n), t: 0.07 })
      const h = Math.max(4, Math.round(L / 1.4))
      for (let j = 1; j < h; j++) {
        const t = j / h
        const bottom = { p: [s[0] + (e[0] - s[0]) * t + nx * side * kr, deckAt(t) + RAIL_H, s[2] + (e[2] - s[2]) * t + nz * side * kr], u: t, h: RAIL_H, lat: 0.2 }
        hangers.push({ a: cable(side, t), b: bottom, t: 0.03 })
      }
    }
    // 손잡이 밧줄(난간 높이) + 그 밑 그물(세로 줄 + 가운데 가로 줄 + 비스듬한 줄) + 판자 밑 세로 받침(나무 2줄)
    //   흔들림은 판자와 같게(lat 0.2) 해서 다리 전체가 한 몸처럼 움직임
    const lines = []
    const stringers = []
    const along = (side, t, h, off = kr) => ({
      p: [s[0] + (e[0] - s[0]) * t + nx * side * off, deckAt(t) + h, s[2] + (e[2] - s[2]) * t + nz * side * off],
      u: t,
      h,
      lat: 0.2,
    })
    const nSeg = 24
    const nNet = Math.max(8, Math.round(L / 0.7))
    for (const side of [1, -1]) {
      for (let j = 0; j < nSeg; j++) {
        lines.push({ a: along(side, j / nSeg, RAIL_H), b: along(side, (j + 1) / nSeg, RAIL_H), t: 0.055 })
        lines.push({ a: along(side, j / nSeg, RAIL_H * 0.5), b: along(side, (j + 1) / nSeg, RAIL_H * 0.5), t: 0.025 })
        stringers.push({ a: along(side, j / nSeg, 0.01, 0.8), b: along(side, (j + 1) / nSeg, 0.01, 0.8), t: 0.1 })
      }
      for (let j = 1; j < nNet; j++) {
        const t = j / nNet
        lines.push({ a: along(side, t, 0.07), b: along(side, t, RAIL_H), t: 0.02 })
        if (j % 2 === 0) lines.push({ a: along(side, (j - 1) / nNet, 0.07), b: along(side, t, RAIL_H * 0.5), t: 0.015 })
      }
    }
    const towers = []
    const ux = (e[0] - s[0]) / L
    const uz = (e[2] - s[2]) / L
    for (const t of [0, 1]) {
      const base = cable(1, t).p
      const other = cable(-1, t).p
      const top = deckAt(t) + towerH + 0.2
      // 고정줄: 탑 꼭대기에서 다리 반대쪽 바닥 돌 말뚝으로 (밧줄 당김을 받는 느낌)
      const back = t === 0 ? -1 : 1
      const guys = [base, other].map((q) => {
        const peg = [q[0] + ux * back * 1.9, deckAt(t), q[2] + uz * back * 1.9]
        return { a: [q[0], top - 0.35, q[2]], b: [peg[0], peg[1] + 0.15, peg[2]], peg }
      })
      towers.push({ a: [base[0], deckAt(t), base[2]], top, b: [other[0], deckAt(t), other[2]], guys })
    }
    const count = Math.floor(L / SLATS_GAP)
    const len = Math.hypot(nx, nz)
    return { cables, hangers, lines, stringers, towers, count, side: [nx / len, nz / len] }
  }, [seg, width])
  const { s, e, yaw } = seg
  const pitch = -Math.atan2(e[1] - s[1], Math.hypot(e[0] - s[0], e[2] - s[2]))

  // 흔들린 위치: 활 모양 sin(πu) × 좌우(높을수록 조금 더) / 위아래(바닥 위로만)
  const moved = (pt, out) => {
    const bell = Math.sin(Math.PI * pt.u)
    const lat = bell * lateral.current * (1 + 0.3 * pt.h) * (pt.lat ?? 1)
    out.set(pt.p[0] + data.side[0] * lat, pt.p[1] + bell * vertical.current * (pt.vert ?? 1), pt.p[2] + data.side[1] * lat)
    return out
  }
  const setBeam = (mesh, i, a, b, thick) => {
    swayTmp.d.subVectors(b, a)
    const L = swayTmp.d.length()
    tmpQ.setFromUnitVectors(swayTmp.z, swayTmp.d.normalize())
    tmpP.addVectors(a, b).multiplyScalar(0.5)
    tmpS.set(thick, thick, L)
    tmpM.compose(tmpP, tmpQ, tmpS)
    mesh.setMatrixAt(i, tmpM)
  }
  const slatBase = useMemo(
    () =>
      Array.from({ length: data.count }, (_, i) => {
        const u = (i + 0.5) / data.count
        return { p: [s[0] + (e[0] - s[0]) * u, s[1] + (e[1] - s[1]) * u + 0.07, s[2] + (e[2] - s[2]) * u], u, h: 0, lat: 0.2 }
      }),
    [data.count, s, e],
  )

  useFrame(({ clock, scene, camera }, delta) => {
    const t = clock.elapsedTime
    // 렉 줄이기: 카메라가 다리 가운데에서 80m 넘게 멀면 흔들림 계산(판자·밧줄 약 200개 위치)을 쉼
    if (anchor.current) {
      anchor.current.getWorldPosition(swayTmp.a)
      const mx = swayTmp.a.x + (s[0] + e[0]) / 2 - camera.position.x
      const mz = swayTmp.a.z + (s[2] + e[2]) / 2 - camera.position.z
      if (mx * mx + mz * mz > 80 * 80) return
    }
    if (!playerRef.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      playerRef.current = scene.getObjectByName('player') ?? null
    }
    let onBridge = false
    if (playerRef.current?.parent && anchor.current) {
      anchor.current.getWorldPosition(swayTmp.a)
      playerRef.current.getWorldPosition(swayTmp.p)
      const px = swayTmp.p.x - swayTmp.a.x
      const pz = swayTmp.p.z - swayTmp.a.z
      const dx = e[0] - s[0]
      const dz = e[2] - s[2]
      const u = ((px - s[0]) * dx + (pz - s[2]) * dz) / (dx * dx + dz * dz)
      const sd = Math.abs((px - s[0]) * dz - (pz - s[2]) * dx) / Math.hypot(dx, dz)
      onBridge = u > 0.02 && u < 0.98 && sd < width / 2 + 0.3
    }
    // 세기는 천천히 바뀌게 (돌풍·건너기 시작/끝이 툭 끊기지 않게)
    const gust = 0.35 + 0.65 * Math.max(0, Math.sin(t * 0.35)) ** 2
    amp.current += (gust + (onBridge ? 0.9 : 0) - amp.current) * Math.min(1, delta * 0.8)
    walk.current += ((onBridge ? 1 : 0) - walk.current) * Math.min(1, delta * 1.5)
    const A = amp.current
    // 좌우: 느린 주기(약 0.4Hz) + 더 느린 흔들림을 섞어 기계적인 반복 느낌을 줄임
    lateral.current = A * 0.24 * (Math.sin(t * 2.5) * 0.8 + Math.sin(t * 1.1 + 1.3) * 0.2)
    // 위아래: 바닥 위로만 (0 ~ 최대). 건널 때는 걸음 같은 출렁임(약 1.2Hz)을 조금 더함
    vertical.current = A * 0.08 * (0.5 + 0.5 * Math.sin(t * 2.5 + 0.8)) + walk.current * 0.07 * (0.5 + 0.5 * Math.sin(t * 7.5))

    const slats = slatRef.current
    if (slats) {
      tmpQ.setFromEuler(tmpE.set(pitch, yaw, 0, 'YXZ'))
      tmpS.set(1, 1, 1)
      slatBase.forEach((base, i) => {
        moved(base, tmpP)
        tmpM.compose(tmpP, tmpQ, tmpS)
        slats.setMatrixAt(i, tmpM)
      })
      slats.instanceMatrix.needsUpdate = true
    }
    if (cableRef.current) {
      data.cables.forEach((c, i) => setBeam(cableRef.current, i, moved(c.a, va), moved(c.b, vb), c.t))
      cableRef.current.instanceMatrix.needsUpdate = true
    }
    if (hangerRef.current) {
      data.hangers.forEach((c, i) => setBeam(hangerRef.current, i, moved(c.a, va), moved(c.b, vb), c.t))
      hangerRef.current.instanceMatrix.needsUpdate = true
    }
    if (lineRef.current) {
      data.lines.forEach((c, i) => setBeam(lineRef.current, i, moved(c.a, va), moved(c.b, vb), c.t))
      lineRef.current.instanceMatrix.needsUpdate = true
    }
    if (stringerRef.current) {
      data.stringers.forEach((c, i) => setBeam(stringerRef.current, i, moved(c.a, va), moved(c.b, vb), c.t))
      stringerRef.current.instanceMatrix.needsUpdate = true
    }
  })

  // 판자마다 나무색을 조금씩 다르게 (낡은 판자가 섞인 느낌)
  useLayoutEffect(() => {
    const slats = slatRef.current
    if (!slats) return
    for (let i = 0; i < data.count; i++) slats.setColorAt(i, SLAT_COLORS[(i * 7 + (i % 3)) % SLAT_COLORS.length])
    if (slats.instanceColor) slats.instanceColor.needsUpdate = true
  }, [data.count])

  return (
    <group>
      <group ref={anchor} />
      {/* 양끝 탑 (고정) */}
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
          {/* X자 버팀목 + 기둥 머리 덮개 + 고정줄·돌 말뚝 */}
          <Beam a={[tw.a[0], tw.a[1] + 0.3, tw.a[2]]} b={[tw.b[0], tw.top - 0.8, tw.b[2]]} t={0.08} c={DARK_WOOD} />
          <Beam a={[tw.b[0], tw.b[1] + 0.3, tw.b[2]]} b={[tw.a[0], tw.top - 0.8, tw.a[2]]} t={0.08} c={DARK_WOOD} />
          {[tw.a, tw.b].map((p, j) => (
            <mesh key={`cap${j}`} position={[p[0], tw.top + 0.08, p[2]]}>
              <boxGeometry args={[0.34, 0.08, 0.34]} />
              <meshStandardMaterial color="#2a1d15" />
            </mesh>
          ))}
          {tw.guys.map((g, j) => (
            <group key={`guy${j}`}>
              <Beam a={g.a} b={g.b} t={0.05} c={ROPE} />
              <mesh position={[g.peg[0], g.peg[1] + 0.12, g.peg[2]]}>
                <boxGeometry args={[0.4, 0.24, 0.4]} />
                <meshStandardMaterial color="#8c867c" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* 흔들리는 부분: 판자·밧줄·내림줄 (매 프레임 위치를 다시 계산) */}
      <instancedMesh ref={slatRef} args={[null, null, data.count]} frustumCulled={false}>
        <boxGeometry args={[width + 0.1, 0.05, SLATS_GAP * 0.78]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={cableRef} args={[ROPE_GEO, null, data.cables.length]} frustumCulled={false}>
        <meshStandardMaterial color={ROPE} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={hangerRef} args={[ROPE_GEO, null, data.hangers.length]} frustumCulled={false}>
        <meshStandardMaterial color={ROPE} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={lineRef} args={[ROPE_GEO, null, data.lines.length]} frustumCulled={false}>
        <meshStandardMaterial color="#a88f68" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={stringerRef} args={[null, null, data.stringers.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4a3324" />
      </instancedMesh>
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
