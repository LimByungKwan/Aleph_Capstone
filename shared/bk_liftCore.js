// SKY 전망대 엘리베이터 규칙 (담당: 병관) — 서버(server/src/bk_lifts.js)와 화면(혼자 모드, bk_liftSync.js)이 같이 씀
// 그래서 멀티(서버가 정함)든 혼자(화면이 정함)든 엘리베이터가 똑같이 움직임
//
// 여러 명이 탈 수 있게 (진짜 엘리베이터처럼)
//   - 누가 발판에 올라서면(board) 바로 안 떠나고 3초 탑승 대기. 그동안 새 사람이 타면 3초로 다시 늘림 (최대 8초)
//   - 발판에서 다 내리면(off) 대기 취소
//   - [바로 출발](go): 탄 사람이 누르면 기다리지 않고 출발
//   - [잠깐만요! 열림](hold): 대기 중이면 3초 더, 문이 닫히는 중이면 다시 열고 대기로 되돌림
//   - 호출(call): 다른 층에서 부르면 그 층으로 (운행 중이면 도착 후 이어서)
//
// 들어오는 요청: { t: 'lift.board' | 'lift.off' | 'lift.go' | 'lift.hold' | 'lift.call', towerId, to? }
// 내보내는 알림(emit): { t:'lift.trip', towerId, from, to, elapsed }
//                     { t:'lift.boarding', towerId, to, remaining(ms) | null(취소), riders }
// snapshot(): 지금 상태 → { t:'lift.state', towerId, at, trip, boarding } (늦게 들어온 사람용)

export const LIFT_TIMING = {
  boardMs: 3000, // 탑승 대기
  boardMaxMs: 8000, // 새 사람이 타도 최대 이만큼만 기다림
  closingMs: 1100, // 문이 닫히는 시간 (이 안에 hold면 다시 열림) — 화면 Terrain.jsx LIFT_DOOR_TIME과 같게
  tripMs: 9400, // 문 닫힘 → 출발 대기 → 이동 → 도착 대기 → 문 열림 전체 (화면 운행표와 같게, 조금 넉넉히)
}
const TOWER_RE = /^[A-Za-z0-9_/-]{1,40}$/

/**
 * @param {object} deps
 * @param {(msg) => void} deps.emit  모두에게 알림 (서버: broadcast / 화면: 내 Elevator로)
 * @param {() => number} [deps.now]
 */
export function createLiftCore({ emit, now = () => Date.now(), timing = {}, maxTowers = 4 }) {
  const T = { ...LIFT_TIMING, ...timing }
  const towers = new Map() // towerId → { at, trip, boarding, pending, timer }

  const get = (towerId) => {
    if (typeof towerId !== 'string' || !TOWER_RE.test(towerId)) return null
    let lift = towers.get(towerId)
    if (!lift && towers.size < maxTowers) {
      lift = { at: 0, trip: null, boarding: null, pending: null, timer: null }
      towers.set(towerId, lift)
    }
    return lift ?? null
  }
  const setTimer = (lift, ms, fn) => {
    clearTimeout(lift.timer)
    lift.timer = setTimeout(fn, Math.max(0, ms))
  }
  const boardingMsg = (towerId, lift) =>
    lift.boarding
      ? { t: 'lift.boarding', towerId, to: lift.boarding.to, remaining: Math.max(0, lift.boarding.deadline - now()), riders: lift.boarding.riders.size }
      : { t: 'lift.boarding', towerId, to: null, remaining: null, riders: 0 }

  function startTrip(towerId, lift, to, riders = new Set()) {
    lift.boarding = null
    lift.trip = { from: lift.at, to, startedAt: now(), riders }
    emit({ t: 'lift.trip', towerId, from: lift.at, to, elapsed: 0 })
    setTimer(lift, T.tripMs, () => {
      lift.at = to
      lift.trip = null
      const next = lift.pending
      lift.pending = null
      if (next !== null && next !== lift.at) startTrip(towerId, lift, next) // 운행 중에 다른 층에서 불렀으면 이어서
    })
  }

  // 탑승 대기 시작·연장 (마감 시각에 출발)
  function board(towerId, lift, riders, extendMs = T.boardMs) {
    const t = now()
    if (!lift.boarding) lift.boarding = { to: 1 - lift.at, startedAt: t, deadline: t + extendMs, riders }
    else lift.boarding.deadline = Math.min(lift.boarding.startedAt + T.boardMaxMs, Math.max(lift.boarding.deadline, t + extendMs))
    setTimer(lift, lift.boarding.deadline - t, () => startTrip(towerId, lift, lift.boarding.to, lift.boarding.riders))
    emit(boardingMsg(towerId, lift))
  }

  // 문이 닫히는 중이면 다시 열고 대기로 되돌림 (탄 사람·목적지는 그대로)
  function reopen(towerId, lift) {
    const { to, riders } = lift.trip
    lift.trip = null
    const t = now()
    lift.boarding = { to, startedAt: t, deadline: t, riders }
    board(towerId, lift, riders)
  }
  const closing = (lift) => lift.trip && now() - lift.trip.startedAt < T.closingMs

  return {
    handle(riderId, msg) {
      const lift = get(msg?.towerId)
      if (!lift) return
      const { towerId } = msg
      switch (msg.t) {
        case 'lift.board':
          if (lift.trip) {
            if (closing(lift)) {
              lift.trip.riders.add(riderId)
              reopen(towerId, lift) // 닫히는 문으로 뛰어든 사람 → 다시 열기
            }
            return
          }
          if (lift.boarding) lift.boarding.riders.add(riderId)
          board(towerId, lift, lift.boarding?.riders ?? new Set([riderId]))
          return
        case 'lift.off':
          if (!lift.boarding) return
          lift.boarding.riders.delete(riderId)
          if (lift.boarding.riders.size === 0) {
            lift.boarding = null
            clearTimeout(lift.timer)
          }
          emit(boardingMsg(towerId, lift))
          return
        case 'lift.go':
          if (lift.boarding?.riders.has(riderId)) startTrip(towerId, lift, lift.boarding.to, lift.boarding.riders)
          return
        case 'lift.hold':
          if (lift.boarding) board(towerId, lift, lift.boarding.riders)
          else if (closing(lift)) reopen(towerId, lift)
          return
        case 'lift.call': {
          const to = msg.to
          if (to !== 0 && to !== 1) return
          if (lift.trip) {
            if (lift.trip.to !== to) lift.pending = to
            return
          }
          if (lift.boarding) {
            if (lift.boarding.to !== to && to !== lift.at) lift.pending = to
            return
          }
          if (lift.at !== to) startTrip(towerId, lift, to)
          return
        }
        default:
      }
    },
    /** 접속이 끊긴 사람은 탑승 대기에서 뺌 */
    leave(riderId) {
      for (const [towerId, lift] of towers) {
        if (lift.boarding?.riders.delete(riderId)) {
          if (lift.boarding.riders.size === 0) {
            lift.boarding = null
            clearTimeout(lift.timer)
          }
          emit(boardingMsg(towerId, lift))
        }
      }
    },
    snapshot() {
      return [...towers].map(([towerId, lift]) => {
        const b = boardingMsg(towerId, lift)
        return {
          t: 'lift.state',
          towerId,
          at: lift.at,
          trip: lift.trip ? { from: lift.trip.from, to: lift.trip.to, elapsed: now() - lift.trip.startedAt } : null,
          boarding: lift.boarding ? { to: b.to, remaining: b.remaining, riders: b.riders } : null,
        }
      })
    },
    close() {
      for (const lift of towers.values()) clearTimeout(lift.timer)
      towers.clear()
    },
  }
}
