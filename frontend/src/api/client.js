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

// [지민] 캐릭터 꾸미기 (색·옷·모자 …) — 항목 이름과 값은 화면에서 자유롭게 정해요
//   캐릭터 종류(남/여)는 위 get/setPlayerCharacter를 쓰세요. 'characterId' 키는 그쪽이 쓰는 이름이라 피해 주세요
//   서버 모드: 계정에 저장 → 다른 기기에서 로그인해도 유지 / mock 모드: 이 브라우저에 저장

/** 응답: { appearance: { [항목]: 값 } } (저장한 적 없으면 {}) */
export async function getAppearance({ userId }) {
  if (USE_SERVER) return server.getAppearance()
  await wait()
  requireUser(userId)
  return { appearance: readDb().appearances?.[userId] ?? {} }
}

/**
 * 보낸 항목만 바꾸고 나머지는 유지해요. 값을 null로 보내면 그 항목 삭제
 *   saveAppearance({ userId, patch: { hat: 'red' } })
 * 응답: { appearance } (저장된 전체) — 에러: INVALID_INPUT(객체 아님), TOO_LARGE(2KB 초과)
 */
export async function saveAppearance({ userId, patch }) {
  if (USE_SERVER) return server.saveAppearance({ patch })
  await wait()
  requireUser(userId)
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new ApiError('INVALID_INPUT', '꾸미기 값을 확인해 주세요.')
  const db = readDb()
  const merged = { ...db.appearances?.[userId], ...patch }
  const next = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== null && value !== undefined))
  if (new TextEncoder().encode(JSON.stringify(next)).length > 2048) throw new ApiError('TOO_LARGE', '꾸미기 정보가 너무 커요.')
  db.appearances = { ...db.appearances, [userId]: next }
  writeDb(db)
  return { appearance: next }
}

// [지민] 커플 타로 결과 기록 (타로 화면·AI: 병관) — "지난번 카드와 비교"용
//   서버 모드: 계정에 저장 (Supabase tarot_readings) → 다른 기기에서도 보임 / mock 모드: 이 브라우저에 저장
//   ⚠ 두 사람이 직접 쓴 답 원문은 넣지 마세요 (두 번째 사람은 계정 주인이 아님). 카드 id·해석 요약·질문 id 정도만
//   TarotReading: { id, spread, cards: string[], summary, detail: {}, createdAt }

const TAROT_ID_RE = /^[a-z0-9_]{1,40}$/
const TAROT_KEEP = 30 // 사람마다 최근 30개만 보관 (DB와 같음)

/** 응답: { readings: TarotReading[] } 최신순 (limit 기본 10, 최대 30) */
export async function listTarotReadings({ userId, limit = 10 }) {
  if (USE_SERVER) return server.listTarotReadings({ limit })
  await wait()
  requireUser(userId)
  const n = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), TAROT_KEEP)
  return { readings: (readDb().tarotReadings?.[userId] ?? []).slice(0, n) }
}

/**
 * 결과 저장
 *   saveTarotReading({ userId, spread: 'couple', cards: ['major_06', 'major_17'], summary: '…', detail: { questionIds: ['q03'] } })
 * 응답: { reading } — 에러: INVALID_INPUT(형식), TOO_LARGE(detail 4KB 초과), 서버 모드만 TOO_MANY_REQUESTS(1시간 20번)
 * 규칙: spread·카드 id는 영문 소문자·숫자·_ / 카드 1~10장 / summary 1~1000자 / detail은 객체
 */
export async function saveTarotReading({ userId, spread, cards, summary, detail }) {
  if (USE_SERVER) return server.saveTarotReading({ spread, cards, summary, detail })
  await wait()
  requireUser(userId)
  const text = typeof summary === 'string' ? summary.trim() : ''
  const extra = detail ?? {}
  if (typeof spread !== 'string' || !/^[a-z0-9_]{1,30}$/.test(spread)) throw new ApiError('INVALID_INPUT', '타로 종류(spread)를 확인해 주세요.')
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 10 || !cards.every((c) => typeof c === 'string' && TAROT_ID_RE.test(c))) {
    throw new ApiError('INVALID_INPUT', '카드는 1~10장, 영문 소문자·숫자·_ id로 보내 주세요.')
  }
  if (text.length < 1 || text.length > 1000) throw new ApiError('INVALID_INPUT', '해석 요약은 1~1000자로 보내 주세요.')
  if (typeof extra !== 'object' || Array.isArray(extra)) throw new ApiError('INVALID_INPUT', 'detail은 객체로 보내 주세요.')
  if (new TextEncoder().encode(JSON.stringify(extra)).length > 4096) throw new ApiError('TOO_LARGE', '타로 기록이 너무 커요.')
  const reading = { id: newId('tarot'), spread, cards: [...cards], summary: text, detail: extra, createdAt: new Date().toISOString() }
  const db = readDb()
  db.tarotReadings = { ...db.tarotReadings, [userId]: [reading, ...(db.tarotReadings?.[userId] ?? [])].slice(0, TAROT_KEEP) }
  writeDb(db)
  return { reading }
}

/** 기록 삭제 — 응답: { ok: true } / 에러: NOT_FOUND */
export async function deleteTarotReading({ userId, readingId }) {
  if (USE_SERVER) return server.deleteTarotReading({ readingId })
  await wait()
  requireUser(userId)
  const db = readDb()
  const list = db.tarotReadings?.[userId] ?? []
  if (!list.some((r) => r.id === readingId)) throw new ApiError('NOT_FOUND', '없는 타로 기록이에요.')
  db.tarotReadings = { ...db.tarotReadings, [userId]: list.filter((r) => r.id !== readingId) }
  writeDb(db)
  return { ok: true }
}

// [지민] 워프존 활성화 기록 (워프존 화면: 병관 bk_warpStore.js) — 미니맵 워프를 다른 기기에서도 유지
//   서버 모드: 계정에 저장 (Supabase warp_unlocks) / mock 모드: 이 브라우저에 계정별로 저장
//   "근처에 갔는지"는 화면이 판단해서 보내는 값 (이동 편의 기능이라 서버 위치 검증 없음)

export const WARP_IDS = ['warp_bk', 'warp_jm', 'warp_sg', 'warp_hj'] // DB CHECK와 같음. 늘리면 migration도 같이

/** 응답: { warps: string[] } 내가 켠 워프존 id (id 순서). 서버 모드에서 로그인 전이면 요청 없이 [] */
export async function listWarps({ userId }) {
  if (USE_SERVER) return server.listWarps()
  await wait()
  requireUser(userId)
  return { warps: [...(readDb().warpUnlocks?.[userId] ?? [])] }
}

/**
 * 워프존 켜기 — 이미 켠 것을 다시 보내도 에러 없이 같은 목록
 *   unlockWarp({ userId, warpId: 'warp_bk' })
 * 응답: { warps: string[] } — 에러: INVALID_INPUT(목록에 없는 id), 서버 모드 손님은 UNAUTHORIZED
 */
export async function unlockWarp({ userId, warpId }) {
  if (USE_SERVER) return server.unlockWarp({ warpId })
  await wait()
  requireUser(userId)
  if (!WARP_IDS.includes(warpId)) throw new ApiError('INVALID_INPUT', '워프존 id를 확인해 주세요.')
  const db = readDb()
  const warps = [...new Set([...(db.warpUnlocks?.[userId] ?? []), warpId])].sort()
  db.warpUnlocks = { ...db.warpUnlocks, [userId]: warps }
  writeDb(db)
  return { warps }
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
  // 서버 모드: POST /me/visit (저장된 토큰으로 다시 들어와도 기록). 같은 날 여러 번은 서버 집계가 한 번으로 셈
  if (USE_SERVER) return server.logVisit()
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
  // 서버 모드: 지민 서버 GET /admin/stats (DB 함수 get_admin_stats가 관리자 검사 + 집계). 방문자는 로그인 기록 기준
  if (USE_SERVER) return server.getAdminStats()
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
