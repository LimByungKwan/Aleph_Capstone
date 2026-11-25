import { create } from 'zustand'
import { onHjMessage, sendHj, useRealtimeStore } from '../../game/multiplayer/realtimeStore.js'
import { usePalaceSeatStore } from './palaceSeating.js'

// [3. 개발 > 프론트엔드] 영화·드라마 구역 멀티 동기화 (혜진) — 서버 server/src/hj_world.js와 짝
// 같은 맵에 있는 다른 사람 화면에도 보이게:
//   - 전각 문 열림·닫힘 (누가 닫으면 모두에게 닫혀요)
//   - 앉은 모습 (palaceSeating으로 앉으면 자리 높이·방향을 보내요 → RemotePlayer가 앉은 자세로 그려요)
//   - 탈것 위치 (인력거·자동차를 탄 사람의 화면이 보내고, 나머지 화면은 그 위치를 따라 그려요)
//   - 서버 시각 (전차·기차가 모든 화면에서 같은 때에 움직이게)
// 서버 모드(VITE_API_URL)가 아니면 아무것도 보내지 않고, 혼자 하던 대로 움직여요.

// 전각 문: 처음엔 모두 열림. closed: { [전각 id]: true }
export const useHallDoors = create((set) => ({
  closed: {},
  toggle: (id) =>
    set((s) => {
      const closed = !s.closed[id]
      sendHj({ t: 'hj.door', id, closed })
      return { closed: { ...s.closed, [id]: closed } }
    }),
}))

// 다른 사람이 앉은 자리: { [사람 id]: { seat, h(몸통-좌판 높이 차), r(바라보는 방향) } }
export const useRemoteSeats = create(() => ({ seats: {} }))

// ── 서버 시각 ──
let offsetMs = 0 // 서버 시각 - 내 시각
/** 모든 화면이 같은 값을 쓰는 시간 (초). 전차·기차 시간표용 */
export function sharedSeconds() {
  return (Date.now() + offsetMs) / 1000
}

// ── 탈것 위치 ──
const vehicles = new Map() // 탈것 id → { p:[x,y,z], r, at(받은 시각 ms), by }
const STALE_MS = 1500
/** 다른 사람이 지금 몰고 있는 탈것이면 그 위치, 아니면 null */
export function remoteVehicle(id) {
  const v = vehicles.get(id)
  if (!v) return null
  if (performance.now() - v.at > STALE_MS) {
    vehicles.delete(id)
    return null
  }
  return v
}
let lastVehicleSend = 0
/** 내가 타고 있는 탈것 위치 보내기 (0.1초 간격으로만 실제 전송) */
export function sendVehicle(id, p, r) {
  const now = performance.now()
  if (now - lastVehicleSend < 100) return
  lastVehicleSend = now
  sendHj({ t: 'hj.veh', v: id, p, r })
}

onHjMessage((msg) => {
  if (msg.t === 'hj.snapshot') {
    if (Number.isFinite(msg.now)) offsetMs = msg.now - Date.now()
    useHallDoors.setState({ closed: { ...(msg.doors ?? {}) } })
    useRemoteSeats.setState({ seats: { ...(msg.seats ?? {}) } })
    sendHj({ t: 'hj.time', c: Date.now() }) // 왕복 시간까지 보정
  } else if (msg.t === 'hj.time' && Number.isFinite(msg.now) && Number.isFinite(msg.c)) {
    const rtt = Date.now() - msg.c
    if (rtt >= 0 && rtt < 5000) offsetMs = msg.now + rtt / 2 - Date.now()
  } else if (msg.t === 'hj.door') {
    useHallDoors.setState((s) => ({ closed: { ...s.closed, [msg.id]: Boolean(msg.closed) } }))
  } else if (msg.t === 'hj.sit') {
    useRemoteSeats.setState((s) => {
      const seats = { ...s.seats }
      if (msg.seat) seats[msg.id] = { seat: msg.seat, h: msg.h, r: msg.r }
      else delete seats[msg.id]
      return { seats }
    })
  } else if (msg.t === 'hj.veh') {
    vehicles.set(msg.v, { p: msg.p, r: msg.r, at: performance.now(), by: msg.by })
  }
})

// 다시 접속하면(서버 재시작·와이파이 끊김) 남의 앉은 자리 기억은 비워요 (welcome 뒤 snapshot이 다시 채움)
useRealtimeStore.subscribe((s, prev) => {
  if (s.status !== 'online' && prev.status === 'online') useRemoteSeats.setState({ seats: {} })
})

// 내가 앉거나 일어나면 알려요. 몸통 높이와 좌판 높이 차(h)·방향(r)을 같이 보내 다른 화면이 앉은 자세를 맞춰요
const STAND_TO_BODY = 0.91
usePalaceSeatStore.subscribe((s, prev) => {
  if (s.seated === prev.seated) return
  const seat = s.seated
  if (!seat) {
    sendHj({ t: 'hj.sit', seat: null })
    return
  }
  const id = seat.id ?? (seat.vehicle ? `ride:${seat.vehicle.id}` : 'seat')
  // 궁궐 자리는 surfaceY(좌판)·position[1](몸통)이 있어요. 탈것 좌석은 몸통이 좌판 위 STAND_TO_BODY 높이에 놓여요
  const h = Number.isFinite(seat.surfaceY) && Array.isArray(seat.position) ? seat.position[1] - seat.surfaceY : STAND_TO_BODY
  const r = Number.isFinite(seat.yaw) ? seat.yaw : 0
  sendHj({ t: 'hj.sit', seat: String(id).slice(0, 48), h: Math.round(h * 100) / 100, r: Math.round(r * 1000) / 1000 })
})
