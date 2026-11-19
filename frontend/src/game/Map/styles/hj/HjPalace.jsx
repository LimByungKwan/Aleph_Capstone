import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Shape } from 'three'
import { Box, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture, getTiledTexture } from '../textures.js'
import { DancheongBand, PalaceLatticeCorridor, PalaceTerrace } from './HjPalaceDetails.jsx'
import { PalaceGardens } from './HjPalaceGardens.jsx'
import HjPalaceInterior from './HjPalaceInterior.jsx'
import { THRONE_ROOM_POSITION } from '../../../../components/movieZone/palaceInteriorLayout.js'

const PLASTER = '#dfd2b7'
const RED = '#904033'
const GREEN = '#376153'
const GOLD = '#c49a55'
const FRAME = mat('#ffffff', { roughness: 0.85 })
const GLOW = mat('#ffdf9b', { emissive: '#fbad55', emissiveIntensity: 0.72 })

// [3. 개발 > 프론트엔드] 기와 골과 들린 처마를 가진 조선 궁궐 세트.
function roofGeometry(width, depth, rise) {
  const vertices = [], indices = [], colors = []
  const columns = Math.ceil(width * 9), rows = 20
  const dark = new Color('#38454e'), light = new Color('#66757d')
  const tile = new Color()
  for (let row = 0; row <= rows; row += 1) {
    const z = row / rows * 2 - 1
    for (let col = 0; col <= columns; col += 1) {
      const x = col / columns * 2 - 1
      const slope = Math.max(Math.abs(z), Math.max(0, (Math.abs(x) - 0.64) / 0.36))
      const corner = Math.pow(Math.abs(x * z), 4) * rise * 0.29
      const corrugation = col % 2 ? 0.045 : 0
      vertices.push(x * width / 2, rise * (1 - slope) ** 1.55 + corner + corrugation, z * depth / 2)
      tile.copy(dark).lerp(light, (col % 2 ? 0.63 : 0.13) + (row % 4 ? 0 : 0.14))
      colors.push(tile.r, tile.g, tile.b)
      if (row && col) {
        const a = row * (columns + 1) + col
        const b = a - columns - 1
        indices.push(b - 1, a - 1, b, b, a - 1, a)
      }
    }
  }
  const mesh = new BufferGeometry()
  mesh.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  mesh.setAttribute('color', new Float32BufferAttribute(colors, 3))
  mesh.setIndex(indices)
  mesh.computeVertexNormals()
  return mesh
}

function TiledRoof({ width, depth, rise, y }) {
  const geometry = useMemo(() => roofGeometry(width, depth, rise), [width, depth, rise])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group position-y={y}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.9} />
      </mesh>
      <Box p={[0, rise + 0.055, 0]} s={[width * 0.69, 0.13, 0.2]} c="#b3afa0" />
      <Box p={[0, -0.12, 0]} s={[width * 0.95, 0.15, depth * 0.9]} c={GREEN} />
    </group>
  )
}

function Pavilion({ position, width, depth, height, upper = false, open = false, ornate = false, interior = false, rotation = 0, title }) {
  const columns = Math.max(4, Math.ceil(width / 2.05))
  const timbers = []
  for (const side of [-1, 1]) {
    for (let i = 0; i <= columns; i += 1) {
      const x = (i / columns - 0.5) * width * 0.91
      const acrossEntrance = interior && side < 0 && Math.abs(x) < 1.58
      if (!acrossEntrance && (!open || Math.abs(x) > Math.min(2.65, width * 0.27))) timbers.push({
        p: [x, height * 0.46, side * depth * 0.42], s: [0.24, height * 0.91, 0.24], c: RED,
      })
      timbers.push({ p: [x, height - 0.33, side * depth * 0.43], s: [0.44, 0.2, 0.38], c: GOLD })
    }
  }
  return (
    <group position={position} rotation-y={rotation}>
      {interior && <HjPalaceInterior />}
      {!open && !interior && <Box p={[0, height * 0.46, 0]} s={[width * 0.93, height * 0.91, depth * 0.81]} c={RED} />}
      {!open && !interior && Array.from({ length: columns }, (_, index) => (
        <Box key={index} p={[(index + 0.5 - columns / 2) * width * 0.91 / columns, height * 0.53, -depth * 0.412]}
          s={[width * 0.63 / columns, height * 0.54, 0.08]} m={GLOW} />
      ))}
      <Instances geometry={GEO.box} material={FRAME} items={timbers} />
      {ornate && <>
        <Box p={[0, height - 0.42, -depth * 0.457]} s={[width * 0.94, 0.095, 0.07]} m={GLOW} />
        <DancheongBand width={width * 0.94} y={height - 0.46} z={-depth * 0.436} />
        {!open && !interior && Array.from({ length: columns }, (_, index) => (
          <Box key={index} p={[(index + 0.5 - columns / 2) * width * 0.9 / columns, height * 0.465, -depth * 0.43]}
            s={[width * 0.49 / columns, height * 0.31, 0.068]} c={index % 3 ? '#48786b' : '#568a78'} />
        ))}
      </>}
      <Box p={[0, height - 0.19, 0]} s={[width * 1.005, 0.23, depth * 0.92]} c={GREEN} />
      <TiledRoof width={width + 1.1} depth={depth + 0.85} rise={height * 0.28} y={height} />
      {upper && <>
        <Box p={[0, height + 0.63, 0]} s={[width * 0.72, 1.47, depth * 0.65]} c={RED} />
        <Box p={[0, height + 1.31, 0]} s={[width * 0.77, 0.24, depth * 0.73]} c={GREEN} />
        {ornate && <>
          <Box p={[0, height + 1.05, -depth * 0.37]} s={[width * 0.73, 0.06, 0.06]} m={GLOW} />
          <DancheongBand width={width * 0.72} y={height + 1.04} z={-depth * 0.35} />
          {Array.from({ length: columns }, (_, index) => (
            <Box key={index} p={[(index + 0.5 - columns / 2) * width * 0.69 / columns, height + 0.79, -depth * 0.331]}
              s={[width * 0.48 / columns, 0.42, 0.065]} m={GLOW} />
          ))}
        </>}
        <TiledRoof width={width * 0.87} depth={depth * 0.83} rise={height * 0.33} y={height + 1.45} />
      </>}
      {title && <mesh position={[0, height - 0.48, -depth * 0.47]} rotation-y={Math.PI}>
        <planeGeometry args={[Math.min(3.65, width * 0.45), 0.63]} />
        <meshBasicMaterial map={getSignTexture(title, '#292e28', '#e5ca88')} />
      </mesh>}
    </group>
  )
}

const arches = new Shape()
arches.moveTo(-6.65, 0)
for (const [center, radius] of [[-3.9, 1.07], [0, 1.45], [3.9, 1.07]]) {
  const springline = 2.65 - radius
  arches.lineTo(center - radius, 0)
  arches.lineTo(center - radius, springline)
  arches.absarc(center, springline, radius, Math.PI, 0, true)
  arches.lineTo(center + radius, 0)
}
arches.lineTo(6.65, 0)
arches.lineTo(6.65, 3.05)
arches.lineTo(-6.65, 3.05)
arches.closePath()

export default function HjPalace({ item }) {
  const [width, height, depth] = item.size
  const causeway = useMemo(() => getTiledTexture('stone', 3.7, 21), [])
  useEffect(() => () => causeway?.dispose(), [causeway])
  const lamps = Array.from({ length: 18 }, (_, i) => ({
    p: [(i % 2 ? 1 : -1) * (i < 10 ? 3.32 : 20.7), 0.42, -19 + Math.floor(i / 2) * 4.8], s: [0.29, 0.37, 0.27],
  }))
  return (
    <group scale={[width / 53, height / 9, depth / 53]}>
      <Box p={[0, -0.16, 0]} s={[53, 0.44, 53]} c="#8b9273" />
      <Box p={[0, 0.142, 0]} s={[47.9, 0.055, 47.8]} c="#d8cdb5" />
      <Box p={[0, 0.182, 0]} s={[5.6, 0.035, 45]} c="#b6ac98" />
      <mesh position={[0, 0.206, -7.85]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4.92, 28.9]} />
        <meshStandardMaterial map={causeway} color="#aeb4a9" roughness={0.91} />
      </mesh>
      <mesh position={[0, 0.17, -23.2]}>
        <extrudeGeometry args={[arches, { depth: 2.5, bevelEnabled: false, curveSegments: 16 }]} />
        <meshStandardMaterial color={PLASTER} roughness={0.9} />
      </mesh>
      <Pavilion position={[0, 3.2, -21.95]} width={15} depth={4.8} height={2.55} upper title="해월문" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[side * 15.28, 1.13, -21.95]} s={[17.3, 2.1, 1.0]} c={PLASTER} />
          <group position={[side * 15.28, 0, -21.95]}>
            <TiledRoof width={17.55} depth={1.5} rise={0.44} y={2.23} />
          </group>
          <Pavilion position={[side * 22.95, 0.17, -0.1]} width={42} depth={3.0} height={2.06} rotation={Math.PI / 2} />
          <Pavilion position={[side * 13.76, 0.17, -6.25]} width={17.4} depth={2.4} height={2.07} />
          <Pavilion position={[side * 15.7, 0.22, 19.8]} width={9.1} depth={5.1} height={3.0} />
        </group>
      ))}
      <Pavilion position={[0, 0.17, 23.15]} width={46.7} depth={2.15} height={1.8} />
      <Pavilion position={[0, 0.17, -6.25]} width={8.6} depth={4.1} height={2.74} open upper title="명월문" />
      <Box p={[0, 0.47, 13.3]} s={[18, 0.61, 14.2]} c="#b6ad98" />
      <Box p={[0, 0.81, 13.6]} s={[15.8, 0.22, 12.3]} c="#d7cfbd" />
      {[0.23, 0.36, 0.49, 0.62, 0.75].map((h, index) => (
        <Box key={h} p={[0, h / 2, 4.58 + index * 0.36]} s={[4.75, h, 0.37]} c={PLASTER} />
      ))}
      <Pavilion position={THRONE_ROOM_POSITION} width={14.2} depth={8.1} height={3.8} upper ornate interior title="해월정전" />
      <PalaceTerrace />
      <PalaceGardens Pavilion={Pavilion} />
      <PalaceLatticeCorridor Pavilion={Pavilion} />
      <Instances geometry={GEO.box} material={GLOW} items={lamps} />
      <pointLight position={[0, 3.6, -19.4]} color="#ffbb72" intensity={25} distance={12} />
      <pointLight position={[0, 3.6, 8.7]} color="#ffd293" intensity={27} distance={13} />
    </group>
  )
}
