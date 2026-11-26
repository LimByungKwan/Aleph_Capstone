import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { createTarotRooms } from './bk_tarotRooms.js'
import { createPhotoRooms } from './bk_photoRooms.js'
import { createLifts } from './bk_lifts.js'
import { createEpisodeRooms } from './bk_episodeRooms.js'
import { createHjWorld } from './hj_world.js'

// 멀티 접속 (담당: 지민) — 같은 맵에 있는 사람들의 위치·방향·캐릭터를 실시간으로 주고받는다
//
// 구조: 화면 ──WebSocket(wss://…/realtime)──▶ 이 서버(Render) ──▶ 다른 화면들
//   - DB에 저장하지 않는다. 위치는 1초에 여러 번 바뀌는 값이라 메모리에만 두고, 나가면 지운다
//   - 서버가 받은 값을 그대로 뿌리지 않고 검사한 뒤, 0.1초마다 모아서 한 번에 보낸다(10Hz)
//     → 사람이 늘어도 메시지 수가 "사람 수 × 프레임 수"로 폭발하지 않음
//   - 이름은 화면이 보낸 값이 아니라 로그인 토큰으로 서버가 DB에서 읽은 값 → 남의 이름으로 위장 불가
//   - 손님(비로그인)도 접속 가능. 이름은 "손님"
//
// 메시지 (JSON, 짧은 키)
//   화면 → 서버  { t:'hello', token?, characterId? }   접속 직후 1번 (10초 안에 안 오면 끊음)
//               { t:'move', p:[x,y,z], r:방향(라디안), s:속도(m/s), g:땅 위인지 }
//               { t:'char', characterId }               캐릭터를 바꿨을 때
//   서버 → 화면  { t:'welcome', id, peers:[…] }          내 번호 + 이미 있는 사람들
//               { t:'join', peer } / { t:'leave', id } / { t:'peer', peer }(캐릭터 변경)
//               { t:'state', s:[[id,x,y,z,r,s,g], …] }  0.1초마다 움직인 사람만
//   'tarot.'으로 시작하는 메시지는 커플 타로 멀티, 'photo.'는 커플 포토존 인생네컷, 'lift.'는 전망대 엘리베이터 (병관, bk_tarotRooms.js · bk_photoRooms.js · bk_lifts.js)

export const REALTIME_PATH = '/realtime'

const DEFAULTS = {
  maxPeers: 50, // Render 무료 서버(512MB)에서 넉넉한 상한. 넘으면 접속 거절
  tickMs: 100, // 10Hz
  helloTimeoutMs: 10_000,
  heartbeatMs: 30_000, // 응답 없는 연결(와이파이 끊김 등) 정리 + Render가 연결을 끊지 않게 유지
  maxMessagesPerSecond: 40, // 화면은 10번/초 보냄. 4배 넘게 보내면 비정상으로 보고 끊음
  maxPayloadBytes: 1024,
}

const CHARACTER_RE = /^[a-z0-9_-]{1,32}$/
const MAP_LIMIT = 1000 // 맵은 수백 m 크기. 이보다 먼 좌표는 잘못된 값
const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits

function validMove(msg) {
  const { p, r, s } = msg
  if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return null
  const [x, y, z] = p
  if (Math.abs(x) > MAP_LIMIT || Math.abs(z) > MAP_LIMIT || y < -100 || y > 300) return null
  if (!Number.isFinite(r) || !Number.isFinite(s) || s < 0 || s > 30) return null
  return [round(x), round(y), round(z), round(r, 3), round(s), msg.g ? 1 : 0]
}

/** 다른 사람에게 보여 줄 정보만 (이메일·역할·DB id는 보내지 않음) */
const publicPeer = (peer) => ({ id: peer.id, name: peer.name, characterId: peer.characterId, state: peer.state })

/**
 * @param {import('node:http').Server} httpServer  app.listen()이 돌려준 서버
 * @param {object} deps
 * @param {{ anon: Function, asUser: Function }} deps.supabase
 * @param {string[]} deps.allowedOrigins  접속을 허용할 화면 주소 (CORS와 같은 목록)
 * @param {Function} [deps.readTarot]  커플 타로 AI 호출 (테스트에서 가짜로 바꿈)
 */
export function attachRealtime(httpServer, { supabase, allowedOrigins = [], options = {}, readTarot } = {}) {
  const cfg = { ...DEFAULTS, ...options }
  const peers = new Map() // ws → peer

  const wss = new WebSocketServer({
    server: httpServer,
    path: REALTIME_PATH,
    maxPayload: cfg.maxPayloadBytes,
    // 등록된 화면 주소에서 온 접속만 받음 (다른 사이트가 사용자 브라우저로 몰래 붙는 것 차단)
    verifyClient: ({ origin }, done) => {
      if (!allowedOrigins.includes(origin)) return done(false, 403, 'Forbidden origin')
      if (peers.size >= cfg.maxPeers) return done(false, 503, 'Too many players')
      done(true)
    },
  })

  const send = (ws, msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
  }
  const broadcast = (msg, except = null) => {
    const text = JSON.stringify(msg)
    for (const [ws, peer] of peers) if (peer.ready && ws !== except && ws.readyState === ws.OPEN) ws.send(text)
  }

  // [병관] 커플 타로 멀티: 같은 WebSocket 위에 타로 방 (bk_tarotRooms.js)
  const findPeer = (id) => {
    for (const [ws, peer] of peers) if (peer.ready && peer.id === id) return { ws, peer }
    return null
  }
  const tarot = createTarotRooms({ send, findPeer, ...(readTarot && { readTarot }), options: options.tarot })
  const photo = createPhotoRooms({ send, findPeer, options: options.photo })
  const lifts = createLifts({ broadcast, send, options: options.lift })
  const episodes = createEpisodeRooms({ send, findPeer, inviteMs: options.episode?.inviteMs })
  const hj = createHjWorld({ broadcast, send }) // [혜진] 경복궁·경성 문·앉기·탈것·시계 동기화 (hj_world.js)

  async function identify(token) {
    if (typeof token !== 'string' || !token) return { name: '손님', userId: null }
    const { data, error } = await supabase.anon().auth.getUser(token)
    if (error || !data?.user) return { name: '손님', userId: null } // 만료된 토큰이면 손님으로 (접속 자체는 허용)
    const db = supabase.asUser(token)
    const [{ data: profile }, session] = await Promise.all([
      db.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle(),
      Promise.resolve().then(() => db.rpc('session_ok')).catch(() => null),
    ])
    // 다른 기기에서 로그인해서 끊긴 토큰 → 접속 거절 (화면은 이 코드를 보고 로그아웃 안내). 확인 자체가 실패하면 막지 않음(API가 막음)
    if (!session?.error && session?.data === false) return { name: '손님', userId: null, replaced: true }
    return { name: profile?.display_name || '순례객', userId: data.user.id }
  }

  // 계정당 멀티 접속 1개: 같은 계정의 다른 연결을 끊음
  //   4001 = 다른 기기에서 로그인해서 이 로그인이 끊김 (화면: 로그아웃 + 안내)
  //   4002 = 같은 로그인으로 다른 탭·창이 접속함 (화면: 다시 연결하지 않음 — 다시 붙으면 서로 끊는 반복이 생김)
  const CLOSE_REPLACED = 4001
  const CLOSE_ELSEWHERE = 4002
  function closeUser(userId, code, reason, except = null) {
    if (!userId) return 0 // 손님은 계정이 없어서 제한하지 않음
    let n = 0
    for (const [ws, peer] of peers) {
      if (ws !== except && peer.userId === userId) {
        ws.close(code, reason)
        n++
      }
    }
    return n
  }

  wss.on('connection', (ws, req) => {
    const peer = {
      id: randomUUID().slice(0, 8), // 화면끼리 구분하는 번호 (DB id와 무관)
      name: '손님',
      userId: null,
      characterId: 'male',
      state: null,
      ready: false,
      dirty: false,
      alive: true,
      windowStart: Date.now(),
      count: 0,
      // 접속 주소 (커플 타로가 AI 서버를 부를 때 요청 횟수 제한을 사람마다 따로 세게)
      ip: String(req?.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() || req?.socket?.remoteAddress || '',
    }
    peers.set(ws, peer)
    const helloTimer = setTimeout(() => ws.close(1008, 'hello timeout'), cfg.helloTimeoutMs)

    ws.on('pong', () => {
      peer.alive = true
    })

    ws.on('message', async (raw) => {
      // 초당 메시지 수 제한
      const now = Date.now()
      if (now - peer.windowStart >= 1000) {
        peer.windowStart = now
        peer.count = 0
      }
      if (++peer.count > cfg.maxMessagesPerSecond) return ws.close(1008, 'too many messages')

      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return // 깨진 메시지는 무시
      }
      if (!msg || typeof msg !== 'object') return

      if (msg.t === 'hello' && !peer.ready && !peer.identifying) {
        peer.identifying = true
        try {
          const { replaced, ...who } = await identify(msg.token)
          if (replaced) return ws.close(CLOSE_REPLACED, 'session replaced')
          Object.assign(peer, who)
        } catch (error) {
          console.warn('[realtime] 토큰 확인 실패 → 손님으로 접속', error?.message)
        }
        if (typeof msg.characterId === 'string' && CHARACTER_RE.test(msg.characterId)) peer.characterId = msg.characterId
        if (ws.readyState !== ws.OPEN) return
        closeUser(peer.userId, CLOSE_ELSEWHERE, 'opened elsewhere', ws) // 새 연결 우선 (로그인 정책과 같은 방향)
        clearTimeout(helloTimer)
        peer.ready = true
        const others = [...peers.values()].filter((p) => p !== peer && p.ready).map(publicPeer)
        send(ws, { t: 'welcome', id: peer.id, peers: others })
        broadcast({ t: 'join', peer: publicPeer(peer) }, ws)
        lifts.welcome(ws) // [병관] 지금 엘리베이터 상태
        hj.welcome(ws) // [혜진] 지금 문·앉은 자리 상태 + 서버 시각
        return
      }
      if (!peer.ready) return
      if (tarot.handle(ws, peer, msg) || photo.handle(ws, peer, msg) || lifts.handle(ws, peer, msg) || episodes.handle(ws, peer, msg) || hj.handle(ws, peer, msg)) return

      if (msg.t === 'move') {
        const state = validMove(msg)
        if (!state) return
        peer.state = state
        peer.dirty = true
      } else if (msg.t === 'char' && typeof msg.characterId === 'string' && CHARACTER_RE.test(msg.characterId)) {
        peer.characterId = msg.characterId
        broadcast({ t: 'peer', peer: publicPeer(peer) }, ws)
      }
    })

    ws.on('close', () => {
      clearTimeout(helloTimer)
      tarot.disconnect(ws)
      photo.disconnect(ws)
      lifts.disconnect(peer)
      episodes.disconnect(ws)
      hj.disconnect(peer)
      peers.delete(ws)
      if (peer.ready) broadcast({ t: 'leave', id: peer.id })
    })
    ws.on('error', () => {}) // close가 뒤따라 옴
  })

  // 0.1초마다 움직인 사람만 모아서 한 번에
  const tick = setInterval(() => {
    const moved = []
    for (const peer of peers.values()) {
      if (peer.ready && peer.dirty) {
        moved.push([peer.id, ...peer.state])
        peer.dirty = false
      }
    }
    if (moved.length) broadcast({ t: 'state', s: moved })
  }, cfg.tickMs)

  // 응답 없는 연결 정리
  const heartbeat = setInterval(() => {
    for (const [ws, peer] of peers) {
      if (!peer.alive) {
        ws.terminate()
        continue
      }
      peer.alive = false
      ws.ping()
    }
  }, cfg.heartbeatMs)

  wss.on('close', () => {
    clearInterval(tick)
    clearInterval(heartbeat)
  })

  return {
    wss,
    /** 커플 타로 방 (테스트·로그용) */
    tarot,
    photo,
    /** 지금 접속 중인 사람 수 (테스트·로그용) */
    count: () => [...peers.values()].filter((p) => p.ready).length,
    /** 다른 기기에서 로그인했을 때 app.js가 부름 → 그 계정의 기존 연결을 바로 끊음 (끊은 연결 수) */
    kickUser: (userId) => closeUser(userId, CLOSE_REPLACED, 'session replaced'),
    close: () => {
      tarot.close()
      photo.close()
      lifts.close()
      for (const ws of peers.keys()) ws.terminate()
      wss.close()
    },
  }
}
