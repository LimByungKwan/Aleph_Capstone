// [지민] 스탬프 진행률 계산 검증 — 실행: frontend/ 에서  node --test tests/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const { stampProgress } = await import('../src/api/stampProgressCore.js')
const places = JSON.parse(readFileSync(new URL('../../shared/places.json', import.meta.url), 'utf8'))
const ids = (f) => places.filter(f).map((p) => ({ placeId: p.id }))

test('빈 스탬프', () => {
  const p = stampProgress([], places)
  assert.equal(p.total, 17); assert.equal(p.collected, 0); assert.equal(p.complete, false)
  assert.equal(p.spots.total, 13); assert.equal(p.missing.length, 17)
  assert.deepEqual(Object.keys(p.zones).sort(), ['BK', 'HJ', 'JM', 'SG'])
})
test('undefined (로딩 중)도 0으로', () => { assert.equal(stampProgress(undefined, places).collected, 0) })
test('명소만 다 모음 → spots 완주, 전체는 아님', () => {
  const p = stampProgress(ids((x) => x.type === 'spot'), places)
  assert.equal(p.spots.complete, true); assert.equal(p.complete, false); assert.equal(p.missing.length, 4)
})
test('JM 구역만 완주', () => {
  const p = stampProgress(ids((x) => x.zone === 'JM'), places)
  assert.equal(p.zones.JM.complete, true); assert.equal(p.zones.HJ.complete, false)
})
test('전체 완주 + 중복·NPC·없는 장소는 무시', () => {
  const all = ids((x) => x.type !== 'npc')
  const p = stampProgress([...all, all[0], { placeId: 'npc_x' }, { placeId: 'deleted_place' }], places)
  assert.equal(p.collected, 17); assert.equal(p.complete, true); assert.deepEqual(p.missing, [])
})
