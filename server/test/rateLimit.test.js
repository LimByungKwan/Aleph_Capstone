// 로그인 시도 제한 테스트 — 가짜 Supabase, 작은 한도(IP 6번 / 이메일 실패 3번)로 확인
// 실행: npm test (server/ 폴더)
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createApp } from '../src/app.js'
import { createLimiter } from '../src/rateLimit.js'

const GOOD = 'good-token'
let authCalls = 0

function fakeClient() {
  return {
    auth: {
      async signInWithPassword({ email, password }) {
        authCalls += 1
        if (password !== 'right-pass') return { data: {}, error: { code: 'invalid_credentials' } }
        return { data: { user: { id: 'u1', email }, session: { access_token: GOOD, refresh_token: 'r', expires_at: 1 } }, error: null }
      },
      async signUp() {
        authCalls += 1
        return { data: { user: { id: 'u1' }, session: null }, error: null }
      },
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: () => ({ select() { return this }, eq() { return this }, maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
  }
}

let server
let base
before(async () => {
  const app = createApp({
    supabase: { anon: fakeClient, asUser: fakeClient },
    limits: { authPerIp: { windowMs: 60_000, max: 6 }, loginFailPerEmail: { windowMs: 60_000, max: 3 } },
  })
  server = app.listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

async function login(email, password, ip = '203.0.113.1') {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
  })
  return { status: res.status, retryAfter: res.headers.get('retry-after'), body: await res.json() }
}

describe('로그인 시도 제한', () => {
  test('같은 이메일 비밀번호 3번 틀리면 4번째는 Supabase를 부르지 않고 429', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await login('victim@example.com', 'wrong', '203.0.113.10')).status, 401)
    const before = authCalls
    const res = await login('victim@example.com', 'right-pass', '203.0.113.11') // IP를 바꿔도 이메일 기준으로 막힘
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'TOO_MANY_REQUESTS')
    assert.ok(Number(res.retryAfter) > 0, 'Retry-After 헤더')
    assert.equal(authCalls, before, '막힌 요청은 Supabase까지 가지 않음')
  })

  test('대소문자만 바꾼 이메일도 같은 사람으로 셈', async () => {
    const res = await login('VICTIM@example.com', 'right-pass', '203.0.113.12')
    assert.equal(res.status, 429)
  })

  test('성공하면 그 이메일 실패 횟수 초기화', async () => {
    assert.equal((await login('ok@example.com', 'wrong', '203.0.113.20')).status, 401)
    assert.equal((await login('ok@example.com', 'wrong', '203.0.113.20')).status, 401)
    assert.equal((await login('ok@example.com', 'right-pass', '203.0.113.20')).status, 200)
    for (let i = 0; i < 2; i++) assert.equal((await login('ok@example.com', 'wrong', '203.0.113.20')).status, 401)
    assert.equal((await login('ok@example.com', 'right-pass', '203.0.113.20')).status, 200, '초기화 덕분에 아직 안 막힘')
  })

  test('한 IP에서 여러 이메일을 돌려 시도해도 6번 넘으면 429 (계정 돌려가며 찍기 차단)', async () => {
    const ip = '198.51.100.7'
    for (let i = 0; i < 6; i++) assert.equal((await login(`spray${i}@example.com`, 'wrong', ip)).status, 401)
    assert.equal((await login('spray99@example.com', 'wrong', ip)).status, 429)
    assert.equal((await login('spray99@example.com', 'wrong', '198.51.100.8')).status, 401, '다른 IP의 사용자는 영향 없음')
  })
})

describe('createLimiter', () => {
  test('창(window)이 지나면 다시 허용', () => {
    let t = 0
    const lim = createLimiter({ windowMs: 1000, max: 2, now: () => t })
    lim.hit('k'); lim.hit('k')
    assert.equal(lim.check('k').limited, true)
    assert.equal(lim.check('k').retryAfter, 1)
    t = 1000
    assert.equal(lim.check('k').limited, false)
  })
})
