import { useMemo } from 'react'
import { Shape } from 'three'
import { Box, GEO, Instances, mat, seeded } from '../kit.jsx'

const RED = '#913c2d'
const TRIM = '#326358'
const TILE = '#535956'
const STONE = mat('#ffffff', { roughness: 0.96 })

// [3. 개발 > 프론트엔드] 전통 홍살빛 대문과 돌담, 파란 지붕 포구 주택.
export function HjVillageGate({ item }) {
  const [width, height, depth] = item.size
  const eave = height * 0.67
  const tileCount = Math.ceil(width / 0.21)
  const profile = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-depth / 2, 0.12)
    shape.quadraticCurveTo(-depth * 0.32, -0.16, 0, 1.18)
    shape.quadraticCurveTo(depth * 0.32, -0.16, depth / 2, 0.12)
    shape.lineTo(depth / 2, -0.16)
    shape.quadraticCurveTo(depth * 0.32, -0.44, 0, 0.87)
    shape.quadraticCurveTo(-depth * 0.32, -0.44, -depth / 2, -0.16)
    shape.closePath()
    return shape
  }, [depth])
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * width * 0.33, 0, 0]}>
          <Box p={[0, 0.15, 0]} s={[0.72, 0.3, 0.78]} c="#c9bd9c" />
          <Box p={[0, eave / 2, 0]} s={[0.45, eave, 0.58]} c={RED} />
          <Box p={[0, eave - 0.24, 0]} s={[0.69, 0.34, 0.86]} c={TRIM} />
        </group>
      ))}
      <Box p={[0, eave - 0.23, 0]} s={[width * 0.83, 0.24, depth * 0.86]} c={TRIM} />
      <Box p={[0, eave - 0.47, 0]} s={[width * 0.82, 0.1, depth * 0.77]} c="#c49a5f" />
      <mesh position={[-width / 2, eave, 0]} rotation-y={Math.PI / 2}>
        <extrudeGeometry args={[profile, { depth: width, curveSegments: 16, bevelEnabled: false }]} />
        <meshStandardMaterial color={TILE} roughness={0.92} />
      </mesh>
      <Box p={[0, eave + 1.13, 0]} s={[width + 0.16, 0.17, 0.2]} c="#aaa995" />
      {[-1, 1].map((side) => (
        <Instances key={side} geometry={GEO.cyl8} material={STONE}
          items={Array.from({ length: tileCount }, (_, i) => ({
            p: [((i + 0.5) / tileCount - 0.5) * width, eave + 0.025, side * depth * 0.49],
            s: [0.077, 0.22, 0.077], r: [Math.PI / 2, 0, 0], c: i % 3 ? TILE : '#747a72',
          }))} />
      ))}
    </group>
  )
}

export function HjVillageWall({ item }) {
  const [width, height, depth] = item.size
  const stones = useMemo(() => {
    const rng = seeded(82)
    const columns = Math.ceil(width / 0.43)
    const rows = Math.ceil(height / 0.24)
    const cell = width / columns
    return Array.from({ length: rows * columns }, (_, i) => {
      const row = Math.floor(i / columns)
      return {
        p: [((i % columns) + 0.5) * cell - width / 2, (row + 0.5) * height / rows, 0],
        s: [cell * (0.83 + rng() * 0.15), height / rows * 0.87, depth + rng() * 0.06],
        r: [0, 0, (rng() - 0.5) * 0.17],
        c: ['#897b63', '#b09a78', '#756c5b', '#a5967c'][Math.floor(rng() * 4)],
      }
    })
  }, [width, height, depth])
  return (
    <group>
      <Box p={[0, height / 2, 0]} s={[width, height, depth * 0.86]} c="#d0bd9a" />
      <Instances geometry={GEO.rock} material={STONE} items={stones} />
      <Box p={[0, height + 0.06, 0]} s={[width + 0.06, 0.12, depth * 1.4]} c={TILE} />
    </group>
  )
}

export function HjPortHouse({ item }) {
  const [width, height, depth] = item.size
  const roof = item.color ?? '#268ab2'
  return (
    <group>
      <Box p={[0, height * 0.43, 0]} s={[width, height * 0.86, depth]} c="#e1d9c7" />
      <Box p={[0, 0.19, 0]} s={[width + 0.08, 0.38, depth + 0.08]} c="#959282" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[0, height * 0.89, side * depth * 0.255]} s={[width + 0.34, 0.14, depth * 0.56]}
            r={[side * 0.16, 0, 0]} c={roof} />
          <Box p={[side * width * 0.28, height * 0.55, depth / 2 + 0.035]}
            s={[width * 0.26, height * 0.31, 0.075]} c="#84abb6" />
          <Box p={[side * width * 0.28, height * 0.55, depth / 2 + 0.085]}
            s={[0.055, height * 0.31, 0.04]} c="#f1e5ce" />
        </group>
      ))}
      <Box p={[0, height * 0.45, depth / 2 + 0.03]} s={[width * 0.17, height * 0.73, 0.08]} c="#42645e" />
      <Box p={[0, height * 0.94, 0]} s={[width + 0.43, 0.12, 0.13]} c="#4dc1dd" />
    </group>
  )
}
