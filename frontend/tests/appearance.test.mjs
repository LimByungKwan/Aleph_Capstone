// [지민] 캐릭터 꾸미기 저장 검증 — 실행: frontend/ 에서  node --test tests/
//   mock 모드: client.js getAppearance / saveAppearance
//   서버 모드: serverApi.js (fetch를 가짜로 바꿔서 서버 없이 확인)
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let server, api, serverApi, session
const stored = new Map()
globalThis.window = { localStorage: { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) } }

// 가짜 fetch: 서버 모드 요청 기록 + 응답 지정
let requests, respond
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.authorization })
  const { status = 200, body } = await respond(url, init)
  return { ok: status < 400, status, json: async () => body }
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  api = await server.ssrLoadModule('/src/api/client.js')
  serverApi = await server.ssrLoadModule('/src/api/serverApi.js')
  session = await server.ssrLoadModule('/src/api/session.js')
  await server.ssrLoadModule('/src/api/useStampProgress.js') // 훅 파일이 import 오류 없이 불러와지는지
})
after(async () => { await server?.close() })
beforeEach(() => {
  requests = []
  respond = () => ({ body: { appearance: {} } })
  stored.delete('scenewalk-character-v1')
  session.useSessionStore.setState({ session: { accessToken: 'tok' }, user: { id: 'u1' } })
})

test('mock: 보낸 항목만 합치고 null이면 삭제, 사용자별로 따로', async () => {
  assert.deepEqual((await api.getAppearance({ userId: 'u_pilgrim' })).appearance, {})
  await api.saveAppearance({ userId: 'u_pilgrim', patch: { hat: 'red' } })
  const { appearance } = await api.saveAppearance({ userId: 'u_pilgrim', patch: { color: '#f80' } })
  assert.deepEqual(appearance, { hat: 'red', color: '#f80' })
  assert.deepEqual((await api.saveAppearance({ userId: 'u_pilgrim', patch: { hat: null } })).appearance, { color: '#f80' })
  assert.deepEqual((await api.getAppearance({ userId: 'u_owner_snack' })).appearance, {})
})

test('mock: 객체 아님·2KB 초과·모르는 사용자 거부', async () => {
  await assert.rejects(api.saveAppearance({ userId: 'u_pilgrim', patch: 'red' }), { code: 'INVALID_INPUT' })
  await assert.rejects(api.saveAppearance({ userId: 'u_pilgrim', patch: ['red'] }), { code: 'INVALID_INPUT' })
  await assert.rejects(api.saveAppearance({ userId: 'u_pilgrim', patch: { big: '가'.repeat(700) } }), { code: 'TOO_LARGE' }) // 한글 3바이트 → DB와 같은 바이트 기준
  await assert.rejects(api.getAppearance({ userId: 'nobody' }), { code: 'UNAUTHORIZED' })
})

test('서버: 꾸미기 저장은 PATCH /me/appearance + 로그인 토큰', async () => {
  respond = () => ({ body: { appearance: { characterId: 'male', hat: 'red' } } })
  const res = await serverApi.saveAppearance({ patch: { hat: 'red' } })
  assert.deepEqual(res.appearance, { characterId: 'male', hat: 'red' })
  assert.equal(requests[0].method, 'PATCH')
  assert.match(requests[0].url, /\/me\/appearance$/)
  assert.deepEqual(requests[0].body, { appearance: { hat: 'red' } })
  assert.equal(requests[0].auth, 'Bearer tok')
})

test('서버: 로그인 전이면 요청 없이 {}', async () => {
  session.useSessionStore.setState({ session: null, user: null })
  assert.deepEqual(await serverApi.getAppearance(), { appearance: {} })
  assert.equal(requests.length, 0)
})

test('서버: 캐릭터는 계정 값이 우선 (다른 기기에서 고른 값)', async () => {
  stored.set('scenewalk-character-v1', JSON.stringify({ u1: 'male' }))
  respond = () => ({ body: { appearance: { characterId: 'female' } } })
  assert.equal((await serverApi.getPlayerCharacter({ userId: 'u1' })).character.id, 'female')
  assert.equal(JSON.parse(stored.get('scenewalk-character-v1')).u1, 'female') // 캐시도 갱신
})

test('서버: 꾸미기 기능 배포 전(404)·연결 실패면 이 브라우저 값으로', async () => {
  stored.set('scenewalk-character-v1', JSON.stringify({ u1: 'female' }))
  respond = () => ({ status: 404, body: { error: { code: 'NOT_FOUND', message: '없음' } } })
  const warn = console.warn; console.warn = () => {}
  try {
    assert.equal((await serverApi.getPlayerCharacter({ userId: 'u1' })).character.id, 'female')
  } finally { console.warn = warn }
})

test('서버: 캐릭터 고르면 바로 반환, 서버 저장은 뒤에서 (실패해도 선택 유지)', async () => {
  let release
  respond = () => new Promise((r) => { release = () => r({ status: 500, body: { error: { code: 'SERVER_ERROR', message: 'x' } } }) })
  const warn = console.warn; let warned = false; console.warn = () => { warned = true }
  try {
    const { character } = await serverApi.setPlayerCharacter({ userId: 'u1', characterId: 'female' }) // 서버 응답 전에 끝나야 함
    assert.equal(character.id, 'female')
    assert.equal(JSON.parse(stored.get('scenewalk-character-v1')).u1, 'female')
    assert.deepEqual(requests[0].body, { appearance: { characterId: 'female' } })
    release(); await new Promise((r) => setTimeout(r, 10))
    assert.equal(warned, true)
  } finally { console.warn = warn }
  await assert.rejects(serverApi.setPlayerCharacter({ userId: 'u1', characterId: '../x' }), { code: 'INVALID_CHARACTER' })
})
