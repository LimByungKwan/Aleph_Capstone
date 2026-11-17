import { create } from 'zustand'
import { MOCK_USERS } from '../../api/mockDb.js'

// [3. 개발 > 기초개발/서비스] 혜진 담당 UI 상태 (gameStore와 분리)
// - 현재 사용자(역할): 로그인은 지민님 담당이라 지금은 시연용 계정 전환만 해요.
// - 열린 창(스탬프북/쿠폰함), 알림(toast)
// gameStore(팀 공용 약속)는 읽기만 하고 고치지 않아요.

const SESSION_KEY = 'scenewalk-mock-user'

function loadUserId() {
  try {
    const saved = window.localStorage.getItem(SESSION_KEY)
    // 예전에 저장된 계정(없어진 계정)이면 순례객으로 시작
    return MOCK_USERS.some((u) => u.id === saved) ? saved : MOCK_USERS[0].id
  } catch {
    return MOCK_USERS[0].id
  }
}

export const useUiStore = create((set, get) => ({
  userId: loadUserId(),
  setUser: (userId) => {
    try {
      window.localStorage.setItem(SESSION_KEY, userId)
    } catch {
      // 저장 못 해도 이번 접속에서는 동작
    }
    set({ userId, modal: null })
  },

  // 'stampbook' | 'coupons' | null
  modal: null,
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  // 스탬프·쿠폰이 바뀌면 숫자를 늘려서 목록이 다시 불러와지게 함
  dataVersion: 0,
  bumpData: () => set({ dataVersion: get().dataVersion + 1 }),

  toasts: [],
  toast: (text, tone = 'info') => {
    const id = Date.now() + Math.random()
    set({ toasts: [...get().toasts, { id, text, tone }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200)
  },
}))

export const currentUser = (userId) => MOCK_USERS.find((u) => u.id === userId) ?? MOCK_USERS[0]
