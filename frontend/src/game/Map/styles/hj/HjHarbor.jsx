import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getTiledTexture } from '../textures.js'

// [3. 개발 > 기초개발/서비스] 혜진 구역 바닷가: 바다 · 방파제 · 등대 · 고깃배
// 촬영지 '방파제 & 등대' (가상 영화 「등대가 켜지면」)

// ── 바다 (style: "hjSea") — size [가로, -, 세로]. 잔잔한 물결이 움직여요. 충돌 없음.
export function HjSea({ item }) {
  const [w, , d] = item.size
  const ref = useRef(null)
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d, Math.ceil(w / 1.5), Math.ceil(d / 1.5))
    g.rotateX(-Math.PI / 2)
    return g
  }, [w, d])
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry])

  useFrame(({ clock }) => {
    const pos = ref.current?.geometry.attributes.position
    if (!pos) return
    const t = clock.elapsedTime
    for (let i = 0; i < pos.count; i += 1) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      pos.setY(i, Math.sin(x * 0.45 + t * 1.2) * 0.05 + Math.cos(z * 0.38 + t * 0.9) * 0.05)
    }
    pos.needsUpdate = true
  })

  return (
    <group>
      {/* 바닥이 비치지 않게 깊은 물색 판 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#1f4f7a" />
      </mesh>
      <mesh ref={ref} geometry={geometry} position={[0, 0.06, 0]}>
        <meshStandardMaterial color="#3d84b8" transparent opacity={0.88} roughness={0.25} metalness={0.15} />
      </mesh>
      {/* 육지 쪽 둑 (item.openings 구간은 비워서 방파제로 걸어 들어갈 수 있게) */}
      {item.wall !== false &&
        wallSegments(d, item.openings).map(([from, to]) => (
          <mesh key={from} position={[-w / 2 + 0.4, 0.45, (from + to) / 2]}>
            <boxGeometry args={[0.8, 0.9, to - from]} />
            <meshStandardMaterial color="#a39e94" roughness={0.95} />
          </mesh>
        ))}
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

// ── 방파제 (style: "hjBreakwater") — item.points [[x,z],...] 따라 콘크리트 길 + 양옆 테트라포드 돌
// item.clearStart: 시작부터 이 길이(m)만큼은 테트라포드를 두지 않음 (입구가 트이게)
export function HjBreakwater({ item }) {
  const width = item.width ?? 3
  const clearStart = item.clearStart ?? 0
  const { deck, rocks } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3((item.points ?? []).map(([x, z]) => new THREE.Vector3(x, 0, z)))
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
      if (t * length < clearStart) continue // 입구 쪽은 돌 없이 비워 둠
      for (const side of [-1, 1]) {
        const off = side * (width / 2 + 0.5 + rand() * 0.5)
        rockList.push({
          x: p.x + normal.x * off,
          z: p.z + normal.z * off,
          s: 0.55 + rand() * 0.45,
          r: rand() * Math.PI,
        })
      }
    }
    return { deck: deckGeometry(curve, length, width), rocks: rockList }
  }, [item.points, width, clearStart])

  // 돌 무늬 한 장 = 2m (UV를 m 단위로 만들어서 반복 0.5)
  const stone = useMemo(() => getTiledTexture('stone', 0.5, 0.5), [])

  return (
    <group>
      <mesh geometry={deck.top} receiveShadow>
        <meshStandardMaterial map={stone} color="#d8d2c8" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={deck.sides}>
        <meshStandardMaterial color="#9d968b" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
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
function deckGeometry(curve, length, width) {
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
    const h = RAMP_START_H + (DECK_H - RAMP_START_H) * (k * k * (3 - 2 * k)) // 부드러운 경사
    const l = p.clone().addScaledVector(n, -width / 2)
    const r = p.clone().addScaledVector(n, width / 2)
    top.push(l.x, h, l.z, r.x, h, r.z)
    topUv.push(-width / 2, dist, width / 2, dist)
    // 양옆 벽: 위(h) ~ 바닥(0)
    side.push(l.x, h, l.z, l.x, 0, l.z, r.x, h, r.z, r.x, 0, r.z)
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

// ── 고깃배 (style: "hjBoat") — size [길이, 높이, 폭]. 물 위에서 살짝 흔들려요. 충돌 없음.
export function HjBoat({ item }) {
  const [length, h, beam] = item.size
  const ref = useRef(null)
  const phase = (item.id?.length ?? 3) * 0.7
  useFrame(({ clock }) => {
    if (!ref.current) return
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
      {/* 조타실 */}
      <mesh position={[-length * 0.15, h * 0.85, 0]}>
        <boxGeometry args={[length * 0.3, h * 0.6, beam * 0.7]} />
        <meshStandardMaterial color="#f5f1ea" />
      </mesh>
      <mesh position={[-length * 0.15, h * 0.95, beam * 0.36]}>
        <planeGeometry args={[length * 0.22, h * 0.22]} />
        <meshStandardMaterial color="#3d5a73" />
      </mesh>
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
