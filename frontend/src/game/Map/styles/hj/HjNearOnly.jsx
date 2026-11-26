import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// [7. 유지보수 > 성능] 가까이 있을 때만 그리기 (혜진 영화·드라마 구역)
// 전각 실내·기차 안·관청 실내·놀이공원 동물처럼 메시가 많은 묶음을, 카메라가 radius(m) 안에 있을 때만 보이게 해요.
// 멀리서는 화면에 거의 안 보이는데 매 프레임 그리면 끊김(버벅임)의 원인이 돼요.
// center: 이 묶음 기준 거리 재는 점 (기본 [0,0,0]). 0.3초마다만 확인해요.
export default function NearOnly({ radius = 40, center = [0, 0, 0], children }) {
  const ref = useRef(null)
  const wait = useRef(Math.random() * 0.3) // 여러 개가 한 프레임에 몰리지 않게 흩어 놓기
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, delta) => {
    wait.current -= delta
    if (wait.current > 0) return
    wait.current = 0.3
    const g = ref.current
    if (!g) return
    tmp.set(center[0], center[1], center[2])
    g.localToWorld(tmp)
    g.visible = tmp.distanceToSquared(camera.position) < radius * radius
  })
  return <group ref={ref}>{children}</group>
}
