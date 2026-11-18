import { useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { BANNED_NAMES } from '../boss/promoRules.js'
import { useSgStudio } from '../../game/Map/styles/sg_studioStore.js'

// 물결 레코딩 스튜디오 TTS 화면 UI. 담당: 성근(SG)
// 3D 쪽(감지·E키·외벽)은 game/Map/styles/sg_studio.jsx
//
// TTS는 브라우저 내장 speechSynthesis를 씀 (A안)
// - 서버·API 키·비용이 없음. 대신 mp3 저장은 안 되고, 목소리는 기기마다 다름
// - 3D 안의 drei <Html>은 기준점이 카메라 뒤로 가면 스스로 숨어서, 화면 UI는 Canvas 밖 일반 DOM으로 그림

const MAX_LEN = 150 // 한 번에 읽어 줄 최대 글자 수 (긴 글로 오래 붙잡히지 않게)

export default function StudioPanel() {
  const near = useSgStudio((s) => s.near)
  const step = useSgStudio((s) => s.step)
  if (step === 'closed' && !near) return null

  return (
    <div style={hudWrap}>
      {step === 'closed' ? (
        <div style={chip}>
          <kbd style={kbd}>E</kbd> 물결 레코딩 스튜디오 · 내 문장 녹음해 보기
        </div>
      ) : (
        <Panel />
      )}
    </div>
  )
}

// 입력 → 소리 확인 → 재생. text를 이 컴포넌트에 둬서 확인 단계에서 "아니요"로 돌아와도 글자가 남음
function Panel() {
  const step = useSgStudio((s) => s.step)
  const error = useSgStudio((s) => s.error)
  const [text, setText] = useState('')
  const [warning, setWarning] = useState(null)
  const close = () => useGameStore.getState().close()

  const ask = () => {
    const problem = checkText(text)
    setWarning(problem)
    if (!problem) useSgStudio.getState().setStep('confirm')
  }

  const speak = () => {
    const s = useSgStudio.getState()
    const voice = pickVoice()
    if (voice.error) {
      s.setError(voice.error)
      s.setStep('input')
      return
    }
    const utterance = new SpeechSynthesisUtterance(text.trim())
    utterance.lang = 'ko-KR'
    if (voice.voice) utterance.voice = voice.voice
    utterance.onend = () => {
      if (useSgStudio.getState().step === 'speaking') useSgStudio.getState().setStep('input')
    }
    utterance.onerror = (event) => {
      // 정지 버튼(cancel)도 onerror로 들어와서, 사용자가 멈춘 경우는 오류로 보지 않음
      if (event.error !== 'interrupted' && event.error !== 'canceled') useSgStudio.getState().setError('failed')
      if (useSgStudio.getState().step === 'speaking') useSgStudio.getState().setStep('input')
    }
    s.setError(null)
    s.setStep('speaking')
    window.speechSynthesis.cancel() // 앞에 남은 재생이 있으면 비우고 시작
    window.speechSynthesis.speak(utterance)
  }

  const stop = () => window.speechSynthesis.cancel()

  return (
    <div style={panel}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>🎙 물결 레코딩 스튜디오</div>

      {step === 'input' && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LEN}
            rows={3}
            placeholder="읽어 줄 문장을 적어 주세요. 예: 오늘 공연 정말 최고였어요!"
            style={textarea}
            autoFocus
          />
          <div style={row}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{text.length} / {MAX_LEN}</span>
            <span>
              <button style={btnGhost} onClick={close}>닫기</button>
              <button style={btn} onClick={ask}>▶ 재생</button>
            </span>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div style={{ marginBottom: 6 }}>🔊 지금 소리를 들을 수 있는 상태인가요?</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>음소거·볼륨을 확인해 주세요.</div>
          <div style={{ ...row, justifyContent: 'flex-end' }}>
            <button style={btnGhost} onClick={() => useSgStudio.getState().setStep('input')}>아니요</button>
            <button style={btn} onClick={speak}>예, 재생</button>
          </div>
        </>
      )}

      {step === 'speaking' && (
        <div style={row}>
          <span>🎵 재생 중…</span>
          <button style={btn} onClick={stop}>■ 정지</button>
        </div>
      )}

      {(warning || error) && step === 'input' && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#ffb2bd' }}>{warning ?? ERROR_TEXT[error]}</div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
        <kbd style={kbd}>ESC</kbd> 나가기 · 목소리는 기기에 깔린 음성을 써요
      </div>
    </div>
  )
}

const ERROR_TEXT = {
  unsupported: '이 브라우저는 음성 읽기를 지원하지 않아요. Chrome이나 Edge에서 열어 주세요.',
  noKoreanVoice: '이 기기에 한국어 목소리가 없어요. 기기 설정에서 한국어 음성을 추가해 주세요.',
  failed: '재생 중에 문제가 생겼어요. 다시 시도해 주세요.',
}

// 입력 검사. 문제 없으면 null
// shortcut: 욕설 필터는 없음, 공개 시연 전에 금지어 목록을 붙이거나 서버(B안)로 옮길 때 서버에서 검사
function checkText(text) {
  const trimmed = text.trim()
  if (!trimmed) return '읽어 줄 문장을 먼저 적어 주세요.'
  if (trimmed.length > MAX_LEN) return `${MAX_LEN}자까지 적을 수 있어요.`
  if (BANNED_NAMES.some((name) => name && trimmed.includes(name))) return '실존 인물 이름은 쓸 수 없어요.'
  return null
}

// 한국어 목소리 고르기. getVoices()가 아직 비어 있으면(브라우저가 늦게 채움) lang만 지정하고 시도
function pickVoice() {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return { error: 'unsupported' }
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return { voice: null }
  const korean = voices.find((v) => v.lang?.toLowerCase().startsWith('ko'))
  return korean ? { voice: korean } : { error: 'noKoreanVoice' }
}

const hudWrap = { position: 'absolute', left: 0, right: 0, bottom: 72, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const panel = { width: 360, padding: '12px 14px', borderRadius: 10, background: 'rgba(20,32,40,0.88)', color: '#fff', fontSize: 14, pointerEvents: 'auto' }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }
const textarea = { width: '100%', boxSizing: 'border-box', resize: 'none', padding: 8, borderRadius: 6, border: '1px solid #41646c', background: '#0f1a20', color: '#fff', fontSize: 14, fontFamily: 'inherit' }
const btn = { marginLeft: 6, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#64cdbc', color: '#0f1a20', fontWeight: 700, cursor: 'pointer' }
const btnGhost = { ...btn, background: 'transparent', color: '#ddfff6', border: '1px solid #41646c' }
