import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server, api, db
const stored = new Map()
globalThis.window = { localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) } }
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  api = await server.ssrLoadModule('/src/api/client.js')
  db = await server.ssrLoadModule('/src/api/mockDb.js')
})
after(async () => { await server?.close() })

test('character selection is per user and preserves coupons and stamps', async () => {
  assert.equal(typeof api.getPlayerCharacter, 'function')
  assert.equal(typeof api.setPlayerCharacter, 'function')
  const before = JSON.stringify(db.readDb().coupons)
  assert.equal((await api.getPlayerCharacter({ userId: 'u_pilgrim' })).character.id, 'male')
  await api.setPlayerCharacter({ userId: 'u_pilgrim', characterId: 'female' })
  assert.equal((await api.getPlayerCharacter({ userId: 'u_pilgrim' })).character.id, 'female')
  assert.equal((await api.getPlayerCharacter({ userId: 'u_owner_snack' })).character.id, 'male')
  assert.equal(JSON.stringify(db.readDb().coupons), before)
  assert.equal(JSON.parse(stored.get('scenewalk-mock-db-v3')).playerCharacters.u_pilgrim, 'female')
  await assert.rejects(api.setPlayerCharacter({ userId: 'u_pilgrim', characterId: '../../x' }), { code: 'INVALID_CHARACTER' })
  await assert.rejects(api.setPlayerCharacter({ userId: 'unknown', characterId: 'male' }), { code: 'UNAUTHORIZED' })
  db.readDb().playerCharacters.u_pilgrim = 'removed-model'
  assert.equal((await api.getPlayerCharacter({ userId: 'u_pilgrim' })).character.id, 'male')
})

for (const gender of ['male', 'female', 'male2', 'female2']) {
  test(`${gender} GLB has embedded textures, a skin, and three locomotion clips and a jump`, () => {
    const buffer = readFileSync(new URL(`../public/models/characters/${gender}.glb`, import.meta.url))
    assert.equal(buffer.readUInt32LE(0), 0x46546c67)
    const length = buffer.readUInt32LE(12)
    const gltf = JSON.parse(buffer.subarray(20, 20 + length).toString())
    assert.ok(gltf.skins?.[0].joints.length >= 20)
    assert.deepEqual(gltf.animations.map(a => a.name).sort(), ['Idle', 'Jump', 'Run', 'Sit', 'Walk'])
    assert.ok(gltf.images?.length > 0)
    assert.ok(gltf.images.every(image => image.bufferView !== undefined))
    assert.ok(gltf.meshes.every(mesh => mesh.primitives.every(p => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined)))
    assert.ok(buffer.length < 20 * 1024 * 1024, 'web asset should stay below 20 MB')
  })
}
