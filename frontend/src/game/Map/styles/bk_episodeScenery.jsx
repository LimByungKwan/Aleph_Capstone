// (담당: 병관) 소란 커피의 목재 창살과 화분, 벽화 골목의 등과 식물
import { GEO, Instances, mat, seeded } from './kit.jsx'

const TINT = mat('#ffffff', { flat: true })
const LIGHT = mat('#ffe3a9', { emissive: '#ffbf64', emissiveIntensity: 0.42 })
const WOOD = '#704a36'
const TRIM = '#aa7955'
const PETALS = ['#e29bab', '#f9d9cf', '#f7ead2', '#b99ccb']
const LEAVES = ['#506f4c', '#678653', '#7d915f']

const box = (x, y, z, w, h, d, c) => ({ p: [x, y, z], s: [w, h, d], c })
const plant = (x, y, z, w, h, d, c, tilt) => ({ ...box(x, y, z, w, h, d, c), r: [0, 0, tilt] })

const cafeTrim = [
  box(-0.95, 0.91, 2.82, 5.4, 0.1, 0.22, TRIM),
  box(-0.95, 2.64, 2.82, 5.4, 0.09, 0.2, WOOD),
  ...[-3.58, -2.25, -0.95, 0.35, 1.68].map((x) => box(x, 1.77, 2.82, 0.09, 1.78, 0.12, WOOD)),
  box(3.85, 0.24, 3.55, 1.08, 0.43, 0.5, '#885d4c'),
  box(3.85, 0.45, 3.55, 1.13, 0.08, 0.53, '#bf8a6c'),
  box(-4.86, 0.22, 3.45, 0.68, 0.39, 0.53, '#805e4a'),
]

const muralTrim = [-1, 1].flatMap((side) => [
  box(side * 3.57, 3.08, 1.64, 0.12, 0.35, 0.21, '#5a4238'),
  box(side * 3.57, 3.11, 1.87, 0.42, 0.08, 0.42, '#5a4238'),
  box(side * 3.57, 2.65, 1.87, 0.39, 0.07, 0.39, '#5a4238'),
  box(side * 3.96, 2.1, 1.67, 0.47, 0.17, 0.32, '#8b5d46'),
  box(side * 2.88, 0.5, 1.85, 2.46, 0.09, 0.66, '#8b5d46'),
])

const muralLamps = [-1, 1].map((side) => box(side * 3.57, 2.88, 1.87, 0.33, 0.41, 0.33))

function garden(planters, seed) {
  const random = seeded(seed)
  const leaves = []
  const petals = []
  for (const [x, y, z, width, count] of planters) {
    for (let i = 0; i < count; i++) {
      const px = x + (random() - 0.5) * width
      const pz = z + (random() - 0.5) * 0.31
      const height = 0.12 + random() * 0.14
      leaves.push(plant(px, y + height / 2, pz, 0.1, height, 0.08,
        LEAVES[i % LEAVES.length], (random() - 0.5) * 1.1))
      if (i % 3 !== 0) petals.push(plant(px, y + height, pz, 0.105, 0.075, 0.105, PETALS[i % PETALS.length], 0))
    }
  }
  return { leaves, petals }
}

const cafeGarden = garden([[3.85, 0.48, 3.55, 0.94, 19], [-4.86, 0.43, 3.45, 0.52, 11]], 14)
const muralGarden = garden([
  [-2.88, 0.56, 1.85, 2.25, 24], [2.88, 0.56, 1.85, 2.25, 24],
  [-3.96, 2.17, 1.67, 0.34, 9], [3.96, 2.17, 1.67, 0.34, 9],
], 72)

export function EpisodeScenery({ spot }) {
  const cafe = spot === 'cafe'
  const { leaves, petals } = cafe ? cafeGarden : muralGarden
  // 장식은 정적 배열, 재사용 도형과 인스턴스로 그려요. 실제 조명과 새 그림자 없음.
  return (
    <>
      <Instances geometry={GEO.box} material={TINT} items={cafe ? cafeTrim : muralTrim} />
      <Instances geometry={GEO.ico} material={TINT} items={leaves} />
      <Instances geometry={GEO.ico} material={TINT} items={petals} />
      {!cafe && <Instances geometry={GEO.box} material={LIGHT} items={muralLamps} />}
    </>
  )
}
