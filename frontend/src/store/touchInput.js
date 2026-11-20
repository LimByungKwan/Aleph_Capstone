import { create } from 'zustand'

// 모바일 버튼 입력 (담당: 병관) — Player.jsx가 키보드 입력과 합쳐서 캐릭터에 넘김
// run : 달리기 켜짐 (눌러서 켜고 끄기)
// jump: 점프 버튼을 누르고 있는 중
export const useTouchInput = create((set) => ({
  run: false,
  jump: false,
  setRun: (run) => set({ run }),
  setJump: (jump) => set({ jump }),
}))
