// 커플 타로 멀티 (병관) — 실제 WebSocket 연결로 초대·수락·답·결과·취소 확인. AI 서버는 가짜
// 실행: npm test (server/ 폴더)
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, beforeEach, describe, test } from 'node:test'
import WebSocket from 'ws'
import { attachRealtime, REALTIME_PATH } from '../src/realtime.js'

const ORIGIN = 'http://localhost:5173'
const NAMES = { 'tok-a': '민지', 'tok-b': '준호', 'tok-c': '성근' }

function fakeClient(token) {
  return {
    auth: {
      async getUser(t) {
        return NAMES[t] ? { data: { user: { id: t } }, error: null } : { data: {}, error: { message: 'bad' } }
      },
    },
    from: () => ({
      select() {
        return this
      },
      eq() {
        return this
      },
      maybeSingle: () => Promise.resolve({ data: { display_name: NAMES[token] }, error: null }),
    }),
  }
}

// 가짜 AI: 받은 값을 기록하고, fail이 켜져 있으면 실패
const ai = { calls: [], fail: false }
async function fakeTarot(a, b) {
  ai.calls.push({ a, b })
  if (ai.fail) throw new Error('AI down')
  return { match: 70, names: { a: a.name, b: b.name }, cards: [{ id: 'star' }] }
}

let server
let realtime
let url
before(async () => {
  server = createServer()
  realtime = attachRealtime(server, {
    supabase: { anon: () => fakeClient(), asUser: (token) => fakeClient(token) },
    allowedOrigins: [ORIGIN],
    readTarot: fakeTarot,
    options: { tickMs: 20, tarot: { inviteMs: 150 } },
  })
  server.listen(0)
  await new Promise((r) => server.once('listening', r))
  url = `ws://127.0.0.1:${server.address().port}${REALTIME_PATH}`
})
after(() => {
  realtime.close()
  server.close()
})
beforeEach(() => {
  ai.calls = []
  ai.fail = false
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
  const send = (msg) => ws.send(JSON.stringify(msg))
  return { ws, next, opened, closed, send, inbox }
}

async function join(token, pos = [49.5, 0, 6.9]) {
  const c = connect()
  await c.opened
  c.send({ t: 'hello', token })
  c.id = (await c.next('welcome')).id
  c.send({ t: 'move', p: pos, r: 0, s: 0, g: true })
  return c
}
const settle = () => new Promise((r) => setTimeout(r, 60))
const ten = (n) => Array.from({ length: 10 }, () => n)

async function pair() {
  const a = await join('tok-a')
  const b = await join('tok-b', [51, 0, 7])
  await settle()
  a.send({ t: 'tarot.invite', to: b.id })
  const sent = await a.next('tarot.invite_sent')
  const invited = await b.next('tarot.invited')
  assert.equal(sent.to.name, '준호')
  assert.deepEqual(invited.from, { id: a.id, name: '민지' })
  b.send({ t: 'tarot.respond', inviteId: invited.inviteId, accept: true })
  const sa = await a.next('tarot.start')
  const sb = await b.next('tarot.start')
  return { a, b, sa, sb }
}
const bye = async (...cs) => {
  cs.forEach((c) => c.ws.close())
  await Promise.all(cs.map((c) => c.closed))
}

describe('커플 타로 멀티', () => {
  test('초대 → 수락 → 각자 답 → 서버가 AI 한 번 부름 → 두 사람에게 같은 결과, 방은 지워짐', async () => {
    const { a, b, sa, sb } = await pair()
    assert.equal(sa.roomId, sb.roomId)
    assert.deepEqual([sa.role, sb.role], ['a', 'b'])
    assert.equal(sa.partner.name, '준호')
    assert.equal(sb.partner.name, '민지')

    a.send({ t: 'tarot.answers', roomId: sa.roomId, self: ten(0), guess: ten(1) })
    await a.next('tarot.waiting')
    await b.next('tarot.partner_done')
    assert.equal(ai.calls.length, 0)

    b.send({ t: 'tarot.answers', roomId: sb.roomId, self: ten(1), guess: ten(0) })
    const [ra, rb] = await Promise.all([a.next('tarot.result'), b.next('tarot.result')])
    assert.deepEqual(ra.result, rb.result)
    assert.equal(ai.calls.length, 1)
    // 이름은 화면이 아니라 서버(로그인 토큰)가 정함, 답은 역할대로
    assert.deepEqual(ai.calls[0].a, { name: '민지', self: ten(0), guess: ten(1) })
    assert.deepEqual(ai.calls[0].b, { name: '준호', self: ten(1), guess: ten(0) })
    // 상대 답은 화면으로 안 보냄
    assert.ok(![...a.inbox, ...b.inbox].some((m) => JSON.stringify(m).includes('"self"')))
    await settle()
    assert.deepEqual(realtime.tarot.stats(), { invites: 0, rooms: 0 })
    await bye(a, b)
  })

  test('접속 중이면 멀리 있어도 초대됨, 없는 사람·나 자신은 초대 못 함', async () => {
    const a = await join('tok-a')
    const far = await join('tok-c', [120, 0, 2]) // 벽화 골목
    await settle()
    a.send({ t: 'tarot.invite', to: far.id })
    assert.equal((await far.next('tarot.invited')).from.name, '민지')
    far.send({ t: 'tarot.leave' })
    await a.next('tarot.cancelled')
    a.send({ t: 'tarot.invite', to: 'nobody' })
    assert.equal((await a.next('tarot.error')).code, 'NOT_FOUND')
    a.send({ t: 'tarot.invite', to: a.id })
    assert.equal((await a.next('tarot.error')).code, 'NOT_FOUND')
    await bye(a, far)
  })

  test('거절하면 초대한 사람에게 알림, 둘 다 다시 초대 가능', async () => {
    const a = await join('tok-a')
    const b = await join('tok-b', [50, 0, 8])
    await settle()
    a.send({ t: 'tarot.invite', to: b.id })
    const invited = await b.next('tarot.invited')
    b.send({ t: 'tarot.respond', inviteId: invited.inviteId, accept: false })
    assert.equal((await a.next('tarot.declined')).by.name, '준호')
    a.send({ t: 'tarot.invite', to: b.id })
    await b.next('tarot.invited')
    await bye(a, b)
  })

  test('진행 중인 사람은 다른 초대를 받거나 보낼 수 없음', async () => {
    const { a, b } = await pair()
    const c = await join('tok-c', [50, 0, 6])
    await settle()
    c.send({ t: 'tarot.invite', to: a.id })
    assert.equal((await c.next('tarot.error')).code, 'PARTNER_BUSY')
    a.send({ t: 'tarot.invite', to: c.id })
    assert.equal((await a.next('tarot.error')).code, 'BUSY')
    await bye(a, b, c)
  })

  test('중간에 나가거나 접속이 끊기면 상대에게 알림, 답은 지움', async () => {
    const { a, b, sa } = await pair()
    a.send({ t: 'tarot.answers', roomId: sa.roomId, self: ten(0), guess: ten(0) })
    await a.next('tarot.waiting')
    b.send({ t: 'tarot.leave' })
    assert.equal((await a.next('tarot.cancelled')).reason, 'left')
    await settle()
    assert.deepEqual(realtime.tarot.stats(), { invites: 0, rooms: 0 })

    const p2 = await pair2(a, b)
    b.ws.close()
    assert.equal((await a.next('tarot.cancelled')).reason, 'left')
    await bye(a)
    void p2
  })

  test('AI 서버가 실패하면 두 사람에게 알리고, 다시 시도하면 결과', async () => {
    const { a, b, sa, sb } = await pair()
    ai.fail = true
    a.send({ t: 'tarot.answers', roomId: sa.roomId, self: ten(2), guess: ten(2) })
    b.send({ t: 'tarot.answers', roomId: sb.roomId, self: ten(2), guess: ten(2) })
    await Promise.all([a.next('tarot.failed'), b.next('tarot.failed')])
    ai.fail = false
    b.send({ t: 'tarot.retry', roomId: sb.roomId })
    await Promise.all([a.next('tarot.result'), b.next('tarot.result')])
    await bye(a, b)
  })

  test('이상한 답·남의 방에 답 보내기는 거절', async () => {
    const { a, b, sa } = await pair()
    a.send({ t: 'tarot.answers', roomId: sa.roomId, self: ['0'], guess: [0] })
    assert.equal((await a.next('tarot.error')).code, 'BAD_ANSWERS')
    a.send({ t: 'tarot.answers', roomId: sa.roomId, self: ten(0), guess: [0, 1] })
    assert.equal((await a.next('tarot.error')).code, 'BAD_ANSWERS')
    const c = await join('tok-c')
    c.send({ t: 'tarot.answers', roomId: sa.roomId, self: ten(0), guess: ten(0) })
    assert.equal((await c.next('tarot.error')).code, 'NOT_FOUND')
    assert.equal(ai.calls.length, 0)
    await bye(a, b, c)
  })

  test('초대에 답하지 않으면 시간이 지나 취소', async () => {
    const a = await join('tok-a')
    const b = await join('tok-b', [50, 0, 6])
    await settle()
    a.send({ t: 'tarot.invite', to: b.id })
    await b.next('tarot.invited')
    const [ca, cb] = await Promise.all([a.next('tarot.cancelled'), b.next('tarot.cancelled')])
    assert.equal(ca.reason, 'expired')
    assert.equal(cb.reason, 'expired')
    await bye(a, b)
  })
})

// 이미 접속한 두 사람으로 다시 방 만들기
async function pair2(a, b) {
  a.send({ t: 'tarot.invite', to: b.id })
  const invited = await b.next('tarot.invited')
  b.send({ t: 'tarot.respond', inviteId: invited.inviteId, accept: true })
  await Promise.all([a.next('tarot.start'), b.next('tarot.start')])
}
