import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, useFilterContactPair, useRapier } from '@react-three/rapier'
import { AnimationMixer, LoopOnce, LoopRepeat, MathUtils } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import characters from '@shared/characters.json'
import {
  PLAYER_CAPSULE_HALF_HEIGHT,
  PLAYER_CAPSULE_RADIUS,
  PLAYER_RUN_SPEED,
  PLAYER_SPEED_BOOST,
  PLAYER_WALK_SPEED,
} from '../config.js'
import { labelLayer } from '../labelLayer.js'
import { ChatBubbleBox, useChatBubble } from './ChatBubble.jsx'
import { isWavingInPhoto } from '../Map/styles/bk_photoRoom.js'
import { createWavePose } from '../Player/wavePose.js'
import { useRealtimeStore } from './realtimeStore.js'
import { useRemoteSeats } from '../../components/movieZone/hjSync.js' // [혜진] 다른 사람이 앉아 있으면 앉은 자세로
import { findSeatById } from '../../components/movieZone/rideSeats.js' // [혜진] 탈것 좌석에 앉은 사람은 그 좌석에 붙여 그림

// [지민] 다른 사람 캐릭터 1명
// - 위치는 서버에서 0.1초마다 오므로, 그 사이를 부드럽게 따라가게(보간) 그림 → 뚝뚝 끊겨 보이지 않음
// - 애니메이션은 받은 속도로 고름 (서 있기 / 걷기 / 뛰기 / 점프). 내 캐릭터(Player/CharacterModel.jsx)와 같은 모델
// - 너무 멀리 떨어진 순간이동(리스폰 등)은 따라가지 않고 바로 옮김

const FOLLOW = 12 // 클수록 빨리 따라감
const TELEPORT = 8 // m 이상 차이 나면 바로 이동
const CLIPS = ['Idle', 'Walk', 'Run', 'Jump']
const CAPSULE_ARGS = [PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS]
const CONTACT_PREDICTION = 0.2 // 마주 달릴 때 다음 물리 스텝의 접촉을 미리 계산
const REMOTE_BODY_DATA = { ecctrl: { excludeRay: true } } // 지면 및 차량 바퀴 레이캐스트에서 제외

function shortestAngle(from, to) {
  return from + (((to - from + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI
}

function Placeholder() {
  return (
    <mesh position={[0, -0.2, 0]}>
      <capsuleGeometry args={[PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HALF_HEIGHT * 2, 8, 16]} />
      <meshStandardMaterial color="#8a9bb0" />
    </mesh>
  )
}

class ModelBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <Placeholder /> : this.props.children
  }
}

function RemoteModel({ id, character }) {
  const { scene, animations } = useGLTF(import.meta.env.BASE_URL + character.model)
  const model = useMemo(() => {
    const object = clone(scene)
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.frustumCulled = false
      }
    })
    return object
  }, [scene])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const wave = useMemo(() => createWavePose(model, character.id), [model, character.id])
  const actions = useRef(null)
  const weight = useRef({ Idle: 1, Walk: 0, Run: 0, Jump: 0 })
  const airborne = useRef(false)

  useEffect(() => {
    const next = {}
    for (const name of CLIPS) {
      const clip = animations.find((c) => c.name === name)
      if (!clip) continue
      next[name] = mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play()
      next[name].setEffectiveWeight(name === 'Idle' ? 1 : 0)
    }
    if (next.Jump) {
      next.Jump.setLoop(LoopOnce, 1)
      next.Jump.clampWhenFinished = true
    }
    // [혜진] 앉은 자세: Sit 동작의 마지막 장면에 멈춰 둠
    const sitClip = animations.find((c) => c.name === 'Sit')
    if (sitClip) {
      next.Sit = mixer.clipAction(sitClip).setLoop(LoopOnce, 1).play()
      next.Sit.clampWhenFinished = true
      next.Sit.setEffectiveWeight(0)
    }
    actions.current = next
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    }
  }, [animations, mixer, model])

  useFrame(({ clock }, delta) => {
    const current = actions.current
    const state = useRealtimeStore.getState().peers[id]?.state
    if (!current || !state) return
    const dt = Math.min(delta, 0.05)
    const [, , , , speed, onGround] = state
    const inAir = !onGround
    if (inAir && !airborne.current) current.Jump?.reset().play()
    airborne.current = inAir
    const walk = MathUtils.smoothstep(speed, 0.08, 0.65)
    const run = MathUtils.smoothstep(speed, PLAYER_WALK_SPEED + 0.15, PLAYER_RUN_SPEED - 0.5)
    // [혜진] 앉아 있으면(hj.sit) 다른 동작은 끄고 앉은 자세 + 좌판 높이에 맞춰 내려 앉힘
    const sit = useRemoteSeats.getState().seats[id]
    let target = inAir ? { Idle: 0, Walk: 0, Run: 0, Jump: 1 } : { Idle: 1 - walk, Walk: walk * (1 - run), Run: walk * run, Jump: 0 }
    if (sit && current.Sit) {
      target = { Idle: 0, Walk: 0, Run: 0, Jump: 0 }
      current.Sit.time = current.Sit.getClip().duration - 0.00001
    }
    weight.current.Sit = MathUtils.damp(weight.current.Sit ?? 0, sit && current.Sit ? 1 : 0, 12, dt)
    current.Sit?.setEffectiveWeight(weight.current.Sit)
    model.position.y = sit && current.Sit ? -(sit.h ?? 0.91) - (model.userData.seatHipHeight ?? 0.45) : -1
    for (const name of CLIPS) {
      if (!current[name]) continue
      weight.current[name] = MathUtils.damp(weight.current[name], target[name], 10, dt)
      current[name].setEffectiveWeight(weight.current[name])
    }
    // 내 캐릭터(CharacterModel)와 같게: 이동은 빠르지만 다리는 원래 속도의 박자로 (11/26 SG, 혜진님 확인)
    current.Walk?.setEffectiveTimeScale(Math.max(speed / PLAYER_SPEED_BOOST, 0.3) / character.gaitSpeed.Walk)
    current.Run?.setEffectiveTimeScale(Math.max(speed / PLAYER_SPEED_BOOST, 0.3) / character.gaitSpeed.Run)
    wave?.reset()
    mixer.update(dt)
    const waving = state.length > 6 ? state[6] === 1 : isWavingInPhoto(id)
    wave?.updatePhoto(waving, clock.elapsedTime, dt)
  })

  // 내 캐릭터와 같은 기준: 받은 위치는 캡슐 중심(땅에서 1m 위)
  return <primitive object={model} position={[0, -1, 0]} dispose={null} />
}

export default function RemotePlayer({ id, name, characterId, playerRef }) {
  const { rapier } = useRapier()
  const body = useRef(null)
  const group = useRef(null)
  const [initialPose] = useState(() => {
    const [x, y, z, yaw] = useRealtimeStore.getState().peers[id]?.state ?? [0, 0, 0, 0]
    return { position: [x, y, z], rotation: [0, yaw, 0] }
  })
  const teleported = useRef(false)
  const character = characters.find((c) => c.id === characterId) ?? characters[0]
  const chat = useChatBubble(id) // [지민] 말풍선 채팅

  useFilterContactPair((_, __, first, second) => {
    const remote = body.current?.handle
    if (first !== remote && second !== remote) return null
    // 원격 캐릭터는 내 캐릭터에만 물리 힘을 가함 (탈것 등에는 영향 없음).
    const other = first === remote ? second : first
    return other === playerRef.current?.body.handle ? rapier.SolverFlags.COMPUTE_IMPULSE : rapier.SolverFlags.EMPTY
  })

  useBeforePhysicsStep((world) => {
    const rigidBody = body.current
    const state = useRealtimeStore.getState().peers[id]?.state
    if (!rigidBody || !state) return
    const [x, y, z] = state
    const position = rigidBody.translation()
    if (Math.abs(position.x - x) + Math.abs(position.y - y) + Math.abs(position.z - z) > TELEPORT) {
      const destination = { x, y, z }
      rigidBody.setTranslation(destination, true)
      rigidBody.setNextKinematicTranslation(destination)
      teleported.current = true
      return
    }
    rigidBody.setNextKinematicTranslation({
      x: MathUtils.damp(position.x, x, FOLLOW, world.timestep),
      y: MathUtils.damp(position.y, y, FOLLOW, world.timestep),
      z: MathUtils.damp(position.z, z, FOLLOW, world.timestep),
    })
  })

  useFrame((_, delta) => {
    const g = group.current
    const state = useRealtimeStore.getState().peers[id]?.state
    if (!g || !state) return
    // [혜진] 앉아 있으면 자리 방향을 바라봄
    const sit = useRemoteSeats.getState().seats[id]
    // [혜진] 자동차·기차·열기구 같은 움직이는 탈것: 받은 위치(0.1초 간격 + 따라가기)는 차보다 늦어서 차 밖에 앉아 보여요.
    // 이 화면의 같은 좌석 위치를 찾아 모델을 그 자리에 딱 붙이고, 좌석이 바라보는 방향(차가 돌면 같이 돌아요)을 써요
    const rideSeat = sit ? findSeatById(sit.seat) : null
    const p = body.current?.translation()
    if (rideSeat && p) g.position.set(rideSeat.position[0] - p.x, rideSeat.position[1] - p.y, rideSeat.position[2] - p.z)
    else if (g.position.x || g.position.y || g.position.z) g.position.set(0, 0, 0)
    const faceYaw = rideSeat ? rideSeat.yaw : sit && Number.isFinite(sit.r) ? sit.r : state[3]
    g.rotation.y = teleported.current || rideSeat
      ? faceYaw
      : MathUtils.damp(g.rotation.y, shortestAngle(g.rotation.y, faceYaw), FOLLOW, Math.min(delta, 0.1))
    teleported.current = false
  })

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={initialPose.position}
      softCcdPrediction={CONTACT_PREDICTION}
      userData={REMOTE_BODY_DATA}
      name={`remote-player-${id}`}
    >
      <CapsuleCollider
        ref={(collider) => collider?.setActiveHooks(rapier.ActiveHooks.FILTER_CONTACT_PAIRS)}
        args={CAPSULE_ARGS}
        friction={0}
        frictionCombineRule={rapier.CoefficientCombineRule.Multiply}
      />
      <group ref={group} rotation={initialPose.rotation}>
        <ModelBoundary key={character.id}>
          <Suspense fallback={<Placeholder />}>
            <RemoteModel id={id} character={character} />
          </Suspense>
        </ModelBoundary>
        {/* 머리 위 이름표 (다른 이름표들과 같은 HTML 층에 그림) */}
        <Html portal={labelLayer} position={[0, 1.05, 0]} center style={{ pointerEvents: 'none' }}>
          {/* 말풍선은 이름표 위로 (이름표 자리는 그대로 두려고 아래 기준으로 위로 쌓음) */}
          {chat && (
            <div style={{ position: 'absolute', left: '50%', bottom: '100%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: 220 }}>
              <ChatBubbleBox text={chat} />
            </div>
          )}
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.88)',
              color: '#3b3128',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            }}
          >
            {name}
          </div>
        </Html>
      </group>
    </RigidBody>
  )
}
