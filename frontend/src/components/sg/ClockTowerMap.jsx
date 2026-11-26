import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { playerPose } from '../../store/playerPose.js'
import { layout } from '../../game/data/mapData.js'
import { WORLD_MAP_PANEL } from '../../game/Map/styles/bk_worldMap.jsx'
import { useIsTouch } from '../mobile/MobileControls.jsx'

// 광장 시계탑 앞에서 E → 전체 지도(병관님 bk_worldMap, 더보기 메뉴와 같은 창)를 열어 워프. 담당: 성근(SG)
// - 3D는 건드리지 않고 캐릭터 위치(playerPose)로 거리만 잼
// - 루미(시계탑 남쪽 7.5m)와 겹치는 자리에서는 루미 대화가 먼저 (nearbyPlaceId가 있으면 양보)

const TOWER = layout.buildings.find((b) => b.id === 'hubx_clock_tower')?.position ?? [0, 0]
const NEAR_DIST = 6 // 탑 받침(지름 8.8m) 둘레에 서 있으면

const isNear = () => playerPose.ready && Math.hypot(playerPose.x - TOWER[0], playerPose.z - TOWER[1]) < NEAR_DIST

export default function ClockTowerMap() {
  const [near, setNear] = useState(false)
  const show = useGameStore((s) => near && !s.openPanel && !s.nearbyPlaceId)
  const touch = useIsTouch()

  useEffect(() => {
    const tick = () => setNear(isNear())
    tick()
    const timer = setInterval(tick, 300)
    const down = (e) => {
      if (e.repeat || e.code !== 'KeyE' || !isNear()) return
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
        <kbd style={kbd}>{touch ? 'E 버튼' : 'E'}</kbd> 🕰️ 시계탑 · 전체 지도에서 워프
      </div>
    </div>
  )
}

// AuditionPanel·CheerGame의 E 안내 칩과 같은 모양. 광장은 넓어 아래쪽 칩을 못 보고 지나쳐서 캐릭터 머리 위쯤으로 올림
const hudWrap = { position: 'absolute', left: 0, right: 0, bottom: '58%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }
const chip = { padding: '8px 16px', borderRadius: 999, border: '1px solid #ffffff55', background: 'rgba(0,0,0,0.65)', boxShadow: '0 4px 18px #0006', color: '#fff', fontSize: 15 }
const kbd = { padding: '2px 7px', borderRadius: 4, background: '#fff', color: '#111', fontSize: '0.85em', fontWeight: 700 }
