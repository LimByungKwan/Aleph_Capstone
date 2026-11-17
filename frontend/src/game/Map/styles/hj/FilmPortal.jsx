import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePortalStore } from '../../../../components/movieZone/portalStore.js'
import { getFilmStripTexture, getSwirlTexture } from './hjTextures.js'

// [3. 개발 > 기초개발/서비스] '영화 속으로 입장' 포털 (혜진 구역 전용 style: "filmPortal")
// - 바닥에 빛나는 원 + 천천히 도는 소용돌이 + 공중에 도는 필름 띠 + 떠오르는 빛 알갱이
// - 캐릭터(이름 "player")가 원 안에 들어오면 portalStore에 알려서 화면 연출(레터박스)을 띄움
//   → 팀 공용 센서·gameStore를 건드리지 않고 이 구역 안에서만 동작해요.
// size [지름, -, 지름], item.portal = { title, work, synopsis, points[] }
const SPARKS = 16
const FIND_PLAYER_EVERY = 0.5 // 초. 캐릭터가 아직 없으면(둘러보기 모드) 가끔만 다시 찾음

export default function FilmPortal({ item }) {
  const radius = item.size[0] / 2
  const scene = useThree((state) => state.scene)
  const groupRef = useRef(null)
  const swirlRef = useRef(null)
  const stripRef = useRef(null)
  const ringMatRef = useRef(null)
  const sparkRefs = useRef([])
  const playerRef = useRef(null)
  const lastLookup = useRef(-Infinity)
  const insideRef = useRef(false)

  const swirl = getSwirlTexture()
  const strip = useMemo(() => {
    const base = getFilmStripTexture()
    if (!base) return null
    const t = base.clone()
    t.repeat.set(3, 1)
    t.needsUpdate = true
    return t
  }, [])

  const sparks = useMemo(
    () =>
      Array.from({ length: SPARKS }, (_, i) => ({
        angle: (i / SPARKS) * Math.PI * 2,
        r: radius * (0.3 + ((i * 37) % 10) / 14),
        speed: 0.35 + ((i * 13) % 7) / 10,
        offset: (i * 0.37) % 1,
      })),
    [radius],
  )

  const portalInfo = useMemo(() => ({ id: item.id, ...(item.portal ?? {}) }), [item.id, item.portal])
  const tmp = useMemo(() => ({ me: new THREE.Vector3(), them: new THREE.Vector3() }), [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (swirlRef.current) swirlRef.current.rotation.z -= delta * 0.6
    if (stripRef.current) stripRef.current.rotation.y += delta * 0.35
    if (ringMatRef.current) ringMatRef.current.emissiveIntensity = 1.4 + Math.sin(t * 2.2) * 0.4
    sparkRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const s = sparks[i]
      const life = (t * s.speed * 0.25 + s.offset) % 1
      const a = s.angle + t * 0.4
      mesh.position.set(Math.cos(a) * s.r, 0.2 + life * 2.6, Math.sin(a) * s.r)
      mesh.scale.setScalar(1 - life * 0.8)
    })

    // ── 캐릭터 감지 ──
    if (!playerRef.current?.parent && t - lastLookup.current > FIND_PLAYER_EVERY) {
      lastLookup.current = t
      playerRef.current = scene.getObjectByName('player') ?? null
    }
    const player = playerRef.current
    if (!player?.parent || !groupRef.current) {
      if (insideRef.current) {
        insideRef.current = false
        usePortalStore.getState().leave(portalInfo.id)
      }
      return
    }
    groupRef.current.getWorldPosition(tmp.me)
    player.getWorldPosition(tmp.them)
    const inside = Math.hypot(tmp.them.x - tmp.me.x, tmp.them.z - tmp.me.z) < radius
    if (inside !== insideRef.current) {
      insideRef.current = inside
      if (inside) usePortalStore.getState().enter(portalInfo)
      else usePortalStore.getState().leave(portalInfo.id)
    }
  })

  return (
    <group ref={groupRef}>
      {/* 바닥: 빛나는 테두리 + 소용돌이 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <torusGeometry args={[radius, 0.07, 10, 64]} />
        <meshStandardMaterial ref={ringMatRef} color="#ffe2b5" emissive="#e8925f" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <mesh ref={swirlRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <circleGeometry args={[radius * 0.97, 48]} />
        <meshBasicMaterial map={swirl} color={swirl ? '#ffffff' : '#f2b48c'} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* 공중에 도는 필름 띠 */}
      <mesh ref={stripRef} position={[0, 1.9, 0]}>
        <cylinderGeometry args={[radius * 0.85, radius * 0.85, 0.32, 48, 1, true]} />
        <meshStandardMaterial map={strip} color={strip ? '#ffffff' : '#1f1b18'} side={THREE.DoubleSide} emissive="#c86d51" emissiveIntensity={0.15} />
      </mesh>

      {/* 떠오르는 빛 알갱이 */}
      {sparks.map((_, i) => (
        <mesh key={i} ref={(m) => (sparkRefs.current[i] = m)}>
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshBasicMaterial color="#ffe9c2" toneMapped={false} />
        </mesh>
      ))}

      <pointLight position={[0, 0.8, 0]} color="#ffb47a" intensity={4} distance={5} decay={2} />
    </group>
  )
}
