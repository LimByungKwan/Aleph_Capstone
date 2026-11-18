import { useMemo } from 'react'
import * as THREE from 'three'
import { layout } from '../data/mapData.js'
import { SKY_COLORS } from '../config.js'

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)

// 맵 밖의 장식 지형: 플레이 영역은 그대로 두고 해안과 전망대 뒤 풍경만 연장한다.
function makeLandscape(mountain) {
  const positions = [], colors = [], indices = []
  const [w, d] = layout.ground.size
  const [cx, cz] = layout.ground.center ?? [0, 0]
  const angles = 144, rings = 48
  const grass = new THREE.Color(SKY_COLORS.outerGround)
  const sand = new THREE.Color('#cbbf95')
  for (let i = 0; i <= angles; i++) {
    const t = i / angles
    const angle = Math.PI / 4 + t * Math.PI + (mountain ? Math.PI : 0)
    const dx = Math.cos(angle), dz = Math.sin(angle)
    const inner = Math.min(w / 2 / Math.max(Math.abs(dx), 1e-8), d / 2 / Math.max(Math.abs(dz), 1e-8))
    const coast = smooth(0, .13, Math.min(t, 1 - t))
    for (let j = 0; j <= rings; j++) {
      const v = j / rings
      const radius = inner + v * 260
      const x = cx + dx * radius, z = cz + dz * radius
      const fade = 1 - smooth(.78, 1, v)
      let height = 0
      let color
      if (mountain) {
        const ridge = Math.sin(Math.PI * v) ** 1.4
        const peaks = 30 + 13 * Math.sin(angle * 5 + .8) + 8 * Math.cos(angle * 9)
        height = coast * ridge * (peaks + 2 * Math.sin(x * .06) * Math.cos(z * .05))
        color = new THREE.Color('#819e70').lerp(new THREE.Color('#abb1a1'), smooth(16, 42, height))
      } else {
        color = new THREE.Color('#286f91').lerp(new THREE.Color('#205c7e'), smooth(0, .65, v))
      }
      color.lerp(sand, 1 - coast).lerp(grass, 1 - fade)
      positions.push(x, -.12 + height - 5.88 * (1 - fade), z)
      colors.push(color.r, color.g, color.b)
      if (i && j) {
        const a = i * (rings + 1) + j
        indices.push(a - rings - 2, a, a - rings - 1, a - rings - 2, a - 1, a)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export default function Landscape() {
  const sea = useMemo(() => makeLandscape(false), [])
  const mountains = useMemo(() => makeLandscape(true), [])
  const [w, d] = layout.ground.size
  const [cx, cz] = layout.ground.center ?? [0, 0]
  return (
    <group name="outer-landscape">
      <mesh geometry={sea}>
        <meshStandardMaterial vertexColors roughness={.85} />
      </mesh>
      <mesh geometry={mountains}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {/* 판의 윗면과 중복되지 않는 수직 옆면만 생성한다. */}
      {[
        [[cx, -3, cz - d / 2], [w, 6], 0],
        [[cx, -3, cz + d / 2], [w, 6], Math.PI],
        [[cx - w / 2, -3, cz], [d, 6], Math.PI / 2],
        [[cx + w / 2, -3, cz], [d, 6], -Math.PI / 2],
      ].map(([position, size, rotation], i) => (
        <mesh key={i} position={position} rotation={[0, rotation, 0]}>
          <planeGeometry args={size} />
          <meshStandardMaterial color="#9c9984" side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
