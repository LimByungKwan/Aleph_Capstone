import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, LoopRepeat, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

function LoadingGuide() {
  return <mesh position={[0, .85, 0]}><capsuleGeometry args={[.35, 1, 8, 16]} /><meshStandardMaterial color="#6574a3" /></mesh>
}

class GuideBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('[Lumi] Model loading failed', error) }
  render() { return this.state.failed ? <LoadingGuide /> : this.props.children }
}

function AnimatedGuide({ path }) {
  const { scene, animations } = useGLTF(import.meta.env.BASE_URL + path.replace(/^\//, ''))
  const group = useRef()
  const elapsed = useRef(0)
  const model = useMemo(() => {
    const result = clone(scene)
    result.traverse(object => {
      if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false }
    })
    return result
  }, [scene])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const actions = useRef(null)
  const greetingPose = useMemo(() => ({
    hands: ['LeftHand', 'RightHand'].map(name => model.getObjectByName(name)),
    head: model.getObjectByName('Head'),
    handPosition: new Vector3(), headPosition: new Vector3(),
  }), [model])
  useEffect(() => {
    const idle = mixer.clipAction(animations.find(clip => clip.name === 'Idle')).play()
    const greeting = mixer.clipAction(animations.find(clip => clip.name === 'Greeting')).setLoop(LoopRepeat, Infinity).play()
    greeting.setEffectiveWeight(0)
    elapsed.current = 0
    actions.current = { idle, greeting }
    return () => { actions.current = null; mixer.stopAllAction(); mixer.uncacheRoot(model) }
  }, [animations, mixer, model])
  useFrame((_, delta) => {
    if (!actions.current) return
    elapsed.current += delta
    const { idle, greeting } = actions.current
    const duration = greeting.getClip().duration
    const cycle = duration + 2
    const time = elapsed.current % cycle
    // Greet, lower the hand, then pause briefly before greeting the next direction.
    const weight = time < duration ? Math.min(1, time / .3, (duration - time) / .4) : 0
    idle.setEffectiveWeight(1 - weight)
    greeting.setEffectiveWeight(weight)
    greeting.setEffectiveTimeScale(0)
    greeting.time = Math.min(time, duration - .00001)
    mixer.update(Math.min(delta, .1))
    // The supplied clip raises the arm. Add a gentle wrist wave only while raised.
    model.updateWorldMatrix(true, true)
    greetingPose.head.getWorldPosition(greetingPose.headPosition)
    for (const hand of greetingPose.hands) {
      hand.getWorldPosition(greetingPose.handPosition)
      if (greetingPose.handPosition.y > greetingPose.headPosition.y - .15) {
        hand.rotateZ(Math.sin(time * 9) * .16 * weight)
      }
    }
    // Rotation only: Lumi stays at the guide marker's fixed world position.
    group.current.rotation.y = elapsed.current * Math.PI / 16
  })
  return <group ref={group}><primitive object={model} dispose={null} /></group>
}

export default function LumiGuide({ path }) {
  return <GuideBoundary><Suspense fallback={<LoadingGuide />}><AnimatedGuide path={path} /></Suspense></GuideBoundary>
}
