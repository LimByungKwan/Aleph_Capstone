import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Cyl, GEO, Instances, mat } from './kit.jsx'
import { canvasTexture, getJpSignTexture } from './jm_landmarks.jsx'
import { withMerge } from './jm_perf.jsx'

// 애니 구역(JM) 바다 위 湯灯駅 — 담당: 지민 (11/27, A안: 여관 앞 부두에서 서쪽 바다 위로)
// 작은 시골 무인역(11/27 지민 선택 1안 「시골 바닷가 정류장」): 콘크리트 승강장 + 박공 지붕 + 파란 긴 의자 + 세로 역 기둥
//   + 가로 역 이름판 + 뒤쪽 나무 울타리 + 승차권 발매기(여기서 E로 전차 부르기)
// 좌표 = 역에 선 전차 기준 (x+ = 승강장 쪽, z = 선로 방향, z+ = 옛 부두·여관 쪽). 승강장 윗면 = STATION.top
export const STATION = { top: 0.9, edge: 1.42, width: 3.4, len: 30 }
const { top: T, edge: E0, width: PW, len: PL } = STATION
const CX = E0 + PW / 2 // 승강장 가운데 x
const BACK = E0 + PW // 승강장 바깥(바다 쪽) 끝 x
/** 승차권 발매기(= 「E 바다 전차 부르기」 자리) 위치 (전차 기준) */
export const TICKET_SPOT = [BACK - 0.9, T, 6.6]

const M = {
  concrete: mat('#bdb6aa', { roughness: 0.95 }),
  concreteDark: mat('#9d968a', { roughness: 1 }),
  edge: mat('#e8c84a', { roughness: 0.7 }),
  white: mat('#ece8de', { roughness: 0.7 }),
  roof: mat('#6f747a', { roughness: 0.55, metalness: 0.3 }),
  roofDark: mat('#4a4c52', { roughness: 0.7 }),
  rafter: mat('#d8cdb4', { roughness: 0.8 }),
  bench: mat('#2f6fb3', { roughness: 0.6 }),
  fence: mat('#e7cfa6', { roughness: 0.85 }),
  pole: mat('#6b5a48', { roughness: 0.9 }),
  redDark: mat('#6e2419', { roughness: 0.8 }),
  orange: mat('#d9772b', { roughness: 0.6 }),
  iron: mat('#2a2522', { roughness: 0.55, metalness: 0.4 }),
  glass: mat('#cfe8ee', { transparent: true, opacity: 0.35, roughness: 0.1, double: true }),
  lamp: mat('#fff1cf', { emissive: '#ffd690', emissiveIntensity: 1.4 }),
}

// 세로 역 이름판 (짙은 남색 + 흰 글씨): 湯灯 / 유토
function verticalSign() {
  return canvasTexture('jmseastation:vsign', 96, 384, (ctx, w, h) => {
    ctx.fillStyle = '#1f2f5c'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 4
    ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 66px serif'
    ctx.fillText('湯', w / 2, 80)
    ctx.fillText('灯', w / 2, 160)
    ctx.font = 'bold 40px sans-serif'
    ctx.fillText('유', w / 2, 250)
    ctx.fillText('토', w / 2, 310)
  })
}

// 두 점 사이 막대 (x-y 평면 안, z 고정) — 지붕 버팀대
function Strut({ a, b, z, t = 0.09, m }) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return <Box p={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} s={[t, Math.hypot(dx, dy), t]} r={[0, 0, -Math.atan2(dx, dy)]} m={m} />
}

// ── 공통: 승강장 + 계단 + 가장자리 선 + 역 이름판(가로) + 뒤쪽 나무 울타리 ──
function Platform({ fenceFrom = -PL / 2, fenceTo = PL / 2, gaps = [] }) {
  const fence = useMemo(() => {
    const pickets = []
    const posts = []
    for (let z = fenceFrom; z <= fenceTo; z += 0.24) {
      if (gaps.some(([a, b]) => z > a && z < b)) continue
      pickets.push({ p: [BACK - 0.1, T + 0.5, z], s: [0.05, 0.95 + ((Math.round(z / 0.24) % 2) * 0.06), 0.13] })
    }
    for (let z = fenceFrom; z <= fenceTo + 0.01; z += 2.4) if (!gaps.some(([a, b]) => z > a && z < b)) posts.push({ p: [BACK - 0.1, T + 0.6, z], s: [0.14, 1.2, 0.14] })
    return { pickets, posts }
  }, [fenceFrom, fenceTo, gaps])
  const nameTex = getJpSignTexture('湯灯駅', '#f4efe2', '#2a2a2a', 3)
  return (
    <group>
      <Box p={[CX, T / 2 - 0.15, 0]} s={[PW, T + 0.3, PL]} m={M.concrete} />
      <Box p={[CX, T + 0.005, 0]} s={[PW - 0.05, 0.01, PL - 0.05]} m={M.concreteDark} />
      <Box p={[E0 + 0.35, T + 0.012, 0]} s={[0.22, 0.012, PL - 0.2]} m={M.edge} />
      {/* 여관 쪽 끝 계단 (선로 옆 물길에서 올라옴) */}
      {[0, 1, 2].map((i) => (
        <Box key={i} p={[CX, (T * (3 - i)) / 4 - 0.1, PL / 2 + 0.35 + i * 0.4]} s={[PW - 0.6, 0.25, 0.4]} m={M.concrete} />
      ))}
      {/* 울타리 (사진 2: 뾰족한 나무 판 울타리) */}
      <Instances geometry={GEO.box} material={M.fence} items={fence.pickets} />
      <Instances geometry={GEO.box} material={M.fence} items={fence.posts} />
      {[0.35, 0.8].map((y) => (
        <Box key={y} p={[BACK - 0.13, T + y, (fenceFrom + fenceTo) / 2]} s={[0.04, 0.07, fenceTo - fenceFrom]} m={M.fence} />
      ))}
      {/* 가로 역 이름판 (두 기둥) */}
      <group position={[CX + 0.6, T, -11]}>
        {[-0.85, 0.85].map((z) => (
          <Box key={z} p={[0, 1.0, z]} s={[0.08, 2.0, 0.08]} m={M.white} />
        ))}
        <mesh position={[0, 1.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.9, 0.64]} />
          <meshStandardMaterial map={nameTex} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

// 승차권 발매기 (주황 상자 + 「승차권」 글자 + 빛나는 표 나오는 곳)
function TicketMachine({ p, yaw = -Math.PI / 2 }) {
  const tex = getJpSignTexture('승차권', '#fff6e0', '#a4441c', 2.2)
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <Box p={[0, 0.7, 0]} s={[0.7, 1.4, 0.55]} m={M.orange} />
      <Box p={[0, 1.45, 0.04]} s={[0.8, 0.1, 0.65]} m={M.redDark} />
      <mesh position={[0, 1.15, 0.281]}>
        <planeGeometry args={[0.56, 0.25]} />
        <meshStandardMaterial map={tex} />
      </mesh>
      <Box p={[0, 0.85, 0.28]} s={[0.4, 0.22, 0.02]} m={M.glass} />
      <Box p={[0, 0.55, 0.285]} s={[0.26, 0.04, 0.02]} m={M.lamp} />
      <Cyl p={[0.24, 0.75, 0.3]} rad={0.05} h={0.06} m={M.iron} r={[Math.PI / 2, 0, 0]} />
    </group>
  )
}

// ── 1안: 시골 바닷가 정류장 (사진 1) ──
function Variant1() {
  const vtex = verticalSign()
  const rafters = useMemo(() => {
    const out = []
    for (let z = -5.2; z <= 5.21; z += 1.3) out.push({ p: [CX, T + 2.88, z], s: [PW + 0.2, 0.06, 0.08] })
    return out
  }, [])
  const ridge = BACK - 1.2
  return (
    <group>
      <Platform />
      {/* 기둥 3개 + 버팀대 (뒤쪽 줄) */}
      {[-4, 0, 4].map((z) => (
        <group key={z}>
          <Box p={[ridge, T + 1.45, z]} s={[0.14, 2.9, 0.14]} m={M.white} />
          <Box p={[ridge, T + 0.25, z]} s={[0.42, 0.5, 0.42]} m={M.concreteDark} />
          <Strut a={[ridge, T + 2.2]} b={[ridge - 1.4, T + 2.9]} z={z} m={M.white} />
          <Strut a={[ridge, T + 2.2]} b={[ridge + 0.8, T + 2.9]} z={z} m={M.white} />
        </group>
      ))}
      {/* 박공 지붕: 앞(선로 쪽)으로 길게 + 뒤로 짧게 */}
      <Box p={[(ridge + E0 + 0.1) / 2, T + 3.05, 0]} s={[ridge - E0 - 0.05, 0.07, 11.4]} r={[0, 0, 0.18]} m={M.roof} />
      <Box p={[(ridge + BACK + 0.2) / 2, T + 3.07, 0]} s={[BACK + 0.25 - ridge, 0.07, 11.4]} r={[0, 0, -0.32]} m={M.roof} />
      <Box p={[ridge, T + 3.24, 0]} s={[0.16, 0.1, 11.6]} m={M.roofDark} />
      <Instances geometry={GEO.box} material={M.rafter} items={rafters} />
      {[-1, 1].map((e) => (
        <Box key={e} p={[CX - 0.1, T + 2.95, e * 5.7]} s={[PW - 0.2, 0.32, 0.05]} m={M.white} />
      ))}
      <Box p={[CX, T + 2.8, 0]} s={[0.08, 0.08, 10.4]} m={M.lamp} />
      {/* 파란 긴 의자 2개 (선로 쪽을 봄) */}
      {[-2, 2].map((z) => (
        <group key={z} position={[ridge - 0.45, T, z]}>
          <Box p={[0, 0.45, 0]} s={[0.46, 0.07, 1.8]} m={M.bench} />
          {[-0.75, 0.75].map((dz) => (
            <Box key={dz} p={[0, 0.21, dz]} s={[0.42, 0.42, 0.32]} m={M.concreteDark} />
          ))}
        </group>
      ))}
      {/* 세로 역 기둥 + 전봇대(스피커·등) */}
      <group position={[BACK - 0.45, T, -7.2]}>
        <Cyl p={[0, 2.6, 0]} rad={0.11} h={5.2} m={M.pole} geo={GEO.cyl8} />
        <mesh position={[-0.13, 2.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.42, 1.68]} />
          <meshStandardMaterial map={vtex} side={THREE.DoubleSide} />
        </mesh>
        <Box p={[-0.35, 4.3, 0]} s={[0.5, 0.08, 0.08]} m={M.iron} />
        <Box p={[-0.6, 4.2, 0]} s={[0.25, 0.18, 0.2]} m={M.white} />
        <Box p={[-0.2, 3.7, 0.18]} s={[0.22, 0.28, 0.12]} m={M.iron} />
      </group>
      <TicketMachine p={TICKET_SPOT} />
    </group>
  )
}

// (11/27 최적화) 역은 안 움직이니 재질별로 한 덩어리로 합쳐 그림 (메시 약 60개 → 십여 개)
export const JmSeaStation = withMerge(Variant1)
