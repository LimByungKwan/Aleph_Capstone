import { JM_LIFT_LEVELS, jmLiftTripSec } from '../../shared/jm_liftTiming.js'

// [지민] 애니 구역 온천장 손님용 엘리베이터 멀티 동기화 — realtime.js와 같은 WebSocket 위
//
// 칸은 맵에 하나라서, 누가 층을 고르거나 부르면 접속한 모든 화면에서 같은 칸이 같은 시간에 움직여야 함
// → 서버가 칸 상태(서 있는 층·운행)를 들고 있다가 운행이 시작될 때마다 모두에게 알림. DB 저장 없음 (서버가 다시 켜지면 1층)
//   병관님 전망대 엘리베이터(bk_lifts.js)와 같은 방식이지만 그쪽 규칙은 2개 층(1층 ↔ 전망대) 전용이라 따로 둠
//   운행 시간·층 높이·받아 주는 엘리베이터 id는 shared/jm_liftTiming.js — (11/27 코드 리뷰) 화면이 보내는 levels는 무시
//   (예전엔 levels를 그대로 믿어서 [0, 500]을 보내면 한 번 운행이 수 분이 되거나, 모르는 id로 칸 자리를 채울 수 있었음)
//
// 화면 → 서버: { t:'jm.lift.go', id, to, levels }   층 고르기·부르기 (운행 중이면 도착 후 이어서 1번만 기억)
// 서버 → 모두: { t:'jm.lift.trip', id, from, to, elapsed }
// 서버 → 새로 들어온 사람: { t:'jm.lift.state', id, at, trip: { from, to, elapsed } | null }

export function createJmLifts({ broadcast, send, now = () => Date.now(), options = {} }) {
  const timeScale = options.timeScale ?? 1 // 테스트에서 운행을 빨리 끝내려고 (1 = 실제 시간)
  const table = options.levels ?? JM_LIFT_LEVELS // 테스트는 다른 표를 넣을 수 있음
  const lifts = new Map() // id → { at, levels, trip: { from, to, startedAt, ms }, pending: [], timer }

  const get = (id) => {
    if (typeof id !== 'string' || !Object.hasOwn(table, id)) return null
    let lift = lifts.get(id)
    if (!lift) {
      lift = { at: 0, levels: table[id], trip: null, pending: [], timer: null }
      lifts.set(id, lift)
    }
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
      // 운행 중에 부른 층들을 부른 순서대로 이어서 (예전엔 마지막 하나만 기억해서 2층 호출 뒤 3층이 부르면 2층이 사라졌음)
      lift.pending = lift.pending.filter((f) => f !== lift.at)
      const next = lift.pending.shift()
      if (next !== undefined) startTrip(id, lift, next)
    }, ms)
  }

  // (11/27) 온천장 2층 연회장 큰 북: 누가 치면 다른 사람 화면에서도 소리·초롱 번쩍 (상태 없이 그대로 전달, 한 사람당 0.25초에 한 번)
  const drumLast = new WeakMap()
  // (11/27) 온천장 1층 누각 약탕 패: 누가 바꾸면 모두에게 + 늦게 온 사람에게도 지금 탕 (0 ~ 4, 한 사람당 0.25초에 한 번)
  const herbs = new Map()
  const herbLast = new WeakMap()

  return {
    handle(ws, peer, msg) {
      if (msg?.t === 'jm.drum.hit') {
        const t = now()
        if (t - (drumLast.get(ws) ?? 0) < 250) return true
        drumLast.set(ws, t)
        if (typeof msg.id === 'string' && msg.id.length <= 40) broadcast({ t: 'jm.drum.hit', id: msg.id }, ws)
        return true
      }
      if (msg?.t === 'jm.bath.herb') {
        const t = now()
        if (t - (herbLast.get(ws) ?? 0) < 250) return true
        herbLast.set(ws, t)
        if (typeof msg.id === 'string' && msg.id.length <= 40 && Number.isInteger(msg.i) && msg.i >= 0 && msg.i <= 4 && (herbs.has(msg.id) || herbs.size < 8)) {
          herbs.set(msg.id, msg.i)
          broadcast({ t: 'jm.bath.herb', id: msg.id, i: msg.i }, ws)
        }
        return true
      }
      if (typeof msg.t !== 'string' || !msg.t.startsWith('jm.lift.')) return false
      if (msg.t !== 'jm.lift.go') return true
      const lift = get(msg.id)
      if (!lift) return true
      const to = msg.to
      if (!Number.isInteger(to) || to < 0 || to >= lift.levels.length) return true
      if (lift.trip) {
        if (lift.trip.to !== to && !lift.pending.includes(to)) lift.pending.push(to)
        return true
      }
      if (to !== lift.at) startTrip(msg.id, lift, to)
      return true
    },
    /** 새로 들어온 사람에게 지금 칸 상태 */
    welcome(ws) {
      for (const [id, i] of herbs) send(ws, { t: 'jm.bath.herbState', id, i })
      // (11/27 코드 리뷰) 아직 아무도 안 탄 엘리베이터도 1층 상태를 보냄 → 혼자 모드로 다른 층에 있던 화면이 서버 층으로 맞춤
      for (const id of Object.keys(table)) get(id)
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
