import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { playerPose } from '../../store/playerPose.js'
import { layout } from '../../game/data/mapData.js'
import { WORLD_MAP_PANEL } from '../../game/Map/styles/bk_worldMap.jsx'
import { useIsTouch } from '../mobile/MobileControls.jsx'

const board = layout.props.find((item) => item.id === 'hubx_map_board')
const NEAR_DIST = 3
const isNear = () => board && playerPose.ready
  && Math.hypot(playerPose.x - board.position[0], playerPose.z - board.position[1]) < NEAR_DIST

export default function HubMapInteraction() {
  const [near, setNear] = useState(false)
  const show = useGameStore((s) => near && !s.openPanel && !s.nearbyPlaceId)
  const touch = useIsTouch()

  useEffect(() => {
    const tick = () => setNear(isNear())
    tick()
    const timer = setInterval(tick, 150)
    const down = (e) => {
      if (e.defaultPrevented || e.repeat || e.code !== 'KeyE' || !isNear()) return
      if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return
      const game = useGameStore.getState()
      if (!game.openPanel && !game.nearbyPlaceId) game.open({ type: WORLD_MAP_PANEL })
    }
    window.addEventListener('keydown', down)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', down)
    }
  }, [])

  if (!show) return null
  return (
    <div style={hudWrap}>
      <div style={chip}>
        <kbd style={kbd}>{touch ? 'E 버튼' : 'E'}</kbd> 안내판 · 전체 지도 열기
      </div>
    </div>
  )
}

// AuditionPanel·CheerGame의 E 안내 칩과 같은 모양. 광장은 넓어 아래쪽 칩을 못 보고 지나쳐서 캐릭터 머리 위쯤으로 올림
const hudWrap = { position: 'absolute', left: 0, right: 0, bottom: '58%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }
const chip = { padding: '8px 16px', borderRadius: 999, border: '1px solid #ffffff55', background: 'rgba(0,0,0,0.65)', boxShadow: '0 4px 18px #0006', color: '#fff', fontSize: 15 }
const kbd = { padding: '2px 7px', borderRadius: 4, background: '#fff', color: '#111', fontSize: '0.85em', fontWeight: 700 }
