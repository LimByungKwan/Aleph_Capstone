import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { createTarotRooms } from './bk_tarotRooms.js'
import { createPhotoRooms } from './bk_photoRooms.js'
import { createLifts } from './bk_lifts.js'
import { createJmLifts } from './jm_lifts.js'
import { createEpisodeRooms } from './bk_episodeRooms.js'
import { createHjWorld } from './hj_world.js'

// 멀티 접속 (담당: 지민) — 같은 맵에 있는 사람들의 위치·방향·캐릭터를 실시간으로 주고받는다
//
// 구조: 화면 ──WebSocket(wss://…/realtime)──▶ 이 서버(Render) ──▶ 다른 화면들
//   - DB에 저장하지 않는다. 위치는 1초에 여러 번 바뀌는 값이라 메모리에만 두고, 나가면 지운다
//   - 서버가 받은 값을 그대로 뿌리지 않고 검사한 뒤, 0.1초마다 모아서 한 번에 보낸다(10Hz)
//     → 사람이 늘어도 메시지 수가 "사람 수 × 프레임 수"로 폭발하지 않음
//   - 이름은 화면이 보낸 값이 아니라 로그인 토큰으로 서버가 DB에서 읽은 값 → 남의 이름으로 위장 불가
//   - 손님(비로그인)은 배포 서버에선 접속 불가 (11/27 지민: 처음부터 회원가입·로그인한 사람만 이용) → hello 때 4005로 끊음
//     allowGuests 옵션이 true일 때만(테스트용) 손님 접속을 받고, 그때도 채팅은 로그인한 계정만
//
// 메시지 (JSON, 짧은 키)
//   화면 → 서버  { t:'hello', token?, characterId? }   접속 직후 1번 (10초 안에 안 오면 끊음)
//               { t:'move', p:[x,y,z], r:방향(라디안), s:속도(m/s), g:땅 위인지 }
//               { t:'char', characterId }               캐릭터를 바꿨을 때
//   서버 → 화면  { t:'welcome', id, peers:[…] }          내 번호 + 이미 있는 사람들
//               { t:'join', peer } / { t:'leave', id } / { t:'peer', peer }(캐릭터 변경)
//               { t:'state', s:[[id,x,y,z,r,s,g], …] }  0.1초마다 움직인 사람만
//   화면 → 서버  { t:'bye' }                              창을 닫거나 다른 페이지로 갈 때 → 바로 나감 처리 (프록시가 연결을 늦게 끊어도 캐릭터가 남지 않게)
//               { t:'chat', text }                      말풍선 채팅 (1~80자, 1초에 1번, 로그인한 계정만 — 손님은 chat.denied)
//               { t:'world.set', timeOfDay?, season? }  관리자만: 모든 사람의 시간대·계절을 바꿈 (null = 각자 기본값)
//   서버 → 화면  { t:'chat', id, name, text }            모두에게 (보낸 사람 포함)
//               { t:'chat.denied', reason:'login' }      손님이 채팅을 보냄 → 보낸 사람에게만 (화면은 로그인 창)
//               { t:'world', world:{ timeOfDay, season } }  접속 직후 + 관리자가 바꿀 때마다 모두에게
//               { t:'full', max }                         정원이 참 → 바로 4003으로 끊김
//   'tarot.'으로 시작하는 메시지는 커플 타로 멀티, 'photo.'는 커플 포토존 인생네컷, 'lift.'는 전망대 엘리베이터 (병관, bk_tarotRooms.js · bk_photoRooms.js · bk_lifts.js)

export const REALTIME_PATH = '/realtime'

const DEFAULTS = {
  // 동시 접속 상한 (11/26 지민: 50 → 30). 넘으면 접속 거절 → 그 화면은 혼자 플레이로 계속됨
  //   서버: 0.1초마다 움직인 사람 위치를 모든 사람에게 보냄 → 보내는 양이 사람 수의 제곱으로 늘어남
  //         30명이 다 움직이면 약 0.4MB/초, 50명이면 약 1.1MB/초 (Render 무료 CPU 0.1개로는 50명이 빠듯)
  //   화면: 다른 사람 캐릭터마다 움직이는 3D 모델 + 물리 몸체 → 느린 노트북은 20~30명부터 끊김
  //   Render 환경변수 REALTIME_MAX_PEERS로 바꿀 수 있음
  maxPeers: 30,
  tickMs: 100, // 10Hz
  helloTimeoutMs: 10_000,
  allowGuests: true, // 배포 서버(index.js)는 false. 기본값 true는 손님으로 붙는 다른 기능 테스트(bk_*.test.js)용
  heartbeatMs: 30_000, // 응답 없는 연결(와이파이 끊김 등) 정리 + Render가 연결을 끊지 않게 유지
  maxMessagesPerSecond: 40, // 화면은 10번/초 보냄. 4배 넘게 보내면 비정상으로 보고 끊음
  maxPayloadBytes: 1024,
}

const CHARACTER_RE = /^[a-z0-9_-]{1,32}$/
const TIMES = ['morning', 'noon', 'night'] // frontend/src/game/config.js TIME_PRESETS
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] // frontend/src/game/seasons.js
const CHAT_MAX = 80
const CHAT_GAP_MS = 1000

/** 채팅 글: 줄바꿈·제어 문자를 빼고 앞뒤 공백 정리. 비거나 너무 길면 null */
function cleanChat(text) {
  if (typeof text !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const t = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return t && t.length <= CHAT_MAX ? t : null
}

const MAP_LIMIT = 1000 // 맵은 수백 m 크기. 이보다 먼 좌표는 잘못된 값
const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits

function validMove(msg) {
  const { p, r, s } = msg
  if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return null
  const [x, y, z] = p
  if (Math.abs(x) > MAP_LIMIT || Math.abs(z) > MAP_LIMIT || y < -100 || y > 300) return null
  if (!Number.isFinite(r) || !Number.isFinite(s) || s < 0 || s > 30) return null
  const state = [round(x), round(y), round(z), round(r, 3), round(s), msg.g ? 1 : 0]
  if (typeof msg.waving === 'boolean') state.push(msg.waving ? 1 : 0)
  return state
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
      // 접속 시도 자체는 정원 + 10까지만 받음 (hello 전 연결이 쌓여 메모리를 쓰는 것 차단). 정원 안내는 hello 때 4003으로
      if (peers.size >= cfg.maxPeers + 10) return done(false, 503, 'Too many players')
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
  const jmLifts = createJmLifts({ broadcast, send, options: options.jmLift }) // [지민] 애니 구역 온천장 엘리베이터 (jm_lifts.js)

  // [지민] 관리자가 정한 시간대·계절 → 접속한 모든 사람에게 같은 값 (메모리에만 둠: 서버가 다시 켜지면 각자 기본값)
  const world = { timeOfDay: null, season: null }

  async function identify(token) {
    if (typeof token !== 'string' || !token) return { name: '손님', userId: null, admin: false }
    const { data, error } = await supabase.anon().auth.getUser(token)
    if (error || !data?.user) return { name: '손님', userId: null, admin: false } // 만료된 토큰이면 손님으로 (접속 자체는 허용)
    const db = supabase.asUser(token)
    const [{ data: profile }, session] = await Promise.all([
      db.from('profiles').select('display_name, role').eq('id', data.user.id).maybeSingle(),
      Promise.resolve().then(() => db.rpc('session_ok')).catch(() => null),
    ])
    // 다른 기기에서 로그인해서 끊긴 토큰 → 접속 거절 (화면은 이 코드를 보고 로그아웃 안내). 확인 자체가 실패하면 막지 않음(API가 막음)
    if (!session?.error && session?.data === false) return { name: '손님', userId: null, replaced: true }
    const admin = profile?.role === 'admin'
    return { name: profile?.display_name || '순례객', userId: data.user.id, admin }
  }

  // 계정당 멀티 접속 1개: 같은 계정의 다른 연결을 끊음
  //   4001 = 다른 기기에서 로그인해서 이 로그인이 끊김 (화면: 로그아웃 + 안내)
  //   4002 = 같은 로그인으로 다른 탭·창이 접속함 (화면: 다시 연결하지 않음 — 다시 붙으면 서로 끊는 반복이 생김)
  const CLOSE_REPLACED = 4001
  const CLOSE_ELSEWHERE = 4002
  const CLOSE_FULL = 4003 // 정원(maxPeers)이 참
  const CLOSE_LOGIN = 4005 // 로그인하지 않음(토큰 없음·만료·잘못됨) → 화면은 토큰을 새로 받아 한 번 더, 안 되면 로그아웃
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
      admin: false,
      lastChat: 0,
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
        if (ws.readyState !== ws.OPEN) return
        if (!peer.userId && !cfg.allowGuests) return ws.close(CLOSE_LOGIN, 'login required')
        if (typeof msg.characterId === 'string' && CHARACTER_RE.test(msg.characterId)) peer.characterId = msg.characterId
        // 정원: 이미 들어와 있는 사람 수 (같은 계정의 이전 연결은 곧 끊기므로 빼고 셈) → 차면 안내 후 4003으로 끊음
        //   화면은 4003을 보고 "정원이 차서 혼자 둘러보는 중" 안내 + 30초마다 다시 시도
        let inside = 0
        for (const p of peers.values()) if (p !== peer && p.ready && !(peer.userId && p.userId === peer.userId)) inside++
        if (inside >= cfg.maxPeers) {
          send(ws, { t: 'full', max: cfg.maxPeers })
          return ws.close(CLOSE_FULL, 'full')
        }
        closeUser(peer.userId, CLOSE_ELSEWHERE, 'opened elsewhere', ws) // 새 연결 우선 (로그인 정책과 같은 방향)
        clearTimeout(helloTimer)
        peer.ready = true
        const others = [...peers.values()].filter((p) => p !== peer && p.ready).map(publicPeer)
        send(ws, { t: 'welcome', id: peer.id, peers: others })
        broadcast({ t: 'join', peer: publicPeer(peer) }, ws)
        lifts.welcome(ws) // [병관] 지금 엘리베이터 상태
        hj.welcome(ws) // [혜진] 지금 문·앉은 자리 상태 + 서버 시각
        jmLifts.welcome(ws) // [지민] 지금 온천장 엘리베이터 상태
        send(ws, { t: 'world', world }) // [지민] 관리자가 정한 시간대·계절
        return
      }
      if (!peer.ready) return
      if (tarot.handle(ws, peer, msg) || photo.handle(ws, peer, msg) || lifts.handle(ws, peer, msg) || episodes.handle(ws, peer, msg) || hj.handle(ws, peer, msg) || jmLifts.handle(ws, peer, msg)) return

      if (msg.t === 'bye') return ws.close(1000, 'bye')
      if (msg.t === 'chat') {
        // 손님(비로그인·만료된 토큰)은 읽기만. 화면도 막지만 서버가 최종으로 막음 (화면 코드는 고쳐서 보낼 수 있으니)
        if (!peer.userId) return send(ws, { t: 'chat.denied', reason: 'login' })
        const text = cleanChat(msg.text)
        if (!text || now - peer.lastChat < CHAT_GAP_MS) return
        peer.lastChat = now
        return broadcast({ t: 'chat', id: peer.id, name: peer.name, text })
      }
      if (msg.t === 'world.set') {
        if (!peer.admin) return
        if ('timeOfDay' in msg && (msg.timeOfDay === null || TIMES.includes(msg.timeOfDay))) world.timeOfDay = msg.timeOfDay
        if ('season' in msg && (msg.season === null || SEASONS.includes(msg.season))) world.season = msg.season
        return broadcast({ t: 'world', world })
      }

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
      jmLifts.close()
      for (const ws of peers.keys()) ws.terminate()
      wss.close()
    },
  }
}
