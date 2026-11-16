import { create } from 'zustand'

// 3D(game)와 UI(ui)를 잇는 유일한 연결점.
// ⚠ 팀원과 맞춘 약속이라 이름을 바꾸지 마세요.
//
// nearbyPlaceId : 캐릭터가 지금 들어가 있는 상호작용 지점 id (shared/places.json의 id), 없으면 null
// setNearby(id) : 3D 쪽 센서가 호출
// openPanel     : 열려 있는 패널 { type, placeId } 또는 null  (type은 places.json의 "spot" | "cafe" | "npc")
// open(panel)   : 패널 열기 (E키, 또는 UI 쪽에서 호출 가능)
// close()       : 패널 닫기 (ESC, 또는 UI의 닫기 버튼에서 호출 가능)
// inputLocked   : 패널이 열려 있으면 true → 캐릭터가 움직이지 않음
//
// 사용 예 (UI 팀원):
//   import { useGameStore } from '../store/gameStore.js'
//   const openPanel = useGameStore((s) => s.openPanel)
//   const close = useGameStore((s) => s.close)
export const useGameStore = create((set) => ({
  nearbyPlaceId: null,
  setNearby: (id) => set({ nearbyPlaceId: id }),

  openPanel: null,
  inputLocked: false,
  open: (panel) => set({ openPanel: panel, inputLocked: true }),
  close: () => set({ openPanel: null, inputLocked: false }),
}))
