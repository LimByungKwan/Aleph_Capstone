import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EYE_HEIGHT, LOOK_SENSITIVITY } from '../config.js'

const MAX_PITCH = 1.4 // 위아래로 볼 수 있는 최대 각도 (약 80도)

// 1인칭 카메라: 캐릭터 눈 위치에 카메라를 두고, 마우스 드래그로 고개를 돌림.
// ecctrl은 "카메라가 보는 방향"을 앞(W)으로 쓰기 때문에, 고개를 돌린 쪽으로 걸어가요.
export default function FirstPersonCamera({ playerRef }) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  // 처음엔 동쪽(+x, 골목 안쪽)을 바라봄
  const look = useRef({ yaw: -Math.PI / 2, pitch: 0 })

  useEffect(() => {
    const canvas = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0

    const onDown = (event) => {
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
    }
    const onMove = (event) => {
      if (!dragging) return
      look.current.yaw -= (event.clientX - lastX) * LOOK_SENSITIVITY
      look.current.pitch -= (event.clientY - lastY) * LOOK_SENSITIVITY
      look.current.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, look.current.pitch))
      lastX = event.clientX
      lastY = event.clientY
    }
    const onUp = () => {
      dragging = false
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl])

  useFrame(() => {
    const player = playerRef.current
    if (!player) return
    const { x, y, z } = player.currPos
    camera.position.set(x, y + EYE_HEIGHT, z)
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, 'YXZ')
  })

  return null
}
