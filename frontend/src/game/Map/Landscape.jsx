import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { layout } from '../data/mapData.js'
import { SKY_COLORS } from '../config.js'
import { beachBounds, shoreline } from './seabed.js'
import { coastRows, coastColorAt } from './coastColors.js'

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)

// 중앙 맵에 붙는 해안은 유지하고, 멀어질수록 바다와 산의 부채꼴을 넓힌다.
// 바닥으로 내려 닫지 않고 안개 너머까지 같은 지형을 이어 준다.
function makeLandscape(mountain) {
  const positions = [], colors = [], indices = []
  const [w, d] = layout.ground.size
  const [cx, cz] = layout.ground.center ?? [0, 0]
  const angles = 192, rings = 64
  const [left, right, , end] = beachBounds
  const start = mountain ? -Math.PI / 2 : Math.atan2(end - cz, right - cx)
  const finish = mountain ? Math.atan2(40 - cz, w / 2) : Math.atan2(shoreline(-45) - cz, left - cx)
  const samples = Array.from({ length: angles + 1 }, (_, i) => start + (finish - start) * i / angles)
  const westRows = coastRows(0)
  // Align vertices with each beach color stop rather than interpolating across foam.
  if (!mountain) for (const [z] of westRows) {
    const angle = Math.atan2(z + beachBounds[2] - 40 - cz, left - cx)
    if (angle > start && angle < finish) samples.push(angle)
  }
  // Include each corner exactly so the inner edge follows the rectangular map.
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) {
    const angle = Math.atan2(z, x)
    if (angle > start && angle < finish) samples.push(angle)
  }
  samples.sort((a, b) => a - b)
  const grass = new THREE.Color(SKY_COLORS.outerGround)
  const sand = new THREE.Color('#cbbf95')
  for (let i = 0; i < samples.length; i++) {
    const angle = samples[i]
    const t = (angle - start) / (finish - start)
    const dx = Math.cos(angle), dz = Math.sin(angle)
    const inner = Math.min(w / 2 / Math.max(Math.abs(dx), 1e-8), d / 2 / Math.max(Math.abs(dz), 1e-8))
    const coast = smooth(0, mountain ? .15 : .025, Math.min(t, 1 - t))
    for (let j = 0; j <= rings; j++) {
      const v = j / rings
      // Concentrate vertices near the village, with a horizon beyond the fog.
      const distance = v ** 1.5 * 1500
      const spread = smooth(0, 220, distance)
      const outerStart = mountain ? -1.75 : .85
      const outerFinish = mountain ? .85 : 3.35
      const expandedAngle = THREE.MathUtils.lerp(angle, THREE.MathUtils.lerp(outerStart, outerFinish, t), spread)
      const radius = inner + distance
      const x = cx + Math.cos(expandedAngle) * radius, z = cz + Math.sin(expandedAngle) * radius
      let height = 0
      let color
      if (mountain) {
        const ridge = .78 + .22 * Math.sin(distance * .014 + angle * 3)
        const peaks = 58 + 19 * Math.sin(angle * 5 + .8) + 12 * Math.cos(angle * 9)
        height = coast * smooth(0, 110, distance) * ridge * (peaks + 5 * Math.sin(x * .035) * Math.cos(z * .04))
        color = grass.clone().lerp(new THREE.Color('#819e70'), coast * smooth(0, 85, distance))
        color.lerp(new THREE.Color('#abb1a1'), smooth(22, 78, height) * .7)
      } else {
        color = new THREE.Color('#286f91').lerp(new THREE.Color('#205c7e'), smooth(20, 450, distance))
        const boundaryX = cx + inner * dx
        const boundaryZ = cz + inner * dz
        const boundaryColor = Math.abs(boundaryX - left) < .001
          ? coastColorAt(westRows, boundaryZ - beachBounds[2] + 40)
          : new THREE.Color('#286f91')
        color.lerp(boundaryColor, 1 - smooth(0, 110, distance))
        color.lerp(sand, (1 - coast) * .75 * smooth(0, 65, distance))
      }
      const edge = smooth(0, .008, Math.min(t, 1 - t))
      if (!mountain) color.lerp(grass, (1 - edge) * smooth(0, 65, distance))
      positions.push(x, .035 + height, z)
      colors.push(color.r, color.g, color.b)
      if (i && j) {
        const a = i * (rings + 1) + j
        indices.push(a - rings - 2, a, a - rings - 1, a - rings - 2, a - 1, a)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export default function Landscape() {
  const sea = useMemo(() => makeLandscape(false), [])
  const mountains = useMemo(() => makeLandscape(true), [])
  useEffect(() => () => { sea.dispose(); mountains.dispose() }, [sea, mountains])
  return (
    <group name="outer-landscape">
      <mesh geometry={sea}>
        <meshStandardMaterial vertexColors roughness={.85} />
      </mesh>
      <mesh geometry={mountains}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
    </group>
  )
}
