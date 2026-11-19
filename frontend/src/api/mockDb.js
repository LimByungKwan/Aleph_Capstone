import places from '@shared/places.json'

// [3. 개발 > DB구축(임시)] 브라우저 localStorage에 저장하는 가짜 DB
// 지민님 Supabase가 붙기 전까지 화면 개발·시연용으로만 써요.
// 실제 DB로 바뀌어도 client.js의 함수 이름·응답 모양은 그대로 유지돼요.

const STORAGE_KEY = 'scenewalk-mock-db-v3' // 저장 모양이 바뀌면 숫자를 올려서 새로 시작

// 시연용 계정 (로그인은 지민님 담당 — 지금은 순례객·사장님 역할만 흉내)
// 관리자 화면은 성근님 담당이라 여기엔 없어요.
export const MOCK_USERS = [
  { id: 'u_pilgrim', name: '순례객 하늘', role: 'pilgrim' },
  { id: 'u_owner_snack', name: '정류장 분식 사장님', role: 'owner', shopId: 'shop_hj_snack' },
]

// 가게별 쿠폰 혜택 (가상 가게, places.json의 가게 id 기준). discount = 티켓 왼쪽에 크게 보이는 짧은 표기
export const SHOP_OFFERS = {
  shop_hj_snack: { title: '정류장 분식 떡볶이 사이즈 업 쿠폰', discount: 'SIZE UP', perk: '떡볶이 사이즈 업', menu: '비 오는 날 떡볶이', validDays: 30 },
}

// 쿠폰함이 처음부터 비어 보이지 않게 넣는 샘플 쿠폰 (가상 가게 — places.json에 없는 가게라 사용 처리는 안 됨)
function seedCoupons() {
  const base = { userId: 'u_pilgrim', reason: '오픈 기념 샘플 쿠폰', sample: true }
  return [
    { ...base, id: 'cp_sample1', code: 'GRMS11', shopId: 'sample_cloudforest', shopName: '구름숲 다방', title: '구름숲 다방 시그니처 블렌드 1+1 쿠폰', discount: '1+1 FREE', validUntil: '2026-11-30', issuedAt: '2026-11-10T10:00:00.000Z', usedAt: null },
    { ...base, id: 'cp_sample2', code: 'ANMN50', shopId: 'sample_anemone', shopName: '아네모네 사진관', title: '스튜디오 아네모네 필름 인화 50% 할인권', discount: '50% OFF', validUntil: '2026-12-15', issuedAt: '2026-11-12T10:00:00.000Z', usedAt: null },
    { ...base, id: 'cp_sample3', code: 'BNGP77', shopId: 'sample_bungeoppang', shopName: '추억의 붕어빵', title: '골목길 붕어빵 따끈한 간식 세트 교환권', discount: 'FREE SET', validUntil: '2026-10-31', issuedAt: '2026-10-20T10:00:00.000Z', usedAt: '2026-10-25T15:20:00.000Z' },
  ]
}

function emptyDb() {
  return {
    stamps: [], // { id, userId, placeId, createdAt }
    coupons: seedCoupons(), // { id, code, userId, shopId, shopName, title, discount, validUntil, issuedAt, usedAt, usedBy }
    promos: [], // { id, shopId, createdAt, input, result }
    shopPromos: {}, // { [shopId]: { text, tag, savedAt } } — 사장님이 "대표 문구"로 등록한 홍보문구
    playerCharacters: {}, // { [userId]: 'male' | 'female' }
  }
}

export function dayKey(time = Date.now()) {
  const d = new Date(time)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// localStorage를 못 쓰는 환경(사생활 보호 모드 등)이면 메모리에만 저장
let memoryDb = null

export function readDb() {
  if (memoryDb) return memoryDb
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    memoryDb = raw ? { ...emptyDb(), ...JSON.parse(raw) } : emptyDb()
  } catch (error) {
    console.warn('[mockDb] 저장소를 읽지 못해 새로 시작합니다.', error)
    memoryDb = emptyDb()
  }
  return memoryDb
}

export function writeDb(db) {
  memoryDb = db
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (error) {
    console.warn('[mockDb] 저장소에 쓰지 못했습니다. 새로고침하면 사라져요.', error)
  }
}

export function resetDb() {
  memoryDb = emptyDb()
  writeDb(memoryDb)
}

export function findPlace(placeId) {
  return places.find((p) => p.id === placeId) ?? null
}

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// 사람이 불러 주기 쉬운 쿠폰 코드 (헷갈리는 0/O, 1/I 제외)
export function newCouponCode(existing) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (;;) {
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    if (!existing.has(code)) return code
  }
}
