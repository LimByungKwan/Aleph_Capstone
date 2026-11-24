// 전망대 엘리베이터 멀티 동기화 (병관) — 한 사람이 타거나 부르면 모두에게 같은 운행 신호
// 실행: npm test (server/ 폴더)
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, test } from 'node:test'
import WebSocket from 'ws'
import { attachRealtime, REALTIME_PATH } from '../src/realtime.js'

const ORIGIN = 'http://localhost:5173'
const fakeClient = () => ({
  auth: { getUser: async () => ({ data: {}, error: { message: 'guest' } }) },
  from: () => ({
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }),
})

let server
let realtime
let url
before(async () => {
  server = createServer()
  realtime = attachRealtime(server, {
    supabase: { anon: fakeClient, asUser: fakeClient },
    allowedOrigins: [ORIGIN],
    options: { tickMs: 20, lift: { tripMs: 120, boardMs: 100, boardMaxMs: 250, closingMs: 60, maxTowers: 20 } },
  })
  server.listen(0)
  await new Promise((r) => server.once('listening', r))
  url = `ws://127.0.0.1:${server.address().port}${REALTIME_PATH}`
})
after(() => {
  realtime.close()
  server.close()
})

function connect() {
  const ws = new WebSocket(url, { origin: ORIGIN })
  const inbox = []
  const waiters = []
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())
    const w = waiters.find((x) => x.type === msg.t)
    if (w) {
      waiters.splice(waiters.indexOf(w), 1)
      w.resolve(msg)
    } else inbox.push(msg)
  })
  const next = (type, ms = 1000) =>
    new Promise((resolve, reject) => {
      const found = inbox.findIndex((m) => m.t === type)
      if (found >= 0) return resolve(inbox.splice(found, 1)[0])
      const timer = setTimeout(() => reject(new Error(`${type} 메시지가 안 옴`)), ms)
      waiters.push({ type, resolve: (m) => (clearTimeout(timer), resolve(m)) })
    })
  const opened = new Promise((resolve) => ws.once('open', resolve))
  const closed = new Promise((resolve) => ws.once('close', resolve))
  return { ws, next, opened, closed, inbox, send: (msg) => ws.send(JSON.stringify(msg)) }
}
async function join() {
  const c = connect()
  await c.opened
  c.send({ t: 'hello' })
  await c.next('welcome')
  return c
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const T = 'BK/tower'

describe('전망대 엘리베이터 동기화', () => {
  test('B가 타면(위로) A 화면에도 같은 운행 신호, 운행 중 아래에서 부르면 도착 후 이어서 내려옴', async () => {
    const a = await join()
    const b = await join()
    b.send({ t: 'lift.call', towerId: T, to: 1 })
    const [ta, tb] = await Promise.all([a.next('lift.trip'), b.next('lift.trip')])
    assert.deepEqual(ta, { t: 'lift.trip', towerId: T, from: 0, to: 1, elapsed: 0 })
    assert.deepEqual(tb, ta)

    a.send({ t: 'lift.call', towerId: T, to: 0 }) // 운행 중 1층에서 호출 → 기억
    a.send({ t: 'lift.call', towerId: T, to: 1 }) // 지금 가는 층이라 무시
    const back = await a.next('lift.trip', 1500)
    assert.deepEqual([back.from, back.to], [1, 0])
    await wait(200)
    assert.equal(a.inbox.filter((m) => m.t === 'lift.trip').length, 0) // 더 움직이지 않음
    a.ws.close()
    b.ws.close()
    await Promise.all([a.closed, b.closed])
  })

  test('나중에 들어온 사람은 지금 상태를 받음 (운행 중이면 몇 ms 지났는지도)', async () => {
    const a = await join()
    a.send({ t: 'lift.call', towerId: T, to: 1 })
    await a.next('lift.trip')
    await wait(40)
    const late = connect()
    await late.opened
    late.send({ t: 'hello' })
    const state = await late.next('lift.state')
    assert.equal(state.towerId, T)
    assert.equal(state.trip.to, 1)
    assert.ok(state.trip.elapsed >= 30)
    await wait(150)
    const later = await join()
    assert.deepEqual(await later.next('lift.state'), { t: 'lift.state', towerId: T, at: 1, trip: null, boarding: null })
    for (const c of [a, late, later]) c.ws.close()
    await Promise.all([a.closed, late.closed, later.closed])
  })

  test('여러 명 탑승: 탄 사람마다 대기가 늘고(최대까지), 모두에게 같은 카운트다운, 마감되면 출발', async () => {
    const a = await join()
    const b = await join()
    await wait(20)
    a.inbox.length = 0
    b.inbox.length = 0
    a.send({ t: 'lift.board', towerId: 'T2' }) // 1층에서 탑승 → 위로
    const first = await b.next('lift.boarding')
    assert.equal(first.to, 1)
    assert.equal(first.riders, 1)
    assert.ok(first.remaining > 80 && first.remaining <= 100)
    await wait(60)
    await a.next('lift.boarding') // 내가 탄 알림
    b.send({ t: 'lift.board', towerId: 'T2' }) // 두 번째 사람 → 다시 100ms로
    const second = await a.next('lift.boarding')
    assert.equal(second.riders, 2)
    assert.ok(second.remaining > 80)
    const trip = await a.next('lift.trip', 1000)
    assert.deepEqual([trip.from, trip.to], [0, 1])
    await b.next('lift.trip')
    await wait(150) // 도착
    for (const c of [a, b]) c.ws.close()
    await Promise.all([a.closed, b.closed])
  })

  test('[바로 출발]은 탄 사람만, 다 내리면 대기 취소', async () => {
    const a = await join()
    const outsider = await join()
    await wait(20)
    a.send({ t: 'lift.board', towerId: 'T3' })
    await a.next('lift.boarding')
    await outsider.next('lift.boarding')
    outsider.send({ t: 'lift.go', towerId: 'T3' }) // 안 탄 사람은 출발 못 시킴
    a.send({ t: 'lift.off', towerId: 'T3' })
    const cancel = await outsider.next('lift.boarding')
    assert.equal(cancel.remaining, null)
    await wait(130)
    assert.equal([...a.inbox, ...outsider.inbox].filter((m) => m.t === 'lift.trip').length, 0)

    a.send({ t: 'lift.board', towerId: 'T3' })
    await a.next('lift.boarding')
    await outsider.next('lift.boarding')
    a.send({ t: 'lift.go', towerId: 'T3' }) // 탄 사람 → 바로 출발
    const trip = await outsider.next('lift.trip', 60)
    assert.equal(trip.elapsed, 0)
    await wait(150)
    for (const c of [a, outsider]) c.ws.close()
    await Promise.all([a.closed, outsider.closed])
  })

  test('[열림]: 문이 닫히는 중이면 다시 열고 대기로, 닫히는 문으로 탄 사람도 다시 열림', async () => {
    const a = await join()
    const b = await join()
    await wait(20)
    a.send({ t: 'lift.board', towerId: 'T4' })
    await a.next('lift.boarding')
    a.send({ t: 'lift.go', towerId: 'T4' })
    await b.next('lift.trip')
    b.send({ t: 'lift.hold', towerId: 'T4' }) // 닫히는 중(60ms 안)
    const reopened = await a.next('lift.boarding')
    assert.ok(reopened.remaining > 0)
    assert.equal(reopened.riders, 1)
    const trip = await b.next('lift.trip', 1000) // 다시 대기 끝나면 출발
    assert.ok(trip)
    await wait(150)
    for (const c of [a, b]) c.ws.close()
    await Promise.all([a.closed, b.closed])
  })

  test('탑승 대기 중에 접속이 끊기면 그 사람은 빠지고, 아무도 없으면 취소', async () => {
    const a = await join()
    const b = await join()
    await wait(20)
    a.send({ t: 'lift.board', towerId: 'T5' })
    await b.next('lift.boarding')
    a.ws.close()
    await a.closed
    const cancel = await b.next('lift.boarding')
    assert.equal(cancel.remaining, null)
    b.ws.close()
    await b.closed
  })

  test('이미 그 층이면·이상한 값이면 움직이지 않음', async () => {
    const a = await join()
    await a.next('lift.state') // 지금은 위층(at 1)
    a.send({ t: 'lift.call', towerId: T, to: 1 })
    a.send({ t: 'lift.call', towerId: T, to: 5 })
    a.send({ t: 'lift.call', towerId: '<script>', to: 0 })
    await wait(60)
    assert.equal(a.inbox.filter((m) => m.t === 'lift.trip').length, 0)
    a.ws.close()
    await a.closed
  })
})
