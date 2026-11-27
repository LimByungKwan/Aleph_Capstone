// 애니 구역 온천장 손님용 엘리베이터 멀티 동기화 (지민) — 누가 층을 고르거나 부르면 모두에게 같은 운행 신호
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
  // timeScale 0.02: 1층 → 5층(약 9.8초) 운행이 약 0.2초에 끝남
  realtime = attachRealtime(server, {
    supabase: { anon: fakeClient, asUser: fakeClient },
    allowedOrigins: [ORIGIN],
    options: { tickMs: 20, jmLift: { timeScale: 0.02, maxLifts: 20 } },
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
  return { ws, next, opened, inbox, send: (msg) => ws.send(JSON.stringify(msg)) }
}
async function join() {
  const c = connect()
  await c.opened
  c.send({ t: 'hello' })
  await c.next('welcome')
  return c
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const LEVELS = [0, 7, 11.8, 16.6, 21.4] // 실제 여관 층 높이 (칸 바닥, 1층 기준)

describe('온천장 엘리베이터 동기화', () => {
  test('B가 5층을 고르면 A에게도 같은 운행, 운행 중 1층 호출은 도착 후 이어서', async () => {
    const id = 'jm_gelev_t1'
    const a = await join()
    const b = await join()
    b.send({ t: 'jm.lift.go', id, to: 4, levels: LEVELS })
    const [ta, tb] = await Promise.all([a.next('jm.lift.trip'), b.next('jm.lift.trip')])
    assert.deepEqual(ta, { t: 'jm.lift.trip', id, from: 0, to: 4, elapsed: 0 })
    assert.deepEqual(tb, ta)

    a.send({ t: 'jm.lift.go', id, to: 0, levels: LEVELS }) // 운행 중 1층에서 부름 → 기억
    a.send({ t: 'jm.lift.go', id, to: 4, levels: LEVELS }) // 지금 가는 층이라 무시
    const back = await a.next('jm.lift.trip', 1500)
    assert.deepEqual([back.from, back.to], [4, 0])
    await wait(400)
    assert.equal(a.inbox.filter((m) => m.t === 'jm.lift.trip').length, 0) // 더 움직이지 않음
    a.ws.close()
    b.ws.close()
  })

  test('늦게 들어온 사람은 지금 층·운행 상태를 받음', async () => {
    const id = 'jm_gelev_t2'
    const a = await join()
    a.send({ t: 'jm.lift.go', id, to: 2, levels: LEVELS })
    await a.next('jm.lift.trip')
    const c = connect()
    await c.opened
    c.send({ t: 'hello' })
    await c.next('welcome')
    let st = await c.next('jm.lift.state')
    while (st.id !== id) st = await c.next('jm.lift.state')
    assert.equal(st.at, 0)
    assert.deepEqual([st.trip.from, st.trip.to], [0, 2])
    await wait(300) // 운행 끝
    const d = await join()
    let st2 = await d.next('jm.lift.state')
    while (st2.id !== id) st2 = await d.next('jm.lift.state')
    assert.deepEqual([st2.at, st2.trip], [2, null])
    for (const x of [a, c, d]) x.ws.close()
  })

  test('잘못된 요청은 무시 (층 번호·층 높이·id)', async () => {
    const a = await join()
    a.send({ t: 'jm.lift.go', id: 'jm_gelev_t3', to: 9, levels: LEVELS })
    a.send({ t: 'jm.lift.go', id: 'jm_gelev_t3', to: 1.5, levels: LEVELS })
    a.send({ t: 'jm.lift.go', id: 'jm_gelev_t4', to: 1, levels: [0, 'x'] })
    a.send({ t: 'jm.lift.go', id: 'bad id!', to: 1, levels: LEVELS })
    a.send({ t: 'jm.lift.go', id: 'jm_gelev_t5', to: 1, levels: new Array(20).fill(1) })
    await wait(150)
    assert.equal(a.inbox.filter((m) => m.t === 'jm.lift.trip').length, 0)
    a.ws.close()
  })
})
