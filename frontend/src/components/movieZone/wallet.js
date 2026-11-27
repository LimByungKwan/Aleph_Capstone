import { create } from 'zustand'
import { useUiStore } from './uiStore.js'

// [3. 개발 > 프론트엔드] 코인 지갑 + 승차권 (혜진 영화·드라마 구역)
// 코인 모으는 법: 인력거를 끌어 손님을 태워 주기(거리만큼) · 광복 프로젝트 완수 · 처음 들어오면 선물
// 코인으로 매표소에서 전차표·기차표를 사고, 전차·기차(시간 열차·애니 환승 열차 포함)에 탈 때 표 1장을 써요.
// 이 화면(브라우저)에 저장돼요 (localStorage) — 새로고침해도 남아요.

const KEY = 'hj.wallet.v1'
export const PRICES = { tram: 2, train: 4 }
export const FARE_NAME = { tram: '전차표', train: '기차표' }
const START = { coins: 6, tickets: { tram: 1, train: 0 } } // 처음 선물: 코인 6개 + 전차표 1장

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    if (v && Number.isFinite(v.coins) && v.tickets) return { coins: v.coins, tickets: { tram: v.tickets.tram | 0, train: v.tickets.train | 0 } }
  } catch {
    // 저장소를 못 쓰는 환경이면 처음 값으로
  }
  return START
}
function save(state) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ coins: state.coins, tickets: state.tickets }))
  } catch {
    // 저장 못 해도 이번 접속 동안은 그대로 써요
  }
}
const toast = (text, tone) => useUiStore.getState().toast?.(text, tone)

export const useWallet = create((set, get) => ({
  ...load(),
  booth: false, // 매표소 창 열림
  /** 코인 받기 */
  earn(n, why) {
    if (!(n > 0)) return
    const next = { coins: get().coins + n }
    set(next)
    save({ ...get(), ...next })
    toast(`🪙 코인 +${n}${why ? ` · ${why}` : ''}`, 'success')
  },
  /** 매표소에서 표 사기 */
  buy(kind) {
    const price = PRICES[kind]
    const s = get()
    if (!price) return false
    if (s.coins < price) {
      toast(`코인이 ${price - s.coins}개 모자라요 · 인력거를 끌어 코인을 모아 보세요`, 'error')
      return false
    }
    const next = { coins: s.coins - price, tickets: { ...s.tickets, [kind]: s.tickets[kind] + 1 } }
    set(next)
    save(next)
    toast(`🎫 ${FARE_NAME[kind]} 1장을 샀어요`, 'success')
    return true
  },
  /** [지민 11/27] 코인 n개 쓰기 (애니 구역 바다 전차 회수권 등 표 말고 다른 것 살 때). 모자라면 false */
  spend(n, why) {
    const s = get()
    if (!(n > 0)) return true
    if (s.coins < n) {
      toast(`코인이 ${n - s.coins}개 모자라요 · 인력거를 끌어 코인을 모아 보세요`, 'error')
      return false
    }
    const next = { coins: s.coins - n, tickets: s.tickets }
    set(next)
    save(next)
    toast(`🪙 코인 -${n}${why ? ` · ${why}` : ''}`, 'info')
    return true
  },
  /** 탈 때 표 1장 쓰기 (없으면 false) */
  use(kind) {
    const s = get()
    if ((s.tickets[kind] ?? 0) <= 0) return false
    const next = { coins: s.coins, tickets: { ...s.tickets, [kind]: s.tickets[kind] - 1 } }
    set(next)
    save(next)
    toast(`🎫 ${FARE_NAME[kind]} 1장을 냈어요 (남은 표 ${next.tickets[kind]}장)`, 'info')
    return true
  },
  openBooth: () => set({ booth: true }),
  closeBooth: () => set({ booth: false }),
}))

/** 이 탈것에 표가 필요한지: 'tram' · 'train' · null(무료: 인력거·자동차·열기구·지프) */
export function fareOf(vehicle) {
  if (!vehicle) return null
  if (vehicle.fare !== undefined) return vehicle.fare
  if (vehicle.label === '전차') return 'tram'
  if (/기차|열차/.test(vehicle.label ?? '')) return 'train'
  return null
}
