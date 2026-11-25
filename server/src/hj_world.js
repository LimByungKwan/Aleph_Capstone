// [혜진] 영화·드라마 구역(경복궁·경성) 멀티 동기화 — realtime.js와 같은 WebSocket 위에서 'hj.'로 시작하는 메시지만 다뤄요
//
// 함께 보이게 하는 것
//   - 전각 문 열림·닫힘: 서버가 기억해 두고, 새로 들어온 사람에게도 지금 상태를 보내요
//   - 앉은 모습: 누가 어느 자리에 앉았는지 (앉은 높이·방향과 함께) → 다른 화면에서도 앉은 자세로 보여요
//   - 탈것(인력거·자동차) 위치: 타고 있는 사람의 화면이 0.1초마다 보내면 다른 화면이 그대로 따라 그려요
//   - 시계: 전차·기차가 모든 화면에서 같은 때에 출발·정차하도록 서버 시각을 알려 줘요
//
// 메시지
//   화면 → 서버  { t:'hj.door', id, closed }          문 열고 닫기
//               { t:'hj.sit', seat|null, h, r }        앉기(seat 이름, 몸통-좌판 높이 차 h, 방향 r) / 일어나기(null)
//               { t:'hj.veh', v, p:[x,y,z], r }        탈것 위치 (타고 있는 사람만)
//               { t:'hj.time', c }                     서버 시각 묻기 (c: 화면 시각)
//   서버 → 화면  { t:'hj.snapshot', now, doors, seats } 접속 직후 1번
//               { t:'hj.door', id, closed } / { t:'hj.sit', id, seat, h, r } / { t:'hj.veh', v, p, r, by } / { t:'hj.time', now, c }

const ID_RE = /^[A-Za-z0-9_/.:-]{1,48}$/
const LIMIT = 1000
const num = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export function createHjWorld({ broadcast, send }) {
  const doors = {} // 전각 id → 닫힘(true)
  const seats = new Map() // 사람 id → { seat, h, r }

  return {
    /** 새로 들어온 사람에게 지금 상태 */
    welcome(ws) {
      send(ws, { t: 'hj.snapshot', now: Date.now(), doors, seats: Object.fromEntries(seats) })
    },

    /** 'hj.' 메시지면 처리하고 true */
    handle(ws, peer, msg) {
      if (typeof msg.t !== 'string' || !msg.t.startsWith('hj.')) return false
      if (msg.t === 'hj.door') {
        if (!ID_RE.test(String(msg.id))) return true
        doors[msg.id] = Boolean(msg.closed)
        broadcast({ t: 'hj.door', id: msg.id, closed: doors[msg.id] }, ws)
      } else if (msg.t === 'hj.sit') {
        if (msg.seat === null) seats.delete(peer.id)
        else if (ID_RE.test(String(msg.seat)) && num(msg.h, -3, 3) && num(msg.r, -10, 10)) {
          seats.set(peer.id, { seat: msg.seat, h: round(msg.h), r: round(msg.r, 3) })
        } else return true
        broadcast({ t: 'hj.sit', id: peer.id, ...(seats.get(peer.id) ?? { seat: null }) }, ws)
      } else if (msg.t === 'hj.veh') {
        const { v, p, r } = msg
        if (!ID_RE.test(String(v)) || !Array.isArray(p) || p.length !== 3 || !p.every((n) => num(n, -LIMIT, LIMIT)) || !num(r, -100, 100)) return true
        broadcast({ t: 'hj.veh', v, p: p.map((n) => round(n)), r: round(r, 3), by: peer.id }, ws)
      } else if (msg.t === 'hj.time') {
        send(ws, { t: 'hj.time', now: Date.now(), c: Number.isFinite(msg.c) ? msg.c : 0 })
      }
      return true
    },

    /** 나간 사람이 앉아 있었으면 일어난 것으로 */
    disconnect(peer) {
      if (seats.delete(peer.id)) broadcast({ t: 'hj.sit', id: peer.id, seat: null })
    },
  }
}
