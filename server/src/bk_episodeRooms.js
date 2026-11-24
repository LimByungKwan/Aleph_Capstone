// (담당: 병관) 두 사람의 초대와 체험 완료를 묶어서 다음 단계를 여는 데이트 에피소드 방
import { randomUUID } from 'node:crypto'
import { episodeSteps } from '../../shared/bk_episodeSteps.js'

export function createEpisodeRooms({ send, findPeer, inviteMs = 30_000 }) {
  const invites = new Map()
  const rooms = new Map()
  const busy = (ws) => invites.has(ws) || rooms.has(ws)

  function clearInvite(invite) {
    clearTimeout(invite.timer)
    invites.delete(invite.from.ws)
    invites.delete(invite.to.ws)
  }

  function clearRoom(room) {
    for (const member of room.members) rooms.delete(member.ws)
  }

  function snapshot(room) {
    const finished = room.step === room.steps.length
    if (finished) clearRoom(room)
    for (const [i, member] of room.members.entries()) {
      const partner = room.members[1 - i]
      send(member.ws, {
        t: 'episode.state', roomId: room.id, episodeId: room.episodeId, step: room.step, finished,
        ready: room.ready.has(member.ws), partnerReady: room.ready.has(partner.ws), partner: partner.peer.name,
      })
    }
  }

  function cancelInvite(invite, reason, except) {
    clearInvite(invite)
    for (const member of [invite.from, invite.to]) {
      if (member.ws !== except) send(member.ws, { t: 'episode.closed', reason })
    }
  }

  function disconnect(ws) {
    const invite = invites.get(ws)
    if (invite) cancelInvite(invite, 'left', ws)
    const room = rooms.get(ws)
    if (!room) return
    clearRoom(room)
    for (const member of room.members) if (member.ws !== ws) send(member.ws, { t: 'episode.closed', reason: 'left' })
  }

  function handle(ws, peer, msg) {
    if (typeof msg.t !== 'string' || !msg.t.startsWith('episode.')) return false
    if (msg.t === 'episode.invite') {
      const to = typeof msg.to === 'string' ? findPeer(msg.to) : null
      const steps = typeof msg.episodeId === 'string' ? episodeSteps(msg.episodeId) : null
      if (busy(ws) || !to || to.ws === ws || busy(to.ws) || !steps) {
        send(ws, { t: 'episode.error', reason: 'unavailable' })
        return true
      }
      const invite = { id: randomUUID(), from: { ws, peer }, to, episodeId: msg.episodeId, steps }
      invite.timer = setTimeout(() => cancelInvite(invite, 'expired'), inviteMs)
      invite.timer.unref?.()
      invites.set(ws, invite)
      invites.set(to.ws, invite)
      send(ws, { t: 'episode.invited', episodeId: invite.episodeId, partner: to.peer.name })
      send(to.ws, { t: 'episode.offer', inviteId: invite.id, episodeId: invite.episodeId, partner: peer.name })
    } else if (msg.t === 'episode.respond') {
      const invite = invites.get(ws)
      if (!invite || invite.to.ws !== ws || invite.id !== msg.inviteId || typeof msg.accept !== 'boolean') return true
      if (!msg.accept) cancelInvite(invite, 'declined')
      else {
        clearInvite(invite)
        const room = { id: randomUUID(), episodeId: invite.episodeId, steps: invite.steps, members: [invite.from, invite.to], step: 0, ready: new Set() }
        for (const member of room.members) rooms.set(member.ws, room)
        snapshot(room)
      }
    } else if (msg.t === 'episode.step') {
      const room = rooms.get(ws)
      if (!room || msg.roomId !== room.id || msg.step !== room.step || msg.activity !== room.steps[room.step] || room.ready.has(ws)) return true
      room.ready.add(ws)
      if (room.ready.size === room.members.length) {
        room.ready.clear()
        room.step += 1
      }
      snapshot(room)
    } else if (msg.t === 'episode.leave') {
      disconnect(ws)
      send(ws, { t: 'episode.closed', reason: 'cancelled' })
    }
    return true
  }

  return { handle, disconnect }
}
