import { jmLiftTripSec } from '../../shared/jm_liftTiming.js'

// [지민] 애니 구역 온천장 손님용 엘리베이터 멀티 동기화 — realtime.js와 같은 WebSocket 위
//
// 칸은 맵에 하나라서, 누가 층을 고르거나 부르면 접속한 모든 화면에서 같은 칸이 같은 시간에 움직여야 함
// → 서버가 칸 상태(서 있는 층·운행)를 들고 있다가 운행이 시작될 때마다 모두에게 알림. DB 저장 없음 (서버가 다시 켜지면 1층)
//   병관님 전망대 엘리베이터(bk_lifts.js)와 같은 방식이지만 그쪽 규칙은 2개 층(1층 ↔ 전망대) 전용이라 따로 둠
//   운행 시간은 shared/jm_liftTiming.js (화면과 같은 계산). 층 높이는 화면이 보내 줌(levels, 검사 후 저장)
//
// 화면 → 서버: { t:'jm.lift.go', id, to, levels }   층 고르기·부르기 (운행 중이면 도착 후 이어서 1번만 기억)
// 서버 → 모두: { t:'jm.lift.trip', id, from, to, elapsed }
// 서버 → 새로 들어온 사람: { t:'jm.lift.state', id, at, trip: { from, to, elapsed } | null }

const ID_RE = /^[A-Za-z0-9_/-]{1,40}$/
const MAX_FLOORS = 9

const validLevels = (levels) =>
  Array.isArray(levels) && levels.length >= 2 && levels.length <= MAX_FLOORS && levels.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 500)

export function createJmLifts({ broadcast, send, now = () => Date.now(), options = {} }) {
  const maxLifts = options.maxLifts ?? 4
  const timeScale = options.timeScale ?? 1 // 테스트에서 운행을 빨리 끝내려고 (1 = 실제 시간)
  const lifts = new Map() // id → { at, levels, trip: { from, to, startedAt, ms }, pending, timer }

  const get = (id, levels) => {
    if (typeof id !== 'string' || !ID_RE.test(id)) return null
    let lift = lifts.get(id)
    if (!lift) {
      if (lifts.size >= maxLifts || !validLevels(levels)) return null
      lift = { at: 0, levels, trip: null, pending: null, timer: null }
      lifts.set(id, lift)
    } else if (validLevels(levels) && levels.length === lift.levels.length) lift.levels = levels
    return lift
  }
  const elapsedOf = (trip) => Math.max(0, now() - trip.startedAt)

  function startTrip(id, lift, to) {
    const from = lift.at
    const ms = Math.round(jmLiftTripSec(lift.levels, from, to) * 1000 * timeScale)
    lift.trip = { from, to, startedAt: now(), ms }
    broadcast({ t: 'jm.lift.trip', id, from, to, elapsed: 0 })
    clearTimeout(lift.timer)
    lift.timer = setTimeout(() => {
      lift.at = to
      lift.trip = null
      const next = lift.pending
      lift.pending = null
      if (next !== null && next !== lift.at) startTrip(id, lift, next) // 운행 중에 다른 층에서 불렀으면 이어서
    }, ms)
  }

  return {
    handle(ws, peer, msg) {
      if (typeof msg.t !== 'string' || !msg.t.startsWith('jm.lift.')) return false
      if (msg.t !== 'jm.lift.go') return true
      const lift = get(msg.id, msg.levels)
      if (!lift) return true
      const to = msg.to
      if (!Number.isInteger(to) || to < 0 || to >= lift.levels.length) return true
      if (lift.trip) {
        if (lift.trip.to !== to) lift.pending = to
        return true
      }
      if (to !== lift.at) startTrip(msg.id, lift, to)
      return true
    },
    /** 새로 들어온 사람에게 지금 칸 상태 */
    welcome(ws) {
      for (const [id, lift] of lifts) {
        const trip = lift.trip ? { from: lift.trip.from, to: lift.trip.to, elapsed: Math.round(elapsedOf(lift.trip) / timeScale) } : null
        send(ws, { t: 'jm.lift.state', id, at: lift.at, trip })
      }
    },
    close() {
      for (const lift of lifts.values()) clearTimeout(lift.timer)
    },
  }
}
