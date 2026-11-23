import { useEffect, useRef, useState } from 'react'
import { JUDGES } from '../../game/Map/styles/sg_auditionStore.js'
import { submitKeyboard } from './auditionTake.js'

// 썬그레이 오디션 키보드 모드 (마이크를 쓸 수 없을 때). 담당: 성근(SG)
// 기준 멜로디의 음표마다 화살표가 오른쪽에서 흘러와 왼쪽 판정 고리에 닿을 때 같은 방향키를 누름
// - 화살표 방향은 멜로디 모양을 따름: 조금 오르면 ↑, 조금 내리면 ↓, 크게 뛰면 → / ←
// - 마이크를 안 쓰므로 멜로디 소리를 그대로 틀어 줌 (화살표가 고리에 닿을 때 그 음이 남)
// - 휴대폰은 아래 화살표 버튼을 탭

export const ARROWS = {
  ArrowLeft: { label: '←', color: '#ff7ab6' },
  ArrowDown: { label: '↓', color: '#5ce1ff' },
  ArrowUp: { label: '↑', color: '#b18cff' },
  ArrowRight: { label: '→', color: '#ffd166' },
}
const LEAD = 2 // 화살표가 오른쪽 끝에서 고리까지 오는 시간(초) = 첫 음 전 준비 시간
export const WINDOW = { perfect: 0.08, good: 0.18 }
const POINTS = { perfect: 100, good: 60, miss: 0 }
const LABEL = { perfect: 'Perfect!', good: 'Good', miss: 'Miss' }
const COLOR = { perfect: '#ffe066', good: '#9be7c4', miss: '#ff8fa3' }

// 음표 → 화살표 키. 첫 음은 ←, 이후는 앞 음과의 차이로 정함 (같은 음은 ←/→ 번갈아)
export function arrowsFor(notes) {
  let flip = false
  return notes.map((n, i) => {
    if (i === 0) return 'ArrowLeft'
    const step = n.midi - notes[i - 1].midi
    if (step >= 3) return 'ArrowRight'
    if (step <= -3) return 'ArrowLeft'
    if (step > 0) return 'ArrowUp'
    if (step < 0) return 'ArrowDown'
    flip = !flip
    return flip ? 'ArrowRight' : 'ArrowLeft'
  })
}

// 누른 시각 - 음표 시각(dt)과 맞는 방향인지 → 판정. 판정 범위 밖이면 null(이 음표와 무관한 입력)
export function judgeHit(dt, rightKey) {
  if (Math.abs(dt) > WINDOW.good) return null
  if (!rightKey) return 'miss'
  return Math.abs(dt) <= WINDOW.perfect ? 'perfect' : 'good'
}

export function scoreOf(results) {
  if (!results.length) return 0
  return Math.round(results.reduce((sum, r) => sum + POINTS[r], 0) / results.length)
}

export default function KeyboardRhythm({ songId, notes, onClose }) {
  const [phase, setPhase] = useState('ready') // ready | playing | judging | result
  const [judged, setJudged] = useState(null)
  const [error, setError] = useState('')
  const attempt = useRef(0)
  const [now, setNow] = useState(-LEAD)
  const run = useRef(null) // { start, items: [{ t, key, result }], combo, maxCombo, last, stopSound }

  const songEnd = notes.at(-1).start + notes.at(-1).duration

  const close = () => {
    attempt.current += 1
    onClose()
  }

  const start = () => {
    attempt.current += 1
    setJudged(null)
    setError('')
    run.current?.stopSound?.()
    const keys = arrowsFor(notes)
    run.current = {
      start: performance.now() / 1000 + LEAD,
      presses: [],
      items: notes.map((n, i) => ({ t: n.start, key: keys[i], result: null })),
      combo: 0,
      maxCombo: 0,
      last: null,
      stopSound: playMelody(notes, () => {}, LEAD),
    }
    setNow(-LEAD)
    setPhase('playing')
  }

  const record = (item, result) => {
    const r = run.current
    item.result = result
    r.combo = result === 'miss' ? 0 : r.combo + 1
    r.maxCombo = Math.max(r.maxCombo, r.combo)
    r.last = { result, at: performance.now() / 1000 - r.start }
  }

  const press = (key) => {
    if (phase !== 'playing') return
    const r = run.current
    const t = performance.now() / 1000 - r.start
    r.presses.push({ key, t })
    // 가장 가까운 아직 안 친 음표 하나만 판정 (연타로 여러 개 처리 방지)
    const item = r.items.find((it) => !it.result && Math.abs(t - it.t) <= WINDOW.good)
    if (item) record(item, judgeHit(t - item.t, key === item.key))
  }

  const finish = async () => {
    const id = attempt.current
    const presses = run.current.presses.slice()
    setPhase('judging')
    try {
      const result = await submitKeyboard(songId, presses)
      if (id !== attempt.current) return
      setJudged(result)
    } catch (e) {
      if (id !== attempt.current) return
      setError(`AI 심사를 받지 못했어요. ${e?.message || ''}`)
    }
    if (id === attempt.current) setPhase('result')
  }

  // 시간 진행 + 놓친 음표 Miss + 끝나면 결과
  useEffect(() => {
    if (phase !== 'playing') return
    let id
    const tick = () => {
      const r = run.current
      const t = performance.now() / 1000 - r.start
      for (const it of r.items) if (!it.result && t - it.t > WINDOW.good) record(it, 'miss')
      if (t > songEnd + 0.8) return finish()
      setNow(t)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [phase, songEnd])

  // 방향키 (preventDefault: 페이지 스크롤 방지), 패널이 닫히면 소리 끔
  const pressRef = useRef(press)
  pressRef.current = press
  useEffect(() => {
    const down = (event) => {
      if (!ARROWS[event.code] || event.repeat) return
      event.preventDefault()
      pressRef.current(event.code)
    }
    window.addEventListener('keydown', down)
    return () => {
      attempt.current += 1
      window.removeEventListener('keydown', down)
      run.current?.stopSound?.()
    }
  }, [])

  const r = run.current

  if (phase === 'ready')
    return (
      <>
        <p style={text}>마이크를 쓸 수 없어서 <b>키보드 모드</b>로 도전해요. 화살표가 왼쪽 고리에 닿을 때 같은 <b>방향키</b>를 누르세요. 멜로디가 함께 나와요.</p>
        <div style={row}>
          <button style={btnGhost} onClick={close}>닫기</button>
          <button style={btn} onClick={start}>▶ 시작</button>
        </div>
      </>
    )

  if (phase === 'result' || phase === 'judging') {
    const items = judged?.notes || r.items
    const results = items.map((it) => it.result)
    const count = (k) => results.filter((x) => x === k).length
    const score = judged?.score ?? scoreOf(results)
    let combo = 0
    const maxCombo = results.reduce((max, result) => {
      combo = result === 'miss' ? 0 : combo + 1
      return Math.max(max, combo)
    }, 0)
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 'clamp(44px, 5vw, 72px)', fontWeight: 800 }}>{score}</span>
          <span>점 · {judged ? '서버 채점' : '브라우저 미리보기'} (키보드 모드)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(28px, 1fr))', gap: 6, margin: '12px 0' }}>
          {items.map((it, i) => (
            <div key={i} title={`${i + 1}번 ${LABEL[it.result]}${it.dt != null ? ` · ${(it.dt * 1000).toFixed(0)}밀리초` : ''}`} style={{ minWidth: 0, textAlign: 'center', fontSize: 'clamp(18px, 2vw, 28px)' }}>
              <div style={{ height: 'clamp(24px, 4vh, 38px)', borderRadius: 6, background: COLOR[it.result] }} />
              {ARROWS[it.key].label}
            </div>
          ))}
        </div>
        <p style={text}>Perfect {count('perfect')} · Good {count('good')} · Miss {count('miss')} · 최대 콤보 {maxCombo}</p>
        {phase === 'judging' && <p role="status" style={text}>심사위원들이 보고 있어요…</p>}
        {error && <p role="status" style={text}>{error} 브라우저 점수를 표시해요.</p>}
        {judged && <JudgeFeedback feedback={judged.feedback} />}
        <div style={row}>
          <button style={btnGhost} onClick={close}>닫기</button>
          <button style={btn} onClick={start}>다시 하기</button>
        </div>
      </>
    )
  }

  return (
    <>
      <div style={track}>
        <div style={{ ...ring, left: `${HIT_X}%` }} />
        {r.items.map((it, i) => {
          const ahead = it.t - now
          if (it.result || ahead > LEAD || ahead < -WINDOW.good) return null
          const x = HIT_X + (100 - HIT_X - 6) * (ahead / LEAD)
          const { label, color } = ARROWS[it.key]
          return (
            <div key={i} style={{ ...arrow, left: `${x}%`, background: color, boxShadow: `0 0 14px ${color}` }}>{label}</div>
          )
        })}
        <div style={{ position: 'absolute', bottom: 14, right: 16, fontSize: 'clamp(16px, 1.5vw, 20px)' }}>콤보 {r.combo}</div>
        {r.last && now - r.last.at < 0.5 && <div style={{ ...judgeText, color: COLOR[r.last.result] }}>{LABEL[r.last.result]}</div>}
      </div>
      <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'center', gap: 'clamp(8px, 1.2vw, 18px)', marginTop: 12 }}>
        {Object.entries(ARROWS).map(([key, { label, color }]) => (
          <button key={key} style={{ ...pad, borderColor: color, color }} onPointerDown={(e) => { e.preventDefault(); press(key) }} aria-label={`${label} 방향`}>{label}</button>
        ))}
      </div>
    </>
  )
}

export function JudgeFeedback({ feedback }) {
  return (
    <div style={{ flexShrink: 0, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 12 }}>
        {JUDGES.map(({ role, color }) => (
          <div key={role} style={{ minWidth: 0, border: `1px solid ${color}`, borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.05)' }}>
            <b style={{ color }}>{role}</b>
            <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{feedback.judges.find((j) => j.role === role)?.line}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <b>연습 팁</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          {feedback.tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </div>
    </div>
  )
}

// 멜로디 재생 (삼각파). delay초 뒤 시작. 돌려주는 함수를 부르면 멈춤
export function playMelody(notes, onEnd, delay = 0) {
  const ctx = new AudioContext()
  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.value = 0
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.connect(gain)
  const t0 = ctx.currentTime + Math.max(delay, 0.1) // 화면 시계와 맞추려고 delay만큼만 늦춤
  for (const n of notes) {
    osc.frequency.setValueAtTime(440 * 2 ** ((n.midi - 69) / 12), t0 + n.start)
    gain.gain.setTargetAtTime(0.25, t0 + n.start, 0.01)
    gain.gain.setTargetAtTime(0, t0 + n.start + n.duration - 0.05, 0.02)
  }
  const last = notes.at(-1)
  osc.start()
  osc.stop(t0 + last.start + last.duration + 0.2)
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    ctx.close().catch(() => {}) // 이미 닫히는 중이면 무시
    onEnd()
  }
  osc.onended = stop
  return stop
}

const HIT_X = 8 // 판정 고리 위치(%)
const track = { position: 'relative', flex: '1 0 auto', height: 'clamp(220px, 32vh, 340px)', minHeight: 220, margin: '8px 0', borderRadius: 14, border: '1px solid #4e3b70', background: 'radial-gradient(circle at 20% 30%, #2b1d52, #0d0820)', overflow: 'hidden' }
const ring = { position: 'absolute', boxSizing: 'border-box', top: '50%', width: 'clamp(48px, 7vw, 88px)', height: 'clamp(48px, 7vw, 88px)', transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 0 18px #c4a5ff' }
const arrow = { position: 'absolute', top: '50%', width: 'clamp(40px, 5.6vw, 72px)', height: 'clamp(40px, 5.6vw, 72px)', transform: 'translate(-50%, -50%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(28px, 3.6vw, 48px)', fontWeight: 900, color: '#1a1030' }
const judgeText = { position: 'absolute', left: 0, right: 0, top: 16, textAlign: 'center', fontSize: 'clamp(24px, 2.6vw, 36px)', fontWeight: 800 }
const pad = { flexShrink: 0, width: 'clamp(52px, 6vw, 80px)', height: 'clamp(52px, 6vw, 80px)', borderRadius: 12, border: '2px solid', background: 'rgba(255,255,255,0.06)', fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 900, cursor: 'pointer', touchAction: 'manipulation' }
const text = { margin: '6px 0', lineHeight: 1.6, flexShrink: 0 }
const row = { display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 'auto', paddingTop: 12, flexWrap: 'wrap' }
const btn = { minHeight: 48, maxWidth: '100%', padding: '10px clamp(14px, 2vw, 28px)', borderRadius: 10, border: '1px solid transparent', background: '#c4a5ff', color: '#1a1030', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }
const btnGhost = { ...btn, background: 'transparent', color: '#e9ddff', border: '1px solid #6b5a8f' }
