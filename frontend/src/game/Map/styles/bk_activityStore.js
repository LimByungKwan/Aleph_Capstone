import { create } from 'zustand'

// 데이트 코스 구역(BK) 체험 상태. 담당: 병관
// 팀 공용 gameStore와 따로 둬서 다른 구역 코드와 부딪치지 않게 함 (지민 님 jm_activityStore와 같은 방식).
//
// coin: 분수 동전 던지기 (소원 빌기)
//   near       : 분수 가까이 있는지 → "E 동전 던지기" 안내
//   active     : 던지기 모드인지 (캐릭터 멈춤)
//   power      : 힘 게이지 0~1 (Space 누르는 동안 오르내림), charging: 누르는 중인지
//   wishes/tosses : 이번 던지기 모드의 성공(위쪽 물받이)/시도 횟수
//   lastResult : 'wish' | 'pool' | 'miss' | null (방금 결과, 화면 문구용)
// completed: 완료한 체험 id → 완료 시각(ISO). 나중에 스탬프 API로 보낼 값
export const COIN_GOAL = 3 // 위쪽 물받이에 이만큼 넣으면 체험 완료
export const CLAW_TIME = 15 // 인형뽑기: 한 판에 집게를 움직일 수 있는 시간(초), 지나면 자동으로 내려감

export const useBkActivity = create((set, get) => ({
  coin: { near: false, active: false, power: 0, charging: false, wishes: 0, tosses: 0, lastResult: null },
  setCoin: (patch) => set({ coin: { ...get().coin, ...patch } }),
  startCoin: () => set({ coin: { ...get().coin, active: true, power: 0, charging: false, wishes: 0, tosses: 0, lastResult: null } }),
  endCoin: () => set({ coin: { ...get().coin, active: false, charging: false, power: 0 } }),

  // claw: 인형뽑기
  //   near: 기계 앞인지, active: 조작 중인지
  //   phase: 'move'(집게 움직이기) | 'drop'(내려감) | 'grab'(집기) | 'lift'(올라감) | 'return'(배출구로) | 'release'(놓기)
  //   timeLeft: 이번 판 남은 이동 시간(초), tries/wins: 시도·획득 수, lastResult: 'win' | 'slip' | 'miss' | null
  //   level: 난이도 'easy' | 'normal' | 'hard' (bk_clawMachine.jsx의 CLAW_LEVELS)
  claw: { near: false, active: false, phase: 'move', timeLeft: CLAW_TIME, tries: 0, wins: 0, lastResult: null, level: 'normal' },
  setClaw: (patch) => set({ claw: { ...get().claw, ...patch } }),
  startClaw: (time = CLAW_TIME) => set({ claw: { ...get().claw, active: true, phase: 'move', timeLeft: time, lastResult: null } }),
  endClaw: () => set({ claw: { ...get().claw, active: false, phase: 'move' } }),

  // tarot: 커플 타로 텐트 (bk_tarotBooth.jsx)
  //   near: 텐트 앞인지 → "E 커플 타로", active: 타로 화면이 열려 있는지
  tarot: { near: false, active: false, spot: null }, // spot: 텐트 앞 [x, z] (같이 볼 사람 찾기용)
  setTarot: (patch) => set({ tarot: { ...get().tarot, ...patch } }),

  // scope: SKY 전망대 망원경 (bk_telescope.jsx)
  //   near: 앞에 서 있는 망원경 번호 (없으면 -1), active: 망원경 화면이 열려 있는지, index: 보고 있는 망원경, focus: 십자선에 맞춘 명소 번호
  scope: { near: -1, active: false, index: 0, focus: -1 },
  setScope: (patch) => set({ scope: { ...get().scope, ...patch } }),

  completed: {},
  complete: (activityId) => {
    if (get().completed[activityId]) return false // 이미 완료 → 다시 처리하지 않음
    set({ completed: { ...get().completed, [activityId]: new Date().toISOString() } })
    return true
  },
}))
