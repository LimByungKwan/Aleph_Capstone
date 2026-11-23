import characters from '@shared/characters.json'
import { ApiError } from './errors.js'
import { authRequest, publicRequest, useSessionStore } from './session.js'
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

// ── 스탬프 ──
export function collectStamp({ placeId }) {
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
