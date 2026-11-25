import { create } from 'zustand'

// 썬그레이 오디션 상태. 담당: 성근(SG)
// 열림 여부는 공용 gameStore.openPanel.type === AUDITION_PANEL로 판단 (ESC로 닫혀도 따로 맞출 필요 없음)
// near: 마이크 앞 감지 범위 안인지 → "E 오디션 도전" 안내
export const useSgAudition = create((set) => ({
  near: false,
  setNear: (near) => set({ near }),
}))

export const AUDITION_PANEL = 'sg_audition'
export const AUDITION_SONG = 'sungray-01' // 서버 허용 목록과 같은 id (ai/app/audition.py)

// 심사위원 3명. model을 다른 GLB 경로로 바꾸면 그 모델로 앉음 (Sit 동작이 있어야 함)
export const JUDGES = [
  { role: '프로듀서', model: 'models/characters/male.glb', color: '#ffd166' },
  { role: '보컬 트레이너', model: 'models/characters/female.glb', color: '#ff7ab6' },
  { role: '안무가', model: 'models/characters/male.glb', color: '#7ee0d0' },
]
