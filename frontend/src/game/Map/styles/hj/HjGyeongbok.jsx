import { useMemo } from 'react'
import { Ball, Box, Cone, Cyl, GEO, Instances, mat } from '../kit.jsx'

// [3. 개발 > 프론트엔드] 경복궁다운 디테일 (혜진 영화·드라마 구역 궁궐 세트)
// HjPalace 안(궁궐 기준 좌표, 크기 53×9×53)에 얹어서 쓰는 부품들이에요.
// - 해태 한 쌍(광화문 앞) · 품계석 줄(근정전 마당) · 드므(월대 위 청동 물그릇) · 경회루 돌기둥 띠
const STONE = '#bdb5a4'
const STONE_DARK = '#9f9786'
const BRONZE = mat('#5f5a45', { roughness: 0.45, metalness: 0.55 })
const PARTS = mat('#ffffff', { roughness: 0.92 })

// 해태: 불을 막는다는 상상의 동물. 받침돌 위에 앉은 모습
export function Haetae({ position, flip = 1 }) {
  return (
    <group position={position} scale={[flip, 1, 1]}>
      {/* 받침돌 */}
      <Box p={[0, 0.35, 0]} s={[1.5, 0.7, 2.2]} c={STONE_DARK} />
      <Box p={[0, 0.76, 0]} s={[1.3, 0.12, 2.0]} c={STONE} />
      {/* 몸통(앉은 자세): 뒷다리 쪽이 낮고 가슴이 들림 */}
      <Ball p={[0, 1.35, 0.35]} s={[0.62, 0.55, 0.8]} c={STONE} />
      <Ball p={[0, 1.65, -0.35]} s={[0.55, 0.7, 0.55]} c={STONE} />
      {/* 앞다리 */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 0.3, 1.15, -0.55]} s={[0.2, 0.75, 0.22]} c={STONE} />
      ))}
      {/* 머리 + 갈기 + 뿔 + 눈 */}
      <Ball p={[0, 2.35, -0.55]} s={[0.5, 0.45, 0.48]} c={STONE} />
      <Ball p={[0, 2.25, -0.95]} s={[0.32, 0.25, 0.28]} c={STONE} />
      {[-1, 0, 1].map((s) => (
        <Ball key={s} p={[s * 0.32, 2.2, -0.25]} rad={0.24} c={STONE_DARK} />
      ))}
      <Cone p={[0, 2.85, -0.55]} rad={0.08} h={0.3} c={STONE_DARK} />
      {[-1, 1].map((s) => (
        <Ball key={`e${s}`} p={[s * 0.2, 2.45, -0.98]} rad={0.06} c="#4a443b" />
      ))}
      {/* 말린 꼬리 */}
      <mesh position={[0, 1.6, 0.85]} rotation={[0, Math.PI / 2, 0]} material={mat(STONE)}>
        <torusGeometry args={[0.28, 0.08, 6, 12, Math.PI * 1.4]} />
      </mesh>
    </group>
  )
}

export function HaetaePair() {
  // 광화문(문 중심 z -23.2, 문 깊이 2.5) 바로 바깥쪽 양옆
  return (
    <>
      <Haetae position={[-7.6, 0.2, -25.4]} />
      <Haetae position={[7.6, 0.2, -25.4]} flip={-1} />
    </>
  )
}

// 품계석: 신하들이 품계(정1품~정9품)대로 서던 돌 표지. 근정문 ~ 근정전 사이 가운데 길 양옆
export function PumgyeStones() {
  const items = useMemo(() => {
    const list = []
    // 근정문(z -8.3~-4.2)과 월대(z 6.2~) 사이에 8쌍. 근정전 쪽(정1품)이 가장 안쪽
    for (let i = 0; i < 8; i += 1) {
      const z = 4.9 - i * 1.15
      for (const side of [-1, 1]) {
        list.push({ p: [side * 3.95, 0.42, z], s: [0.34, 0.5, 0.22], c: STONE })
        list.push({ p: [side * 3.95, 0.69, z], s: [0.26, 0.06, 0.16], c: STONE_DARK })
      }
    }
    return list
  }, [])
  return <Instances geometry={GEO.box} material={PARTS} items={items} />
}

// 드므: 불이 나면 쓰려고 물을 담아 둔 넓적한 청동 그릇 (근정전 월대 네 귀퉁이)
export function Deumu() {
  // 근정전(정전 중심 z 13, 깊이 약 8) 앞·뒤 모서리, 윗단 월대(z 7.45~19.75) 안쪽
  const spots = [
    [-7.2, 7.9],
    [7.2, 7.9],
    [-7.2, 18.7],
    [7.2, 18.7],
  ]
  return spots.map(([x, z]) => (
    <group key={`${x}${z}`} position={[x, 0.92, z]}>
      <Cyl p={[0, 0.08, 0]} rad={0.32} h={0.16} m={BRONZE} />
      <Cyl p={[0, 0.38, 0]} rad={0.5} h={0.45} m={BRONZE} />
      <Cyl p={[0, 0.62, 0]} rad={0.54} h={0.05} m={BRONZE} />
      <Cyl p={[0, 0.58, 0]} rad={0.45} h={0.02} c="#3c6a80" />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.52, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} material={BRONZE}>
          <torusGeometry args={[0.09, 0.025, 6, 10]} />
        </mesh>
      ))}
    </group>
  ))
}

// 경회루: 연못 위 넓은 돌기둥 위에 올린 큰 누각. 기단 둘레에 네모 돌기둥 띠를 둘러요
export function GyeonghoeruPillars({ x = -15.8, z = -14.26, width = 8.8, depth = 6.9 }) {
  const items = useMemo(() => {
    const list = []
    const cols = 8
    const rows = 6
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const edge = i === 0 || j === 0 || i === cols - 1 || j === rows - 1
        if (!edge) continue
        list.push({
          p: [x + (i / (cols - 1) - 0.5) * (width - 0.4), 0.07, z + (j / (rows - 1) - 0.5) * (depth - 0.4)],
          s: [0.36, 0.62, 0.36],
          c: '#cfc6b3',
        })
      }
    }
    return list
  }, [x, z, width, depth])
  return <Instances geometry={GEO.box} material={PARTS} items={items} />
}
