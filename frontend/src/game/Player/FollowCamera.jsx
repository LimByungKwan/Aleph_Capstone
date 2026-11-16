import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { PLAYER_SPAWN } from './Player.jsx'
import { CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE } from '../config.js'

const { ACTION } = CameraControlsImpl
const LOOK_HEIGHT = 0.6 // 캐릭터 중심보다 조금 위(머리 쪽)를 바라봄

// 캐릭터를 따라다니는 3인칭 카메라
// - 마우스 왼쪽 드래그: 회전 / 휠: 거리 조절 (3~5m)
// - 건물(camera-blocker)에 가리면 카메라가 앞으로 당겨져 벽 뚫림을 줄임
export default function FollowCamera({ playerRef }) {
  const controlsRef = useRef(null)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    // 캐릭터를 놓치지 않게 "이동(팬)"은 끄고 회전·줌만 허용
    controls.mouseButtons.right = ACTION.NONE
    controls.mouseButtons.middle = ACTION.NONE
    controls.mouseButtons.wheel = ACTION.DOLLY
    controls.touches.two = ACTION.TOUCH_DOLLY
    controls.touches.three = ACTION.NONE

    // Colliders.jsx가 만든 건물 투명 박스를 카메라 충돌 대상으로 등록
    const blockers = []
    scene.traverse((object) => {
      if (object.name === 'camera-blocker') blockers.push(object)
    })
    controls.colliderMeshes = blockers

    // 시작: 캐릭터 뒤(서쪽)에서 골목 안쪽(동쪽)을 바라봄
    const [x, y, z] = PLAYER_SPAWN
    controls.setLookAt(x - 4, y + 1.6, z, x, y + LOOK_HEIGHT, z, false)
  }, [scene])

  useFrame(() => {
    const player = playerRef.current
    const controls = controlsRef.current
    if (!player || !controls) return
    const { x, y, z } = player.currPos
    controls.moveTo(x, y + LOOK_HEIGHT, z, true)
  })

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={CAMERA_MIN_DISTANCE}
      maxDistance={CAMERA_MAX_DISTANCE}
      maxPolarAngle={Math.PI * 0.48}
      smoothTime={0.12}
    />
  )
}
