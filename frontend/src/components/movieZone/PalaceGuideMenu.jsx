import { useEffect } from 'react'
import { requestPalaceWarp } from './palaceSeating.js'
import { GUIDE_STOPS, usePalaceGuide } from './palaceGuide.js'
import './rickshaw.css'

// [3. 개발 > 프론트엔드] 경복궁 관람 안내판 목록 (혜진 영화·드라마 구역)
// 광화문 앞 안내판(3D)을 누르면 열려요. 버튼이나 숫자키(1~9)로 고르면 그 전각 앞으로 이동, Esc로 닫기.
export default function PalaceGuideMenu() {
  const open = usePalaceGuide((s) => s.open)
  const hide = usePalaceGuide((s) => s.hide)

  const go = (stop) => {
    if (stop.pos) requestPalaceWarp(stop.pos)
    hide()
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        hide()
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= Math.min(9, GUIDE_STOPS.length)) {
        e.preventDefault()
        go(GUIDE_STOPS[n - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null
  return (
    <div className="rk-panel rk-guide ui-interactive" role="dialog" aria-label="경복궁 관람 안내">
      <div className="rk-guide-head">
        <p className="rk-say">
          <span className="rk-who">안내판</span>
          경복궁 어디로 가 볼까요?
        </p>
        <button type="button" className="rk-close" onClick={hide} aria-label="안내판 닫기">
          ✕
        </button>
      </div>
      <p className="rk-sub">고르면 그 앞으로 바로 이동해요 · 숫자키 1~9 · Esc 닫기</p>
      <div className="rk-choices">
        {GUIDE_STOPS.map((stop, i) => (
          <button key={stop.id} type="button" className="rk-choice" onClick={(e) => { e.currentTarget.blur(); go(stop) }}>
            {i < 9 ? <kbd>{i + 1}</kbd> : <kbd>·</kbd>}
            <span className="rk-guide-name">
              {stop.name}
              <small>{stop.note}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
