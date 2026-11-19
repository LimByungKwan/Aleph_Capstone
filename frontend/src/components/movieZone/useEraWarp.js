import { useFrame } from '@react-three/fiber'
import { usePortalStore } from './portalStore.js'

// [3. 개발 > 프론트엔드] 부스에서 선택한 시대의 입구 앞에 캐릭터를 내려놓아요.
export function useEraWarp(playerRef) {
  useFrame(({ controls }) => {
    const player = playerRef.current
    const { warpRequest, finishWarp } = usePortalStore.getState()
    if (!player?.body || !warpRequest) return

    const [x, y, z] = warpRequest
    const previous = player.body.translation()
    const dx = x - previous.x
    const dy = y - previous.y
    const dz = z - previous.z
    player.body.setTranslation({ x, y, z }, true)
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    if (controls?.getPosition && controls?.getTarget && controls?.setLookAt) {
      const eye = controls.getPosition()
      const target = controls.getTarget()
      controls.setLookAt(eye.x + dx, eye.y + dy, eye.z + dz,
        target.x + dx, target.y + dy, target.z + dz, false)
    }
    finishWarp()
  })
}
