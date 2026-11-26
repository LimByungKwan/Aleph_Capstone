import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// 마른 강바닥 바윗돌 (11/26 지민 요청: 보낸 장면 사진처럼 — 물은 바위 사이 틈에만 조금, 바위는 이끼 낀 둥근 돌) — 담당: 지민
// 바위 모양 6가지를 미리 만들어(울퉁불퉁한 둥근 덩어리, 아래는 평평) 모양마다 InstancedMesh 하나로 그림 → 바위 수백 개도 가벼움
// 색은 꼭짓점 색: 베이지·회색 바탕 + 분홍빛 지의류 얼룩 + 밝은 회색 반점 + 위를 향한 면엔 이끼(초록 두 가지) + 물에 잠긴 아래쪽은 짙게 젖은 색
// 바위마다 색을 살짝 다르게(인스턴스 색). 'flat' 모양은 윗면이 평평해서 징검돌로 씀 (걷는 판정은 생성 스크립트의 길 상자)
// item.rocks: [[x, z, 반지름, 높이, 회전(도), 모양 번호]] (소품 가운데 기준), item.waterY: 물 높이 (젖은 색 경계)

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = zf * zf * (3 - 2 * zf)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  )
}
function fbm(x, y, z) {
  let a = 0.5
  let s = 0
  for (let k = 0; k < 4; k++) {
    s += a * vnoise(x, y, z)
    x *= 2.03
    y *= 2.03
    z *= 2.03
    a *= 0.5
  }
  return s
}
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const C = {
  base: new THREE.Color('#a0977f'),
  base2: new THREE.Color('#b8ad98'),
  pink: new THREE.Color('#c19a88'),
  pale: new THREE.Color('#d2cec2'),
  moss: new THREE.Color('#6b7c38'),
  moss2: new THREE.Color('#90a04a'),
  wet: new THREE.Color('#4a4a3b'),
  crev: new THREE.Color('#5e5747'),
}

// 바위 모양 하나: 단위 크기(반지름 1, 바닥 y -0.35), 위로 둥글고 옆은 울퉁불퉁
function rockGeometry(seed, flatTop) {
  const g = new THREE.IcosahedronGeometry(1, 4)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  const o = seed * 13.7
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const big = fbm(v.x * 1.1 + o, v.y * 1.1, v.z * 1.1 - o)
    const small = fbm(v.x * 4 + o, v.y * 4 + o, v.z * 4)
    let r = 0.82 + 0.34 * big + 0.07 * small
    // 한쪽으로 각진 면 (깨진 바위 느낌)
    const facet = Math.max(0, v.x * Math.cos(seed) + v.z * Math.sin(seed) - 0.55)
    r -= facet * 0.35
    let x = v.x * r
    let y = v.y * r * 0.78
    let z = v.z * r
    if (y < -0.35) y = -0.35 - (y + 0.35) * 0.1
    if (flatTop && y > 0.5) y = 0.5 + (y - 0.5) * 0.08
    pos.setXYZ(i, x, y, z)
    // 색
    const n1 = fbm(x * 1.6 + o, y * 1.6, z * 1.6)
    const n2 = fbm(x * 2.6 - o, y * 2.6 + 3, z * 2.6)
    const n3 = vnoise(x * 7 + o, y * 7, z * 7)
    const n4 = fbm(x * 2.2 + 7, y * 2.2 - o, z * 2.2 + 1)
    c.copy(C.base).lerp(C.base2, n1)
    c.lerp(C.pink, sstep(0.52, 0.64, n2) * 0.8)
    c.lerp(C.pale, sstep(0.58, 0.68, n3) * 0.65)
    const up = v.y
    // 이끼는 위를 향한 면에 얼룩덜룩 (사진처럼 바탕 돌빛이 더 많이 보이게)
    const moss = sstep(0.25, 0.8, up + (n4 - 0.5) * 0.8) * sstep(0.42, 0.62, n4)
    c.lerp(n1 > 0.5 ? C.moss2 : C.moss, Math.min(0.72, moss))
    c.lerp(C.crev, sstep(0.0, -0.12, r - 0.9) * 0.5)
    c.lerp(C.wet, sstep(-0.12, -0.32, y) * 0.85)
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

const ROCK_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })
const VARIANTS = 8 // 0~4 둥근 바위, 5~7 = 윗면 평평한 바위 (징검돌·돌길)
let geos = null
const getGeos = () => (geos ??= Array.from({ length: VARIANTS }, (_, k) => rockGeometry(k + 1, k >= 5)))

function RockSet({ rocks }) {
  const ref = useRef(null)
  const geo = getGeos()[rocks[0][5]]
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    rocks.forEach(([x, z, r, h, rot], i) => {
      o.position.set(x, 0.35 * h * 1.28 - 0.22, z)
      o.rotation.set(0, (rot * Math.PI) / 180, 0)
      o.scale.set(r, h * 1.28, r * 0.88)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      const k = 0.88 + ((i * 37) % 23) / 100
      m.setColorAt(i, c.setRGB(k, k * (0.97 + ((i * 13) % 7) / 100), k * 0.96))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [rocks])
  return <instancedMesh ref={ref} args={[geo, ROCK_MAT, rocks.length]} castShadow receiveShadow />
}

export function JmBoulderRiver({ item }) {
  const groups = useMemo(() => {
    const by = Array.from({ length: VARIANTS }, () => [])
    for (const r of item.rocks ?? []) by[r[5] % VARIANTS].push(r)
    return by.filter((g) => g.length)
  }, [item.rocks])
  return (
    <group>
      {groups.map((g) => (
        <RockSet key={g[0][5]} rocks={g} />
      ))}
    </group>
  )
}

export const JM_RIVERBED_STYLES = { jmBoulderRiver: JmBoulderRiver }
