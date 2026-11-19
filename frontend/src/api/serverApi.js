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

// ── 캐릭터 선택: 서버에 저장할 만큼 중요하지 않아서 브라우저에 사용자별로 저장 ──
const CHARACTER_KEY = 'scenewalk-character-v1'
function readCharacters() {
  try {
    return JSON.parse(window.localStorage.getItem(CHARACTER_KEY) || '{}')
  } catch {
    return {}
  }
}

export async function getPlayerCharacter({ userId }) {
  const id = readCharacters()[userId]
  return { character: characters.find((c) => c.id === id) ?? characters[0] }
}

export async function setPlayerCharacter({ userId, characterId }) {
  const character = characters.find((c) => c.id === characterId)
  if (!character) throw new ApiError('INVALID_CHARACTER', '선택할 수 없는 캐릭터예요.')
  try {
    window.localStorage.setItem(CHARACTER_KEY, JSON.stringify({ ...readCharacters(), [userId]: character.id }))
  } catch {
    // 저장 못 해도 이번 접속에서는 동작
  }
  return { character }
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
