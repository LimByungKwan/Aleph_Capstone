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

// wing: (11/25 밤 지민 요청: 입구를 좌우로 넓혀 웅장하게) 가운데 탑 문 양옆 낮은 날개채(폭 w, 높이 h) + 끝 망루(폭 tower, 높이 towerH)
export const TUNNEL = { wing: { w: 7.5, h: 4.2, tower: 2.8, towerH: 7.2 }, pass: 3.6, passH: 4.0, gate: { z0: 3, z1: 9, w: 14, h: 8.2 }, tube: { z0: -3, z1: 3 }, hall: { z0: -9, z1: -3, w: 10, h: 5.2 } }

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
const HALL_WALL = mat('#b9564b', { roughness: 0.95 })
const HALL_IN = mat('#e6dac0', { roughness: 0.95 })
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

export function JmTunnelGate({ item }) {
  const { pass, passH, gate, tube, hall, wing } = TUNNEL
  const geo = useMemo(() => {
    const front = archRing(gate.w, G1, pass, passH)
    const back = archRing(gate.w, G1, pass, passH)
    const hallBack = archRing(hall.w, hall.h, pass, passH)
    const hallFront = archRing(hall.w, hall.h, pass, passH)
    const vault = vaultGeometry(pass, passH, tube.z1 - tube.z0 + 0.2)
    const niche = (() => {
      const sh = new THREE.Shape()
      sh.moveTo(-0.6, 0.3)
      sh.lineTo(-0.6, 1.9)
      sh.absarc(0, 1.9, 0.6, Math.PI, 0, true)
      sh.lineTo(0.6, 0.3)
      sh.lineTo(-0.6, 0.3)
      return new THREE.ShapeGeometry(sh)
    })()
    const midRoof = hipRoofGeometry(gate.w + 1.6, gate.z1 - gate.z0 + 2.4, 0.9, 0.1)
    const topRoof = hipRoofGeometry(gate.w - 1.4, gate.z1 - gate.z0 + 0.6, 2.2, 0.25)
    const hallRoof = hipRoofGeometry(hall.w + 0.8, hall.z1 - hall.z0 + 0.8, 2.8, 0.2)
    const bayRoof = hipRoofGeometry(4.2, 2.0, 2.2, 0.1)
    const corRoof = hipRoofGeometry(pass + 2.8, tube.z1 - tube.z0 + 0.4, 1.3, 0.12)
    const wingRoof = hipRoofGeometry(wing.w + 1.0, gate.z1 - gate.z0 - 0.4, 1.5, 0.15)
    const towerRoof = hipRoofGeometry(wing.tower + 1.4, wing.tower + 1.4, 2.0, 0.2)
    return { front, back, hallBack, hallFront, vault, midRoof, topRoof, hallRoof, niche, bayRoof, wingRoof, towerRoof, corRoof }
  }, [gate.w, gate.h, gate.z0, gate.z1, hall.w, hall.h, hall.z0, hall.z1, pass, passH, tube.z0, tube.z1, wing.w, wing.tower])
  const gz = (gate.z0 + gate.z1) / 2
  const gd = gate.z1 - gate.z0
  const hz = (hall.z0 + hall.z1) / 2
  const hd = hall.z1 - hall.z0
  const side = (gate.w - pass) / 2
  return (
    <group scale={item?.scale ?? 1}>
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
      {/* (사진 참고) 큰 아치 양옆 작은 막힌 아치 */}
      {[-1, 1].map((s) => (
        <group key={`ni${s}`} position={[s * (pass / 2 + 1.9), 0, gate.z1 + 0.03]}>
          <mesh geometry={geo.niche} material={DARK} />
          <Box p={[0, 2.62, 0]} s={[1.5, 0.14, 0.06]} m={GRIME} />
        </group>
      ))}
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
      {/* ── 양옆 날개채 + 끝 망루: 붉은 회벽, 막힌 아치 줄, 불 켜진 살창 띠, 회색 기와, 처마 등 ── */}
      {[-1, 1].map((s) => {
        const wx = s * (gate.w / 2 + wing.w / 2)
        const wd = gd - 1.4
        const fz = gz + wd / 2
        const tx = s * (gate.w / 2 + wing.w + wing.tower / 2 - 0.2)
        return (
          <group key={`wing${s}`}>
            <Box p={[wx, wing.h / 2, gz]} s={[wing.w, wing.h, wd]} m={RED_PLASTER} />
            <Box p={[wx, 0.5, fz + 0.03]} s={[wing.w, 1.0, 0.06]} m={GRIME} />
            {[-2.4, 0, 2.4].map((dx) => (
              <group key={dx} position={[wx + dx, 0, fz + 0.04]}>
                <mesh geometry={geo.niche} material={DARK} />
                <Box p={[0, 2.62, 0]} s={[1.5, 0.14, 0.06]} m={GRIME} />
              </group>
            ))}
            <Box p={[wx, wing.h - 0.65, fz + 0.03]} s={[wing.w - 0.8, 0.8, 0.06]} m={WIN_PALE} />
            {range(13).map((i) => (
              <Box key={i} p={[wx - (wing.w - 0.8) / 2 + (i * (wing.w - 0.8)) / 12, wing.h - 0.65, fz + 0.07]} s={[0.07, 0.8, 0.04]} m={WOOD_D} />
            ))}
            <Box p={[wx, wing.h + 0.1, gz]} s={[wing.w + 0.6, 0.2, wd + 0.8]} m={WOOD_D} />
            <mesh geometry={geo.wingRoof} material={ROOF} position={[wx, wing.h + 0.2, gz]} />
            {[-2.4, 0, 2.4].map((dx) => (
              <group key={`l${dx}`} position={[wx + dx, wing.h - 0.1, fz + 0.75]}>
                <Box p={[0, 0, 0]} s={[0.04, 0.5, 0.04]} m={WOOD_D} />
                <Box p={[0, -0.5, 0]} s={[0.42, 0.6, 0.42]} m={LAMP} />
                <Box p={[0, -0.17, 0]} s={[0.5, 0.06, 0.5]} m={WOOD_D} />
                <Box p={[0, -0.83, 0]} s={[0.5, 0.06, 0.5]} m={WOOD_D} />
              </group>
            ))}
            {/* 끝 망루 */}
            <Box p={[tx, wing.towerH / 2, gz]} s={[wing.tower, wing.towerH, wing.tower]} m={RED_PLASTER} />
            <Box p={[tx, 0.6, gz + wing.tower / 2 + 0.03]} s={[wing.tower, 1.2, 0.06]} m={GRIME} />
            <Box p={[tx, wing.towerH - 1.5, gz]} s={[wing.tower + 0.9, 0.18, wing.tower + 0.9]} m={WOOD_D} />
            <Box p={[tx, wing.towerH - 0.75, gz]} s={[wing.tower - 0.3, 1.1, wing.tower + 0.06]} m={WIN_PALE} />
            <Box p={[tx, wing.towerH - 0.75, gz]} s={[wing.tower + 0.06, 1.1, wing.tower - 0.3]} m={WIN_PALE} />
            {[-1, 1].map((c) => (
              <Box key={c} p={[tx + c * (wing.tower / 2 + 0.4), wing.towerH - 1.0, gz + wing.tower / 2 + 0.4]} s={[0.08, 0.9, 0.08]} m={WOOD_D} />
            ))}
            <Box p={[tx, wing.towerH - 0.6, gz + wing.tower / 2 + 0.4]} s={[wing.tower + 0.9, 0.08, 0.08]} m={WOOD_D} />
            <Box p={[tx, wing.towerH + 0.1, gz]} s={[wing.tower + 0.8, 0.2, wing.tower + 0.8]} m={WOOD_D} />
            <mesh geometry={geo.towerRoof} material={ROOF} position={[tx, wing.towerH + 0.2, gz]} />
            <Box p={[tx, wing.towerH + 2.5, gz]} s={[0.14, 0.9, 0.14]} m={PLAQUE_FRAME} />
          </group>
        )
      })}
      {/* ── 어두운 터널 (반원 굴, 바닥 돌, 희미한 등) + 위 흙 언덕 ── */}
      <mesh geometry={geo.vault} material={TUBE_WALL} position={[0, 0, (tube.z0 + tube.z1) / 2]} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (pass / 2 + 0.05), (passH - pass / 2) / 2, (tube.z0 + tube.z1) / 2]} s={[0.1, passH - pass / 2, tube.z1 - tube.z0 + 0.2]} m={TUBE_WALL} />
      ))}
      <Box p={[0, 0.03, (tube.z0 + tube.z1) / 2]} s={[pass, 0.06, tube.z1 - tube.z0 + 2]} m={STONE_DARK} />
      {[-1.5, 1.5].map((z) => (
        <Box key={z} p={[pass / 2 - 0.12, 2.6, z]} s={[0.1, 0.3, 0.3]} m={LAMP} />
      ))}
      {/* (11/25 밤 지민 요청: 산 덩어리가 뭔지 모르겠음) 언덕 대신 건물 사이를 잇는 붉은 회벽 복도 + 기와 지붕 */}
      {[-1, 1].map((s) => (
        <group key={`cor${s}`}>
          <Box p={[s * (pass / 2 + 0.45), (passH + 0.5) / 2, (tube.z0 + tube.z1) / 2]} s={[0.7, passH + 0.5, tube.z1 - tube.z0]} m={RED_PLASTER} />
          <Box p={[s * (pass / 2 + 0.82), 0.5, (tube.z0 + tube.z1) / 2]} s={[0.06, 1.0, tube.z1 - tube.z0]} m={GRIME} />
          {[-1.5, 1.5].map((z) => (
            <Box key={z} p={[s * (pass / 2 + 0.82), 2.6, z]} s={[0.06, 1.1, 1.3]} m={WIN_PALE} />
          ))}
        </group>
      ))}
      <Box p={[0, passH + 0.6, (tube.z0 + tube.z1) / 2]} s={[pass + 2.2, 0.2, tube.z1 - tube.z0]} m={WOOD_D} />
      <mesh geometry={geo.corRoof} material={ROOF} position={[0, passH + 0.7, (tube.z0 + tube.z1) / 2]} />
      {/* ── 대합실 같은 홀 (색유리 창 빛, 나무 의자) ── */}
      <Box p={[0, 0.04, hz]} s={[hall.w - 0.4, 0.08, hd]} m={HALL_FLOOR} />
      <mesh geometry={geo.hallBack} material={HALL_WALL} position={[0, 0, hall.z1 - 0.6]} />
      <mesh geometry={geo.hallFront} material={HALL_WALL} position={[0, 0, hall.z0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (hall.w / 2 - 0.2), hall.h / 2, hz]} s={[0.4, hall.h, hd]} m={HALL_WALL} />
          <Box p={[s * (hall.w / 2 - 0.41), hall.h / 2, hz]} s={[0.02, hall.h - 0.2, hd - 0.4]} m={HALL_IN} />
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
      {/* (11/25 사진 참고) 풀밭 쪽 면: 아치 위로 튀어나온 시계 탑 칸 + 큰 둥근 시계 + 회색 뾰족 지붕 + 금 꼭지 */}
      <group position={[0, 0, hall.z0 - 0.55]}>
        <Box p={[0, (passH + 0.4 + hall.h + 3.2) / 2, 0]} s={[3.6, hall.h + 3.2 - passH - 0.4, 1.1]} m={HALL_WALL} />
        <Box p={[0, passH + 0.35, 0.1]} s={[4.0, 0.3, 1.3]} m={GRIME} />
        <mesh position={[0, hall.h + 1.1, -0.56]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[1.05, 32]} />
          <meshStandardMaterial color="#f2ead2" emissive="#ffe7b0" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, hall.h + 1.1, -0.565]} rotation={[0, Math.PI, 0]}>
          <ringGeometry args={[1.05, 1.35, 32]} />
          <meshStandardMaterial color="#c9a54a" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <Box p={[0.25, hall.h + 1.3, -0.6]} s={[0.07, 0.75, 0.03]} m={DARK} r={[0, 0, -0.6]} />
        <Box p={[-0.15, hall.h + 0.9, -0.6]} s={[0.06, 0.5, 0.03]} m={DARK} r={[0, 0, 0.9]} />
        <mesh geometry={geo.bayRoof} material={ROOF} position={[0, hall.h + 3.2, 0]} />
        <Cyl p={[0, hall.h + 5.8, 0]} rad={0.08} h={0.9} m={STONE_DARK} />
        <Cyl p={[0, hall.h + 6.35, 0]} rad={0.2} h={0.25} c="#c9a54a" />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 3.2, hall.h - 1.2, 0.5]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.35, 16]} />
            <meshStandardMaterial color="#f3c96b" emissive="#e8a640" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
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
