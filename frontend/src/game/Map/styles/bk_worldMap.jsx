// (담당: 병관) 더보기에서 열리는 전체 지도 창과 워프 확인을 표시합니다.
import { useEffect, useRef, useState } from 'react'
import { MinimapCanvas, WarpConfirm } from '../../../components/minimap/Minimap.jsx'
import { useGameStore } from '../../../store/gameStore.js'

export const WORLD_MAP_PANEL = 'bk_world_map'

export function closeWorldMap() {
  const game = useGameStore.getState()
  if (game.openPanel?.type === WORLD_MAP_PANEL) game.close()
}

export function WorldMapDialog() {
  const dialog = useRef(null)
  const [warp, setWarp] = useState(null)

  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => {
      node.close()
      // 다른 화면으로 전환되어 창이 실제로 사라지면 이동 키 잠금도 해제합니다.
      queueMicrotask(() => { if (!node.isConnected) closeWorldMap() })
    }
  }, [])

  return (
    <dialog ref={dialog} className="world-map ui-interactive" aria-labelledby="world-map-title"
      onCancel={(event) => { event.preventDefault(); closeWorldMap() }}
      onKeyDown={(event) => event.stopPropagation()}>
      <header className="world-map__head">
        <h2 id="world-map-title">전체 지도</h2>
        <button type="button" className="ui-btn" aria-label="전체 지도 닫기" onClick={closeWorldMap}>×</button>
      </header>
      <MinimapCanvas zoom="all" wide onPickWarp={setWarp} />
      {warp && <WarpConfirm warp={warp} onClose={() => setWarp(null)} onWarp={closeWorldMap} />}
    </dialog>
  )
}
