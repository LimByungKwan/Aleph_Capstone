import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { currentTarget, useCourseStore } from '../../store/courseStore.js'
import { labelLayer } from '../labelLayer.js'
import { playerPose } from '../../store/playerPose.js'

// 루미 추천 코스의 "다음 목적지" 표시 (담당: 병관)
// 멀리서도 보이는 빛기둥 + 위아래로 움직이는 화살표 + 이름표. 도착하면 다음 장소로 옮겨감 (courseStore)

const COLOR = '#ff6fa3'
const BEAM_HEIGHT = 60

export default function CourseMarker() {
  const target = useCourseStore(currentTarget)
  const index = useCourseStore((s) => s.index)
  return (
    <>
      <PlayerPoseTracker />
      {target && <Marker key={`${target.placeId}-${index}`} target={target} step={index + 1} />}
    </>
  )
}

// 미니맵용: 캐릭터(Ecctrl name="player") 위치와 카메라 방향을 playerPose에 적어 둠
const tmpPos = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
function PlayerPoseTracker() {
  const scene = useThree((s) => s.scene)
  const player = useRef(null)
  const frame = useRef(0)
  useFrame(({ camera }) => {
    // 캐릭터를 아직 못 찾았으면 30프레임마다 한 번만 찾기 (장면 전체를 훑는 일이라)
    if (!player.current?.parent && frame.current++ % 30 === 0) player.current = scene.getObjectByName('player') ?? null
    camera.getWorldDirection(tmpDir)
    const len = Math.hypot(tmpDir.x, tmpDir.z)
    if (len > 1e-3) {
      playerPose.dirX = tmpDir.x / len
      playerPose.dirZ = tmpDir.z / len
    }
    if (!player.current) {
      playerPose.ready = false
      return
    }
    player.current.getWorldPosition(tmpPos)
    playerPose.ready = true
    playerPose.x = tmpPos.x
    playerPose.z = tmpPos.z
  })
  return null
}

function Marker({ target, step }) {
  const arrow = useRef()
  const beam = useRef()
  const [x, y, z] = target.position

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (arrow.current) {
      arrow.current.position.y = 4.6 + Math.sin(t * 3) * 0.35
      arrow.current.rotation.y = t * 1.5
    }
    if (beam.current) beam.current.material.opacity = 0.16 + Math.sin(t * 2) * 0.05
  })

  return (
    <group position={[x, y, z]}>
      {/* 빛기둥 (안개·밤에도 잘 보이게 조명·안개 영향 없이) */}
      <mesh ref={beam} position={[0, BEAM_HEIGHT / 2, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.55, 0.55, BEAM_HEIGHT, 20, 1, true]} />
        <meshBasicMaterial color={COLOR} transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} fog={false} toneMapped={false} />
      </mesh>
      {/* 바닥 고리 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <ringGeometry args={[1.1, 1.45, 40]} />
        <meshBasicMaterial color={COLOR} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* 아래를 가리키는 화살표 */}
      <mesh ref={arrow} position={[0, 4.6, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.55, 1.1, 4]} />
        <meshBasicMaterial color={COLOR} toneMapped={false} />
      </mesh>
      <Html portal={labelLayer} position={[0, 6, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: COLOR,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {step}. {target.name}
        </div>
      </Html>
    </group>
  )
}
