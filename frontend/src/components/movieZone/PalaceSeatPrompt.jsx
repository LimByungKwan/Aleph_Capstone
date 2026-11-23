import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { usePalaceSeatStore } from './palaceSeating.js'
import { useUiStore } from './uiStore.js'

export default function PalaceSeatPrompt() {
  const nearby = usePalaceSeatStore(state => state.nearby)
  const seated = usePalaceSeatStore(state => state.seated)
  const toggle = usePalaceSeatStore(state => state.toggle)
  const modal = useUiStore(state => state.modal)
  const locked = useGameStore(state => state.inputLocked)
  const available = !modal && !locked && Boolean(nearby || seated)

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
        <kbd>E</kbd> {seated ? '일어나기' : `${nearby.label}에 앉기`}
      </button>
    </div>
  )
}
