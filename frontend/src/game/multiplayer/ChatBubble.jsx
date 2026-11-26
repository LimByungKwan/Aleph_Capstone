import { useEffect, useState } from 'react'
import { useRealtimeStore } from './realtimeStore.js'

// [지민] 머리 위 말풍선 — 그 사람이 마지막으로 보낸 채팅을 6초 동안 보여 줌
const SHOW_MS = 6000

/** id 사람의 지금 보여 줄 채팅 글 (없으면 null) */
export function useChatBubble(id) {
  const latest = useRealtimeStore((s) => {
    for (let i = s.chats.length - 1; i >= 0; i--) if (s.chats[i].id === id) return s.chats[i]
    return null
  })
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!latest) return
    const left = SHOW_MS - (Date.now() - latest.at)
    if (left <= 0) return
    const timer = setTimeout(() => setTick((n) => n + 1), left) // 시간이 지나면 다시 그려서 말풍선을 내림
    return () => clearTimeout(timer)
  }, [latest])
  return latest && Date.now() - latest.at < SHOW_MS ? latest.text : null
}

export function ChatBubbleBox({ text }) {
  if (!text) return null
  return (
    <div style={bubble}>
      {text}
      <span style={tail} />
    </div>
  )
}

const bubble = {
  position: 'relative',
  width: 'max-content',
  maxWidth: 220,
  marginBottom: 6,
  padding: '6px 10px',
  borderRadius: 12,
  background: '#ffffff',
  color: '#1f2937',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 500,
  whiteSpace: 'normal',
  wordBreak: 'break-all',
  textAlign: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
}
const tail = {
  position: 'absolute',
  left: '50%',
  bottom: -5,
  width: 10,
  height: 10,
  background: '#ffffff',
  transform: 'translateX(-50%) rotate(45deg)',
}
