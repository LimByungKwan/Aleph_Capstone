// [지민] 애니 구역 온천장 손님용 엘리베이터 운행 시간 — 화면(jm_guestLift.jsx)과 서버(server/src/jm_lifts.js)가 같이 씀
// 운행표: 문 닫힘(DOOR) → 출발 대기(PAUSE) → 이동(층 높이 차 / 속도, 최소 1.5초) → 도착 대기(PAUSE) → 문 열림(DOOR)

export const JM_LIFT = {
  speed: 3, // m/s 평균
  door: 1.1, // 문이 다 열리거나 닫히는 시간(초)
  pause: 0.7, // 문 닫힌 뒤 출발까지, 도착 뒤 문 열리기까지(초)
  minMove: 1.5, // 이동 최소 시간(초)
}

/** 이동 시간(초): levels = 층마다 칸 바닥 높이(m) */
export function jmLiftMoveSec(levels, from, to) {
  return Math.max(JM_LIFT.minMove, Math.abs(levels[to] - levels[from]) / JM_LIFT.speed)
}

/** 운행 전체 시간(초) */
export function jmLiftTripSec(levels, from, to) {
  return 2 * JM_LIFT.door + 2 * JM_LIFT.pause + jmLiftMoveSec(levels, from, to)
}
