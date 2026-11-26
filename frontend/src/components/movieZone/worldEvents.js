import { create } from 'zustand'
import { onHjMessage, sendHj, useRealtimeStore } from '../../game/multiplayer/realtimeStore.js'
import { useUiStore } from './uiStore.js'

// [3. 개발 > 프론트엔드] 영화·드라마 구역 함께 보는 일 (혜진) — 서버 server/src/hj_world.js 의 hj.pull · hj.gov 와 짝
//  1) 끄는 인력거: 탄 손님이 근처 사람에게 "끌어 주세요" → 수락하면 그 사람이 끌어요
//  2) 광복 프로젝트: 조선총독부 철거 발파 → 모든 화면에서 같은 시간 동안 철거된 모습
// 혼자 모드(서버 없음)에서는 인력거 부탁은 못 하고, 광복 프로젝트는 내 화면에서만 돼요.

const online = () => useRealtimeStore.getState().status === 'online'
export const selfId = () => useRealtimeStore.getState().selfId
export const peerName = (id) => useRealtimeStore.getState().peers[id]?.name ?? '손님'
const toast = (text, tone) => useUiStore.getState().toast?.(text, tone)

// ── 끄는 인력거 ──
// pulls: { [인력거 id]: { puller, passenger } } · ask: 나에게 온 부탁 { rk, from } · waiting: 내가 보낸 부탁 { rk, to }
export const usePull = create(() => ({ pulls: {}, ask: null, waiting: null }))

export function askPull(rk, to) {
  if (!online()) return toast('멀티 서버에 접속해 있을 때만 다른 사람에게 부탁할 수 있어요', 'error')
  sendHj({ t: 'hj.pull', act: 'ask', rk, to })
  usePull.setState({ waiting: { rk, to } })
  toast(`${peerName(to)}님께 인력거를 끌어 달라고 부탁했어요`, 'info')
  // 30초 동안 대답이 없으면 (자리를 비웠거나 서버가 아직 옛 버전) 다시 고를 수 있게 해요
  setTimeout(() => {
    const w = usePull.getState().waiting
    if (w && w.rk === rk && w.to === to && !usePull.getState().pulls[rk]) {
      usePull.setState({ waiting: null })
      toast(`${peerName(to)}님이 대답하지 않았어요 · 다른 사람에게 부탁해 보세요`, 'info')
    }
  }, 30000)
}
export function answerPull(accept) {
  const ask = usePull.getState().ask
  if (!ask) return
  sendHj({ t: 'hj.pull', act: accept ? 'accept' : 'decline', rk: ask.rk, to: ask.from, passenger: ask.from })
  usePull.setState({ ask: null })
}
export function endPull(rk) {
  if (!rk) return
  sendHj({ t: 'hj.pull', act: 'end', rk })
  usePull.setState((s) => {
    const pulls = { ...s.pulls }
    delete pulls[rk]
    return { pulls }
  })
}
/** 내가 끌고 있는 인력거 id (없으면 null) */
export function myPull() {
  const me = selfId()
  if (!me) return null
  for (const [rk, p] of Object.entries(usePull.getState().pulls)) if (p.puller === me) return rk
  return null
}

// ── 광복 프로젝트 (조선총독부 철거) ──
// until: 이 시각(서버 기준 ms)까지 철거된 모습 · blastAt: 발파 연출 시작(내 화면 시각)
export const useGov = create(() => ({ until: 0, blastAt: 0, by: null }))
const GOV_DOWN_MS = 10 * 60 * 1000
let serverOffset = 0 // 서버 시각 - 내 시각
export function govDown() {
  const { until } = useGov.getState()
  return until > Date.now() + serverOffset
}
export function blastGov() {
  if (govDown()) return
  const local = () => useGov.setState({ until: Date.now() + serverOffset + GOV_DOWN_MS, blastAt: performance.now(), by: 'me' })
  if (!online()) return local()
  sendHj({ t: 'hj.gov', act: 'blast' })
  // 서버가 1.5초 안에 대답이 없으면 (아직 옛 버전 서버) 내 화면에서라도 철거해요
  setTimeout(() => {
    if (!govDown()) local()
  }, 1500)
}

onHjMessage((msg) => {
  if (msg.t === 'hj.snapshot') {
    if (Number.isFinite(msg.now)) serverOffset = msg.now - Date.now()
    usePull.setState({ pulls: { ...(msg.pulls ?? {}) }, ask: null, waiting: null })
    useGov.setState({ until: Number(msg.govUntil) || 0, blastAt: 0, by: null })
  } else if (msg.t === 'hj.pull') {
    const me = selfId()
    if (msg.act === 'ask' && msg.to === me) {
      usePull.setState({ ask: { rk: msg.rk, from: msg.from } })
    } else if (msg.act === 'decline' && msg.to === me) {
      usePull.setState({ waiting: null })
      toast(`${peerName(msg.from)}님이 지금은 못 끈대요`, 'info')
    } else if (msg.act === 'state') {
      usePull.setState((s) => ({ pulls: { ...s.pulls, [msg.rk]: { puller: msg.puller, passenger: msg.passenger } }, waiting: s.waiting?.rk === msg.rk ? null : s.waiting }))
      if (msg.passenger === me) toast(`${peerName(msg.puller)}님이 인력거를 끌어 줘요!`, 'success')
      if (msg.puller === me) toast('인력거를 끌어요 · 걸어가면 인력거가 따라와요 (손님을 태우고 가면 코인)', 'success')
    } else if (msg.act === 'end') {
      usePull.setState((s) => {
        const pulls = { ...s.pulls }
        delete pulls[msg.rk]
        return { pulls }
      })
    }
  } else if (msg.t === 'hj.gov') {
    useGov.setState({ until: Number(msg.until) || 0, blastAt: performance.now(), by: msg.by ?? null })
  }
})
