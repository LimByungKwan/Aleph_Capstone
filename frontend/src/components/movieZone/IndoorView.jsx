import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CAMERA_MAX_DISTANCE } from '../../game/config.js'
import { indoorAt } from './palaceGuide.js'
import { usePalaceSeatStore } from './palaceSeating.js'
import { findPlayer } from '../../game/Player/findPlayer.js'

// [3. 개발 > 프론트엔드] 실내에 들어가면 1인칭 (혜진 영화·드라마 구역 · 경복궁)
// 3인칭 카메라가 벽·지붕을 뚫고 지나가 보이지 않게, 전각 안에서는 카메라를 머리 바로 뒤로 당기고
// 캐릭터 모습을 숨겨 1인칭처럼 보여요. 밖으로 나오면 원래 거리·모습으로 돌아가요.
// 안에서 의자에 앉으면 앉은 모습(다리)이 보이게 잠깐 3인칭(가까운 거리)으로 바꿔요.
const SEATED_DISTANCE = 2.2
// (공용 FollowCamera는 건드리지 않고, 기본 카메라 컨트롤의 최대 거리만 잠깐 바꿔요)
const FIRST_PERSON_DISTANCE = 0.3
const FEET_OFFSET = 1.0 // 몸통 중심 → 발

export default function IndoorView({ playerRef }) {
  const controls = useThree((s) => s.controls)
  const scene = useThree((s) => s.scene)
  const inside = useRef(null)
  const savedDistance = useRef(CAMERA_MAX_DISTANCE)
  const playerObject = useRef(null)

  // 화면을 떠날 때(컴포넌트가 사라질 때) 원래대로
  useEffect(
    () => () => {
      if (controls && inside.current) controls.maxDistance = CAMERA_MAX_DISTANCE
      if (playerObject.current) playerObject.current.visible = true
    },
    [controls],
  )

  useFrame(() => {
    const player = playerRef.current
    if (!player?.body || !controls?.dollyTo) return
    const { x, y, z } = player.body.translation()
    const seated = Boolean(usePalaceSeatStore.getState().seated)
    const area = indoorAt(x, y - FEET_OFFSET, z)
    // 인력거에 타면 1인칭 (내리면 다시 3인칭) — 인력거꾼 뒷모습과 거리를 손님 눈높이로 봐요
    const onRickshaw = /인력거/.test(usePalaceSeatStore.getState().seated?.vehicle?.label ?? '')
    // 모드: fp(1인칭) · seat(앉은 모습 보기) · null(바깥, 원래대로)
    const mode = onRickshaw ? 'fp' : area ? (seated ? 'seat' : 'fp') : null
    if (!playerObject.current) playerObject.current = findPlayer(scene)
    if (mode === inside.current) return
    if (!inside.current) savedDistance.current = Math.max(3, controls.distance)
    if (mode === 'fp') {
      controls.minDistance = FIRST_PERSON_DISTANCE // 공용 카메라가 최소 거리를 3m로 잡고 있어 같이 낮춰요
      controls.maxDistance = FIRST_PERSON_DISTANCE
      controls.dollyTo(FIRST_PERSON_DISTANCE, true)
    } else if (mode === 'seat') {
      controls.minDistance = SEATED_DISTANCE
      controls.maxDistance = SEATED_DISTANCE
      controls.dollyTo(SEATED_DISTANCE, true)
    } else {
      controls.maxDistance = CAMERA_MAX_DISTANCE
      controls.dollyTo(savedDistance.current, true)
    }
    if (playerObject.current) playerObject.current.visible = mode !== 'fp'
    inside.current = mode
  })
  return null
}
