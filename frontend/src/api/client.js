import places from '@shared/places.json'
import { MOCK_USERS, SHOP_OFFERS, dayKey, findPlace, newCouponCode, newId, readDb, writeDb } from './mockDb.js'
import { generatePromoMock } from '../components/boss/promoMock.js'
import { checkPromoRules } from '../components/boss/promoRules.js'

// [3. 개발 > 백엔드 API 연동] 화면이 부르는 API 함수 모음
//
// ⚠ 요청/응답 모양은 "초안"이에요. 셋이 합의 후 확정 (팀 규칙: 합의 없이 변경 X)
//   - 스탬프·쿠폰·접속자 수: 지민님 API (Supabase)
//   - 홍보문구 생성: 병관님 AI API
// 지금은 mockDb(localStorage)로 동작하고, 실제 서버가 준비되면 이 파일 안쪽만 fetch로 바꾸면 돼요.
//
// 실패하면 ApiError를 던져요. error.code로 화면에서 안내 문구를 고릅니다.

export class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

const LATENCY_MS = 250 // 실제 네트워크처럼 살짝 기다림 (로딩 표시 확인용)
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS))

function requireUser(userId) {
  const user = MOCK_USERS.find((u) => u.id === userId)
  if (!user) throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.')
  return user
}

// 같은 구역 + 같은 작품의 가게 (다른 사람 구역 가게 쿠폰까지 나가지 않게)
function shopsForWork(work, zone) {
  return places.filter((p) => p.type === 'cafe' && p.work && p.work === work && p.zone === zone)
}

// ───────────────────────── 스탬프 ─────────────────────────

/**
 * 스탬프 찍기
 * 요청: { userId, placeId }
 * 응답: { stamp: { id, placeId, createdAt }, issuedCoupons: Coupon[] }
 * 에러: ALREADY_STAMPED(중복 획득), NOT_STAMPABLE(NPC 등), NOT_FOUND
 * 규칙: 촬영지 스탬프를 찍으면 "같은 구역 + 같은 작품" 가게 쿠폰이 1장 발급 (가게당 1인 1장)
 */
export async function collectStamp({ userId, placeId }) {
  await wait()
  requireUser(userId)
  const place = findPlace(placeId)
  if (!place) throw new ApiError('NOT_FOUND', '없는 장소예요.')
  if (place.type === 'npc') throw new ApiError('NOT_STAMPABLE', '이 장소는 스탬프가 없어요.')

  const db = readDb()
  if (db.stamps.some((s) => s.userId === userId && s.placeId === placeId)) {
    throw new ApiError('ALREADY_STAMPED', '이미 받은 스탬프예요.')
  }

  const stamp = { id: newId('st'), userId, placeId, createdAt: new Date().toISOString() }
  db.stamps.push(stamp)

  const issuedCoupons = []
  if (place.type === 'spot') {
    const codes = new Set(db.coupons.map((c) => c.code))
    for (const shop of shopsForWork(place.work, place.zone)) {
      const already = db.coupons.some((c) => c.userId === userId && c.shopId === shop.id)
      if (already) continue
      const offer = SHOP_OFFERS[shop.id]
      const issuedAt = new Date()
      const coupon = {
        id: newId('cp'),
        code: newCouponCode(codes),
        userId,
        shopId: shop.id,
        shopName: shop.name,
        title: offer?.title ?? `${shop.name} 방문 감사 쿠폰`,
        discount: offer?.discount ?? 'GIFT',
        validUntil: dayKey(issuedAt.getTime() + (offer?.validDays ?? 30) * 86400000),
        reason: `${place.name} 스탬프 획득`,
        issuedAt: issuedAt.toISOString(),
        usedAt: null,
      }
      codes.add(coupon.code)
      db.coupons.push(coupon)
      issuedCoupons.push(coupon)
    }
  }

  writeDb(db)
  return { stamp, issuedCoupons }
}

/** 내 스탬프 목록 — 응답: { stamps: [{ id, placeId, createdAt }] } */
export async function listMyStamps({ userId }) {
  await wait()
  requireUser(userId)
  return { stamps: readDb().stamps.filter((s) => s.userId === userId) }
}

// ───────────────────────── 쿠폰 ─────────────────────────

/** 내 쿠폰함 — 응답: { coupons: Coupon[] } (최신순) */
export async function listMyCoupons({ userId }) {
  await wait()
  requireUser(userId)
  const coupons = readDb()
    .coupons.filter((c) => c.userId === userId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  return { coupons }
}

/**
 * 쿠폰 사용 처리 (사장님)
 * 요청: { ownerId, code }
 * 응답: { coupon }
 * 에러: NOT_OWNER(사장님 아님), NOT_FOUND(코드 없음), WRONG_SHOP(다른 가게 쿠폰), COUPON_USED(이미 사용)
 */
export async function redeemCoupon({ ownerId, code }) {
  await wait()
  const owner = requireUser(ownerId)
  if (owner.role !== 'owner') throw new ApiError('NOT_OWNER', '사장님 계정만 쿠폰을 사용 처리할 수 있어요.')

  const normalized = String(code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(normalized)) throw new ApiError('INVALID_CODE', '쿠폰 코드는 영문·숫자 6자리예요.')

  const db = readDb()
  const coupon = db.coupons.find((c) => c.code === normalized)
  if (!coupon) throw new ApiError('NOT_FOUND', '등록되지 않은 쿠폰 코드예요.')
  if (coupon.shopId !== owner.shopId) throw new ApiError('WRONG_SHOP', '우리 가게 쿠폰이 아니에요.')
  if (coupon.usedAt) throw new ApiError('COUPON_USED', `이미 사용한 쿠폰이에요. (${formatTime(coupon.usedAt)})`)
  if (coupon.validUntil && coupon.validUntil < dayKey()) throw new ApiError('COUPON_EXPIRED', `유효기간(${formatDate(coupon.validUntil)})이 지난 쿠폰이에요.`)

  coupon.usedAt = new Date().toISOString()
  coupon.usedBy = ownerId
  writeDb(db)
  return { coupon }
}

// ───────────────────────── 사장님 통계 ─────────────────────────

/** 응답: { issued, used, visitors, recentRedemptions: Coupon[] } */
export async function getShopStats({ ownerId }) {
  await wait()
  const owner = requireUser(ownerId)
  if (owner.role !== 'owner') throw new ApiError('NOT_OWNER', '사장님 계정만 볼 수 있어요.')
  const db = readDb()
  const shop = findPlace(owner.shopId)
  const coupons = db.coupons.filter((c) => c.shopId === owner.shopId)
  const relatedSpots = places.filter((p) => p.type === 'spot' && p.work === shop?.work).map((p) => p.id)
  return {
    issued: coupons.length,
    used: coupons.filter((c) => c.usedAt).length,
    visitors: db.stamps.filter((s) => s.placeId === owner.shopId || relatedSpots.includes(s.placeId)).length,
    recentRedemptions: coupons.filter((c) => c.usedAt).sort((a, b) => b.usedAt.localeCompare(a.usedAt)).slice(0, 5),
  }
}

// ───────────────────────── 홍보문구 (병관님 AI API) ─────────────────────────

/**
 * 홍보문구 생성
 * 요청: { ownerId, shopName, workTitle, offer, menu, target, tone, includeReels }
 *   target: 'couple' | 'traveler' | 'worker'  (어떤 손님을 초대할지)
 *   tone:   'warm' | 'bright' | 'plain'
 * 응답: { captions: string[3], hashtags: string[], reels: string | null, tag: string, warnings: string[] }
 * 규칙: 배우 실명·대사 인용·로고 금지 (서버에서도 검사, 화면에서도 검사)
 */
export async function generatePromo(input) {
  await wait()
  const owner = requireUser(input.ownerId)
  if (owner.role !== 'owner') throw new ApiError('NOT_OWNER', '사장님 계정만 쓸 수 있어요.')
  if (!input.shopName?.trim()) throw new ApiError('INVALID_INPUT', '가게 이름을 입력해 주세요.')
  const result = generatePromoMock(input)
  const db = readDb()
  db.promos.push({ id: newId('pr'), shopId: owner.shopId, createdAt: new Date().toISOString(), input, result })
  writeDb(db)
  return result
}

/**
 * 고른 홍보문구를 가게 "대표 문구"로 등록 → 3D 맵에서 가게 대화창에 보여요
 * 요청: { ownerId, text, tag }   응답: { shopPromo: { text, tag, savedAt } }
 */
export async function saveShopPromo({ ownerId, text, tag }) {
  await wait()
  const owner = requireUser(ownerId)
  if (owner.role !== 'owner') throw new ApiError('NOT_OWNER', '사장님 계정만 등록할 수 있어요.')
  const warnings = checkPromoRules(text)
  if (warnings.length) throw new ApiError('RULE_VIOLATION', warnings[0])
  const db = readDb()
  const shopPromo = { text, tag, savedAt: new Date().toISOString() }
  db.shopPromos = { ...(db.shopPromos ?? {}), [owner.shopId]: shopPromo }
  writeDb(db)
  return { shopPromo }
}

/** 가게 대표 문구 — 응답: { shopPromo | null } */
export async function getShopPromo({ shopId }) {
  await wait()
  return { shopPromo: readDb().shopPromos?.[shopId] ?? null }
}

// (일일 접속자 수·관리자 통계 API는 성근님 담당이라 여기엔 없어요.)

// '2026-11-30' → '2026.11.30'
export function formatDate(day) {
  return day ? day.replaceAll('-', '.') : ''
}

export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
