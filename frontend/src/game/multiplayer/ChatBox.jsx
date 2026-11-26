import { useEffect, useRef, useState } from 'react'
import { USE_SERVER } from '../../api/session.js'
import { sendChat, useRealtimeStore } from './realtimeStore.js'
import { useGameStore } from '../../store/gameStore.js'

// [지민] 말풍선 채팅 입력창 (맵 어디서나) — 화면 아래 가운데
// - Enter: 입력창 열기 / 다시 Enter: 보내기 / Esc: 닫기
// - 보낸 글은 서버가 모두에게 돌려주고, 머리 위 말풍선(ChatBubble)과 왼쪽 아래 최근 글 목록에 뜸
// - 입력 중 키(WASD·Space 등)는 캐릭터 조작으로 넘어가지 않게 막음
const MAX = 80
const LOG_SHOW_MS = 12_000 // 최근 글 목록은 12초 지나면 흐려져 사라짐

export default function ChatBox() {
  const status = useRealtimeStore((s) => s.status)
  const maxPeers = useRealtimeStore((s) => s.maxPeers)
  const chats = useRealtimeStore((s) => s.chats)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [, setNow] = useState(0)
  const input = useRef(null)

  // Enter로 열기 (다른 입력칸에 쓰는 중이면 무시)
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Enter' || open || event.repeat) return
      if (useGameStore.getState().inputLocked) return // 다른 패널·미니게임이 열려 있으면 그쪽 Enter
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  // 오래된 글을 목록에서 빼려고 2초마다 다시 그림
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(timer)
  }, [])

  if (!USE_SERVER) return null
  const online = status === 'online'
  const recent = chats.filter((c) => Date.now() - c.at < LOG_SHOW_MS).slice(-5)

  const submit = () => {
    if (text.trim()) sendChat(text)
    setText('')
    setOpen(false)
    input.current?.blur()
  }

  return (
    <>
      {recent.length > 0 && (
        <div style={styles.log} aria-live="polite">
          {recent.map((c) => (
            <div key={c.key} style={styles.line}>
              <b>{c.name}</b> {c.text}
            </div>
          ))}
        </div>
      )}
      <div style={styles.bar}>
        {status === 'full' ? (
          // 정원이 차서 멀티 접속을 못 함 → 혼자 둘러보기로 계속 (30초마다 자동으로 다시 시도)
          <div style={styles.full} role="status">
            지금 접속자가 많아요{maxPeers ? ` (정원 ${maxPeers}명)` : ''} · 혼자 둘러보는 중이고, 자리가 나면 자동으로 들어가요
          </div>
        ) : open ? (
          <form
            style={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <input
              ref={input}
              value={text}
              maxLength={MAX}
              placeholder={online ? '말풍선으로 보낼 말 (Enter 보내기 · Esc 닫기)' : '서버에 연결 중이에요…'}
              disabled={!online}
              onChange={(event) => setText(event.target.value)}
              // 입력 중 키가 캐릭터 조작(창 전체 키 입력)으로 넘어가지 않게
              onKeyDown={(event) => {
                event.stopPropagation()
                // 한글 조합 중 Enter는 글자 확정용 → 보내지 않음 (맥·사파리에서 두 번 보내지던 문제 방지)
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (!event.nativeEvent.isComposing && event.keyCode !== 229) submit()
                  return
                }
                if (event.key === 'Escape') {
                  setText('')
                  setOpen(false)
                  event.currentTarget.blur()
                }
              }}
              onKeyUp={(event) => event.stopPropagation()}
              onBlur={() => !text.trim() && setOpen(false)}
              style={styles.input}
              aria-label="채팅 입력"
            />
            <button type="submit" style={styles.send} disabled={!online || !text.trim()}>
              보내기
            </button>
          </form>
        ) : (
          <button
            type="button"
            style={styles.open}
            onClick={(event) => {
              event.currentTarget.blur()
              setOpen(true)
            }}
            title="채팅 (Enter)"
            aria-label="채팅 열기"
          >
            💬 채팅 <span style={styles.key}>Enter</span>
          </button>
        )}
      </div>
    </>
  )
}

const styles = {
  bar: { position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 20, width: 'min(420px, calc(100vw - 32px))', display: 'flex', justifyContent: 'center', pointerEvents: 'none' },
  form: { display: 'flex', gap: 6, width: '100%', pointerEvents: 'auto' },
  input: { flex: 1, minWidth: 0, padding: '9px 12px', border: 'none', borderRadius: 999, background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 10px rgba(0,0,0,0.18)', fontSize: 14, color: '#1f2937', outline: 'none' },
  send: { padding: '0 14px', border: 'none', borderRadius: 999, background: '#f472b6', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  open: { pointerEvents: 'auto', padding: '7px 14px', border: 'none', borderRadius: 999, background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer' },
  full: { pointerEvents: 'auto', padding: '7px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: 12, fontWeight: 600, color: '#6b4a1f', textAlign: 'center' },
  key: { marginLeft: 4, padding: '1px 5px', borderRadius: 4, background: '#f3f4f6', fontSize: 11, color: '#6b7280' },
  log: { position: 'absolute', left: 12, bottom: 100, zIndex: 19, maxWidth: 'min(360px, calc(100vw - 24px))', display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'none' },
  line: { padding: '4px 10px', borderRadius: 10, background: 'rgba(17,24,39,0.55)', color: '#fff', fontSize: 13, lineHeight: 1.35, wordBreak: 'break-all' },
}
