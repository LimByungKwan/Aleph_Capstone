import { createLiftCore } from '../../shared/bk_liftCore.js'

// SKY 전망대 엘리베이터 멀티 동기화 (담당: 병관) — 지민 님 멀티 접속(realtime.js) WebSocket 위
//
// 엘리베이터는 맵에 하나라서, 누가 타거나 부르면 접속한 모든 화면에서 같은 엘리베이터가 같은 시간에 움직여야 함
// → 서버가 엘리베이터 상태(층·운행·탑승 대기)를 하나 들고 있다가 바뀔 때마다 모두에게 알림
//   규칙(여러 명 탑승 대기·바로 출발·열림·호출)은 shared/bk_liftCore.js — 화면의 혼자 모드도 같은 파일을 씀
// DB 저장 없음 (서버가 다시 켜지면 1층)
//
// 화면 → 서버: { t:'lift.board' | 'lift.off' | 'lift.go' | 'lift.hold' | 'lift.call', towerId, to? }
// 서버 → 화면: lift.trip · lift.boarding (모두에게) / lift.state (처음 접속한 사람에게)

export function createLifts({ broadcast, send, options = {} }) {
  const core = createLiftCore({ emit: (msg) => broadcast(msg), timing: options, maxTowers: options.maxTowers ?? 4 })

  return {
    handle(ws, peer, msg) {
      if (typeof msg.t !== 'string' || !msg.t.startsWith('lift.')) return false
      core.handle(peer.id, msg)
      return true
    },
    /** 새로 들어온 사람에게 지금 엘리베이터 상태 */
    welcome(ws) {
      for (const state of core.snapshot()) send(ws, state)
    },
    /** 접속이 끊긴 사람은 탑승 대기에서 뺌 */
    disconnect(peer) {
      core.leave(peer.id)
    },
    close: () => core.close(),
  }
}
