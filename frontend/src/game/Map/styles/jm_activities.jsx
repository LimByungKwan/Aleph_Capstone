import { useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { SHOOT_GOAL, useJmActivity } from './jm_activityStore.js'

// 애니메이션 구역(JM) 체험: 농구 슛. 담당: 지민
//
// 골대(jmHoop) 앞 코트에서 E → 슛 모드 (캐릭터 멈춤) → Space 꾹 눌러 힘 조절 → 떼면 슛 → ESC로 나감
// SHOOT_GOAL골 넣으면 체험 완료.
//
// 왜 물리 엔진(rapier)을 안 쓰고 직접 계산하나:
// - 골대는 맵 스타일(MapLayout)이라 <Physics> 밖에서 그려짐 → 공용 Scene.jsx를 고쳐야 rapier를 쓸 수 있음
// - 공 1개 + 림(원) + 백보드(판) + 바닥만 계산하면 돼서 직접 계산이 더 가볍고, 팀 공용 파일을 안 건드림
// - 공은 슛 중에만 존재 → 평소 비용 0

const G = 9.8
const BALL_R = 0.12
const RIM_R = 0.23
const RIM_TUBE = 0.02
const LAUNCH_ANGLE = THREE.MathUtils.degToRad(55)
const NEAR_DIST = 7.5 // 골대에서 이 거리 안 + 코트 쪽이면 슛 가능
const SHOT_TIME = 3.2 // 슛 하나가 끝나기까지(초)
const FIXED_DT = 1 / 240
const FIND_PLAYER_EVERY = 1 // 캐릭터를 다시 찾는 간격(초)

// 힘 게이지 → 속도 배율. 거리 2.5~7m에서 0.42~0.6 근처가 들어가는 힘이 되도록 맞춤
// (같은 계산을 따로 돌려 힘 0~1을 0.02 간격으로 쏴 보고 정함. 1.04: 림 가운데보다 살짝 뒤를 노려야 잘 들어감)
const powerToFactor = (p) => 1.04 + 0.36 * (p - 0.5)

// 골대 정보(월드 좌표)는 JmHoop이 rimY를 넘겨줌
export function HoopShoot({ item, rimY }) {
  const scene = useThree((state) => state.scene)
  const getState = useThree((state) => state.get)
  const getControls = () => getState().controls
  const anchor = useRef(null) // 골대 그룹 안의 빈 그룹 → 월드 좌표 계산용
  const ballRef = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const phase = useRef(0)

  const tmp = useMemo(
    () => ({
      rim: new THREE.Vector3(),
      board: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      me: new THREE.Vector3(),
      q: new THREE.Vector3(),
      d: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
    }),
    [],
  )
  // 지금 날아가는 공 (없으면 null)
  const shot = useRef(null)

  // 키 입력: E(슛 모드), Space(힘 모으기 → 떼면 슛)
  useEffect(() => {
    const down = (event) => {
      if (event.repeat) return
      const s = useJmActivity.getState().shoot
      const game = useGameStore.getState()
      if (event.code === 'KeyE' && s.near === item.id && !s.active && !game.openPanel && !game.nearbyPlaceId) {
        useJmActivity.getState().startShoot(item.id)
        // 캐릭터를 멈추고(ESC로 나가기) — 대화창은 placeId가 places.json에 없어서 뜨지 않음
        game.open({ type: 'jm_shoot', placeId: item.id })
        faceHoop()
      }
      if (event.code === 'Space' && s.active === item.id && !shot.current) {
        phase.current = 0
        useJmActivity.getState().setShoot({ charging: true, power: 0 })
      }
    }
    const up = (event) => {
      const s = useJmActivity.getState().shoot
      if (event.code === 'Space' && s.active === item.id && s.charging) {
        useJmActivity.getState().setShoot({ charging: false })
        launch(s.power)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // launch는 ref만 쓰므로 의존성 없음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // ESC(공용 InteractionKeys)로 패널이 닫히면 슛 모드도 끝냄
  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        const s = useJmActivity.getState().shoot
        if (s.active === item.id && state.openPanel?.placeId !== item.id) useJmActivity.getState().endShoot()
      }),
    [item.id],
  )

  // 슛 모드에 들어가면 3인칭 카메라(공용 CameraControls)를 캐릭터 뒤 → 골대 쪽으로 돌림
  // 공용 FollowCamera.jsx는 고치지 않고, makeDefault로 등록된 controls의 rotateTo만 씀
  function faceHoop() {
    const controls = getControls()
    if (!controls?.rotateTo || !player.current) return
    updateHoopWorld()
    player.current.getWorldPosition(tmp.me)
    const dx = tmp.rim.x - tmp.me.x
    const dz = tmp.rim.z - tmp.me.z
    // camera-controls 각도: 카메라가 대상에서 (sinθ, cosθ) 방향에 있음 → 골대 반대편
    // 위아래 1.4rad: 카메라를 낮춰서 높은 림까지 화면에 들어오게
    controls.rotateTo(Math.atan2(-dx, -dz), 1.4, true)
  }

  function updateHoopWorld() {
    const a = anchor.current
    a.localToWorld(tmp.rim.set(0, rimY, 0.05))
    a.localToWorld(tmp.board.set(0, rimY + 0.4, -0.25))
    a.getWorldQuaternion(tmp.quat)
    tmp.forward.set(0, 0, 1).applyQuaternion(tmp.quat)
  }

  function launch(power) {
    const p = player.current
    if (!p || !anchor.current) return
    updateHoopWorld()
    p.getWorldPosition(tmp.me)
    const start = tmp.me.clone()
    start.y += 0.75
    // 골대 쪽으로 살짝 앞에서 던짐
    const toRim = tmp.rim.clone().sub(start)
    toRim.y = 0
    const d = toRim.length()
    toRim.normalize()
    start.addScaledVector(toRim, 0.3)
    const dist = Math.max(0.5, d - 0.3)
    const dy = tmp.rim.y - start.y
    // 55°로 던졌을 때 림 가운데에 떨어지는 속도: v² = g·d² / (2cos²θ·(d·tanθ − dy))
    const denom = 2 * Math.cos(LAUNCH_ANGLE) ** 2 * (dist * Math.tan(LAUNCH_ANGLE) - dy)
    const ideal = Math.sqrt((G * dist * dist) / Math.max(denom, 0.01))
    const v = ideal * powerToFactor(power)
    const vel = toRim.multiplyScalar(v * Math.cos(LAUNCH_ANGLE))
    vel.y = v * Math.sin(LAUNCH_ANGLE)
    shot.current = { pos: start, vel, t: 0, acc: 0, scored: false, prevY: start.y }
    const s = useJmActivity.getState().shoot
    useJmActivity.getState().setShoot({ shots: s.shots + 1, lastResult: null })
  }

  function finishShot() {
    const result = shot.current
    shot.current = null
    if (ballRef.current) ballRef.current.visible = false
    const store = useJmActivity.getState()
    const s = store.shoot
    if (!s.active) return
    const makes = s.makes + (result.scored ? 1 : 0)
    store.setShoot({ makes, lastResult: result.scored ? 'make' : 'miss' })
    if (result.scored && makes >= SHOOT_GOAL && store.complete('jm_hoop')) {
      useUiStore.getState().toast?.(`🏀 ${SHOOT_GOAL}골 성공! 농구 체험 완료`, 'success')
    }
  }

  // 공 한 걸음: 중력 → 림 → 백보드 → 바닥 → 골 판정
  function step(b, dt) {
    b.vel.y -= G * dt
    b.prevY = b.pos.y
    b.pos.addScaledVector(b.vel, dt)

    // 림(가로로 누운 원): 공 중심에서 가장 가까운 림 위의 점과 부딪힘
    tmp.d.set(b.pos.x - tmp.rim.x, 0, b.pos.z - tmp.rim.z)
    const horiz = tmp.d.length()
    if (horiz > 1e-4) {
      tmp.q.copy(tmp.rim).addScaledVector(tmp.d.multiplyScalar(1 / horiz), RIM_R)
      tmp.d.copy(b.pos).sub(tmp.q)
      const dist = tmp.d.length()
      if (dist < BALL_R + RIM_TUBE && dist > 1e-4) {
        const n = tmp.d.multiplyScalar(1 / dist)
        b.pos.copy(tmp.q).addScaledVector(n, BALL_R + RIM_TUBE)
        const vn = b.vel.dot(n)
        if (vn < 0) b.vel.addScaledVector(n, -1.6 * vn)
      }
    }

    // 백보드(1.8 × 1.05 판, 앞면이 forward)
    tmp.d.copy(b.pos).sub(tmp.board)
    const along = tmp.d.dot(tmp.forward)
    if (along < BALL_R && along > -0.3) {
      const side = tmp.d.clone().addScaledVector(tmp.forward, -along)
      const up = Math.abs(side.y)
      side.y = 0
      if (side.length() < 0.9 && up < 0.525 && b.vel.dot(tmp.forward) < 0) {
        b.pos.addScaledVector(tmp.forward, BALL_R - along)
        const vn = b.vel.dot(tmp.forward)
        b.vel.addScaledVector(tmp.forward, -1.6 * vn)
      }
    }

    // 바닥
    const floorY = tmp.rim.y - rimY + BALL_R
    if (b.pos.y < floorY) {
      b.pos.y = floorY
      if (b.vel.y < 0) b.vel.y *= -0.55
      b.vel.x *= 0.8
      b.vel.z *= 0.8
    }

    // 골: 림 높이를 위에서 아래로 지나갈 때 림 안쪽이면 성공
    if (!b.scored && b.vel.y < 0 && b.prevY > tmp.rim.y && b.pos.y <= tmp.rim.y && horiz < RIM_R - BALL_R * 0.4) {
      b.scored = true
    }
  }

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (!anchor.current) return

    // 캐릭터 찾기 (다시 생기거나 바뀔 수 있어서 가끔 다시 찾음)
    if (!player.current?.parent && t - lastLookup.current > FIND_PLAYER_EVERY) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    const store = useJmActivity.getState()
    const s = store.shoot

    // 가까이 있는지: 거리 + 코트 쪽(골대 앞)
    if (player.current?.parent) {
      updateHoopWorld()
      player.current.getWorldPosition(tmp.me)
      tmp.d.copy(tmp.me).sub(tmp.rim)
      tmp.d.y = 0
      const near = tmp.d.length() < NEAR_DIST && tmp.d.dot(tmp.forward) > 0.8
      if (near && s.near !== item.id) store.setShoot({ near: item.id })
      if (!near && s.near === item.id) store.setShoot({ near: null })
    }

    // 힘 게이지 (0 → 1 → 0 왕복)
    if (s.active === item.id && s.charging) {
      phase.current += delta * 1.3
      const power = 1 - Math.abs(1 - (phase.current % 2))
      store.setShoot({ power })
    }

    // 날아가는 공
    // 고정 간격(1/240초)으로 나눠 계산 → 프레임이 느려도 같은 힘이면 같은 결과
    const b = shot.current
    if (b) {
      updateHoopWorld()
      b.acc += Math.min(delta, 0.25)
      while (b.acc >= FIXED_DT) {
        step(b, FIXED_DT)
        b.acc -= FIXED_DT
        b.t += FIXED_DT
      }
      if (ballRef.current) {
        ballRef.current.visible = true
        ballRef.current.position.copy(b.pos)
        ballRef.current.rotation.x += delta * 8
      }
      if (b.t > SHOT_TIME) finishShot()
    }
  })

  return (
    <>
      <group ref={anchor} />
      {/* 공은 골대 그룹(회전됨)이 아니라 장면 맨 위에 그려서 월드 좌표를 그대로 씀 */}
      {createPortal(
        <mesh ref={ballRef} visible={false}>
          <sphereGeometry args={[BALL_R, 16, 12]} />
          <meshStandardMaterial color="#e8792a" />
        </mesh>,
        scene,
      )}
      <ShootHud hoopId={item.id} />
    </>
  )
}

// 화면 안내: 가까이 오면 "E 슛 모드", 슛 모드면 힘 게이지 + 점수
function ShootHud({ hoopId }) {
  const s = useJmActivity((state) => state.shoot)
  const done = useJmActivity((state) => Boolean(state.completed.jm_hoop))
  const size = useThree((state) => state.size)
  const showHint = s.near === hoopId && !s.active
  const active = s.active === hoopId
  if (!showHint && !active) return null

  // 골대 위치와 상관없이 화면 왼쪽 위(0,0)에 캔버스 크기 그대로 깔기
  // (fullscreen 옵션은 골대 그룹의 위치·회전을 따라가서 화면 밖으로 밀림)
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ ...hudWrap, width: size.width, height: size.height }}>
        {showHint && (
          <div style={chip}>
            <kbd style={kbd}>E</kbd> 농구 슛 해 보기 {done && '· 완료 ✓'}
          </div>
        )}
        {active && (
          <div style={panel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              🏀 {s.makes} / {SHOOT_GOAL}골 <span style={{ opacity: 0.7, fontWeight: 400 }}>· 시도 {s.shots}</span>
            </div>
            <div style={gauge}>
              <div style={{ ...sweet }} />
              <div style={{ ...gaugeFill, width: `${Math.round(s.power * 100)}%` }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              {s.lastResult === 'make' ? '골인! ' : s.lastResult === 'miss' ? '아깝다! ' : ''}
              <kbd style={kbd}>Space</kbd> 꾹 눌러 힘 조절 → 떼면 슛 · 초록 칸이 정확한 힘 · <kbd style={kbd}>ESC</kbd> 나가기
            </div>
          </div>
        )}
      </div>
    </Html>
  )
}

const hudWrap = { position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const panel = { width: 320, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 14 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
const gauge = { position: 'relative', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }
// 정확한 힘 구간 (0.42 ~ 0.6)
const sweet = { position: 'absolute', left: '42%', width: '18%', top: 0, bottom: 0, background: 'rgba(74,222,128,0.55)' }
const gaugeFill = { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#f59e0b', opacity: 0.85 }
