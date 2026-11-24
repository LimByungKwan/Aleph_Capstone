// 커플 포토존 인생네컷 멀티 (병관) — 초대·수락·둘 다 서면 4컷 신호·취소
// 실행: npm test (server/ 폴더)
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, test } from 'node:test'
import WebSocket from 'ws'
import { attachRealtime, REALTIME_PATH } from '../src/realtime.js'

const ORIGIN = 'http://localhost:5173'
const NAMES = { 'tok-a': '민지', 'tok-b': '준호' }
const fakeClient = (token) => ({
  auth: { getUser: async (t) => (NAMES[t] ? { data: { user: { id: t } }, error: null } : { data: {}, error: { message: 'bad' } }) },
  from: () => ({
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle: () => Promise.resolve({ data: { display_name: NAMES[token] }, error: null }),
  }),
})

let server
let realtime
let url
before(async () => {
  server = createServer()
  realtime = attachRealtime(server, {
    supabase: { anon: () => fakeClient(), asUser: (token) => fakeClient(token) },
    allowedOrigins: [ORIGIN],
    options: { tickMs: 20, photo: { shotGapMs: 40, doneDelayMs: 20, inviteMs: 150 } },
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
async function join(token) {
  const c = connect()
  await c.opened
  c.send({ t: 'hello', token })
  c.id = (await c.next('welcome')).id
  return c
}
async function pair() {
  const a = await join('tok-a')
  const b = await join('tok-b')
  a.send({ t: 'photo.invite', to: b.id })
  await a.next('photo.invite_sent')
  const inv = await b.next('photo.invited')
  assert.equal(inv.from.name, '민지')
  b.send({ t: 'photo.respond', inviteId: inv.inviteId, accept: true })
  const [sa, sb] = await Promise.all([a.next('photo.start'), b.next('photo.start')])
  return { a, b, sa, sb }
}
const bye = async (...cs) => {
  cs.forEach((c) => c.ws.close())
  await Promise.all(cs.map((c) => c.closed))
}

describe('커플 포토존 인생네컷 멀티', () => {
  test('둘 다 발자국에 서야 4컷 신호가 두 화면에 같은 순서로 오고, 끝나면 방이 지워짐', async () => {
    const { a, b, sa, sb } = await pair()
    assert.deepEqual([sa.role, sb.role], ['a', 'b'])
    assert.equal(sa.partner.name, '준호')

    a.send({ t: 'photo.ready', roomId: sa.roomId, ready: true })
    assert.deepEqual(await b.next('photo.ready_state'), { t: 'photo.ready_state', a: true, b: false })
    await new Promise((r) => setTimeout(r, 80))
    assert.equal([...a.inbox, ...b.inbox].filter((m) => m.t === 'photo.shot').length, 0) // 한 명만 서면 안 찍음

    b.send({ t: 'photo.ready', roomId: sb.roomId, ready: true })
    for (const c of [a, b]) {
      for (let i = 0; i < 4; i++) assert.deepEqual(await c.next('photo.shot'), { t: 'photo.shot', index: i, total: 4 })
      await c.next('photo.done')
    }
    await new Promise((r) => setTimeout(r, 30))
    assert.deepEqual(realtime.photo.stats(), { invites: 0, rooms: 0 })
    await bye(a, b)
  })

  test('찍기 전에 한 명이 나가면 상대에게 알림', async () => {
    const { a, b } = await pair()
    b.send({ t: 'photo.leave' })
    assert.equal((await a.next('photo.cancelled')).reason, 'left')
    await bye(a, b)
  })

  test('거절·없는 사람·초대 시간 초과', async () => {
    const a = await join('tok-a')
    const b = await join('tok-b')
    a.send({ t: 'photo.invite', to: 'nobody' })
    assert.equal((await a.next('photo.error')).code, 'NOT_FOUND')
    a.send({ t: 'photo.invite', to: b.id })
    const inv = await b.next('photo.invited')
    b.send({ t: 'photo.respond', inviteId: inv.inviteId, accept: false })
    assert.equal((await a.next('photo.declined')).by.name, '준호')
    a.send({ t: 'photo.invite', to: b.id })
    await b.next('photo.invited')
    assert.equal((await a.next('photo.cancelled')).reason, 'expired')
    await bye(a, b)
  })
})
