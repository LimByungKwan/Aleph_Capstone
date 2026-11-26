import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, LoopRepeat, MathUtils, Quaternion, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import characters from '@shared/characters.json'
import { playerPose } from '../../../store/playerPose.js'
import { createWavePose } from '../../Player/wavePose.js'

// 팬 문화 소품 거리의 손 흔드는 팬 (style: "fanWaver", sg_kpop.json의 item.character = male|female). 담당: 성근(SG)
// - 플레이어와 같은 캐릭터 GLB를 복제해 Idle만 틀고, 가까이 오면 그쪽을 보며 오른손을 흔듦
// - GLB에 손 흔들기 클립이 없어서 Idle 위에 팔 뼈를 코드로 돌림
//   뼈마다 축 방향이 달라도 되게, 월드 좌표에서 "어깨→팔꿈치", "팔꿈치→손목"이 원하는 방향을 보도록 회전을 더함

const NEAR_DIST = 5 // 이 안에 들어오면 돌아보고 손 흔듦

export function SgFanNpc({ item }) {
  const character = characters.find((c) => c.id === item.character) ?? characters[0]
  return (
    <Suspense fallback={null}>
      <Waver url={import.meta.env.BASE_URL + character.model} />
    </Suspense>
  )
}

function Waver({ url }) {
  const { scene, animations } = useGLTF(url)
  const model = useMemo(() => {
    const object = clone(scene)
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.frustumCulled = false // 애니메이션으로 움직인 팔이 원래 경계 밖으로 나가도 안 사라지게
      }
    })
    return object
  }, [scene])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const wavePose = useMemo(() => createWavePose(model), [model])
  const root = useRef(null)
  const wave = useRef(0) // 0~1, 손 흔드는 정도 (부드럽게 올리고 내림)
  const tmp = useMemo(() => ({ face: new Vector3(), pq: new Quaternion(), me: new Vector3() }), [])

  useEffect(() => {
    const idle = animations.find((clip) => clip.name === 'Idle')
    if (idle) mixer.clipAction(idle).setLoop(LoopRepeat, Infinity).play()
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    }
  }, [animations, mixer, model])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const group = root.current
    if (!group) return
    group.getWorldPosition(tmp.me)
    const dx = playerPose.x - tmp.me.x
    const dz = playerPose.z - tmp.me.z
    const near = playerPose.ready && Math.hypot(dx, dz) < NEAR_DIST
    wave.current = MathUtils.damp(wave.current, near ? 1 : 0, 4, dt)

    // 가까우면 플레이어 쪽으로 몸을 돌림 (모델 앞은 +Z). 부모(건물 배치)의 회전을 빼서 local 각도로
    if (near) {
      group.parent.getWorldQuaternion(tmp.pq)
      const parentYaw = 2 * Math.atan2(tmp.pq.y, tmp.pq.w)
      const target = Math.atan2(dx, dz) - parentYaw
      const diff = Math.atan2(Math.sin(target - group.rotation.y), Math.cos(target - group.rotation.y))
      group.rotation.y += diff * Math.min(1, dt * 5)
    }

    wavePose?.reset()
    mixer.update(dt)
    if (wave.current >= 0.01) wavePose?.apply(state.clock.elapsedTime, wave.current, tmp.face.set(dx, 0, dz).normalize())
  })

  return (
    <group ref={root}>
      <primitive object={model} dispose={null} />
    </group>
  )
}
