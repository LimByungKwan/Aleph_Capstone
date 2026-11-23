import { useEffect, useMemo } from 'react'
import { DoubleSide, ExtrudeGeometry, Shape } from 'three'
import { Box, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { FLOOR, MAIN_GATE, THRONE } from './gyeongbokgungLayout.js'
import { tiledRoof } from './gyeongbokgungMaterials.js'

const PALETTE = mat('#fff', { roughness: .87 })
const STONE = '#cbc2af'
const WOOD = '#943f31'
const GREEN = '#356759'

function gateBase() {
  const footprint = new Shape()
  footprint.moveTo(-8.5, 0)
  for (const [x, radius, spring] of [[-5.42, 1.25, 1.28], [0, 1.68, 1.3], [5.42, 1.25, 1.28]]) {
    footprint.lineTo(x - radius, 0)
    footprint.lineTo(x - radius, spring)
    footprint.absarc(x, spring, radius, Math.PI, 0, true)
    footprint.lineTo(x + radius, 0)
  }
  footprint.lineTo(8.5, 0)
  footprint.lineTo(8.5, 3.18)
  footprint.lineTo(-8.5, 3.18)
  footprint.closePath()
  return new ExtrudeGeometry(footprint, { depth: MAIN_GATE.d, bevelEnabled: false, curveSegments: 20 })
    .translate(0, FLOOR, -MAIN_GATE.d / 2)
}

function GateFloor({ width, depth, base, height, roof, slats, band, roofMaterial }) {
  const boards = [], windows = [], paintings = []
  for (const side of [-1, 1]) {
    const z = side * depth / 2
    const r = [0, side === -1 ? Math.PI : 0, 0]
    for (let i = 0; i < 8; i += 1) {
      const pitch = width / 8
      const x = (i - 3.5) * pitch
      boards.push({ p: [x - pitch / 2, base + height / 2, z], s: [.25, height, .25], c: WOOD })
      paintings.push({ p: [x, base + height - .19, z + side * .145], s: [pitch, .32, 1], r })
      windows.push({ p: [x, base + height * .52, z + side * .06], s: [pitch * .78, height * .48, 1], r })
    }
    boards.push({ p: [width / 2, base + height / 2, z], s: [.25, height, .25], c: WOOD })
  }
  return (
    <>
      <Box p={[0, base + height * .45, 0]} s={[width, height * .9, depth]} c={WOOD} />
      <Box p={[0, base + height - .12, 0]} s={[width + .22, .25, depth + .21]} c={GREEN} />
      <Instances geometry={GEO.box} material={PALETTE} items={boards} castShadow />
      <Instances geometry={GEO.plane} material={slats} items={windows} />
      <Instances geometry={GEO.plane} material={band} items={paintings} />
      <mesh geometry={roof} material={roofMaterial} position-y={base + height} />
      <Box p={[0, base + height + (height > 2.15 ? 1.57 : 1.43), 0]} s={[width * .74, .14, .19]} c="#b2aea0" />
    </>
  )
}

export function Gwanghwamun({ materials }) {
  const geometries = useMemo(() => ({
    base: gateBase(),
    first: tiledRoof(16.25, 6.54, 1.59),
    upper: tiledRoof(13.45, 5.33, 1.45),
  }), [])
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries])
  const blocks = []
  for (const sign of [-1, 1]) {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 22; col += 1) {
        const x = -8.08 + col * .75 + (row % 2) * .29
        const y = FLOOR + .23 + row * .426
        if ([[-5.42, 1.25, 1.28], [0, 1.68, 1.3], [5.42, 1.25, 1.28]].some(([cx, rad, spring]) =>
          x > cx - rad - .4 && x < cx + rad + .4 && y < spring + Math.sqrt(Math.max(0, rad ** 2 - (x - cx) ** 2)) + .16)) continue
        blocks.push({ p: [x, y, sign * 2.71], s: [.72, .402, .065],
          c: ['#c9c2b1', '#d2c9b8', '#bdb5a6', '#c4bbae'][(col * 3 + row) % 4] })
      }
    }
    for (const [cx, rad, spring] of [[-5.42, 1.25, 1.28], [0, 1.68, 1.3], [5.42, 1.25, 1.28]]) {
      for (let i = 0; i < 12; i += 1) {
        const t = (i + .5) * Math.PI / 12
        blocks.push({ p: [cx + Math.cos(t) * (rad + .14), FLOOR + spring + Math.sin(t) * (rad + .12), sign * 2.77],
          s: [rad * .237, .22, .115], r: [0, 0, t - Math.PI / 2], c: i % 2 ? '#dcd1bb' : '#c7bdab' })
      }
    }
  }
  return (
    <group position={[MAIN_GATE.x, 0, MAIN_GATE.z]} name="광화문">
      <mesh geometry={geometries.base}>
        <meshStandardMaterial color={STONE} roughness={.92} side={DoubleSide} />
      </mesh>
      <Instances geometry={GEO.box} material={PALETTE} items={blocks} />
      <Box p={[0, 3.31, 0]} s={[17.17, .17, 5.62]} c="#bfb5a3" />
      <Box p={[0, 3.52, 0]} s={[16.7, .19, 5.37]} c="#d7c9b1" />
      <GateFloor width={14.12} depth={4.82} base={3.57} height={2.38} roof={geometries.first}
        slats={materials.lattice} band={materials.dancheong} roofMaterial={materials.roof} />
      <GateFloor width={11.3} depth={3.96} base={6.33} height={2.04} roof={geometries.upper}
        slats={materials.lattice} band={materials.dancheong} roofMaterial={materials.roof} />
      <mesh position={[0, 7.89, -2.18]} rotation-y={Math.PI}>
        <planeGeometry args={[2.76, .60]} />
        <meshBasicMaterial map={getSignTexture('광화문', '#5a4733', '#fff0cb')} />
      </mesh>
    </group>
  )
}

export function PalaceTerraceDetails() {
  const rail = [], stones = []
  for (const side of [-1, 1]) {
    for (const [width, depth, height, center] of [[21.2, 14.23, .53, THRONE.z], [17.7, 11.3, .95, THRONE.z + .24]]) {
      for (let i = 0; i < 15; i += 1) {
        const z = center + (i / 14 - .5) * depth
        rail.push({ p: [side * width / 2 + THRONE.x, height + .15, z], s: [.18, .31, .17], c: STONE })
      }
      rail.push({ p: [side * width / 2 + THRONE.x, height + .318, center], s: [.17, .088, depth], c: '#ded7c6' })
      for (let i = 0; i < 6; i += 1) {
        const x = THRONE.x + side * (2.67 + i * (width / 2 - 2.77) / 5)
        rail.push({ p: [x, height + .15, center - depth / 2], s: [.19, .31, .15], c: STONE })
      }
      rail.push({ p: [THRONE.x + side * (2.62 + width / 2) / 2, height + .318, center - depth / 2],
        s: [width / 2 - 2.62, .088, .16], c: '#ded7c6' })
    }
    for (let i = 0; i < 7; i += 1) {
      const z = THRONE.z - 10.15 + i * .44
      const x = THRONE.x + side * (3.82 + i * .028)
      stones.push({ p: [x, .234, z], s: [.48, .17, .31], c: '#a79f91' })
      stones.push({ p: [x, .45, z], s: [.24, .32, .21], r: [side * .095, 0, 0], c: '#c3baa7' })
    }
  }
  return (
    <>
      <Instances geometry={GEO.box} material={PALETTE} items={rail} />
      <Instances geometry={GEO.box} material={PALETTE} items={stones} />
    </>
  )
}
