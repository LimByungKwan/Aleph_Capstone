import { create } from 'zustand'

// 애니메이션 구역(JM) 체험 상태. 담당: 지민
// 팀 공용 gameStore와 따로 둬서 다른 구역 코드와 부딪치지 않게 함 (혜진님 portalStore와 같은 방식).
//
// shoot: 농구 슛 체험
//   near       : 지금 가까이 있는 골대 id (없으면 null) — "E 슛 모드" 안내용
//   active     : 슛 모드 중인 골대 id (없으면 null)
//   power      : 힘 게이지 0~1 (Space 누르는 동안 오르내림), charging: 누르는 중인지
//   makes/shots: 이번 슛 모드의 성공/시도 횟수
//   lastResult : 'make' | 'miss' | null (방금 슛 결과, 화면 문구용)
// completed: 완료한 체험 id → 완료 시각(ISO). 나중에 스탬프 API(completeActivity)로 보낼 값
export const SHOOT_GOAL = 3 // 이번 슛 모드에서 이만큼 넣으면 체험 완료
export const RAIN_WAIT = 8 // 비 오는 정류장에서 우산 쓰고 이만큼(초) 기다리면 체험 완료
export const SKIP_GOAL = 3 // 물수제비: 돌이 이만큼 튀면 체험 완료

// rain: 비 오는 정류장 체험
//   inRain   : 비 구역 안인지 (정류장 반경)
//   near     : 우산 안내가 뜨는 거리 안인지
//   umbrella : 우산을 폈는지 (E로 펴고 접기)
//   waited   : 우산 쓰고 비 구역에 있던 시간(초)

export const useJmActivity = create((set, get) => ({
  shoot: { near: null, nearDist: Infinity, active: null, power: 0, charging: false, makes: 0, shots: 0, lastResult: null },
  setShoot: (patch) => set({ shoot: { ...get().shoot, ...patch } }),
  startShoot: (hoopId) =>
    set({ shoot: { ...get().shoot, active: hoopId, power: 0, charging: false, makes: 0, shots: 0, lastResult: null } }),
  endShoot: () => set({ shoot: { ...get().shoot, active: null, charging: false, power: 0 } }),

  rain: { inRain: false, near: false, umbrella: false, waited: 0 },
  setRain: (patch) => set({ rain: { ...get().rain, ...patch } }),

  // skip: 물수제비 (벚꽃 강변길). bounces = 방금 던진 돌이 튄 횟수, best = 최고 기록
  skip: { near: false, active: false, power: 0, charging: false, bounces: null, best: 0, throws: 0 },
  setSkip: (patch) => set({ skip: { ...get().skip, ...patch } }),

  completed: {},
  complete: (activityId) => {
    if (get().completed[activityId]) return false // 이미 완료 → 다시 처리하지 않음
    set({ completed: { ...get().completed, [activityId]: new Date().toISOString() } })
    return true
  },
}))
