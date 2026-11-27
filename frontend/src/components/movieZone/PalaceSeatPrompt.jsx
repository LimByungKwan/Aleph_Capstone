import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { usePalaceSeatStore } from './palaceSeating.js'
import { useUiStore } from './uiStore.js'
import { usePalaceTour } from './palaceTourStore.js'
import { useSpecialAccess } from './specialAccessStore.js'

export default function PalaceSeatPrompt() {
  const nearby = usePalaceSeatStore(state => state.nearby)
  const seated = usePalaceSeatStore(state => state.seated)
  const toggle = usePalaceSeatStore(state => state.toggle)
  const modal = useUiStore(state => state.modal)
  const locked = useGameStore(state => state.inputLocked)
  const tourOpen = usePalaceTour(state => state.open)
  const specialPanel = useSpecialAccess(state => state.panel)
  // [지민 11/27] quietWhileMoving 탈것(애니 구역 바다 전차 등)은 달리는 동안 「정차하면 내릴 수 있어요」·E를 숨김
  //   (E 글자가 붙어 있어 "E로 내릴 수 있다"로 읽혔음). 정차하면 다시 「…에서 내리기」가 떠요. 0.3초마다 다시 그려서 바로 바뀜
  const quiet = Boolean(seated?.vehicle?.quietWhileMoving && !seated.vehicle.stopped)
  const available = !modal && !locked && !tourOpen && !specialPanel && !quiet && Boolean(nearby || seated)
  // 전차·기차에 타고 있으면 정차 여부가 계속 바뀌니 0.3초마다 문구를 새로 그려요
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!seated?.vehicle) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 300)
    return () => clearInterval(id)
  }, [seated])
  let label = `${nearby?.label}에 앉기`
  if (seated?.vehicle) label = seated.vehicle.stopped ? `${seated.vehicle.label}에서 내리기` : '정차하면 내릴 수 있어요'
  else if (seated) label = '일어나기'
  else if (nearby?.prompt) label = nearby.prompt

  useEffect(() => {
    if (!available) return undefined
    const onKeyDown = (event) => {
      if (event.repeat || event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable]')) return
      if (event.code === 'KeyE' || (seated && event.key === 'Escape')) {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [available, seated, toggle])

  if (!available) return null
  return (
    <div className="ui-scene-hint ui-interactive">
      <button type="button" className="ui-btn ui-btn--ink" onClick={(event) => {
        event.currentTarget.blur()
        toggle()
      }}>
        <kbd>E</kbd> {label}
      </button>
    </div>
  )
}
