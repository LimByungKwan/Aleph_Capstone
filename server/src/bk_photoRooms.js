import { randomUUID } from 'node:crypto'

// 커플 포토존 "같이 찍는 인생네컷" 멀티 (담당: 병관) — 지민 님 멀티 접속(realtime.js) WebSocket 위
//
// 흐름: A가 접속 중인 사람 B 초대 → B 수락 → 두 사람이 하트 앞 자기 발자국에 섬(photo.ready)
//       → 둘 다 서 있으면 서버가 4컷 신호(photo.shot 0~3)를 같은 간격으로 두 화면에 보냄
//       → 각 화면이 3·2·1 뒤 자기 화면을 찍어 네컷을 만듦 → photo.done → 방 지움
// 사진(이미지)은 서버로 보내지 않음. 서버는 "언제 찍을지" 신호만 맞춰 줌. DB 저장 없음
//
// 화면 → 서버: photo.invite {to} · photo.respond {inviteId, accept} · photo.ready {roomId, ready} · photo.leave
// 서버 → 화면: photo.invite_sent · photo.invited · photo.declined · photo.start {roomId, role, me, partner}
//             photo.ready_state {a, b} · photo.shot {index, total} · photo.done · photo.cancelled {reason} · photo.error

const DEFAULTS = {
  inviteMs: 30_000,
  roomMs: 5 * 60_000, // 5분 안에 못 찍으면 정리
  shots: 4,
  shotGapMs: 4500, // 컷 사이 간격 (화면에서 3·2·1 + 찰칵 + 잠깐 쉬기)
  doneDelayMs: 1500,
}

export function createPhotoRooms({ send, findPeer, options = {} }) {
  const cfg = { ...DEFAULTS, ...options }
  const invites = new Map() // inviteId → { from, to, timer }
  const rooms = new Map() // roomId → { members:[{ws,peer,role,ready}], shooting, timers:[] }
  const busy = new Map() // ws → { inviteId } | { roomId }

  const err = (ws, code, message) => send(ws, { t: 'photo.error', code, message })
  const who = (peer) => ({ id: peer.id, name: peer.name })

  function dropInvite(inviteId, reason) {
    const inv = invites.get(inviteId)
    if (!inv) return
    clearTimeout(inv.timer)
    invites.delete(inviteId)
    busy.delete(inv.from.ws)
    busy.delete(inv.to.ws)
    if (reason) for (const side of [inv.from, inv.to]) send(side.ws, { t: 'photo.cancelled', reason })
  }

  function dropRoom(roomId, reason, except = null) {
    const room = rooms.get(roomId)
    if (!room) return
    room.timers.forEach(clearTimeout)
    rooms.delete(roomId)
    for (const m of room.members) {
      busy.delete(m.ws)
      if (reason && m.ws !== except) send(m.ws, { t: 'photo.cancelled', reason })
    }
  }

  function invite(ws, peer, msg) {
    if (busy.has(ws)) return err(ws, 'BUSY', '이미 다른 사진을 찍는 중이에요.')
    const target = typeof msg.to === 'string' ? findPeer(msg.to) : null
    if (!target || target.ws === ws) return err(ws, 'NOT_FOUND', '초대할 사람을 찾지 못했어요.')
    if (busy.has(target.ws)) return err(ws, 'PARTNER_BUSY', `${target.peer.name}님은 지금 다른 사진을 찍는 중이에요.`)
    const inviteId = randomUUID().slice(0, 8)
    invites.set(inviteId, { from: { ws, peer }, to: target, timer: setTimeout(() => dropInvite(inviteId, 'expired'), cfg.inviteMs) })
    busy.set(ws, { inviteId })
    busy.set(target.ws, { inviteId })
    send(ws, { t: 'photo.invite_sent', inviteId, to: who(target.peer) })
    send(target.ws, { t: 'photo.invited', inviteId, from: who(peer) })
  }

  function respond(ws, msg) {
    const inv = invites.get(msg.inviteId)
    if (!inv || inv.to.ws !== ws) return err(ws, 'NOT_FOUND', '초대가 이미 끝났어요.')
    if (!msg.accept) {
      send(inv.from.ws, { t: 'photo.declined', by: who(inv.to.peer) })
      return dropInvite(msg.inviteId, null)
    }
    clearTimeout(inv.timer)
    invites.delete(msg.inviteId)
    const roomId = randomUUID().slice(0, 8)
    const members = [
      { ...inv.from, role: 'a', ready: false },
      { ...inv.to, role: 'b', ready: false },
    ]
    const room = { members, shooting: false, timers: [] }
    room.timers.push(setTimeout(() => dropRoom(roomId, 'expired'), cfg.roomMs))
    rooms.set(roomId, room)
    for (const m of members) {
      busy.set(m.ws, { roomId })
      const partner = members.find((x) => x !== m)
      send(m.ws, { t: 'photo.start', roomId, role: m.role, me: who(m.peer), partner: who(partner.peer) })
    }
  }

  function ready(ws, msg) {
    const room = rooms.get(msg.roomId)
    const me = room?.members.find((m) => m.ws === ws)
    if (!me || room.shooting) return
    me.ready = Boolean(msg.ready)
    const state = Object.fromEntries(room.members.map((m) => [m.role, m.ready]))
    for (const m of room.members) send(m.ws, { t: 'photo.ready_state', ...state })
    if (room.members.every((m) => m.ready)) shoot(msg.roomId)
  }

  // 두 사람 다 섰으면: 컷 신호를 같은 간격으로 두 화면에 동시에
  function shoot(roomId) {
    const room = rooms.get(roomId)
    room.shooting = true
    for (let index = 0; index < cfg.shots; index++) {
      room.timers.push(
        setTimeout(() => {
          for (const m of room.members) send(m.ws, { t: 'photo.shot', index, total: cfg.shots })
        }, index * cfg.shotGapMs),
      )
    }
    room.timers.push(
      setTimeout(() => {
        for (const m of room.members) send(m.ws, { t: 'photo.done' })
        dropRoom(roomId, null)
      }, (cfg.shots - 1) * cfg.shotGapMs + cfg.shotGapMs + cfg.doneDelayMs),
    )
  }

  function leave(ws) {
    const mine = busy.get(ws)
    if (!mine) return
    if (mine.inviteId) dropInvite(mine.inviteId, 'left')
    if (mine.roomId) dropRoom(mine.roomId, 'left', ws)
  }

  return {
    handle(ws, peer, msg) {
      if (typeof msg.t !== 'string' || !msg.t.startsWith('photo.')) return false
      if (msg.t === 'photo.invite') invite(ws, peer, msg)
      else if (msg.t === 'photo.respond') respond(ws, msg)
      else if (msg.t === 'photo.ready') ready(ws, msg)
      else if (msg.t === 'photo.leave') leave(ws)
      return true
    },
    disconnect: leave,
    stats: () => ({ invites: invites.size, rooms: rooms.size }),
    close() {
      for (const id of [...invites.keys()]) dropInvite(id, null)
      for (const id of [...rooms.keys()]) dropRoom(id, null)
    },
  }
}
