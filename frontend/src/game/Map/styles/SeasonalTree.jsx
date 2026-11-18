import { useMemo } from 'react'
import { CylinderGeometry, Euler, Quaternion, Shape, ShapeGeometry, Vector3 } from 'three'
import { useSeason } from '../../seasons.js'
import { Box, GEO, Instances, hashString, mat, seeded } from './kit.jsx'

const BARK = new CylinderGeometry(0.62, 1, 1, 6)
const UP = new Vector3(0, 1, 0)
const TINT = mat('#ffffff', { flat: true, double: true })
const BARK_COLORS = ['#644431', '#79543b', '#50382e']
const GREEN = ['#345e37', '#4f7941', '#66954d', '#7da55a']
const SHOOTS = ['#87a950', '#a5c367', '#bed388']
const BLOSSOMS = ['#fff2ed', '#f9dbe1', '#ebafc6', '#fff9f1']
const FALL = {
  sakura: ['#98713f', '#b45237', '#ce8350', '#747f40'],
  maple: ['#943e30', '#c35432', '#dd8c45', '#8d733b'],
  ginkgo: ['#b18a34', '#d3a641', '#efd075', '#8d924b'],
  broadleaf: ['#a36d38', '#c48143', '#d9a555', '#74864a', '#515f37'],
}

function makeBlossom() {
  const shape = new Shape()
  for (let index = 0; index < 20; index += 1) {
    const angle = index * Math.PI / 10
    const radius = [0.47, 0.86, 1, 0.86][index % 4]
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new ShapeGeometry(shape)
}

function makeLeaf(kind) {
  const shape = new Shape()
  shape.moveTo(0, -1)
  if (kind === 'ginkgo') {
    shape.quadraticCurveTo(-0.65, -0.2, -0.9, 0.48)
    shape.quadraticCurveTo(-0.72, 0.92, 0, 0.75)
    shape.quadraticCurveTo(0.72, 0.92, 0.9, 0.48)
    shape.quadraticCurveTo(0.65, -0.2, 0, -1)
  } else if (kind === 'maple') {
    for (const [x, y] of [[-0.4, -0.5], [-0.95, 0.22], [-0.42, 0.1], [-0.56, 0.69], [-0.22, 0.49], [0, 1], [0.22, 0.49], [0.56, 0.69], [0.42, 0.1], [0.95, 0.22], [0.4, -0.5]]) shape.lineTo(x, y)
  } else {
    shape.quadraticCurveTo(-0.95, -0.05, 0, 1)
    shape.quadraticCurveTo(0.95, -0.05, 0, -1)
  }
  shape.closePath()
  return new ShapeGeometry(shape, 5)
}

const FLOWER = makeBlossom()
const LEAF = { broadleaf: makeLeaf('broadleaf'), maple: makeLeaf('maple'), ginkgo: makeLeaf('ginkgo') }

function branch(from, to, radius, color) {
  const direction = to.clone().sub(from)
  const rotation = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()))
  return { p: from.clone().lerp(to, 0.5).toArray(), r: [rotation.x, rotation.y, rotation.z], s: [radius, direction.length(), radius], c: color }
}

// [3. 개발 > 프론트엔드] 같은 나무의 가지를 유지하면서 꽃·수관·눈만 계절에 맞게 교체해요.
function createTree(id, width, height, kind, season, base) {
  const random = seeded(hashString(id))
  const pick = (colors) => colors[Math.floor(random() * colors.length)]
  const radius = width / 2
  const fork = new Vector3(0, base + height * 0.45, 0)
  const branches = [branch(new Vector3(0, base, 0), fork, Math.min(width * 0.078, 0.62), BARK_COLORS[0])]
  const tips = []
  const snow = []
  const crowns = []
  const details = []
  const heading = random() * Math.PI * 2
  for (let index = 0; index < 6; index += 1) {
    const angle = heading + index * Math.PI / 3 + (random() - 0.5) * 0.42
    const reach = radius * (0.44 + random() * 0.38)
    const root = fork.clone().add(new Vector3(0, -height * random() * 0.13, 0))
    const elbow = new Vector3(Math.cos(angle) * reach * 0.52, base + height * (0.53 + random() * 0.13), Math.sin(angle) * reach * 0.52)
    const end = new Vector3(Math.cos(angle) * reach, base + height * (0.68 + random() * 0.15), Math.sin(angle) * reach)
    branches.push(branch(root, elbow, width * 0.033, pick(BARK_COLORS)))
    branches.push(branch(elbow, end, width * 0.020, pick(BARK_COLORS)))
    tips.push(end)
    for (const side of [-1, 1]) {
      const twigAngle = angle + side * (0.5 + random() * 0.45)
      const twig = elbow.clone().lerp(end, 0.38)
      const tip = twig.clone().add(new Vector3(Math.cos(twigAngle) * radius * 0.43, height * (0.15 + random() * 0.08), Math.sin(twigAngle) * radius * 0.43))
      branches.push(branch(twig, tip, width * 0.011, pick(BARK_COLORS)))
      tips.push(tip)
    }
    // 가지 윗면 일부에만 얇게 쌓인 눈
    const snowStart = elbow.clone().lerp(end, 0.1)
    const snowEnd = elbow.clone().lerp(end, 0.76)
    const cap = branch(snowStart, snowEnd, width * 0.022, '#eef5fa')
    cap.p[1] += width * 0.019
    cap.s[1] *= 0.56
    cap.s[2] *= 0.72
    snow.push(cap)
  }

  const blossoms = kind === 'sakura' && season === 'spring'
  const palette = season === 'autumn' ? FALL[kind] : season === 'spring' ? SHOOTS : GREEN
  if (season !== 'winter') {
    tips.forEach((tip, index) => {
      const crownSize = radius * (season === 'summer' ? 0.52 : season === 'autumn' ? 0.31 : 0.22)
      const hasCrown = !blossoms && (season === 'summer' || index % 3 !== 0)
      if (hasCrown) {
        const size = crownSize * (0.75 + random() * 0.35)
        crowns.push({ p: tip.toArray(), s: [size, size * 0.77, size * 0.91], c: pick(palette) })
      }
      const count = blossoms ? 5 : season === 'summer' ? 3 : index % 3 === 0 ? 1 : 3
      for (let detail = 0; detail < count; detail += 1) {
        const spread = blossoms ? radius * 0.19 : crownSize
        const p = tip.toArray().map((value) => value + (random() - 0.5) * spread * 2)
        const size = radius * (blossoms ? 0.10 : 0.12) * (0.7 + random() * 0.65)
        details.push({
          p,
          r: [random() * Math.PI, random() * Math.PI * 2, random() * Math.PI],
          s: [size, size, size],
          c: pick(blossoms ? BLOSSOMS : palette),
        })
      }
    })
  }
  return { branches, crowns: season === 'winter' ? snow : crowns, details, blossoms }
}

export default function SeasonalTree({ item, kind = 'broadleaf', planter = false }) {
  const season = useSeason()
  const [width, height] = item.size
  const { id } = item
  const tree = useMemo(() => createTree(id, width, height, kind, season, planter ? 0.3 : 0), [id, width, height, kind, season, planter])
  return (
    <group>
      {planter && <Box p={[0, 0.15, 0]} s={[1, 0.3, 1]} c="#a35d47" />}
      <Instances geometry={BARK} material={TINT} items={tree.branches} castShadow />
      <Instances geometry={GEO.ico} material={TINT} items={tree.crowns} castShadow={season !== 'winter'} />
      <Instances geometry={tree.blossoms ? FLOWER : LEAF[kind] ?? LEAF.broadleaf} material={TINT} items={tree.details} />
    </group>
  )
}
