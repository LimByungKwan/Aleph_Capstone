import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Box, Cyl, mat } from './kit.jsx'

// 애니 구역 입구 「붉은 터널 건물」 (11/25) — 담당: 지민
// 모티브: 「센과 치히로의 행방불명」 첫 장면의 터널 입구 (숲길 끝 붉은 회벽 건물 + 시계탑 같은 탑, 아래 아치형 어두운 터널,
//   앞에 두 얼굴 돌 석상, 길가 작은 돌 사당 / 터널을 빠져나오면 색유리 빛이 드는 대합실 같은 홀 → 밖은 온천 거리)
// 영화 속 건물을 그대로 옮기지 않고 공통 요소로만 만든 독자 디자인
// 소품 하나로 그림: size [폭, 높이, 길이], 로컬 +z = 남쪽(입구 쪽). 로컬 z: 건물 앞 +9 ~ 뒤 +3, 터널 +3 ~ -3, 홀 -3 ~ -9
// 걷는 판정(건물 양쪽 덩어리·터널 벽·홀 벽)은 생성 스크립트가 jmCollider로 (같은 숫자 TUNNEL)

export const TUNNEL = { pass: 3.6, passH: 4.0, gate: { z0: 3, z1: 9, w: 14, h: 8.2 }, tube: { z0: -3, z1: 3 }, hall: { z0: -9, z1: -3, w: 10, h: 5.2 } }

const RED_PLASTER = mat('#b4483b', { roughness: 0.95 })
const RED_DARK = mat('#8d3328', { roughness: 0.95 })
const TRIM = mat('#efe3c8', { roughness: 0.9 })
const STONE = mat('#8a8378', { roughness: 1, flat: true })
const STONE_DARK = mat('#5d5850', { roughness: 1, flat: true })
const ROOF = mat('#3c4a4a', { flat: true, roughness: 0.8, double: true })
const DARK = mat('#0b0a09', { roughness: 1 })
const TUBE_WALL = mat('#3a3631', { roughness: 1, double: true })
const LAMP = mat('#ffe7b0', { emissive: '#ffc46a', emissiveIntensity: 1.4 })
const MOUND = mat('#5f7d45', { flat: true, roughness: 1 })
const MOUND_DARK = mat('#4b6638', { flat: true, roughness: 1 })
const HALL_WALL = mat('#e6dac0', { roughness: 0.95 })
const HALL_FLOOR = mat('#8c7a62', { roughness: 0.9 })
const BENCH = mat('#5a3d2a', { roughness: 0.85 })
const GLASS = ['#d94f4f', '#e8b04a', '#4f8fd9', '#59b36b', '#b05fd0'].map((c) => mat(c, { emissive: c, emissiveIntensity: 0.9, roughness: 0.3 }))
const MOSS = mat('#55704a', { roughness: 1 })

// 아치 모양 판(가운데가 뚫린 반원 아치 위쪽 벽) — 터널 입구 둘레
function archRing(outerW, h, innerW, innerH) {
  const s = new THREE.Shape()
  s.moveTo(-outerW / 2, 0)
  s.lineTo(-outerW / 2, h)
  s.lineTo(outerW / 2, h)
  s.lineTo(outerW / 2, 0)
  s.lineTo(innerW / 2, 0)
  const r = innerW / 2
  const spring = innerH - r
  s.lineTo(innerW / 2, spring)
  s.absarc(0, spring, r, 0, Math.PI, false)
  s.lineTo(-innerW / 2, 0)
  s.lineTo(-outerW / 2, 0)
  return new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false })
}

// 반원 굴 (터널 천장)
function vaultGeometry(w, h, len) {
  const r = w / 2
  const g = new THREE.CylinderGeometry(r, r, len, 20, 1, true, -Math.PI / 2, Math.PI)
  g.rotateX(-Math.PI / 2) // 축 Y → Z, 반원이 위쪽으로
  g.translate(0, h - r, 0)
  return g
}

export function JmTunnelGate() {
  const { pass, passH, gate, tube, hall } = TUNNEL
  const geo = useMemo(() => {
    const front = archRing(gate.w, gate.h, pass, passH)
    const back = archRing(gate.w, gate.h, pass, passH)
    const hallBack = archRing(hall.w, hall.h, pass, passH)
    const hallFront = archRing(hall.w, hall.h, pass, passH)
    const vault = vaultGeometry(pass, passH, tube.z1 - tube.z0 + 0.2)
    const towerRoof = hipRoofGeometry(4.6, 4.6, 2.2, 0.15)
    const gateRoof = hipRoofGeometry(gate.w + 0.8, gate.z1 - gate.z0 + 0.8, 1.6, 0.2)
    const hallRoof = hipRoofGeometry(hall.w + 0.8, hall.z1 - hall.z0 + 0.8, 1.2, 0.15)
    return { front, back, hallBack, hallFront, vault, towerRoof, gateRoof, hallRoof }
  }, [gate.w, gate.h, gate.z0, gate.z1, hall.w, hall.h, hall.z0, hall.z1, pass, passH, tube.z0, tube.z1])
  const gz = (gate.z0 + gate.z1) / 2
  const gd = gate.z1 - gate.z0
  const hz = (hall.z0 + hall.z1) / 2
  const hd = hall.z1 - hall.z0
  const side = (gate.w - pass) / 2
  return (
    <group>
      {/* ── 붉은 회벽 건물 (앞 아치 + 양쪽 덩어리 + 탑) ── */}
      <mesh geometry={geo.front} material={RED_PLASTER} position={[0, 0, gate.z1 - 0.6]} />
      <mesh geometry={geo.back} material={RED_PLASTER} position={[0, 0, gate.z0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (pass / 2 + side / 2), gate.h / 2, gz]} s={[side, gate.h, gd - 1.1]} m={RED_PLASTER} />
          {/* 아래 돌 띠 + 흰 테두리 띠 + 작은 창 */}
          <Box p={[s * (pass / 2 + side / 2), 0.5, gate.z1 + 0.02]} s={[side, 1, 0.12]} m={STONE} />
          <Box p={[s * (pass / 2 + side / 2), gate.h - 0.5, gate.z1 + 0.04]} s={[side + 0.1, 0.3, 0.16]} m={TRIM} />
          <Box p={[s * (pass / 2 + side / 2), 4.8, gate.z1 + 0.04]} s={[side + 0.1, 0.18, 0.12]} m={TRIM} />
          {[0.3, 0.7].map((t) => (
            <group key={t} position={[s * (pass / 2 + side * t), 6.4, gate.z1 + 0.05]}>
              <Box p={[0, 0, 0]} s={[0.9, 1.2, 0.08]} m={TRIM} />
              <Box p={[0, 0, 0.03]} s={[0.66, 0.96, 0.04]} m={DARK} />
            </group>
          ))}
          {/* 모서리 기둥 */}
          <Box p={[s * (gate.w / 2 - 0.25), gate.h / 2, gate.z1 - 0.1]} s={[0.55, gate.h, 0.5]} m={RED_DARK} />
          {/* 담쟁이 */}
          <Box p={[s * (gate.w / 2 - 0.6), 1.6, gate.z1 + 0.06]} s={[1.6, 3.2, 0.06]} m={MOSS} />
        </group>
      ))}
      {/* 아치 둘레 돌 + 머릿돌 */}
      <Box p={[0, passH + 0.25, gate.z1 + 0.05]} s={[pass + 0.9, 0.5, 0.2]} m={STONE} />
      <Box p={[0, passH + 0.45, gate.z1 + 0.1]} s={[0.6, 0.8, 0.22]} m={STONE_DARK} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (pass / 2 + 0.25), (passH - 1.8) / 2, gate.z1 + 0.05]} s={[0.5, passH - 1.8, 0.2]} m={STONE} />
      ))}
      <mesh geometry={geo.gateRoof} material={ROOF} position={[0, gate.h, gz]} />
      {/* 탑: 둥근 창(불빛) + 위 작은 지붕 + 꼭대기 장식 */}
      <group position={[0, gate.h, gz]}>
        <Box p={[0, 2.6, 0]} s={[3.8, 5.2, 3.8]} m={RED_PLASTER} />
        <Box p={[0, 5.15, 0]} s={[4.1, 0.25, 4.1]} m={TRIM} />
        <Box p={[0, 0.3, 0]} s={[4.1, 0.3, 4.1]} m={TRIM} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[0, 3.3, s * 1.92]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>
              <circleGeometry args={[0.95, 28]} />
              <meshStandardMaterial color="#f6e7c4" emissive="#ffcf7a" emissiveIntensity={0.8} />
            </mesh>
            <mesh position={[0, 3.3, s * 1.915]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>
              <ringGeometry args={[0.95, 1.15, 28]} />
              <meshStandardMaterial color="#efe3c8" side={THREE.DoubleSide} />
            </mesh>
            {[0, Math.PI / 2].map((a) => (
              <Box key={a} p={[0, 3.3, s * 1.94]} s={[a ? 0.06 : 1.7, a ? 1.7 : 0.06, 0.02]} r={[0, 0, 0]} m={DARK} />
            ))}
            <Box p={[s * 1.92, 3.3, 0]} s={[0.06, 1.2, 0.8]} m={DARK} />
          </group>
        ))}
        <mesh geometry={geo.towerRoof} material={ROOF} position={[0, 5.2, 0]} />
        <Cyl p={[0, 7.7, 0]} rad={0.06} h={0.9} m={STONE_DARK} />
        <Cyl p={[0, 8.2, 0]} rad={0.16} h={0.16} c="#c9a54a" />
      </group>
      {/* ── 어두운 터널 (반원 굴, 바닥 돌, 희미한 등) + 위 흙 언덕 ── */}
      <mesh geometry={geo.vault} material={TUBE_WALL} position={[0, 0, (tube.z0 + tube.z1) / 2]} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (pass / 2 + 0.05), (passH - pass / 2) / 2, (tube.z0 + tube.z1) / 2]} s={[0.1, passH - pass / 2, tube.z1 - tube.z0 + 0.2]} m={TUBE_WALL} />
      ))}
      <Box p={[0, 0.03, (tube.z0 + tube.z1) / 2]} s={[pass, 0.06, tube.z1 - tube.z0 + 2]} m={STONE_DARK} />
      {[-1.5, 1.5].map((z) => (
        <Box key={z} p={[pass / 2 - 0.12, 2.6, z]} s={[0.1, 0.3, 0.3]} m={LAMP} />
      ))}
      {[
        [0, 0, 0, 11, 5.6, 7.8, MOUND],
        [-5, 0, 0.4, 7, 3.6, 7, MOUND_DARK],
        [5.2, 0, -0.4, 7, 3.3, 7, MOUND_DARK],
      ].map(([x, y, z, sx, sy, sz, m], i) => (
        <mesh key={i} position={[x, y, z]} scale={[sx / 2, sy, sz / 2]} material={m}>
          <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
      {/* ── 대합실 같은 홀 (색유리 창 빛, 나무 의자) ── */}
      <Box p={[0, 0.04, hz]} s={[hall.w - 0.4, 0.08, hd]} m={HALL_FLOOR} />
      <mesh geometry={geo.hallBack} material={HALL_WALL} position={[0, 0, hall.z1 - 0.6]} />
      <mesh geometry={geo.hallFront} material={HALL_WALL} position={[0, 0, hall.z0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (hall.w / 2 - 0.2), hall.h / 2, hz]} s={[0.4, hall.h, hd]} m={HALL_WALL} />
          {/* 색유리 창 (안쪽 면) */}
          {[-1.6, 0, 1.6].map((dz, k) => (
            <group key={dz} position={[s * (hall.w / 2 - 0.42), 2.9, hz + dz]}>
              <Box p={[0, 0, 0]} s={[0.04, 1.8, 1.1]} m={GLASS[(k + (s > 0 ? 2 : 0)) % GLASS.length]} />
              <Box p={[0, 0, 0]} s={[0.06, 1.9, 0.06]} m={BENCH} />
              <Box p={[0, 0, 0]} s={[0.06, 0.06, 1.2]} m={BENCH} />
            </group>
          ))}
          {/* 벽 따라 긴 나무 의자 */}
          <group position={[s * (hall.w / 2 - 0.9), 0, hz]}>
            <Box p={[0, 0.45, 0]} s={[0.7, 0.08, hd - 1.2]} m={BENCH} />
            <Box p={[s * 0.3, 0.85, 0]} s={[0.08, 0.7, hd - 1.2]} m={BENCH} />
            {[-1, 1].map((e) => (
              <Box key={e} p={[0, 0.22, e * (hd / 2 - 0.9)]} s={[0.6, 0.44, 0.08]} m={BENCH} />
            ))}
          </group>
        </group>
      ))}
      <Box p={[0, hall.h + 0.02, hz]} s={[hall.w, 0.08, hd]} m={HALL_WALL} />
      <mesh geometry={geo.hallRoof} material={ROOF} position={[0, hall.h, hz]} />
      {/* 홀 가운데 둥근 매달린 등 + 출구 위 둥근 창 */}
      <Cyl p={[0, hall.h - 0.5, hz]} rad={0.02} h={1} m={STONE_DARK} />
      <mesh position={[0, hall.h - 1.1, hz]} material={LAMP}>
        <sphereGeometry args={[0.32, 14, 10]} />
      </mesh>
      <mesh position={[0, passH + 0.55, hall.z0 - 0.02]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.45, 20]} />
        <meshStandardMaterial color="#f3c96b" emissive="#e8a640" emissiveIntensity={0.9} />
      </mesh>
    </group>
  )
}

// ── 두 얼굴 돌 석상 (길가 수호 석상 모티브, 이끼 낀 돌) ──
export function JmTwoFaceStatue() {
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[0.9, 0.4, 0.9]} m={STONE_DARK} />
      <mesh position={[0, 1.05, 0]} scale={[0.42, 0.75, 0.34]} material={STONE}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 1.25, s * 0.33]}>
          {[-0.12, 0.12].map((x) => (
            <Box key={x} p={[x, 0.08, 0]} s={[0.08, 0.03, 0.03]} m={STONE_DARK} />
          ))}
          <Box p={[0, -0.12, 0]} s={[0.16, 0.03, 0.03]} m={STONE_DARK} />
        </group>
      ))}
      <mesh position={[0.18, 1.5, 0.05]} scale={[0.2, 0.08, 0.25]} material={MOSS}>
        <sphereGeometry args={[1, 8, 6]} />
      </mesh>
    </group>
  )
}

// ── 길가 작은 돌 사당 ──
export function JmStoneHokora() {
  const roof = useMemo(() => hipRoofGeometry(0.9, 0.8, 0.35, 0.05), [])
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[0.8, 0.4, 0.7]} m={STONE_DARK} />
      <Box p={[0, 0.65, 0]} s={[0.55, 0.5, 0.5]} m={STONE} />
      <Box p={[0, 0.65, 0.26]} s={[0.25, 0.3, 0.02]} m={DARK} />
      <mesh geometry={roof} material={STONE_DARK} position={[0, 0.9, 0]} />
      <mesh position={[0.25, 0.95, 0.1]} scale={[0.16, 0.06, 0.2]} material={MOSS}>
        <sphereGeometry args={[1, 8, 6]} />
      </mesh>
    </group>
  )
}

export const JM_TUNNEL_STYLES = { jmTunnelGate: JmTunnelGate, jmTwoFaceStatue: JmTwoFaceStatue, jmStoneHokora: JmStoneHokora }
