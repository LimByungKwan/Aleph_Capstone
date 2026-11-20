import { create } from 'zustand'

// 응원봉 리듬 게임 상태. 담당: 성근(SG)
// 열림 여부는 공용 gameStore.openPanel.type === 'sg_cheer'로 판단 → ESC(공용 InteractionKeys)로 닫혀도 따로 맞출 필요 없음
// near: 응원 자리 감지 범위 안인지 → "E 응원봉 리듬 게임" 안내
export const useSgCheer = create((set) => ({
  near: false,
  setNear: (near) => set({ near }),
}))

export const CHEER_PANEL = 'sg_cheer'

// ── 리듬 게임 규칙 (화면과 분리한 순수 함수: 숫자만 받고 숫자만 돌려줌) ──
export const GAME_SECONDS = 20
export const APPROACH = 1.2 // 원이 줄어드는 시간(초)
const BEAT = 0.6 // 100 BPM
const PATTERN = [1, 0, 1, 0, 1, 1, 0, 1] // 박자마다 노트 있음(1)/없음(0)
export const WINDOW = { perfect: 0.06, good: 0.15, early: 0.3 }
export const POINTS = { perfect: 100, good: 50, miss: 0 }

// 노트 시각(초) 목록. 누가 해도 같은 순서라 점수 비교가 공정함
export function makeNotes() {
  const notes = []
  for (let i = 0, t = 1.5; t <= GAME_SECONDS - 0.5; i++, t += BEAT) if (PATTERN[i % PATTERN.length]) notes.push(+t.toFixed(2))
  return notes
}

// 누른 시각과 노트 시각 차이(dt = 누른 시각 - 노트 시각) → 판정. 판정 범위 밖이면 null(이 노트와 무관한 입력)
// 너무 일찍(early) 누르면 Miss → 연타로 점수 따기 막기
export function judge(dt) {
  if (dt < -WINDOW.early || dt > WINDOW.good) return null
  const gap = Math.abs(dt)
  if (gap <= WINDOW.perfect) return 'perfect'
  if (gap <= WINDOW.good) return 'good'
  return 'miss'
}
