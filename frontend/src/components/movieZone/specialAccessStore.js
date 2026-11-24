import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { USE_SERVER, openLogin, useSessionStore } from '../../api/session.js'
import { useGameStore } from '../../store/gameStore.js'
import { usePalaceTour } from './palaceTourStore.js'
import { usePortalStore } from './portalStore.js'
import { SPECIAL_IDS, SPECIAL_LOCATIONS, getSpecialLocation } from './specialLocations.js'
import { useUiStore } from './uiStore.js'

const EMPTY = { stamps: {}, restored: {}, couponIssuedAt: null, legacyCouponIssuedAt: null }

export const selectTimePass = (state, userId) => state.accounts[userId] ?? EMPTY

export const TIME_COUPON_TITLE = '한복·개화기 의상 대여 30% 가상 체험 쿠폰'
export const TIME_STAMP_COUNT = SPECIAL_LOCATIONS.length
export const TIME_BADGE_COUNT = 4
export const ACCESS_TOAST = '현실 출입통제 구역에 특별 입장했습니다!'

export function timePassCount({ stamps }) {
  return SPECIAL_LOCATIONS.filter(({ id }) => stamps[id]).length
}

export function timeRestoredCount({ restored }) {
  return SPECIAL_LOCATIONS.filter(({ id }) => restored[id]).length
}

function migrateTimePass({ accounts = {} }) {
  return {
    accounts: Object.fromEntries(Object.entries(accounts).map(([user, pass]) => {
      const stamps = Object.fromEntries(Object.entries(pass.stamps ?? {})
        .map(([id, date]) => [SPECIAL_IDS[id] ?? id, date]).filter(([id]) => getSpecialLocation(id)))
      return [user, { ...EMPTY, stamps, restored:{ ...stamps }, legacyCouponIssuedAt:pass.couponIssuedAt }]
    })),
  }
}

// [지민] 서버 모드에서 손님(비로그인)은 시간 탐정 스탬프·쿠폰을 받을 때 로그인 창 (일반 스탬프와 같은 규칙, 11/24)
//        복원(restore)·관람은 손님도 그대로 가능. mock 모드(VITE_API_URL 없음)는 예전 그대로
function needsLogin(title) {
  if (!USE_SERVER || useSessionStore.getState().session) return false
  openLogin({ title, reason: '처음이라면 아래 회원가입하기로 바로 시작할 수 있어요.' })
  return true
}

// [3. 개발 > 프론트엔드] 가상 체험 보상은 계정별로 브라우저에 저장합니다.
export const useTimePass = create(persist((set, get) => ({
  accounts: {},
  restore(userId, id) {
    if (!getSpecialLocation(id)) return
    const pass = selectTimePass(get(), userId)
    if (pass.restored[id]) return
    const restored = { ...pass.restored, [id]: new Date().toISOString() }
    set((s) => ({ accounts: { ...s.accounts, [userId]:{ ...pass, restored } } }))
  },
  collect(userId, id) {
    if (!getSpecialLocation(id)) return null
    if (needsLogin('로그인하고 시간 탐정 스탬프를 받아요')) return null
    const pass = selectTimePass(get(), userId)
    if (pass.stamps[id] || !pass.restored[id]) return null
    const updated = { ...pass, stamps: { ...pass.stamps, [id]: new Date().toISOString() } }
    set((state) => ({ accounts: { ...state.accounts, [userId]: updated } }))
    return timePassCount(updated)
  },
  issueCoupon(userId) {
    if (needsLogin('로그인하고 쿠폰을 받아요')) return false
    const pass = selectTimePass(get(), userId)
    if (timePassCount(pass) !== TIME_STAMP_COUNT || pass.couponIssuedAt) return false
    set((state) => ({ accounts: { ...state.accounts, [userId]: { ...pass, couponIssuedAt: new Date().toISOString() } } }))
    return true
  },
}), {
  name: 'scenewalk.time-detective',
  version: 1,
  migrate: migrateTimePass,
  storage: createJSONStorage(() => localStorage),
  partialize: ({ accounts }) => ({ accounts }),
}))

export function specialAccessAvailable() {
  const tour = usePalaceTour.getState()
  const portal = usePortalStore.getState()
  return !useUiStore.getState().modal && !useGameStore.getState().inputLocked
    && !tour.open && !tour.activeActivity && !(portal.active && portal.dismissedId !== portal.active.id)
}

export const useSpecialAccess = create((set, get) => ({
  era: null,
  nearby: null,
  openedNearby: false,
  panel: null,
  pending: null,
  viewYaw: 0,
  requestedYaw: null,
  aim: (yaw) => set({ requestedYaw:yaw }),
  setViewYaw: (yaw) => { if (get().viewYaw !== yaw) set({ viewYaw:yaw }) },
  close: () => set({ panel: null, requestedYaw:null }),
  reset: () => set({ era: null, nearby: null, panel: null, pending: null, openedNearby: false, requestedYaw:null }),
  warp(id) {
    if (get().era && getSpecialLocation(id) && !get().panel && specialAccessAvailable()) set({ pending: id })
  },
  openDocent(id, announce = false) {
    const { era, panel, nearby } = get()
    if (!era || panel || !getSpecialLocation(id) || !specialAccessAvailable()) return
    set({ panel: id, openedNearby: id === nearby })
    if (announce) useUiStore.getState().toast(ACCESS_TOAST, 'ok')
  },
  sync(era, nearby) {
    const state = get()
    if (!era) {
      if (state.era || state.panel || state.pending) state.reset()
      return
    }
    if (state.era !== era || state.nearby !== nearby) {
      set({ era, nearby, openedNearby: state.nearby === nearby && state.openedNearby })
    }
    if (nearby && !get().openedNearby) state.openDocent(nearby, true)
  },
  arrived(id, era) {
    set({ pending: null, nearby: id, era, openedNearby: false })
    get().openDocent(id, true)
  },
  openReward: () => set({ panel: 'reward' }),
}))
