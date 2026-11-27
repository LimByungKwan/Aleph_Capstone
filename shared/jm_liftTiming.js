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

/** (11/27 코드 리뷰) 서버가 받아 주는 엘리베이터와 층마다 칸 바닥 높이(m, 1층 = 0) — 화면이 보내는 levels는 믿지 않음
 *  여관을 3층(로비·연회장·집무실)으로 바꿈: gen-jm-kyoto.mjs YU_LV[0..2] - YU_LV[0]. 맵의 소품 id는 구역 이름이 붙음(JM/) */
export const JM_LIFT_LEVELS = {
  'JM/jm_gelev': [0, 7, 11.8],
}
