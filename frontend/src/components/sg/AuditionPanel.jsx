import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { AUDITION_SONG } from '../../game/Map/styles/sg_auditionStore.js'
import { recordTake, uploadTake } from './auditionTake.js'
import KeyboardRhythm, { JudgeFeedback, playMelody } from './KeyboardRhythm.jsx'
import { detectMicMode } from './micMode.js'

// 썬그레이 오디션 화면. 담당: 성근(SG)
// 3D 쪽(세트·심사위원·마이크 앞 감지·E키)은 game/Map/styles/sg_audition.jsx
// 흐름: 준비(미리 듣기) → 노래로 도전(마이크 권한) → 3·2·1 → 녹음(음표 막대만, 소리 없음) → 심사 → 결과
// - 부르는 동안 멜로디 소리를 틀지 않음: 스피커 소리가 마이크로 들어가 채점이 틀어지므로
// - 다시 시작·닫기를 누르면 그 시도의 결과는 버림 (늦게 도착한 이전 결과가 새 화면을 덮지 않게 시도 번호로 확인)

const COUNTDOWN = 3
const TAIL_SECONDS = 2.5 // 늦은 시작도 담되 서버의 곡 끝+6초 안에서 끝낸다.
const STATUS = { ok: ['정확', '#9be7c4'], flat: ['낮음', '#8ab4ff'], sharp: ['높음', '#ffb86b'], crack: ['삑사리', '#ff6b8b'], missed: ['안 들림', '#6b5a8f'] }

export default function AuditionPanel() {
  const [notes, setNotes] = useState(null)
  const [phase, setPhase] = useState('ready') // ready | asking | retry | keyboard | countdown | recording | judging | result | error
  const [count, setCount] = useState(COUNTDOWN)
  const [now, setNow] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const attempt = useRef(0)
  const take = useRef(null)
  const preview = useRef(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}audition/${AUDITION_SONG}.json`)
      .then((r) => r.json())
      .then((data) => setNotes(data.notes))
      .catch(() => setError('멜로디를 불러오지 못했어요.'))
  }, [])

  // 패널이 닫히면(닫기·ESC) 녹음·미리 듣기를 멈추고 진행 중인 시도를 무효로
  useEffect(() => () => {
    attempt.current += 1
    take.current?.stop()
    preview.current?.()
  }, [])

  const songEnd = notes ? notes.at(-1).start + notes.at(-1).duration : 0

  const listen = () => {
    preview.current?.()
    setPreviewing(true)
    preview.current = playMelody(notes, () => setPreviewing(false))
  }

  const challenge = async () => {
    preview.current?.()
    const id = ++attempt.current
    take.current?.stop()
    setResult(null)
    setPhase('asking')
    const mic = await detectMicMode() // 버튼 클릭 직후 권한 요청
    if (id !== attempt.current) return mic.stream?.getTracks().forEach((t) => t.stop())
    if (mic.mode !== 'sing') return setPhase(mic.mode)

    setPhase('countdown')
    for (let n = COUNTDOWN; n > 0; n--) {
      setCount(n)
      await wait(1000)
      if (id !== attempt.current) return mic.stream.getTracks().forEach((t) => t.stop())
    }
    take.current = recordTake(mic.stream, songEnd + TAIL_SECONDS)
    setPhase('recording')
    const started = performance.now()
    const tick = () => {
      if (id !== attempt.current) return
      const t = (performance.now() - started) / 1000
      setNow(t)
      if (t < songEnd + TAIL_SECONDS) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    try {
      const wav = await take.current.done
      if (id !== attempt.current) return
      setPhase('judging')
      const judged = await uploadTake(AUDITION_SONG, wav)
      if (id !== attempt.current) return
      setResult(judged)
      setPhase('result')
    } catch (e) {
      if (id !== attempt.current) return
      setError(e?.message || '녹음을 처리하지 못했어요.')
      setPhase('error')
    }
  }

  const finishEarly = () => take.current?.stop() // 다 불렀으면 바로 심사
  const close = () => useGameStore.getState().close()

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ fontSize: 'clamp(24px, 2.2vw, 34px)', fontWeight: 800, marginBottom: 6 }}>🎤 SUNGRAY 오디션 · 연습곡 1</div>

        {phase === 'ready' && (
          <>
            <p style={text}>먼저 멜로디를 듣고, 준비되면 <b>노래로 도전</b>을 누르세요. 3·2·1 뒤에 녹음이 시작돼요.</p>
            <p style={{ ...text, fontSize: 'clamp(14px, 1.4vw, 18px)', color: '#d3c6e9' }}>부르는 동안에는 소리가 나오지 않아요. 화면의 음표 막대를 보며 불러 주세요. 조용한 곳에서 하면 더 정확해요.</p>
            {notes && <Roll notes={notes} now={-1} end={songEnd} />}
            <div style={row}>
              <button style={btnGhost} onClick={close}>닫기</button>
              <button style={btnGhost} onClick={listen} disabled={!notes || previewing}>{previewing ? '♪ 재생 중' : '▶ 미리 듣기'}</button>
              <button style={btn} onClick={challenge} disabled={!notes}>🎙 노래로 도전</button>
            </div>
          </>
        )}

        {phase === 'asking' && <p style={text}>마이크 권한을 확인하고 있어요… 브라우저 창에서 <b>허용</b>을 눌러 주세요.</p>}

        {phase === 'retry' && (
          <>
            <p style={text}>다른 앱(화상회의 등)이 마이크를 쓰고 있어요. 그 앱을 끄고 다시 시도해 주세요.</p>
            <div style={row}>
              <button style={btnGhost} onClick={close}>닫기</button>
              <button style={btnGhost} onClick={() => setPhase('keyboard')}>⌨ 키보드로 하기</button>
              <button style={btn} onClick={challenge}>다시 시도</button>
            </div>
          </>
        )}

        {phase === 'keyboard' && (
          <>
            <KeyboardRhythm songId={AUDITION_SONG} notes={notes} onClose={close} />
            <p style={{ ...text, fontSize: 'clamp(14px, 1.4vw, 18px)', color: '#d3c6e9' }}>노래로 하려면 주소창 왼쪽 자물쇠 아이콘에서 마이크를 허용한 뒤 다시 열어 주세요.</p>
          </>
        )}

        {phase === 'countdown' && <div style={big}>{count}</div>}

        {phase === 'recording' && (
          <>
            <p style={{ ...text, color: '#ff8fa3' }}>● 녹음 중 · {Math.max(0, Math.ceil(songEnd + TAIL_SECONDS - now))}초</p>
            <Roll notes={notes} now={now} end={songEnd} />
            <div style={row}>
              <button style={btnGhost} onClick={challenge}>처음부터 다시</button>
              <button style={btn} onClick={finishEarly}>다 불렀어요</button>
            </div>
          </>
        )}

        {phase === 'judging' && <p style={text}>🎧 심사위원들이 듣고 있어요… (처음에는 서버가 깨어나느라 조금 걸릴 수 있어요)</p>}

        {phase === 'result' && result && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: 'clamp(44px, 5vw, 72px)', fontWeight: 800 }}>{result.score}</span>
              <span>점 · {result.score >= 80 ? '🎉 합격!' : '다음 기회에!'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(28px, 1fr))', gap: 6, margin: '12px 0' }}>
              {result.notes.map((n) => (
                <div key={n.index} title={`${n.index}번 ${STATUS[n.status][0]}`} style={{ minWidth: 0, textAlign: 'center', fontSize: 'clamp(14px, 1.4vw, 18px)' }}>
                  <div style={{ height: 'clamp(24px, 4vh, 38px)', borderRadius: 6, background: STATUS[n.status][1] }} />
                  {n.index}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 'clamp(14px, 1.4vw, 18px)', color: '#d3c6e9', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.values(STATUS).map(([label, color]) => (
                <span key={label} style={{ marginRight: 8 }}><span style={{ color }}>■</span> {label}</span>
              ))}
            </div>
            <JudgeFeedback feedback={result.feedback} />
            {result.offset != null && Math.abs(result.offset) > 0.3 && (
              <p style={{ ...text, fontSize: 'clamp(14px, 1.4vw, 18px)', color: '#d3c6e9' }}>시작이 {Math.abs(result.offset).toFixed(1)}초 {result.offset > 0 ? '늦었지만' : '빨랐지만'} 맞춰서 채점했어요.</p>
            )}
            <div style={row}>
              <button style={btnGhost} onClick={close}>닫기</button>
              <button style={btn} onClick={challenge}>다시 도전</button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <p style={text}>{error}</p>
            <div style={row}>
              <button style={btnGhost} onClick={close}>닫기</button>
              <button style={btn} onClick={challenge}>다시 도전</button>
            </div>
          </>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 'clamp(14px, 1.4vw, 18px)', color: '#d3c6e9' }}>
          <kbd style={kbd}>ESC</kbd> 나가기
        </div>
      </div>
    </div>
  )
}

// 음표 막대(피아노 롤): 가로 = 시간, 세로 = 음 높이. now 위치에 세로선 (now < 0이면 숨김)
function Roll({ notes, now, end }) {
  const lo = Math.min(...notes.map((n) => n.midi)) - 1
  const hi = Math.max(...notes.map((n) => n.midi)) + 1
  const x = (t) => `${(100 * t) / end}%`
  return (
    <div style={roll}>
      {notes.map((n, i) => {
        const active = now >= n.start && now < n.start + n.duration
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: x(n.start), width: `calc(${x(n.duration)} - 3px)`, height: 'clamp(16px, 2.4vh, 24px)', borderRadius: 6,
              top: `${(100 * (hi - n.midi)) / (hi - lo + 1)}%`,
              background: active ? '#ffe066' : now > n.start + n.duration ? '#6b5a8f' : '#c4a5ff',
              boxShadow: active ? '0 0 10px #ffe066' : 'none',
            }}
          />
        )
      })}
      {now >= 0 && now <= end && <div style={{ position: 'absolute', top: 0, bottom: 0, left: x(now), width: 2, background: '#ff8fa3' }} />}
    </div>
  )
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// drei <Html> 이름표 위에 뜨게 응원봉 게임(CheerGame.jsx)과 같은 값
const overlay = { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5, 3, 18, 0.56)', zIndex: 16777280 }
// 작은 화면에서는 내용만 세로로 스크롤해 조작 버튼까지 닿게
const panel = { pointerEvents: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.2vh, 14px)', width: 'min(1220px, 92vw)', minHeight: 'min(750px, 86vh)', maxHeight: 'min(760px, 86vh)', overflowY: 'auto', overflowX: 'hidden', padding: 'clamp(16px, 2.4vw, 36px)', borderRadius: 20, border: '1px solid #756097', background: 'rgba(24,18,43,0.97)', boxShadow: '0 24px 80px #0009, 0 0 36px #b18cff22', color: '#fff', fontSize: 'clamp(16px, 1.5vw, 20px)', overflowWrap: 'anywhere', lineHeight: 1.5 }
const roll = { position: 'relative', flex: '1 0 auto', height: 'clamp(220px, 32vh, 340px)', minHeight: 220, margin: '8px 0', borderRadius: 14, border: '1px solid #4e3b70', background: '#160f26', overflow: 'hidden' }
const big = { fontSize: 'clamp(96px, 12vw, 180px)', fontWeight: 800, textAlign: 'center', margin: 'auto 0', padding: '24px 0', color: '#ffe066' }
const text = { margin: '6px 0', lineHeight: 1.6, flexShrink: 0 }
const kbd = { padding: '2px 7px', borderRadius: 4, background: '#fff', color: '#111', fontSize: '0.85em', fontWeight: 700 }
const row = { display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 'auto', paddingTop: 12, flexWrap: 'wrap' }
const btn = { minHeight: 48, maxWidth: '100%', padding: '10px clamp(14px, 2vw, 28px)', borderRadius: 10, border: '1px solid transparent', background: '#c4a5ff', color: '#1a1030', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }
const btnGhost = { ...btn, background: 'transparent', color: '#e9ddff', border: '1px solid #6b5a8f' }
