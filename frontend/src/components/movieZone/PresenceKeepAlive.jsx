import { useEffect } from 'react'
import { sendMove } from '../../game/multiplayer/realtimeStore.js'

// [3. 개발 > 프론트엔드] 화면이 가려져 있어도 내 위치 알리기 (혜진)
// 브라우저는 안 보이는 탭(다른 탭·최소화)에서 화면 그리기를 멈춰서, 매 프레임 위치를 보내던 것도 멈춰요.
// 그러면 창 두 개로 같이 해 볼 때 뒤에 있는 창의 캐릭터가 다른 사람에게 안 보여요.
// 그래서 탭이 가려져 있는 동안에는 1초마다 마지막 위치를 다시 보내요 (보일 때는 원래 MultiplayerPresence가 보냄).
export default function PresenceKeepAlive({ playerRef }) {
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) return
      const player = playerRef.current
      if (!player?.currPos) return
      const { x, y, z } = player.currPos
      const f = player.bodyZAxis
      sendMove([x, y, z], f ? Math.atan2(f.x, f.z) : 0, 0, true)
    }, 1000)
    return () => clearInterval(id)
  }, [playerRef])
  return null
}
