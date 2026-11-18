import { useMemo } from 'react'
import * as THREE from 'three'
import { getTiledTexture, TILE_METERS } from '../textures.js'

// [3. 개발 > 기초개발/서비스] 혜진 구역 굽은 도로 (style: "hjCurvedRoad")
// item.points: [[x, z], ...] 이 소품 위치 기준 상대 좌표로 지나가는 길 중심선
// item.width: 차도 폭 (기본 6m) — 양옆에 연석 + 보도블록 인도가 같이 생겨요.
// 충돌 없음(collider: false로 두기). 노란 점선 중앙선 포함.
const SAMPLES_PER_SEGMENT = 14

// 중심선을 따라 왼쪽 offsetA ~ offsetB 띠를 만드는 지오메트리 (UV는 실제 m 단위)
function ribbon(curve, count, offsetA, offsetB, y) {
  const positions = []
  const uvs = []
  const indices = []
  let length = 0
  let prev = null
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    const p = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    if (prev) length += p.distanceTo(prev)
    prev = p
    const a = p.clone().addScaledVector(normal, offsetA)
    const b = p.clone().addScaledVector(normal, offsetB)
    positions.push(a.x, y, a.z, b.x, y, b.z)
    uvs.push(offsetA, length, offsetB, length)
    if (i < count) {
      const k = i * 2
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function tiled(kind) {
  const tile = TILE_METERS[kind]
  return getTiledTexture(kind, 1 / tile, 1 / tile)
}

export function HjCurvedRoad({ item }) {
  const width = item.width ?? 6
  const half = width / 2

  const parts = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      (item.points ?? []).map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.35,
    )
    const count = Math.max(8, (item.points?.length ?? 2) * SAMPLES_PER_SEGMENT)
    const totalLength = curve.getLength()
    const crossings = (item.crosswalks ?? []).map(([x, z]) => {
      let nearest = 0
      let distance = Infinity
      for (let index = 0; index <= count * 3; index += 1) {
        const t = index / (count * 3)
        const point = curve.getPointAt(t)
        const squared = (point.x - x) ** 2 + (point.z - z) ** 2
        if (squared < distance) {
          nearest = t
          distance = squared
        }
      }
      return nearest * totalLength
    })
    const crosswalks = crossings.flatMap((center) => {
      const start = Math.max(0, center - 1.4)
      const span = Math.min(totalLength, center + 1.4) - start
      const fraction = (t) => (start + span * t) / totalLength
      const segment = {
        getPointAt: (t) => curve.getPointAt(fraction(t)),
        getTangentAt: (t) => curve.getTangentAt(fraction(t)),
      }
      const stripeCount = Math.max(1, Math.floor((width - 0.9) / 0.7))
      return Array.from({ length: stripeCount }, (_, index) => {
        const offset = (index - (stripeCount - 1) / 2) * 0.7
        return ribbon(segment, 12, offset - 0.24, offset + 0.24, 0.04)
      })
    })
    // 점선: 3m 칠하고 3m 비우기
    const dashes = []
    for (let s = 1.5; s < totalLength - 3; s += 6) {
      if (crossings.some((center) => s < center + 1.4 && s + 3 > center - 1.4)) continue
      const sub = new THREE.CatmullRomCurve3(
        Array.from({ length: 4 }, (_, i) => curve.getPointAt(Math.min(1, (s + i) / totalLength))),
      )
      dashes.push(ribbon(sub, 4, -0.08, 0.08, 0.035))
    }
    return {
      road: ribbon(curve, count, -half, half, 0.02),
      curbs: [ribbon(curve, count, -half - 0.25, -half, 0.13), ribbon(curve, count, half, half + 0.25, 0.13)],
      walks: [ribbon(curve, count, -half - 1.75, -half - 0.25, 0.15), ribbon(curve, count, half + 0.25, half + 1.75, 0.15)],
      edges: [ribbon(curve, count, -half + 0.25, -half + 0.37, 0.03), ribbon(curve, count, half - 0.37, half - 0.25, 0.03)],
      dashes,
      crosswalks,
    }
  }, [item.points, item.crosswalks, width, half])

  const textures = useMemo(() => ({ asphalt: tiled('asphalt'), brick: tiled('brick') }), [])

  return (
    <group>
      <mesh geometry={parts.road} receiveShadow>
        <meshStandardMaterial map={textures.asphalt} side={THREE.DoubleSide} />
      </mesh>
      {parts.edges.map((g, i) => (
        <mesh key={`e${i}`} geometry={g}>
          <meshStandardMaterial color="#f2f2ec" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      {parts.dashes.map((g, i) => (
        <mesh key={`d${i}`} geometry={g}>
          <meshStandardMaterial color="#f2c14e" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      {parts.crosswalks.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color="#f2f2ec" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {parts.curbs.map((g, i) => (
        <mesh key={`c${i}`} geometry={g}>
          <meshStandardMaterial color="#c9c4bb" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {parts.walks.map((g, i) => (
        <mesh key={`w${i}`} geometry={g} receiveShadow>
          <meshStandardMaterial map={textures.brick} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

// 횡단보도 (굽은 길 위 원하는 곳에) — style: "hjCrosswalk", size [폭, -, 길이]
export function HjCrosswalk({ item }) {
  const [w, , length] = item.size
  const stripes = Math.floor(length)
  return (
    <group position={[0, 0.04, 0]}>
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -length / 2 + 0.25 + i + (length - stripes) / 2]}>
          <planeGeometry args={[w, 0.5]} />
          <meshStandardMaterial color="#f2f2ec" polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
    </group>
  )
}
