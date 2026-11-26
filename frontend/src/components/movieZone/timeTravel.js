import { create } from 'zustand'
import { GS_SHIFT, zoneToWorld } from './hjAreas.js'

// [3. 개발 > 프론트엔드] 시간 열차 (혜진 영화·드라마 구역)
// 1930 경성거리 증기기관차를 타고 북쪽 터널(북악산 속)로 들어가면 → "시간 터널" 화면 → 2026 현대 서울 역 승강장에 내려요.
// 현대 서울 역에서 전동 열차를 타고 터널로 들어가면 → 다시 1930 경성역 승강장으로 돌아와요.
// 현대 서울은 본 맵에서 아주 멀리(카메라·안개 너머) 떨어진 곳에 있어서 본 맵에서는 보이지 않아요.

/** 현대 서울 한가운데 (월드 좌표). 본 맵 북쪽 끝(z 250)에서 1150m 떨어져 카메라 최대 거리(1000m) 밖 */
export const SEOUL_CENTER = [0, 0.06, 1400] // 바깥 바다(높이 0.035)보다 살짝 위
/** 현대 서울 → 기준점 기준 좌표를 월드로 */
export const seoulToWorld = (lx, ly, lz) => [SEOUL_CENTER[0] + lx, SEOUL_CENTER[1] + ly, SEOUL_CENTER[2] + lz]

// 현대 서울 역 (HjModernSeoul.jsx와 같은 값): 선로는 동서(x) 방향, 승강장은 선로 북쪽
export const SEOUL_GATE_Z = 86
export const SEOUL_STATION = {
  trackZ: -104, // 선로 가운데 z
  platform: { x0: -42, x1: 42, z0: -101.6, z1: -93.5, top: 0.9 }, // 승강장 (높이 0.9)
}
// 내리는 자리 (palaceSeating이 y에 +1 해서 세워요)
export const SEOUL_ARRIVE = seoulToWorld(6, SEOUL_STATION.platform.top, -96.5)
export const GYEONGSEONG_ARRIVE = zoneToWorld(-40.1, 38.5 + GS_SHIFT, 0.5) // 경성역 기차 승강장

// 시간 터널 화면: kind 'toSeoul' | 'toGyeongseong'. 화면이 어두워진 뒤(COVER_MS) 캐릭터를 옮기고, 조금 뒤 밝아져요
const COVER_MS = 1100
const TOTAL_MS = 3200
export const useTimeTravel = create((set, get) => ({
  kind: null,
  startedAt: 0,
  seoulActive: false, // 현대 서울을 그릴지 (가까이 있거나 가는 중일 때만)
  setSeoulActive: (on) => {
    if (get().seoulActive !== on) set({ seoulActive: on })
  },
  clear: () => set({ kind: null, startedAt: 0 }),
}))

/**
 * 시간 열차가 터널에 들어갔을 때 매 프레임 불러요.
 * 처음 부르면 시간 터널 화면을 시작하고, 화면이 다 덮였으면 true (= 이제 옮겨도 돼요)
 */
export function beginTimeTravel(kind) {
  const s = useTimeTravel.getState()
  const now = performance.now()
  if (s.kind !== kind || now - s.startedAt > TOTAL_MS) {
    useTimeTravel.setState({ kind, startedAt: now, ...(kind === 'toSeoul' ? { seoulActive: true } : {}) })
    setTimeout(() => {
      if (useTimeTravel.getState().startedAt === now) useTimeTravel.getState().clear()
    }, TOTAL_MS)
    return false
  }
  return now - s.startedAt >= COVER_MS
}

// 캐릭터 위치로 현대 서울을 그릴지 정해요 (hjAreas.trackHjArea가 매 프레임 불러요)
const NEAR_M = 520
export function trackSeoul(position) {
  const near = Math.hypot(position.x - SEOUL_CENTER[0], position.z - SEOUL_CENTER[2]) < NEAR_M
  const s = useTimeTravel.getState()
  s.setSeoulActive(near || s.kind === 'toSeoul')
}
