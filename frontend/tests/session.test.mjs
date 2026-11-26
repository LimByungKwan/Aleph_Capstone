// [지민] 계정당 로그인 1곳 — 화면 쪽 처리 검증. 실행: frontend/ 에서  VITE_API_URL= node --test tests/
//   서버가 SESSION_REPLACED를 돌려주면: refresh로 다시 시도하지 않고 바로 로그아웃 + 이유를 로그인 창으로
//   (fetch를 가짜로 바꿔서 서버 없이 확인)
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let server, session
const stored = new Map()
globalThis.window = { localStorage: { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) } }
const STORAGE_KEY = 'scenewalk-session-v1'

let requests, respond
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url, method: init.method ?? 'GET' })
  const { status = 200, body } = await respond(url, init)
  return { ok: status < 400, status, json: async () => body }
}

const saveSession = (accessToken) =>
  stored.set(STORAGE_KEY, JSON.stringify({ session: { accessToken, refreshToken: 'r' }, user: { id: 'u1' } }))

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  session = await server.ssrLoadModule('/src/api/session.js')
})
after(async () => { await server?.close() })
beforeEach(() => {
  requests = []
  stored.clear()
  respond = () => ({ body: {} })
  saveSession('old-tok')
  session.useSessionStore.setState({ session: { accessToken: 'old-tok', refreshToken: 'r' }, user: { id: 'u1' }, loginPrompt: null })
})

const replaced = () => ({ status: 401, body: { error: { code: 'SESSION_REPLACED', message: '다른 기기에서 로그인해서 이 기기는 로그아웃됐어요.' } } })

test('SESSION_REPLACED → refresh 없이 로그아웃 + "다른 기기에서 로그인" 안내 창', async () => {
  respond = replaced
  await assert.rejects(session.authRequest('/stamps/me'), (e) => e.code === 'SESSION_REPLACED')
  assert.equal(requests.length, 1)
  assert.ok(!requests.some((r) => r.url.endsWith('/auth/refresh')), 'refresh를 부르면 안 됨 (session_id가 같아서 소용없음)')
  const state = session.useSessionStore.getState()
  assert.equal(state.session, null)
  assert.equal(state.user, null)
  assert.deepEqual(state.loginPrompt, session.SESSION_REPLACED_PROMPT)
  assert.equal(stored.get(STORAGE_KEY), undefined)
})

test('같은 브라우저의 다른 탭이 새로 로그인해 저장한 값은 지우지 않음', async () => {
  saveSession('new-tok-from-other-tab')
  respond = replaced
  await assert.rejects(session.authRequest('/stamps/me'))
  assert.equal(session.useSessionStore.getState().session, null)
  assert.equal(JSON.parse(stored.get(STORAGE_KEY)).session.accessToken, 'new-tok-from-other-tab')
})

test('그냥 만료(UNAUTHORIZED)는 예전처럼 refresh 후 한 번 더 시도', async () => {
  let n = 0
  respond = (url) => {
    if (url.endsWith('/auth/refresh')) return { body: { session: { accessToken: 'fresh', refreshToken: 'r2' } } }
    n += 1
    return n === 1 ? { status: 401, body: { error: { code: 'UNAUTHORIZED', message: '' } } } : { body: { ok: true } }
  }
  assert.deepEqual(await session.authRequest('/stamps/me'), { ok: true })
  assert.ok(requests.some((r) => r.url.endsWith('/auth/refresh')))
  assert.equal(session.useSessionStore.getState().session.accessToken, 'fresh')
  assert.equal(session.useSessionStore.getState().loginPrompt, null)
})

// ── 관리자 2단계 인증 (TOTP) ──
test('로그인 응답 mfa.required면 6자리 코드 창(mfaPrompt)이 뜨고, 아니면 안 뜸', async () => {
  session.useSessionStore.setState({ session: null, user: null, mfa: null, mfaPrompt: null })
  respond = () => ({ body: { session: { accessToken: 'a1', refreshToken: 'r' }, user: { id: 'u1', role: 'admin' }, mfa: { enrolled: true, ok: false, required: true } } })
  await session.login({ email: 'x@example.com', password: 'p' })
  assert.ok(session.useSessionStore.getState().mfaPrompt)
  respond = () => ({ body: { session: { accessToken: 'a2', refreshToken: 'r' }, user: { id: 'u2', role: 'pilgrim' }, mfa: { enrolled: false, ok: false, required: false } } })
  await session.login({ email: 'y@example.com', password: 'p' })
  assert.equal(session.useSessionStore.getState().mfaPrompt, null)
})

test('관리자 기능이 MFA_REQUIRED를 돌려주면 코드 창이 뜨고 로그아웃은 안 됨', async () => {
  respond = () => ({ status: 403, body: { error: { code: 'MFA_REQUIRED', message: '' } } })
  await assert.rejects(session.authRequest('/admin/stats'), (e) => e.code === 'MFA_REQUIRED')
  const state = session.useSessionStore.getState()
  assert.ok(state.mfaPrompt)
  assert.equal(state.session.accessToken, 'old-tok')
})

test('코드 확인 성공 → aal2 토큰으로 바꿔 끼우고 창 닫힘, mfa.ok', async () => {
  session.useSessionStore.setState({ mfaPrompt: { reason: '' } })
  respond = (url) => (url.endsWith('/auth/mfa/verify') ? { body: { session: { accessToken: 'aal2-tok', refreshToken: 'r2' } } } : { body: {} })
  await session.verifyMfa('123456')
  const state = session.useSessionStore.getState()
  assert.equal(state.session.accessToken, 'aal2-tok')
  assert.equal(state.mfaPrompt, null)
  assert.equal(state.mfa.ok, true)
  assert.equal(JSON.parse(stored.get(STORAGE_KEY)).session.accessToken, 'aal2-tok')
})

test('로그인 화면 컴포넌트가 문법 오류 없이 불러와짐 (2단계 인증 창 포함)', async () => {
  const ui = await server.ssrLoadModule('/src/components/auth/LoginPage.jsx')
  assert.equal(typeof ui.LoginModal, 'function')
  assert.equal(typeof ui.AccountBox, 'function')
})
