// [지민] 스탬프 진행률 계산 검증 — 실행: frontend/ 에서  node --test tests/
// 개수는 shared/places.json에서 직접 셈 (11/26: 팀원이 장소를 추가할 때마다 고정 숫자 17·13이 틀어져서 바꿈)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const { stampProgress } = await import('../src/api/stampProgressCore.js')
const places = JSON.parse(readFileSync(new URL('../../shared/places.json', import.meta.url), 'utf8'))
const ids = (f) => places.filter(f).map((p) => ({ placeId: p.id }))

const stampable = places.filter((p) => p.type !== 'npc')
const spots = stampable.filter((p) => p.type === 'spot')
const zones = [...new Set(stampable.map((p) => p.zone))].sort()

test('장소 데이터 기본 조건 (명소·가게가 둘 다 있고, 4개 구역이 모두 있음)', () => {
  assert.ok(spots.length > 0 && spots.length < stampable.length, '명소만도, 가게만도 아니어야 테스트가 의미 있음')
  assert.deepEqual(zones, ['BK', 'HJ', 'JM', 'SG'])
})
test('빈 스탬프', () => {
  const p = stampProgress([], places)
  assert.equal(p.total, stampable.length); assert.equal(p.collected, 0); assert.equal(p.complete, false)
  assert.equal(p.spots.total, spots.length); assert.equal(p.missing.length, stampable.length)
  assert.deepEqual(Object.keys(p.zones).sort(), zones)
})
test('undefined (로딩 중)도 0으로', () => { assert.equal(stampProgress(undefined, places).collected, 0) })
test('명소만 다 모음 → spots 완주, 전체는 아님 (남은 건 가게 수만큼)', () => {
  const p = stampProgress(ids((x) => x.type === 'spot'), places)
  assert.equal(p.spots.complete, true); assert.equal(p.complete, false)
  assert.equal(p.missing.length, stampable.length - spots.length)
  assert.ok(p.missing.every((m) => m.type !== 'spot'))
})
test('JM 구역만 완주', () => {
  const p = stampProgress(ids((x) => x.zone === 'JM'), places)
  assert.equal(p.zones.JM.complete, true); assert.equal(p.zones.HJ.complete, false)
})
test('전체 완주 + 중복·NPC·없는 장소는 무시', () => {
  const all = ids((x) => x.type !== 'npc')
  const p = stampProgress([...all, all[0], { placeId: 'npc_x' }, { placeId: 'deleted_place' }], places)
  assert.equal(p.collected, stampable.length); assert.equal(p.complete, true); assert.deepEqual(p.missing, [])
})
