import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Ball, Box, Cyl, GEO, Instances, mat } from './kit.jsx'
import { canvasTexture, getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'
import { rebuild } from './jm_perf.jsx'

// 애니 구역(JM) 바다 전차 한 량 — 담당: 지민 (11/27 새로 만듦, 예전 jm_spirit.jsx JmSeaTrain 대신)
// 바다 위 전기 전차: 아래 밤색 세로 나무판 + 놋쇠 띠 + 크림색 창 줄과 글자판, 둥근 지붕(안은 크림색 천장)
//   앞(head) = 세 쪽 꺾인 운전석 얼굴: 큰 앞창 3장, 행선판(빛남), 지붕 위 전조등, 아래 붉은 표지등·범퍼·연결기
//   뒤 = 연결 끝벽(가운데 통로문). 옆문 2곳(+x 쪽, 승강장 쪽)은 미닫이 문짝이 doors 값(0 닫힘 ~ 1 열림)에 따라 움직임
//   안: 나무 바닥, 양쪽 붉은 긴 의자(-x 쪽 길게, +x 쪽은 문 사이), 손잡이 고리, 천장 등, 운전대
//   pantograph: 지붕 위 집전장치(머리가 가선 높이에 닿음)
// 앞 = 로컬 +z 또는 -z (head 1 | -1), 크기는 아래 상수 (jm_seaLine.jsx 좌석 위치와 같이 씀)
// 무게: 반복되는 것(창 기둥·유리·손잡이)은 Instances, 빛은 발광 재질만 (점광원 없음)

export const TRAM = { w: 2.6, len: 11, floor: 0.9, eave: 2.5, doorZ: 3.5, doorW: 1.2 }
const { w: W, len: LEN, floor: FL } = TRAM
const EAVE = FL + TRAM.eave // 지붕 시작 높이 (차 기준)
const ROOF_R = 2.2
const ROOF_A = Math.asin((W / 2 + 0.06) / ROOF_R)
const ROOF_TOP = EAVE + ROOF_R * (1 - Math.cos(ROOF_A))
const NOSE = 0.38 // 앞 얼굴이 꺾여 들어가는 깊이
const WIRE_Y = 5.12 // 가선 높이 (차 기준, jm_seaLine RAIL_Y + 전선 5.42 - RAIL_Y)

const M = {
  maroon: mat('#7b2c22', { roughness: 0.75 }),
  maroonDark: mat('#5a1f18', { roughness: 0.8 }),
  cream: mat('#ecd3a0', { roughness: 0.7 }),
  creamIn: mat('#f3e3c2', { roughness: 0.85 }),
  roof: mat('#5e2219', { roughness: 0.65 }),
  ceiling: new THREE.MeshStandardMaterial({ color: '#f6ead0', emissive: '#f6dfb0', emissiveIntensity: 0.18, side: THREE.BackSide, roughness: 0.9 }),
  iron: mat('#2a2522', { roughness: 0.55, metalness: 0.45 }),
  brass: mat('#c49a45', { metalness: 0.7, roughness: 0.35 }),
  wood: mat('#8a6440', { roughness: 0.85 }),
  floor: mat('#a07a50', { roughness: 0.9 }),
  seat: mat('#a2302a', { roughness: 0.8 }),
  seatBack: mat('#8b2722', { roughness: 0.8 }),
  glass: mat('#cfe8ee', { transparent: true, opacity: 0.3, roughness: 0.08, double: true }),
  white: mat('#ffffff', { roughness: 0.8 }),
  lamp: mat('#fff4d6', { emissive: '#ffd99a', emissiveIntensity: 1.3 }),
  head: mat('#fffbe8', { emissive: '#fff1b8', emissiveIntensity: 2.2 }),
  marker: mat('#ff6a4a', { emissive: '#ff3b1f', emissiveIntensity: 1.4 }),
  strap: mat('#efe4c8', { roughness: 0.7 }),
  dark: new THREE.MeshBasicMaterial({ color: '#1a1512' }),
}

function plankTexture() {
  return canvasTexture('jmseatram:plank', 256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#7b2c22'
    ctx.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = `rgba(255,220,180,${0.03 + ((x * 7) % 5) * 0.012})`
      ctx.fillRect(x + 2, 0, 12, h)
      ctx.fillStyle = 'rgba(30,8,4,0.5)'
      ctx.fillRect(x, 0, 2, h)
    }
  })
}

// 지붕 둥근 끝 막이 (끝벽 위 활 모양). y 0 = 지붕 시작 높이
let capGeo = null
function roofCap() {
  if (capGeo) return capGeo
  const shape = new THREE.Shape()
  const cy = -ROOF_R * Math.cos(ROOF_A)
  shape.moveTo(-ROOF_R * Math.sin(ROOF_A), 0)
  for (let i = 0; i <= 14; i++) {
    const a = -ROOF_A + (2 * ROOF_A * i) / 14
    shape.lineTo(ROOF_R * Math.sin(a), ROOF_R * Math.cos(a) + cy)
  }
  shape.lineTo(ROOF_R * Math.sin(ROOF_A), 0)
  capGeo = new THREE.ShapeGeometry(shape)
  return capGeo
}

// 두 점(y, z)을 잇는 가는 막대 (집전장치 팔)
function Rod({ x, a, b, t = 0.05, m }) {
  const dy = b[0] - a[0]
  const dz = b[1] - a[1]
  const L = Math.hypot(dy, dz)
  return <Box p={[x, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2]} s={[t, L, t]} r={[Math.atan2(dz, dy), 0, 0]} m={m} />
}

function Pantograph() {
  const y0 = ROOF_TOP + 0.14
  const knee = [y0 + 0.5, 0.42]
  const top = [WIRE_Y - 0.06, -0.08]
  return (
    <group>
      <Box p={[0, ROOF_TOP + 0.05, 0]} s={[1.1, 0.08, 1.0]} m={M.iron} />
      {[-0.42, 0.42].map((x) => (
        <Cyl key={x} p={[x, ROOF_TOP + 0.1, 0]} rad={0.07} h={0.12} m={M.cream} geo={GEO.cyl8} />
      ))}
      {[-0.3, 0.3].map((x) => (
        <group key={x}>
          <Rod x={x} a={[y0, -0.45]} b={knee} m={M.iron} />
          <Rod x={x} a={knee} b={top} t={0.04} m={M.iron} />
        </group>
      ))}
      <Box p={[0, top[0], top[1]]} s={[0.66, 0.04, 0.04]} m={M.iron} />
      {/* 집전판 + 양끝 휘어진 뿔 */}
      <Box p={[0, WIRE_Y - 0.02, top[1]]} s={[1.3, 0.05, 0.12]} m={M.brass} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 0.75, WIRE_Y - 0.08, top[1]]} s={[0.22, 0.04, 0.06]} r={[0, 0, s * -0.5]} m={M.iron} />
      ))}
    </group>
  )
}

// 옆벽 한 쪽 (s = -1 | 1). 문은 +x 쪽에만. z0~z1: 벽이 이어지는 구간
function SideWall({ s, z0, z1, planks, sign }) {
  const doors = s > 0 ? [-TRAM.doorZ, TRAM.doorZ] : []
  const segs = useMemo(() => {
    const out = []
    let a = z0
    for (const d of doors) {
      out.push([a, d - TRAM.doorW / 2])
      a = d + TRAM.doorW / 2
    }
    out.push([a, z1])
    return out.filter(([p, q]) => q - p > 0.05)
  }, [z0, z1, s])
  const parts = useMemo(() => {
    const pillars = []
    const glass = []
    for (const [a, b] of segs) {
      const L = b - a
      const n = Math.max(1, Math.round(L / 1.1))
      for (let i = 0; i <= n; i++) pillars.push({ p: [s * (W / 2 - 0.03), FL + 1.55, a + (L * i) / n], s: [0.09, 1.0, i === 0 || i === n ? 0.16 : 0.11] })
      glass.push({ p: [s * (W / 2 - 0.04), FL + 1.55, (a + b) / 2], s: [0.02, 0.98, L - 0.06] })
    }
    return { pillars, glass }
  }, [segs, s])
  return (
    <group>
      {segs.map(([a, b]) => (
        <group key={a}>
          {/* 아래 판: 안쪽 판 + 바깥 나무판 그림 + 놋쇠 띠 */}
          <Box p={[s * (W / 2 - 0.05), FL + 0.5, (a + b) / 2]} s={[0.06, 1.0, b - a]} m={M.creamIn} />
          <mesh position={[s * (W / 2 + 0.001), FL + 0.5, (a + b) / 2]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[b - a, 1.0]} />
            <meshStandardMaterial map={planks} roughness={0.75} />
          </mesh>
          <Box p={[s * (W / 2 + 0.01), FL + 1.03, (a + b) / 2]} s={[0.05, 0.07, b - a]} m={M.brass} />
          <Box p={[s * (W / 2 - 0.02), FL + 1.05, (a + b) / 2]} s={[0.16, 0.04, b - a]} m={M.wood} />
          {/* 창 아래 차체 끝(물 쪽) 선 */}
          <Box p={[s * (W / 2 + 0.01), FL + 0.02, (a + b) / 2]} s={[0.06, 0.08, b - a]} m={M.maroonDark} />
        </group>
      ))}
      <Instances geometry={GEO.box} material={M.cream} items={parts.pillars} />
      <Instances geometry={GEO.box} material={M.glass} items={parts.glass} />
      {/* 창 위 글자판 (문 위로도 이어짐) + 빗물받이 */}
      <Box p={[s * (W / 2 - 0.03), (FL + 2.05 + EAVE) / 2, (z0 + z1) / 2]} s={[0.08, EAVE - FL - 2.05, z1 - z0]} m={M.cream} />
      <Box p={[s * (W / 2 + 0.05), EAVE + 0.01, (z0 + z1) / 2]} s={[0.08, 0.05, z1 - z0 + 0.1]} m={M.roof} />
      <mesh position={[s * (W / 2 + 0.012), FL + 2.27, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
        <planeGeometry args={[1.5, 0.34]} />
        <meshStandardMaterial map={sign} roughness={0.7} />
      </mesh>
    </group>
  )
}

// 미닫이 문짝 한 장. 바깥 벽 바로 앞에서 z로 미끄러짐 (refs에 담아 jm_seaLine이 매 프레임 옮김)
function DoorLeaf({ leafRef, z }) {
  // 문짝도 한 장 안의 부품 6개를 재질별로 합침 (문짝은 움직이니 차 전체 합치기에선 빠지고, 문짝마다 따로)
  const root = useRef(null)
  const holder = useRef(null)
  useLayoutEffect(() => {
    if (root.current && holder.current) rebuild(root.current, holder.current)
    const h = holder.current
    return () => {
      for (const c of [...(h?.children ?? [])]) c.geometry.dispose()
    }
  }, [])
  return (
    <group ref={leafRef} position={[W / 2 + 0.035, FL, z]} userData={{ noMerge: true }}>
      <group ref={holder} />
      <group ref={root}>
      <Box p={[0, 0.5, 0]} s={[0.04, 1.0, 0.6]} m={M.maroon} />
      <Box p={[0, 1.95, 0]} s={[0.04, 0.1, 0.6]} m={M.cream} />
      {[-1, 1].map((k) => (
        <Box key={k} p={[0, 1.45, k * 0.26]} s={[0.04, 0.9, 0.08]} m={M.cream} />
      ))}
      <Box p={[0, 1.02, 0]} s={[0.04, 0.06, 0.6]} m={M.cream} />
      <Box p={[0, 1.45, 0]} s={[0.015, 0.86, 0.44]} m={M.glass} />
      <Box p={[0.03, 0.95, 0]} s={[0.03, 0.04, 0.3]} m={M.brass} />
      </group>
    </group>
  )
}

// 운전석 얼굴 (e = 1 | -1, 차 끝 z = e*LEN/2)
function CabFace({ e, sign, numberTex }) {
  const zc = e * (LEN / 2)
  const side = Math.hypot(W / 2 - 0.7, NOSE)
  const ang = Math.atan2(NOSE, W / 2 - 0.7)
  // 가운데 판(폭 1.4) + 양옆 꺾인 판. 판 하나 = 아래 밤색 + 앞창 + 위 크림
  const panel = (wid) => (
    <>
      <Box p={[0, FL + 0.5, 0]} s={[wid, 1.0, 0.07]} m={M.maroon} />
      <Box p={[0, FL + 1.04, 0.01 * e]} s={[wid, 0.07, 0.08]} m={M.brass} />
      <Box p={[0, FL + 1.55, 0]} s={[wid - 0.12, 0.92, 0.02]} m={M.glass} />
      {[-1, 1].map((k) => (
        <Box key={k} p={[(k * wid) / 2, FL + 1.55, 0]} s={[0.1, 1.0, 0.08]} m={M.cream} />
      ))}
      <Box p={[0, (FL + 2.05 + EAVE) / 2, 0]} s={[wid, EAVE - FL - 2.05, 0.08]} m={M.cream} />
    </>
  )
  return (
    <group>
      <group position={[0, 0, zc]}>{panel(1.4)}</group>
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (0.7 + (W / 2 - 0.7) / 2), 0, zc - (e * NOSE) / 2]} rotation={[0, -k * e * ang, 0]}>
          {panel(side)}
        </group>
      ))}
      {/* 행선판 (빛남) */}
      <mesh position={[0, FL + 2.27, zc + e * 0.045]} rotation={[0, e > 0 ? 0 : Math.PI, 0]}>
        <planeGeometry args={[1.1, 0.32]} />
        <GlowMaterial glow={0.6} map={sign} />
      </mesh>
      {/* 번호판 */}
      <mesh position={[0, FL + 0.72, zc + e * 0.045]} rotation={[0, e > 0 ? 0 : Math.PI, 0]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshStandardMaterial map={numberTex} roughness={0.6} />
      </mesh>
      {/* 지붕 위 전조등 + 테 */}
      <Cyl p={[0, ROOF_TOP - 0.05, zc - e * 0.25]} rad={0.2} h={0.22} m={M.iron} r={[Math.PI / 2, 0, 0]} />
      <Ball p={[0, ROOF_TOP - 0.05, zc - e * 0.13]} rad={0.15} m={M.head} />
      {/* 아래 표지등 · 범퍼 · 연결기 · 치마 */}
      {[-0.5, 0.5].map((x) => (
        <Ball key={x} p={[x, FL + 0.28, zc + e * 0.05]} rad={0.07} m={M.marker} />
      ))}
      <Box p={[0, FL - 0.12, zc + e * 0.08]} s={[W - 0.5, 0.18, 0.18]} m={M.iron} />
      <Box p={[0, FL - 0.35, zc + e * 0.2]} s={[0.22, 0.16, 0.32]} m={M.iron} />
      <Box p={[0, FL - 0.42, zc - e * 0.1]} s={[W - 0.7, 0.4, 0.06]} m={M.maroonDark} />
      {/* 안: 운전대 + 놋쇠 손잡이 + 운전석 의자 */}
      <group position={[0.42, FL, zc - e * 0.75]}>
        <Box p={[0, 0.5, 0]} s={[0.8, 1.0, 0.4]} m={M.wood} />
        <Cyl p={[0.15, 1.08, 0]} rad={0.13} h={0.05} m={M.brass} />
        <Box p={[-0.2, 1.15, 0]} s={[0.04, 0.3, 0.04]} r={[e * 0.4, 0, 0]} m={M.brass} />
        <Cyl p={[0, 0.45, -e * 0.55]} rad={0.2} h={0.08} m={M.seat} />
        <Cyl p={[0, 0.22, -e * 0.55]} rad={0.04} h={0.44} m={M.iron} geo={GEO.cyl8} />
      </group>
    </group>
  )
}

// 연결 끝벽 (e 쪽 끝, 가운데 통로문) + bellows: 옆 칸과 잇는 주름막
function LinkEnd({ e, bellows }) {
  const zc = e * (LEN / 2 - 0.04)
  return (
    <group position={[0, 0, zc]}>
      {[-1, 1].map((k) => (
        <Box key={k} p={[k * (W / 4 + 0.22), FL + 1.25, 0]} s={[W / 2 - 0.44, 2.5, 0.08]} m={M.creamIn} />
      ))}
      <Box p={[0, FL + 2.3, 0]} s={[0.88, 0.4, 0.08]} m={M.creamIn} />
      <Box p={[0, FL + 1.05, -e * 0.01]} s={[0.86, 2.1, 0.03]} m={M.wood} />
      <Box p={[0, FL + 1.5, -e * 0.03]} s={[0.4, 0.55, 0.02]} m={M.glass} />
      <Box p={[0, FL / 2, e * 0.02]} s={[W - 0.2, FL, 0.08]} m={M.maroonDark} />
      {bellows && <Box p={[0, FL + 1.15, e * 0.14]} s={[1.3, 2.3, 0.28]} m={M.dark} />}
    </group>
  )
}

function Bogie({ z }) {
  return (
    <group position={[0, 0, z]}>
      <Box p={[0, 0.42, 0]} s={[W - 0.5, 0.22, 2.0]} m={M.iron} />
      {[-1, 1].flatMap((s) => [-0.6, 0.6].map((dz) => <Cyl key={`${s}${dz}`} p={[s * 0.75, 0.36, dz]} rad={0.36} h={0.12} m={M.iron} r={[0, 0, Math.PI / 2]} />))}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 0.84, 0.5, 0]} s={[0.06, 0.12, 1.6]} m={M.brass} />
      ))}
    </group>
  )
}

/**
 * head: 운전석 쪽(1 = +z, -1 = -z), sign: 행선판 글자, number: 차 번호(1·2), pantograph: 집전장치 달기, bellows: 주름막 달기
 * doorRefs: [문 0 왼짝, 문 0 오른짝, 문 1 왼짝, 문 1 오른짝] 그룹을 담을 배열 (jm_seaLine이 열고 닫음)
 */
export function SeaTramCar({ head = 1, sign = '湯灯 ⇄ 京城', number = 1, pantograph = false, bellows = false, doorRefs }) {
  const planks = useMemo(() => plankTexture(), [])
  const signTex = getJpSignTexture(sign, '#1c1712', '#ffe7a8', 3.4)
  const sideTex = getJpSignTexture('湯灯電鉄', '#ecd3a0', '#5a1f18', 4.4)
  const numberTex = getJpSignTexture(number === 1 ? '壱' : '弐', '#f3e6c8', '#5a1f18', 1)
  const z0 = head < 0 ? -LEN / 2 + NOSE : -LEN / 2
  const z1 = head > 0 ? LEN / 2 - NOSE : LEN / 2
  const inside = useMemo(() => {
    const straps = []
    const lamps = []
    for (const x of [-0.62, 0.62]) for (let z = -LEN / 2 + 1.6; z <= LEN / 2 - 1.6; z += 0.75) straps.push({ p: [x, EAVE - 0.2, z], s: [0.09, 0.09, 0.02] })
    for (const z of [-3, 0, 3]) lamps.push({ p: [0, EAVE + 0.3, z], s: [0.16, 0.1, 0.16] })
    return { straps, lamps }
  }, [])
  // (11/27 최적화) 안 움직이는 부품(문짝 빼고 전부)을 재질별로 한 덩어리로 합쳐 그림 — 한 칸 메시 약 150개 → 수십 개
  //   (애니 구역 jm_perf.jsx rebuild와 같은 방식. 모양은 한 번만 만들어지고 바뀌지 않아서 처음 한 번만 합침)
  const root = useRef(null)
  const holder = useRef(null)
  useLayoutEffect(() => {
    if (root.current && holder.current) rebuild(root.current, holder.current)
    const h = holder.current
    return () => {
      for (const c of [...(h?.children ?? [])]) c.geometry.dispose()
    }
  }, [])
  const benches = [
    { x: -W / 2 + 0.36, a: -LEN / 2 + 1.25, b: LEN / 2 - 1.25, f: 1 },
    { x: W / 2 - 0.36, a: -TRAM.doorZ + TRAM.doorW / 2 + 0.15, b: TRAM.doorZ - TRAM.doorW / 2 - 0.15, f: -1 },
  ]
  return (
    <>
    <group ref={root}>
      <Bogie z={-LEN / 2 + 2.1} />
      <Bogie z={LEN / 2 - 2.1} />
      {/* 차대 + 바닥 */}
      <Box p={[0, FL - 0.2, 0]} s={[W - 0.3, 0.3, LEN - 1.0]} m={M.iron} />
      <Box p={[0, FL - 0.03, (z0 + z1) / 2]} s={[W, 0.06, z1 - z0]} m={M.maroonDark} />
      <Box p={[0, FL + 0.012, 0]} s={[W - 0.16, 0.02, LEN - 0.3]} m={M.floor} />
      {[-1, 1].map((s) => (
        <SideWall key={s} s={s} z0={z0} z1={z1} planks={planks} sign={sideTex} />
      ))}
      {/* 문 자리: 발판 + 문틀 위 놋쇠 */}
      {[-TRAM.doorZ, TRAM.doorZ].map((z) => (
        <group key={z}>
          <Box p={[W / 2 + 0.16, FL - 0.32, z]} s={[0.32, 0.06, TRAM.doorW]} m={M.iron} />
          <Box p={[W / 2 - 0.02, FL + 2.08, z]} s={[0.1, 0.06, TRAM.doorW + 0.1]} m={M.brass} />
          <Box p={[W / 2 - 0.25, FL + 1.0, z - TRAM.doorW / 2 - 0.02]} s={[0.04, 1.4, 0.04]} m={M.brass} />
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => {
        const d = i < 2 ? -TRAM.doorZ : TRAM.doorZ
        return <DoorLeaf key={i} z={d + (i % 2 ? 0.3 : -0.3)} leafRef={(el) => doorRefs && (doorRefs[i] = el)} />
      })}
      {/* 끝 */}
      {head > 0 ? <CabFace e={1} sign={signTex} numberTex={numberTex} /> : <LinkEnd e={1} bellows={bellows} />}
      {head < 0 ? <CabFace e={-1} sign={signTex} numberTex={numberTex} /> : <LinkEnd e={-1} bellows={bellows} />}
      {/* 지붕: 겉(밤색) + 안(크림 천장) + 끝 막이 + 가운데 환기창 줄 */}
      <mesh position={[0, EAVE - ROOF_R * Math.cos(ROOF_A), 0]} rotation={[Math.PI / 2, 0, 0]} material={M.roof}>
        <cylinderGeometry args={[ROOF_R, ROOF_R, LEN + 0.1, 22, 1, true, Math.PI - ROOF_A, ROOF_A * 2]} />
      </mesh>
      <mesh position={[0, EAVE - ROOF_R * Math.cos(ROOF_A) - 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.ceiling}>
        <cylinderGeometry args={[ROOF_R, ROOF_R, LEN - 0.1, 22, 1, true, Math.PI - ROOF_A, ROOF_A * 2]} />
      </mesh>
      {[-1, 1].map((e) => (
        <mesh key={e} geometry={roofCap()} material={M.roof} position={[0, EAVE, e * (LEN / 2 + 0.05)]} rotation={[0, e > 0 ? 0 : Math.PI, 0]} />
      ))}
      {[-1, 1].map((k) => (
        <group key={k}>
          <Box p={[0, ROOF_TOP + 0.1, k * (LEN / 4 + 0.6)]} s={[0.9, 0.2, LEN / 2 - 2.6]} m={M.roof} />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * 0.46, ROOF_TOP + 0.1, k * (LEN / 4 + 0.6)]} s={[0.02, 0.1, LEN / 2 - 3.0]} m={M.lamp} />
          ))}
        </group>
      ))}
      {pantograph ? <Pantograph /> : <Box p={[0, ROOF_TOP + 0.08, 0]} s={[0.7, 0.16, 0.7]} m={M.iron} />}
      {/* 안: 긴 의자 */}
      {benches.map(({ x, a, b, f }) => (
        <group key={x}>
          <Box p={[x, FL + 0.43, (a + b) / 2]} s={[0.56, 0.12, b - a]} m={M.seat} />
          <Box p={[x, FL + 0.2, (a + b) / 2]} s={[0.5, 0.38, b - a - 0.1]} m={M.wood} />
          <Box p={[x - f * 0.25, FL + 0.82, (a + b) / 2]} s={[0.1, 0.66, b - a]} m={M.seatBack} />
          <Box p={[x - f * 0.22, FL + 1.18, (a + b) / 2]} s={[0.05, 0.05, b - a]} m={M.brass} />
        </group>
      ))}
      {/* 손잡이 막대 + 고리, 천장 등 */}
      {[-0.62, 0.62].map((x) => (
        <Box key={x} p={[x, EAVE + 0.02, 0]} s={[0.03, 0.03, LEN - 2.6]} m={M.brass} />
      ))}
      <Instances geometry={GEO.box} material={M.strap} items={inside.straps} />
      <Instances geometry={GEO.box} material={M.lamp} items={inside.lamps} />
    </group>
    <group ref={holder} />
    </>
  )
}
