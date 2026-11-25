import { create } from 'zustand'
import { MOCK_USERS } from '../../api/mockDb.js'
import { USE_SERVER, openLogin, useSessionStore } from '../../api/session.js'

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

// [지민] 서버 모드(VITE_API_URL)에서는 로그인한 사람이 현재 사용자 (시연 계정 전환 대신)
const GUEST = { id: 'guest', name: '손님', role: 'guest' }
const sessionUserId = () => useSessionStore.getState().user?.id ?? GUEST.id

export const useUiStore = create((set, get) => ({
  userId: USE_SERVER ? sessionUserId() : loadUserId(),
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
  // [지민] 서버 모드에서 손님(비로그인)이 스탬프북을 열면 스탬프북 대신 로그인 창 (11/24 지민 결정)
  //        스탬프북을 여는 버튼이 여러 곳(오른쪽 위·쿠폰함·입구 안내·방파제)이라 여기 한 곳에서 막음
  openModal: (modal) => {
    if (USE_SERVER && modal === 'stampbook' && !useSessionStore.getState().session) {
      openLogin({ title: '로그인하고 스탬프북을 봐요', reason: '모은 스탬프는 계정에 저장돼서 다른 기기에서도 그대로 보여요.' })
      return
    }
    set({ modal })
  },
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

// 로그인·로그아웃하면 userId가 바뀌어 스탬프·쿠폰 목록이 다시 불러와짐
if (USE_SERVER) {
  useSessionStore.subscribe((state, prev) => {
    if (state.user?.id !== prev.user?.id) useUiStore.setState({ userId: state.user?.id ?? GUEST.id, modal: null })
  })
}

export const currentUser = (userId) =>
  USE_SERVER ? (useSessionStore.getState().user ?? GUEST) : (MOCK_USERS.find((u) => u.id === userId) ?? MOCK_USERS[0])
