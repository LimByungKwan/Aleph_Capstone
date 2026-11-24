// [지민] 워프존 활성화 기록 검증 — 실행: frontend/ 에서  node --test tests/
//   mock 모드: client.js listWarps / unlockWarp
//   서버 모드: serverApi.js (fetch를 가짜로 바꿔서 서버 없이 확인)
//   ※ frontend/.env.local 에 VITE_API_URL이 있으면 client.js가 서버 모드로 돌아서 mock 테스트가 실패함
//      → VITE_API_URL= node --test tests/  로 실행
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let server, api, serverApi, session
const stored = new Map()
globalThis.window = { localStorage: { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) } }

let requests, respond
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined })
  const { status = 200, body } = await respond(url, init)
  return { ok: status < 400, status, json: async () => body }
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  api = await server.ssrLoadModule('/src/api/client.js')
  serverApi = await server.ssrLoadModule('/src/api/serverApi.js')
  session = await server.ssrLoadModule('/src/api/session.js')
})
after(async () => { await server?.close() })
beforeEach(() => {
  requests = []
  respond = () => ({ body: {} })
  session.useSessionStore.setState({ session: { accessToken: 'tok' }, user: { id: 'u1' } })
})

test('mock: 켜기 → id 순서 목록, 중복 켜기는 그대로, 사용자별로 따로', async () => {
  assert.deepEqual(await api.listWarps({ userId: 'u_pilgrim' }), { warps: [] })
  assert.deepEqual(await api.unlockWarp({ userId: 'u_pilgrim', warpId: 'warp_jm' }), { warps: ['warp_jm'] })
  assert.deepEqual(await api.unlockWarp({ userId: 'u_pilgrim', warpId: 'warp_bk' }), { warps: ['warp_bk', 'warp_jm'] })
  assert.deepEqual(await api.unlockWarp({ userId: 'u_pilgrim', warpId: 'warp_jm' }), { warps: ['warp_bk', 'warp_jm'] })
  assert.deepEqual(await api.listWarps({ userId: 'u_pilgrim' }), { warps: ['warp_bk', 'warp_jm'] })
  assert.deepEqual(await api.listWarps({ userId: 'u_admin' }), { warps: [] })
})

test('mock: 목록에 없는 id는 DB와 같은 INVALID_INPUT', async () => {
  for (const warpId of ['warp_xx', 'WARP_BK', '', null, undefined]) {
    await assert.rejects(api.unlockWarp({ userId: 'u_pilgrim', warpId }), { code: 'INVALID_INPUT' }, String(warpId))
  }
})

test('서버 모드: 경로·메서드·본문이 서버와 같음', async () => {
  respond = () => ({ body: { warps: ['warp_bk'] } })
  assert.deepEqual(await serverApi.unlockWarp({ warpId: 'warp_bk' }), { warps: ['warp_bk'] })
  assert.deepEqual(await serverApi.listWarps(), { warps: ['warp_bk'] })
  assert.deepEqual(requests.map((r) => [r.method, r.url.replace(/^https?:\/\/[^/]+/, '')]), [
    ['POST', '/me/warps'],
    ['GET', '/me/warps'],
  ])
  assert.deepEqual(requests[0].body, { warpId: 'warp_bk' })
})

test('서버 모드: 로그인 전 목록은 요청 없이 빈 배열', async () => {
  session.useSessionStore.setState({ session: null, user: null })
  assert.deepEqual(await serverApi.listWarps(), { warps: [] })
  assert.equal(requests.length, 0)
})
