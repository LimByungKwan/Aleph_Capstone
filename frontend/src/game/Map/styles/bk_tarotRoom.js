import { create } from 'zustand'
import { onTarotMessage, sendTarot, useRealtimeStore } from '../../multiplayer/realtimeStore.js'

// 데이트 코스 구역(BK) 커플 타로 멀티 — 각자 폰에서 A·B로 답하기 (담당: 병관)
// 서버: server/src/bk_tarotRooms.js (지민 님 멀티 접속 WebSocket 위). 메시지 설명은 그 파일 맨 위
// 화면: bk_tarotQuestions.jsx(초대 목록·각자 답하기·기다리기·결과), bk_tarotBooth.jsx(초대 받기 창, 방이 생기면 타로 화면 열기)
//
// phase: 'idle' | 'answering'(내 10문항) | 'waiting'(상대 기다림 + 카드 섞는 중) | 'result' | 'failed'(AI 실패 → 다시 시도)

const initial = { invite: null, outgoing: null, room: null, phase: 'idle', partnerDone: false, result: null, notice: null }

export const useTarotRoom = create(() => ({ ...initial }))

const NOTICES = {
  left: '상대가 타로를 그만뒀어요.',
  expired: '초대 시간이 지났어요.',
}

/** 서버에서 온 tarot.* 메시지 처리 (테스트에서 직접 부를 수 있게 export) */
export function handleTarotMessage(msg) {
  const set = useTarotRoom.setState
  const s = useTarotRoom.getState()
  switch (msg.t) {
    case 'tarot.invite_sent':
      return set({ outgoing: { inviteId: msg.inviteId, to: msg.to }, notice: null })
    case 'tarot.invited':
      return set({ invite: { inviteId: msg.inviteId, from: msg.from } })
    case 'tarot.declined':
      return set({ outgoing: null, notice: `${msg.by.name}님이 다음에 같이 보자고 했어요.` })
    case 'tarot.start':
      return set({ ...initial, room: { roomId: msg.roomId, role: msg.role, me: msg.me, partner: msg.partner }, phase: 'answering' })
    case 'tarot.partner_done':
      return set({ partnerDone: true })
    case 'tarot.waiting':
      return set({ phase: 'waiting' })
    case 'tarot.result':
      return set({ phase: 'result', result: msg.result, partnerDone: true })
    case 'tarot.failed':
      return set({ phase: 'failed', notice: msg.message })
    case 'tarot.cancelled':
      // 결과를 이미 받았으면 그대로 둠 (상대가 결과 화면을 닫아도 내 결과는 남게)
      if (s.phase === 'result') return undefined
      return set({ ...initial, notice: NOTICES[msg.reason] ?? '같이 보기가 취소됐어요.' })
    case 'tarot.error':
      return set({ outgoing: null, notice: msg.message })
    default:
      return undefined
  }
}
onTarotMessage(handleTarotMessage)

export const tarotRoom = {
  invite(peerId) {
    useTarotRoom.setState({ notice: null })
    sendTarot({ t: 'tarot.invite', to: peerId })
  },
  respond(accept) {
    const inv = useTarotRoom.getState().invite
    if (!inv) return
    sendTarot({ t: 'tarot.respond', inviteId: inv.inviteId, accept })
    useTarotRoom.setState({ invite: null })
  },
  submit(self, guess) {
    const room = useTarotRoom.getState().room
    if (!room) return
    useTarotRoom.setState({ phase: 'waiting' })
    sendTarot({ t: 'tarot.answers', roomId: room.roomId, self, guess })
  },
  retry() {
    const room = useTarotRoom.getState().room
    if (!room) return
    useTarotRoom.setState({ phase: 'waiting', notice: null })
    sendTarot({ t: 'tarot.retry', roomId: room.roomId })
  },
  /** 초대·방 그만두기 (타로 화면을 닫을 때도) */
  leave() {
    const s = useTarotRoom.getState()
    if (s.outgoing || s.invite || (s.room && s.phase !== 'result')) sendTarot({ t: 'tarot.leave' })
    useTarotRoom.setState({ ...initial })
  },
  clearNotice() {
    useTarotRoom.setState({ notice: null })
  },
}

/** 지금 접속 중인 다른 사람들 (멀티 접속 중일 때만). 텐트(spot = [x, z])에서 가까운 사람부터 */
export function onlinePeers(spot) {
  const { status, peers } = useRealtimeStore.getState()
  if (status !== 'online') return []
  const far = (p) => (p.state && spot ? Math.hypot(p.state[0] - spot[0], p.state[2] - spot[1]) : Infinity)
  return Object.values(peers)
    .map((p) => ({ id: p.id, name: p.name, dist: far(p) }))
    .sort((a, b) => a.dist - b.dist)
}
