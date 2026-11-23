// [지민] 커플 타로 기록 저장 검증 — 실행: frontend/ 에서  node --test tests/
//   mock 모드: client.js listTarotReadings / saveTarotReading / deleteTarotReading
//   서버 모드: serverApi.js (fetch를 가짜로 바꿔서 서버 없이 확인)
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

const U = 'u_pilgrim'
const base = { userId: U, spread: 'couple', cards: ['major_06', 'major_17'], summary: '  서로의 속도를 맞춰 가는 시기예요. ' }

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

test('mock: 저장 → 최신순 목록, 요약 앞뒤 공백 제거, detail 기본 {}', async () => {
  const { reading } = await api.saveTarotReading(base)
  assert.equal(reading.summary, '서로의 속도를 맞춰 가는 시기예요.')
  assert.deepEqual(reading.detail, {})
  assert.ok(reading.id && reading.createdAt)
  await api.saveTarotReading({ ...base, cards: ['major_00'], summary: '두 번째', detail: { questionIds: ['q03'] } })
  const { readings } = await api.listTarotReadings({ userId: U })
  assert.equal(readings[0].summary, '두 번째')
  assert.deepEqual(readings[0].detail, { questionIds: ['q03'] })
  assert.equal(readings[1].id, reading.id)
})

test('mock: 형식이 틀리면 DB와 같은 코드로 거부', async () => {
  const bad = [
    [{ spread: 'Couple!' }, 'INVALID_INPUT'],
    [{ cards: [] }, 'INVALID_INPUT'],
    [{ cards: Array.from({ length: 11 }, (_, i) => `c${i}`) }, 'INVALID_INPUT'],
    [{ cards: ['<script>'] }, 'INVALID_INPUT'],
    [{ summary: '   ' }, 'INVALID_INPUT'],
    [{ summary: '가'.repeat(1001) }, 'INVALID_INPUT'],
    [{ detail: ['x'] }, 'INVALID_INPUT'],
    [{ detail: { memo: 'a'.repeat(5000) } }, 'TOO_LARGE'],
  ]
  for (const [patch, code] of bad) {
    await assert.rejects(api.saveTarotReading({ ...base, ...patch }), (e) => e.code === code, JSON.stringify(patch).slice(0, 30))
  }
})

test('mock: 최근 30개만 보관, limit 최대 30, 사용자별로 따로', async () => {
  for (let i = 0; i < 35; i++) await api.saveTarotReading({ ...base, summary: `기록 ${i}` })
  const { readings } = await api.listTarotReadings({ userId: U, limit: 999 })
  assert.equal(readings.length, 30)
  assert.equal(readings[0].summary, '기록 34')
  assert.equal((await api.listTarotReadings({ userId: U })).readings.length, 10)
  assert.deepEqual((await api.listTarotReadings({ userId: 'u_owner_snack' })).readings, [])
})

test('mock: 삭제 → 목록에서 빠짐, 없는 id는 NOT_FOUND', async () => {
  const { reading } = await api.saveTarotReading({ ...base, summary: '지울 기록' })
  assert.deepEqual(await api.deleteTarotReading({ userId: U, readingId: reading.id }), { ok: true })
  const { readings } = await api.listTarotReadings({ userId: U, limit: 30 })
  assert.ok(!readings.some((r) => r.id === reading.id))
  await assert.rejects(api.deleteTarotReading({ userId: U, readingId: reading.id }), (e) => e.code === 'NOT_FOUND')
})

test('서버 모드: 경로·메서드·본문이 서버 README와 같음', async () => {
  respond = (url, init) => (init.method === 'POST' ? { status: 201, body: { reading: { id: 'r1' } } } : { body: { readings: [], ok: true } })
  await serverApi.saveTarotReading({ spread: 'couple', cards: ['major_06'], summary: 's', detail: { questionIds: ['q03'] } })
  await serverApi.listTarotReadings({ limit: 5 })
  await serverApi.deleteTarotReading({ readingId: '11111111-1111-4111-8111-111111111111' })
  assert.deepEqual(requests.map((r) => [r.method, r.url.replace(/^https?:\/\/[^/]+/, '')]), [
    ['POST', '/me/tarot-readings'],
    ['GET', '/me/tarot-readings?limit=5'],
    ['DELETE', '/me/tarot-readings/11111111-1111-4111-8111-111111111111'],
  ])
  assert.deepEqual(requests[0].body, { spread: 'couple', cards: ['major_06'], summary: 's', detail: { questionIds: ['q03'] } })
})

test('서버 모드: 로그인 전 목록은 요청 없이 빈 배열', async () => {
  session.useSessionStore.setState({ session: null, user: null })
  assert.deepEqual(await serverApi.listTarotReadings(), { readings: [] })
  assert.equal(requests.length, 0)
})
