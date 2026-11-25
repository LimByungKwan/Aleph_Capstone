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

const RED_PLASTER = mat('#c25a50', { roughness: 0.95 })
const GRIME = mat('#8f4a42', { roughness: 1 })
const WOOD_D = mat('#4a3324', { roughness: 0.9 })
const WIN_PALE = mat('#d8d6c4', { emissive: '#fff1c8', emissiveIntensity: 0.25, roughness: 0.6 })
const PLAQUE = mat('#2b2622', { roughness: 0.7 })
const PLAQUE_FRAME = mat('#5a4636', { roughness: 0.8 })
const range = (n) => Array.from({ length: n }, (_, i) => i)
const G1 = 5 // 아래층 회벽 높이
const RED_DARK = mat('#8d3328', { roughness: 0.95 })
const MOSS_STONE = mat('#8a9266', { roughness: 1, flat: true })
const STONE = mat('#8a8378', { roughness: 1, flat: true })
const STONE_DARK = mat('#5d5850', { roughness: 1, flat: true })
const ROOF = mat('#5e615f', { flat: true, roughness: 0.85, double: true })
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
    const front = archRing(gate.w, G1, pass, passH)
    const back = archRing(gate.w, G1, pass, passH)
    const hallBack = archRing(hall.w, hall.h, pass, passH)
    const hallFront = archRing(hall.w, hall.h, pass, passH)
    const vault = vaultGeometry(pass, passH, tube.z1 - tube.z0 + 0.2)
    const midRoof = hipRoofGeometry(gate.w + 1.6, gate.z1 - gate.z0 + 2.4, 0.9, 0.1)
    const topRoof = hipRoofGeometry(gate.w - 1.4, gate.z1 - gate.z0 + 0.6, 2.2, 0.25)
    const hallRoof = hipRoofGeometry(hall.w + 0.8, hall.z1 - hall.z0 + 0.8, 1.2, 0.15)
    return { front, back, hallBack, hallFront, vault, midRoof, topRoof, hallRoof }
  }, [gate.w, gate.h, gate.z0, gate.z1, hall.w, hall.h, hall.z0, hall.z1, pass, passH, tube.z0, tube.z1])
  const gz = (gate.z0 + gate.z1) / 2
  const gd = gate.z1 - gate.z0
  const hz = (hall.z0 + hall.z1) / 2
  const hd = hall.z1 - hall.z0
  const side = (gate.w - pass) / 2
  return (
    <group>
      {/* ── (11/25 지민이 보낸 사진 참고) 바랜 분홍빛 붉은 회벽 탑 문 ──
           아래층: 통짜 회벽 + 작은 어두운 아치(터널 입구), 밑동은 때 묻은 띠·이끼
           위: 나무 발코니(난간·까치발) + 밝은 창 띠 → 회색 기와 처마 → 붉은 세로 살 위층 + 가운데 어두운 현판 → 회색 기와 지붕 */}
      <mesh geometry={geo.front} material={RED_PLASTER} position={[0, 0, gate.z1 - 0.6]} />
      <mesh geometry={geo.back} material={RED_PLASTER} position={[0, 0, gate.z0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (pass / 2 + side / 2), G1 / 2, gz]} s={[side, G1, gd - 1.1]} m={RED_PLASTER} />
          <Box p={[s * (pass / 2 + side / 2), 0.6, gate.z1 + 0.02]} s={[side, 1.2, 0.08]} m={GRIME} />
          <Box p={[s * (gate.w / 2 - 0.9 - (s > 0 ? 1.4 : 0)), 1.3 + (s > 0 ? 0.8 : 0), gate.z1 + 0.05]} s={[1.8, 2.6, 0.05]} m={MOSS} />
          <Box p={[s * (pass / 2 + side * 0.6), G1 - 1.2, gate.z1 + 0.03]} s={[1.4, 0.9, 0.04]} m={GRIME} />
        </group>
      ))}
      <Box p={[0, passH + 0.12, gate.z1 + 0.02]} s={[pass + 0.4, 0.24, 0.1]} m={GRIME} />
      {/* 아치 안이 사진처럼 어둡게 보이도록 굴 속 어둠 막 (걷는 판정 없음) */}
      {[gate.z1 - 0.8, tube.z1 - 0.5].map((z) => (
        <mesh key={z} position={[0, passH / 2, z]}>
          <planeGeometry args={[pass, passH]} />
          <meshBasicMaterial color="#050403" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* 발코니 바닥판 + 까치발 + 난간 */}
      <Box p={[0, G1 + 0.17, gz + 0.5]} s={[gate.w + 0.6, 0.35, gd + 1.2]} m={WOOD_D} />
      {range(8).map((i) => (
        <Box key={`k${i}`} p={[-gate.w / 2 + 0.6 + (i * (gate.w - 1.2)) / 7, G1 - 0.25, gate.z1 + 0.6]} s={[0.22, 0.5, 0.9]} m={WOOD_D} />
      ))}
      <Box p={[0, G1 + 1.25, gate.z1 + 1.0]} s={[gate.w + 0.4, 0.1, 0.1]} m={WOOD_D} />
      <Box p={[0, G1 + 0.75, gate.z1 + 1.0]} s={[gate.w + 0.4, 0.06, 0.06]} m={WOOD_D} />
      {range(19).map((i) => (
        <Box key={`r${i}`} p={[-gate.w / 2 - 0.2 + (i * (gate.w + 0.4)) / 18, G1 + 0.8, gate.z1 + 1.0]} s={[0.08, 0.9, 0.08]} m={WOOD_D} />
      ))}
      {/* 밝은 창 띠 (살창) */}
      <Box p={[0, G1 + 1.15, gz]} s={[gate.w - 1, 1.6, gd - 0.6]} m={WIN_PALE} />
      {range(14).map((i) => (
        <Box key={`w${i}`} p={[-gate.w / 2 + 0.5 + (i * (gate.w - 1)) / 13, G1 + 1.15, gate.z1 - 0.28]} s={[0.07, 1.6, 0.04]} m={WOOD_D} />
      ))}
      <Box p={[0, G1 + 1.15, gate.z1 - 0.28]} s={[gate.w - 1, 0.06, 0.04]} m={WOOD_D} />
      <mesh geometry={geo.midRoof} material={ROOF} position={[0, G1 + 1.95, gz]} />
      {/* 위층: 붉은 세로 살 벽 + 가운데 어두운 현판 */}
      <Box p={[0, G1 + 3.9, gz]} s={[gate.w - 3, 2.6, gd - 1.6]} m={RED_PLASTER} />
      {range(16).map((i) => (
        <Box key={`v${i}`} p={[-(gate.w - 3) / 2 + 0.3 + (i * (gate.w - 3.6)) / 15, G1 + 3.9, gz + (gd - 1.6) / 2 + 0.04]} s={[0.12, 2.3, 0.06]} m={RED_DARK} />
      ))}
      <Box p={[0, G1 + 3.95, gz + (gd - 1.6) / 2 + 0.1]} s={[3.6, 1.5, 0.08]} m={PLAQUE_FRAME} />
      <Box p={[0, G1 + 3.95, gz + (gd - 1.6) / 2 + 0.15]} s={[3.2, 1.15, 0.04]} m={PLAQUE} />
      <Box p={[0, G1 + 2.65, gz]} s={[gate.w - 2.6, 0.2, gd - 1.2]} m={WOOD_D} />
      <mesh geometry={geo.topRoof} material={ROOF} position={[0, G1 + 5.2, gz]} />
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
      <mesh position={[0, 1.05, 0]} scale={[0.42, 0.75, 0.34]} material={MOSS_STONE}>
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
