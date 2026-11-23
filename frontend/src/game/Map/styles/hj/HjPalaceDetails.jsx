import { useMemo } from 'react'
import { Box, GEO, Instances, mat } from '../kit.jsx'

const PARTS = mat('#ffffff', { roughness: 0.9 })
const AMBER = mat('#ffe3a6', { emissive: '#ffb865', emissiveIntensity: 0.57 })
const BLUE = mat('#a6e7ff', { emissive: '#60b8ff', emissiveIntensity: 0.94 })
const COLORS = ['#44705b', '#d5a352', '#a3483c', '#366f7d']

// [3. 개발 > 프론트엔드] 색층이 나뉜 공포와 격자 창호, 서까래 끝 연화문.
export function DancheongBand({ width, y, z }) {
  const parts = useMemo(() => {
    const pieces = []
    const count = Math.floor(width / 0.38)
    for (let i = 0; i < count; i += 1) {
      const x = (i + 0.5) * width / count - width / 2
      COLORS.forEach((c, layer) => {
        pieces.push({ p: [x, y + layer * 0.049, z], s: [0.21 + layer * 0.032, 0.041, 0.16 + layer * 0.065], c })
      })
    }
    return pieces
  }, [width, y, z])
  return <Instances geometry={GEO.box} material={PARTS} items={parts} />
}

export function PalaceTerrace() {
  const stones = useMemo(() => {
    const blocks = []
    for (const side of [-1, 1]) {
      for (let i = 0; i < 13; i += 1) {
        blocks.push({ p: [side * 8.52, 0.96, 6.45 + i * 1.01], s: [0.17, 0.42, 0.22], c: '#d2c9b9' })
      }
      for (let i = 0; i < 7; i += 1) {
        blocks.push({ p: [side * (2.8 + i * 0.93), 0.96, 6.48], s: [0.22, 0.42, 0.17], c: '#d2c9b9' })
      }
    }
    return blocks
  }, [])
  return (
    <>
      <Instances geometry={GEO.box} material={PARTS} items={stones} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[side * 8.52, 1.18, 12.52]} s={[0.2, 0.10, 12.34]} c="#e4dbcb" />
          <Box p={[side * 5.62, 1.18, 6.48]} s={[5.82, 0.10, 0.2]} c="#e4dbcb" />
          {[0.7, 3.0, 5.3].map((z) => (
            <group key={z}>
              <Box p={[side * 3.75, 0.255, z]} s={[0.46, 0.16, 0.46]} c="#6c7473" />
              <Box p={[side * 3.75, 0.36, z]} s={[0.18, 0.14, 0.18]} m={BLUE} />
            </group>
          ))}
        </group>
      ))}
    </>
  )
}

export function PalaceLatticeCorridor({ Pavilion }) {
  const { boards, petals } = useMemo(() => {
    const boards = [], petals = []
    const box = (p, s, c) => boards.push({ p, s, c })
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < 10; bay += 1) {
        const z = (bay - 4.5) * 1.84
        const outer = side * 1.275
        box([outer, 1.35, z], [0.055, 1.26, 1.35], '#252f26')
        box([outer - side * 0.052, 1.32, z], [0.048, 1.08, 1.14],
          bay % 3 ? '#356454' : '#527a61')
        for (let i = -4; i <= 4; i += 1) {
          box([outer - side * 0.082, 1.35, z + i * 0.128], [0.038, 1.08, 0.030], '#242f28')
        }
        for (const y of [0.88, 1.10, 1.27, 1.52, 1.77]) {
          box([outer - side * 0.09, y, z], [0.041, 0.026, 1.17], '#273a30')
        }
        box([outer - side * 0.11, 1.32, z], [0.07, 1.1, 0.065], '#63877b')
        box([outer - side * 0.11, 1.25, z + 0.14], [0.045, 0.075, 0.069], '#c4a35d')
        box([outer - side * 0.07, 1.34, z + 0.825], [0.19, 2.3, 0.17], '#793d31')
        for (let row = 0; row < 3; row += 1) {
          for (let i = 0; i < 5; i += 1) {
            box([outer - side * 0.085, 0.31 + row * 0.127, z + (i - 2) * 0.326 + (row % 2) * 0.11],
              [0.11, 0.11, 0.30], row % 2 ? '#8a8e83' : '#717b76')
          }
        }
        for (let rafter = 0; rafter < 4; rafter += 1) {
          const rZ = z + (rafter - 1.5) * 0.428
          COLORS.forEach((c, layer) => {
            box([side * (1.11 - layer * 0.087), 2.17 + layer * 0.105, rZ],
              [0.32 + layer * 0.079, 0.091, 0.16], c)
          })
          for (let petal = 0; petal < 6; petal += 1) {
            const a = petal * Math.PI / 3
            petals.push({ p: [side * 0.53, 2.492 + Math.cos(a) * 0.037, rZ + Math.sin(a) * 0.037],
              s: [0.016, 0.028, 0.025], c: petal % 2 ? '#edca7d' : '#d78872' })
          }
          petals.push({ p: [side * 0.515, 2.492, rZ], s: [0.016, 0.026, 0.026], c: '#fff1c5' })
        }
        box([side * 0.99, 0.198, z], [0.52, 0.067, 1.75], '#5c6868')
      }
      box([side * 1.2, 0.29, 0], [0.16, 0.22, 18.8], '#a4a092')
    }
    return { boards, petals }
  }, [])
  return (
    <group position={[-16.1, 0, 7.2]}>
      {[-1, 1].map((side) => (
        <Pavilion key={side} position={[side * 2.43, 0.17, 0]} width={19.2} depth={2.8} height={2.60}
          rotation={side * -Math.PI / 2} />
      ))}
      <Box p={[0, 0.184, 0]} s={[2, 0.025, 19.4]} c="#baaa8d" />
      <Box p={[0, 2.57, 9.61]} s={[2.58, 0.23, 0.19]} c="#356857" />
      <Box p={[0, 2.51, -9.64]} s={[2.58, 0.22, 0.19]} c="#356857" />
      <Box p={[0, 2.31, 9.64]} s={[0.62, 0.16, 0.14]} m={AMBER} />
      <Instances geometry={GEO.box} material={PARTS} items={boards} />
      <Instances geometry={GEO.ico} material={PARTS} items={petals} />
    </group>
  )
}
