// (담당: 병관) 두 사람이 함께 걷는 데이트 에피소드의 초대와 실시간 진행 상태
import { create } from 'zustand'
import { onTarotMessage, sendTarot, useRealtimeStore } from '../../multiplayer/realtimeStore.js'
import { getDateEpisode } from './bk_dateEpisodes.js'

const idle = { invite: null, outgoing: null, room: null, order: null, submittedStep: null, checkpoint: null, notice: null }
const messages = {
  unavailable: '친구가 접속 중인지 확인해 주세요. 이미 다른 에피소드에 참여 중일 수 있어요.',
  declined: '데이트 초대를 거절했어요.',
  expired: '시간이 지나 데이트 초대가 끝났어요.',
  left: '친구와의 연결이 끊겼어요. 함께 끝낸 단계부터 혼자 이어갈 수 있어요.',
  cancelled: '함께 걷기를 마쳤어요.',
  letter_station: '내 단서 장소 가까이에서 다시 눌러 주세요.',
  letter_left: '친구와의 연결이 끊겨 이번 편지 풀이가 끝났어요. 완성한 엽서는 다시 볼 수 있어요.',
}

export const useEpisodeRoom = create(() => ({ ...idle }))

onTarotMessage((message) => {
  const current = useEpisodeRoom.getState()
  const set = useEpisodeRoom.setState
  if (message.t === 'episode.invited') set({ outgoing: message, notice: null })
  if (message.t === 'episode.offer') set({ invite: message, notice: null })
  if (message.t === 'episode.error') set({ notice: messages[message.reason] })
  if (message.t === 'episode.closed') {
    const reason = message.reason === 'left' && current.room?.letter ? 'letter_left' : message.reason
    set({ ...idle, notice: messages[reason] })
  }
  if (message.t !== 'episode.state') return
  const same = current.room?.roomId === message.roomId
  const order = same ? current.order : null
  const advanced = same && message.step > current.room.step
  const checkpoint = advanced ? { episodeId: message.episodeId, step: message.step, order, finished: message.finished } : null
  set({
    ...idle,
    room: message.finished ? null : message,
    order,
    submittedStep: same ? current.submittedStep : null,
    checkpoint,
  })
})

useRealtimeStore.subscribe((state, previous) => {
  if (previous.status === 'online' && state.status !== 'online') {
    const { room, invite, outgoing } = useEpisodeRoom.getState()
    useEpisodeRoom.setState({ ...idle, notice: room?.letter ? messages.letter_left : room || invite || outgoing ? messages.left : null })
  }
})

export const episodeRoom = {
  invite(episodeId, to) {
    useEpisodeRoom.setState({ notice: null })
    sendTarot({ t: 'episode.invite', episodeId, to })
  },
  respond(accept) {
    const invite = useEpisodeRoom.getState().invite
    if (invite) sendTarot({ t: 'episode.respond', inviteId: invite.inviteId, accept })
  },
  leave: () => sendTarot({ t: 'episode.leave' }),
  letterAction(action, colors) {
    const { room } = useEpisodeRoom.getState()
    if (!room?.letter) return
    sendTarot({ t: `episode.letter.${action}`, roomId: room.roomId, roundId: room.letter.roundId, ...(colors && { colors }) })
  },
  complete(activity, order) {
    const { room, submittedStep } = useEpisodeRoom.getState()
    if (!room || room.letter) return false
    if (room.ready || submittedStep === room.step || getDateEpisode(room.episodeId)?.steps[room.step]?.id !== activity) return true
    useEpisodeRoom.setState({ submittedStep: room.step, ...(activity === 'cafe' && { order }) })
    sendTarot({
      t: 'episode.step', roomId: room.roomId, step: room.step, activity,
      ...(activity === 'cafe' && order?.topping && { cup: { drink: order.drink, topping: order.topping } }),
    })
    return true
  },
}
