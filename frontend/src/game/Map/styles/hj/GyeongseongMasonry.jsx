import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, Shape, ShapeGeometry } from 'three'
import { Box, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { StreetSurface } from './GyeongseongMaterial.jsx'

const STONE = '#d3c8af'
const SHADE = '#a99d83'
const WOOD = '#49352a'
const TRIM = mat('#fff')
const RED = '#9a4238'

export function StreetSign({ text, p, w, h = .54, background = '#392f29', ink = '#f6e3be', yaw = Math.PI }) {
  return (
    <mesh position={p} rotation-y={yaw} userData={{ noShadow: true }}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={getSignTexture(text, background, ink, w / h)} toneMapped={false} />
    </mesh>
  )
}

function archShape(radius, rise) {
  const shape = new Shape()
  shape.moveTo(-radius, 0)
  shape.lineTo(radius, 0)
  shape.lineTo(radius, rise)
  shape.absarc(0, rise, radius, 0, Math.PI, false)
  shape.lineTo(-radius, 0)
  return shape
}

function createArch(radius, rise) {
  const outer = radius + .14
  const molding = new Shape()
  molding.moveTo(outer, rise)
  molding.absarc(0, rise, outer, 0, Math.PI, false)
  molding.lineTo(-radius, rise)
  molding.absarc(0, rise, radius, Math.PI, 0, true)
  molding.closePath()
  return {
    glass: new ShapeGeometry(archShape(radius, rise), 20),
    molding: new ExtrudeGeometry(molding, { depth: .14, bevelEnabled: false, curveSegments: 20 }),
  }
}

export function ArchOpening({ x, y, face, radius, rise, material }) {
  const geometry = useMemo(() => createArch(radius, rise), [radius, rise])
  useEffect(() => () => Object.values(geometry).forEach((geo) => geo.dispose()), [geometry])
  return (
    <group position={[x, y, face]}>
      <mesh geometry={geometry.glass} material={material} rotation-y={Math.PI} position-z={-.04} />
      <mesh geometry={geometry.molding} material={mat(STONE)} rotation-y={Math.PI} position-z={-.06} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[side * (radius + .07), rise / 2, -.10]} s={[.14, rise, .18]} c={STONE} />
          <Box p={[side * radius * .48, (rise + radius * .88) / 2, -.055]}
            s={[.047, rise + radius * .88, .053]} c={WOOD} />
        </group>
      ))}
      <Box p={[0, rise, -.072]} s={[2 * radius, .063, .071]} c={WOOD} />
      <Box p={[0, (rise + radius) / 2, -.061]} s={[.053, rise + radius, .073]} c={WOOD} />
      <Box p={[0, -.048, -.11]} s={[2 * radius + .43, .105, .29]} c={SHADE} />
    </group>
  )
}

function Banner({ x, y, face, letters }) {
  return (
    <group position={[x, y, face]}>
      <Box p={[0, 0, 0]} s={[.53, 2.5, .036]} c={RED} />
      <Cyl p={[0, 1.3, 0]} r={[0, 0, Math.PI / 2]} rad={.041} h={.68} c={WOOD} />
      {Array.from(letters).map((letter, index) => (
        <StreetSign key={index} text={letter} p={[0, .91 - index * .36, -.019]} w={.49} h={.34} background={RED} />
      ))}
      <Box p={[0, -1.14, -.025]} s={[.48, .033, .014]} c="#d4a56c" />
    </group>
  )
}

export default function GyeongseongMasonry({ building: { d, w, h, name }, opening, materials, scans }) {
  const face = -d / 2
  const columns = [-w / 2 + .35, -2.88, 2.88, w / 2 - .35]
  const blocks = []
  for (const x of columns) {
    blocks.push(
      { p:[x, 3.55, face - .16], s:[.47, 6.72, .34], c:'#bbb198' },
      { p:[x, .45, face - .21], s:[.68, .88, .48], c:SHADE },
      { p:[x, 6.78, face - .24], s:[.68, .26, .49], c:STONE },
    )
    for (let row = 0; row < 11; row += 1) {
      blocks.push({ p:[x, .9 + row * .5, face - .215], s:[row % 2 ? .63 : .52, .445, .41], c:row % 2 ? '#c0b7a0' : '#b5ad98' })
    }
  }
  for (const [y, width, depth, height] of [[2.6,w+.20,.47,.14],[3.71,w+.29,.64,.19],[6.88,w+.42,.63,.17],[7.10,w+.72,.89,.27],[7.34,w+.53,.49,.15]]) {
    const sides = depth - .22
    blocks.push(
      { p:[0, y, face - depth * .30], s:[width,height,depth], c:STONE },
      { p:[-w/2, y, 0], s:[sides,height,d + .03], c:SHADE },
      { p:[w/2, y, 0], s:[sides,height,d + .03], c:SHADE },
    )
  }

  return (
    <>
      <Instances geometry={GEO.box} material={TRIM} items={blocks} castShadow />
      <StreetSurface scan={scans.stone} p={[0,5.53,face-.014]} w={w-.16} h={3.44} rotation={[0,Math.PI,0]} />
      {[-1,1].map((side) => (
        <group key={side}>
          <StreetSurface scan={scans.stone} p={[side*(w+opening)/4,1.94,face-.014]}
            w={(w-opening)/2} h={3.74} rotation={[0,Math.PI,0]} />
          <ArchOpening x={side * 4.06} y={4.25} face={face - .037} radius={.61} rise={1.01} material={materials.glass} />
          <ArchOpening x={side * 3.75} y={.72} face={face - .036} radius={.81} rise={1.23} material={materials.glass} />
          <Banner x={side * 2.46} y={5.46} face={face - .32} letters={side < 0 ? '경성사진관' : '기념사진'} />
          <Cyl p={[side * 1.63, 2.22, face - .2]} rad={.11} h={.28} m={materials.glass} />
        </group>
      ))}
      <ArchOpening x={0} y={4.48} face={face - .042} radius={1.78} rise={.33} material={materials.glass} />
      <Box p={[0,3.86,face-.62]} s={[5.35,.24,1.48]} c={SHADE} castShadow />
      <Box p={[0,4.45,face-1.285]} s={[5.24,.123,.189]} c={STONE} />
      <Box p={[0,3.99,face-1.285]} s={[5.24,.128,.182]} c={STONE} />
      <Instances geometry={GEO.sphere} material={TRIM} items={Array.from({ length: 13 }, (_, i) => ({
        p:[(i - 6) * .37,4.21,face-1.285], s:[.115,.235,.104], c:i%2 ? '#cfc4aa' : '#d9d1b9',
      }))} />
      {[-1,1].map((side) => (
        <group key={side}>
          <Box p={[side * 2.52,4.23,face-1.25]} s={[.21,.59,.24]} c={STONE} />
          <Box p={[side * 2.52,4.46,face-.73]} s={[.16,.128,1.00]} c={STONE} />
          <Box p={[side * 2.03,3.57,face-.43]} s={[.24,.53,.52]} c={SHADE} r={[-.39,0,0]} />
          <Box p={[side * 2.03,3.37,face-.24]} s={[.32,.13,.42]} c={STONE} />
        </group>
      ))}
      <Box p={[0,2.94,face-.24]} s={[5.8,.81,.36]} c="#755c46" />
      <StreetSign text={name} p={[0,2.94,face-.427]} w={5.54} h={.63} background="#3d4c4b" />
      <Box p={[0,2.47,face-.05]} s={[opening,.11,.16]} c={WOOD} />
      <Box p={[0,h-.13,0]} s={[w+.31,.19,d+.31]} c="#706a5e" />
      <Box p={[0,h+.06,0]} s={[w+.45,.23,d+.45]} c="#98907e" />
      <Box p={[0,h+.68,d*.21]} s={[1.12,1.36,.65]} c="#9e8b70" />
      <Box p={[0,h+1.41,d*.21]} s={[1.29,.14,.80]} c="#87755f" />
    </>
  )
}
