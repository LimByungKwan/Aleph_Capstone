import { useEffect, useRef, useState } from 'react'
import { useUiStore } from './uiStore.js'

// [3. 개발 > 프론트엔드] 화면들이 같이 쓰는 작은 도구들

// API 에러 → 사용자에게 보여 줄 문장 (사용자 탓하지 않고, 다음 행동을 알려 줌)
export function errorText(error) {
  if (error?.name === 'ApiError') return error.message
  console.error(error)
  return '잠시 연결이 불안정해요. 다시 시도해 주세요.'
}

// 비동기 데이터 불러오기: { data, loading, error, reload }
// deps가 바뀌거나 dataVersion(스탬프·쿠폰 변경)이 바뀌면 다시 불러와요.
export function useAsync(load, deps) {
  const dataVersion = useUiStore((s) => s.dataVersion)
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setState((prev) => ({ ...prev, loading: true, error: null }))
    load()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, dataVersion, tick])

  return { ...state, reload: () => setTick((t) => t + 1) }
}

// 모달: ESC로 닫기, 열리면 닫기 버튼에 포커스, 닫히면 원래 버튼으로 포커스 복귀
export function Modal({ title, onClose, children, labelledBy }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [onClose])

  return (
    <div className="ui-backdrop ui-interactive" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <header className="ui-modal__head">
          <h2 className="ui-modal__title" id={labelledBy}>
            {title}
          </h2>
          <button ref={closeRef} type="button" className="ui-btn ui-btn--ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
      </section>
    </div>
  )
}

// 1초 넘게 걸릴 때만 스켈레톤 (짧은 로딩은 깜빡임 방지로 표시 안 함)
export function LoadingBlock({ rows = 2 }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(id)
  }, [])
  if (!show) return null
  return (
    <div style={{ display: 'grid', gap: 10 }} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ui-skeleton" />
      ))}
    </div>
  )
}

export const TYPE_LABEL = { spot: '촬영지', cafe: '가게', npc: 'NPC' }

// 화면 위쪽 알림 (3D 화면·사장님·관리자 화면 모두에서 씀)
export function Toasts() {
  const toasts = useUiStore((s) => s.toasts)
  return (
    <div className="ui-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`ui-toast ui-toast--${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
