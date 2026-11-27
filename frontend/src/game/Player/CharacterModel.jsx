import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, LoopOnce, LoopRepeat, MathUtils, Quaternion, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useGameStore } from '../../store/gameStore.js'
import { PLAYER_RUN_SPEED, PLAYER_SPEED_BOOST, PLAYER_WALK_SPEED } from '../config.js'
import { isWavingInPhoto } from '../Map/styles/bk_photoRoom.js'
import { usePlayerCharacter } from './characterStore.js'
import { createWavePose } from './wavePose.js'

function Placeholder() {
  return <mesh castShadow>
    <capsuleGeometry args={[.3, 1, 8, 16]} />
    <meshStandardMaterial color="#697c91" />
  </mesh>
}

class ModelBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('[character] 모델을 불러오지 못했습니다.', error) }
  render() { return this.state.failed ? <Placeholder /> : this.props.children }
}

const UP = new Vector3(0, 1, 0)

function AnimatedCharacter({ character, playerRef, palaceSeat }) {
  const { scene, animations } = useGLTF(import.meta.env.BASE_URL + character.model)
  const model = useMemo(() => {
    const object = clone(scene)
    object.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Baked animated bounds differ from the bind pose, especially at the feet.
        child.frustumCulled = false
      }
    })
    object.name = 'player-character-model'
    const sitClip = animations.find(clip => clip.name === 'Sit')
    if (sitClip) {
      const sampler = new AnimationMixer(object)
      const action = sampler.clipAction(sitClip).setLoop(LoopOnce, 1).play()
      action.clampWhenFinished = true
      sampler.setTime(sitClip.duration)
      object.updateMatrixWorld(true)
      object.userData.seatHipHeight = object.getObjectByName('Hips').getWorldPosition(new Vector3()).y - .06
      object.userData.sitDuration = sitClip.duration
      sampler.stopAllAction()
      sampler.uncacheRoot(object)
    }
    return object
  }, [scene, animations])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const wave = useMemo(() => createWavePose(model, character.id), [model, character.id])
  const actions = useRef(null)
  const speed = useRef(0)
  const phase = useRef(0)
  const airborne = useRef(false)
  const palacePose = useMemo(() => ({
    position: new Vector3(), parentRotation: new Quaternion(), rotation: new Quaternion(), applied: false,
  }), [])
  const weight = useRef({ Idle: 1, Walk: 0, Run: 0, Jump: 0, Sit: 0 })

  useEffect(() => {
    const next = {}
    for (const name of ['Idle', 'Walk', 'Run', 'Jump', 'Sit']) {
      const clip = animations.find(clip => clip.name === name)
      if (!clip) throw new Error(`Missing character animation: ${name}`)
      next[name] = mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play()
      next[name].setEffectiveWeight(name === 'Idle' ? 1 : 0)
    }
    next.Sit.setEffectiveTimeScale(0)
    next.Jump.setLoop(LoopOnce, 1)
    next.Jump.clampWhenFinished = true
    airborne.current = false
    actions.current = next
    speed.current = 0
    phase.current = 0
    weight.current = { Idle: 1, Walk: 0, Run: 0, Jump: 0, Sit: 0 }
    return () => {
      actions.current = null
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    }
  }, [animations, mixer, model])

  useFrame(({ clock }, delta) => {
    const current = actions.current
    const player = playerRef.current
    if (!current || !player) return
    const dt = Math.min(delta, .05)
    const riding = player.body?.isKinematic()
    const moving = !riding && !useGameStore.getState().inputLocked && player.isOnGround
    speed.current = MathUtils.damp(speed.current, moving ? player.moveSpeed : 0, 12, dt)
    const velocity = speed.current
    const walk = MathUtils.smoothstep(velocity, .08, .65)
    const run = MathUtils.smoothstep(velocity, PLAYER_WALK_SPEED + .15, PLAYER_RUN_SPEED - .5)
    const inAir = !riding && !player.isOnGround
    if (inAir && !airborne.current) current.Jump.reset().play()
    airborne.current = inAir
    let target = inAir
      ? { Idle: 0, Walk: 0, Run: 0, Jump: 1, Sit: 0 }
      : { Idle: 1 - walk, Walk: walk * (1 - run), Run: walk * run, Jump: 0, Sit: 0 }
    if (palaceSeat && model.parent) {
      const [x, , z] = palaceSeat.position
      palacePose.position.set(x, palaceSeat.surfaceY - (model.userData.seatHipHeight ?? 0.45), z)
      model.position.copy(model.parent.worldToLocal(palacePose.position))
      model.parent.getWorldQuaternion(palacePose.parentRotation)
      palacePose.rotation.setFromAxisAngle(UP, palaceSeat.yaw)
      model.quaternion.copy(palacePose.parentRotation.invert()).multiply(palacePose.rotation)
      palacePose.applied = true
    } else if (palacePose.applied) {
      model.position.set(0, -1, 0)
      model.quaternion.identity()
      palacePose.applied = false
    }
    const seatProgress = palaceSeat ? 1 : model.userData.seatProgress ?? 0
    if (seatProgress > 0) target = { Idle: 0, Walk: 0, Run: 0, Jump: 0, Sit: 1 }
    current.Sit.time = Math.min(seatProgress * current.Sit.getClip().duration, current.Sit.getClip().duration - .00001)
    for (const name of ['Idle', 'Walk', 'Run', 'Jump', 'Sit']) {
      weight.current[name] = MathUtils.damp(weight.current[name], target[name], 12, dt)
      current[name].setEffectiveWeight(weight.current[name])
    }
    // Keep the same leading foot when blending between clips with different lengths.
    const walkDuration = current.Walk.getClip().duration
    const runDuration = current.Run.getClip().duration
    // 이동은 PLAYER_SPEED_BOOST배 빠르지만 다리는 원래 속도의 박자로 (발이 미끄러져 보이는 대신 동작이 차분)
    const walkRate = velocity / PLAYER_SPEED_BOOST / character.gaitSpeed.Walk / walkDuration
    const runRate = velocity / PLAYER_SPEED_BOOST / character.gaitSpeed.Run / runDuration
    phase.current = (phase.current + dt * MathUtils.lerp(walkRate, runRate, run)) % 1
    current.Walk.setEffectiveTimeScale(0)
    current.Run.setEffectiveTimeScale(0)
    current.Walk.time = phase.current * walkDuration
    current.Run.time = phase.current * runDuration
    wave?.reset()
    mixer.update(dt)
    wave?.updatePhoto(isWavingInPhoto(), clock.elapsedTime, dt)
  })

  // ecctrl's floating capsule rests 1m above the ground (.5 + .3 + .2).
  // Blender -Y forward becomes glTF +Z, matching ecctrl's bodyZAxis.
  return <primitive object={model} position={[0, -1, 0]} dispose={null} />
}

export default function CharacterModel({ playerRef, palaceSeat }) {
  const { character } = usePlayerCharacter()
  return <ModelBoundary key={character.id}>
    <Suspense fallback={<Placeholder />}>
      <AnimatedCharacter character={character} playerRef={playerRef} palaceSeat={palaceSeat} />
    </Suspense>
  </ModelBoundary>
}
