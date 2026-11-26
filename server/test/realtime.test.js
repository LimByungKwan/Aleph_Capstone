// 멀티 접속(WebSocket) 테스트 — 가짜 Supabase, 실제 ws 연결 여러 개로 확인
// 실행: npm test (server/ 폴더)
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, test } from 'node:test'
import WebSocket from 'ws'
import { attachRealtime, REALTIME_PATH } from '../src/realtime.js'

const ORIGIN = 'http://localhost:5173'
const GOOD = 'good-token'
const REPLACED = 'replaced-token' // 진짜 토큰이지만 같은 계정이 다른 기기에서 로그인해서 끊긴 것
const ADMIN = 'admin-token' // 역할이 admin인 계정 (2단계 인증은 등록 안 함)

function fakeClient(token) {
  return {
    auth: {
      async getUser(t) {
        if (t === GOOD || t === REPLACED) return { data: { user: { id: 'user-1' } }, error: null }
        if (t === ADMIN) return { data: { user: { id: 'admin-1' } }, error: null }
        return { data: {}, error: { message: 'bad' } }
      },
    },
    rpc: (name) => Promise.resolve(name === 'session_ok' ? { data: token !== REPLACED, error: null } : { data: null, error: null }),
    from: () => ({
      select() {
        return this
      },
      eq() {
        return this
      },
      maybeSingle: () => Promise.resolve({ data: token === ADMIN ? { display_name: '관리자', role: 'admin' } : { display_name: '지민', role: 'pilgrim' }, error: null }),
    }),
  }
}

let server
let realtime
let url
before(async () => {
  server = createServer()
  realtime = attachRealtime(server, {
    supabase: { anon: fakeClient, asUser: fakeClient },
    allowedOrigins: [ORIGIN],
    options: { tickMs: 20, maxPeers: 3, maxMessagesPerSecond: 5, helloTimeoutMs: 300 },
  })
  server.listen(0)
  await new Promise((r) => server.once('listening', r))
  url = `ws://127.0.0.1:${server.address().port}${REALTIME_PATH}`
})
after(() => {
  realtime.close()
  server.close()
})

/** 연결 + 받은 메시지 모음. next(type)로 그 종류가 올 때까지 기다림 */
function connect({ origin = ORIGIN } = {}) {
  const ws = new WebSocket(url, { origin })
  const inbox = []
  const waiters = []
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())
    inbox.push(msg)
    for (const w of [...waiters]) if (w.type === msg.t) {
      waiters.splice(waiters.indexOf(w), 1)
      w.resolve(msg)
    }
  })
  const next = (type, ms = 1000) =>
    new Promise((resolve, reject) => {
      const found = inbox.findIndex((m) => m.t === type)
      if (found >= 0) return resolve(inbox.splice(found, 1)[0])
      const timer = setTimeout(() => reject(new Error(`${type} 메시지가 안 옴`)), ms)
      waiters.push({ type, resolve: (m) => (clearTimeout(timer), inbox.splice(inbox.indexOf(m), 1), resolve(m)) })
    })
  const opened = new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('unexpected-response', (_req, res) => reject(Object.assign(new Error('rejected'), { status: res.statusCode })))
    ws.once('error', reject)
  })
  const closed = new Promise((resolve) => ws.once('close', (code) => resolve(code)))
  const send = (msg) => ws.send(JSON.stringify(msg))
  return { ws, next, opened, closed, send, inbox }
}

async function join(opts = {}) {
  const c = connect()
  await c.opened
  c.send({ t: 'hello', ...opts })
  c.welcome = await c.next('welcome')
  return c
}

describe('멀티 접속', () => {
  test('두 사람: 서로 보이고, 이름은 토큰으로 서버가 정함, 움직임이 전달됨, 나가면 사라짐', async () => {
    const a = await join({ token: GOOD, characterId: 'female' })
    assert.deepEqual(a.welcome.peers, [])

    const b = await join() // 손님
    assert.equal(b.welcome.peers.length, 1)
    assert.deepEqual(b.welcome.peers[0], { id: a.welcome.id, name: '지민', characterId: 'female', state: null })

    const joined = await a.next('join')
    assert.deepEqual(joined.peer, { id: b.welcome.id, name: '손님', characterId: 'male', state: null })

    b.send({ t: 'move', p: [1.234, 1, -85.5], r: 1.5, s: 3.2, g: true })
    const state = await a.next('state')
    assert.deepEqual(state.s, [[b.welcome.id, 1.23, 1, -85.5, 1.5, 3.2, 1]])

    // 촬영방 밖에서 지켜보는 사람에게도 제자리 포즈의 시작과 종료가 전달됩니다.
    for (const waving of [true, false]) {
      b.send({ t: 'move', p: [1.234, 1, -85.5], r: 1.5, s: 0, g: true, waving })
      assert.deepEqual((await a.next('state')).s, [[b.welcome.id, 1.23, 1, -85.5, 1.5, 0, 1, Number(waving)]])
    }

    b.send({ t: 'char', characterId: 'female' })
    const changed = await a.next('peer')
    assert.equal(changed.peer.characterId, 'female')

    b.ws.close()
    const left = await a.next('leave')
    assert.equal(left.id, b.welcome.id)
    a.ws.close()
    await a.closed
  })

  test('이상한 값은 버림 (좌표 범위 밖, 숫자 아님, 깨진 JSON, 이름 위장 시도)', async () => {
    const a = await join()
    const b = await join({ name: '관리자', token: 'forged' }) // name은 무시, 위조 토큰은 손님
    assert.equal((await a.next('join')).peer.name, '손님')

    b.ws.send('{not json')
    b.send({ t: 'move', p: [99999, 0, 0], r: 0, s: 1 })
    b.send({ t: 'move', p: ['1', 0, 0], r: 0, s: 1 })
    b.send({ t: 'move', p: [0, 0, 0], r: 0, s: 999 })
    b.send({ t: 'char', characterId: '<script>' })
    await new Promise((r) => setTimeout(r, 80))
    assert.equal(a.inbox.filter((m) => m.t === 'state' || m.t === 'peer').length, 0)

    a.ws.close()
    b.ws.close()
    await Promise.all([a.closed, b.closed])
  })

  test('등록 안 된 사이트에서 온 접속은 403으로 거절', async () => {
    const c = connect({ origin: 'https://evil.example' })
    await assert.rejects(c.opened, (error) => error.status === 403)
  })

  test('hello를 안 보내면 끊고, 메시지를 너무 많이 보내도 끊음', async () => {
    const silent = connect()
    await silent.opened
    assert.equal(await silent.closed, 1008)

    const spammer = await join()
    for (let i = 0; i < 10; i += 1) spammer.send({ t: 'move', p: [0, 1, 0], r: 0, s: 0 })
    assert.equal(await spammer.closed, 1008)
  })

  test('계정당 1개: 다른 기기에서 로그인해 끊긴 토큰은 4001로 거절', async () => {
    const c = connect()
    await c.opened
    c.send({ t: 'hello', token: REPLACED })
    assert.equal(await c.closed, 4001)
    assert.equal(realtime.count(), 0)
  })

  test('계정당 1개: 같은 계정으로 새 연결이 오면 이전 연결은 4002, 손님끼리는 제한 없음', async () => {
    const guest1 = await join()
    const guest2 = await join()
    const first = await join({ token: GOOD })
    guest1.ws.close()
    guest2.ws.close()
    await Promise.all([guest1.closed, guest2.closed])

    const second = await join({ token: GOOD })
    assert.equal(await first.closed, 4002)
    assert.equal(realtime.count(), 1)
    second.ws.close()
    await second.closed
  })

  test('kickUser: 로그인 API가 다른 기기를 끊으면 그 계정 연결을 4001로, 손님은 그대로', async () => {
    const guest = await join()
    const user = await join({ token: GOOD })
    assert.equal(realtime.kickUser('user-1'), 1)
    assert.equal(await user.closed, 4001)
    assert.equal(realtime.kickUser(null), 0)
    assert.equal(realtime.count(), 1)
    guest.ws.close()
    await guest.closed
  })

  test('정원(테스트에서는 3명)이 차면 full 안내 후 4003, 자리가 나면 다시 들어옴', async () => {
    const people = [await join(), await join(), await join()]
    assert.equal(realtime.count(), 3)
    const extra = connect()
    await extra.opened
    extra.send({ t: 'hello' })
    assert.deepEqual(await extra.next('full'), { t: 'full', max: 3 })
    assert.equal(await extra.closed, 4003)
    // 한 명이 나가면 자리가 나서 새 사람이 들어옴
    people[0].ws.close()
    await people[0].closed
    const again = await join()
    assert.equal(realtime.count(), 3)
    for (const p of [people[1], people[2], again]) p.ws.close()
    await Promise.all([people[1].closed, people[2].closed, again.closed])
  })

  test('bye를 보내면 바로 나감 처리 (연결이 늦게 끊겨도 캐릭터가 남지 않게)', async () => {
    const a = await join()
    const b = await join()
    await a.next('join')
    b.send({ t: 'bye' })
    assert.equal((await a.next('leave')).id, b.welcome.id)
    await b.closed
    a.ws.close()
    await a.closed
  })

  test('말풍선 채팅: 모두에게(보낸 사람 포함), 줄바꿈 정리, 너무 길거나 1초 안에 또 보내면 버림', async () => {
    const a = await join({ token: GOOD })
    const b = await join()
    a.send({ t: 'chat', text: '  안녕\n하세요  ' })
    const got = await b.next('chat')
    assert.deepEqual(got, { t: 'chat', id: a.welcome.id, name: '지민', text: '안녕 하세요' })
    assert.equal((await a.next('chat')).text, '안녕 하세요')
    a.send({ t: 'chat', text: '바로 또' }) // 1초 안
    b.send({ t: 'chat', text: 'x'.repeat(81) }) // 81자
    b.send({ t: 'chat', text: '   ' })
    await new Promise((r) => setTimeout(r, 150))
    assert.equal(b.inbox.filter((m) => m.t === 'chat').length, 0)
    a.ws.close()
    b.ws.close()
    await Promise.all([a.closed, b.closed])
  })

  test('관리자 시간대·계절: 관리자만 바꿀 수 있고 모두에게, 나중에 들어온 사람도 같은 값', async () => {
    const guest = await join()
    assert.deepEqual((await guest.next('world')).world, { timeOfDay: null, season: null })
    guest.send({ t: 'world.set', timeOfDay: 'night' }) // 손님은 무시
    const admin = await join({ token: ADMIN })
    await admin.next('world')
    admin.send({ t: 'world.set', timeOfDay: 'party', season: 'winter' }) // 이상한 시간대는 버리고 계절만
    assert.deepEqual((await guest.next('world')).world, { timeOfDay: null, season: 'winter' })
    admin.send({ t: 'world.set', timeOfDay: 'night' })
    assert.deepEqual((await guest.next('world')).world, { timeOfDay: 'night', season: 'winter' })
    const late = await join()
    assert.deepEqual((await late.next('world')).world, { timeOfDay: 'night', season: 'winter' })
    admin.send({ t: 'world.set', timeOfDay: null, season: null }) // 원래대로
    await late.next('world')
    for (const c of [guest, admin, late]) c.ws.close()
    await Promise.all([guest.closed, admin.closed, late.closed])
  })
})
