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
let sessionChecks // session_ok를 부른 토큰들
let sessionOk // session_ok 응답 { data, error }
let replacedUsers // onSessionReplaced로 받은 userId들

function fakeQuery(token, table) {
  const filters = []
  const extra = {}
  const query = {
    select() { return query },
    eq(column, value) { filters.push([column, value]); return query },
    order() { return query },
    limit(n) { extra.limit = n; return query },
    delete() { extra.op = 'delete'; return query },
    update(values) { extra.op = 'update'; extra.values = values; return query },
    maybeSingle() {
      if (extra.op) calls.push({ token, table, filters, ...extra })
      return Promise.resolve({ data: (tableRows[table] ?? [])[0] ?? null, error: null })
    },
    then(resolve) {
      calls.push({ token, table, filters, ...extra })
      resolve({ data: tableRows[table] ?? [], error: null })
    },
  }
  return query
}

function fakeClient(token) {
  return {
    auth: {
      async getUser(t) {
        if (tokenUsers[t]) return { data: { user: tokenUsers[t] }, error: null }
        return t === GOOD_TOKEN ? { data: { user: USER }, error: null } : { data: { user: null }, error: { code: 'bad_jwt' } }
      },
      async signInWithPassword({ email, password }) {
        if (password !== 'right-pass') return { data: {}, error: { code: 'invalid_credentials' } }
        return { data: { user: { ...USER, email }, session: { access_token: GOOD_TOKEN, refresh_token: 'r1', expires_at: 123 } }, error: null }
      },
      async signUp({ email, options }) {
        calls.push({ signUpData: options.data })
        // 가입 코드가 틀리면 DB 트리거가 거절 → Supabase Auth는 이유 없이 이 에러만 돌려줌
        if (options.data.signup_code === 'wrong-code-00') {
          return { data: { user: null, session: null }, error: { code: 'unexpected_failure', status: 500, message: 'Database error saving new user' } }
        }
        // 이미 있는 이메일: Supabase는 에러 대신 identities가 빈 사용자를 돌려줄 때가 있음
        if (email === 'taken@example.com') return { data: { user: { ...USER, identities: [] }, session: null }, error: null }
        return { data: { user: USER, session: null }, error: null }
      },
      async refreshSession() {
        return { data: { session: null }, error: { code: 'refresh_token_not_found' } }
      },
    },
    rpc(name, args) {
      // 계정당 로그인 1곳 검사는 모든 로그인 요청마다 불려서, 다른 테스트의 calls 비교를 흐리지 않게 따로 기록
      if (name === 'session_ok') {
        sessionChecks.push(token)
        return Promise.resolve(sessionOk)
      }
      calls.push({ token, rpc: name, args })
      return Promise.resolve(rpcHandler(name, args))
    },
    from(table) {
      return fakeQuery(token, table)
    },
  }
}

// Supabase Auth REST(2단계 인증 /factors …) 가짜: 무엇을 어떤 토큰으로 불렀는지 기록
let authCalls
let authRestHandler
const supabase = {
  anon: () => fakeClient(null),
  asUser: (t) => fakeClient(t),
  authRest: async (token, method, path, body) => {
    authCalls.push({ token, method, path, body })
    return authRestHandler(method, path, body)
  },
}

// 2단계 인증 테스트용: JWT 모양 토큰(내용에 aal) + 그 토큰의 사용자(factors)
let tokenUsers
const jwt = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`
const FACTOR_ID = '33333333-3333-4333-8333-333333333333'
const TOKEN_AAL1 = jwt({ sub: USER.id, aal: 'aal1' })
const TOKEN_AAL2 = jwt({ sub: USER.id, aal: 'aal2' })
const ENROLLED = { ...USER, factors: [{ id: FACTOR_ID, factor_type: 'totp', status: 'verified' }] }

// ── 서버 띄우기 ─────────────────────────────────────────────────
let server
let base

before(async () => {
  server = createApp({
    supabase,
    allowedOrigins: ['https://aleph-capstone.vercel.app'],
    onSessionReplaced: (userId) => replacedUsers.push(userId),
  }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

beforeEach(() => {
  calls = []
  rpcHandler = () => ({ data: null, error: null })
  tableRows = {}
  sessionChecks = []
  sessionOk = { data: true, error: null }
  replacedUsers = []
  authCalls = []
  authRestHandler = () => ({ status: 500, data: null })
  tokenUsers = {}
})

async function api(method, path, { token, body, origin, ip } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (ip) headers['x-forwarded-for'] = ip // 시도 제한 테스트가 다른 테스트의 IP 한도를 쓰지 않게 (trust proxy 1)
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

  test('가입 코드는 앞뒤 공백을 빼고 메타데이터로 넘김 (맞는지는 DB 트리거가 판단)', async () => {
    const res = await api('POST', '/auth/signup', { body: { email: 'new@example.com', password: 'secret12', name: '하늘', signupCode: '  team-code-1126 ' } })
    assert.equal(res.status, 201)
    assert.deepEqual(calls[0].signUpData, { display_name: '하늘', signup_code: 'team-code-1126' })
  })

  test('가입 코드가 틀리면 400 INVALID_SIGNUP_CODE, 5번 틀리면 429 (코드 맞히기 대입 차단)', async () => {
    const body = { email: 'guess@example.com', password: 'secret12', signupCode: 'wrong-code-00' }
    for (let i = 0; i < 5; i += 1) {
      const res = await api('POST', '/auth/signup', { body, ip: '203.0.113.7' })
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'INVALID_SIGNUP_CODE')
    }
    const blocked = await api('POST', '/auth/signup', { body: { ...body, signupCode: 'team-code-1126' }, ip: '203.0.113.7' })
    assert.equal(blocked.status, 429)
    assert.equal(calls.length, 5) // 막힌 6번째는 Supabase까지 가지 않음
  })

  test('이미 가입한 이메일로 다시 가입하면 409 EMAIL_TAKEN (덮어쓴 것처럼 보이지 않게)', async () => {
    const res = await api('POST', '/auth/signup', { body: { email: 'taken@example.com', password: 'secret12', name: '또' } })
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, 'EMAIL_TAKEN')
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

  test('다시 들어올 때 접속 기록: 로그인 없이는 401, 토큰이 있으면 log_access', async () => {
    assert.equal((await api('POST', '/me/visit')).status, 401)
    const res = await api('POST', '/me/visit', { token: GOOD_TOKEN })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { counted: true })
    assert.ok(calls.some((c) => c.rpc === 'log_access' && c.token === GOOD_TOKEN))
  })

  test('만료된 refresh 토큰은 401', async () => {
    const res = await api('POST', '/auth/refresh', { body: { refreshToken: 'old' } })
    assert.equal(res.status, 401)
  })
})

describe('계정당 로그인 1곳 (새 로그인 우선)', () => {
  test('로그인하면 새 토큰으로 claim_session → 다른 기기를 끊었으면 onSessionReplaced(userId)', async () => {
    rpcHandler = (name) => ({ data: name === 'claim_session' ? { replaced: true } : null, error: null })
    const res = await api('POST', '/auth/login', { body: { email: 'a@example.com', password: 'right-pass' } })
    assert.equal(res.status, 200)
    assert.ok(calls.some((c) => c.rpc === 'claim_session' && c.token === GOOD_TOKEN))
    assert.deepEqual(replacedUsers, [USER.id])
  })

  test('처음 로그인(끊은 기기 없음)이면 onSessionReplaced를 부르지 않음', async () => {
    rpcHandler = (name) => ({ data: name === 'claim_session' ? { replaced: false } : null, error: null })
    await api('POST', '/auth/login', { body: { email: 'a@example.com', password: 'right-pass' } })
    assert.deepEqual(replacedUsers, [])
  })

  test('끊긴 기기의 토큰은 401 SESSION_REPLACED, DB 함수는 부르지 않음 (읽기·쓰기 모두)', async () => {
    sessionOk = { data: false, error: null }
    const stamp = await api('POST', '/stamps', { token: GOOD_TOKEN, body: { placeId: 'spot_jm_stairs' } })
    assert.equal(stamp.status, 401)
    assert.equal(stamp.body.error.code, 'SESSION_REPLACED')
    const list = await api('GET', '/stamps/me', { token: GOOD_TOKEN })
    assert.equal(list.body.error.code, 'SESSION_REPLACED')
    assert.equal(calls.length, 0)
    assert.deepEqual(sessionChecks, [GOOD_TOKEN, GOOD_TOKEN])
  })

  test('역할 검사보다 먼저 막음: 끊긴 관리자 토큰은 403이 아니라 401 SESSION_REPLACED', async () => {
    sessionOk = { data: false, error: null }
    const res = await api('GET', '/admin/stats', { token: GOOD_TOKEN })
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'SESSION_REPLACED')
  })

  test('세션 확인 자체가 실패하면 통과시키지 않고 500 (내부 내용은 숨김)', async () => {
    sessionOk = { data: null, error: { message: 'connection refused' } }
    const res = await api('POST', '/stamps', { token: GOOD_TOKEN, body: { placeId: 'spot_jm_stairs' } })
    assert.equal(res.status, 500)
    assert.equal(res.body.error.code, 'SERVER_ERROR')
    assert.equal(calls.length, 0)
  })

  test('DB 두 번째 겹이 던진 SESSION_REPLACED도 401로 바뀜', async () => {
    rpcHandler = () => ({ data: null, error: { message: 'SESSION_REPLACED', details: '다른 기기에서 로그인해서 이 기기는 로그아웃됐어요.' } })
    const res = await api('POST', '/stamps', { token: GOOD_TOKEN, body: { placeId: 'spot_jm_stairs' } })
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'SESSION_REPLACED')
  })

  test('로그아웃: 그 토큰으로 release_session, 끊긴 토큰·토큰 없음·DB 실패여도 항상 204', async () => {
    assert.equal((await api('POST', '/auth/logout', { token: GOOD_TOKEN })).status, 204)
    assert.deepEqual(calls, [{ token: GOOD_TOKEN, rpc: 'release_session', args: undefined }])

    sessionOk = { data: false, error: null }
    assert.equal((await api('POST', '/auth/logout', { token: GOOD_TOKEN })).status, 204)
    assert.equal((await api('POST', '/auth/logout')).status, 204)
    rpcHandler = () => ({ data: null, error: { message: 'boom' } })
    assert.equal((await api('POST', '/auth/logout', { token: GOOD_TOKEN })).status, 204)
  })
})

describe('닉네임 바꾸기', () => {
  test('토큰 없이 바꾸면 401, DB는 부르지 않음', async () => {
    const res = await api('PATCH', '/me', { body: { name: '새이름' } })
    assert.equal(res.status, 401)
    assert.equal(calls.length, 0)
  })

  test('이름만 내 토큰으로 바꾸고, 역할·가게를 같이 보내도 무시', async () => {
    tableRows = { profiles: [{ display_name: '새이름', role: 'pilgrim', shop_id: null }] }
    const res = await api('PATCH', '/me', { token: GOOD_TOKEN, body: { name: '  새이름  ', role: 'admin', shopId: 'shop_hj_snack' } })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.user, { id: USER.id, email: USER.email, name: '새이름', role: 'pilgrim', shopId: null })
    assert.deepEqual(calls[0], { token: GOOD_TOKEN, table: 'profiles', filters: [['id', USER.id]], op: 'update', values: { display_name: '새이름' } })
  })

  test('빈 이름·21자 이상·문자열 아님은 DB까지 가지 않고 400', async () => {
    for (const name of ['', '   ', 'ㄱ'.repeat(21), 123, null]) {
      const res = await api('PATCH', '/me', { token: GOOD_TOKEN, body: { name } })
      assert.equal(res.status, 400, String(name))
      assert.equal(res.body.error.code, 'INVALID_INPUT')
    }
    assert.equal(calls.length, 0)
  })

  test('한글·이모지 20자까지는 허용', async () => {
    tableRows = { profiles: [{ display_name: '가'.repeat(19) + '🎌', role: 'admin', shop_id: null }] }
    const res = await api('PATCH', '/me', { token: GOOD_TOKEN, body: { name: '가'.repeat(19) + '🎌' } })
    assert.equal(res.status, 200)
  })
})

describe('캐릭터 꾸미기', () => {
  test('토큰 없이 저장하면 401, DB는 부르지 않음', async () => {
    const res = await api('PATCH', '/me/appearance', { body: { appearance: { hat: 'red' } } })
    assert.equal(res.status, 401)
    assert.equal(calls.length, 0)
  })

  test('보낸 항목을 로그인한 사람 토큰으로 DB 함수에 그대로 넘김', async () => {
    rpcHandler = () => ({ data: { characterId: 'female', hat: 'red' }, error: null })
    const res = await api('PATCH', '/me/appearance', { token: GOOD_TOKEN, body: { appearance: { hat: 'red' } } })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { appearance: { characterId: 'female', hat: 'red' } })
    assert.deepEqual(calls[0], { token: GOOD_TOKEN, rpc: 'save_appearance', args: { p_patch: { hat: 'red' } } })
  })

  test('객체가 아니거나 너무 크면 DB까지 가지 않고 400', async () => {
    for (const appearance of ['female', ['a'], null, { big: 'x'.repeat(2100) }]) {
      const res = await api('PATCH', '/me/appearance', { token: GOOD_TOKEN, body: { appearance } })
      assert.equal(res.status, 400, JSON.stringify(appearance).slice(0, 20))
      assert.equal(res.body.error.code, 'INVALID_INPUT')
    }
    assert.equal(calls.length, 0)
  })

  test('DB가 TOO_LARGE를 던지면 400 TOO_LARGE', async () => {
    rpcHandler = () => ({ data: null, error: { message: 'TOO_LARGE', details: '꾸미기 정보가 너무 커요.' } })
    const res = await api('PATCH', '/me/appearance', { token: GOOD_TOKEN, body: { appearance: { a: 1 } } })
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'TOO_LARGE')
  })

  test('불러오기: 저장된 값, 없으면 {}', async () => {
    tableRows = { profiles: [{ appearance: { characterId: 'male' } }] }
    assert.deepEqual((await api('GET', '/me/appearance', { token: GOOD_TOKEN })).body, { appearance: { characterId: 'male' } })
    tableRows = {}
    assert.deepEqual((await api('GET', '/me/appearance', { token: GOOD_TOKEN })).body, { appearance: {} })
  })

  test('화면 주소에서 PATCH 미리 요청(CORS preflight) 허용', async () => {
    const res = await fetch(base + '/me/appearance', {
      method: 'OPTIONS',
      headers: { origin: 'https://aleph-capstone.vercel.app', 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization,content-type' },
    })
    assert.ok(res.status < 300)
    assert.match(res.headers.get('access-control-allow-methods') ?? '', /PATCH/)
  })
})

describe('워프존 활성화 기록', () => {
  test('토큰 없이 켜거나 불러오면 401, DB는 부르지 않음', async () => {
    assert.equal((await api('POST', '/me/warps', { body: { warpId: 'warp_bk' } })).status, 401)
    assert.equal((await api('GET', '/me/warps')).status, 401)
    assert.equal(calls.length, 0)
  })

  test('켜기: 로그인한 사람 토큰으로 unlock_warp를 부르고 200 { warps }', async () => {
    rpcHandler = () => ({ data: ['warp_bk', 'warp_jm'], error: null })
    const res = await api('POST', '/me/warps', { token: GOOD_TOKEN, body: { warpId: 'warp_jm' } })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { warps: ['warp_bk', 'warp_jm'] })
    assert.deepEqual(calls[0], { token: GOOD_TOKEN, rpc: 'unlock_warp', args: { p_warp_id: 'warp_jm' } })
  })

  test('형식이 틀리면 DB까지 가지 않고 400', async () => {
    for (const warpId of [undefined, null, 1, '', 'warp_', 'WARP_BK', 'warp_bk; drop', '<script>', ['warp_bk']]) {
      const res = await api('POST', '/me/warps', { token: GOOD_TOKEN, body: { warpId } })
      assert.equal(res.status, 400, String(warpId))
      assert.equal(res.body.error.code, 'INVALID_INPUT')
    }
    assert.equal(calls.length, 0)
  })

  test('형식은 맞지만 목록에 없는 id는 DB가 INVALID_INPUT → 400', async () => {
    rpcHandler = () => ({ data: null, error: { message: 'INVALID_INPUT', details: '워프존 id를 확인해 주세요.' } })
    const res = await api('POST', '/me/warps', { token: GOOD_TOKEN, body: { warpId: 'warp_xx' } })
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'INVALID_INPUT')
  })

  test('불러오기: 내 user_id 조건으로 읽고 id만 배열로', async () => {
    tableRows = { warp_unlocks: [{ warp_id: 'warp_bk' }, { warp_id: 'warp_sg' }] }
    const res = await api('GET', '/me/warps', { token: GOOD_TOKEN })
    assert.deepEqual(res.body, { warps: ['warp_bk', 'warp_sg'] })
    assert.deepEqual(calls[0], { token: GOOD_TOKEN, table: 'warp_unlocks', filters: [['user_id', USER.id]] })
  })
})

describe('커플 타로 기록', () => {
  const READING_ID = '11111111-1111-4111-8111-111111111111'
  const body = { spread: 'couple', cards: ['major_06', 'major_17'], summary: '서로의 속도를 맞춰 가는 시기예요.', detail: { questionIds: ['q03'] } }

  test('토큰 없이 저장하면 401, DB는 부르지 않음', async () => {
    const res = await api('POST', '/me/tarot-readings', { body })
    assert.equal(res.status, 401)
    assert.equal(calls.length, 0)
  })

  test('저장: 로그인한 사람 토큰으로 DB 함수에 넘기고 201 { reading }', async () => {
    const reading = { id: READING_ID, ...body, createdAt: '2026-11-24T00:00:00Z' }
    rpcHandler = () => ({ data: reading, error: null })
    const res = await api('POST', '/me/tarot-readings', { token: GOOD_TOKEN, body })
    assert.equal(res.status, 201)
    assert.deepEqual(res.body, { reading })
    assert.deepEqual(calls[0], {
      token: GOOD_TOKEN,
      rpc: 'save_tarot_reading',
      args: { p_spread: 'couple', p_cards: ['major_06', 'major_17'], p_summary: body.summary, p_detail: { questionIds: ['q03'] } },
    })
  })

  test('detail을 빼면 {}로 넘김', async () => {
    rpcHandler = () => ({ data: {}, error: null })
    await api('POST', '/me/tarot-readings', { token: GOOD_TOKEN, body: { ...body, detail: undefined } })
    assert.deepEqual(calls[0].args.p_detail, {})
  })

  test('모양이 틀리면 DB까지 가지 않고 400', async () => {
    for (const bad of [{ ...body, spread: 1 }, { ...body, cards: 'major_00' }, { ...body, cards: [1] }, { ...body, summary: null }, { ...body, detail: ['x'] }]) {
      const res = await api('POST', '/me/tarot-readings', { token: GOOD_TOKEN, body: bad })
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'INVALID_INPUT')
    }
    assert.equal(calls.length, 0)
  })

  test('DB가 TOO_MANY_REQUESTS를 던지면 429', async () => {
    rpcHandler = () => ({ data: null, error: { message: 'TOO_MANY_REQUESTS', details: '잠시 뒤에 다시 시도해 주세요.' } })
    const res = await api('POST', '/me/tarot-readings', { token: GOOD_TOKEN, body })
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'TOO_MANY_REQUESTS')
  })

  test('목록: 내 기록만, 화면 모양(createdAt)으로, limit은 1~30', async () => {
    tableRows = { tarot_readings: [{ id: READING_ID, spread: 'couple', cards: ['major_06'], summary: 's', detail: null, created_at: '2026-11-24T00:00:00Z' }] }
    const res = await api('GET', '/me/tarot-readings?limit=999', { token: GOOD_TOKEN })
    assert.deepEqual(res.body, { readings: [{ id: READING_ID, spread: 'couple', cards: ['major_06'], summary: 's', detail: {}, createdAt: '2026-11-24T00:00:00Z' }] })
    assert.deepEqual(calls[0], { token: GOOD_TOKEN, table: 'tarot_readings', filters: [['user_id', USER.id]], limit: 30 })
    await api('GET', '/me/tarot-readings', { token: GOOD_TOKEN })
    assert.equal(calls[1].limit, 10)
  })

  test('삭제: 내 기록이면 { ok: true }, 없으면 404, id가 UUID가 아니면 400', async () => {
    tableRows = { tarot_readings: [{ id: READING_ID }] }
    const ok = await api('DELETE', `/me/tarot-readings/${READING_ID}`, { token: GOOD_TOKEN })
    assert.deepEqual(ok.body, { ok: true })
    assert.deepEqual(calls[0], { token: GOOD_TOKEN, table: 'tarot_readings', filters: [['id', READING_ID], ['user_id', USER.id]], op: 'delete' })
    tableRows = {}
    assert.equal((await api('DELETE', `/me/tarot-readings/${READING_ID}`, { token: GOOD_TOKEN })).status, 404)
    assert.equal((await api('DELETE', '/me/tarot-readings/not-a-uuid', { token: GOOD_TOKEN })).status, 400)
  })
})

describe('관리자 통계', () => {
  test('토큰 없이 부르면 401, DB는 부르지 않음', async () => {
    const res = await api('GET', '/admin/stats')
    assert.equal(res.status, 401)
    assert.equal(calls.length, 0)
  })

  test('관리자 토큰으로 get_admin_stats를 부르고 결과를 그대로 돌려줌', async () => {
    tableRows = { profiles: [{ display_name: '관리자', role: 'admin', shop_id: null }] }
    const stats = { todayVisitors: 2, totalStamps: 5, couponsIssued: 1, couponsUsed: 0, dailyVisitors: [], stampsByZone: [], topPlaces: [] }
    rpcHandler = () => ({ data: stats, error: null })
    const res = await api('GET', '/admin/stats', { token: GOOD_TOKEN })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, stats)
    assert.deepEqual(calls[0], { token: GOOD_TOKEN, rpc: 'get_admin_stats', args: undefined })
  })

  test('서버 미들웨어가 막지 못한 경우에도 DB가 던진 NOT_ADMIN → 403 (두 번째 겹)', async () => {
    tableRows = { profiles: [{ display_name: '관리자', role: 'admin', shop_id: null }] }
    rpcHandler = () => ({ data: null, error: { message: 'NOT_ADMIN', details: '관리자 계정만 볼 수 있어요.' } })
    const res = await api('GET', '/admin/stats', { token: GOOD_TOKEN })
    assert.equal(res.status, 403)
    assert.deepEqual(res.body, { error: { code: 'NOT_ADMIN', message: '관리자 계정만 볼 수 있어요.' } })
  })
})

describe('역할 검사 미들웨어 (requireRole)', () => {
  const cases = [
    ['GET', '/admin/stats', 'admin', 'NOT_ADMIN'],
    ['GET', '/shop/stats', 'owner', 'NOT_OWNER'],
    ['PUT', '/shop/promo', 'owner', 'NOT_OWNER'],
  ]
  for (const [method, path, role, code] of cases) {
    test(`${method} ${path}: ${role}가 아니면 DB 함수까지 가지 않고 403 ${code}`, async () => {
      for (const profile of [{ role: 'pilgrim' }, { role: role === 'admin' ? 'owner' : 'admin' }, null]) {
        calls = []
        tableRows = profile ? { profiles: [{ display_name: 'x', shop_id: null, ...profile }] } : {}
        const res = await api(method, path, { token: GOOD_TOKEN, body: method === 'GET' ? undefined : { text: '오늘의 메뉴' } })
        assert.equal(res.status, 403, `${profile?.role ?? '프로필 없음'}`)
        assert.equal(res.body.error.code, code)
        assert.equal(calls.filter((c) => c.rpc).length, 0, 'rpc를 부르면 안 됨')
      }
    })
  }

  test('사장님이면 통과해서 get_shop_stats를 부름', async () => {
    tableRows = { profiles: [{ display_name: '분식', role: 'owner', shop_id: 'shop_hj_snack' }] }
    rpcHandler = () => ({ data: { issued: 0 }, error: null })
    const res = await api('GET', '/shop/stats', { token: GOOD_TOKEN })
    assert.equal(res.status, 200)
    assert.equal(calls[0].rpc, 'get_shop_stats')
  })
})

describe('관리자 2단계 인증 (TOTP, 등록한 관리자만)', () => {
  const ADMIN_ROW = { profiles: [{ display_name: '관리자', role: 'admin', shop_id: null }] }
  const verifyOk = (method, path) => {
    if (path.endsWith('/challenge')) return { status: 200, data: { id: 'ch-1' } }
    if (path.endsWith('/verify')) return { status: 200, data: { access_token: TOKEN_AAL2, refresh_token: 'r2', expires_in: 3600 } }
    return { status: 500, data: null }
  }

  test('로그인 응답에 mfa: 등록 안 했으면 required=false, 등록했으면 비밀번호만으로는 required=true', async () => {
    let res = await api('POST', '/auth/login', { body: { email: 'a@example.com', password: 'right-pass' } })
    assert.deepEqual(res.body.mfa, { enrolled: false, ok: false, required: false })
    tokenUsers[TOKEN_AAL1] = ENROLLED
    res = await api('GET', '/me', { token: TOKEN_AAL1 })
    assert.deepEqual(res.body.mfa, { enrolled: true, ok: false, required: true })
  })

  test('등록한 관리자가 코드 없이(aal1) 관리자 통계 → 403 MFA_REQUIRED, DB 함수는 부르지 않음', async () => {
    tokenUsers[TOKEN_AAL1] = ENROLLED
    tableRows = ADMIN_ROW
    const res = await api('GET', '/admin/stats', { token: TOKEN_AAL1 })
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'MFA_REQUIRED')
    assert.equal(calls.filter((c) => c.rpc).length, 0)
  })

  test('코드를 넣은(aal2) 등록 관리자, 등록 안 한 관리자는 관리자 통계 통과', async () => {
    tokenUsers[TOKEN_AAL2] = ENROLLED
    tableRows = ADMIN_ROW
    rpcHandler = () => ({ data: { ok: 1 }, error: null })
    assert.equal((await api('GET', '/admin/stats', { token: TOKEN_AAL2 })).status, 200)
    assert.equal((await api('GET', '/admin/stats', { token: GOOD_TOKEN })).status, 200)
  })

  test('로그인 2단계: 형식이 틀리면 400(인증 서버 안 부름), 등록 안 한 계정은 400 MFA_NOT_ENROLLED', async () => {
    tokenUsers[TOKEN_AAL1] = ENROLLED
    let res = await api('POST', '/auth/mfa/verify', { token: TOKEN_AAL1, body: { code: '12ab' } })
    assert.equal(res.status, 400)
    assert.equal(authCalls.length, 0)
    res = await api('POST', '/auth/mfa/verify', { token: GOOD_TOKEN, body: { code: '123456' } })
    assert.equal(res.body.error.code, 'MFA_NOT_ENROLLED')
  })

  test('로그인 2단계: 틀린 코드 → 401 MFA_INVALID_CODE', async () => {
    tokenUsers[TOKEN_AAL1] = ENROLLED
    authRestHandler = (method, path) => (path.endsWith('/verify') ? { status: 422, data: { error_code: 'mfa_verification_failed' } } : verifyOk(method, path))
    const res = await api('POST', '/auth/mfa/verify', { token: TOKEN_AAL1, body: { code: '000000' } })
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'MFA_INVALID_CODE')
  })

  test('로그인 2단계: 맞는 코드 → 서버가 찾은 factor로 challenge·verify, aal2 세션 + 새 토큰으로 claim_session(다른 연결은 안 끊음)', async () => {
    tokenUsers[TOKEN_AAL1] = ENROLLED
    authRestHandler = verifyOk
    const res = await api('POST', '/auth/mfa/verify', { token: TOKEN_AAL1, body: { code: '123456', factorId: 'someone-elses' } })
    assert.equal(res.status, 200)
    assert.equal(res.body.session.accessToken, TOKEN_AAL2)
    assert.ok(res.body.session.expiresAt > Date.now() / 1000)
    assert.deepEqual(authCalls.map((c) => [c.method, c.path, c.token]), [
      ['POST', `/factors/${FACTOR_ID}/challenge`, TOKEN_AAL1],
      ['POST', `/factors/${FACTOR_ID}/verify`, TOKEN_AAL1],
    ])
    assert.deepEqual(authCalls[1].body, { challenge_id: 'ch-1', code: '123456' })
    assert.ok(calls.some((c) => c.rpc === 'claim_session' && c.token === TOKEN_AAL2))
    assert.deepEqual(replacedUsers, [])
  })

  test('등록 시작: 순례객은 403, 관리자는 하다 만 factor를 지우고 QR(data URI)·factorId를 받음', async () => {
    assert.equal((await api('POST', '/auth/mfa/enroll', { token: GOOD_TOKEN })).status, 403)
    tableRows = ADMIN_ROW
    tokenUsers[TOKEN_AAL1] = { ...USER, factors: [{ id: 'old-unverified', factor_type: 'totp', status: 'unverified' }] }
    authRestHandler = (method, path) =>
      method === 'POST' && path === '/factors'
        ? { status: 200, data: { id: FACTOR_ID, type: 'totp', totp: { qr_code: '<svg>#</svg>', secret: 'ABC', uri: 'otpauth://x' } } }
        : { status: 200, data: {} }
    const res = await api('POST', '/auth/mfa/enroll', { token: TOKEN_AAL1 })
    assert.equal(res.status, 201)
    assert.deepEqual(res.body, { factorId: FACTOR_ID, qrCode: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%23%3C%2Fsvg%3E', secret: 'ABC' })
    assert.deepEqual(authCalls[0], { token: TOKEN_AAL1, method: 'DELETE', path: '/factors/old-unverified', body: undefined })
    assert.equal(authCalls[1].body.factor_type, 'totp')
  })

  test('등록 시작: 이미 등록했으면(aal2) 409, aal1이면 먼저 코드부터(403 MFA_REQUIRED)', async () => {
    tableRows = ADMIN_ROW
    tokenUsers[TOKEN_AAL2] = ENROLLED
    tokenUsers[TOKEN_AAL1] = ENROLLED
    assert.equal((await api('POST', '/auth/mfa/enroll', { token: TOKEN_AAL2 })).body.error.code, 'MFA_ALREADY_ENROLLED')
    assert.equal((await api('POST', '/auth/mfa/enroll', { token: TOKEN_AAL1 })).body.error.code, 'MFA_REQUIRED')
  })

  test('등록 마무리: 내 것이 아닌(또는 이미 검증된) factorId는 400, 내 미검증 factor면 aal2 세션', async () => {
    tableRows = ADMIN_ROW
    tokenUsers[TOKEN_AAL1] = { ...USER, factors: [{ id: FACTOR_ID, factor_type: 'totp', status: 'unverified' }] }
    const other = '44444444-4444-4444-8444-444444444444'
    assert.equal((await api('POST', '/auth/mfa/enroll/verify', { token: TOKEN_AAL1, body: { factorId: other, code: '123456' } })).status, 400)
    authRestHandler = verifyOk
    const res = await api('POST', '/auth/mfa/enroll/verify', { token: TOKEN_AAL1, body: { factorId: FACTOR_ID, code: '123456' } })
    assert.equal(res.status, 200)
    assert.equal(res.body.session.accessToken, TOKEN_AAL2)
  })

  test('코드를 15분에 5번 틀리면 6번째는 인증 서버를 부르지 않고 429', async () => {
    tokenUsers[TOKEN_AAL1] = ENROLLED
    authRestHandler = (method, path) => (path.endsWith('/verify') ? { status: 422, data: {} } : verifyOk(method, path))
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await api('POST', '/auth/mfa/verify', { token: TOKEN_AAL1, body: { code: '000000' } })).status, 401)
    }
    authCalls = []
    const res = await api('POST', '/auth/mfa/verify', { token: TOKEN_AAL1, body: { code: '123456' } })
    assert.equal(res.status, 429)
    assert.equal(authCalls.length, 0)
  })

  test('인증 서버 오류는 내부 내용(비밀·QR)을 숨기고 500', async () => {
    tableRows = ADMIN_ROW
    authRestHandler = () => ({ status: 503, data: { msg: 'secret stuff' } })
    const res = await api('POST', '/auth/mfa/enroll', { token: GOOD_TOKEN })
    assert.equal(res.status, 500)
    assert.equal(res.body.error.code, 'SERVER_ERROR')
  })
})

describe('보안 헤더', () => {
  test('모든 응답에 HSTS · nosniff · DENY · no-referrer, x-powered-by 없음', async () => {
    for (const path of ['/health', '/no-such-path']) {
      const res = await api('GET', path)
      assert.equal(res.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains')
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
      assert.equal(res.headers.get('x-frame-options'), 'DENY')
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
      assert.equal(res.headers.get('x-powered-by'), null)
    }
  })
})

describe('기타', () => {
  test('예상 못 한 DB 에러는 내부 내용을 숨기고 500', async () => {
    tableRows = { profiles: [{ display_name: '분식', role: 'owner', shop_id: 'shop_hj_snack' }] }
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
