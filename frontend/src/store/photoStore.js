import { create } from 'zustand'

// 인증샷 (담당: 병관)
// - 화면(UI)의 📸 버튼이 shoot()을 부르면 → 3D 캔버스 안의 PhotoCapturer(CourseMarker.jsx)가 지금 장면을 그려서 이미지로 넘겨줌
// - 캔버스 밖에서는 three.js 렌더러에 손댈 수 없어서 이렇게 "요청 → 처리" 두 단계로 나눔
// photo: 완성된 사진 { url(JPEG data URL), place, zoneName, date } — 미리보기 창이 보여 줌
export const usePhotoStore = create((set, get) => ({
  request: 0, // 숫자가 바뀌면 캔버스 쪽이 한 장 찍음
  busy: false,
  photo: null,
  shoot: () => {
    if (get().busy) return
    set({ busy: true, request: get().request + 1 })
  },
  done: (photo) => set({ busy: false, photo }),
  fail: () => set({ busy: false }),
  close: () => set({ photo: null }),
}))
