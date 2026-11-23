import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { PLAYER_SPAWN, PLAYER_START_FORWARD } from './Player.jsx'
import { CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE } from '../config.js'

const { ACTION } = CameraControlsImpl
const LOOK_HEIGHT = 0.6 // 캐릭터 중심보다 조금 위(머리 쪽)를 바라봄
const FEET_TO_TARGET = 0.8 + LOOK_HEIGHT // 발바닥 → 바라보는 점 높이 (캡슐 반높이 0.5 + 반지름 0.3)
const UPLOOK_GAP = 0.25 // 올려다볼 때 카메라가 땅에서 떠 있을 높이

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

    // 시작: 캐릭터 뒤에서 시작 방향(playerStartYawDeg)을 바라봄
    const [x, y, z] = PLAYER_SPAWN
    const [fx, fz] = PLAYER_START_FORWARD
    controls.setLookAt(x - fx * 4, y + 1.6, z - fz * 4, x, y + LOOK_HEIGHT, z, false)
  }, [scene])

  // SG: 하늘(폭죽)을 올려다볼 수 있게. 카메라가 캐릭터 발보다 아래로 가면 땅속이므로
  // 올려다볼수록 캐릭터 쪽으로 당겨서 땅 위(UPLOOK_GAP)에 머물게 함. 내려다볼 때 거리는 기억해 두고 되돌림
  const wantedDistance = useRef(CAMERA_MAX_DISTANCE)
  const pulledIn = useRef(false) // 이 코드가 거리를 줄여 둔 상태 (그때 거리는 사용자가 원한 값이 아님)
  useFrame(() => {
    const player = playerRef.current
    const controls = controlsRef.current
    if (!player || !controls) return
    const { x, y, z } = player.currPos
    controls.moveTo(x, y + LOOK_HEIGHT, z, true)

    const polar = controls.polarAngle
    if (!pulledIn.current) wantedDistance.current = controls.distance // 휠로 바꾼 거리 기억
    const fit = polar > Math.PI / 2 ? (FEET_TO_TARGET - UPLOOK_GAP) / -Math.cos(polar) : Infinity
    const distance = Math.max(0.3, Math.min(wantedDistance.current, fit))
    pulledIn.current = distance < wantedDistance.current
    controls.minDistance = Math.min(CAMERA_MIN_DISTANCE, distance)
    if (Math.abs(controls.distance - distance) > 0.01) controls.dollyTo(distance, false)
  })

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={CAMERA_MIN_DISTANCE}
      maxDistance={CAMERA_MAX_DISTANCE}
      maxPolarAngle={Math.PI * 0.95}
      smoothTime={0.12}
    />
  )
}
