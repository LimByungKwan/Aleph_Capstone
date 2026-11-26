import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, LoopRepeat, MathUtils, Quaternion, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import characters from '@shared/characters.json'
import { playerPose } from '../../../store/playerPose.js'

// 팬 문화 소품 거리의 손 흔드는 팬 (style: "fanWaver", sg_kpop.json의 item.character = male|female). 담당: 성근(SG)
// - 플레이어와 같은 캐릭터 GLB를 복제해 Idle만 틀고, 가까이 오면 그쪽을 보며 오른손을 흔듦
// - GLB에 손 흔들기 클립이 없어서 Idle 위에 팔 뼈를 코드로 돌림
//   뼈마다 축 방향이 달라도 되게, 월드 좌표에서 "어깨→팔꿈치", "팔꿈치→손목"이 원하는 방향을 보도록 회전을 더함

const NEAR_DIST = 5 // 이 안에 들어오면 돌아보고 손 흔듦
const UP = new Vector3(0, 1, 0)
const PALM = new Vector3(0, 0, 1) // RightHand 뼈 기준 손바닥이 보는 축 (11/26 Chrome 화면으로 확인)

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
  const bones = useMemo(() => {
    const get = (name) => model.getObjectByName(name)
    return { shoulder: get('RightShoulder'), arm: get('RightArm'), fore: get('RightForeArm'), hand: get('RightHand') }
  }, [model])
  const root = useRef(null)
  const wave = useRef(0) // 0~1, 손 흔드는 정도 (부드럽게 올리고 내림)
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), side: new Vector3(), want: new Vector3(), q: new Quaternion(), pq: new Quaternion(), wq: new Quaternion(), me: new Vector3() }), [])

  useEffect(() => {
    const idle = animations.find((clip) => clip.name === 'Idle')
    if (idle) mixer.clipAction(idle).setLoop(LoopRepeat, Infinity).play()
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    }
  }, [animations, mixer, model])

  // bone이 child 쪽으로 향하는 방향을 want 쪽으로 amount만큼 돌림 (월드 기준 → bone의 local 회전으로 바꿔 넣음)
  const aim = (bone, child, want, amount) => {
    bone.getWorldPosition(tmp.a)
    child.getWorldPosition(tmp.b)
    const now = tmp.b.sub(tmp.a).normalize()
    tmp.want.copy(now).lerp(want, amount).normalize()
    tmp.q.setFromUnitVectors(now, tmp.want)
    bone.getWorldQuaternion(tmp.wq)
    bone.parent.getWorldQuaternion(tmp.pq)
    bone.quaternion.copy(tmp.pq.invert().multiply(tmp.q.multiply(tmp.wq)))
    bone.updateMatrixWorld(true)
  }

  // 아래팔을 자기 길이 방향 축으로 비틀어, 손바닥(PALM)이 face 쪽을 보게 함
  const twist = (fore, hand, face, amount) => {
    fore.getWorldPosition(tmp.a)
    hand.getWorldPosition(tmp.b)
    const axis = tmp.b.sub(tmp.a).normalize()
    hand.getWorldQuaternion(tmp.wq)
    const palm = tmp.want.copy(PALM).applyQuaternion(tmp.wq)
    palm.addScaledVector(axis, -palm.dot(axis)).normalize()
    const goal = tmp.side.copy(face).addScaledVector(axis, -face.dot(axis)).normalize()
    const angle = Math.atan2(axis.dot(new Vector3().crossVectors(palm, goal)), palm.dot(goal)) * amount
    tmp.q.setFromAxisAngle(axis, angle)
    fore.getWorldQuaternion(tmp.wq)
    fore.parent.getWorldQuaternion(tmp.pq)
    fore.quaternion.copy(tmp.pq.invert().multiply(tmp.q.multiply(tmp.wq)))
    fore.updateMatrixWorld(true)
  }

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

    mixer.update(dt)
    const w = wave.current
    const { shoulder, arm, fore, hand } = bones
    if (w < 0.01 || !shoulder || !arm || !fore || !hand) return
    model.updateMatrixWorld(true)
    // 몸 바깥쪽(어깨→팔 방향)을 조금 섞어 팔을 옆으로 비스듬히 듦
    shoulder.getWorldPosition(tmp.a)
    arm.getWorldPosition(tmp.side)
    tmp.side.sub(tmp.a).setY(0).normalize()
    const upper = new Vector3().copy(UP).multiplyScalar(0.55).addScaledVector(tmp.side, 0.85).normalize()
    aim(arm, fore, upper, w)
    // 아래팔은 위를 향하고 좌우로 까딱 (초당 약 1.6번)
    const swing = Math.sin(state.clock.elapsedTime * 10) * 0.45
    const lower = new Vector3().copy(UP).addScaledVector(tmp.side, swing).normalize()
    aim(fore, hand, lower, w)
    twist(fore, hand, new Vector3(dx, 0, dz).normalize(), w) // 손바닥은 다가온 플레이어 쪽으로
  })

  return (
    <group ref={root}>
      <primitive object={model} dispose={null} />
    </group>
  )
}
