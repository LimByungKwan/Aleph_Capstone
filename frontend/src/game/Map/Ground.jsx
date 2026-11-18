import { Grid } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { SHOW_GRID } from '../config.js'
import { getTiledTexture, TILE_METERS } from './styles/textures.js'
import { beachBounds, COAST_SEGMENTS, coastPoint } from './seabed.js'

// [3. 개발 > 렌더링] 해변과 풀밭이 같은 위치에 그려지지 않게 해안선에서 풀밭을 잘라요.
function groundGeometry(width, depth, cx, cz) {
  const [left, right, coastStart, coastEnd] = beachBounds
  const x0 = cx - width / 2
  const x1 = cx + width / 2
  const z0 = cz - depth / 2
  const z1 = cz + depth / 2
  const positions = []
  const uv = []
  const indices = []
  const clampZ = (z) => Math.min(z1, Math.max(z0, z))
  function strip(a, b, north, southA, southB = southA) {
    a = Math.max(x0, a)
    b = Math.min(x1, b)
    if (a >= b || north >= Math.max(southA, southB)) return
    const index = positions.length / 3
    for (const [x, z] of [[a, north], [a, southA], [b, north], [b, southB]]) {
      positions.push(x - cx, 0, z - cz)
      uv.push((x - x0) / width, 1 - (z - z0) / depth)
    }
    indices.push(index, index + 1, index + 2, index + 2, index + 1, index + 3)
  }
  strip(x0, left, z0, z1)
  strip(right, x1, z0, z1)
  strip(left, right, clampZ(coastEnd), z1)
  let previous = coastPoint(0)
  for (let index = 1; index <= COAST_SEGMENTS; index += 1) {
    const point = coastPoint(index)
    strip(previous.x + left + 45, point.x + left + 45, z0,
      clampZ(previous.z + coastStart - 40), clampZ(point.z + coastStart - 40))
    previous = point
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// 바닥 판 + (켜져 있으면) 1m 격자
// ground = { size: [가로, 세로], center: [x, z], color }
export default function Ground({ ground }) {
  const [width, depth] = ground.size
  const [cx, cz] = ground.center ?? [0, 0]
  const grass = useMemo(() => getTiledTexture('grass', width / TILE_METERS.grass, depth / TILE_METERS.grass), [width, depth])
  const geometry = useMemo(() => groundGeometry(width, depth, cx, cz), [width, depth, cx, cz])
  useEffect(() => () => grass.dispose(), [grass])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>

      {SHOW_GRID && (
        <Grid
          args={[width, depth]}
          position={[0, 0.16, 0]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#7d7d7d"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#4a4a4a"
          fadeDistance={160}
          fadeStrength={1}
        />
      )}
    </group>
  )
}
