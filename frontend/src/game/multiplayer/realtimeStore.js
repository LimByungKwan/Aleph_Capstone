import { create } from 'zustand'
import { API_URL, USE_SERVER, freshToken, handleSessionReplaced, logout, openLogin, useSessionStore } from '../../api/session.js'
import { useSettings } from '../settingsStore.js'
import { useSeasonStore } from '../seasons.js'

// [지민] 멀티 접속 연결 관리 — 서버(server/src/realtime.js)와 WebSocket으로 위치를 주고받음
// - 서버 모드(VITE_API_URL)에서만 켜짐. mock 모드는 혼자 플레이(예전 그대로)
// - 끊기면 1초 → 2초 → 4초 … 최대 30초 간격으로 다시 연결 (Render 무료 서버가 깨어나는 동안 포함)
// - 로그인·로그아웃하면 다시 연결해서 다른 사람에게 보이는 이름을 바꿈

/** peers[id] = { id, name, characterId, state: [x, y, z, 방향, 속도, 땅위(0/1)] | null, seen: 마지막으로 위치를 받은 시각(ms) } */
export const useRealtimeStore = create(() => ({
  status: 'off', // 'off' | 'connecting' | 'online' | 'full'(정원이 차서 혼자 플레이 중)
  maxPeers: null, // 정원이 찼을 때 서버가 알려 준 정원
  selfId: null,
  peers: {},
  chats: [], // 말풍선 채팅 최근 것: { key, id, name, text, at }
  world: { timeOfDay: null, season: null }, // 관리자가 정한 값 (null = 각자 기본값)
}))

const CHAT_KEEP = 30
/** 손님이 채팅하려 할 때 띄우는 로그인 창 문구 (ChatBox와 같이 씀) */
export const CHAT_LOGIN = { title: '로그인하고 채팅하기', reason: '채팅은 로그인한 순례객만 쓸 수 있어요.' }
let chatKey = 0

// [지민] 관리자가 정한 시간대·계절을 이 화면에 적용 (null이면 건드리지 않음 / 계절 null = 자동)
function applyWorld(world) {
  const before = useRealtimeStore.getState().world
  useRealtimeStore.setState({ world })
  if (world.timeOfDay) useSettings.setState({ timeOfDay: world.timeOfDay })
  // 계절: 관리자가 정했으면 그 값, 관리자가 '자동'으로 되돌렸을 때만 자동으로 (주소의 ?season= 미리보기는 그대로 둠)
  if (world.season) useSeasonStore.getState().setPreview(world.season)
  else if (before.season) useSeasonStore.getState().setPreview(null)
}

const WS_URL = USE_SERVER ? API_URL.replace(/^http/, 'ws') + '/realtime' : ''
let ws = null
let wanted = false
let retryMs = 1000
let retryTimer = null
let characterId = 'male'
let loginRetried = false // 4005를 받고 토큰을 새로 받아 한 번 다시 붙었는지 (welcome 받으면 초기화)
let fullNow = false // 서버가 정원 참(4003)으로 끊었는지
const FULL_RETRY_MS = 30_000

// [병관] 'tarot.'·'photo.'·'lift.'·'episode.' 메시지는 데이트 코스 멀티 기능으로 넘김
const tarotListeners = new Set()
export function onTarotMessage(fn) {
  tarotListeners.add(fn)
  return () => tarotListeners.delete(fn)
}

// [혜진] 'hj.' 메시지는 영화·드라마 구역(경복궁·경성) 동기화로 넘김 (components/movieZone/hjSync.js)
const hjListeners = new Set()
export function onHjMessage(fn) {
  hjListeners.add(fn)
  return () => hjListeners.delete(fn)
}
export function sendHj(msg) {
  if (typeof msg?.t === 'string' && msg.t.startsWith('hj.')) sendRaw(msg)
}

const setPeers = (fn) => useRealtimeStore.setState((s) => ({ peers: fn(s.peers) }))

function handle(msg) {
  if (msg.t === 'welcome') {
    retryMs = 1000
    loginRetried = false
    useRealtimeStore.setState({
      status: 'online',
      maxPeers: null,
      selfId: msg.id,
      peers: Object.fromEntries(msg.peers.map((p) => [p.id, { ...p, seen: Date.now() }])),
    })
  } else if (msg.t === 'join' || msg.t === 'peer') {
    setPeers((peers) => ({ ...peers, [msg.peer.id]: { ...peers[msg.peer.id], ...msg.peer, state: peers[msg.peer.id]?.state ?? msg.peer.state, seen: peers[msg.peer.id]?.seen ?? Date.now() } }))
  } else if (msg.t === 'leave') {
    setPeers((peers) => {
      const next = { ...peers }
      delete next[msg.id]
      return next
    })
  } else if (msg.t === 'full') {
    fullNow = true
    useRealtimeStore.setState({ maxPeers: Number(msg.max) || null })
  } else if (msg.t === 'world' && msg.world) {
    applyWorld({ timeOfDay: msg.world.timeOfDay ?? null, season: msg.world.season ?? null })
  } else if (msg.t === 'chat' && typeof msg.text === 'string') {
    const chat = { key: ++chatKey, id: msg.id, name: String(msg.name ?? ''), text: msg.text, at: Date.now() }
    useRealtimeStore.setState((s) => ({ chats: [...s.chats, chat].slice(-CHAT_KEEP) }))
  } else if (msg.t === 'chat.denied') {
    // 서버가 손님으로 봄 (로그인 안 함·토큰 만료) → 채팅은 로그인한 계정만 (server/src/realtime.js)
    openLogin(CHAT_LOGIN)
  } else if (typeof msg.t === 'string' && /^(tarot|photo|lift|episode)\./.test(msg.t)) {
    tarotListeners.forEach((fn) => fn(msg))
  } else if (typeof msg.t === 'string' && msg.t.startsWith('hj.')) {
    hjListeners.forEach((fn) => fn(msg))
  } else if (msg.t === 'state') {
    const selfId = useRealtimeStore.getState().selfId
    const now = Date.now()
    setPeers((peers) => {
      const next = { ...peers }
      for (const [id, ...state] of msg.s) if (id !== selfId && next[id]) next[id] = { ...next[id], state, seen: now }
      return next
    })
  }
}

function open() {
  if (!WS_URL || ws) return
  if (useRealtimeStore.getState().status !== 'full') useRealtimeStore.setState({ status: 'connecting' }) // 정원 안내는 다시 시도하는 동안 유지
  const socket = new WebSocket(WS_URL)
  ws = socket
  socket.onopen = async () => {
    // 토큰은 주소(?token=)가 아니라 첫 메시지로 보냄 → 서버·프록시 접속 기록에 토큰이 남지 않음
    // 서버는 손님을 받지 않음(4005) → 만료가 가까우면 먼저 새 토큰을 받아서 보냄
    const token = await freshToken()
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'hello', token, characterId }))
  }
  socket.onmessage = (event) => {
    try {
      handle(JSON.parse(event.data))
    } catch {
      // 모르는 메시지는 무시
    }
  }
  socket.onclose = (event) => {
    if (ws === socket) ws = null
    const full = event?.code === 4003 || fullNow
    fullNow = false
    useRealtimeStore.setState({ status: full ? 'full' : 'off', selfId: null, peers: {}, chats: [] })
    // 4003: 정원이 참 → 혼자 플레이로 계속하고 30초마다 자리가 났는지 다시 시도
    if (full && wanted) {
      clearTimeout(retryTimer)
      retryTimer = setTimeout(open, FULL_RETRY_MS)
      return
    }
    // 계정당 멀티 접속 1개 (server/src/realtime.js)
    //   4001: 다른 기기에서 같은 계정으로 로그인 → 이 기기는 로그아웃 + 안내, 아래에서 손님으로 다시 연결
    //   4002: 같은 로그인으로 다른 탭·창이 접속 → 다시 붙지 않음 (다시 붙으면 두 탭이 서로 끊는 반복)
    if (event?.code === 4001 && useSessionStore.getState().session) handleSessionReplaced()
    if (event?.code === 4002) return
    // 4005: 서버가 로그인한 계정으로 못 봄(토큰 만료·잘못됨) → 새 토큰도 못 받으면 로그아웃(로그인 화면으로)
    //   새 토큰으로도 또 4005면(서버가 Supabase에 확인을 못 하는 등) 아래의 보통 재시도 간격으로 넘어감 → 빠른 반복 방지
    if (event?.code === 4005 && !loginRetried) {
      if (!useSessionStore.getState().session) return
      loginRetried = true
      freshToken().then((token) => {
        if (!token) return logout()
        if (wanted) open()
      })
      return
    }
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
  sendRaw({ t: 'bye' })
  ws?.close()
  ws = null
}

function sendRaw(msg) {
  if (ws?.readyState === WebSocket.OPEN && useRealtimeStore.getState().status === 'online') ws.send(JSON.stringify(msg))
}

/** 내 위치 보내기 (MultiplayerPresence가 0.1초마다 부름) */
export function sendMove(p, r, s, g, waving) {
  sendRaw({ t: 'move', p, r, s, g, waving })
}

/** [병관] 데이트 코스 멀티 메시지 보내기 (tarot.* · photo.* · lift.* · episode.* 만) */
export function sendTarot(msg) {
  if (typeof msg?.t === 'string' && /^(tarot|photo|lift|episode)\./.test(msg.t)) sendRaw(msg)
}

/** 말풍선 채팅 보내기 (1~80자). 서버가 모두에게(나 포함) 돌려줘서 그때 말풍선이 뜸 */
export function sendChat(text) {
  const t = String(text ?? '').trim().slice(0, 80)
  if (t) sendRaw({ t: 'chat', text: t })
}

/** [지민] 관리자: 모든 사람의 시간대·계절 바꾸기 (서버가 관리자인지 다시 확인함). { timeOfDay?, season? } */
export function sendWorld(change) {
  sendRaw({ t: 'world.set', ...change })
}

export function sendCharacter(id) {
  characterId = id
  sendRaw({ t: 'char', characterId: id })
}

// 창을 닫거나 다른 사이트로 갈 때 → 서버에 바로 알려서 내 캐릭터가 다른 사람 화면에서 곧바로 사라지게
// (그냥 닫으면 중간 프록시가 연결을 늦게 끊어서 최대 1분 가까이 캐릭터가 남아 있었음)
if (USE_SERVER && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    sendRaw({ t: 'bye' })
    ws?.close()
  })
  // 뒤로 가기 캐시(bfcache)에서 돌아오면 다시 연결
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && wanted) open()
  })
}

// 로그인·로그아웃·닉네임 변경 → 다시 연결 (서버가 토큰으로 DB에서 이름을 다시 읽음)
if (USE_SERVER) {
  useSessionStore.subscribe((state, prev) => {
    if ((state.user?.id === prev.user?.id && state.user?.name === prev.user?.name) || !wanted) return
    ws?.close() // onclose가 다시 연결함
    retryMs = 1000
  })
}
