import { create } from 'zustand'
import { API_URL, USE_SERVER, useSessionStore } from '../../api/session.js'

// [지민] 멀티 접속 연결 관리 — 서버(server/src/realtime.js)와 WebSocket으로 위치를 주고받음
// - 서버 모드(VITE_API_URL)에서만 켜짐. mock 모드는 혼자 플레이(예전 그대로)
// - 끊기면 1초 → 2초 → 4초 … 최대 30초 간격으로 다시 연결 (Render 무료 서버가 깨어나는 동안 포함)
// - 로그인·로그아웃하면 다시 연결해서 다른 사람에게 보이는 이름을 바꿈

/** peers[id] = { id, name, characterId, state: [x, y, z, 방향, 속도, 땅위(0/1)] | null } */
export const useRealtimeStore = create(() => ({
  status: 'off', // 'off' | 'connecting' | 'online'
  selfId: null,
  peers: {},
}))

const WS_URL = USE_SERVER ? API_URL.replace(/^http/, 'ws') + '/realtime' : ''
let ws = null
let wanted = false
let retryMs = 1000
let retryTimer = null
let characterId = 'male'

// [병관] 'tarot.'·'photo.'으로 시작하는 메시지는 데이트 코스 멀티(커플 타로 bk_tarotRoom.js · 인생네컷 bk_photoRoom.js)로 넘김
const tarotListeners = new Set()
export function onTarotMessage(fn) {
  tarotListeners.add(fn)
  return () => tarotListeners.delete(fn)
}

const setPeers = (fn) => useRealtimeStore.setState((s) => ({ peers: fn(s.peers) }))

function handle(msg) {
  if (msg.t === 'welcome') {
    retryMs = 1000
    useRealtimeStore.setState({
      status: 'online',
      selfId: msg.id,
      peers: Object.fromEntries(msg.peers.map((p) => [p.id, p])),
    })
  } else if (msg.t === 'join' || msg.t === 'peer') {
    setPeers((peers) => ({ ...peers, [msg.peer.id]: { ...peers[msg.peer.id], ...msg.peer, state: peers[msg.peer.id]?.state ?? msg.peer.state } }))
  } else if (msg.t === 'leave') {
    setPeers((peers) => {
      const next = { ...peers }
      delete next[msg.id]
      return next
    })
  } else if (typeof msg.t === 'string' && /^(tarot|photo)\./.test(msg.t)) {
    tarotListeners.forEach((fn) => fn(msg))
  } else if (msg.t === 'state') {
    const selfId = useRealtimeStore.getState().selfId
    setPeers((peers) => {
      const next = { ...peers }
      for (const [id, ...state] of msg.s) if (id !== selfId && next[id]) next[id] = { ...next[id], state }
      return next
    })
  }
}

function open() {
  if (!WS_URL || ws) return
  useRealtimeStore.setState({ status: 'connecting' })
  const socket = new WebSocket(WS_URL)
  ws = socket
  socket.onopen = () => {
    // 토큰은 주소(?token=)가 아니라 첫 메시지로 보냄 → 서버·프록시 접속 기록에 토큰이 남지 않음
    const token = useSessionStore.getState().session?.accessToken
    socket.send(JSON.stringify({ t: 'hello', token, characterId }))
  }
  socket.onmessage = (event) => {
    try {
      handle(JSON.parse(event.data))
    } catch {
      // 모르는 메시지는 무시
    }
  }
  socket.onclose = () => {
    if (ws === socket) ws = null
    useRealtimeStore.setState({ status: 'off', selfId: null, peers: {} })
    if (!wanted) return
    clearTimeout(retryTimer)
    retryTimer = setTimeout(open, retryMs)
    retryMs = Math.min(retryMs * 2, 30_000)
  }
}

export function connectRealtime(initialCharacterId) {
  if (!USE_SERVER) return
  if (initialCharacterId) characterId = initialCharacterId
  wanted = true
  open()
}

export function disconnectRealtime() {
  wanted = false
  clearTimeout(retryTimer)
  ws?.close()
  ws = null
}

function sendRaw(msg) {
  if (ws?.readyState === WebSocket.OPEN && useRealtimeStore.getState().status === 'online') ws.send(JSON.stringify(msg))
}

/** 내 위치 보내기 (MultiplayerPresence가 0.1초마다 부름) */
export function sendMove(p, r, s, g) {
  sendRaw({ t: 'move', p, r, s, g })
}

/** [병관] 데이트 코스 멀티 메시지 보내기 (tarot.* · photo.* 만) */
export function sendTarot(msg) {
  if (typeof msg?.t === 'string' && /^(tarot|photo)\./.test(msg.t)) sendRaw(msg)
}

export function sendCharacter(id) {
  characterId = id
  sendRaw({ t: 'char', characterId: id })
}

// 로그인·로그아웃·닉네임 변경 → 다시 연결 (서버가 토큰으로 DB에서 이름을 다시 읽음)
if (USE_SERVER) {
  useSessionStore.subscribe((state, prev) => {
    if ((state.user?.id === prev.user?.id && state.user?.name === prev.user?.name) || !wanted) return
    ws?.close() // onclose가 다시 연결함
    retryMs = 1000
  })
}
