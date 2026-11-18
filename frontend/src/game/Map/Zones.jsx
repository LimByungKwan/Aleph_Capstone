import { DoubleSide, Shape, ShapeGeometry } from 'three'
import { zones } from '../data/mapData.js'
import { Box, Cyl, GEO, Instances, mat } from './styles/kit.jsx'
import { getSignTexture } from './styles/textures.js'
import { getWoodSignTexture } from './styles/hj/hjTextures.js'

// [3. 개발 > 프론트엔드] 광장에서 각 테마로 이어지는 실제 3D 입구.
const GATES = {
  JM: { title: '애니메이션 골목', subtitle: '이야기가 시작되는 길', post: '#a54c3d', roof: '#354b49', ink: '#fff3d6', face: 0 },
  BK: { title: '데이트 산책길', subtitle: '함께 걷는 작은 정원', post: '#78916e', roof: '#48644a', ink: '#fff6ed', face: -90 },
  HJ: { title: '영화·드라마 거리', subtitle: 'SceneWalk · 촬영지 골목', post: '#574032', roof: '#3a2b26', ink: '#fff3d6', face: 180 },
  SG: { title: 'K-POP 스테이지', subtitle: '음악이 흐르는 거리', post: '#352948', roof: '#201b32', ink: '#ffe9ff', face: 90 },
}

const heartShape = new Shape()
heartShape.moveTo(0, -0.53)
heartShape.bezierCurveTo(-1.25, 0.35, -0.36, 0.99, 0, 0.46)
heartShape.bezierCurveTo(0.36, 0.99, 1.25, 0.35, 0, -0.53)
const heart = new ShapeGeometry(heartShape)
const heartMaterial = mat('#f2b8c6', { emissive: '#da758d', emissiveIntensity: 0.35 })
const flowerMaterial = mat('#fff', { flat: true })
const lightMaterial = mat('#fff1c9', { emissive: '#ffd27a', emissiveIntensity: 1.1 })
const curbMaterial = mat('#ffffff', { flat: true })

function borders(zone) {
  const [width, depth] = zone.size
  const [ex, ez] = zone.entrance?.position ?? [Infinity, Infinity]
  const gap = (zone.entrance?.width ?? 6) / 2 + 1.15
  const margin = 0.32
  const edges = []
  function edge(alongX, fixed, half, cutAt) {
    const segments = Number.isFinite(cutAt)
      ? [[-half, Math.max(-half, cutAt - gap)], [Math.min(half, cutAt + gap), half]]
      : [[-half, half]]
    for (const [from, to] of segments) {
      if (to <= from) continue
      const middle = (from + to) / 2
      const length = to - from
      edges.push({
        p: alongX ? [middle, 0.1, fixed] : [fixed, 0.1, middle],
        s: alongX ? [length, 0.2, 0.55] : [0.55, 0.2, length],
        c: zone.color,
      })
    }
  }
  for (const sign of [-1, 1]) {
    const beachExit = zone.zoneId === 'SG' && sign === 1
    edge(true, sign * (depth / 2 + margin), width / 2 + margin + 0.275,
      beachExit ? -16 : Math.abs(ez - sign * depth / 2) < 1 ? ex : Infinity)
    edge(false, sign * (width / 2 + margin), depth / 2 + margin - 0.275,
      Math.abs(ex - sign * width / 2) < 1 ? ez : Infinity)
  }
  return edges
}

const themeBorders = zones.map((zone) => ({ zone, items: borders(zone) }))

export default function Zones() {
  return themeBorders.map(({ zone, items }) => {
    const gate = GATES[zone.zoneId]
    const { position: [x, z], width = 6 } = zone.entrance ?? { position: [0, 0] }
    const [ox, oz] = zone.origin
    return (
      <group key={zone.zoneId} position={[ox, 0, oz]}>
        <Instances geometry={GEO.box} material={curbMaterial} items={items} />
        {zone.entrance && gate && (
          <group name={gate.title} position={[x, 0, z]} rotation={[0, gate.face * Math.PI / 180, 0]}>
            <ThemeGate id={zone.zoneId} gate={gate} width={width} />
          </group>
        )}
      </group>
    )
  })
}

function ThemeGate({ id, gate, width }) {
  const half = width / 2 + 0.77
  const span = half * 2
  const texture = id === 'HJ'
    ? getWoodSignTexture(gate.title, gate.subtitle)
    : getSignTexture(gate.title, gate.roof, gate.ink)

  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * half, 0, 0]}>
          <Box p={[0, 0.17, 0]} s={[0.86, 0.34, 0.88]} c="#68706b" />
          <Box p={[0, 2.35, 0]} s={[0.44, 4.4, 0.49]} c={gate.post} />
          {id === 'JM' && <Cyl p={[0, 3.52, 0.48]} rad={0.23} h={0.55} c="#ffd29a" />}
          {id === 'SG' && <Box p={[0, 2.55, 0.26]} s={[0.14, 2.95, 0.04]} m={mat('#c8acff', { emissive: '#9a7cf3', emissiveIntensity: 0.8 })} />}
          {id === 'BK' && <GardenFlowers side={side} />}
        </group>
      ))}
      <Box p={[0, 4.48, 0]} s={[span + 0.85, 0.32, 0.72]} c={gate.roof} />
      {id === 'JM' && (
        <>
          <Box p={[0, 4.79, 0]} s={[span + 1.2, 0.24, 1.04]} c={gate.roof} />
          {[-1, 1].map((side) => <Box key={side} p={[side * (half + 0.56), 4.83, 0]} s={[0.9, 0.23, 1.04]} r={[0, 0, side * 0.16]} c={gate.roof} />)}
        </>
      )}
      {id === 'BK' && (
        <>
          <mesh geometry={heart} material={heartMaterial} position={[0, 5.06, 0.25]} scale={[0.54, 0.54, 0.54]} />
          <GardenFlowers side={1} across />
        </>
      )}
      {id === 'SG' && (
        <mesh position={[0, 4.88, 0]}>
          <torusGeometry args={[0.45, 0.06, 5, 20]} />
          <meshBasicMaterial color="#c8acff" />
        </mesh>
      )}
      {id === 'HJ' && (
        <Instances geometry={GEO.sphere} material={lightMaterial} items={Array.from({ length: 12 }, (_, i) => {
          const t = i / 11
          return { p: [(t - 0.5) * span, 4.21 - Math.sin(Math.PI * t) * 0.23, 0.4], s: [0.065, 0.065, 0.065] }
        })} />
      )}
      <Box p={[0, 3.93, 0]} s={[2.97, 0.88, 0.17]} c={gate.roof} />
      <mesh position={[0, 3.93, 0.09]}>
        <planeGeometry args={[2.88, 0.8]} />
        <meshStandardMaterial map={texture} side={DoubleSide} roughness={0.9} />
      </mesh>
    </>
  )
}

function GardenFlowers({ side, across = false }) {
  const palette = ['#e6a4b4', '#f6d3d7', '#f8e7c5', '#759560']
  const items = Array.from({ length: across ? 16 : 9 }, (_, i) => ({
    p: across ? [1.7 + i * 0.12, 4.63 + Math.sin(i * 2) * 0.12, 0.27] : [side * (0.16 + (i % 2) * 0.10), 0.58 + i * 0.17, 0.29],
    c: palette[i % palette.length],
    s: [0.14, 0.12, 0.11],
  }))
  return <Instances geometry={GEO.rock} material={flowerMaterial} items={items} />
}
