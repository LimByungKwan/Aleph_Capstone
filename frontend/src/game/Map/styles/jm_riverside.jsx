import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// 벚꽃 강변길 소품 — 담당: 지민
// 일본 시골 강변에 어울리는 것들: 물레방아 오두막, 노다테(야외 다도) 빨간 양산 쉼터, 꽃놀이 돗자리, 철교
// 모두 충돌 없이 보기만(작은 소품) — 필요한 것만 JSON에서 collider 지정

const WOOD = '#6e4b33'
const DARK = '#3f2a1d'
const THATCH = '#8a7350'

function Box({ p, s, c, r }) {
  return (
    <mesh position={p} rotation={r ?? [0, 0, 0]}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} />
    </mesh>
  )
}

// ── 물레방아 오두막 (바퀴가 천천히 돎) ─────────────────
// 바퀴는 x축(오두막 벽으로 들어가는 굴대) 둘레로 돎. 바퀴 묶음에 다른 회전을 같이 주면 오일러 순서 때문에 눕기 때문에 회전은 x 하나만
// size 예: [4, 3.4, 3]. 앞(+z)이 강 쪽 → 바퀴가 오두막 앞 물가에 걸침
export function JmWaterwheel({ item }) {
  const [w, h, d] = item.size
  const wheelRef = useRef(null)
  useFrame((_, delta) => {
    if (wheelRef.current) wheelRef.current.rotation.x -= delta * 0.6
  })
  const R = 1.35
  return (
    <group>
      {/* 오두막 */}
      <Box p={[0, 1.1, -0.3]} s={[w, 2.2, d - 0.6]} c={WOOD} />
      <mesh position={[0, 2.2 + (h - 2.2) / 2, -0.3]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.max(w, d) * 0.78, h - 2.2, 4]} />
        <meshStandardMaterial color={THATCH} flatShading />
      </mesh>
      <Box p={[0.6, 0.9, d / 2 - 0.58]} s={[0.9, 1.6, 0.05]} c={DARK} />
      {/* 바퀴 축 받침 */}
      <Box p={[-w / 2 + 0.3, 1.2, d / 2 + 0.3]} s={[0.15, 1.3, 0.15]} c={DARK} />
      <group ref={wheelRef} position={[-w / 2 + 0.6, R - 0.25, d / 2 + 0.3]}>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[R, 0.06, 6, 20]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        ))}
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return (
            <group key={i} rotation={[a, 0, 0]}>
              <Box p={[0, R / 2, 0]} s={[0.06, R, 0.06]} c={DARK} />
              <Box p={[0, R - 0.05, 0]} s={[0.5, 0.06, 0.3]} c={WOOD} />
            </group>
          )
        })}
      </group>
    </group>
  )
}

// ── 노다테 쉼터: 빨간 양산 + 빨간 천 덮은 평상 ─────────────
export function JmNodate() {
  return (
    <group>
      <Box p={[0, 0.25, 0]} s={[1.9, 0.5, 0.9]} c={WOOD} />
      <Box p={[0, 0.52, 0]} s={[2.0, 0.05, 1.0]} c="#a24a36" />
      <mesh position={[0.7, 1.35, -0.2]}>
        <cylinderGeometry args={[0.03, 0.03, 2.7, 6]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0.7, 2.55, -0.2]}>
        <coneGeometry args={[1.55, 0.55, 16, 1, true]} />
        <meshStandardMaterial color="#a44c38" side={THREE.DoubleSide} />
      </mesh>
      {/* 찻잔과 화과자 접시 */}
      <mesh position={[-0.4, 0.6, 0.1]}>
        <cylinderGeometry args={[0.05, 0.04, 0.08, 10]} />
        <meshStandardMaterial color="#5f7f4a" />
      </mesh>
      <mesh position={[-0.1, 0.56, 0.1]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
        <meshStandardMaterial color="#f5f0e6" />
      </mesh>
      <mesh position={[-0.1, 0.6, 0.1]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#f9c6d3" />
      </mesh>
    </group>
  )
}

// ── 꽃놀이 돗자리 + 도시락 ────────────────────────────
export function JmHanamiMat() {
  return (
    <group>
      <Box p={[0, 0.02, 0]} s={[2.2, 0.03, 1.7]} c="#3b6fb6" />
      <Box p={[-0.4, 0.09, 0.1]} s={[0.45, 0.12, 0.35]} c="#1f1f1f" />
      <Box p={[-0.4, 0.16, 0.1]} s={[0.43, 0.02, 0.33]} c="#9a3a30" />
      <Box p={[0.3, 0.07, -0.3]} s={[0.3, 0.08, 0.3]} c="#e8d3a8" />
      <mesh position={[0.55, 0.12, 0.3]}>
        <cylinderGeometry args={[0.06, 0.06, 0.2, 10]} />
        <meshStandardMaterial color="#5b3a1e" />
      </mesh>
    </group>
  )
}

// ── 철교 (판형교): 강을 건너는 철길 양옆 붉은 철판 + 물속 돌 교각 ─────
// size = [가로(철길 방향 길이), 높이, 폭]. 철길은 roads(jm_rail_*)가 그대로 지나감
export function JmRailBridge({ item }) {
  const [len, , width] = item.size
  const piers = Math.max(2, Math.round(len / 6))
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[0, 0.45, (side * width) / 2]} s={[len, 0.8, 0.12]} c="#8a2f22" />
          <Box p={[0, 0.88, (side * width) / 2]} s={[len, 0.08, 0.3]} c="#6b241a" />
          {Array.from({ length: Math.round(len / 1.5) + 1 }, (_, i) => (
            <Box key={i} p={[-len / 2 + i * 1.5, 0.45, (side * (width / 2 + 0.07))]} s={[0.08, 0.8, 0.06]} c="#6b241a" />
          ))}
        </group>
      ))}
      <Box p={[0, 0.06, 0]} s={[len, 0.1, width]} c="#5b5348" />
      {Array.from({ length: piers + 1 }, (_, i) => (
        <Box key={i} p={[-len / 2 + (i * len) / piers, -0.2, 0]} s={[0.9, 0.6, width + 0.6]} c="#8d8a84" />
      ))}
    </group>
  )
}

export const JM_RIVERSIDE_STYLES = {
  jmWaterwheel: JmWaterwheel,
  jmNodate: JmNodate,
  jmHanamiMat: JmHanamiMat,
  jmRailBridge: JmRailBridge,
}
