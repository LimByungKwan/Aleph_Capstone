import { lazy, Suspense } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { AUDITION_PANEL, useSgAudition } from '../../game/Map/styles/sg_auditionStore.js'
import { CHEER_PANEL, useSgCheer } from '../../game/Map/styles/sg_cheerStore.js'
import { useSgStudio } from '../../game/Map/styles/sg_studioStore.js'

const AuditionPanel = lazy(() => import('./AuditionPanel.jsx'))
const CheerGame = lazy(() => import('./CheerGame.jsx'))
const StudioPanel = lazy(() => import('./StudioPanel.jsx'))

export function AuditionInteraction() {
  const near = useSgAudition((s) => s.near)
  const open = useGameStore((s) => s.openPanel?.type === AUDITION_PANEL)
  if (open) return <Suspense fallback={null}><AuditionPanel /></Suspense>
  return near ? <InteractionHint>SUNGRAY 오디션 도전</InteractionHint> : null
}

export function CheerInteraction() {
  const near = useSgCheer((s) => s.near)
  const open = useGameStore((s) => s.openPanel?.type === CHEER_PANEL)
  if (open) return <Suspense fallback={null}><CheerGame /></Suspense>
  return near ? <InteractionHint>SUNSET WAVE 응원봉 리듬 게임</InteractionHint> : null
}

export function StudioInteraction() {
  const near = useSgStudio((s) => s.near)
  const open = useSgStudio((s) => s.step !== 'closed')
  if (open) {
    return (
      <div style={hudWrap}>
        <Suspense fallback={null}><StudioPanel /></Suspense>
      </div>
    )
  }
  return near ? <InteractionHint keyStyle={studioKbd}>물결 레코딩 스튜디오 · 내 문장 녹음해 보기</InteractionHint> : null
}

function InteractionHint({ children, keyStyle = kbd }) {
  return (
    <div style={hudWrap}>
      <div style={chip}>
        <kbd style={keyStyle}>E</kbd> {children}
      </div>
    </div>
  )
}

const hudWrap = { position: 'absolute', left: 0, right: 0, bottom: 72, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const kbd = { padding: '2px 7px', borderRadius: 4, background: '#fff', color: '#111', fontSize: '0.85em', fontWeight: 700 }
const studioKbd = { ...kbd, padding: '0 5px', fontSize: 11 }
