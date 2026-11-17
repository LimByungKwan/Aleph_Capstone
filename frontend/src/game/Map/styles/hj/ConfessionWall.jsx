import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getRedBrickTexture } from './hjTextures.js'

// [3. 개발 > 기초개발/서비스] 촬영지 '고백 담벼락' (혜진 구역 전용 style: "confessionWall")
// 붉은 벽돌 담 + 담쟁이 + 따뜻한 전구줄(살짝 반짝임). size [가로 w, 높이 h, 두께 d], 앞면 +z.
const LEAF_COLORS = ['#4f7f3f', '#5f9a4a', '#3f6e36', '#6fa957']
const BULB_COUNT = 14

export default function ConfessionWall({ item }) {
  const [w, h, d] = item.size
  const capH = 0.18

  const brick = useMemo(() => {
    const base = getRedBrickTexture()
    if (!base) return null
    const t = base.clone()
    t.repeat.set(w / 1, (h - capH) / 1)
    t.needsUpdate = true
    return t
  }, [w, h])

  // 담쟁이: 벽 아래·옆에서 타고 올라간 잎 뭉치 (앞·뒤 양면)
  const ivy = useMemo(() => {
    const rand = mulberry(7)
    const leaves = []
    for (let i = 0; i < 46; i += 1) {
      const side = rand() < 0.65 ? 1 : -1
      const fromLeft = rand() < 0.55
      const x = fromLeft ? -w / 2 + rand() * w * 0.45 : w / 2 - rand() * w * 0.3
      const y = Math.pow(rand(), 0.7) * (h - 0.3)
      leaves.push({ x, y, z: side * (d / 2 + 0.04), s: 0.12 + rand() * 0.16, c: LEAF_COLORS[i % LEAF_COLORS.length] })
    }
    return leaves
  }, [w, h, d])

  // 전구줄: 양끝 기둥 사이에 처진 줄 + 전구
  const postH = h + 0.9
  const bulbs = useMemo(
    () =>
      Array.from({ length: BULB_COUNT }, (_, i) => {
        const t = (i + 0.5) / BULB_COUNT
        return { x: -w / 2 + t * w, y: postH - 0.1 - Math.sin(t * Math.PI) * 0.45, phase: i * 1.7 }
      }),
    [w, postH],
  )
  const wire = useMemo(() => {
    const points = Array.from({ length: 24 }, (_, i) => {
      const t = i / 23
      return new THREE.Vector3(-w / 2 + t * w, postH - 0.05 - Math.sin(t * Math.PI) * 0.45, d / 2 + 0.12)
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.012, 4)
  }, [w, d, postH])

  const bulbRefs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    bulbRefs.current.forEach((mat, i) => {
      if (mat) mat.emissiveIntensity = 1.6 + Math.sin(t * 2 + bulbs[i].phase) * 0.5
    })
  })

  return (
    <group>
      {/* 벽돌 담 */}
      <mesh position={[0, (h - capH) / 2, 0]}>
        <boxGeometry args={[w, h - capH, d]} />
        <meshStandardMaterial map={brick} color={brick ? '#ffffff' : '#a94a35'} roughness={0.95} />
      </mesh>
      {/* 담 위 갓돌 */}
      <mesh position={[0, h - capH / 2, 0]}>
        <boxGeometry args={[w + 0.12, capH, d + 0.12]} />
        <meshStandardMaterial color="#8a6f5c" roughness={0.9} />
      </mesh>

      {/* 담쟁이 */}
      {ivy.map((leaf, i) => (
        <mesh key={i} position={[leaf.x, leaf.y, leaf.z]} scale={[leaf.s, leaf.s, leaf.s * 0.45]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={leaf.c} roughness={0.95} flatShading />
        </mesh>
      ))}

      {/* 전구줄 기둥 + 줄 + 전구 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * w) / 2, postH / 2, d / 2 + 0.12]}>
          <cylinderGeometry args={[0.04, 0.05, postH, 8]} />
          <meshStandardMaterial color="#4a3a2e" roughness={0.8} />
        </mesh>
      ))}
      <mesh geometry={wire}>
        <meshStandardMaterial color="#2c2a29" />
      </mesh>
      {bulbs.map((b, i) => (
        <mesh key={i} position={[b.x, b.y - 0.07, d / 2 + 0.12]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial
            ref={(m) => (bulbRefs.current[i] = m)}
            color="#fff1c9"
            emissive="#ffc46b"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* 벽면을 은은하게 비추는 불빛 (가벼운 점광원 1개) */}
      <pointLight position={[0, h, d / 2 + 0.8]} color="#ffc98a" intensity={3} distance={6} decay={2} />
    </group>
  )
}

function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
