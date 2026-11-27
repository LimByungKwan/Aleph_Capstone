import { useMemo } from 'react'
import { CatmullRomCurve3, Shape, ShapeGeometry, Vector3 } from 'three'
import { LanternGlow, nightGlow } from './dateCourse.jsx'
import { Box, Cone, Cyl, GEO, Instances, mat, seeded, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'

const STONE = '#f3dcc4'
const ROSE = '#a94361'
const WINE = '#64263e'
const GOLD = '#d7a365'
const PINK_LIGHT = nightGlow(mat('#ffc4d7', { emissive: '#ff8ab6', emissiveIntensity: 0 }), 1.35)
const LANTERN_GLASS = nightGlow(mat('#fff4d9', { emissive: '#ffd29a', emissiveIntensity: 0 }), 2)
const FOLIAGE = mat('#ffffff', { flat: true })
const HEART_SHAPE = new Shape()
HEART_SHAPE.moveTo(0, -0.48)
HEART_SHAPE.bezierCurveTo(-1.05, 0.20, -0.46, 0.87, 0, 0.37)
HEART_SHAPE.bezierCurveTo(0.46, 0.87, 1.05, 0.20, 0, -0.48)
const HEART = new ShapeGeometry(HEART_SHAPE, 20)
const FLOWER_COLORS = ['#ef8da9', '#ffc0cb', '#ffe0bd', '#fff0e7', '#b66692']
const LEAF_COLORS = ['#426043', '#648358', '#80985d']
const SIDES = [-1, 1]
const SIGN_WIDTH = 4.38
const CREST_HEIGHT = 6.08

function planterFlowers() {
  const random = seeded(27)
  const leaves = []
  const petals = []
  const centers = []
  for (let i = 0; i < 26; i++) {
    const angle = i * 2.4
    const radius = Math.sqrt((i + 0.5) / 26)
    const x = Math.cos(angle) * radius * 0.49
    const z = Math.sin(angle) * radius * 1.02
    const y = 0.57 + (1 - radius) * 0.27 + random() * 0.16
    const size = 0.073 + random() * 0.057
    leaves.push({
      p: [x, y - 0.11, z],
      s: [0.15, 0.16, 0.20],
      r: [random(), angle, random()],
      c: LEAF_COLORS[i % LEAF_COLORS.length],
    })
    for (let j = 0; j < 5; j++) {
      const a = angle + j * 2 * Math.PI / 5
      petals.push({
        p: [x + Math.cos(a) * size * 0.75, y, z + Math.sin(a) * size * 0.75],
        s: [size * 0.74, size * 0.42, size * 0.67],
        c: FLOWER_COLORS[i % FLOWER_COLORS.length],
      })
    }
    centers.push({ p: [x, y + size * 0.27, z], s: [size * 0.36, size * 0.32, size * 0.36], c: '#e8b75d' })
  }
  return { leaves, petals, centers }
}

const FLOWERS = planterFlowers()

function ArchTube({ path, material, radius, depth = 0, y = 0 }) {
  return (
    <mesh material={material} position={[0, y, depth]}>
      <tubeGeometry args={[path, 48, radius, 8, false]} />
    </mesh>
  )
}

function EntranceColumn({ x }) {
  return (
    <group position={[x, 0, 0]}>
      <Box p={[0, 0.16, 0]} s={[1.25, 0.32, 1.12]} c={STONE} />
      <Box p={[0, 0.40, 0]} s={[1.08, 0.16, 0.83]} c={GOLD} />
      <Box p={[0, 2.06, 0]} s={[0.62, 3.25, 0.55]} c={ROSE} />
      <Box p={[0, 3.65, 0]} s={[0.78, 0.10, 0.76]} c={GOLD} />
      <Box p={[0, 3.77, 0]} s={[0.93, 0.17, 0.88]} c={WINE} />
      {SIDES.map((face) => (
        <group key={face} rotation={[0, face === 1 ? 0 : Math.PI, 0]}>
          <Box p={[0, 1.54, 0.283]} s={[0.28, 1.98, 0.03]} c={WINE} />
          <Box p={[0, 1.53, 0.303]} s={[0.065, 1.66, 0.02]} m={PINK_LIGHT} />
          <Box p={[0, 2.91, 0.32]} s={[0.19, 0.09, 0.32]} c={GOLD} />
          <Cyl p={[0, 2.88, 0.53]} rad={0.15} h={0.38} m={LANTERN_GLASS} geo={GEO.cyl8} />
          <Cone p={[0, 3.12, 0.53]} rad={0.21} h={0.21} c={WINE} />
          <Cyl p={[0, 2.67, 0.53]} rad={0.17} h={0.08} c={GOLD} geo={GEO.cyl8} />
          <group position={[0, 0, 0.53]}>
            <LanternGlow height={2.88} groundY={0.17} poolScale={0.52} haloSize={1.25} />
          </group>
        </group>
      ))}
    </group>
  )
}

function EntrancePlanter({ x }) {
  return (
    <group position={[x, 0, 0]}>
      <Box p={[0, 0.22, 0]} s={[1.03, 0.39, 2.03]} c={STONE} />
      <Box p={[0, 0.41, 0]} s={[1.12, 0.10, 2.13]} c={GOLD} />
      <Box p={[0, 0.465, 0]} s={[1.03, 0.02, 2.04]} c="#654536" />
      <Instances geometry={GEO.ico} material={FOLIAGE} items={FLOWERS.leaves} />
      <Instances geometry={GEO.sphere} material={FOLIAGE} items={FLOWERS.petals} />
      <Instances geometry={GEO.sphere} material={FOLIAGE} items={FLOWERS.centers} />
    </group>
  )
}

export default function DateWalkGate({ width, title, subtitle }) {
  const half = width / 2 + 0.77
  const { path, bulbs } = useMemo(() => {
    const path = new CatmullRomCurve3([
      [-half, 3.79], [-half * 0.89, 4.59], [-half * 0.51, 5.29],
      [0, 5.52],
      [half * 0.51, 5.29], [half * 0.89, 4.59], [half, 3.79],
    ].map(([x, y]) => new Vector3(x, y, 0)))
    const bulbs = SIDES.flatMap((side) => Array.from({ length: 17 }, (_, i) => {
      const p = path.getPointAt((i + 1) / 18)
      return { p: [p.x, p.y - 0.135, side * 0.232], s: [0.045, 0.045, 0.045] }
    }))
    return { path, bulbs }
  }, [half])
  const titleMaterial = nightGlow(texMat(
    getSignTexture(title, WINE, '#fff4de', (SIGN_WIDTH - 0.23) / 0.71),
    { emissive: '#ffffff', emissiveIntensity: 0.37 },
  ), 0.98)
  const subtitleMaterial = nightGlow(texMat(
    getSignTexture(subtitle, WINE, '#ffcfad', (SIGN_WIDTH - 0.23) / 0.26),
    { emissive: '#ffffff', emissiveIntensity: 0.30 },
  ), 0.88)

  return (
    <group>
      {SIDES.map((side) => (
        <group key={side}>
          <EntranceColumn x={side * half} />
          <EntrancePlanter x={side * (half + 0.85)} />
        </group>
      ))}
      <ArchTube path={path} material={mat(WINE)} radius={0.275} />
      {SIDES.map((face) => (
        <ArchTube key={face} path={path} material={PINK_LIGHT} radius={0.033} depth={face * 0.269} y={0.068} />
      ))}
      <Instances geometry={GEO.sphere} material={LANTERN_GLASS} items={bulbs} />
      <Box p={[0, 4.32, 0]} s={[SIGN_WIDTH + 0.15, 1.11, 0.30]} c={GOLD} />
      <Box p={[0, 4.32, 0]} s={[SIGN_WIDTH, 1.02, 0.34]} c={WINE} />
      {SIDES.map((x) => <Box key={x} p={[x * 1.61, 5.02, 0]} s={[0.065, 0.86, 0.085]} c={GOLD} />)}
      <Cyl p={[0, CREST_HEIGHT, 0]} rad={0.55} h={0.33} c={GOLD} r={[Math.PI / 2, 0, 0]} geo={GEO.cyl48} />
      <Cyl p={[0, CREST_HEIGHT, 0]} rad={0.48} h={0.35} c={WINE} r={[Math.PI / 2, 0, 0]} geo={GEO.cyl48} />
      {SIDES.map((face) => (
        <group key={face} rotation={[0, face === 1 ? 0 : Math.PI, 0]}>
          <mesh geometry={GEO.plane} material={titleMaterial} position={[0, 4.45, 0.174]} scale={[SIGN_WIDTH - 0.23, 0.71, 1]} />
          <mesh geometry={GEO.plane} material={subtitleMaterial} position={[0, 3.956, 0.174]} scale={[SIGN_WIDTH - 0.23, 0.26, 1]} />
          <mesh geometry={HEART} material={PINK_LIGHT} position={[0, CREST_HEIGHT, 0.177]} scale={0.63} />
        </group>
      ))}
    </group>
  )
}
