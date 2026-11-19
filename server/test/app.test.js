// 서버 라우트 테스트 — 실제 Supabase를 부르지 않고 가짜 클라이언트로 확인한다
// 실행: npm test (server/ 폴더)
//
// 확인하는 것
//   - 토큰이 없거나 가짜면 401
//   - 로그인한 사람의 토큰이 그대로 DB 호출에 실린다 (서버가 권한을 대신 갖지 않음)
//   - DB 함수 에러 코드(ALREADY_STAMPED 등)가 HTTP 상태 + { error: { code, message } }로 바뀐다
//   - 예상 못 한 DB 에러는 내부 내용을 숨긴다
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { createApp } from '../src/app.js'

const USER = { id: '00000000-0000-0000-0000-00000000000a', email: 'a@example.com' }
const GOOD_TOKEN = 'good-token'

// ── 가짜 Supabase ────────────────────────────────────────────────
// calls: 서버가 어떤 토큰으로 무엇을 불렀는지 기록
let calls
let rpcHandler
let tableRows

function fakeQuery(token, table) {
  const filters = []
  const query = {
    select() { return query },
    eq(column, value) { filters.push([column, value]); return query },
    order() { return query },
    maybeSingle() {
      return Promise.resolve({ data: (tableRows[table] ?? [])[0] ?? null, error: null })
    },
    then(resolve) {
      calls.push({ token, table, filters })
      resolve({ data: tableRows[table] ?? [], error: null })
    },
  }
  return query
}

function fakeClient(token) {
  return {
    auth: {
      async getUser(t) {
        return t === GOOD_TOKEN ? { data: { user: USER }, error: null } : { data: { user: null }, error: { code: 'bad_jwt' } }
      },
      async signInWithPassword({ email, password }) {
        if (password !== 'right-pass') return { data: {}, error: { code: 'invalid_credentials' } }
        return { data: { user: { ...USER, email }, session: { access_token: GOOD_TOKEN, refresh_token: 'r1', expires_at: 123 } }, error: null }
      },
      async signUp({ options }) {
        calls.push({ signUpData: options.data })
        return { data: { user: USER, session: null }, error: null }
      },
      async refreshSession() {
        return { data: { session: null }, error: { code: 'refresh_token_not_found' } }
      },
    },
    rpc(name, args) {
      calls.push({ token, rpc: name, args })
      return Promise.resolve(rpcHandler(name, args))
    },
    from(table) {
      return fakeQuery(token, table)
    },
  }
}

const supabase = { anon: () => fakeClient(null), asUser: (t) => fakeClient(t) }

// ── 서버 띄우기 ─────────────────────────────────────────────────
let server
let base

before(async () => {
  server = createApp({ supabase, allowedOrigins: ['https://aleph-capstone.vercel.app'] }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

beforeEach(() => {
  calls = []
  rpcHandler = () => ({ data: null, error: null })
  tableRows = {}
})

async function api(method, path, { token, body, origin } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (origin) headers.origin = origin
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null }
}

// ── 테스트 ──────────────────────────────────────────────────────
describe('로그인 확인', () => {
  test('토큰 없이 스탬프를 찍으면 401', async () => {
    const res = await api('POST', '/stamps', { body: { placeId: 'spot_jm_stairs' } })
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'UNAUTHORIZED')
    assert.equal(calls.length, 0)
  })

  test('가짜 토큰이면 401, DB는 부르지 않음', async () => {
    const res = await api('POST', '/stamps', { token: 'forged', body: { placeId: 'spot_jm_stairs' } })
    assert.equal(res.status, 401)
    assert.equal(calls.length, 0)
  })
})

describe('스탬프', () => {
  test('로그인한 사람의 토큰으로 collect_stamp를 부르고 결과를 그대로 돌려줌', async () => {
    const result = { stamp: { id: 's1', placeId: 'spot_jm_stairs', createdAt: 't' }, issuedCoupons: [] }
    rpcHandler = () => ({ data: result, error: null })
    const res = await api('POST', '/stamps', { token: GOOD_TOKEN, body: { placeId: 'spot_jm_stairs' } })
    assert.equal(res.status, 201)
    assert.deepEqual(res.body, result)
    assert.deepEqual(calls, [{ token: GOOD_TOKEN, rpc: 'collect_stamp', args: { p_place_id: 'spot_jm_stairs' } }])
  })

  test('중복 획득은 409 ALREADY_STAMPED + DB 안내 문구', async () => {
    rpcHandler = () => ({ data: null, error: { message: 'ALREADY_STAMPED', details: '이미 받은 스탬프예요.' } })
    const res = await api('POST', '/stamps', { token: GOOD_TOKEN, body: { placeId: 'spot_jm_stairs' } })
    assert.equal(res.status, 409)
    assert.deepEqual(res.body, { error: { code: 'ALREADY_STAMPED', message: '이미 받은 스탬프예요.' } })
  })

  test('placeId가 없으면 400, DB는 부르지 않음', async () => {
    const res = await api('POST', '/stamps', { token: GOOD_TOKEN, body: {} })
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'INVALID_INPUT')
    assert.equal(calls.filter((c) => c.rpc).length, 0)
  })

  test('내 스탬프 목록은 내 user_id로 거르고 client.js 모양으로 바꿈', async () => {
    tableRows.stamps = [{ id: 's1', place_id: 'spot_jm_stairs', created_at: 't' }]
    const res = await api('GET', '/stamps/me', { token: GOOD_TOKEN })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { stamps: [{ id: 's1', placeId: 'spot_jm_stairs', createdAt: 't' }] })
    assert.deepEqual(calls[0].filters, [['user_id', USER.id]])
  })
})

describe('쿠폰', () => {
  test('내 쿠폰함은 가게 이름을 붙여 client.js 모양으로', async () => {
    tableRows.coupons = [{
      id: 'c1', code: 'ABCDEF', user_id: USER.id, shop_id: 'cafe_soran', places: { name: '소란 카페' },
      title: 't', discount: 'GIFT', reason: 'r', valid_until: '2026-12-19', issued_at: 'i', used_at: null, used_by: null,
    }]
    const res = await api('GET', '/coupons/me', { token: GOOD_TOKEN })
    assert.equal(res.body.coupons[0].shopName, '소란 카페')
    assert.equal(res.body.coupons[0].validUntil, '2026-12-19')
    assert.deepEqual(calls[0].filters, [['user_id', USER.id]])
  })

  test('다른 가게 쿠폰은 403 WRONG_SHOP', async () => {
    rpcHandler = () => ({ data: null, error: { message: 'WRONG_SHOP', details: '우리 가게 쿠폰이 아니에요.' } })
    const res = await api('POST', '/coupons/redeem', { token: GOOD_TOKEN, body: { code: 'ABCDEF' } })
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'WRONG_SHOP')
  })

  test('멱등성 키를 보내면 그대로 DB에 넘김', async () => {
    const key = '11111111-2222-4333-8444-555555555555'
    rpcHandler = () => ({ data: { coupon: {}, replayed: false }, error: null })
    await api('POST', '/coupons/redeem', { token: GOOD_TOKEN, body: { code: 'abcdef', idempotencyKey: key } })
    assert.deepEqual(calls[0].args, { p_code: 'abcdef', p_idempotency_key: key })
  })

  test('멱등성 키가 UUID가 아니면 400', async () => {
    const res = await api('POST', '/coupons/redeem', { token: GOOD_TOKEN, body: { code: 'ABCDEF', idempotencyKey: '1; drop table' } })
    assert.equal(res.status, 400)
  })
})

describe('회원가입 · 로그인', () => {
  test('가입 요청에 role을 넣어도 DB로 넘기지 않음 (권한 상승 차단)', async () => {
    const res = await api('POST', '/auth/signup', { body: { email: 'new@example.com', password: 'secret12', name: '하늘', role: 'admin' } })
    assert.equal(res.status, 201)
    assert.deepEqual(res.body, { needsEmailConfirm: true })
    assert.deepEqual(calls[0].signUpData, { display_name: '하늘' })
  })

  test('비밀번호가 틀리면 401 INVALID_LOGIN', async () => {
    const res = await api('POST', '/auth/login', { body: { email: 'a@example.com', password: 'wrong' } })
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'INVALID_LOGIN')
  })

  test('로그인 성공 시 접속 기록(log_access)을 남기고 토큰·역할을 돌려줌', async () => {
    tableRows.profiles = [{ display_name: '분식 사장님', role: 'owner', shop_id: 'shop_hj_snack' }]
    const res = await api('POST', '/auth/login', { body: { email: 'a@example.com', password: 'right-pass' } })
    assert.equal(res.status, 200)
    assert.equal(res.body.session.accessToken, GOOD_TOKEN)
    assert.deepEqual(res.body.user, { id: USER.id, email: 'a@example.com', name: '분식 사장님', role: 'owner', shopId: 'shop_hj_snack' })
    assert.ok(calls.some((c) => c.rpc === 'log_access' && c.token === GOOD_TOKEN))
  })

  test('만료된 refresh 토큰은 401', async () => {
    const res = await api('POST', '/auth/refresh', { body: { refreshToken: 'old' } })
    assert.equal(res.status, 401)
  })
})

describe('기타', () => {
  test('예상 못 한 DB 에러는 내부 내용을 숨기고 500', async () => {
    rpcHandler = () => ({ data: null, error: { message: 'relation "public.secret" does not exist' } })
    const original = console.error
    console.error = () => {}
    try {
      const res = await api('GET', '/shop/stats', { token: GOOD_TOKEN })
      assert.equal(res.status, 500)
      assert.deepEqual(res.body, { error: { code: 'SERVER_ERROR', message: '잠시 뒤에 다시 시도해 주세요.' } })
    } finally {
      console.error = original
    }
  })

  test('등록된 화면 주소만 CORS 허용', async () => {
    const ok = await api('GET', '/health', { origin: 'https://aleph-capstone.vercel.app' })
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://aleph-capstone.vercel.app')
    const bad = await api('GET', '/health', { origin: 'https://evil.example' })
    assert.equal(bad.headers.get('access-control-allow-origin'), null)
  })

  test('JSON이 깨지면 400', async () => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })
    assert.equal(res.status, 400)
  })

  test('없는 주소는 404', async () => {
    const res = await api('GET', '/nope')
    assert.equal(res.status, 404)
  })
})
