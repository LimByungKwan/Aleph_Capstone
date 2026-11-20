import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { APPROACH, CHEER_PANEL, GAME_SECONDS, POINTS, WINDOW, judge, makeNotes, useSgCheer } from '../../game/Map/styles/sg_cheerStore.js'

// SUNSET WAVE 응원봉 리듬 게임 화면. 담당: 성근(SG)
// 3D 쪽(받침대·감지·E키)은 game/Map/styles/sg_cheer.jsx
// - 줄어드는 원이 가운데 원에 겹칠 때 Space(휴대폰은 화면 탭)
// - 패널이 열리면 공용 gameStore가 inputLocked → 캐릭터가 안 움직이고 Space로 점프도 안 함
// - ESC는 공용 InteractionKeys가 패널을 닫음

const BEST_KEY = 'sg-cheer-best'
const LABEL = { perfect: 'Perfect!', good: 'Good', miss: 'Miss' }

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

export default function CheerGame() {
  const near = useSgCheer((s) => s.near)
  const open = useGameStore((s) => s.openPanel?.type === CHEER_PANEL)
  if (open) return <Game />
  if (!near) return null
  return (
    <div style={hudWrap}>
      <div style={chip}>
        <kbd style={kbd}>E</kbd> SUNSET WAVE 응원봉 리듬 게임
      </div>
    </div>
  )
}

function Game() {
  const [phase, setPhase] = useState('ready') // 'ready' | 'playing' | 'result'
  const [now, setNow] = useState(0)
  const [best, setBest] = useState(readBest)
  const run = useRef(null) // { start, notes: [{ t, result }], score, combo, last }

  const start = () => {
    run.current = { start: performance.now(), notes: makeNotes().map((t) => ({ t, result: null })), score: 0, combo: 0, maxCombo: 0, last: null }
    setNow(0)
    setPhase('playing')
  }

  const record = (note, result) => {
    const r = run.current
    note.result = result
    r.score += POINTS[result]
    r.combo = result === 'miss' ? 0 : r.combo + 1
    r.maxCombo = Math.max(r.maxCombo, r.combo)
    r.last = { result, at: (performance.now() - r.start) / 1000 }
  }

  const hit = () => {
    if (phase !== 'playing') return start() // 시작 화면·결과 화면에서는 Space/탭이 (다시) 시작
    const r = run.current
    const t = (performance.now() - r.start) / 1000
    const note = r.notes.find((n) => !n.result && judge(t - n.t) !== null)
    if (note) record(note, judge(t - note.t))
  }

  // 매 프레임 시간 진행 + 놓친 노트 Miss 처리 + 끝나면 결과
  useEffect(() => {
    if (phase !== 'playing') return
    let id
    const tick = () => {
      const r = run.current
      const t = (performance.now() - r.start) / 1000
      for (const n of r.notes) if (!n.result && t - n.t > WINDOW.good) record(n, 'miss')
      if (t >= GAME_SECONDS) {
        if (r.score > readBest()) {
          try {
            window.localStorage.setItem(BEST_KEY, String(r.score))
          } catch {
            // 저장 못 해도 이번 결과는 보여 줌
          }
          setBest(r.score)
        }
        setPhase('result')
        return
      }
      setNow(t)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [phase])

  // Space로 응원봉 흔들기 (preventDefault: 페이지 스크롤·버튼 눌림 방지)
  const hitRef = useRef(hit)
  hitRef.current = hit
  useEffect(() => {
    const down = (event) => {
      if (event.code !== 'Space' || event.repeat) return
      event.preventDefault()
      hitRef.current()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  const r = run.current
  const close = () => useGameStore.getState().close()

  return (
    <div style={overlay} onPointerDown={(e) => e.target === e.currentTarget && hit()}>
      <div style={panel} onPointerDown={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🎤 SUNSET WAVE 응원봉 리듬 게임</div>

        {phase === 'ready' && (
          <>
            <p style={text}>줄어드는 원이 가운데 원에 딱 겹칠 때 <kbd style={kbd}>Space</kbd>를 누르세요. 휴대폰은 화면을 탭하면 돼요.</p>
            <p style={text}>{GAME_SECONDS}초 동안 진행돼요. 최고 점수: <b>{best}</b></p>
            <div style={row}>
              <button style={btnGhost} onClick={close}>닫기</button>
              <button style={btn} onClick={start}>▶ 시작 (Space)</button>
            </div>
          </>
        )}

        {phase === 'playing' && (
          <div onPointerDown={hit} style={stage} role="button" aria-label="응원봉 흔들기">
            <Rings notes={r.notes} now={now} />
            <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 13 }}>점수 {r.score} · 콤보 {r.combo}</div>
            <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 13 }}>{Math.max(0, Math.ceil(GAME_SECONDS - now))}초</div>
            {r.last && now - r.last.at < 0.5 && <div style={{ ...judgeText, color: JUDGE_COLOR[r.last.result] }}>{LABEL[r.last.result]}</div>}
          </div>
        )}

        {phase === 'result' && (
          <>
            <p style={{ ...text, fontSize: 18 }}>
              점수 <b>{r.score}</b> {r.score >= best && r.score > 0 ? '🎉 최고 기록!' : `(최고 ${best})`}
            </p>
            <p style={text}>
              Perfect {count(r, 'perfect')} · Good {count(r, 'good')} · Miss {count(r, 'miss')} · 최대 콤보 {r.maxCombo}
            </p>
            <div style={row}>
              <button style={btnGhost} onClick={close}>닫기</button>
              <button style={btn} onClick={start}>다시 하기 (Space)</button>
            </div>
          </>
        )}
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
          <kbd style={kbd}>ESC</kbd> 나가기
        </div>
      </div>
    </div>
  )
}

// 가운데 고정 원 + 다가오는 노트마다 줄어드는 원 (크기 3배 → 1배)
function Rings({ notes, now }) {
  const coming = notes.filter((n) => !n.result && n.t - now <= APPROACH && n.t - now > -WINDOW.good)
  return (
    <>
      <div style={{ ...ring, width: TARGET, height: TARGET, borderColor: '#fff' }} />
      <div style={{ ...ring, width: TARGET * 0.6, height: TARGET * 0.6, background: 'rgba(196,165,255,0.35)', border: 'none' }} />
      {coming.map((n) => {
        const size = TARGET * (1 + (2 * Math.max(0, n.t - now)) / APPROACH)
        return <div key={n.t} style={{ ...ring, width: size, height: size, borderColor: '#c4a5ff' }} />
      })}
    </>
  )
}

const count = (r, result) => r.notes.filter((n) => n.result === result).length

const TARGET = 70
const JUDGE_COLOR = { perfect: '#ffe066', good: '#9be7c4', miss: '#ff8fa3' }
// drei <Html> 이름표(z-index 최대 16777271) 위에 뜨게 UiRoot와 같은 값
const overlay = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, zIndex: 16777280 }
const hudWrap = { position: 'absolute', left: 0, right: 0, bottom: 72, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const panel = { width: 'min(360px, calc(100vw - 32px))', padding: '12px 14px', borderRadius: 10, background: 'rgba(32,24,52,0.92)', color: '#fff', fontSize: 14 }
const stage = { position: 'relative', height: 240, borderRadius: 8, background: '#160f26', overflow: 'hidden', cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none' }
const ring = { position: 'absolute', left: '50%', top: '55%', transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '3px solid', boxSizing: 'border-box', pointerEvents: 'none' }
const judgeText = { position: 'absolute', left: 0, right: 0, top: 34, textAlign: 'center', fontSize: 22, fontWeight: 800 }
const text = { margin: '6px 0', lineHeight: 1.5 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
const row = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 8 }
const btn = { padding: '5px 12px', borderRadius: 6, border: 'none', background: '#c4a5ff', color: '#1a1030', fontWeight: 700, cursor: 'pointer' }
const btnGhost = { ...btn, background: 'transparent', color: '#e9ddff', border: '1px solid #6b5a8f' }
