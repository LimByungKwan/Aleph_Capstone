// (담당: 병관) 두 사람의 초대와 체험 완료를 묶어서 다음 단계를 여는 데이트 에피소드 방
import { randomUUID } from 'node:crypto'
import { episodeSteps } from '../../shared/bk_episodeSteps.js'
import { LETTER_EPISODE_ID } from '../../shared/bk_letterPuzzle.js'
import { applyLetterAction, letterSnapshot, startLetterRound } from './bk_letterPuzzle.js'
import { createPavilion } from './bk_pavilion.js'

const CAFE_TOPPINGS = new Map([
  ['바닐라 라테', ['cinnamon', 'sugar']],
  ['딸기 우유', ['strawberry', 'cream']],
  ['유자 에이드', ['yuja', 'mint']],
])

function validCup(cup) {
  if (!CAFE_TOPPINGS.get(cup?.drink)?.includes(cup?.topping)) return null
  return { drink: cup.drink, topping: cup.topping }
}

export function createEpisodeRooms({ send, findPeer, inviteMs = 30_000 }) {
  const invites = new Map()
  const rooms = new Map()
  const pavilion = createPavilion({ send })
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
    const finished = !room.letter && room.step === room.steps.length
    if (finished) clearRoom(room)
    for (const [i, member] of room.members.entries()) {
      const partner = room.members[1 - i]
      const cups = room.step > 0 && room.cups.size === 2 ? [room.cups.get(member.ws), room.cups.get(partner.ws)] : null
      send(member.ws, {
        t: 'episode.state', roomId: room.id, episodeId: room.episodeId, step: room.step, finished,
        ready: room.ready.has(member.ws), partnerReady: room.ready.has(partner.ws), partner: partner.peer.name,
        ...(cups && !finished && { cups }),
        ...(room.letter && { letter: letterSnapshot(room.letter, i) }),
      })
    }
  }

  function cancelInvite(invite, reason, except) {
    clearInvite(invite)
    for (const member of [invite.from, invite.to]) {
      if (member.ws !== except) send(member.ws, { t: 'episode.closed', reason })
    }
  }

  function closeEpisode(ws) {
    const invite = invites.get(ws)
    if (invite) cancelInvite(invite, 'left', ws)
    const room = rooms.get(ws)
    if (!room) return
    clearRoom(room)
    for (const member of room.members) if (member.ws !== ws) send(member.ws, { t: 'episode.closed', reason: 'left' })
  }

  function handle(ws, peer, msg) {
    if (typeof msg.t !== 'string' || !msg.t.startsWith('episode.')) return false
    if (msg.t.startsWith('episode.pavilion.')) {
      pavilion.handle(ws, peer, msg)
    } else if (msg.t === 'episode.invite') {
      const to = typeof msg.to === 'string' ? findPeer(msg.to) : null
      const letter = msg.episodeId === LETTER_EPISODE_ID
      const steps = letter ? [] : typeof msg.episodeId === 'string' ? episodeSteps(msg.episodeId) : null
      if (busy(ws) || !to || to.ws === ws || busy(to.ws) || !steps) {
        send(ws, { t: 'episode.error', reason: 'unavailable' })
        return true
      }
      const invite = { id: randomUUID(), from: { ws, peer }, to, episodeId: msg.episodeId, steps, letter }
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
        const room = { id: randomUUID(), episodeId: invite.episodeId, steps: invite.steps, members: [invite.from, invite.to], step: 0, ready: new Set(), cups: new Map() }
        if (invite.letter) room.letter = startLetterRound()
        for (const member of room.members) rooms.set(member.ws, room)
        snapshot(room)
      }
    } else if (msg.t === 'episode.step') {
      const room = rooms.get(ws)
      if (!room || room.letter || msg.roomId !== room.id || msg.step !== room.step || msg.activity !== room.steps[room.step] || room.ready.has(ws)) return true
      if (msg.activity === 'cafe') {
        const cup = validCup(msg.cup)
        if (cup) room.cups.set(ws, cup)
      }
      room.ready.add(ws)
      if (room.ready.size === room.members.length) {
        room.ready.clear()
        room.step += 1
      }
      snapshot(room)
    } else if (msg.t.startsWith('episode.letter.')) {
      const room = rooms.get(ws)
      if (!room?.letter || msg.roomId !== room.id) return true
      const outcome = applyLetterAction(room.letter, room.members.findIndex((member) => member.ws === ws), peer, msg)
      if (outcome.error) send(ws, { t: 'episode.error', reason: outcome.error })
      if (outcome.replay) room.letter = startLetterRound(room.letter)
      if (outcome.changed) snapshot(room)
    } else if (msg.t === 'episode.leave') {
      closeEpisode(ws)
      send(ws, { t: 'episode.closed', reason: 'cancelled' })
    }
    return true
  }

  function disconnect(ws) {
    pavilion.disconnect(ws)
    closeEpisode(ws)
  }

  return { handle, disconnect }
}
