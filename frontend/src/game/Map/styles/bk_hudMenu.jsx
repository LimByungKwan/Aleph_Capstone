// (담당: 병관) 게임 상단의 보조 기능을 한 메뉴에 모아 보여 줍니다.
import { useId } from 'react'
import { useGameStore } from '../../../store/gameStore.js'
import { WORLD_MAP_PANEL, WorldMapDialog } from './bk_worldMap.jsx'
import '../../../components/tutorial/tutorial.css'

export function HudMore({ children }) {
  const id = useId()
  const panelType = useGameStore((state) => state.openPanel?.type)
  return (
    <>
      <button type="button" className="ui-btn bk-hud-more" popoverTarget={id}>
        더보기 <span aria-hidden="true">⌄</span>
      </button>
      <div id={id} className="bk-hud-menu ui-interactive" popover="auto" aria-label="더보기"
        onClick={(event) => {
          if (event.target.closest('button, a')) event.currentTarget.hidePopover()
        }}>
        <button type="button" className="ui-btn" disabled={Boolean(panelType)}
          onClick={(event) => {
            event.currentTarget.blur()
            const game = useGameStore.getState()
            if (!game.openPanel) game.open({ type: WORLD_MAP_PANEL })
          }}>🗺️ 전체 지도</button>
        {children}
      </div>
      {panelType === WORLD_MAP_PANEL && <WorldMapDialog />}
    </>
  )
}
