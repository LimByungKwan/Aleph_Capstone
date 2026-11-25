// [혜진] 경복궁·경성 멀티 동기화(hj_world.js) 테스트 — WebSocket 없이 send·broadcast를 가짜로 바꿔 확인
// 실행: npm test (server/ 폴더)
//
// 확인하는 것
//   - 문을 닫으면 다른 사람에게 알리고, 나중에 들어온 사람도 닫힌 상태를 받음
//   - 앉기·일어나기, 나가면 자리 비움
//   - 탈것 위치는 보낸 사람 번호(by)를 붙여 다른 사람에게만 보냄
//   - 이상한 값(긴 id, 범위 밖 좌표)은 무시
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createHjWorld } from '../src/hj_world.js'

function setup() {
  const sent = []
  const broadcasts = []
  const world = createHjWorld({
    send: (ws, msg) => sent.push({ ws, msg }),
    broadcast: (msg, except) => broadcasts.push({ msg, except }),
  })
  return { world, sent, broadcasts }
}

describe('경복궁·경성 멀티 동기화', () => {
  test('hj.로 시작하지 않는 메시지는 처리하지 않음', () => {
    const { world } = setup()
    assert.equal(world.handle('ws', { id: 'a' }, { t: 'move' }), false)
  })

  test('문 닫기 → 알림 + 나중에 들어온 사람도 닫힌 상태', () => {
    const { world, sent, broadcasts } = setup()
    assert.equal(world.handle('wsA', { id: 'a' }, { t: 'hj.door', id: 'sajeongjeon', closed: true }), true)
    assert.deepEqual(broadcasts.at(-1), { msg: { t: 'hj.door', id: 'sajeongjeon', closed: true }, except: 'wsA' })
    world.welcome('wsC')
    assert.equal(sent.at(-1).msg.t, 'hj.snapshot')
    assert.deepEqual(sent.at(-1).msg.doors, { sajeongjeon: true })
  })

  test('앉기·일어나기, 나가면 자리 비움', () => {
    const { world, sent, broadcasts } = setup()
    world.handle('wsA', { id: 'a' }, { t: 'hj.sit', seat: 'sajeong_throne', h: 1.13, r: 3.14159 })
    assert.deepEqual(broadcasts.at(-1).msg, { t: 'hj.sit', id: 'a', seat: 'sajeong_throne', h: 1.13, r: 3.142 })
    world.welcome('wsB')
    assert.deepEqual(sent.at(-1).msg.seats, { a: { seat: 'sajeong_throne', h: 1.13, r: 3.142 } })
    world.disconnect({ id: 'a' })
    assert.deepEqual(broadcasts.at(-1).msg, { t: 'hj.sit', id: 'a', seat: null })
  })

  test('탈것 위치는 보낸 사람 번호를 붙여 다른 사람에게', () => {
    const { world, broadcasts } = setup()
    world.handle('wsA', { id: 'a' }, { t: 'hj.veh', v: 'HJ/gs_car_1', p: [1.234, 0.1, -2], r: 0.5 })
    assert.deepEqual(broadcasts.at(-1), { msg: { t: 'hj.veh', v: 'HJ/gs_car_1', p: [1.23, 0.1, -2], r: 0.5, by: 'a' }, except: 'wsA' })
  })

  test('이상한 값은 무시', () => {
    const { world, broadcasts } = setup()
    world.handle('wsA', { id: 'a' }, { t: 'hj.door', id: 'x'.repeat(80), closed: true })
    world.handle('wsA', { id: 'a' }, { t: 'hj.veh', v: 'HJ/gs_car_1', p: [99999, 0, 0], r: 0 })
    world.handle('wsA', { id: 'a' }, { t: 'hj.sit', seat: 'ok', h: 'high', r: 0 })
    assert.equal(broadcasts.length, 0)
  })

  test('서버 시각 묻기 → 화면 시각과 함께 답함', () => {
    const { world, sent } = setup()
    world.handle('wsA', { id: 'a' }, { t: 'hj.time', c: 123 })
    assert.equal(sent.at(-1).msg.t, 'hj.time')
    assert.equal(sent.at(-1).msg.c, 123)
    assert.ok(Number.isFinite(sent.at(-1).msg.now))
  })
})
