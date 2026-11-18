import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { useJmActivity } from './jm_activityStore.js'

// 앉을 수 있는 벤치 (애니메이션 구역 전용) — 담당: 지민
//
// 벤치 앞(앉는 쪽, 로컬 +z) 가까이에서 E → 캐릭터가 벤치에 앉음 (카메라는 벤치가 보는 쪽으로) → E 또는 ESC로 일어남
// 겉모습은 공용 bench와 같게 그림 (공용 props.jsx는 고치지 않음)
//
// 앉는 모션을 공용 Player.jsx를 안 고치고 만드는 방법:
// - 이동은 gameStore.open(...)으로 잠금 (다른 체험과 같은 방식, ESC는 공용 InteractionKeys가 처리)
// - 물리 몸(캡슐 충돌)은 그 자리에 두고, 눈에 보이는 캐릭터 모델만 벤치 자리로 옮겨 앉은 자세(조금 낮추고 눌러 앉힘 + 살짝 뒤로 기댐)로 바꿈
// - 일어나면 모델을 원래 자리·크기로 되돌림 → 1인칭(모델 숨김)에서도 문제없음
// - 나중에 캐릭터가 GLB로 바뀌어도 모델 묶음 전체를 옮기는 방식이라 그대로 동작

const SIT_NEAR = 1.7 // 앉는 자리에서 이 거리 안이면 "E 앉기"
const SEAT_Y = 0.48 // 앉는 판 높이
const SIT_TIME = 0.45 // 앉기/일어나기 동작 시간(초)
const SIT_SCALE_Y = 0.66 // 앉으면 몸이 접힌 것처럼 세로로 줄임
const LEAN = THREE.MathUtils.degToRad(-8) // 등받이 쪽으로 살짝 기댐
const METAL = '#2b2d30'
const WOOD = '#9a6b45'

// 캐릭터 겉모습 묶음 찾기: player 아래에서 캡슐 모양 메시의 부모(PlayerModel 그룹)
function findModel(player) {
  let found = null
  player?.traverse((o) => {
    if (!found && o.isMesh && o.geometry?.type === 'CapsuleGeometry') found = o.parent
  })
  return found
}

const ease = (t) => t * t * (3 - 2 * t)

export function JmBench({ item }) {
  const [w, , d] = item.size
  const scene = useThree((state) => state.scene)
  const getState = useThree((state) => state.get)
  const anchor = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  // 앉기 상태: phase 'sitting' | 'standing' | null, t = 동작 진행(0~1), model = 옮기는 모델, saved = 원래 위치
  const sit = useRef({ phase: null, t: 0, model: null, saved: null })
  const tmp = useMemo(
    () => ({
      seat: new THREE.Vector3(),
      front: new THREE.Vector3(),
      me: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      m: new THREE.Matrix4(),
      inv: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      lq: new THREE.Quaternion(),
      tq: new THREE.Quaternion(),
      e: new THREE.Euler(),
    }),
    [],
  )

  // 벤치 자리(월드): 앉는 판 가운데, 앞쪽 방향
  function updateSeat() {
    const a = anchor.current
    a.localToWorld(tmp.seat.set(0, SEAT_Y, 0.02))
    a.getWorldQuaternion(tmp.q)
    tmp.front.set(0, 0, 1).applyQuaternion(tmp.q)
  }

  function sitDown() {
    const model = findModel(player.current)
    const s = sit.current
    if (model && !s.model) {
      s.model = model
      s.saved = { p: model.position.clone(), q: model.quaternion.clone(), s: model.scale.clone() }
    }
    s.phase = 'sitting'
    s.t = 0
    // 카메라: 앉은 캐릭터 뒤에서 벤치가 보는 쪽을 바라보게
    updateSeat()
    const controls = getState().controls
    if (controls?.rotateTo) controls.rotateTo(Math.atan2(-tmp.front.x, -tmp.front.z), 1.25, true)
  }

  function restoreModel() {
    const s = sit.current
    if (s.model && s.saved) {
      s.model.position.copy(s.saved.p)
      s.model.quaternion.copy(s.saved.q)
      s.model.scale.copy(s.saved.s)
    }
    s.model = null
    s.saved = null
    s.phase = null
  }

  // 키: E로 앉기 / 앉은 상태에서 E로 일어나기
  useEffect(() => {
    const down = (event) => {
      if (event.repeat || event.code !== 'KeyE') return
      const st = useJmActivity.getState().sit
      const game = useGameStore.getState()
      if (st.active === item.id) {
        if (game.openPanel?.placeId === item.id) game.close()
        return
      }
      if (st.near === item.id && !st.active && !game.openPanel && !game.nearbyPlaceId) {
        useJmActivity.getState().setSit({ active: item.id })
        game.open({ type: 'jm_sit', placeId: item.id })
        sitDown()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
    // sitDown은 ref만 씀
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // 패널이 닫히면(ESC 또는 E) 일어남
  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        const st = useJmActivity.getState().sit
        if (st.active === item.id && state.openPanel?.placeId !== item.id) {
          useJmActivity.getState().setSit({ active: null })
          if (sit.current.phase) {
            sit.current.phase = 'standing'
            sit.current.t = 0
          }
        }
      }),
    [item.id],
  )

  // 화면을 떠나면(구역 다시 그림 등) 모델을 원래대로
  useEffect(() => () => restoreModel(), [])

  useFrame(({ clock }, delta) => {
    if (!anchor.current) return
    const t = clock.elapsedTime
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    const p = player.current?.parent ? player.current : null
    const store = useJmActivity.getState()
    const st = store.sit
    const s = sit.current

    // 가까운 벤치 하나만 "E 앉기" (벤치가 여러 개 붙어 있어도 안내가 번갈아 바뀌지 않게)
    if (p && !st.active) {
      updateSeat()
      p.getWorldPosition(tmp.me)
      // 앉는 자리 바로 앞(0.5m)을 기준으로 거리 → 등 뒤에서는 안내 안 뜸
      tmp.p.copy(tmp.seat).addScaledVector(tmp.front, 0.5)
      const dist = Math.hypot(tmp.me.x - tmp.p.x, tmp.me.z - tmp.p.z)
      const ahead = (tmp.me.x - tmp.seat.x) * tmp.front.x + (tmp.me.z - tmp.seat.z) * tmp.front.z
      const near = dist < SIT_NEAR && ahead > -0.1 && Math.abs(tmp.me.y - tmp.seat.y) < 1.8
      if (near) {
        if (st.near === item.id) {
          if (Math.abs(st.nearDist - dist) > 0.2) store.setSit({ nearDist: dist })
        } else if (st.near === null || dist < st.nearDist - 0.2) {
          store.setSit({ near: item.id, nearDist: dist })
        }
      } else if (st.near === item.id) {
        store.setSit({ near: null, nearDist: Infinity })
      }
    }

    // 앉기/일어나기 동작: 원래 자리(로컬) ↔ 벤치 자리(월드 → 부모 로컬로 바꿈) 사이를 부드럽게
    if (s.phase && s.model && s.model.parent) {
      s.t = Math.min(1, s.t + delta / SIT_TIME)
      const k = ease(s.phase === 'sitting' ? s.t : 1 - s.t)
      updateSeat()
      // 앉은 자세의 월드 변환: 판 위에 몸 아래쪽이 닿게(캡슐 키 1.6 × 0.66 / 2), 벤치 방향 + 살짝 기댐
      const yaw = Math.atan2(tmp.front.x, tmp.front.z)
      tmp.tq.setFromEuler(tmp.e.set(LEAN, yaw, 0, 'YXZ'))
      tmp.p.copy(tmp.seat).addScaledVector(tmp.front, 0.05)
      tmp.p.y += 0.8 * SIT_SCALE_Y - 0.05
      tmp.m.compose(tmp.p, tmp.tq, tmp.s.set(1, SIT_SCALE_Y, 1))
      s.model.parent.updateWorldMatrix(true, false)
      tmp.inv.copy(s.model.parent.matrixWorld).invert()
      tmp.m.premultiply(tmp.inv)
      tmp.m.decompose(tmp.p, tmp.lq, tmp.s)
      s.model.position.lerpVectors(s.saved.p, tmp.p, k)
      s.model.quaternion.slerpQuaternions(s.saved.q, tmp.lq, k)
      s.model.scale.lerpVectors(s.saved.s, tmp.s, k)
      if (s.phase === 'standing' && s.t >= 1) restoreModel()
    } else if (s.phase === 'sitting' && !s.model) {
      // 1인칭이라 모델이 없으면 다음에 다시 찾아봄
      const model = findModel(player.current)
      if (model) {
        s.model = model
        s.saved = { p: model.position.clone(), q: model.quaternion.clone(), s: model.scale.clone() }
        s.t = 0
      }
    } else if (s.phase === 'standing') {
      restoreModel()
    }
  })

  return (
    <>
      <group ref={anchor} />
      {/* 공용 bench와 같은 모양 */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[w, 0.06, d * 0.8]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <mesh position={[0, 0.72, -d * 0.4]}>
        <boxGeometry args={[w, 0.4, 0.05]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * (w / 2 - 0.15), 0.22, 0]}>
          <boxGeometry args={[0.06, 0.45, d * 0.7]} />
          <meshStandardMaterial color={METAL} />
        </mesh>
      ))}
      <SitHud benchId={item.id} />
    </>
  )
}

function SitHud({ benchId }) {
  const st = useJmActivity((state) => state.sit)
  const busy = useJmActivity((state) => Boolean(state.shoot.active || state.skip.active))
  // 촬영지 감지 원 안이면 E는 공용 촬영지 패널이 씀 → 앉기 안내를 띄우지 않음 (안내와 실제 동작이 어긋나지 않게)
  const placeNear = useGameStore((state) => Boolean(state.nearbyPlaceId))
  const size = useThree((state) => state.size)
  const showHint = st.near === benchId && !st.active && !busy && !placeNear
  const active = st.active === benchId
  if (!showHint && !active) return null
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ ...wrap, width: size.width, height: size.height }}>
        <div style={chip}>
          <kbd style={kbd}>E</kbd> {active ? '일어나기' : '벤치에 앉기'}
          {active && <span style={{ opacity: 0.75 }}> · 잠깐 쉬어 가요 · ESC도 가능</span>}
        </div>
      </div>
    </Html>
  )
}

const wrap = { position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }

export const JM_BENCH_STYLES = { jmBench: JmBench }
