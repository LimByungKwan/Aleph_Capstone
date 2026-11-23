import { randomUUID } from 'node:crypto'

// 커플 타로 멀티 (담당: 병관) — 지민 님 멀티 접속(realtime.js) WebSocket 위에 "타로 방"을 얹음
//
// 흐름: A가 근처 B 초대 → B 수락 → 방 생성(A·B 역할) → 각자 폰에서 10문항 → 둘 다 내면
//       이 서버가 AI 서버 POST /tarot를 한 번 불러 → 두 사람에게 같은 결과 → 방과 답은 바로 지움
// 원칙
//   - DB에 저장하지 않음. 답은 방이 살아 있는 동안 메모리에만 (결과·취소·만료·접속 끊김이면 지움)
//   - 상대 답은 화면으로 보내지 않음 (결과만 보냄) → 서로 답을 훔쳐볼 수 없음
//   - 이름은 화면이 보낸 값이 아니라 realtime.js가 로그인 토큰으로 정한 peer.name
//   - 접속 중인 사람 누구나 1명 초대 (inviteRange 옵션으로 거리 제한을 걸 수도 있음, 기본은 제한 없음)
//   - 한 사람은 초대·방을 하나만 → 진행 중인 사람에게 초대 폭탄 X
//
// 메시지 (화면 → 서버)
//   { t:'tarot.invite', to: peerId }
//   { t:'tarot.respond', inviteId, accept: true|false }
//   { t:'tarot.answers', roomId, self:[…], guess:[…] }
//   { t:'tarot.retry', roomId }      AI 호출 실패 뒤 다시
//   { t:'tarot.leave', roomId? }      초대·방 그만두기
// 메시지 (서버 → 화면)
//   tarot.invite_sent {inviteId, to} · tarot.invited {inviteId, from} · tarot.declined {by}
//   tarot.start {roomId, role:'a'|'b', me, partner} · tarot.partner_done · tarot.waiting
//   tarot.result {roomId, result} · tarot.failed {roomId, message} · tarot.cancelled {reason}
//   tarot.error {code, message}

const DEFAULTS = {
  inviteMs: 30_000, // 초대는 30초 안에 답해야 함
  roomMs: 10 * 60_000, // 방은 10분 지나면 정리
  inviteRange: Infinity, // 이 거리(m) 안 사람만 초대 (기본: 접속 중이면 누구나)
  maxAnswers: 20,
  maxOption: 9,
}

const AI_API_URL = (process.env.AI_API_URL || 'https://scenewalk-ai.onrender.com').replace(/\/$/, '')

/** AI 서버 /tarot 부르기. ip는 각 사람의 접속 주소 → AI 서버 요청 횟수 제한이 서버 하나로 몰리지 않게 */
export async function callTarotAi(a, b, ip) {
  const res = await fetch(`${AI_API_URL}/tarot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}) },
    body: JSON.stringify({ a, b }),
    signal: AbortSignal.timeout(90_000), // Render 무료 AI 서버가 깨어나는 시간까지
  })
  if (!res.ok) throw Object.assign(new Error(`AI ${res.status}`), { status: res.status })
  return res.json()
}

/**
 * @param {object} deps
 * @param {(ws, msg) => void} deps.send
 * @param {(peerId: string) => { ws, peer } | null} deps.findPeer  접속 중(ready)인 사람 찾기
 * @param {(a, b, ip) => Promise<object>} [deps.readTarot]  테스트에서 가짜로 바꿈
 */
export function createTarotRooms({ send, findPeer, readTarot = callTarotAi, options = {} }) {
  const cfg = { ...DEFAULTS, ...options }
  const invites = new Map() // inviteId → { from:{ws,peer}, to:{ws,peer}, timer }
  const rooms = new Map() // roomId → { members:[{ws,peer,role}], answers:{a,b}, busy, timer }
  const busy = new Map() // ws → { inviteId } | { roomId }

  const err = (ws, code, message) => send(ws, { t: 'tarot.error', code, message })
  const who = (peer) => ({ id: peer.id, name: peer.name })
  const distance = (p, q) => (p.state && q.state ? Math.hypot(p.state[0] - q.state[0], p.state[2] - q.state[2]) : Infinity)

  function dropInvite(inviteId, notify) {
    const inv = invites.get(inviteId)
    if (!inv) return
    clearTimeout(inv.timer)
    invites.delete(inviteId)
    busy.delete(inv.from.ws)
    busy.delete(inv.to.ws)
    if (notify) for (const side of [inv.from, inv.to]) send(side.ws, { t: 'tarot.cancelled', reason: notify })
  }

  function dropRoom(roomId, reason, except = null) {
    const room = rooms.get(roomId)
    if (!room) return
    clearTimeout(room.timer)
    rooms.delete(roomId)
    room.answers = {} // 답은 바로 지움
    for (const m of room.members) {
      busy.delete(m.ws)
      if (reason && m.ws !== except) send(m.ws, { t: 'tarot.cancelled', reason })
    }
  }

  function invite(ws, peer, msg) {
    if (busy.has(ws)) return err(ws, 'BUSY', '이미 다른 타로를 진행 중이에요.')
    const target = typeof msg.to === 'string' ? findPeer(msg.to) : null
    if (!target || target.ws === ws) return err(ws, 'NOT_FOUND', '초대할 사람을 찾지 못했어요.')
    if (busy.has(target.ws)) return err(ws, 'PARTNER_BUSY', `${target.peer.name}님은 지금 다른 타로 중이에요.`)
    if (Number.isFinite(cfg.inviteRange) && distance(peer, target.peer) > cfg.inviteRange) return err(ws, 'TOO_FAR', '너무 멀리 있는 사람은 초대할 수 없어요.')
    const inviteId = randomUUID().slice(0, 8)
    const inv = { from: { ws, peer }, to: target, timer: setTimeout(() => dropInvite(inviteId, 'expired'), cfg.inviteMs) }
    invites.set(inviteId, inv)
    busy.set(ws, { inviteId })
    busy.set(target.ws, { inviteId })
    send(ws, { t: 'tarot.invite_sent', inviteId, to: who(target.peer) })
    send(target.ws, { t: 'tarot.invited', inviteId, from: who(peer) })
  }

  function respond(ws, msg) {
    const inv = invites.get(msg.inviteId)
    if (!inv || inv.to.ws !== ws) return err(ws, 'NOT_FOUND', '초대가 이미 끝났어요.')
    if (!msg.accept) {
      send(inv.from.ws, { t: 'tarot.declined', by: who(inv.to.peer) })
      return dropInvite(msg.inviteId, null)
    }
    clearTimeout(inv.timer)
    invites.delete(msg.inviteId)
    const roomId = randomUUID().slice(0, 8)
    const members = [
      { ...inv.from, role: 'a' },
      { ...inv.to, role: 'b' },
    ]
    rooms.set(roomId, { members, answers: {}, busy: false, timer: setTimeout(() => dropRoom(roomId, 'expired'), cfg.roomMs) })
    for (const m of members) {
      busy.set(m.ws, { roomId })
      const partner = members.find((x) => x !== m)
      send(m.ws, { t: 'tarot.start', roomId, role: m.role, me: who(m.peer), partner: who(partner.peer) })
    }
  }

  const validPicks = (list) =>
    Array.isArray(list) && list.length >= 1 && list.length <= cfg.maxAnswers && list.every((n) => Number.isInteger(n) && n >= 0 && n <= cfg.maxOption)

  function answers(ws, msg) {
    const room = rooms.get(msg.roomId)
    const me = room?.members.find((m) => m.ws === ws)
    if (!me) return err(ws, 'NOT_FOUND', '타로 방이 이미 끝났어요.')
    if (!validPicks(msg.self) || !validPicks(msg.guess) || msg.self.length !== msg.guess.length) return err(ws, 'BAD_ANSWERS', '답 형식이 맞지 않아요.')
    room.answers[me.role] = { self: msg.self, guess: msg.guess }
    const partner = room.members.find((m) => m !== me)
    if (!room.answers[partner.role]) {
      send(ws, { t: 'tarot.waiting' })
      send(partner.ws, { t: 'tarot.partner_done' })
      return
    }
    run(msg.roomId)
  }

  async function run(roomId) {
    const room = rooms.get(roomId)
    if (!room || room.busy) return
    room.busy = true
    const [a, b] = ['a', 'b'].map((role) => {
      const m = room.members.find((x) => x.role === role)
      return { name: m.peer.name, ...room.answers[role] }
    })
    try {
      const result = await readTarot(a, b, room.members[0].peer.ip)
      if (!rooms.has(roomId)) return // 기다리는 동안 누가 나감
      for (const m of room.members) send(m.ws, { t: 'tarot.result', roomId, result })
      dropRoom(roomId, null)
    } catch (error) {
      console.warn('[tarot] AI 호출 실패', error?.message)
      if (!rooms.has(roomId)) return
      room.busy = false
      for (const m of room.members) send(m.ws, { t: 'tarot.failed', roomId, message: '카드를 펼치지 못했어요. [다시 시도]를 눌러 주세요.' })
    }
  }

  function leave(ws) {
    const mine = busy.get(ws)
    if (!mine) return
    if (mine.inviteId) dropInvite(mine.inviteId, 'left')
    if (mine.roomId) dropRoom(mine.roomId, 'left', ws)
  }

  return {
    /** 타로 메시지면 처리하고 true */
    handle(ws, peer, msg) {
      if (typeof msg.t !== 'string' || !msg.t.startsWith('tarot.')) return false
      if (msg.t === 'tarot.invite') invite(ws, peer, msg)
      else if (msg.t === 'tarot.respond') respond(ws, msg)
      else if (msg.t === 'tarot.answers') answers(ws, msg)
      else if (msg.t === 'tarot.retry') {
        const room = rooms.get(msg.roomId)
        if (room?.members.some((m) => m.ws === ws) && room.answers.a && room.answers.b) run(msg.roomId)
      } else if (msg.t === 'tarot.leave') leave(ws)
      return true
    },
    /** 접속이 끊기면 초대·방 정리 (상대에게 알림) */
    disconnect: leave,
    /** 테스트·로그용 */
    stats: () => ({ invites: invites.size, rooms: rooms.size }),
    close() {
      for (const id of [...invites.keys()]) dropInvite(id, null)
      for (const id of [...rooms.keys()]) dropRoom(id, null)
    },
  }
}
