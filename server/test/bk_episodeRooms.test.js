// (담당: 병관) 실제 WebSocket으로 데이트 에피소드의 두 사람 진행과 방 정리를 확인
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import WebSocket from 'ws'
import { attachRealtime, REALTIME_PATH } from '../src/realtime.js'
import { LETTER_STATIONS } from '../../shared/bk_letterPuzzle.js'

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
  const latte = { drink: '바닐라 라테', topping: 'sugar' }
  const soda = { drink: '유자 에이드', topping: 'mint' }
  a.send({ ...step(0, 'cafe'), cup: { ...latte, dessert: '치즈케이크' } })
  const [first, partner] = await Promise.all([a.next('episode.state'), b.next('episode.state')])
  assert.deepEqual([first.step, first.ready, partner.step, partner.partnerReady], [0, true, 0, true])
  assert.equal(partner.cups, undefined)
  a.send(step(0, 'cafe')) // 중복 제출
  b.send({ ...step(0, 'cafe'), cup: soda })
  const both = await Promise.all([a.next('episode.state'), b.next('episode.state')])
  assert.ok(both.every(({ step, ready, finished }) => step === 1 && !ready && !finished))
  assert.deepEqual(both.map(({ cups }) => cups), [[latte, soda], [soda, latte]])
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

test('골목 편지: 장소별 비공개 단서, 공유, 오답, 공동 해결 및 역할 교대', async (t) => {
  const connect = await setup(t)
  const a = await connect()
  const b = await connect()
  const offer = await invite(a, b, 'letter')
  b.send({ t: 'episode.respond', inviteId: offer.inviteId, accept: true })
  const states = async () => Promise.all([a.next('episode.state'), b.next('episode.state')])
  const [aStart, bStart] = await states()
  assert.equal(aStart.letter.role, 'sequence')
  assert.equal(bStart.letter.role, 'palette')
  assert.equal(aStart.letter.clue, undefined)
  assert.equal(bStart.letter.clue, undefined)
  const { roomId } = aStart
  const { roundId } = aStart.letter
  const send = (client, action, extra = {}) => client.send({ t: `episode.letter.${action}`, roomId, roundId, ...extra })
  const move = (client, role) => {
    const [x, z] = LETTER_STATIONS[role].point
    client.send({ t: 'move', p: [x, 1, z], r: 0, s: 0, g: true })
  }
  send(a, 'read')
  assert.equal((await a.next('episode.error')).reason, 'letter_station')
  move(a, 'sequence')
  send(a, 'read')
  const [aOnly, bOnly] = await states()
  const sequence = aOnly.letter.clue
  assert.equal(sequence.length, 3)
  assert.equal(bOnly.letter.clue, undefined)
  assert.equal(bOnly.letter.received, undefined)

  move(b, 'palette')
  send(b, 'read')
  const [aPrivate, bPrivate] = await states()
  const palette = bPrivate.letter.clue
  assert.deepEqual(Object.keys(palette).sort(), ['flower', 'moon', 'star'])
  assert.equal(aPrivate.letter.received, undefined)
  send(a, 'share')
  const [aShared, bShared] = await states()
  assert.equal(aShared.letter.shared, true)
  assert.deepEqual(bShared.letter.received, sequence)
  send(b, 'share')
  const [received] = await states()
  assert.deepEqual(received.letter.received, palette)

  const colors = sequence.map((symbol) => palette[symbol])
  send(a, 'guess', { colors }) // 색 담당만 정답을 제출할 수 있음
  send(b, 'guess', { colors: [colors[0], colors[0], colors[2]] }) // 잘못된 형식
  send(b, 'guess', { colors: [colors[1], colors[0], colors[2]] })
  const missed = await states()
  assert.ok(missed.every(({ letter }) => letter.attempts === 1 && !letter.solved && letter.ending === undefined))
  send(b, 'guess', { colors })
  const solved = await states()
  assert.ok(solved.every(({ letter }) => letter.solved && letter.ending === solved[0].letter.ending))

  send(a, 'replay')
  const requested = await states()
  assert.equal(requested[0].letter.roundId, roundId)
  assert.equal(requested[1].letter.partnerWantsReplay, true)
  send(b, 'replay')
  const [aRestart, bRestart] = await states()
  assert.notEqual(aRestart.letter.roundId, roundId)
  assert.equal(aRestart.letter.role, 'palette')
  assert.equal(bRestart.letter.role, 'sequence')
  assert.equal(aRestart.letter.clue, undefined)
  send(a, 'read') // 이전 퍼즐 메시지는 무시
  move(a, 'palette')
  send(a, 'read', { roundId: aRestart.letter.roundId })
  const [aAgain] = await states()
  move(b, 'sequence')
  send(b, 'read', { roundId: bRestart.letter.roundId })
  const [, bAgain] = await states()
  assert.notDeepEqual(aAgain.letter.clue, palette)
  assert.notDeepEqual(bAgain.letter.clue, sequence)
  assert.notDeepEqual(bAgain.letter.clue.map((symbol) => aAgain.letter.clue[symbol]), colors)
  b.ws.close()
  assert.equal((await a.next('episode.closed')).reason, 'left')
})
