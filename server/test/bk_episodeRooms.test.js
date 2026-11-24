// (담당: 병관) 실제 WebSocket으로 데이트 에피소드의 두 사람 진행과 방 정리를 확인
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import WebSocket from 'ws'
import { attachRealtime, REALTIME_PATH } from '../src/realtime.js'

const origin = 'http://localhost:5173'

async function setup(t) {
  const server = createServer()
  const realtime = attachRealtime(server, { allowedOrigins: [origin], options: { episode: { inviteMs: 200 } } })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => {
    realtime.close()
    server.close()
  })

  return async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}${REALTIME_PATH}`, { origin })
    const inbox = []
    let notify
    ws.on('message', (raw) => {
      inbox.push(JSON.parse(raw.toString()))
      notify?.()
    })
    t.after(() => ws.terminate())
    await once(ws, 'open')
    const send = (message) => ws.send(JSON.stringify(message))
    const next = async (type) => {
      const take = () => inbox.findIndex(({ t: event }) => event === type)
      if (take() < 0) await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Missing ${type}`)), 1000)
        notify = () => {
          if (take() < 0) return
          notify = null
          clearTimeout(timeout)
          resolve()
        }
      })
      return inbox.splice(take(), 1)[0]
    }
    send({ t: 'hello' })
    return { id: (await next('welcome')).id, ws, send, next }
  }
}

async function invite(a, b, episodeId = 'alley') {
  a.send({ t: 'episode.invite', episodeId, to: b.id })
  await a.next('episode.invited')
  return b.next('episode.offer')
}

test('데이트 에피소드: 두 사람이 같은 단계를 끝내야 동시에 다음 단계와 엔딩이 열린다', async (t) => {
  const connect = await setup(t)
  const a = await connect()
  const b = await connect()
  const outsider = await connect()
  const offer = await invite(a, b)
  b.send({ t: 'episode.respond', inviteId: offer.inviteId, accept: true })
  const [sa, sb] = await Promise.all([a.next('episode.state'), b.next('episode.state')])
  assert.equal(sa.roomId, sb.roomId)
  assert.equal(sa.step, 0)
  const step = (n, activity) => ({ t: 'episode.step', roomId: sa.roomId, step: n, activity })
  outsider.send(step(0, 'cafe'))
  a.send(step(0, 'mural'))
  a.send(step(0, 'cafe'))
  const [first, partner] = await Promise.all([a.next('episode.state'), b.next('episode.state')])
  assert.deepEqual([first.step, first.ready, partner.step, partner.partnerReady], [0, true, 0, true])
  a.send(step(0, 'cafe')) // 중복 제출
  b.send(step(0, 'cafe'))
  const both = await Promise.all([a.next('episode.state'), b.next('episode.state')])
  assert.ok(both.every(({ step, ready, finished }) => step === 1 && !ready && !finished))
  b.send(step(0, 'cafe')) // 늦게 도착한 이전 단계 메시지
  b.send(step(1, 'mural'))
  await a.next('episode.state')
  await b.next('episode.state')
  a.send(step(1, 'mural'))
  const finished = await Promise.all([a.next('episode.state'), b.next('episode.state')])
  assert.ok(finished.every(({ step, finished }) => step === 2 && finished))
  await invite(a, b, 'starlight') // 끝나자마자 새 방 초대 가능
})

test('데이트 에피소드: 거절, 초대 시간 초과, 연결 끊김 뒤 다른 친구를 초대할 수 있다', async (t) => {
  const connect = await setup(t)
  const a = await connect()
  const b = await connect()
  const c = await connect()
  let offer = await invite(a, b)
  b.send({ t: 'episode.respond', inviteId: offer.inviteId, accept: false })
  assert.equal((await a.next('episode.closed')).reason, 'declined')
  await b.next('episode.closed')
  await invite(a, b)
  assert.equal((await a.next('episode.closed')).reason, 'expired')
  await b.next('episode.closed')
  offer = await invite(a, b)
  b.send({ t: 'episode.respond', inviteId: offer.inviteId, accept: true })
  await a.next('episode.state')
  await b.next('episode.state')
  b.ws.close()
  assert.equal((await a.next('episode.closed')).reason, 'left')
  await invite(a, c)
})
