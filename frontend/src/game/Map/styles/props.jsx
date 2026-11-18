import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { getSignTexture } from './textures.js'
import { SEASON_LOOK, useSeason } from '../../seasons.js'

// 소품 스타일들. JSON의 size [가로 w, 높이 h, 깊이 d] 기준으로 그려요. 앞면은 +z.

const WOOD = '#8b5e3c'
const METAL = '#2b2d30'
const range = (n) => Array.from({ length: n }, (_, i) => i)

// ── 가로수 (화분 + 줄기 + 잎 뭉치) ───────────
const LEAF_CLUSTERS = [
  [0, 0, 0, 1],
  [0.5, -0.15, 0.2, 0.75],
  [-0.45, -0.1, -0.25, 0.8],
  [0.1, 0.4, -0.3, 0.7],
  [-0.2, 0.35, 0.35, 0.65],
  [0.35, 0.25, -0.05, 0.6],
]
export function Tree({ item }) {
  const colors = SEASON_LOOK[useSeason()].leaves
  const [w, h] = item.size
  const radius = w / 2
  const trunkH = h * 0.5
  const canopyY = trunkH + radius * 0.55
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1, 0.3, 1]} />
        <meshStandardMaterial color="#a35d47" />
      </mesh>
      <mesh position={[0, trunkH / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.2, trunkH, 7]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
      {LEAF_CLUSTERS.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x * radius, canopyY + y * radius, z * radius]}>
          <icosahedronGeometry args={[s * radius * 0.75, 1]} />
          <meshStandardMaterial color={colors[i % colors.length]} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// ── 가로등 (청사초롱 느낌 등) ─────────────────
// 팔이 로컬 +x 방향으로 뻗어요 → rotationDeg로 길 쪽을 향하게
export function Lamp({ item }) {
  const [, h] = item.size
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.3, 10]} />
        <meshStandardMaterial color={METAL} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.08, h, 8]} />
        <meshStandardMaterial color={METAL} />
      </mesh>
      <mesh position={[0.35, h - 0.15, 0]}>
        <boxGeometry args={[0.75, 0.05, 0.05]} />
        <meshStandardMaterial color={METAL} />
      </mesh>
      <group position={[0.65, h - 0.6, 0]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 10]} />
          <meshStandardMaterial color="#d64b3c" emissive="#ff6a4d" emissiveIntensity={0.35} />
        </mesh>
        {[0.24, -0.24].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 10]} />
            <meshStandardMaterial color={METAL} />
          </mesh>
        ))}
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.3, 4]} />
          <meshStandardMaterial color={METAL} />
        </mesh>
      </group>
    </group>
  )
}

// ── 벤치 ─────────────────────────────────────
export function Bench({ item }) {
  const [w, , d] = item.size
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[w, 0.06, d * 0.8]} />
        <meshStandardMaterial color="#9a6b45" />
      </mesh>
      <mesh position={[0, 0.72, -d * 0.4]}>
        <boxGeometry args={[w, 0.4, 0.05]} />
        <meshStandardMaterial color="#9a6b45" />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * (w / 2 - 0.15), 0.22, 0]}>
          <boxGeometry args={[0.06, 0.45, d * 0.7]} />
          <meshStandardMaterial color={METAL} />
        </mesh>
      ))}
    </group>
  )
}

// ── 분리수거함 3개 ───────────────────────────
export function Bins({ item }) {
  const [w, h, d] = item.size
  const colors = ['#3b82f6', '#22c55e', '#f59e0b']
  const bw = w / 3
  return (
    <group>
      {colors.map((color, i) => (
        <group key={color} position={[-w / 2 + bw * (i + 0.5), 0, 0]}>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[bw - 0.06, h, d]} />
            <meshStandardMaterial color="#e6e6e6" />
          </mesh>
          <mesh position={[0, h + 0.03, 0]}>
            <boxGeometry args={[bw - 0.02, 0.06, d + 0.04]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, h * 0.6, d / 2 + 0.01]}>
            <planeGeometry args={[bw * 0.5, 0.25]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── 정자 (광장의 작은 전통 쉼터) ──────────────
export function Pavilion({ item }) {
  const [w, h, d] = item.size
  const roofH = 1.6
  const postTop = h - roofH
  const deckY = 0.55
  const roofGeometry = useMemo(() => hipRoofGeometry(w + 1.4, d + 1.4, roofH, 0.55), [w, d])
  const corners = [
    [w / 2 - 0.5, d / 2 - 0.5],
    [-w / 2 + 0.5, d / 2 - 0.5],
    [w / 2 - 0.5, -d / 2 + 0.5],
    [-w / 2 + 0.5, -d / 2 + 0.5],
  ]
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[w, 0.4, d]} />
        <meshStandardMaterial color="#b9b3a8" />
      </mesh>
      <mesh position={[0, deckY - 0.075, 0]}>
        <boxGeometry args={[w - 0.6, 0.15, d - 0.6]} />
        <meshStandardMaterial color="#a77a52" />
      </mesh>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, (postTop + deckY) / 2, z]}>
          <cylinderGeometry args={[0.13, 0.13, postTop - deckY, 10]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
      ))}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[0, postTop - 0.1, side * (d / 2 - 0.5)]}>
            <boxGeometry args={[w - 0.8, 0.22, 0.22]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
          <mesh position={[side * (w / 2 - 0.5), postTop - 0.1, 0]}>
            <boxGeometry args={[0.22, 0.22, d - 0.8]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
        </group>
      ))}
      <mesh geometry={roofGeometry} position={[0, postTop, 0]}>
        <meshStandardMaterial color="#56645f" flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, postTop + roofH + 0.15, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#2c3036" />
      </mesh>
    </group>
  )
}

// ── 버스 정류장 쉘터 (앞 +z가 열린 쪽) ────────
export function BusShelter({ item }) {
  const [w, h, d] = item.size
  const sign = item.signs?.[0]
  return (
    <group>
      {[
        [w / 2 - 0.05, -d / 2 + 0.05],
        [-w / 2 + 0.05, -d / 2 + 0.05],
        [w / 2 - 0.05, d / 2 - 0.05],
        [-w / 2 + 0.05, d / 2 - 0.05],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]}>
          <boxGeometry args={[0.08, h, 0.08]} />
          <meshStandardMaterial color="#3d4a5c" />
        </mesh>
      ))}
      <mesh position={[0, h / 2 + 0.15, -d / 2 + 0.05]}>
        <boxGeometry args={[w - 0.1, h - 0.4, 0.03]} />
        <meshStandardMaterial color="#a8c8e0" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, h, 0]}>
        <boxGeometry args={[w + 0.2, 0.12, d + 0.3]} />
        <meshStandardMaterial color="#3d4a5c" />
      </mesh>
      {sign && (
        <mesh position={[0, h - 0.25, d / 2 + 0.16]}>
          <planeGeometry args={[w * 0.7, 0.32]} />
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg, (w * 0.7) / 0.32)} />
        </mesh>
      )}
    </group>
  )
}

// ── 둥근 표지판 (버스 정류장 등) ──────────────
export function SignPost({ item }) {
  const [, h] = item.size
  const sign = item.signs?.[0] ?? { text: '버스', bg: '#1d4ed8', fg: '#ffffff' }
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, h, 8]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0, h - 0.35, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 24]} />
        <meshStandardMaterial color={sign.bg} />
      </mesh>
      <mesh position={[0, h - 0.35, 0.06]}>
        <planeGeometry args={[0.5, 0.14]} />
        <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg, 0.5 / 0.14)} />
      </mesh>
    </group>
  )
}

// ── 보도 펜스 ────────────────────────────────
export function Fence({ item }) {
  const [w, h] = item.size
  const posts = Math.max(2, Math.round(w) + 1)
  return (
    <group>
      {range(posts).map((i) => (
        <mesh key={i} position={[-w / 2 + (w * i) / (posts - 1), h / 2, 0]}>
          <boxGeometry args={[0.06, h, 0.06]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
      ))}
      {[0.45, 0.95].map((t) => (
        <mesh key={t} position={[0, h * t, 0]}>
          <boxGeometry args={[w, 0.05, 0.05]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
      ))}
    </group>
  )
}

// ── 자판기 ───────────────────────────────────
export function Vending({ item }) {
  const [w, h, d] = item.size
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={item.color ?? '#e04848'} />
      </mesh>
      <mesh position={[0, h * 0.62, d / 2 + 0.01]}>
        <planeGeometry args={[w - 0.15, h * 0.55]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, h * 0.62, d / 2 + 0.015]}>
        <planeGeometry args={[w - 0.3, h * 0.42]} />
        <meshStandardMaterial color="#1f2937" metalness={0.2} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.35, d / 2 + 0.02]}>
        <boxGeometry args={[w * 0.6, 0.2, 0.04]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  )
}
