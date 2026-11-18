import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePortalStore } from '../../../../components/movieZone/portalStore.js'
import { getSwirlTexture } from './hjTextures.js'
import { WarpBooth } from './HjTimeDistrict.jsx'

// [3. 개발 > 기초개발/서비스] '영화 속으로 입장' 포털 (혜진 구역 전용 style: "filmPortal")
// - 바닥에 빛나는 원 + 천천히 도는 소용돌이
// - 캐릭터(이름 "player")가 원 안에 들어오면 portalStore에 알려서 화면 연출(레터박스)을 띄움
//   → 팀 공용 센서·gameStore를 건드리지 않고 이 구역 안에서만 동작해요.
// size [지름, -, 지름], item.portal = { title, work, synopsis, points[] }
const FIND_PLAYER_EVERY = 0.5 // 초. 캐릭터가 아직 없으면(둘러보기 모드) 가끔만 다시 찾음

export default function FilmPortal({ item }) {
  const radius = item.size[0] / 2
  const scene = useThree((state) => state.scene)
  const groupRef = useRef(null)
  const swirlRef = useRef(null)
  const ringMatRef = useRef(null)
  const playerRef = useRef(null)
  const lastLookup = useRef(-Infinity)
  const insideRef = useRef(false)

  const swirl = getSwirlTexture()
  const portalInfo = useMemo(() => ({ id: item.id, ...(item.portal ?? {}) }), [item.id, item.portal])
  const tmp = useMemo(() => ({ me: new THREE.Vector3(), them: new THREE.Vector3() }), [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (swirlRef.current) swirlRef.current.rotation.z -= delta * 0.6
    if (ringMatRef.current) ringMatRef.current.emissiveIntensity = 1.4 + Math.sin(t * 2.2) * 0.4
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
      {item.warpHub && <WarpBooth radius={radius} />}
    </group>
  )
}
