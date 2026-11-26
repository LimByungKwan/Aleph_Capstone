import { PalaceQuiz, readQuizProgress } from './PalaceQuiz.jsx'
import { palaceQuestions } from './palaceQuestions.js'
import { useEffect, useState } from 'react'
import { requestPalaceWarp } from './palaceSeating.js'
import { GUIDE_AREAS, usePalaceGuide } from './palaceGuide.js'
import './rickshaw.css'

// [3. 개발 > 프론트엔드] 관람 안내판 목록 (혜진 영화·드라마 구역)
// 광화문 앞 안내판(3D)이나 구역 입장 카드의 "안내판" 버튼으로 열려요.
// 위쪽 탭으로 구역(경복궁 · 1930 경성거리)을 고르고, 버튼이나 숫자키(1~9)로 고르면 그 앞으로 이동, ←/→ 탭 바꾸기, Esc 닫기.
export default function PalaceGuideMenu() {
  const open = usePalaceGuide((s) => s.open)
  const tab = usePalaceGuide((s) => s.tab)
  const setTab = usePalaceGuide((s) => s.setTab)
  const hide = usePalaceGuide((s) => s.hide)
  const quizId = usePalaceGuide(s => s.quizId)
  const [solved, setSolved] = useState(readQuizProgress)
  const area = GUIDE_AREAS.find((a) => a.id === tab) ?? GUIDE_AREAS[0]
  const stops = area.stops

  const go = (stop) => {
    if (stop.pos) requestPalaceWarp(stop.pos)
    hide()
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (quizId) {
        if (e.key === 'Escape') { e.preventDefault(); hide() }
        if (e.key !== 'Tab' && !(e.target instanceof HTMLInputElement)) e.stopImmediatePropagation()
        return
      }
      if (e.key === 'Escape') {
        hide()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const i = GUIDE_AREAS.indexOf(area)
        setTab(GUIDE_AREAS[(i + (e.key === 'ArrowRight' ? 1 : GUIDE_AREAS.length - 1)) % GUIDE_AREAS.length].id)
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= Math.min(9, stops.length)) {
        e.preventDefault()
        go(stops[n - 1])
      }
    }
    window.addEventListener('keydown', onKey, Boolean(quizId))
    return () => window.removeEventListener('keydown', onKey, Boolean(quizId))
  })

  if (!open) return null
  const quizStop = stops.find(stop => stop.id === quizId)
  if (quizStop) return <PalaceQuiz key={quizId} stop={quizStop} solved={solved} onSolve={setSolved}
    onClose={hide} onGuide={() => usePalaceGuide.getState().show('palace')} />
  return (
    <div className="rk-panel rk-guide ui-interactive" role="dialog" aria-label="관람 안내판">
      <div className="rk-guide-head">
        <p className="rk-say">
          <span className="rk-who">안내판</span>
          어디로 가 볼까요?
        </p>
        <button type="button" className="rk-close" onClick={hide} aria-label="안내판 닫기">
          ✕
        </button>
      </div>
      <div className="rk-guide-tabs" role="tablist" aria-label="구역">
        {GUIDE_AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={a.id === area.id}
            className={`rk-guide-tab${a.id === area.id ? ' is-active' : ''}`}
            onClick={(e) => {
              e.currentTarget.blur()
              setTab(a.id)
            }}
          >
            {a.name}
          </button>
        ))}
      </div>
      <p className="rk-sub">고르면 그 앞으로 바로 이동해요 · 숫자키 1~9 · ←/→ 구역 바꾸기 · Esc 닫기</p>
      {tab === 'palace' && <p className="rk-sub">역사 퀴즈 {solved.length}/4 · 현장 퀴즈 장소를 고른 뒤 E를 눌러 도전하세요.</p>}
      <div className="rk-choices" role="tabpanel">
        {stops.map((stop, i) => (
          <button
            key={stop.id}
            type="button"
            className="rk-choice"
            onClick={(e) => {
              e.currentTarget.blur()
              go(stop)
            }}
          >
            {i < 9 ? <kbd>{i + 1}</kbd> : <kbd>·</kbd>}
            <span className="rk-guide-name">
              {stop.name}{palaceQuestions[stop.id] && (solved.includes(stop.id) ? ' · 퀴즈 완료' : ' · 현장 퀴즈')}
              <small>{stop.note}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
