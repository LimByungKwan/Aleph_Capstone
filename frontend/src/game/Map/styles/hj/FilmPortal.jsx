import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePortalStore } from '../../../../components/movieZone/portalStore.js'
import { seeded } from '../kit.jsx'
import { layout } from '../../../data/mapData.js'
import { getSwirlTexture } from './hjTextures.js'
import { WarpBooth } from './HjTimeDistrict.jsx'

// [3. 개발 > 기초개발/서비스] '영화 속으로 입장' 포털 (혜진 구역 전용 style: "filmPortal")
// - 바닥에 빛나는 원 + 천천히 도는 소용돌이
// - 캐릭터(이름 "player")가 원 안에 들어오면 portalStore에 알려서 화면 연출(레터박스)을 띄움
//   → 팀 공용 센서·gameStore를 건드리지 않고 이 구역 안에서만 동작해요.
// size [지름, -, 지름], item.portal = { title, work, synopsis, points[] }
const FIND_PLAYER_EVERY = 0.5 // 초. 캐릭터가 아직 없으면(둘러보기 모드) 가끔만 다시 찾음

function BoothVortex({ radius }) {
  const rings = useRef(null)
  const particles = useRef(null)
  const { paths, seeds, positions } = useMemo(() => {
    const rng = seeded(2030)
    const paths = [0, 1, 2].map((strand) => new THREE.CatmullRomCurve3(
      Array.from({ length: 41 }, (_, i) => {
        const t = i / 40
        const angle = t * Math.PI * 4 + strand * Math.PI * 2 / 3
        const r = radius * (0.69 + t * 0.21)
        return new THREE.Vector3(Math.cos(angle) * r, 0.23 + t * 2.9, Math.sin(angle) * r)
      }),
    ))
    const seeds = Array.from({ length: 84 }, () => [rng(), rng(), rng()])
    return { paths, seeds, positions: new Float32Array(seeds.length * 3) }
  }, [radius])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    rings.current.rotation.y = t * 0.86
    seeds.forEach(([phase, spread, speed], index) => {
      const rise = (phase + t * (0.24 + speed * 0.19)) % 1
      const angle = phase * 41 + t * 1.8 + rise * 4.3
      const r = radius * (0.65 + spread * 0.37)
      positions[index * 3] = Math.cos(angle) * r
      positions[index * 3 + 1] = 0.12 + rise * 3.85
      positions[index * 3 + 2] = Math.sin(angle) * r
    })
    particles.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <>
      <group ref={rings}>
        {paths.map((path, index) => (
          <mesh key={index} userData={{ noShadow: true }}>
            <tubeGeometry args={[path, 72, 0.036 - index * 0.005, 5]} />
            <meshBasicMaterial color={['#44c5ff', '#815aff', '#b79dff'][index]} transparent opacity={0.8}
              depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <points ref={particles} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} usage={THREE.DynamicDrawUsage} />
        </bufferGeometry>
        <pointsMaterial color="#a6caff" size={0.061} transparent opacity={0.88}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </>
  )
}

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
  const portalInfo = useMemo(() => {
    const destination = item.warpEra && layout.props.find((prop) =>
      prop.zone === 'HJ' && prop.warpEra && prop.warpEra !== item.warpEra)
    const warpDestination = destination ? {
      label: destination.warpEra,
      position: [
        destination.position[0] + Math.sin(THREE.MathUtils.degToRad(destination.rotationDeg ?? 0)) * 2.4,
        1.1,
        destination.position[1] + Math.cos(THREE.MathUtils.degToRad(destination.rotationDeg ?? 0)) * 2.4,
      ],
    } : null
    return { id: item.id, ...item.portal, warpHub: item.warpHub, warpDestination }
  }, [item])
  const playerPosition = useMemo(() => new THREE.Vector3(), [])

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
    player.getWorldPosition(playerPosition)
    groupRef.current.worldToLocal(playerPosition)
    const { x, y, z } = playerPosition
    const inside = item.warpHub
      ? Math.abs(x) < 0.5 && z > -0.46 && z < 0.36 && y > 0 && y < 2.55
      : Math.hypot(x, z) < radius
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
      {item.warpHub && <><WarpBooth radius={radius} /><BoothVortex radius={radius} /></>}
    </group>
  )
}
