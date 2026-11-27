import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { findPlayer } from '../../Player/findPlayer.js'
import { sampleOceanBoundary } from './jm_seaGeometry.js'

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
export function useSeaWave(ref, geometry, far = 80, still = false) {
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry])
  const center = useMemo(() => {
    geometry.computeBoundingSphere()
    return geometry.boundingSphere
  }, [geometry])
  const lastTick = useRef(-1)
  useFrame(({ clock, camera }) => {
    const mesh = ref.current
    if (!mesh || still) return
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

// (11/25 밤 지민 요청) 해변 색 띠 대신 강물: 강둑 쪽 탁한 초록빛 얕은 물 → 가운데 짙은 청록, 반투명이라 모래 바닥이 비침
//   걸어 들어갈 수 있는 강(wade)은 물높이 0.45m, 걸으면 물방울·물결 (WadeSplash). 바다 조각은 짙은 파랑 한 색
const RIVER_STOPS = [[0, '#7d8f62'], [0.8, '#6f9478'], [2.2, '#4f8f8f'], [5, '#3a7d8c'], [9, '#2f6a80']]
const SEA_ONE = '#2a6f8e'
function riverColorAt(dist) {
  for (let i = 1; i < RIVER_STOPS.length; i++) {
    const [d1, c1] = RIVER_STOPS[i]
    if (dist <= d1) {
      const [d0, c0] = RIVER_STOPS[i - 1]
      return new THREE.Color(c0).lerp(new THREE.Color(c1), (dist - d0) / (d1 - d0))
    }
  }
  return new THREE.Color(RIVER_STOPS.at(-1)[1])
}
const RIVER_WATER = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false })
const SEA_WATER = new THREE.MeshStandardMaterial({ color: SEA_ONE, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide })
// 강 띠 (로컬 x = 폭, z = 길이). sea: 한 색(이음새 무늬 없음)
// deep: 바다 조각처럼 여러 판이 붙는 곳 — 물가 색 없이 물길 가운데 색(짙은 청록)으로 고르게, 물결은 움직임
export function riverGeometry(w, len, sea = false, deep = false) {
  // (렉 줄이기) 바다 조각은 물결을 움직이지 않으니 칸을 거의 안 나눔
  const across = sea ? 2 : Math.max(8, Math.ceil(w / 0.6))
  const along = sea ? 2 : Math.max(2, Math.ceil(len / 1.5))
  const g = new THREE.PlaneGeometry(w, len, across, along)
  g.rotateX(-Math.PI / 2)
  if (!sea) {
    const pos = g.attributes.position
    const colors = []
    for (let i = 0; i < pos.count; i++) colors.push(...riverColorAt(deep ? 7 + 2 * Math.sin(pos.getX(i) * 0.21 + pos.getZ(i) * 0.13) : w / 2 - Math.abs(pos.getX(i))).toArray())
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  }
  g.attributes.position.setUsage(THREE.DynamicDrawUsage)
  return g
}
export function RiverWater({ w, len, y = 0.05, sea = false, deep = false, far, still = false }) {
  const ref = useRef(null)
  const geo = useMemo(() => riverGeometry(w, len, sea, deep), [w, len, sea, deep])
  useSeaWave(ref, geo, far, sea || still)
  return <mesh ref={ref} geometry={geo} material={sea ? SEA_WATER : RIVER_WATER} position={[0, y, 0]} userData={{ noMerge: true }} />
}

// 걸어 들어간 강에서 물 튀기기: 캐릭터가 물 띠 안에서 움직이면 발밑에 물방울(위로 튀었다 떨어짐) + 둥근 물결
//   공용 FootSplashes는 SG 해변 전용이라 애니 구역 강용으로 따로 (캐릭터 위치는 scene의 player에서 읽기만 함)
const DROP_N = 48
const RING_N = 8
const DROP_M = new THREE.MeshBasicMaterial({ color: '#eaf6f4', transparent: true, opacity: 0.85 })
export function WadeSplash({ w, len, y }) {
  const group = useRef(null)
  const drops = useRef(null)
  const rings = useRef([])
  const ringMats = useMemo(() => Array.from({ length: RING_N }, () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })), [])
  const st = useMemo(() => ({
    player: null, last: new THREE.Vector3(), has: false, me: new THREE.Vector3(), t: 0, next: 0,
    d: Array.from({ length: DROP_N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })),
    r: Array.from({ length: RING_N }, () => ({ x: 0, z: 0, life: 0 })), di: 0, ri: 0,
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(),
  }), [])
  useFrame(({ scene }, dt) => {
    if (!group.current) return
    if (!st.player?.parent) st.player = findPlayer(scene)
    const step = Math.min(dt, 0.05)
    st.t += step
    if (st.player) {
      st.player.getWorldPosition(st.me)
      group.current.worldToLocal(st.me)
      const inside = Math.abs(st.me.x) < w / 2 - 0.2 && Math.abs(st.me.z) < len / 2 && st.me.y < y + 1.6 && st.me.y > -1
      const moved = st.has ? Math.hypot(st.me.x - st.last.x, st.me.z - st.last.z) : 0
      st.last.copy(st.me)
      st.has = true
      if (inside && moved > 0.02 && st.t > st.next) {
        st.next = st.t + 0.12
        for (let k = 0; k < 2; k++) {
          const d = st.d[st.di++ % DROP_N]
          d.p.set(st.me.x + (Math.random() - 0.5) * 0.4, y, st.me.z + (Math.random() - 0.5) * 0.4)
          d.v.set((Math.random() - 0.5) * 0.9, 0.8 + Math.random() * 0.7, (Math.random() - 0.5) * 0.9)
          d.life = 0.45
        }
        if (Math.random() < 0.3) {
          const r = st.r[st.ri++ % RING_N]
          r.x = st.me.x
          r.z = st.me.z
          r.life = 1
        }
      }
    }
    // (11/27 최적화) 살아 있는 물방울·고리가 없으면 위치 올리기를 건너뜀 — 얕은 물마다 매 프레임 물방울 48개 행렬을 다시 올리던 것
    //   마지막 물방울이 사라진 프레임에 한 번만 더 올려서(크기 0) 화면에서 지움
    const alive = st.d.some((d) => d.life > 0) || st.r.some((r) => r.life > 0)
    if (!alive && !st.dirty) return
    st.dirty = alive
    const mesh = drops.current
    if (mesh) {
      st.d.forEach((d, i) => {
        if (d.life > 0) {
          d.life -= step
          d.v.y -= 9.8 * step
          d.p.addScaledVector(d.v, step)
          if (d.p.y < y) d.life = 0
        }
        const sc = d.life > 0 ? 0.03 : 0
        st.s.set(sc, sc, sc)
        st.m.compose(d.p, st.q, st.s)
        mesh.setMatrixAt(i, st.m)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    st.r.forEach((r, i) => {
      const ring = rings.current[i]
      if (!ring) return
      if (r.life > 0) r.life -= step * 0.9
      ring.visible = r.life > 0
      if (ring.visible) {
        ring.position.set(r.x, y + 0.02, r.z)
        ring.scale.setScalar(0.2 + (1 - r.life) * 0.8)
        ringMats[i].opacity = 0.35 * r.life
      }
    })
  })
  return (
    <group ref={group}>
      <instancedMesh ref={drops} args={[null, DROP_M, DROP_N]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
      </instancedMesh>
      {ringMats.map((m, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} rotation={[-Math.PI / 2, 0, 0]} visible={false} material={m}>
          <ringGeometry args={[0.85, 1, 24]} />
        </mesh>
      ))}
    </group>
  )
}

// (11/25 밤) 걸어 들어가는 강이 떠 보이지 않게: 물 옆면(바닥 ~ 수면, 물빛 반투명) + 양쪽 낮은 흙·풀 둑(경사, 걷기 막이 없음)
const SKIRT = new THREE.MeshStandardMaterial({ color: '#5f8a70', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
const BANK = new THREE.MeshStandardMaterial({ color: '#6f8a48', roughness: 1, flatShading: true })
const BANK_MUD = new THREE.MeshStandardMaterial({ color: '#7a6a4a', roughness: 1, flatShading: true })
function bankGeometry(len, width, height) {
  const sh = new THREE.Shape()
  sh.moveTo(0, 0)
  sh.lineTo(width, 0)
  sh.lineTo(0, height)
  sh.lineTo(0, 0)
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false })
  g.translate(0, 0, -len / 2)
  return g
}
export function RiverBanks({ w, len, depth, ends = false }) {
  const bank = useMemo(() => bankGeometry(len, 1.4, depth + 0.12), [len, depth])
  const mud = useMemo(() => bankGeometry(len, 0.5, depth + 0.02), [len, depth])
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (w / 2), depth / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={SKIRT}>
            <planeGeometry args={[len, depth]} />
          </mesh>
          {/* 바깥쪽으로 내려가는 풀 둑 + 물가 진흙 띠 */}
          <mesh geometry={bank} material={BANK} position={[s * (w / 2), 0, 0]} scale={[s, 1, 1]} />
          <mesh geometry={mud} material={BANK_MUD} position={[s * (w / 2), 0, 0]} scale={[-s, 1, 1]} />
        </group>
      ))}
      {ends && [-1, 1].map((s) => (
        <mesh key={`e${s}`} position={[0, depth / 2, s * (len / 2)]} material={SKIRT}>
          <planeGeometry args={[w, depth]} />
        </mesh>
      ))}
    </group>
  )
}

// ── 마을을 둘러싼 물길 (11/26 지민 요청: 마을이 물에 둘러싸이게, 돌 강 쪽은 얕게, 선은 직선 말고 자연스럽게) ──
// 점 줄(가운데 선)을 부드러운 곡선으로 잇고, 점마다 폭을 다르게 + 가장자리를 살짝 일렁이게 해서 자연스러운 물가 선
// 물빛은 강과 같은 색 단계(물가 탁한 초록 → 가운데 짙은 청록, 반투명) + 같은 물결 움직임. 바깥으로 진흙 → 풀빛 물가 띠
// item.river = { points: [[x, z]...](구역 좌표, 소품은 [0,0]에 둠), widths: [점마다 폭], y: [시작 물높이, 끝 물높이] }
function channelGeometry(R, bank = false) {
  const curve = new THREE.CatmullRomCurve3(R.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
  const n = Math.max(8, Math.round(curve.getLength() / 1.2))
  const ws = R.widths
  const widthAt = (t) => {
    const f = t * (ws.length - 1)
    const i = Math.min(ws.length - 2, Math.floor(f))
    const k = f - i
    const s = k * k * (3 - 2 * k)
    return ws[i] + (ws[i + 1] - ws[i]) * s
  }
  // 물높이: [시작, 끝] 또는 점마다 하나씩
  const ys = R.y ?? [0.12, 0.07]
  const yAt = (t) => {
    if (ys.length === 2) return ys[0] + (ys[1] - ys[0]) * t
    const f = t * (ys.length - 1)
    const i = Math.min(ys.length - 2, Math.floor(f))
    return ys[i] + (ys[i + 1] - ys[i]) * (f - i)
  }
  const cols = bank ? 6 : 14
  const pos = []
  const col = []
  const idx = []
  const c = new THREE.Color()
  const mud = new THREE.Color('#7d6e52')
  const grassC = new THREE.Color('#5f8a45')
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    const nx = tan.z
    const nz = -tan.x
    const L = curve.getLength() * t
    // 가장자리 일렁임 (양쪽 따로)
    const half = widthAt(t) / 2
    const wk = Math.min(1, half / 4) // 좁은 물길은 일렁임도 작게
    const wobL = wk * (0.9 * Math.sin(L / 5.3) + 0.5 * Math.sin(L / 2.1 + 1.3))
    const wobR = wk * (0.9 * Math.sin(L / 4.7 + 2) + 0.5 * Math.sin(L / 1.9))
    const y = yAt(t)
    for (let j = 0; j <= cols; j++) {
      const u = j / cols // 0 = 왼쪽 가장자리, 1 = 오른쪽
      let o
      let yy
      if (bank) {
        // 물가 띠: 양쪽 가장자리에서 바깥으로 3m (j 0~2 왼쪽, 4~6 오른쪽, 3은 안 씀 → 가운데는 물 밑)
        const side = j < cols / 2 ? -1 : 1
        const k = side < 0 ? (cols / 2 - j) / (cols / 2) : (j - cols / 2) / (cols / 2)
        const edge = side < 0 ? half + wobL : half + wobR
        o = side * (edge - 0.6 + k * 3.6)
        yy = 0.03 + 0.02 * k
        c.copy(mud).lerp(grassC, Math.min(1, k * 1.3))
      } else {
        const eL = half + wobL
        const eR = half + wobR
        o = -eL + u * (eL + eR)
        yy = y
        const dist = Math.min(o + eL, eR - o)
        // (11/26 지민 요청) palette 'ocean' = 넓힌 바다와 같은 색 단계(옥빛 → 짙은 바다)로 물가 쪽만 살짝 얕은 빛 → 바다와 한 물처럼
        if (R.palette === 'ocean') oceanColor(Math.max(0.6, dist * 1.6), 8, c)
        else c.copy(riverColorAt(dist))
        // (11/26 지민 요청: 바위 강 물줄기가 바다와 만날 때 색도 자연스럽게) 바다에 닿는 끝 seaBlend(m) 동안 해변 바다 옥빛으로 바뀜
        if (R.seaBlend) {
          const total = curve.getLength()
          const near = Math.min(R.seaAtStart === false ? Infinity : L, R.seaAtEnd === false ? Infinity : total - L)
          const f = Math.max(0, 1 - near / R.seaBlend)
          if (f > 0) c.lerp(SEA_NEAR, f * f * (3 - 2 * f) * 0.9)
        }
      }
      pos.push(p.x + nx * o, yy, p.z + nz * o)
      if (bank) col.push(c.r, c.g, c.b)
      else {
        // (11/26 지민 요청: 물길끼리·바다와 이어지는 곳을 자연스럽게) 시작·끝을 fadeStart·fadeEnd(m)에 걸쳐 투명하게 → 겹쳐도 경계가 안 보임
        const total = curve.getLength()
        const a1 = R.fadeStart ? Math.min(1, L / R.fadeStart) : 1
        const a2 = R.fadeEnd ? Math.min(1, (total - L) / R.fadeEnd) : 1
        const a = Math.min(a1, a2)
        col.push(c.r, c.g, c.b, a * a * (3 - 2 * a))
      }
    }
    // 물가 띠는 물이 흐려지는 시작·끝 구간(다른 물·바다와 겹치는 곳)에는 깔지 않음 → 바다 위에 풀 띠가 뜨지 않게
    const cutBank = bank && ((R.fadeStart && L < R.fadeStart * 1.4) || (R.fadeEnd && curve.getLength() - L < R.fadeEnd * 1.6))
    if (i && !cutBank) for (let k = 0; k < cols; k++) {
      if (bank && k === cols / 2 - 1) continue
      const a = (i - 1) * (cols + 1) + k
      const b = i * (cols + 1) + k
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, bank ? 3 : 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  if (!bank) {
    const nrm = g.attributes.normal
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0)
    g.attributes.position.setUsage(THREE.DynamicDrawUsage)
  }
  return g
}
const BANK_M = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
const SEA_NEAR = new THREE.Color('#53b8b9') // 해변 바다 물가 옥빛 (coastColors.js와 같은 색)
export function JmChannelWater({ item }) {
  const ref = useRef(null)
  const geo = useMemo(() => channelGeometry(item.river), [item.river])
  const bank = useMemo(() => channelGeometry(item.river, true), [item.river])
  useSeaWave(ref, geo, 90)
  return (
    <group>
      <mesh geometry={bank} material={BANK_M} receiveShadow userData={{ noMerge: true }} />
      <mesh ref={ref} geometry={geo} material={RIVER_WATER} frustumCulled={false} renderOrder={2} userData={{ noMerge: true }} />
    </group>
  )
}

// ── 여관 섬 둘레 바다 (11/26 지민 요청: 네모 바다 판 → 강물처럼 자연스러운 물가 경계) ──
// 네모 모서리를 둥글린 큰 고리 모양(초타원)에 물가를 천천히 일렁이게 → 물빛은 강·물길과 같은 색 단계(물가 탁한 초록 → 가운데 짙은 청록), 물결 움직임
// 바깥으로 진흙 → 풀빛 물가 띠. 남쪽(마을 단 밑)은 물가 띠 없이 단 아래로 들어감
// item.lake = { c: [x, z](구역 좌표, 소품은 [0,0]), ax, az(반폭), p(모서리 둥글기 지수), y, noBankSouthOf(z: 이보다 남쪽은 물가 띠 없음) }
function lakeBoundary(L, th) {
  const c = Math.cos(th)
  const s = Math.sin(th)
  const p = L.p ?? 4
  const r = 1 / Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p)
  const wob = 1 + 0.035 * Math.sin(th * 7 + 0.5) + 0.02 * Math.sin(th * 17 + 2.1) + 0.012 * Math.sin(th * 31)
  return [L.c[0] + c * r * L.ax * wob, L.c[1] + s * r * L.az * wob]
}
function seaLakeGeometry(L, bank = false, bed = false) {
  const segs = 220
  const rings = bank ? 3 : 18
  const pos = []
  const col = []
  const idx = []
  const c = new THREE.Color()
  const mud = new THREE.Color('#7d6e52')
  const grassC = new THREE.Color('#5f8a45')
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2
    const [bx, bz] = lakeBoundary(L, th)
    const dx = bx - L.c[0]
    const dz = bz - L.c[1]
    const R = Math.hypot(dx, dz)
    for (let j = 0; j <= rings; j++) {
      if (bank) {
        const k = j / rings
        const f = (R - 0.8 + k * 5) / R
        pos.push(L.c[0] + dx * f, 0.03 + 0.02 * k, L.c[1] + dz * f)
        c.copy(mud).lerp(grassC, Math.min(1, k * 1.3))
        col.push(c.r, c.g, c.b)
      } else {
        // 가운데에서 물가로: 물가 쪽 칸을 촘촘히 (색 단계가 물가에서 바뀌므로)
        const v = 1 - (1 - j / rings) ** 2
        pos.push(L.c[0] + dx * v, bed ? 0.012 : L.y ?? 0.07, L.c[1] + dz * v)
        // 바닥: 물가는 모래·진흙빛, 안쪽으로 갈수록 짙은 바다 밑
        if (bed) c.copy(SEABED_SHORE).lerp(SEABED_DEEP, Math.min(1, ((1 - v) * R) / 10))
        else c.copy(riverColorAt((1 - v) * R))
        col.push(c.r, c.g, c.b)
      }
    }
    if (i) for (let j = 0; j < rings; j++) {
      if (bank && L.noBankSouthOf != null && bz > L.noBankSouthOf) continue
      const a = (i - 1) * (rings + 1) + j
      const b = i * (rings + 1) + j
      idx.push(a, b, a + 1, a + 1, b, b + 1) // 위에서 봤을 때 반시계 → 윗면이 앞면 (반대면 물이 아래서 비춰 검게 보임)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  if (!bank) {
    const nrm = g.attributes.normal
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0)
    g.attributes.position.setUsage(THREE.DynamicDrawUsage)
  }
  return g
}
const SEABED_SHORE = new THREE.Color('#8f8262')
const SEABED_DEEP = new THREE.Color('#4d817f')
const SEABED_M = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
export function JmSeaLake({ item }) {
  const ref = useRef(null)
  const geo = useMemo(() => seaLakeGeometry(item.lake), [item.lake])
  const bank = useMemo(() => seaLakeGeometry(item.lake, true), [item.lake])
  const bed = useMemo(() => seaLakeGeometry(item.lake, false, true), [item.lake])
  useSeaWave(ref, geo, 140)
  return (
    <group>
      <mesh geometry={bed} material={SEABED_M} userData={{ noMerge: true }} />
      <mesh geometry={bank} material={BANK_M} receiveShadow userData={{ noMerge: true }} />
      <mesh ref={ref} geometry={geo} material={RIVER_WATER} frustumCulled={false} renderOrder={1} userData={{ noMerge: true }} />
    </group>
  )
}

// ── 넓힌 바다 (11/26 지민 요청: 강 대신 바다를 넓혀 여관 둘레 ~ 서쪽 ~ 남서쪽 해변 바다까지 한 덩어리) ──
// 물빛·물가는 이미 있는 해변 바다(coastColors.js coastRows)와 같은 색 단계: 마른 모래 → 젖은 모래 → 흰 물거품 줄 → 옥빛 → 짙은 바다(#286f91)
// item.ocean = { pts: [[x, z, open?]...] (구역 좌표, 시계 방향 한 바퀴, open = 이 점에서 다음 점까지는 기존 바다와 겹치는 열린 쪽: 모래 없이 흐려짐),
//                sand: 모래 폭(m), y }
// 만드는 법: 2.5m 격자 점마다 물가선까지 거리(안 = +, 밖 = -)를 재서 색, 물가 밖 모래 폭 안쪽 점까지만 삼각형을 깖. 열린 쪽 15m는 투명하게 흐려 기존 바다와 섞음
// (11/26) 물거품 줄은 격자(2m)보다 넓고 연하게 → 얼룩덜룩 번지지 않게
const OCEAN_STOPS = [[-1, '#c0ba9f'], [-0.82, '#e2d4ac'], [-0.24, '#f2d79f'], [-0.08, '#cba978'], [0.2, '#d9f1e6'], [2, '#94ddd0'], [8, '#53b8b9'], [26, '#369aa9'], [60, '#286f91']]
function oceanColor(d, sand, c) {
  // d < 0 (모래 쪽)은 모래 폭에 대한 비율, d ≥ 0은 m
  const key = d < 0 ? d / sand : d
  const stops = OCEAN_STOPS
  if (key <= stops[0][0]) return c.set(stops[0][1])
  for (let i = 1; i < stops.length; i++) {
    if (key <= stops[i][0]) {
      const [a, ca] = stops[i - 1]
      const [b, cb] = stops[i]
      return c.set(ca).lerp(new THREE.Color(cb), (key - a) / (b - a))
    }
  }
  return c.set(stops.at(-1)[1])
}
function oceanGeometry(O) {
  const sand = O.sand ?? 8
  const poly = sampleOceanBoundary(O.pts, 4)
  const N = poly.length
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const [x, z] of poly) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z)
  }
  x0 -= sand + 3; x1 += sand + 3; z0 -= sand + 3; z1 += sand + 3
  const S = 2 // (11/26) 격자를 촘촘히 → 물가 선이 덜 각짐
  const nx = Math.ceil((x1 - x0) / S)
  const nz = Math.ceil((z1 - z0) / S)
  // (11/27 성능) 격자 점마다 물가선 전체(N개 구간)를 훑던 계산이 첫 로딩 메인 스레드를 ~3초 멈춤
  //   → 구간을 칸(SC m)별로 나눠 두고 가까운 칸만 봄. 결과는 같음 (R m 넘게 먼 물가는 색·투명도에 영향 없어 Infinity로 둠)
  const SC = 16
  const R = 80
  const cellOf = (v, v0) => Math.floor((v - v0) / SC)
  const gcx = Math.ceil((x1 - x0) / SC) + 1
  const gcz = Math.ceil((z1 - z0) / SC) + 1
  const cells = Array.from({ length: gcx * gcz }, () => [])
  const rows = Array.from({ length: gcz }, () => []) // 안/밖 판정용: z 줄별로 그 줄을 지나는 변
  const has = {} // 물가 종류(B·L·O·M)가 하나라도 있는지
  for (const p of poly) has[p[2] === 'O' || p[2] === 'M' || p[2] === 'L' ? p[2] : 'B'] = true
  for (let a = 0; a < N; a++) {
    const p = poly[a]
    const q = poly[(a + 1) % N]
    const ca0 = Math.max(0, cellOf(Math.min(p[0], q[0]), x0)), ca1 = Math.min(gcx - 1, cellOf(Math.max(p[0], q[0]), x0))
    const cb0 = Math.max(0, cellOf(Math.min(p[1], q[1]), z0)), cb1 = Math.min(gcz - 1, cellOf(Math.max(p[1], q[1]), z0))
    for (let cb = cb0; cb <= cb1; cb++) {
      rows[cb].push(a)
      for (let ca = ca0; ca <= ca1; ca++) cells[cb * gcx + ca].push(a)
    }
  }
  const inside = (x, z) => {
    let c = false
    const row = rows[Math.min(gcz - 1, Math.max(0, cellOf(z, z0)))]
    for (const a of row) {
      const [xi, zi] = poly[(a + 1) % N]
      const [xj, zj] = poly[a]
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
    }
    return c
  }
  const segDist = (x, z, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const L = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L))
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)
  }
  const distances = (x, z, lim = R) => {
    let dBeach = Infinity
    let dLake = Infinity
    let dOpen = Infinity
    let dMouth = Infinity
    const add = (a) => {
      const p = poly[a]
      const dd = segDist(x, z, p, poly[(a + 1) % N])
      if (p[2] === 'O') dOpen = Math.min(dOpen, dd)
      else if (p[2] === 'M') dMouth = Math.min(dMouth, dd) // 강어귀: 물길(JmChannelWater)과 서로 흐려지며 겹치는 쪽
      else if (p[2] === 'L') dLake = Math.min(dLake, dd)
      else dBeach = Math.min(dBeach, dd)
    }
    if (lim === Infinity) for (let a = 0; a < N; a++) add(a)
    const cx = cellOf(x, x0)
    const cz = cellOf(z, z0)
    // 고리(k칸)를 넓혀 가며 봄. 고리 k까지 보면 (k-1)·SC m 안의 구간은 모두 본 것 → 네 종류 다 그보다 가깝거나 R을 넘으면 멈춤
    for (let k = 0; lim !== Infinity; k++) {
      for (let cb = cz - k; cb <= cz + k; cb++) {
        if (cb < 0 || cb >= gcz) continue
        const edge = cb === cz - k || cb === cz + k
        for (let ca = cx - k; ca <= cx + k; ca += edge ? 1 : 2 * k || 1) {
          if (ca >= 0 && ca < gcx) for (const a of cells[cb * gcx + ca]) add(a)
        }
      }
      const seen = (k - 1) * SC
      // 없는 종류는 기다리지 않음 (없는 종류 때문에 매 점 R까지 다 훑던 것)
      if (seen >= lim || seen >= Math.max(has.B ? dBeach : 0, has.L ? dLake : 0, has.O ? dOpen : 0, has.M ? dMouth : 0)) break
    }
    // R 밖: 그 종류가 아예 없으면 Infinity(원래 값), 있으면 '아주 멀다'로 — lakeW가 '없음'과 '멂'을 구분하기 때문
    const far = (d, kind) => (d <= lim ? d : has[kind] ? 1e9 : Infinity)
    return { dBeach: far(dBeach, 'B'), dLake: far(dLake, 'L'), dOpen: far(dOpen, 'O'), dMouth: far(dMouth, 'M') }
  }
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3)
  const col = new Float32Array((nx + 1) * (nz + 1) * 4)
  const keep = new Uint8Array((nx + 1) * (nz + 1))
  const flat = new Uint8Array((nx + 1) * (nz + 1)) // 흔들지 않았고, 물 안쪽이며, 불투명한 점 → 큰 칸으로 합쳐도 되는 점
  const c = new THREE.Color()
  const y = O.y ?? 0.05
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i
      const gx = x0 + i * S
      const gz = z0 + j * S
      // 가장자리가 격자처럼 보이지 않게 점을 살짝 흔듦 — 물가에서 먼 바다 한가운데는 흔들지 않음 (큰 칸으로 합칠 수 있게)
      let dist = distances(gx, gz)
      const calm = Math.min(dist.dBeach, dist.dLake) > CALM_D && Math.min(dist.dOpen, dist.dMouth) > 20
      const x = calm ? gx : gx + Math.sin(j * 1.7 + i * 0.3) * 0.6
      const z = calm ? gz : gz + Math.cos(i * 1.3 + j * 0.4) * 0.6
      if (!calm) dist = distances(x, z)
      const inS = inside(x, z)
      // 물 밖·열린 쪽 경계 6m 안(이웃 격자점 거리 2.8m + 흔들림 1.7m)인데 해변·호숫가 둘 다 R보다 멀면: 투명 점이어도 이웃 삼각형 색에 섞이므로 전부 훑어 정확히 다시 잼
      if (!inS && dist.dOpen < 6 && dist.dBeach === 1e9 && dist.dLake === 1e9) dist = distances(x, z, Infinity)
      const { dBeach, dLake, dOpen, dMouth } = dist
      const dShore = Math.min(dBeach, dLake)
      // 호수식 물가 비중: 가까운 물가가 호수 쪽이면 1 (두 종류가 만나는 곳은 12m에 걸쳐 섞임)
      const lakeW = dLake === Infinity ? 0 : dBeach === Infinity ? 1 : Math.max(0, Math.min(1, 0.5 + (dBeach - dLake) / 24))
      const band = sand * (1 - lakeW) + LAKE_BANK * lakeW // 물가 띠 폭: 모래 8m / 호수 둑 3.5m
      const d = inS ? dShore : -dShore
      // 밖인데 열린 쪽에 더 가까우면(기존 바다 쪽) 그리지 않음
      // (11/26) 물가 띠 바깥으로 넉넉히 더 깔고(투명) 거기서 흐려지게 → 삼각형이 잘린 계단 모양 가장자리가 안 보임
      const ok = inS || (dShore < band + 5 && dShore < dOpen && dShore < dMouth)
      keep[k] = ok ? 1 : 0
      oceanColor(d, sand, c)
      if (lakeW > 0) {
        // 호수식 물가: 모래·물거품 대신 진흙 → 풀빛 둑, 물가 물은 탁한 초록빛 얕은 물 → 10m 지나며 바다 색으로
        // (11/26) 물은 둘레 물길(palette 'ocean')과 같은 옥빛 단계 → 물길과 물굽이가 한 물로 보임. 둑은 진흙을 옅게(풀빛 반) → 탁한 띠가 번져 보이지 않게
        if (!inS) lakeBank.copy(LAKE_MUD).lerp(LAKE_GRASS, 0.6 + 0.4 * Math.min(1, dShore / LAKE_BANK))
        else oceanColor(Math.max(1.6, dShore * 1.6), sand, lakeBank)
        c.lerp(lakeBank, lakeW)
      }
      let alpha = 1
      if (!inS) {
        // 물가 띠 바깥 4m에 걸쳐 풀밭으로 부드럽게 흐려짐. 호수식은 둑 색이 풀밭과 따로 놀지 않게 물가 1m부터 바로 흐려짐
        const fadeAt = sand * (1 - lakeW) + 1 * lakeW
        const fw = 4 - 1.5 * lakeW // 흐려지는 폭: 모래 4m / 호수식 2.5m (좁은 물굽이가 뿌옇게 번져 보이지 않게)
        const t = Math.max(0, Math.min(1, (fadeAt + fw * 0.6 - dShore) / fw))
        alpha = t * t * (3 - 2 * t)
      }
      if (inS && dOpen < 18) alpha *= Math.max(0, Math.min(1, dOpen / 18)) // 열린 쪽은 기존 바다로 흐려짐
      if (dMouth < 10) alpha *= inS ? Math.max(0, Math.min(1, dMouth / 10)) : 0 // 강어귀는 10m에 걸쳐 물길 물로 넘어감
      pos.set([x, y + (d < 0 ? -0.01 : 0), z], k * 3)
      col.set([c.r, c.g, c.b, Math.max(0, alpha)], k * 4)
      flat[k] = calm && inS && alpha >= 0.999 ? 1 : 0
    }
  // (11/26 최적화) 바다 한가운데(물가에서 CALM_D m 넘게 떨어진 곳)는 2m 칸 4×4개를 8m 칸 하나로 합침
  //   색이 천천히 바뀌는 곳이라 큰 칸 모서리 색을 이어 칠해도 거의 같고, 높이가 모두 같아 이음매 틈이 없음
  //   물가 쪽은 그대로 2m 칸 → 물가 선 모양은 그대로. 삼각형 약 15.9만 → 절반 이하
  const idx = []
  const B = 4
  const done = new Uint8Array(nx * nz)
  for (let bj = 0; bj + B <= nz; bj += B)
    for (let bi = 0; bi + B <= nx; bi += B) {
      let all = true
      for (let j = bj; j <= bj + B && all; j++) for (let i = bi; i <= bi + B; i++) if (!flat[j * (nx + 1) + i]) { all = false; break }
      if (!all) continue
      const a = bj * (nx + 1) + bi
      const b = a + B
      const cc = a + B * (nx + 1)
      const dd = cc + B
      idx.push(a, cc, b, b, cc, dd)
      for (let j = bj; j < bj + B; j++) for (let i = bi; i < bi + B; i++) done[j * nx + i] = 1
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      if (done[j * nx + i]) continue
      const a = j * (nx + 1) + i
      const b = a + 1
      const cc = a + nx + 1
      const dd = cc + 1
      if (keep[a] || keep[b] || keep[cc] || keep[dd]) {
        idx.push(a, cc, b, b, cc, dd)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  const nrm = g.attributes.normal
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0)
  return g
}
const LAKE_BANK = 3.5
const CALM_D = 22 // 물가에서 이만큼 떨어진 바다 한가운데는 큰 칸으로 합침 (물거품·얕은 물 색 단계는 20m 안쪽)
const LAKE_MUD = new THREE.Color('#7d6e52')
const LAKE_GRASS = new THREE.Color('#5f8a45')
const lakeBank = new THREE.Color()
// (11/26) 서쪽 땅 메우기(jm_seaLine.jsx JmLandFill) 위에 모래·물이 그려지게 깊이를 조금 더 앞으로
const OCEAN_M = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.4, metalness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 })
export function JmOcean({ item }) {
  const geo = useMemo(() => oceanGeometry(item.ocean), [item.ocean])
  return <mesh name="jm-ocean" geometry={geo} material={OCEAN_M} frustumCulled={false} renderOrder={1} receiveShadow userData={{ noMerge: true }} />
}

export const JM_CHANNEL_STYLES = { jmChannelWater: JmChannelWater, jmSeaLake: JmSeaLake, jmOcean: JmOcean }
