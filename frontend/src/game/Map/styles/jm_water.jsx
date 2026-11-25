import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// 애니 구역(JM) 물 — 담당: 지민
// 11/25: 물(수로·개울·호수·강)을 맵 바다(혜진 구역 hjSea, hj/HjHarbor.jsx)와 똑같이 보이게 (지민 요청: "지금은 리얼하지 않아")
//   hjSea 방식 그대로: 깊은 물색 불투명 판(#1f4f7a) 위에 반투명 물결 면(#3d84b8, 불투명도 0.88, 거칠기 0.25, 금속성 0.15)
//   물결 = 꼭짓점 높이를 sin·cos로 (진폭 0.024, 주기·속도도 hjSea와 같음), 갱신은 초당 30번까지
//   혜진 구역 파일은 고치지 않고 같은 값을 여기서 씀. 예전 흐름 줄무늬 텍스처·가장자리 거품 띠는 뺌 (바다엔 없음)
//   애니 구역은 물이 작아서 카메라에서 먼 물은 물결 갱신을 쉼

// 강·호수 띠는 점 방향에 따라 앞뒷면이 뒤집힐 수 있어서 양면으로 (보이는 모습은 hjSea와 같음)
export const SEA_DEEP = new THREE.MeshStandardMaterial({ color: '#1f4f7a', side: THREE.DoubleSide })
export const SEA_SURFACE = new THREE.MeshStandardMaterial({ color: '#3d84b8', transparent: true, opacity: 0.88, roughness: 0.25, metalness: 0.15, side: THREE.DoubleSide })
// 겨울(호수·강이 얼었을 때)은 예전처럼 얼음 색 평면
export const ICE = new THREE.MeshStandardMaterial({ color: '#bcd6ea', metalness: 0.3, roughness: 0.15, side: THREE.DoubleSide })

const WAVE_AMP = 0.024
const tmp = new THREE.Vector3()

// hjSea와 같은 물결. geometry는 위를 보는 면(꼭짓점 x·z가 물 위치), base는 처음 꼭짓점 복사본
// far: 카메라와 물 가운데 거리가 이보다 멀면 갱신을 쉼
export function useSeaWave(ref, geometry, far = 80) {
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry])
  const center = useMemo(() => {
    geometry.computeBoundingSphere()
    return geometry.boundingSphere
  }, [geometry])
  const lastTick = useRef(-1)
  useFrame(({ clock, camera }) => {
    const mesh = ref.current
    if (!mesh) return
    tmp.copy(center.center)
    mesh.localToWorld(tmp)
    if (tmp.distanceToSquared(camera.position) > (far + center.radius) ** 2) return
    const t = clock.elapsedTime
    const tick = Math.floor(t * 30)
    if (lastTick.current === tick) return
    lastTick.current = tick
    const pos = mesh.geometry.attributes.position
    for (let i = 0; i < pos.count; i += 1) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      pos.setY(i, base[i * 3 + 1] + Math.sin(x * 0.45 + t * 1.2) * WAVE_AMP + Math.cos(z * 0.38 + t * 0.9) * WAVE_AMP)
    }
    pos.needsUpdate = true
  })
}

// 물결 면 + 깊은 물 판 한 쌍. surface는 잘게 나눈 위를 보는 면, deep은 같은 모양(꼭짓점 적어도 됨)
// gap: 깊은 판 위로 물결 면을 띄우는 높이 (hjSea는 0.1)
export function SeaWater({ surface, deep, y = 0, gap = 0.06, far }) {
  const ref = useRef(null)
  useSeaWave(ref, surface, far)
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={deep} material={SEA_DEEP} />
      <mesh ref={ref} geometry={surface} material={SEA_SURFACE} position={[0, gap, 0]} userData={{ noMerge: true }} />
    </group>
  )
}

// 직사각형 물결 면 (hjSea처럼 1.5m 간격, 좁은 물은 최소 칸 수 보장)
export function seaPlane(w, d, step = 1.5) {
  const g = new THREE.PlaneGeometry(w, d, Math.max(2, Math.ceil(w / step)), Math.max(2, Math.ceil(d / step)))
  g.rotateX(-Math.PI / 2)
  g.attributes.position.setUsage(THREE.DynamicDrawUsage)
  return g
}

// 호수 모양(가장자리가 살짝 울퉁불퉁한 타원) 물결 면: 가운데에서 가장자리까지 고리 여러 겹
// wobble(a)는 JmLake의 가장자리 식과 같아야 함
export function lakeGeometry(w, d, sx, sz, wobble, rings = 8, segs = 40) {
  const pos = [0, 0, 0]
  const idx = []
  for (let r = 1; r <= rings; r++) {
    const k = r / rings
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2
      const wb = wobble(a)
      // JmLake는 shape를 x-y 평면에 그리고 -90도 돌려 눕힘 → 눕힌 뒤 z = -y
      pos.push(Math.cos(a) * (w / 2) * sx * wb * k, 0, -Math.sin(a) * (d / 2) * sz * wb * k)
    }
  }
  const at = (r, i) => (r === 0 ? 0 : 1 + (r - 1) * segs + (i % segs))
  for (let i = 0; i < segs; i++) idx.push(0, at(1, i + 1), at(1, i))
  for (let r = 1; r < rings; r++) {
    for (let i = 0; i < segs; i++) {
      const a = at(r, i)
      const b = at(r, i + 1)
      const c = at(r + 1, i)
      const e = at(r + 1, i + 1)
      idx.push(a, b, c, b, e, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
  g.attributes.position.setUsage(THREE.DynamicDrawUsage)
  return g
}

// 강(점 줄을 따라가는 띠) 물결 면: 길이 방향 step 간격, 폭 방향 칸 나눔
export function ribbonGrid(points, width, step = 1.5) {
  // 점 줄을 step 간격으로 다시 뽑음
  const pts = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]
    const [bx, bz] = points[i]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step))
    for (let k = 1; k <= n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n])
  }
  const across = Math.max(2, Math.ceil(width / step))
  const pos = []
  const idx = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const L = Math.hypot(dx, dz) || 1
    const nx = dz / L
    const nz = -dx / L
    for (let j = 0; j <= across; j++) {
      const o = -width / 2 + (width * j) / across
      pos.push(pts[i][0] + nx * o, 0, pts[i][1] + nz * o)
    }
    if (i > 0) {
      const r0 = (i - 1) * (across + 1)
      const r1 = i * (across + 1)
      for (let j = 0; j < across; j++) idx.push(r0 + j, r1 + j, r0 + j + 1, r0 + j + 1, r1 + j, r1 + j + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
  g.attributes.position.setUsage(THREE.DynamicDrawUsage)
  return g
}
