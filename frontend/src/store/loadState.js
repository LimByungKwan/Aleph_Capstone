import { create } from 'zustand'

// 첫 로딩 상태 (담당: 병관) — 로딩 화면(components/loading/LoadingScreen.jsx)이 읽음
// mapReady: 맵 소품을 나눠 붙이는 일(MapLayout)이 다 끝났는지 — 이 뒤에 셰이더 미리 컴파일·조명 정리를 함
// shadersReady: 셰이더 미리 컴파일(ShaderWarmup)이 처음 한 번 끝났는지
export const useLoadState = create((set) => ({
  mapReady: false,
  setMapReady: () => set({ mapReady: true }),
  shadersReady: false,
  setShadersReady: () => set({ shadersReady: true }),
}))
