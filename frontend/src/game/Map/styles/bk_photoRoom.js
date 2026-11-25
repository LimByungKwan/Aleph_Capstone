import { create } from 'zustand'
import { onTarotMessage, sendTarot } from '../../multiplayer/realtimeStore.js'

// 커플 포토존 "같이 찍는 인생네컷" 상태 (담당: 병관)
// 서버: server/src/bk_photoRooms.js (멀티) / 혼자 찍기는 이 파일이 서버 대신 컷 신호를 냄
// 화면·3D: bk_photoBooth.jsx
//
// phase: 'idle' | 'gather'(하트 앞 발자국에 서기) | 'shooting'(4컷, 카메라는 삼각대 자리) | 'done'(네컷 완성)
// shot: { index, at } 지금 컷 (at = 신호 받은 시각, 화면이 3·2·1 뒤 찍음) / shots: 찍은 컷 이미지(data URL)

export const SHOTS = 4
export const SHOT_GAP_MS = 4500 // 서버(bk_photoRooms.js shotGapMs)와 같게
export const COUNTDOWN_MS = 3000

const initial = { invite: null, outgoing: null, room: null, solo: false, phase: 'idle', ready: { a: false, b: false }, sameSpot: false, shot: null, shots: [], result: null, notice: null }

export const usePhotoRoom = create(() => ({ ...initial }))

const NOTICES = { left: '상대가 사진 찍기를 그만뒀어요.', expired: '시간이 지나 취소됐어요.' }
let soloTimers = []

/** 서버에서 온 photo.* 메시지 (테스트에서 직접 부를 수 있게 export) */
export function handlePhotoMessage(msg) {
  const set = usePhotoRoom.setState
  const s = usePhotoRoom.getState()
  switch (msg.t) {
    case 'photo.invite_sent':
      return set({ outgoing: { inviteId: msg.inviteId, to: msg.to }, notice: null })
    case 'photo.invited':
      return set({ invite: { inviteId: msg.inviteId, from: msg.from } })
    case 'photo.declined':
      return set({ outgoing: null, notice: `${msg.by.name}님이 다음에 같이 찍자고 했어요.` })
    case 'photo.start':
      return set({ ...initial, room: { roomId: msg.roomId, role: msg.role, me: msg.me, partner: msg.partner }, phase: 'gather' })
    case 'photo.ready_state':
      return set({ ready: { a: msg.a, b: msg.b }, sameSpot: Boolean(msg.sameSpot) })
    case 'photo.shot':
      return set({ phase: 'shooting', shot: { index: msg.index, at: performance.now() } })
    case 'photo.done':
      // 네컷 합치기는 마지막 컷을 찍은 bk_photoBooth.jsx가 끝냄(finish). 한 컷도 못 찍었으면 처음으로
      return s.shots.some(Boolean) ? undefined : set({ ...initial, notice: '사진을 찍지 못했어요. 다시 해 볼까요?' })
    case 'photo.cancelled':
      if (s.phase === 'done' || s.phase === 'shooting') return undefined // 이미 찍는 중·다 찍었으면 그대로
      return set({ ...initial, notice: NOTICES[msg.reason] ?? '같이 찍기가 취소됐어요.' })
    case 'photo.error':
      return set({ outgoing: null, notice: msg.message })
    default:
      return undefined
  }
}
onTarotMessage((msg) => {
  if (msg.t?.startsWith('photo.')) handlePhotoMessage(msg)
})

export const photoRoom = {
  invite(peerId) {
    usePhotoRoom.setState({ notice: null })
    sendTarot({ t: 'photo.invite', to: peerId })
  },
  respond(accept) {
    const inv = usePhotoRoom.getState().invite
    if (!inv) return
    sendTarot({ t: 'photo.respond', inviteId: inv.inviteId, accept })
    usePhotoRoom.setState({ invite: null })
  },
  /** 혼자 찍기: 서버 없이 이 화면에서 바로 */
  startSolo() {
    usePhotoRoom.setState({ ...initial, solo: true, room: { roomId: 'solo', role: 'a', me: { name: '나' }, partner: null }, phase: 'gather' })
  },
  /** 내가 발자국 위에 섰는지 (bk_photoBooth.jsx가 바뀔 때만 부름) */
  setReady(spot) {
    const s = usePhotoRoom.getState()
    if (!s.room || s.phase !== 'gather') return
    const ready = spot !== null
    if (s.solo) {
      usePhotoRoom.setState({ ready: { a: ready, b: true } })
      if (ready) startSoloShots()
      return
    }
    sendTarot({ t: 'photo.ready', roomId: s.room.roomId, ready, spot })
  },
  saveShot(index, url) {
    const shots = [...usePhotoRoom.getState().shots]
    shots[index] = url
    usePhotoRoom.setState({ shots })
  },
  finish(result) {
    usePhotoRoom.setState({ phase: 'done', result, shot: null })
  },
  /** 그만두기·창 닫기 */
  leave() {
    const s = usePhotoRoom.getState()
    soloTimers.forEach(clearTimeout)
    soloTimers = []
    if (!s.solo && (s.outgoing || s.invite || (s.room && s.phase !== 'done'))) sendTarot({ t: 'photo.leave' })
    usePhotoRoom.setState({ ...initial })
  },
  clearNotice() {
    usePhotoRoom.setState({ notice: null })
  },
}

// 혼자 찍기: 서버와 같은 간격으로 컷 신호
function startSoloShots() {
  soloTimers.forEach(clearTimeout)
  soloTimers = []
  for (let index = 0; index < SHOTS; index++) {
    soloTimers.push(setTimeout(() => handlePhotoMessage({ t: 'photo.shot', index, total: SHOTS }), index * SHOT_GAP_MS))
  }
  soloTimers.push(setTimeout(() => handlePhotoMessage({ t: 'photo.done' }), SHOTS * SHOT_GAP_MS + 1500))
}
