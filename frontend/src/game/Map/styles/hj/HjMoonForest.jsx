import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box, Cyl, GEO, Instances, mat, seeded } from '../kit.jsx'

const WHITE = mat('#ffffff', { roughness: 0.86 })
const SPIRIT = mat('#fff0d5', { emissive: '#996959', emissiveIntensity: 0.48 })
const AMBER = mat('#ffe2a3', { emissive: '#ffb963', emissiveIntensity: 1.15 })

// [3. 개발 > 프론트엔드] 달빛 숲을 걷는 길과 여우 사당 촬영 세트.
export function HjMoonForest() {
  const fireflies = useRef(null)
  const { trunks, leaves, crowns, stones, sparks } = useMemo(() => {
    const rng = seeded(1994)
    const trunks = [], leaves = [], crowns = [], stones = [], sparks = []
    for (const side of [-1, 1]) {
      for (let i = 0; i < 14; i += 1) {
        const z = -29 + i * 4.18 + rng() * 1.2
        const x = side * (4.2 + rng() * 4.4)
        if (side < 0 && z > 10 && z < 18) continue
        const h = 3.1 + rng() * 2
        trunks.push({ p: [x,h / 2,z], s: [0.15,h,0.15], c: '#534a43' })
        for (let layer = 0; layer < 3; layer += 1) {
          const w = 1.45 - layer * 0.33 + rng() * 0.28
          leaves.push({ p: [x,h * (0.57 + layer * 0.16),z], s: [w,h * 0.43,w],
            c: ['#294840','#365949','#41624d'][(i + layer) % 3] })
        }
        stones.push({ p: [x * 0.72,0.27,z + 0.73], s: [0.45,0.37,0.61], c: '#7a8276' })
        sparks.push({ p: [x * 0.67,1.2 + rng() * 2.2,z], s: [0.04,0.04,0.04] })
      }
    }
    // Leave the lantern path and shrine forecourt clear between uneven rows of trees.
    function groveTree(x, z, height) {
      trunks.push({ p: [x, height * 0.40, z], s: [0.19, height * 0.80, 0.20], c: '#524538' })
      for (let layer = 0; layer < 3; layer += 1) {
        const spread = 1.35 - layer * 0.24 + rng() * 0.43
        crowns.push({
          p: [x + (rng() - 0.5) * 0.9, height * (0.62 + layer * 0.15), z + (rng() - 0.5) * 0.8],
          s: [spread, height * 0.24, spread * (0.8 + rng() * 0.37)],
          c: ['#233d33', '#2f4c3a', '#395542', '#456746'][Math.floor(rng() * 4)],
        })
      }
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 15; i += 1) {
        const z = -29 + i * 4.1 + rng() * 1.6
        if (side < 0 && z > 11 && z < 19) continue
        const nearShrine = z > -25.2 && z < -10.3
        const x = side * ((nearShrine ? 6.5 : 3.8) + rng() * (nearShrine ? 2.55 : 4.35))
        groveTree(x, z, 3.7 + rng() * 3)
      }
    }
    for (let i = 0; i < 9; i += 1) {
      groveTree((i - 4) * 2.13 + rng() * 0.6, -27.4 - rng() * 3.6, 4.2 + rng() * 2.45)
    }
    return { trunks, leaves, crowns, stones, sparks }
  }, [])
  useFrame(({ clock }) => {
    fireflies.current.position.y = 0.28 * Math.sin(clock.elapsedTime * 1.2)
  })
  return (
    <group>
      <Instances geometry={GEO.cyl8} material={WHITE} items={trunks} />
      <Instances geometry={GEO.cone} material={WHITE} items={leaves} />
      <Instances geometry={GEO.ico} material={WHITE} items={crowns} />
      <Instances geometry={GEO.rock} material={WHITE} items={stones} />
      <group ref={fireflies}>
        <Instances geometry={GEO.ico} material={AMBER} items={sparks} />
      </group>
      <mesh geometry={GEO.sphere} position={[0.5,9.2,-25.8]} scale={[1.28,1.28,1.28]}
        userData={{ noShadow: true }}>
        <meshBasicMaterial color="#f3e7cc" toneMapped={false} />
      </mesh>
      <pointLight position={[0,4.5,-7]} color="#9dafef" intensity={26} distance={13} />
      <pointLight position={[0,3.6,-19]} color="#d3bdff" intensity={25} distance={12} />
    </group>
  )
}

export function HjFoxAltar() {
  const tails = Array.from({ length: 9 }, (_, index) => (index - 4) * 0.22)
  return (
    <group>
      <Cyl p={[0,0.15,0]} rad={1.55} h={0.3} c="#7c786d" geo={GEO.cyl8} />
      <Cyl p={[0,0.34,0]} rad={1.18} h={0.18} c="#a49c86" geo={GEO.cyl8} />
      {tails.map((angle, index) => (
        <group key={angle} position={[0,0.7,-0.24]} rotation-z={angle}>
          <mesh geometry={GEO.sphere} material={SPIRIT} position={[0,0.64,-0.25 - (index % 2) * 0.15]}
            scale={[0.105,0.7,0.14]} />
        </group>
      ))}
      <mesh geometry={GEO.ico} material={SPIRIT} position={[0,0.79,0.17]} scale={[0.34,0.39,0.44]} />
      <mesh geometry={GEO.ico} material={SPIRIT} position={[0,1.15,0.42]} scale={[0.24,0.25,0.3]} />
      <mesh geometry={GEO.cone} material={SPIRIT} position={[0,1.07,0.69]}
        rotation-x={Math.PI / 2} scale={[0.16,0.22,0.13]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh geometry={GEO.cone} material={SPIRIT} position={[side * 0.14,1.39,0.36]}
            scale={[0.09,0.34,0.09]} rotation-z={side * -0.16} />
          <Box p={[side * 0.115,1.19,0.633]} s={[0.05,0.03,0.025]} c="#9f5847" />
          <Cyl p={[side * 1.28,0.47,0.48]} rad={0.16} h={0.32} c="#55483b" geo={GEO.cyl8} />
          <mesh geometry={GEO.sphere} material={AMBER} position={[side * 1.28,0.71,0.48]} scale={[0.08,0.14,0.08]} />
        </group>
      ))}
    </group>
  )
}
