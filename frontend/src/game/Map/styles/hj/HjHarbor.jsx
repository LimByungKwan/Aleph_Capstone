import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getTiledTexture } from '../textures.js'
import { Box, GEO, Instances, mat } from '../kit.jsx'
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'

// [3. 개발 > 기초개발/서비스] 혜진 구역 바닷가: 바다 · 방파제 · 등대 · 고깃배
// 촬영지 '방파제 & 등대' (가상 영화 「등대가 켜지면」)

// ── 바다 (style: "hjSea") — size [가로, -, 세로]. 잔잔한 물결이 움직여요. 충돌 없음.
export function HjSea({ item }) {
  const [w, , d] = item.size
  const ref = useRef(null)
  const lastWaveTick = useRef(-1)
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d, Math.ceil(w / 1.5), Math.ceil(d / 1.5))
    g.rotateX(-Math.PI / 2)
    g.attributes.position.setUsage(THREE.DynamicDrawUsage)
    return g
  }, [w, d])
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry])

  useFrame(({ clock }) => {
    const pos = ref.current?.geometry.attributes.position
    if (!pos) return
    const t = clock.elapsedTime
    // [3. 개발 > 렌더링 최적화] 물결의 속도는 유지하고 메시 갱신은 초당 최대 30회로 제한해요.
    const tick = Math.floor(t * 30)
    if (lastWaveTick.current === tick) return
    lastWaveTick.current = tick
    for (let i = 0; i < pos.count; i += 1) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      pos.setY(i, Math.sin(x * 0.45 + t * 1.2) * 0.024 + Math.cos(z * 0.38 + t * 0.9) * 0.024)
    }
    pos.needsUpdate = true
  })

  return (
    <group>
      {/* 바닥이 비치지 않게 깊은 물색 판 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={item.deepColor ?? "#1f4f7a"} />
      </mesh>
      <mesh ref={ref} geometry={geometry} position={[0, 0.11, 0]}>
        <meshStandardMaterial color={item.surfaceColor ?? "#3d84b8"} transparent opacity={0.88} roughness={0.25} metalness={0.15} />
      </mesh>
      {item.wall !== false && <HarborRails boxes={seaRails(item)} />}
    </group>
  )
}

// 둑을 [시작z, 끝z] 조각들로 나눔. openings = [[z1, z2], ...] (바다 기준 상대 z)
function wallSegments(d, openings = []) {
  const gaps = [...openings].sort((a, b) => a[0] - b[0])
  const segments = []
  let cursor = -d / 2
  for (const [a, b] of gaps) {
    if (a > cursor) segments.push([cursor, Math.min(a, d / 2)])
    cursor = Math.max(cursor, b)
  }
  if (cursor < d / 2) segments.push([cursor, d / 2])
  return segments.filter(([a, b]) => b - a > 0.05)
}

function seaRails({ size: [w, , d], openings }) {
  const height = 1.65
  const edges = wallSegments(d, openings).map(([from, to]) => ({
    p: [-w / 2 + 0.4, height / 2, (from + to) / 2], s: [0.28, height, to - from],
  }))
  return [
    ...edges,
    { p: [w / 2 - 0.14, height / 2, 0], s: [0.28, height, d] },
    ...[-1, 1].map((side) => ({ p: [0.2, height / 2, side * (d / 2 - 0.14)], s: [w - 0.4, height, 0.28] })),
  ]
}

const STONE_RAIL = mat('#aaa69d', { flat: true })
const WOOD_DECK = '#ad8562'

function HarborRails({ boxes }) {
  return <Instances geometry={GEO.box} material={STONE_RAIL} items={boxes} />
}

function breakwaterCurve(item) {
  return new THREE.CatmullRomCurve3(item.points.map(([x, z]) => new THREE.Vector3(x, 0, z)))
}

function breakwaterRails(item, curve) {
  if (item.lookout) return lookoutRails(item, curve)
  if (item.gardenBridge) return gardenBridgeRails(item, curve)
  if (item.promenade) return []
  const width = item.width ?? 3
  const count = Math.ceil(curve.getLength() / 0.8)
  const rails = []
  for (const side of [-1, 1]) {
    let previous
    for (let index = 0; index <= count; index += 1) {
      const t = index / count
      const tangent = curve.getTangentAt(t)
      const point = curve.getPointAt(t).addScaledVector(new THREE.Vector3(-tangent.z, 0, tangent.x), side * (width / 2 - 0.08))
      if (previous) {
        const center = previous.clone().lerp(point, 0.5)
        const atGangway = item.boarding && center.z > item.boarding[1] && Math.abs(center.x - item.boarding[0]) < 0.88 && Math.abs(center.z - item.boarding[1]) < 2.3
        if (!atGangway) {
          const dx = point.x - previous.x
          const dz = point.z - previous.z
          rails.push({ p: [center.x, 0.83, center.z], s: [Math.hypot(dx, dz) + 0.07, 1.18, 0.18], r: [0, -Math.atan2(dz, dx), 0] })
        }
      }
      previous = point
    }
  }
  const end = curve.getPointAt(1)
  const tangent = curve.getTangentAt(1)
  const yaw = Math.atan2(tangent.x, tangent.z)
  const endSegments = item.dockAtEnd ? [[-width / 2, -0.75], [0.75, width / 2]] : [[-width / 2, width / 2]]
  for (const [from, to] of endSegments) {
    const middle = (from + to) / 2
    rails.push({ p: [end.x + tangent.z * middle, 0.83, end.z - tangent.x * middle],
      s: [to - from, 1.18, 0.18], r: [0, yaw, 0] })
  }
  return rails
}

function gardenBridgeHeight(t) {
  return 0.20 + t * 0.215 + Math.sin(t * Math.PI) * 0.58
}

function gardenBridgeRails(item, curve, decorative = false) {
  const parts = []
  const width = item.width ?? 3
  const count = Math.ceil(curve.getLength() / 0.62)
  // The bridge rises along its deck while the dressed railing and collision follow both edges.
  for (const side of [-1, 1]) {
    const along = (index) => {
      const t = index / count
      const point = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t)
      point.x -= tangent.z * side * (width / 2 - 0.09)
      point.z += tangent.x * side * (width / 2 - 0.09)
      point.y = gardenBridgeHeight(t)
      return point
    }
    for (let i = 0; i < count; i += 1) {
      const a = along(i), b = along(i + 1)
      const dx = b.x - a.x, dz = b.z - a.z
      if (!decorative) {
        parts.push({ p: [(a.x + b.x) / 2, (a.y + b.y) / 2 + 0.48, (a.z + b.z) / 2],
          s: [Math.hypot(dx, dz) + 0.055, 0.98, 0.14], r: [0, -Math.atan2(dz, dx), 0] })
        continue
      }
      const beam = (y0, y1, thickness, color) => {
        const dy = b.y + y1 - a.y - y0
        parts.push({ p: [(a.x + b.x) / 2, (a.y + b.y + y0 + y1) / 2, (a.z + b.z) / 2],
          s: [Math.hypot(dx, dz, dy) + 0.034, thickness, thickness],
          r: [0, -Math.atan2(dz, dx), Math.atan2(dy, Math.hypot(dx, dz)), 'YXZ'], c: color })
      }
      beam(0.84, 0.84, 0.085, '#e3dfcc')
      beam(0.19, 0.19, 0.083, '#d2cbbb')
      beam(0.21, 0.78, 0.044, '#d4d0bc')
      beam(0.79, 0.22, 0.044, '#e0ddcd')
      parts.push({ p: [a.x, a.y + 0.46, a.z], s: [0.103, 0.90, 0.11], c: '#b5ad9a' })
      if (i === count - 1) {
        parts.push({ p: [b.x, b.y + 0.46, b.z], s: [0.12, 0.91, 0.12], c: '#b5ad9a' })
      }
    }
  }
  if (decorative) for (const t of [0.28, 0.72]) {
    const p = curve.getPointAt(t)
    const height = gardenBridgeHeight(t) - 0.17
    parts.push({ p: [p.x, height / 2, p.z], s: [0.22, height, width * 0.84], c: '#aaa591' })
  }
  return parts
}

function lookoutHeight(item, length, distance) {
  const grade = Math.min(1, distance / (length - item.lookout.landing))
  return 0.12 + item.lookout.rise * grade
}

function lookoutRails(item, curve) {
  const length = curve.getLength()
  const start = length - item.lookout.landing
  const height = lookoutHeight(item, length, length)
  const mid = curve.getPointAt((start + length) / (2 * length))
  const end = curve.getPointAt(1)
  return [
    ...[-1, 1].map(side => ({ p: [mid.x, height + 0.39, mid.z + side * item.width / 2],
      s: [item.lookout.landing, 0.78, 0.12] })),
    { p: [end.x, height + 0.39, end.z], s: [0.12, 0.78, item.width] },
  ]
}

function LookoutSteps({ item, rails }) {
  const steps = useMemo(() => {
    const curve = breakwaterCurve(item)
    const length = curve.getLength()
    const run = length - item.lookout.landing
    const count = Math.ceil(item.lookout.rise / 0.145)
    const tread = run / count
    return Array.from({ length: count }, (_, index) => {
      const point = curve.getPointAt((index + 0.5) * tread / length)
      const h = lookoutHeight(item, length, (index + 1) * tread)
      return { p: [point.x, h / 2, point.z], s: [tread, h, item.width],
        c: index % 3 === 0 ? '#b5aa96' : '#cec2ab' }
    })
  }, [item])
  const [endX, endZ] = item.points.at(-1)
  const platformHeight = item.lookout.rise + 0.12
  return (
    <>
      <Box p={[endX - item.lookout.landing / 2, platformHeight / 2, endZ]}
        s={[item.lookout.landing, platformHeight, item.width]} c="#c9bca5" />
      <Instances geometry={GEO.box} material={mat('#ffffff')} items={steps} />
      <Instances geometry={GEO.box} material={mat('#a08360')} items={rails} />
      <Box p={[endX - 1.04, item.lookout.rise + 0.33, endZ + item.width * 0.29]}
        s={[0.48, 0.43, 1.16]} c={WOOD_DECK} />
    </>
  )
}

// ── 방파제 (style: "hjBreakwater") — item.points [[x,z],...] 따라 콘크리트 길 + 양옆 테트라포드 돌
// item.clearStart: 시작부터 이 길이(m)만큼은 테트라포드를 두지 않음 (입구가 트이게)
export function HjBreakwater({ item }) {
  const width = item.width ?? 3
  const clearStart = item.clearStart ?? 0
  const { deck, rocks, rails } = useMemo(() => {
    const curve = breakwaterCurve(item)
    const length = curve.getLength()
    const count = Math.max(2, Math.round(length / 1.2))
    const rockList = []
    let seed = 11
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i <= count; i += 1) {
      const t = i / count
      const p = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const normal = new THREE.Vector3(-tan.z, 0, tan.x)
      if (item.promenade || item.lookout || item.gardenBridge || t * length < clearStart || (item.dockAtEnd && t * length > length - 2)) continue
      for (const side of [-1, 1]) {
        const off = side * (width / 2 + 0.5 + rand() * 0.5)
        const x = p.x + normal.x * off
        const z = p.z + normal.z * off
        if (item.boarding && z > item.boarding[1] && Math.abs(x - item.boarding[0]) < 2.4 && z - item.boarding[1] < 3.6) continue
        rockList.push({
          x,
          z,
          s: 0.55 + rand() * 0.45,
          r: rand() * Math.PI,
        })
      }
    }
    return { deck: item.lookout ? null : deckGeometry(curve, length, width, item),
      rocks: rockList, rails: item.gardenBridge ? gardenBridgeRails(item, curve, true) : breakwaterRails(item, curve) }
  }, [item, width, clearStart])

  // 돌 무늬 한 장 = 2m (UV를 m 단위로 만들어서 반복 0.5)
  const stone = useMemo(() => getTiledTexture('stone', 0.5, 0.5), [])
  if (item.lookout) return <LookoutSteps item={item} rails={rails} />

  return (
    <group>
      <mesh geometry={deck.top} receiveShadow>
        <meshStandardMaterial map={stone} color="#d8d2c8" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={deck.sides}>
        <meshStandardMaterial color="#9d968b" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {item.gardenBridge
        ? <Instances geometry={GEO.box} material={mat('#ffffff')} items={rails} />
        : <HarborRails boxes={rails} />}
      {rocks.map((r, i) => (
        <mesh key={`r${i}`} position={[r.x, 0.3, r.z]} rotation={[r.r, r.r * 2, 0]} scale={r.s}>
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color={i % 3 ? '#8f8b84' : '#a7a29a'} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// 방파제 바닥을 곡선을 따라 끊김 없는 한 장으로 만듦 (윗면 + 양옆 벽)
// 시작 RAMP m 동안은 입구 돌길 높이(0.14)에서 방파제 높이(0.24)로 완만하게 올라감
const DECK_H = 0.24
const RAMP_START_H = 0.14
const RAMP = 2.5
function deckGeometry(curve, length, width, item) {
  const samples = Math.max(16, Math.round(length * 2))
  const top = []
  const topUv = []
  const side = []
  const topIdx = []
  const sideIdx = []
  let dist = 0
  let prev = null
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
    if (prev) dist += p.distanceTo(prev)
    prev = p
    const k = Math.min(1, dist / RAMP)
    const h = item.gardenBridge ? gardenBridgeHeight(t) : item.lookout
      ? lookoutHeight(item, length, t * length)
      : item.promenade ? RAMP_START_H + (DECK_H - RAMP_START_H) * (k * k * (3 - 2 * k)) : DECK_H
    const l = p.clone().addScaledVector(n, -width / 2)
    const r = p.clone().addScaledVector(n, width / 2)
    top.push(l.x, h, l.z, r.x, h, r.z)
    topUv.push(-width / 2, dist, width / 2, dist)
    const base = item.gardenBridge ? h - 0.18 : item.promenade || item.lookout ? 0 : -1.2
    side.push(l.x, h, l.z, l.x, base, l.z, r.x, h, r.z, r.x, base, r.z)
    if (i < samples) {
      const a = i * 2
      topIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      const s = i * 4
      sideIdx.push(s, s + 4, s + 1, s + 1, s + 4, s + 5) // 왼쪽 벽
      sideIdx.push(s + 2, s + 3, s + 6, s + 3, s + 7, s + 6) // 오른쪽 벽
    }
  }
  const topGeo = new THREE.BufferGeometry()
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(top, 3))
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2))
  topGeo.setIndex(topIdx)
  topGeo.computeVertexNormals()
  // 윗면이 위를 보도록 (감김 방향이 반대면 노멀이 아래로 감 → 뒤집기)
  if (topGeo.attributes.normal.getY(0) < 0) {
    topGeo.setIndex(topIdx.map((_, j) => topIdx[j - (j % 3) + [0, 2, 1][j % 3]]))
    topGeo.computeVertexNormals()
  }
  const sideGeo = new THREE.BufferGeometry()
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(side, 3))
  sideGeo.setIndex(sideIdx)
  sideGeo.computeVertexNormals()
  return { top: topGeo, sides: sideGeo }
}

// ── 등대 (style: "hjLighthouse") — size [지름, 높이, -]. 빨강·흰 줄무늬 + 도는 불빛
function LighthouseFoam() {
  const foam = useRef(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    foam.current.children.forEach((wave, index) => {
      const phase = (t * 0.36 + index * 0.32) % 1
      wave.scale.setScalar(0.68 + phase * 0.76)
      wave.material.opacity = Math.sin(phase * Math.PI) * 0.54
    })
  })
  return (
    <group ref={foam} position={[-2.05, -0.175, 0.65]}>
      {[1.25, 1.48, 1.74].map((radius, index) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 1.25 + index * 0.29]}
          position-y={index * 0.004} userData={{ noShadow: true }}>
          <ringGeometry args={[radius - 0.09, radius, 42, 1, 0, Math.PI * 1.12]} />
          <meshBasicMaterial color="#e2f8ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export function HjLighthouse({ item }) {
  const [diameter, h] = item.size
  const r = diameter / 2
  const beamRef = useRef(null)
  const lampRef = useRef(null)
  const bands = 5
  const towerH = h * 0.72
  useFrame(({ clock }, delta) => {
    if (beamRef.current) beamRef.current.rotation.y += delta * 0.9
    if (lampRef.current) lampRef.current.emissiveIntensity = 2 + Math.sin(clock.elapsedTime * 3) * 0.6
  })
  return (
    <group>
      {item.foam && <LighthouseFoam />}
      {/* 바닥 받침 */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[r * 1.5, r * 1.7, 0.8, 20]} />
        <meshStandardMaterial color="#b9b3a8" roughness={0.95} />
      </mesh>
      {/* 줄무늬 탑 */}
      {Array.from({ length: bands }, (_, i) => {
        const y0 = 0.8 + (towerH / bands) * i
        const rb = r * (1 - (i / bands) * 0.25)
        const rt = r * (1 - ((i + 1) / bands) * 0.25)
        return (
          <mesh key={i} position={[0, y0 + towerH / bands / 2, 0]}>
            <cylinderGeometry args={[rt, rb, towerH / bands, 20]} />
            <meshStandardMaterial color={i % 2 ? '#f5f1ea' : '#c8352b'} roughness={0.6} />
          </mesh>
        )
      })}
      {/* 난간 테라스 */}
      <mesh position={[0, 0.8 + towerH + 0.08, 0]}>
        <cylinderGeometry args={[r * 1.05, r * 1.05, 0.16, 20]} />
        <meshStandardMaterial color="#2c2a29" />
      </mesh>
      {/* 등실 (유리 + 불빛) */}
      <mesh position={[0, 0.8 + towerH + 0.65, 0]}>
        <cylinderGeometry args={[r * 0.55, r * 0.55, 1, 16]} />
        <meshStandardMaterial ref={lampRef} color="#fff6d6" emissive="#ffd27a" emissiveIntensity={2} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.8 + towerH + 1.35, 0]}>
        <coneGeometry args={[r * 0.75, 0.6, 16]} />
        <meshStandardMaterial color="#c8352b" />
      </mesh>
      {/* 도는 불빛 줄기 (반투명 원뿔) */}
      <group ref={beamRef} position={[0, 0.8 + towerH + 0.65, 0]}>
        <mesh position={[0, 0, 4]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[1.2, 8, 16, 1, true]} />
          <meshBasicMaterial color="#fff1c2" transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <pointLight position={[0, 0.8 + towerH + 0.65, 0]} color="#ffd27a" intensity={6} distance={10} decay={2} />
    </group>
  )
}

function mooredBoatBoxes({ size: [length, h, beam] }) {
  const deckTop = h * 0.5 + 0.04
  const boardingX = 0.65
  const gangwayRun = 1.6
  const highZ = -beam * 0.475 + 0.15
  const rise = deckTop - 0.24
  const slope = -Math.atan2(rise, gangwayRun)
  const midZ = highZ - gangwayRun / 2
  const midY = (deckTop + 0.24) / 2
  const ramp = { p: [boardingX, midY - 0.055, midZ], s: [1.35, 0.12, Math.hypot(rise, gangwayRun)], r: [slope, 0, 0] }
  const rails = [-1, 1].map((side) => ({
    p: [boardingX + side * 0.66, midY + 0.45, midZ],
    s: [0.10, 0.89, ramp.s[2]], r: ramp.r,
  }))
  const sideZ = beam * 0.455
  const endX = length * 0.46
  const railY = deckTop + 0.42
  const opening = 0.72
  rails.push(
    { p: [0, railY, sideZ], s: [endX * 2, 0.86, 0.13] },
    ...[[-endX, boardingX - opening], [boardingX + opening, endX]].map(([a, b]) => ({
      p: [(a + b) / 2, railY, -sideZ], s: [b - a, 0.86, 0.13],
    })),
    ...[-1, 1].map((side) => ({ p: [side * endX, railY, 0], s: [0.13, 0.86, beam * 0.91] })),
  )
  const cabinLength = length * 0.32
  const cabinWidth = beam * 0.72
  const cabinHeight = 2.05
  const cabinX = -length * 0.19
  const cabinY = deckTop + cabinHeight / 2
  return {
    ramp,
    rails,
    deck: { p: [0, h * 0.5, 0], s: [length * 0.95, 0.08, beam * 0.95] },
    cabin: [
      { p: [cabinX - cabinLength / 2, cabinY, 0], s: [0.12, cabinHeight, cabinWidth] },
      ...[-1, 1].map((side) => ({
        p: [cabinX, cabinY, side * cabinWidth / 2], s: [cabinLength, cabinHeight, 0.12],
      })),
      { p: [cabinX, deckTop + cabinHeight + 0.04, 0], s: [cabinLength + 0.2, 0.16, cabinWidth + 0.22] },
    ],
  }
}

// [3. 개발 > 물리] 화면과 같은 바닥·난간 좌표를 사용하고, 선착장 통로만 열어 둬요.
export function HjHarborCollider({ item }) {
  const { boxes, surface } = useMemo(() => {
    if (item.style === 'hjSea') return { boxes: item.wall === false ? [] : seaRails(item) }
    if (item.style === 'hjBoat') {
      const { deck, cabin, ramp, rails } = mooredBoatBoxes(item)
      return { boxes: [deck, ramp, ...rails, ...cabin] }
    }
    const curve = breakwaterCurve(item)
    const { top, sides } = deckGeometry(curve, curve.getLength(), item.width ?? 3, item)
    const surface = [top.attributes.position.array, new Uint32Array(top.index.array)]
    top.dispose()
    sides.dispose()
    return { boxes: breakwaterRails(item, curve), surface }
  }, [item])

  return (
    <RigidBody type="fixed" colliders={false} name={`${item.id}/harbor-colliders`}
      position={[item.position[0], item.elevation ?? 0, item.position[1]]}
      rotation={[0, THREE.MathUtils.degToRad(item.rotationDeg ?? 0), 0]}>
      {surface && <TrimeshCollider args={surface} />}
      {boxes.map(({ p, s, r }, index) => <CuboidCollider key={index} position={p} rotation={r} args={s.map((length) => length / 2)} />)}
    </RigidBody>
  )
}

// ── 고깃배 (style: "hjBoat") — 정박한 배에는 걸어서 오를 수 있어요.
export function HjBoat({ item }) {
  const [length, h, beam] = item.size
  const ref = useRef(null)
  const phase = (item.id?.length ?? 3) * 0.7
  const moored = useMemo(() => item.moored ? mooredBoatBoxes(item) : null, [item])
  useFrame(({ clock }) => {
    if (!ref.current || moored) return
    const t = clock.elapsedTime + phase
    ref.current.position.y = Math.sin(t * 1.3) * 0.08
    ref.current.rotation.z = Math.sin(t * 0.9) * 0.04
    ref.current.rotation.x = Math.cos(t * 1.1) * 0.03
  })
  const hull = item.color ?? '#24476b'
  return (
    <group ref={ref}>
      {/* 선체: 뱃머리가 좁아지는 모양 */}
      <mesh position={[0, h * 0.25, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, beam / (h * 0.9)]}>
        <cylinderGeometry args={[h * 0.45, h * 0.3, length, 4, 1]} />
        <meshStandardMaterial color={hull} roughness={0.6} />
      </mesh>
      <mesh position={[length * 0.48, h * 0.32, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, beam / (h * 0.9)]}>
        <coneGeometry args={[h * 0.45, length * 0.25, 4]} />
        <meshStandardMaterial color={hull} roughness={0.6} />
      </mesh>
      <mesh position={[0, h * 0.5, 0]}>
        <boxGeometry args={[length * 0.95, 0.08, beam * 0.95]} />
        <meshStandardMaterial color="#e9e4d8" />
      </mesh>
      {moored && (
        <>
          <Box p={moored.ramp.p} s={moored.ramp.s} r={moored.ramp.r} c={WOOD_DECK} />
          <Instances geometry={GEO.box} material={mat('#554438')} items={moored.rails} />
          <Instances geometry={GEO.box} material={mat('#f5f1ea')} items={moored.cabin} />
        </>
      )}
      {/* 조타실 */}
      {!moored && <mesh position={[-length * 0.15, h * 0.85, 0]}>
        <boxGeometry args={[length * 0.3, h * 0.6, beam * 0.7]} />
        <meshStandardMaterial color="#f5f1ea" />
      </mesh>}
      {!moored && <mesh position={[-length * 0.15, h * 0.95, beam * 0.36]}>
        <planeGeometry args={[length * 0.22, h * 0.22]} />
        <meshStandardMaterial color="#3d5a73" />
      </mesh>}
      {/* 돛대 + 깃발 */}
      <mesh position={[length * 0.12, h * 1.3, 0]}>
        <cylinderGeometry args={[0.04, 0.05, h * 1.6, 6]} />
        <meshStandardMaterial color="#2c2a29" />
      </mesh>
      <mesh position={[length * 0.12 + 0.25, h * 1.95, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial color="#c8352b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
