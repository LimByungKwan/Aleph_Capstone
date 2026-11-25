import { create } from 'zustand'
import { createLiftCore } from '@shared/bk_liftCore.js'
import { onTarotMessage, sendTarot, useRealtimeStore } from '../../multiplayer/realtimeStore.js'

// SKY 전망대 엘리베이터 멀티 동기화 + 화면 버튼 상태 (담당: 병관)
// 규칙(여러 명 탑승 대기 3초·새 사람이 타면 연장·바로 출발·열림·호출)은 shared/bk_liftCore.js 하나
//   - 멀티 접속 중: 요청을 서버(server/src/bk_lifts.js)로 → 서버가 같은 규칙으로 정해 모두에게 알림
//   - 혼자(멀티 꺼짐·시연 모드): 같은 규칙을 이 화면에서 돌림
// Elevator(Terrain.jsx)는 알림(lift.trip / lift.boarding / lift.state)대로 문·높이를 그림 → 모든 화면이 같은 장면

const handlers = new Map() // towerId → Elevator의 알림 받는 함수
const lastState = new Map() // Elevator가 생기기 전에 온 상태 (접속하자마자 오는 lift.state)

function dispatch(msg) {
  if (msg.t === 'lift.state') lastState.set(msg.towerId, msg)
  handlers.get(msg.towerId)?.(msg)
}
onTarotMessage((msg) => {
  if (msg.t?.startsWith('lift.')) dispatch(msg)
})

// 혼자 모드용: 서버와 같은 규칙을 이 화면에서
const local = createLiftCore({ emit: dispatch })
const online = () => useRealtimeStore.getState().status === 'online'

/** Elevator가 알림 받을 곳 등록 → 해제 함수 */
export function registerLift(towerId, handler) {
  handlers.set(towerId, handler)
  const s = lastState.get(towerId)
  if (s && online()) handler(s)
  return () => handlers.get(towerId) === handler && handlers.delete(towerId)
}

/** 요청 보내기: { t: 'lift.board' | 'lift.off' | 'lift.go' | 'lift.hold' | 'lift.call', towerId, to? } */
export function sendLift(msg) {
  if (online()) sendTarot(msg)
  else local.handle('me', msg)
}

// 멀티 접속이 끊겼다 붙으면: 혼자 모드 상태는 버리고 서버 상태를 따름 (서버가 접속하자마자 lift.state를 보냄)
useRealtimeStore.subscribe((state, prev) => {
  if (state.status !== prev.status) lastState.clear()
})

// 화면 버튼 상태 (Elevator가 바뀔 때만 씀)
//   mode: 'call'(다른 층에 있음 → 호출) | 'coming'(오는 중) | 'rider'(발판 위) | 'hold'(문 앞, 곧 떠남) | null
export const useLiftCall = create(() => ({ towerId: null, mode: null, level: -1, seconds: 0, riders: 0, to: -1, actions: {} }))
export const LIFT_LEVEL_NAMES = ['1층', '전망층']
