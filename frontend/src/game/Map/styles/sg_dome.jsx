// ── K-POP 돔 (SG) ──
// 중앙 하늘을 비운 파란 캐노피와 흰 리브, 처마 아래 좌석 띠.
// 건물과 서치라이트 자리를 지키도록 바닥선의 안쪽 거리로 만든다.
import * as THREE from 'three'
import { GEO, Instances, mat } from './kit.jsx'
import { DOME, domeBasePoints } from './sg_domeShape.js'

const WHITE = mat('#f5f3ed', { roughness: 0.65, double: true })
const BLUE = ['#2473bc', '#348bd0', '#205a98'].map((c) => mat(c, { roughness: 0.48, metalness: 0.15 }))
const UNDER = mat('#253e59', { double: true })
const SEATS = ['#ee829d', '#c94061', '#fff0eb'].map((c) => mat(c, { double: true }))
const GLOW = mat('#c6eeff', { emissive: '#83ccff', emissiveIntensity: 0.65, double: true })
const NO_SHADOW = { noShadow: true }

const OUTER = 0.18
const INNER = DOME.overhang - 0.3
const LIP_Y = DOME.overhangFrom + 4.3
const points = domeBasePoints(0.75)
const at = (p, inset, y) => [p.x - p.nx * inset, y, p.z - p.nz * inset]

function quad(vertices, a, b, c, d) {
  vertices.push(...a, ...b, ...c, ...a, ...c, ...d)
}

function sweep(vertices, profile, segment = () => true) {
  points.forEach((p, i) => {
    if (!segment(i)) return
    const q = points[(i + 1) % points.length]
    for (let j = 0; j < profile.length - 1; j++) {
      const a = profile[j]
      const b = profile[j + 1]
      quad(vertices, at(p, ...a), at(p, ...b), at(q, ...b), at(q, ...a))
    }
  })
}

function geometry(vertices) {
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  result.computeVertexNormals()
  result.computeBoundingSphere()
  return result
}

// 곡선도 촘촘한 사다리꼴로 이어 상자 패널의 모서리가 외곽을 넘지 않게 한다.
const roof = BLUE.map((_, color) => {
  const vertices = []
  sweep(vertices, [[OUTER, DOME.height], [INNER, LIP_Y]], (i) => Math.floor(i / 4) % BLUE.length === color)
  return geometry(vertices)
})
const undersideVertices = []
sweep(undersideVertices, [[INNER, LIP_Y - 0.3], [OUTER, DOME.height - 0.3]])
const underside = geometry(undersideVertices)

const frameVertices = []
sweep(frameVertices, [[OUTER, DOME.height - 0.65], [OUTER, DOME.height], [OUTER + 0.22, DOME.height]])
sweep(frameVertices, [[INNER, LIP_Y], [INNER, LIP_Y - 0.5], [INNER - 0.25, LIP_Y - 0.5]])
sweep(frameVertices, [[0.5, DOME.overhangFrom + 0.8], [0.5, DOME.overhangFrom + 1.2], [1.4, DOME.overhangFrom + 1.2]])
const frame = geometry(frameVertices)

// 관중석은 공중에 매달아 길을 비우고, 계단 앞면으로 아래에서도 줄무늬가 보이게 한다.
const seatVertices = SEATS.map(() => [])
for (let row = 0; row < 8; row++) {
  const inset = DOME.band + 0.7 + row
  const y = DOME.overhangFrom + 5.6 - row * 0.6
  sweep(seatVertices[row % SEATS.length], [[inset, y], [inset + 0.86, y], [inset + 0.86, y - 0.45]], (i) => i % 24 < 22)
}
const seats = seatVertices.map(geometry)

const glowVertices = []
sweep(glowVertices, [[INNER - 0.04, LIP_Y - 0.52], [INNER - 0.2, LIP_Y - 0.52]])
const glow = geometry(glowVertices)

const ribs = []
const ribInset = DOME.band * 0.4
const ribHeight = DOME.height - 0.8
for (const p of domeBasePoints(2.4, { skipGate: true })) {
  // 입구 가장자리에서도 받침의 폭까지 통로 밖에 남긴다.
  if (p.nx === 1 && Math.abs(p.z) < DOME.gateHalf + 1.6) continue
  const r = [0, -Math.atan2(p.nz, p.nx), 0]
  ribs.push({ p: at(p, ribInset, ribHeight / 2), s: [1.1, ribHeight, 0.42], r })
  ribs.push({ p: at(p, ribInset, 0.18), s: [1.8, 0.36, 0.85], r })
}

// 아치 두께를 포함해 최저점을 7m 위로 올려 입구의 유효 높이를 지킨다.
const archX = DOME.maxX - ribInset
const archHalf = DOME.gateHalf + 1.1
const archBase = DOME.overhangFrom + 0.5
for (const z of [-archHalf, archHalf]) {
  ribs.push({ p: [archX, archBase / 2, z], s: [1.1, archBase, 0.6] })
}
for (let i = 0; i < 24; i++) {
  const point = (t) => new THREE.Vector3(archX, archBase + 3 * Math.sin(t), -archHalf * Math.cos(t))
  const a = point((i / 24) * Math.PI)
  const b = point(((i + 1) / 24) * Math.PI)
  const direction = b.clone().sub(a)
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
  )
  ribs.push({
    p: a.add(b).multiplyScalar(0.5).toArray(),
    s: [0.55, direction.length() + 0.04, 0.4],
    r: [rotation.x, rotation.y, rotation.z],
  })
}

export function KpopDome({ item }) {
  // 고정 지오메트리를 재진입 때도 공유하고, 큰 지붕의 그림자 패스 비용을 피한다.
  return (
    <group name={item?.id ?? 'kpop-dome'} dispose={null}>
      <Instances geometry={GEO.box} material={WHITE} items={ribs} />
      {roof.map((geo, i) => <mesh key={i} geometry={geo} material={BLUE[i]} userData={NO_SHADOW} receiveShadow />)}
      <mesh geometry={underside} material={UNDER} userData={NO_SHADOW} />
      <mesh geometry={frame} material={WHITE} userData={NO_SHADOW} receiveShadow />
      {seats.map((geo, i) => <mesh key={i} geometry={geo} material={SEATS[i]} userData={NO_SHADOW} />)}
      <mesh geometry={glow} material={GLOW} userData={NO_SHADOW} />
    </group>
  )
}

export const SG_DOME_STYLES = { kpopDome: KpopDome }
