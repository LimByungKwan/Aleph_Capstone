import characters from '@shared/characters.json'
import { ApiError } from './errors.js'
import { authRequest, openLogin, publicRequest, useSessionStore } from './session.js'
import { requestPromo } from './course.js'
import { generatePromoMock } from '../components/boss/promoMock.js'
import { checkPromoRules } from '../components/boss/promoRules.js'

// [지민] client.js의 "서버 모드" 구현 — 함수 이름·응답 모양은 client.js(mock)와 같다
// 누가 요청했는지는 화면이 넘기는 userId가 아니라 로그인 토큰으로 서버·DB가 판단한다
// (화면에서 userId를 바꿔 보내도 남의 스탬프·쿠폰에 접근할 수 없음)

const loggedIn = () => Boolean(useSessionStore.getState().session)

// ── 캐릭터 선택·꾸미기: 계정(profiles.appearance)에 저장 → 다른 기기에서 로그인해도 유지 ──
// 브라우저 저장(localStorage)은 캐시로 같이 둔다
//   - 고르면 바로 반영 (Render 무료 서버가 잠들어 있어도 50초 기다리지 않음), 서버 저장은 뒤에서
//   - 서버가 아직 꾸미기 기능 전이거나 실패해도 이 브라우저에서는 그대로 동작
const CHARACTER_KEY = 'scenewalk-character-v1'
function readCharacters() {
  try {
    return JSON.parse(window.localStorage.getItem(CHARACTER_KEY) || '{}')
  } catch {
    return {}
  }
}
function cacheCharacter(userId, id) {
  try {
    window.localStorage.setItem(CHARACTER_KEY, JSON.stringify({ ...readCharacters(), [userId]: id }))
  } catch {
    // 저장 못 해도 이번 접속에서는 동작
  }
}
const findCharacter = (id) => characters.find((c) => c.id === id)

export async function getAppearance() {
  if (!loggedIn()) return { appearance: {} }
  return authRequest('/me/appearance')
}

export function saveAppearance({ patch }) {
  return authRequest('/me/appearance', { method: 'PATCH', body: { appearance: patch } })
}

export async function getPlayerCharacter({ userId }) {
  let id = readCharacters()[userId]
  try {
    const { appearance } = await getAppearance()
    if (findCharacter(appearance.characterId)) {
      id = appearance.characterId
      cacheCharacter(userId, id)
    }
  } catch (error) {
    console.warn('[character] 서버에서 못 불러와서 이 브라우저 값 사용', error)
  }
  return { character: findCharacter(id) ?? characters[0] }
}

export async function setPlayerCharacter({ userId, characterId }) {
  const character = findCharacter(characterId)
  if (!character) throw new ApiError('INVALID_CHARACTER', '선택할 수 없는 캐릭터예요.')
  cacheCharacter(userId, character.id)
  if (loggedIn()) {
    saveAppearance({ patch: { characterId: character.id } }).catch((error) =>
      console.warn('[character] 서버 저장 실패 — 이 브라우저에는 저장됨', error),
    )
  }
  return { character }
}

// ── 커플 타로 기록 (Supabase tarot_readings) ──
export async function listTarotReadings({ limit = 10 } = {}) {
  if (!loggedIn()) return { readings: [] }
  return authRequest(`/me/tarot-readings?limit=${encodeURIComponent(limit)}`)
}

export function saveTarotReading({ spread, cards, summary, detail }) {
  return authRequest('/me/tarot-readings', { method: 'POST', body: { spread, cards, summary, detail } })
}

export function deleteTarotReading({ readingId }) {
  return authRequest(`/me/tarot-readings/${encodeURIComponent(readingId)}`, { method: 'DELETE' })
}

// ── 워프존 활성화 기록 (Supabase warp_unlocks, 워프존 화면: 병관) ──
export async function listWarps() {
  if (!loggedIn()) return { warps: [] }
  return authRequest('/me/warps')
}

export function unlockWarp({ warpId }) {
  return authRequest('/me/warps', { method: 'POST', body: { warpId } })
}

// ── 접속 기록 (일일 접속자) ── 손님(비로그인)은 세지 않음 (11/17 팀 결정)
export async function logVisit() {
  if (!loggedIn()) return { counted: false }
  return authRequest('/me/visit', { method: 'POST' })
}

// ── 스탬프 ──
// 손님(비로그인)은 맵·체험은 그대로 즐기고, 스탬프를 받으려는 순간에만 로그인 창을 띄운다
// (스탬프 버튼이 있는 화면들을 하나하나 고치지 않고 여기 한 곳에서 막음)
export function collectStamp({ placeId }) {
  if (!loggedIn()) {
    openLogin({
      title: '로그인하고 스탬프를 찍어요',
      reason: '처음이라면 아래 회원가입하기로 바로 시작할 수 있어요. 모은 스탬프는 계정에 저장돼요.',
    })
    return Promise.reject(new ApiError('LOGIN_REQUIRED', '스탬프는 로그인하면 모을 수 있어요.'))
  }
  return authRequest('/stamps', { method: 'POST', body: { placeId } })
}

export async function listMyStamps() {
  if (!loggedIn()) return { stamps: [] }
  return authRequest('/stamps/me')
}

// ── 쿠폰 ──
export async function listMyCoupons() {
  if (!loggedIn()) return { coupons: [] }
  return authRequest('/coupons/me')
}

export function redeemCoupon({ code }) {
  // 멱등성 키: 이 요청 한 번에 하나. 응답이 유실돼 같은 키로 다시 보내면 서버가 첫 결과를 그대로 돌려줌
  return authRequest('/coupons/redeem', { method: 'POST', body: { code, idempotencyKey: crypto.randomUUID() } })
}

// ── 사장님 ──
export function getShopStats() {
  return authRequest('/shop/stats')
}

/** [지민] 관리자 통계 — 화면(성근 AdminPage)이 쓰는 getAdminStats와 같은 모양. 관리자가 아니면 NOT_ADMIN */
export function getAdminStats() {
  return authRequest('/admin/stats')
}

export async function generatePromo(input) {
  const user = useSessionStore.getState().user
  if (user?.role !== 'owner') throw new ApiError('NOT_OWNER', '사장님 계정만 쓸 수 있어요.')
  if (!input.shopName?.trim()) throw new ApiError('INVALID_INPUT', '가게 이름을 입력해 주세요.')
  try {
    return await requestPromo(input)
  } catch (error) {
    if (error?.code === 'RATE_LIMITED') throw error
    return { ...generatePromoMock(input), source: 'mock' } // AI 서버에 닿지 않으면 화면용 가짜 문구
  }
}

export function saveShopPromo({ text, tag }) {
  const warnings = checkPromoRules(text)
  if (warnings.length) return Promise.reject(new ApiError('RULE_VIOLATION', warnings[0]))
  return authRequest('/shop/promo', { method: 'PUT', body: { text, tag } })
}

export function getShopPromo({ shopId }) {
  return publicRequest(`/shops/${encodeURIComponent(shopId)}/promo`)
}
