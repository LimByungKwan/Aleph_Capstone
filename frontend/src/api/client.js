import places from '@shared/places.json'
import characters from '@shared/characters.json'
import { MOCK_USERS, SHOP_OFFERS, dayKey, findPlace, newCouponCode, newId, readDb, writeDb } from './mockDb.js'
import { generatePromoMock } from '../components/boss/promoMock.js'
import { requestPromo } from './course.js'
import { checkPromoRules } from '../components/boss/promoRules.js'

// [3. 개발 > 백엔드 API 연동] 화면이 부르는 API 함수 모음
//
// ⚠ 요청/응답 모양은 "초안"이에요. 셋이 합의 후 확정 (팀 규칙: 합의 없이 변경 X)
//   - 스탬프·쿠폰·접속자 수: 지민님 API (Supabase)
//   - 홍보문구 생성: 병관님 AI API
// VITE_API_URL이 있으면 지민 서버(server/ → Supabase)를 부르고(serverApi.js), 없으면 아래 mockDb(localStorage)로 동작해요.
// 함수 이름·응답 모양은 두 모드가 같아요. 서버 모드에서는 userId/ownerId 인자를 쓰지 않고 로그인 토큰으로 사람을 구분해요.
//
// 실패하면 ApiError를 던져요. error.code로 화면에서 안내 문구를 고릅니다.

import { ApiError } from './errors.js'
import { USE_SERVER } from './session.js'
import * as server from './serverApi.js'

export { ApiError }

const LATENCY_MS = 250 // 실제 네트워크처럼 살짝 기다림 (로딩 표시 확인용)
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS))

function requireUser(userId) {
  const user = MOCK_USERS.find((u) => u.id === userId)
  if (!user) throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.')
  return user
}

// 캐릭터 카탈로그와 사용자 선택. 실제 서버 연동 시 이 두 함수의 내부만 교체합니다.
export async function getPlayerCharacter({ userId }) {
  if (USE_SERVER) return server.getPlayerCharacter({ userId })
  await wait()
  requireUser(userId)
  const id = readDb().playerCharacters?.[userId]
  return { character: characters.find(character => character.id === id) ?? characters[0] }
}

export async function setPlayerCharacter({ userId, characterId }) {
  if (USE_SERVER) return server.setPlayerCharacter({ userId, characterId })
  await wait()
  requireUser(userId)
  const character = characters.find(item => item.id === characterId)
  if (!character) throw new ApiError('INVALID_CHARACTER', '선택할 수 없는 캐릭터예요.')
  const db = readDb()
  db.playerCharacters = { ...db.playerCharacters, [userId]: character.id }
  writeDb(db)
  return { character }
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
  if (USE_SERVER) return server.collectStamp({ userId, placeId })
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
  if (USE_SERVER) return server.listMyStamps({ userId })
  await wait()
  requireUser(userId)
  return { stamps: readDb().stamps.filter((s) => s.userId === userId) }
}

// ───────────────────────── 쿠폰 ─────────────────────────

/** 내 쿠폰함 — 응답: { coupons: Coupon[] } (최신순) */
export async function listMyCoupons({ userId }) {
  if (USE_SERVER) return server.listMyCoupons({ userId })
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
  if (USE_SERVER) return server.redeemCoupon({ ownerId, code })
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
  if (USE_SERVER) return server.getShopStats({ ownerId })
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
 * 문구는 병관님 AI 서버(/promo, 템플릿 방식·요금 0원)가 만들고, 서버가 꺼져 있으면 promoMock으로 대신해요.
 */
export async function generatePromo(input) {
  if (USE_SERVER) return server.generatePromo(input)
  const owner = requireUser(input.ownerId)
  if (owner.role !== 'owner') throw new ApiError('NOT_OWNER', '사장님 계정만 쓸 수 있어요.')
  if (!input.shopName?.trim()) throw new ApiError('INVALID_INPUT', '가게 이름을 입력해 주세요.')
  let result
  try {
    result = await requestPromo(input)
  } catch (error) {
    if (error?.code === 'RATE_LIMITED') throw error
    await wait()
    result = { ...generatePromoMock(input), source: 'mock' } // AI 서버에 닿지 않으면 화면용 가짜 문구
  }
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
  if (USE_SERVER) return server.saveShopPromo({ ownerId, text, tag })
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
  if (USE_SERVER) return server.getShopPromo({ shopId })
  await wait()
  return { shopPromo: readDb().shopPromos?.[shopId] ?? null }
}

// ───────────────────────── 관리자 통계 (성근) ─────────────────────────

/** 게임에 들어올 때 부름. 같은 사람은 하루 1번만 기록 — 응답: { counted: boolean } */
export async function logVisit({ userId }) {
  // shortcut: 서버에 접속 기록 라우트가 아직 없어 서버 모드는 건너뜀, /admin/stats 작업 때 서버 기록 추가
  if (USE_SERVER) return { counted: false }
  const db = readDb()
  const day = dayKey()
  if (db.visits.some((v) => v.userId === userId && v.day === day)) return { counted: false }
  db.visits.push({ userId, day })
  writeDb(db)
  return { counted: true }
}

const countBy = (items, keyOf) => items.reduce((map, item) => map.set(keyOf(item), (map.get(keyOf(item)) ?? 0) + 1), new Map())
const byCountDesc = (a, b) => b.count - a.count

/**
 * 요청: { adminId }
 * 응답: { todayVisitors, totalStamps, couponsIssued, couponsUsed,
 *         dailyVisitors: [{ day, count }] (최근 7일, 오래된 날부터, 빈 날 0),
 *         stampsByZone: [{ zone, count }] (많은 순), topPlaces: [{ placeId, name, zone, count }] (최대 5, 많은 순) }
 * 사용률은 화면에서 couponsUsed / couponsIssued로 계산해요.
 */
export async function getAdminStats({ adminId }) {
  if (USE_SERVER) throw new ApiError('NOT_READY', '서버 통계는 아직 연결 전이에요. mock 모드에서 확인해 주세요.')
  await wait()
  const admin = requireUser(adminId)
  if (admin.role !== 'admin') throw new ApiError('NOT_ADMIN', '관리자 계정만 볼 수 있어요.')
  const db = readDb()
  const visitsPerDay = countBy(db.visits, (v) => v.day)
  const dailyVisitors = Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(Date.now() - (6 - i) * 86_400_000)
    return { day, count: visitsPerDay.get(day) ?? 0 }
  })
  const stampedPlaces = db.stamps.map((s) => findPlace(s.placeId)).filter(Boolean) // places.json에서 빠진 장소는 제외
  return {
    todayVisitors: visitsPerDay.get(dayKey()) ?? 0,
    totalStamps: db.stamps.length,
    couponsIssued: db.coupons.length,
    couponsUsed: db.coupons.filter((c) => c.usedAt).length,
    dailyVisitors,
    stampsByZone: [...countBy(stampedPlaces, (p) => p.zone)].map(([zone, count]) => ({ zone, count })).sort(byCountDesc),
    topPlaces: [...countBy(stampedPlaces, (p) => p.id)]
      .map(([placeId, count]) => {
        const place = findPlace(placeId)
        return { placeId, name: place.name, zone: place.zone, count }
      })
      .sort(byCountDesc)
      .slice(0, 5),
  }
}

// '2026-11-30' → '2026.11.30'
export function formatDate(day) {
  return day ? day.replaceAll('-', '.') : ''
}

export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
