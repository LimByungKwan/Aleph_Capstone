import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Ball, Box, Cone, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { getDamaskTexture, getStainedGlassTexture } from './hjTextures.js'
import {
  FIREPLACE,
  HALL_COLUMNS,
  LINTELS,
  STATION,
  VIP_SOFAS,
  VIP_TABLE,
  WAITING_BENCHES,
  WAITING_COLUMNS,
  WALLS,
} from './stationLayout.js'

// [3. 개발 > 프론트엔드] 경성역 (style: "hjSeoulStation") — 들어갈 수 있는 역사 (혜진 영화·드라마 구역)
// 겉: 붉은 벽돌 + 흰 돌 띠, 큰 초록 돔, 장미창, 작은 돔 탑, 굴뚝
// 안: 중앙홀(둥근 천장 + 스테인드글라스 + 흰 기둥과 방울등 + 반원 창과 시계)
//     대합실(긴 나무 벤치 + 매표소), 귀빈실(벽지 + 벽난로 + 소파 + 커튼 + 샹들리에)
// 배치·벽 위치는 stationLayout.js, 충돌 박스는 hj_drama.json의 gs_st_* (scripts/hj-station-colliders.mjs로 생성)

const BRICK = '#a9483a'
const BRICK_DARK = '#8b3a2f'
const STONE = '#efe6d2'
const STONE_DARK = '#cfc4ad'
const CREAM = '#ece4d2'
const COPPER = '#4f8a6a'
const IRON = '#2d2b29'
const WOOD = '#5b3d2a'
const WINDOW_LIT = mat('#ffe2ae', { emissive: '#ffc27a', emissiveIntensity: 0.6 })
const DAYLIGHT = mat('#f4efe2', { emissive: '#fff3d6', emissiveIntensity: 0.75 })
const GLOBE = mat('#fff6e2', { emissive: '#ffe0a8', emissiveIntensity: 1.1 })
const PARTS = mat('#ffffff', { roughness: 0.85 })
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })

const { w, d, coreW, coreH, wingH, T, door } = STATION
const FZ = d / 2 - T / 2
const CX = coreW / 2
const SX = w / 2 - T / 2
const R = CX - T / 2 // 둥근 천장 반지름
const VAULT_Y = coreH - 0.2
const wingW = (w - coreW) / 2

export default function HjSeoulStation({ item }) {
  const [sw, sh, sd] = item.size
  return (
    <group scale={[sw / w, sh / STATION.h, sd / d]}>
      <Shell title={item.title} />
      <Hall />
      <WaitingRoom />
      <VipRoom />
    </group>
  )
}

// ── 벽 한 조각: 겉은 벽돌, 안쪽 면은 크림색 판. 'both'면 양쪽 다 실내(크림) ──
// 다른 실내 건물(총독부 등)에서도 써요: outer/innerColor/innerMap으로 겉·안 재질을 바꿀 수 있어요. T: 벽 두께
export function Wall({ x0, z0, x1, z1, y0 = 0, y1, inner, outer = BRICK, innerColor = CREAM, innerMap, T = STATION.T }) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const angle = Math.atan2(-(z1 - z0), x1 - x0)
  const hh = y1 - y0
  const both = inner === 'both'
  // 안쪽 법선을 벽 로컬 z로
  const side = both ? 0 : Math.sign(inner[0] * Math.sin(angle) + inner[1] * Math.cos(angle)) || 1
  // 반복 무늬(대리석 등)는 벽 크기에 맞춰 반복 횟수를 바꿈
  const map = useMemo(() => {
    if (!innerMap) return null
    const t = innerMap.clone()
    t.repeat.set(Math.max(1, len / 1.6), Math.max(1, hh / 1.6))
    t.needsUpdate = true
    return t
  }, [innerMap, len, hh])
  return (
    <group position={[(x0 + x1) / 2, y0 + hh / 2, (z0 + z1) / 2]} rotation-y={angle}>
      <Box p={[0, 0, 0]} s={[len + T, hh, T]} c={both ? innerColor : outer} />
      {!both && !innerMap && <Box p={[0, 0, side * (T / 2 + 0.012)]} s={[len + (y0 > 0 ? 0 : -T), hh - 0.04, 0.02]} c={innerColor} />}
      {innerMap &&
        (both ? [-1, 1] : [side]).map((sd) => (
          <mesh key={sd} position={[0, 0, sd * (T / 2 + 0.012)]} rotation-y={sd < 0 ? Math.PI : 0}>
            <planeGeometry args={[len + (y0 > 0 ? 0 : -T), hh - 0.04]} />
            <meshStandardMaterial map={map} roughness={0.5} />
          </mesh>
        ))}
      {/* 3인칭 카메라가 벽을 뚫지 않게 (FollowCamera가 이름으로 찾아요) */}
      <mesh name="camera-blocker" geometry={GEO.box} material={HIDDEN} scale={[len + T, hh, T]} />
    </group>
  )
}

// ── 겉모양 + 벽 + 지붕 ──
function Shell({ title }) {
  const sign = getSignTexture(title ?? '경성역', '#2d3b35', '#f3e6c4')
  const windows = useMemo(() => {
    // 양 날개 앞·뒤 벽의 창 (겉 + 안쪽 둘 다)
    const outside = []
    const inside = []
    const cols = Math.max(2, Math.floor((wingW - 2.4) / 1.5))
    for (const s of [-1, 1]) {
      const cx = s * (CX + wingW / 2)
      for (const face of [1, -1]) {
        for (let f = 0; f < 2; f += 1) {
          for (let i = 0; i < cols; i += 1) {
            const x = cx + (i + 0.5 - cols / 2) * ((wingW - 2.4) / cols)
            const y = 1.6 + f * 2.7
            outside.push({ p: [x, y, face * (d / 2 + 0.03)], s: [0.85, 1.7, 0.05] })
            inside.push({ p: [x, y, face * (FZ - T / 2 - 0.03)], s: [0.85, 1.7, 0.04] })
          }
        }
      }
    }
    return { outside, inside }
  }, [])
  const bands = useMemo(() => {
    const list = []
    for (const face of [1, -1]) {
      for (const y of [0.35, wingH * 0.5, wingH - 0.25]) list.push({ p: [0, y, face * (d / 2 + 0.02)], s: [w, 0.3, 0.1], c: STONE })
      for (const x of [-w / 2, -CX, CX, w / 2]) {
        for (let k = 0; k < 6; k += 1) list.push({ p: [x + (x < 0 ? 0.2 : -0.2), 0.6 + k * (wingH / 6), face * (d / 2 + 0.03)], s: [0.55, 0.45, 0.1], c: STONE })
      }
    }
    for (const y of [coreH * 0.5 + 1.2, coreH - 0.3]) list.push({ p: [0, y, d / 2 + 0.05], s: [coreW + 0.2, 0.3, 0.1], c: STONE })
    return list
  }, [])
  return (
    <group>
      {/* 벽 */}
      {WALLS.map(([x0, z0, x1, z1, hgt, inner], i) => (
        <Wall key={i} x0={x0} z0={z0} x1={x1} z1={z1} y1={hgt} inner={inner} />
      ))}
      {LINTELS.map(([x0, z0, x1, z1, y0, y1], i) => (
        <Wall key={`l${i}`} x0={x0} z0={z0} x1={x1} z1={z1} y0={y0} y1={y1} inner={i === 0 ? [0, -1] : i === 1 ? [0, 1] : 'both'} />
      ))}
      <Instances geometry={GEO.box} material={WINDOW_LIT} items={windows.outside} />
      <Instances geometry={GEO.box} material={DAYLIGHT} items={windows.inside} />
      <Instances geometry={GEO.box} material={PARTS} items={bands} />
      {/* 기단 띠 */}
      {[1, -1].map((face) => (
        <Box key={face} p={[0, 0.2, face * (d / 2 + 0.15)]} s={[w + 0.4, 0.4, 0.3]} c={STONE_DARK} />
      ))}
      {/* 날개 천장 + 지붕 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (CX + wingW / 2), wingH + 0.12, 0]} s={[wingW, 0.25, d]} c={CREAM} />
          <Box p={[s * (CX + wingW / 2), wingH + 0.7, 0]} s={[wingW - 0.4, 1.1, d - 1.2]} c="#55606a" />
          {/* 끝 동 앞면: 높은 박공 + 큰 아치창 */}
          <Box p={[s * (w / 2 - 1.3), wingH * 0.6, d / 2 + 0.22]} s={[2.6, wingH * 1.2, 0.4]} c={BRICK} />
          <mesh position={[s * (w / 2 - 1.3), wingH * 0.75, d / 2 + 0.43]} material={WINDOW_LIT}>
            <circleGeometry args={[0.95, 18, 0, Math.PI]} />
          </mesh>
          <Box p={[s * (w / 2 - 1.3), wingH * 0.75 - 0.6, d / 2 + 0.43]} s={[1.9, 1.2, 0.04]} m={WINDOW_LIT} />
          <Box p={[s * (w / 2 - 1.3), wingH * 1.2 + 0.1, d / 2 + 0.22]} s={[2.9, 0.25, 0.7]} c={STONE} />
          {/* 중앙홀 양옆 작은 돔 탑 (앞으로 튀어나옴) */}
          <group position={[s * (CX + 0.6), 0, d / 2 + 0.55]}>
            <Box p={[0, coreH * 0.55, 0]} s={[1.4, coreH * 1.1, 1.4]} c={BRICK} />
            <Box p={[0, coreH * 1.1 + 0.1, 0]} s={[1.6, 0.2, 1.6]} c={STONE} />
            <Cyl p={[0, coreH * 1.1 + 0.5, 0]} rad={0.55} h={0.6} c={STONE} geo={GEO.cyl8} />
            <mesh geometry={GEO.dome} material={mat(COPPER, { roughness: 0.5, metalness: 0.3 })} position={[0, coreH * 1.1 + 0.8, 0]} scale={[0.62, 0.8, 0.62]} />
            <Cone p={[0, coreH * 1.1 + 1.8, 0]} rad={0.08} h={0.5} c={IRON} />
          </group>
        </group>
      ))}
      {/* 정문: 양옆 돌기둥 + 차양 + 현판 + 옆 아치창 2개 */}
      {[-1, 1].map((s) => (
        <group key={`f${s}`}>
          <Box p={[s * (door.w / 2 + 0.25), 1.8, d / 2 + 0.3]} s={[0.5, 3.6, 0.6]} c={STONE} />
          <group position={[s * 2.3, 0, d / 2 + 0.04]}>
            <Box p={[0, 1.4, 0]} s={[1.0, 2.8, 0.05]} m={WINDOW_LIT} />
            <mesh position={[0, 2.8, 0.01]} material={WINDOW_LIT}>
              <circleGeometry args={[0.5, 14, 0, Math.PI]} />
            </mesh>
          </group>
        </group>
      ))}
      <Box p={[0, 3.55, d / 2 + 0.3]} s={[door.w + 1, 0.3, 0.6]} c={STONE} />
      <Box p={[0, 3.95, d / 2 + 1.4]} s={[coreW + 1, 0.15, 1.8]} c="#55606a" />
      <mesh position={[0, 4.9, d / 2 + 0.03]}>
        <planeGeometry args={[4.4, 0.8]} />
        <meshStandardMaterial map={sign} />
      </mesh>
      {/* 장미창 박공 */}
      <group position={[0, coreH, d / 2 + 0.25]}>
        <Box p={[0, 1.4, 0]} s={[coreW * 0.8, 2.8, 0.7]} c={BRICK} />
        <mesh position={[0, 1.5, 0.37]} material={mat('#f3d9a6', { emissive: '#e9a85a', emissiveIntensity: 0.55 })}>
          <circleGeometry args={[1.15, 24]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <Box key={i} p={[0, 1.5, 0.4]} s={[0.08, 2.3, 0.03]} r={[0, 0, (i * Math.PI) / 6]} c={STONE} />
        ))}
        <mesh position={[0, 1.5, 0.39]} material={mat(STONE)}>
          <torusGeometry args={[1.2, 0.1, 6, 24]} />
        </mesh>
        <Box p={[0, 3, 0]} s={[coreW * 0.85, 0.3, 0.9]} c={STONE} />
      </group>
      {/* 중앙홀 지붕: 둥근 천장 겉(슬레이트) + 유리 천창 + 큰 초록 돔 */}
      <mesh position={[0, VAULT_Y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#55606a')}>
        <cylinderGeometry args={[R + 0.18, R + 0.18, d - 0.1, 28, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      <Box p={[0, VAULT_Y + R + 0.22, 0.8]} s={[2.4, 0.25, 3.8]} m={mat('#c9d9df', { emissive: '#8fb0bf', emissiveIntensity: 0.3 })} />
      <Cyl p={[0, VAULT_Y + R + 0.45, -3]} rad={1.6} h={1.4} c={BRICK} geo={GEO.cyl48} />
      <mesh geometry={GEO.dome} material={mat(COPPER, { roughness: 0.45, metalness: 0.35 })} position={[0, VAULT_Y + R + 1.15, -3]} scale={[1.75, 1.6, 1.75]} />
      <Cyl p={[0, VAULT_Y + R + 3.0, -3]} rad={0.35} h={0.6} c={STONE} geo={GEO.cyl8} />
      <Cone p={[0, VAULT_Y + R + 3.65, -3]} rad={0.07} h={0.7} c={IRON} />
      {/* 앞 반원 벽 겉 (벽돌) */}
      <mesh position={[0, VAULT_Y, FZ + T / 2 + 0.01]} material={mat(BRICK)}>
        <circleGeometry args={[R + 0.2, 28, 0, Math.PI]} />
      </mesh>
      {/* 굴뚝 */}
      <Box p={[CX + wingW * 0.4, wingH + 2.6, -d * 0.2]} s={[0.9, 5.2, 0.9]} c={BRICK_DARK} />
      <Box p={[CX + wingW * 0.4, wingH + 5.25, -d * 0.2]} s={[1.1, 0.25, 1.1]} c={STONE} />
    </group>
  )
}

// ── 중앙홀: 대리석 바닥, 둥근 천장 + 스테인드글라스, 흰 기둥과 방울등, 앞뒤 반원 창 + 시계, 아치 문 ──
function Hall() {
  const glass = getStainedGlassTexture()
  const clockHand = useRef(null)
  useFrame(({ clock }) => {
    if (clockHand.current) clockHand.current.rotation.z = -clock.elapsedTime * 0.05
  })
  const globes = useMemo(() => {
    const list = []
    for (const [x, z] of HALL_COLUMNS) {
      for (const [dx, dz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) list.push({ p: [x + dx, 3.3, z + dz], s: [0.14, 0.14, 0.14] })
    }
    return list
  }, [])
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[coreW - T, 0.06, d - T * 2]} c="#d9d3c6" />
      <Box p={[0, 0.07, 0]} s={[1.6, 0.02, d - 1]} c="#b9b0a0" />
      {/* 둥근 천장 안쪽 + 천창 스테인드글라스 */}
      <mesh position={[0, VAULT_Y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(CREAM, { double: true })}>
        <cylinderGeometry args={[R, R, d - T * 2, 28, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, VAULT_Y, -d / 2 + 1 + i * ((d - 2) / 4)]} material={mat(STONE_DARK)}>
          <torusGeometry args={[R - 0.05, 0.08, 6, 24, Math.PI]} />
        </mesh>
      ))}
      <mesh position={[0, VAULT_Y + R - 0.08, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 3.6]} />
        <meshStandardMaterial map={glass} emissive="#ffffff" emissiveMap={glass} emissiveIntensity={0.8} />
      </mesh>
      {/* 앞뒤 반원 벽 + 반원 창 (뒤 창 아래엔 시계) */}
      {[1, -1].map((face) => (
        <group key={face} position={[0, VAULT_Y, face * (FZ - T / 2 - 0.01)]} rotation-y={face > 0 ? Math.PI : 0}>
          <mesh material={mat(CREAM, { double: true })}>
            <circleGeometry args={[R, 28, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, 0.15, 0.02]} material={DAYLIGHT}>
            <circleGeometry args={[R * 0.72, 24, 0, Math.PI]} />
          </mesh>
          {[-0.6, 0, 0.6].map((k) => (
            <Box key={k} p={[k * R * 0.6, 0.15 + R * 0.36, 0.04]} s={[0.07, R * 0.72, 0.03]} c={STONE_DARK} />
          ))}
          <Box p={[0, 0.15 + R * 0.3, 0.04]} s={[R * 1.44, 0.07, 0.03]} c={STONE_DARK} />
        </group>
      ))}
      {/* 겉 뒷면 반원 벽 (벽돌) */}
      <mesh position={[0, VAULT_Y, -FZ - T / 2 - 0.01]} rotation-y={Math.PI} material={mat(BRICK)}>
        <circleGeometry args={[R + 0.2, 28, 0, Math.PI]} />
      </mesh>
      <group position={[0, VAULT_Y + 0.55, -(FZ - T / 2 - 0.05)]}>
        <Cyl p={[0, 0, 0]} rad={0.45} h={0.06} c="#f6f0df" r={[Math.PI / 2, 0, 0]} />
        <group ref={clockHand} position={[0, 0, 0.05]}>
          <Box p={[0, 0.17, 0]} s={[0.04, 0.34, 0.02]} c={IRON} />
        </group>
        <Box p={[0.11, 0, 0.05]} s={[0.22, 0.04, 0.02]} c={IRON} />
      </group>
      {/* 앞뒤 벽 안쪽: 가운데 문 양옆 아치 나무문 (안쪽 사진처럼 아치 3개) */}
      {[1, -1].map((face) =>
        [-1, 1].map((s) => (
          <group key={`${face}${s}`} position={[s * 2.3, 0, face * (FZ - T / 2 - 0.03)]} rotation-y={face > 0 ? Math.PI : 0}>
            <Box p={[0, 1.4, 0]} s={[1.0, 2.8, 0.04]} c={WOOD} />
            <mesh position={[0, 2.8, 0.01]} material={DAYLIGHT}>
              <circleGeometry args={[0.5, 14, 0, Math.PI]} />
            </mesh>
            <Box p={[0, 3.45, 0.02]} s={[1.3, 0.14, 0.05]} c={STONE_DARK} />
          </group>
        )),
      )}
      {/* 기둥 (받침 + 몸통 + 머리) + 방울등 */}
      {HALL_COLUMNS.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Box p={[0, 0.25, 0]} s={[0.8, 0.5, 0.8]} c={STONE} />
          <Cyl p={[0, coreH / 2, 0]} rad={0.3} h={coreH - 0.8} c="#f1ece2" />
          <Box p={[0, coreH - 0.35, 0]} s={[0.8, 0.3, 0.8]} c={STONE_DARK} />
          <Box p={[0, 3.3, 0]} s={[0.95, 0.04, 0.04]} c={IRON} />
          <Box p={[0, 3.3, 0]} s={[0.04, 0.04, 0.95]} c={IRON} />
        </group>
      ))}
      <Instances geometry={GEO.sphere} material={GLOBE} items={globes} />
      {/* 옆방으로 가는 문틀 */}
      {[-1, 1].map((s) => (
        <group key={`d${s}`} position={[s * CX, 0, 0]}>
          {[-1, 1].map((k) => (
            <Box key={k} p={[0, 1.5, k * (STATION.innerDoor.w / 2 + 0.08)]} s={[T + 0.12, 3.0, 0.16]} c={STONE_DARK} />
          ))}
          <Box p={[0, STATION.innerDoor.h + 0.08, 0]} s={[T + 0.12, 0.16, STATION.innerDoor.w + 0.32]} c={STONE_DARK} />
        </group>
      ))}
      <pointLight position={[0, coreH - 1, 0]} color="#ffe6bf" intensity={9} distance={11} decay={2} />
    </group>
  )
}

// ── 대합실 (왼쪽 방): 긴 나무 벤치, 흰 기둥, 천장 들보와 매달린 등, 매표소 ──
function WaitingRoom() {
  const x0 = -(CX + wingW / 2)
  const beams = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ p: [x0, wingH - 0.2, -d / 2 + 1 + i * ((d - 2) / 4)], s: [wingW - 0.4, 0.3, 0.3] })), [x0])
  return (
    <group>
      <Box p={[x0, 0.03, 0]} s={[wingW - T, 0.06, d - T * 2]} c="#cfc6b4" />
      <Instances geometry={GEO.box} material={mat('#f4efe4')} items={beams} />
      {WAITING_BENCHES.map(([x, z, len]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Box p={[0, 0.46, 0]} s={[len, 0.09, 0.55]} c={WOOD} />
          <Box p={[0, 0.85, -0.26]} s={[len, 0.6, 0.07]} c={WOOD} />
          {[-1, 0, 1].map((k) => (
            <Box key={k} p={[k * (len / 2 - 0.2), 0.22, 0]} s={[0.08, 0.44, 0.5]} c="#3a281c" />
          ))}
        </group>
      ))}
      {WAITING_COLUMNS.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Cyl p={[0, wingH / 2, 0]} rad={0.26} h={wingH} c="#f1ece2" />
          <Box p={[0, wingH - 0.45, 0]} s={[0.75, 0.25, 0.75]} c="#2f2b27" />
          <Box p={[0, 0.2, 0]} s={[0.6, 0.4, 0.6]} c={STONE_DARK} />
        </group>
      ))}
      {[-8.6, -6.6, -4.6].map((x) => (
        <group key={x} position={[x, wingH - 1.3, 0]}>
          <Cyl p={[0, 0.6, 0]} rad={0.015} h={1.2} c={IRON} geo={GEO.cyl8} />
          <Ball p={[0, 0, 0]} rad={0.2} m={GLOBE} />
        </group>
      ))}
      {/* 매표소 (끝 벽 쪽) */}
      <group position={[-SX + T / 2 + 0.45, 0, 0]}>
        <Box p={[0, 0.55, 0]} s={[0.9, 1.1, 3.4]} c={WOOD} />
        <Box p={[-0.25, 1.9, 0]} s={[0.1, 1.6, 3.4]} c={WOOD} />
        {[-1.1, 0, 1.1].map((z) => (
          <Box key={z} p={[-0.2, 1.75, z]} s={[0.05, 0.8, 0.7]} m={WINDOW_LIT} />
        ))}
        <mesh position={[-0.18, 2.9, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[2.2, 0.5]} />
          <meshStandardMaterial map={getSignTexture('매 표 소', '#2d3b35', '#f3e6c4')} />
        </mesh>
      </group>
    </group>
  )
}

// ── 귀빈실 (오른쪽 방): 나무 바닥, 진한 징두리 판 + 무늬 벽지, 벽난로와 거울, 소파, 탁자, 커튼, 샹들리에, 화분 ──
function VipRoom() {
  const x0 = CX + wingW / 2
  const damask = getDamaskTexture()
  const inX0 = CX + T / 2 + 0.02
  const inX1 = SX - T / 2 - 0.02
  const inZ = FZ - T / 2 - 0.02
  return (
    <group>
      <Box p={[x0, 0.03, 0]} s={[wingW - T, 0.06, d - T * 2]} c="#8a5a3a" />
      <Box p={[x0, wingH - 0.02, 0]} s={[wingW - T, 0.04, d - T * 2]} c="#f6f1e6" />
      {/* 징두리 판 (앞뒤 벽 + 끝 벽) */}
      {[1, -1].map((face) => (
        <Box key={face} p={[x0, 0.55, face * (inZ - 0.03)]} s={[wingW - T, 1.1, 0.06]} c="#3a281c" />
      ))}
      <Box p={[inX1 - 0.03, 0.55, 0]} s={[0.06, 1.1, d - T * 2]} c="#3a281c" />
      {/* 벽지 판: 끝 벽 (벽난로 양옆) + 뒤 벽 */}
      {[-2.9, 2.9].map((z) => (
        <mesh key={z} position={[inX1 - 0.01, 3.1, z]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[2.2, 3.6]} />
          <meshStandardMaterial map={damask} />
        </mesh>
      ))}
      {[x0 - 2.4, x0 + 2.4].map((x) => (
        <mesh key={x} position={[x, 3.1, -inZ + 0.01]}>
          <planeGeometry args={[1.6, 3.6]} />
          <meshStandardMaterial map={damask} />
        </mesh>
      ))}
      {/* 벽난로 + 거울 */}
      <group position={[FIREPLACE.x, 0, FIREPLACE.z]}>
        <Box p={[0, FIREPLACE.h / 2, 0]} s={[FIREPLACE.d, FIREPLACE.h, FIREPLACE.w]} c="#e9e3d8" />
        <Box p={[-FIREPLACE.d / 2 - 0.01, 0.55, 0]} s={[0.04, 0.9, 1.0]} c="#1c1917" />
        <Box p={[0, FIREPLACE.h + 0.05, 0]} s={[FIREPLACE.d + 0.2, 0.1, FIREPLACE.w + 0.3]} c="#d6cfc2" />
        <Box p={[0.2, 2.7, 0]} s={[0.06, 1.6, 1.4]} c="#b08a3a" />
        <Box p={[0.16, 2.7, 0]} s={[0.04, 1.4, 1.2]} m={mat('#c9d6dc', { metalness: 0.8, roughness: 0.15 })} />
        <Ball p={[-0.3, 0.35, 0]} rad={0.18} m={mat('#ff9a4a', { emissive: '#ff7a2a', emissiveIntensity: 1.2 })} />
      </group>
      {/* 소파 + 탁자 */}
      {VIP_SOFAS.map(([x, z, sw, sd, rot]) => (
        <group key={`${x}${z}`} position={[x, 0, z]} rotation-y={(rot * Math.PI) / 180}>
          <Box p={[0, 0.25, 0]} s={[sw, 0.5, sd]} c="#3f5a40" />
          <Box p={[0, 0.75, -sd / 2 + 0.12]} s={[sw, 0.6, 0.24]} c="#3f5a40" />
          {[-1, 1].map((k) => (
            <Box key={k} p={[k * (sw / 2 - 0.1), 0.6, 0]} s={[0.2, 0.3, sd]} c="#334a35" />
          ))}
        </group>
      ))}
      <group position={[VIP_TABLE[0], 0, VIP_TABLE[1]]}>
        <Box p={[0, 0.5, 0]} s={[VIP_TABLE[2], 0.07, VIP_TABLE[3]]} c={WOOD} />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (VIP_TABLE[2] / 2 - 0.1), 0.25, sz * (VIP_TABLE[3] / 2 - 0.1)]} s={[0.07, 0.5, 0.07]} c={WOOD} />))}
        <Cyl p={[0, 0.62, 0]} rad={0.12} h={0.18} c="#e9e3d8" geo={GEO.cyl8} />
      </group>
      {/* 앞 벽 창 커튼 */}
      {[x0 - 1.6, x0 + 1.6].map((x) => (
        <group key={`c${x}`} position={[x, 0, inZ - 0.08]}>
          {[-1, 1].map((k) => (
            <Box key={k} p={[k * 0.62, 2.9, 0]} s={[0.32, 4.6, 0.12]} c="#6b1f22" />
          ))}
          <Box p={[0, 5.15, 0]} s={[1.7, 0.4, 0.16]} c="#4f1618" />
        </group>
      ))}
      {/* 샹들리에 + 화분 */}
      <group position={[x0, wingH - 1.2, 0]}>
        <Cyl p={[0, 0.6, 0]} rad={0.02} h={1.0} c="#b08a3a" geo={GEO.cyl8} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return <Ball key={i} p={[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]} rad={0.1} m={GLOBE} />
        })}
        <Ball p={[0, -0.1, 0]} rad={0.14} m={GLOBE} />
      </group>
      {[[inX0 + 0.5, -3.9], [inX1 - 0.6, 3.9]].map(([x, z]) => (
        <group key={`p${x}`} position={[x, 0, z]}>
          <Cyl p={[0, 0.3, 0]} rad={0.25} h={0.6} c="#8f5a3a" geo={GEO.cyl8} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Cone key={i} p={[Math.cos(i * 1.3) * 0.25, 1.1, Math.sin(i * 1.3) * 0.25]} rad={0.12} h={1.1} r={[Math.cos(i * 1.3) * 0.5, 0, Math.sin(i * 1.3) * 0.5]} c="#4f7a45" />
          ))}
        </group>
      ))}
      <pointLight position={[x0, wingH - 1.6, 0]} color="#ffd9a0" intensity={5} distance={8} decay={2} />
    </group>
  )
}
