import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AnimationMixer, Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, init) { Object.assign(this, { type }, init) } }

for (const gender of ['male', 'female']) {
  test(`${gender}: all animated skin weights are normalized and sampled poses stay grounded and finite`, async () => {
    const buffer = readFileSync(new URL(`../public/models/characters/${gender}.glb`, import.meta.url))
    const jsonSize = buffer.readUInt32LE(12)
    const gltf = JSON.parse(buffer.subarray(20, 20 + jsonSize).toString())
    const binary = buffer.subarray(28 + jsonSize)
    gltf.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`
    // Geometry/animation validation needs no GPU or browser image decoder.
    delete gltf.images
    delete gltf.textures
    delete gltf.materials
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) delete primitive.material
    const { scene, animations } = await new GLTFLoader().parseAsync(JSON.stringify(gltf), '')
    const meshes = []
    scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object) })
    assert.ok(meshes.length > 0)
    scene.updateMatrixWorld(true)
    const toe = scene.getObjectByName('LeftToeBase').getWorldPosition(new Vector3())
    const ankle = scene.getObjectByName('LeftFoot').getWorldPosition(new Vector3())
    assert.ok(toe.z > ankle.z, 'asset must face +Z to match ecctrl bodyZAxis')
    for (const mesh of meshes) {
      const weights = mesh.geometry.getAttribute('skinWeight')
      for (let i = 0; i < weights.count; i++) {
        const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)
        assert.ok(Math.abs(sum - 1) < .001, `vertex ${i} has weight sum ${sum}`)
      }
    }
    const expected = { Idle: 6, Walk: 1, Run: .7, Jump: 1 }
    const mixer = new AnimationMixer(scene)
    const box = new Box3(), total = new Box3(), size = new Vector3()
    for (const clip of animations) {
      assert.ok(clip.name === 'Sit' ? clip.duration > .5 && clip.duration < 6 : Math.abs(clip.duration - expected[clip.name]) < .04, `${clip.name} duration ${clip.duration}`)
      for (const track of ['Jump', 'Sit'].includes(clip.name) ? [] : clip.tracks) {
        const stride = track.getValueSize()
        const start = track.values.slice(0, stride)
        const end = track.values.slice(-stride)
        // q and -q encode the same orientation.
        const difference = Math.min(
          Math.max(...start.map((v, i) => Math.abs(v - end[i]))),
          track.name.endsWith('.quaternion') ? Math.max(...start.map((v, i) => Math.abs(v + end[i]))) : Infinity,
        )
        assert.ok(difference < .002, `${clip.name} loop discontinuity in ${track.name}: ${difference}`)
      }
      const action = mixer.clipAction(clip).play()
      for (let frame = 0; frame < 24; frame++) {
        mixer.setTime(clip.duration * frame / 24)
        scene.updateMatrixWorld(true)
        total.makeEmpty()
        for (const mesh of meshes) {
          mesh.skeleton.update()
          mesh.computeBoundingBox()
          box.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld)
          total.union(box)
        }
        total.getSize(size)
        assert.ok(size.toArray().every(Number.isFinite))
        assert.ok(size.y > (['Jump', 'Sit'].includes(clip.name) ? .85 : 1.2) && size.y < 2.1, `${clip.name} height ${size.y}`)
        assert.ok(size.x < 1.4 && size.z < 1.6, `${clip.name} deformed bounds ${size.toArray()}`)
        assert.ok(total.min.y > -.025, `${clip.name} sole penetrates floor: ${total.min.y}`)
        assert.ok(Math.abs((total.min.x + total.max.x)/2) < .35, `${clip.name} lateral root drift`)
        assert.ok(Math.abs((total.min.z + total.max.z)/2) < .55, `${clip.name} forward root drift`)
      }
      action.stop()
    }
  })
}
