import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useZoneEntryStore } from '../../../../components/movieZone/zoneEntryStore.js'
import { getSignTexture } from '../textures.js'
import { getFilmStripTexture } from './hjTextures.js'

// [3. 개발 > 기초개발/서비스] 영화·드라마 구역 입구 게이트 (혜진 구역 전용 style: "hjEntranceGate")
// - 길 위에 필름 띠를 두른 아치 + 바닥에 은은하게 빛나는 입장 띠(트리거 영역)
// - 캐릭터(이름 "player")가 띠를 밟고 지나가거나, 게이트를 클릭하면 handleEnterMovieZone() 호출
//   → 팀 공용 센서·gameStore를 건드리지 않고 이 구역 안에서만 동작해요.
// size [길 폭, 아치 높이, 트리거 깊이], 앞면(+z)이 구역 안쪽. collider: false로 두기.
const FIND_PLAYER_EVERY = 0.5

export default function HjEntranceGate({ item }) {
  const [w, h, depth] = item.size
  const scene = useThree((state) => state.scene)
  const groupRef = useRef(null)
  const padMatRef = useRef(null)
  const stripRef = useRef(null)
  const playerRef = useRef(null)
  const lastLookup = useRef(-Infinity)
  const insideRef = useRef(false)
  const [hovered, setHovered] = useState(false)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  const sign = getSignTexture(item.text ?? '🎬 영화·드라마 세트장', '#2c2a29', '#f9f6ee')
  const strip = useMemo(() => {
    const base = getFilmStripTexture()
    if (!base) return null
    const t = base.clone()
    t.repeat.set(w / 2, 1)
    t.needsUpdate = true
    return t
  }, [w])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (padMatRef.current) padMatRef.current.opacity = 0.28 + Math.sin(t * 2) * 0.12
    if (stripRef.current?.map) stripRef.current.map.offset.x += delta * 0.15

    // ── 캐릭터가 입장 띠 안에 있는지 (게이트 기준 좌표로 판단) ──
    if (!playerRef.current?.parent && t - lastLookup.current > FIND_PLAYER_EVERY) {
      lastLookup.current = t
      playerRef.current = scene.getObjectByName('player') ?? null
    }
    const player = playerRef.current
    if (!player?.parent || !groupRef.current) {
      insideRef.current = false
      return
    }
    player.getWorldPosition(tmp)
    groupRef.current.worldToLocal(tmp)
    const inside = Math.abs(tmp.x) < w / 2 && Math.abs(tmp.z) < depth / 2
    if (inside && !insideRef.current) useZoneEntryStore.getState().handleEnterMovieZone()
    insideRef.current = inside
  })

  const enterByClick = (event) => {
    event.stopPropagation()
    useZoneEntryStore.getState().handleEnterMovieZone({ force: true })
  }

  return (
    <group ref={groupRef}>
      {/* 바닥 입장 띠 (트리거 영역 표시) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} onClick={enterByClick}>
        <planeGeometry args={[w, depth]} />
        <meshBasicMaterial ref={padMatRef} color="#f9f6ee" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* item.arch === false면 아치 없이 입장 띠만 (다른 입구 아치와 겹칠 때) */}
      {item.arch !== false && <Arch w={w} h={h} sign={sign} strip={strip} stripRef={stripRef} hovered={hovered} setHovered={setHovered} onClick={enterByClick} />}
    </group>
  )
}

function Arch({ w, h, sign, strip, stripRef, hovered, setHovered, onClick: enterByClick }) {
  return (
    <group>
      {/* 기둥 2개 */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (w / 2 + 0.35), h / 2, 0]}
          onClick={enterByClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[0.5, h, 0.5]} />
          <meshStandardMaterial color={hovered ? '#d98466' : '#c86d51'} roughness={0.7} />
        </mesh>
      ))}

      {/* 위 가로대: 필름 띠 + 간판 */}
      <mesh position={[0, h - 0.3, 0]} onClick={enterByClick} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <boxGeometry args={[w + 1.2, 0.7, 0.4]} />
        <meshStandardMaterial ref={stripRef} map={strip} color={strip ? '#ffffff' : '#1f1b18'} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, h + 0.45, side * 0.13]} rotation={[0, side > 0 ? 0 : Math.PI, 0]} onClick={enterByClick}>
          <planeGeometry args={[Math.min(w, 5.5), 0.75]} />
          <meshStandardMaterial map={sign} emissive="#fff1c2" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* 기둥 위 조명 */}
      {[-1, 1].map((side) => (
        <mesh key={`l${side}`} position={[side * (w / 2 + 0.35), h + 0.25, 0]}>
          <sphereGeometry args={[0.18, 12, 10]} />
          <meshStandardMaterial color="#fff1c9" emissive="#ffc46b" emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
