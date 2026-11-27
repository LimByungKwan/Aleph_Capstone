import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { layout } from '../../data/mapData.js'
import { Ball, Box } from './kit.jsx'
import { GlowMaterial } from './jm_landmarks.jsx'
import { BRASS, cageTexture, elevPlankTexture, floorTexture, LEVER_BRONZE, LEVER_HOLE, LEVER_WOOD } from './jm_spirit.jsx'
import { useGameStore } from '../../../store/gameStore.js'
import { onJmMessage, sendJm, useRealtimeStore } from '../../multiplayer/realtimeStore.js'
import { JM_LIFT, jmLiftMoveSec } from '@shared/jm_liftTiming.js'

// ── (11/27) 유야(온천장) 손님용 엘리베이터: 칸 하나가 실제로 오르내림 ─────────────
// 병관님 전망대 엘리베이터(Map/Terrain.jsx Elevator)와 같은 방식:
//   칸 = 움직이는 물리 바닥(kinematic) + 문 충돌. 운행은 "시작 후 몇 초"로 단계를 계산
//   문 닫힘 → 출발 대기 → 이동(천천히 출발·도착) → 도착 대기 → 문 열림
//   캐릭터는 이동하는 동안 출발 직전 서 있던 높이·칸 속도로 같이 옮김 (ecctrl 스프링 때문에 통통 튀지 않게)
// 예전 방식(11/25~26, 층마다 칸 5개 + 매 프레임 순간 이동)의 오류를 없애려고 바꿈:
//   바닥판을 뚫고 지나가며 몸이 밀림 · 카메라가 아래층에 남아 바닥을 비춤 · 도착 칸과 출발 칸이 겹쳐 보임 · 입력 잠금이 풀리지 않음 등
// 바닥판의 승강로 구멍과 칸 자리는 생성 스크립트(gen-jm-kyoto.mjs YU_GUEST)가 만듦. 칸이 없는 층의 구멍은 층 문 충돌이 막음
// 물리는 <Physics> 안에서만 만들 수 있어서 Scene.jsx에서 그림 (JSON의 jmElevator 소품은 위치·층 정보만 줌)
// 멀티(11/27): 접속 중이면 층 고르기·부르기를 서버(server/src/jm_lifts.js)에 보내고, 서버가 모두에게 보낸 운행 신호로만 움직임
//   → 다른 사람이 타고 올라가도 내 화면에서 같은 칸이 같은 시간에 움직임 (다른 사람 몸은 그 사람이 보내는 위치로 칸 안에 보임)
//   운행 시간 계산은 서버와 같은 shared/jm_liftTiming.js. 접속이 안 돼 있으면 이 화면 혼자 움직임

const DOOR = JM_LIFT.door // 문이 다 열리거나 닫히는 시간(초)
const PAUSE = JM_LIFT.pause // 문 닫힌 뒤 출발까지, 도착 뒤 문 열리기까지(초)
const LEVER_PIVOT = [-0.2, 1.45]
const LEVER_LEN = 0.5
const LEVER_SWING = 1.0
const smooth = (t) => t * t * (3 - 2 * t)
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)
const floorName = (key) => (key === 'B' ? 'B1' : `${key}F`)
const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
// 그 층 문이 얼마나 열렸는지 (0 닫힘 ~ 1 열림)
const doorAmount = (s, level) => (s.at === level && s.phase !== 'moving' ? s.door : 0)

const LIFTS = layout.props.filter((item) => item.style === 'jmElevator' && item.elevator?.stops?.length > 1)

export function JmGuestLifts({ playerRef }) {
  return LIFTS.map((item) => <GuestLift key={item.id} item={item} playerRef={playerRef} />)
}

function GuestLift({ item, playerRef }) {
  const [w, h, d] = item.size
  const E = item.elevator
  const S = E.shaft ?? w / 2 + 0.2 // 승강로 벽 안쪽 반폭 + 벽 두께 절반 (문 = 로컬 +z 쪽 벽면)
  const n = E.stops.length
  const yaw = THREE.MathUtils.degToRad(item.rotationDeg ?? 0)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const [bx, bz] = item.position
  const baseY = item.elevation ?? 0
  // 층마다 칸 바닥 윗면 높이 (1층 칸 바닥 기준). stops.pos[1] = 층 바닥 + 0.05, elevation = 1층 바닥 + 0.02
  const levels = useMemo(() => E.stops.map((st) => Math.round((st.pos[1] - 0.03 - baseY) * 100) / 100), [E, baseY])
  const toWorld = (lx, ly, lz) => ({ x: bx + lx * cos + lz * sin, y: baseY + ly, z: bz - lx * sin + lz * cos })
  const toLocal = (x, z) => {
    const dx = x - bx
    const dz = z - bz
    return [dx * cos - dz * sin, dx * sin + dz * cos]
  }

  const bodyRef = useRef(null)
  const gateL = useRef(null)
  const gateR = useRef(null)
  const landingGates = useRef([])
  const lever = useRef(null)
  const gateCollider = useRef(null)
  const landingColliders = useRef([])
  const enabledCache = useRef(new WeakMap())
  const controls = useThree((s) => s.controls)
  const size = useThree((s) => s.size)
  const cage = useMemo(() => cageTexture(), [])
  const planks = useMemo(() => elevPlankTexture(), [])

  const initial = () => ({ at: 0, y: levels[0], door: 1, phase: 'open', timer: 0, trip: null, pending: null, rideOffset: null, camMode: null })
  const state = useRef(initial())
  // 화면 안내(HUD): 바뀔 때만 다시 그림
  const [ui, setUi] = useState({ mode: null, level: -1, cur: 0, to: 0 })
  const uiRef = useRef(ui)

  const leverAngle = (i) => (n > 1 ? -LEVER_SWING + (2 * LEVER_SWING * i) / (n - 1) : 0)
  const tripLen = (from, to) => jmLiftMoveSec(levels, from, to)
  // 층 고르기·부르기: 접속 중이면 서버가 정해서 모두에게 알림(운행 중이면 서버가 도착 후 이어서), 아니면 이 화면에서 바로
  const go = (to) => {
    const s = state.current
    if (to < 0 || to >= n) return
    if (useRealtimeStore.getState().status === 'online') {
      sendJm({ t: 'jm.lift.go', id: item.id, to, levels })
      return
    }
    if (s.trip) {
      if (s.trip.to !== to) s.pending = to
      return
    }
    if (to !== s.at) s.trip = { from: s.at, to, start: performance.now() }
  }
  const goRef = useRef(go)
  goRef.current = go

  // 서버 알림: 운행 시작(모두에게) / 지금 상태(접속·재접속 직후)
  useEffect(
    () =>
      onJmMessage((msg) => {
        if (msg.id !== item.id) return
        const s = state.current
        const valid = (i) => Number.isInteger(i) && i >= 0 && i < n
        if (msg.t === 'jm.lift.trip' && valid(msg.from) && valid(msg.to)) {
          s.trip = { from: msg.from, to: msg.to, start: performance.now() - (Number(msg.elapsed) || 0) }
          s.pending = null
        } else if (msg.t === 'jm.lift.state' && valid(msg.at)) {
          s.pending = null
          if (msg.trip && valid(msg.trip.from) && valid(msg.trip.to)) s.trip = { from: msg.trip.from, to: msg.trip.to, start: performance.now() - (Number(msg.trip.elapsed) || 0) }
          else if (!s.trip && s.at !== msg.at) s.trip = { from: s.at, to: msg.at, start: performance.now() } // 혼자 움직였던 칸 → 서버 층으로 운행해서 맞춤 (순간 이동하면 타 있던 사람이 승강로로 떨어짐)
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id, n],
  )

  useFrame((_, delta) => {
    const body = bodyRef.current
    if (!body) return
    const s = state.current
    // 개발 중 코드가 새로고침 없이 바뀌면(HMR) 예전 모양의 상태가 남을 수 있음 → 처음 상태로
    if (s.phase === undefined || s.camMode === undefined) Object.assign(s, initial())
    const dt = Math.min(delta, 0.05)
    const prevY = s.y
    const player = playerRef?.current
    let onLift = false
    let nearLevel = -1
    if (player?.currPos) {
      const p = player.body?.translation() ?? player.currPos
      const [lx, lz] = toLocal(p.x, p.z)
      const rel = p.y - baseY - s.y // 캐릭터 몸통 중심(서 있으면 바닥 + 약 1m) - 칸 바닥
      onLift = Math.abs(lx) < w / 2 && Math.abs(lz) < d / 2 && rel > 0.2 && rel < 2.4
      // 태우고 움직이는 중에는 칸 벽 안에 붙잡혀 있으니 계속 탄 것으로 (화면이 느리면 한 프레임에 칸이 몇 m씩 움직여 높이 판정이 잠깐 빗나감)
      if (s.rideOffset != null && (s.phase === 'moving' || s.phase === 'arrive')) onLift = true
      if (!onLift && lz > d / 2 - 0.1 && lz < S + 3.5 && Math.abs(lx) < S + 0.8) {
        levels.forEach((lv, i) => {
          const r = p.y - baseY - lv
          if (r > 0.2 && r < 2.6) nearLevel = i
        })
      }
    }

    // 운행: 시작한 지 몇 초인지로 단계·높이·문 열림 계산
    if (s.trip) {
      const e = (performance.now() - s.trip.start) / 1000
      const { from, to } = s.trip
      const M = tripLen(from, to)
      if (e < DOOR) Object.assign(s, { phase: 'closing', at: from, door: Math.min(s.door, Math.max(0, 1 - e / DOOR)), y: levels[from] })
      else if (e < DOOR + PAUSE) Object.assign(s, { phase: 'depart', at: from, door: 0, y: levels[from], timer: e - DOOR })
      else if (e < DOOR + PAUSE + M) Object.assign(s, { phase: 'moving', at: from, door: 0, y: levels[from] + (levels[to] - levels[from]) * easeInOut((e - DOOR - PAUSE) / M) })
      else if (e < DOOR + 2 * PAUSE + M) Object.assign(s, { phase: 'arrive', at: to, door: 0, y: levels[to], timer: e - DOOR - PAUSE - M })
      else if (e < 2 * DOOR + 2 * PAUSE + M) Object.assign(s, { phase: 'opening', at: to, door: Math.min(1, (e - DOOR - 2 * PAUSE - M) / DOOR), y: levels[to] })
      else {
        Object.assign(s, { phase: 'open', at: to, door: 1, y: levels[to], timer: 0 })
        s.trip = null
        // 혼자 모드: 운행 중에 다른 층에서 불렀으면 이어서 (접속 중이면 서버가 이어서 보냄)
        const next = s.pending
        s.pending = null
        if (next != null && next !== s.at && useRealtimeStore.getState().status !== 'online') s.trip = { from: s.at, to: next, start: performance.now() }
      }
    } else {
      Object.assign(s, { phase: 'open', door: Math.min(1, s.door + dt / DOOR), y: levels[s.at] })
    }

    body.setNextKinematicTranslation(toWorld(0, s.y, 0))

    // 캐릭터 태우기 (병관님 엘리베이터와 같은 방식)
    const rider = player?.body
    if (rider) {
      const top = baseY + s.y
      // 탈 높이는 문이 닫히는 동안 계속 잡아 둠: 화면이 느려 한 프레임이 길면 '출발 대기'를 건너뛰고 바로 '이동'이 될 수 있음
      //   (그러면 높이를 못 잡아 내려갈 때 캐릭터만 두고 칸이 내려갔음, 11/27 확인)
      const boarding = s.phase === 'closing' || s.phase === 'depart'
      if (boarding) s.rideOffset = onLift ? player.currPos.y - top : null
      // 이동 중에는 칸 벽 안이라 계속 태움. 도착한 뒤에도 문이 다 열릴 때까지 높이를 붙잡아 둠 (바로 놓으면 스프링이 출렁임)
      if (s.phase === 'open' || (s.phase === 'opening' && !onLift)) s.rideOffset = null
      const carrying = (s.phase === 'moving' || s.phase === 'arrive' || s.phase === 'opening') && s.rideOffset != null
      if (carrying) {
        const pos = rider.translation()
        const vel = rider.linvel()
        // 움직이는 동안은 칸 밖으로 밀려나지 않게 x·z도 칸 안쪽으로 붙잡음
        const [lx, lz] = toLocal(pos.x, pos.z)
        const lim = s.phase === 'moving' ? w / 2 - 0.35 : Infinity
        const cx = Math.max(-lim, Math.min(lim, lx))
        const cz = Math.max(-lim, Math.min(lim, lz))
        const wpos = toWorld(cx, 0, cz)
        // 출발 직전 높이(rideOffset)를 서 있는 높이 쪽으로 천천히 맞춰 가며 놓을 때 덜컹이지 않게
        if (s.phase !== 'moving') s.rideOffset += (1.0 - s.rideOffset) * Math.min(1, dt * 4)
        rider.setTranslation({ x: wpos.x, y: top + s.rideOffset, z: wpos.z }, true)
        rider.setLinvel({ x: vel.x, y: s.phase === 'moving' && dt > 0 ? (s.y - prevY) / dt : 0, z: vel.z }, true)
      }
    }

    // 문 충돌: 문이 거의 다 열렸을 때만 치우고, 닫히기 시작하면 바로 제자리로
    //   setEnabled(false)는 움직이는 칸(kinematic)에 붙은 충돌체에는 안 먹어서(꺼짐으로 나와도 계속 막음, 11/27 확인)
    //   문이 열리면 충돌체를 50m 아래로 치움. 센서로 바꾸는 방법은 캐릭터 발밑 감지 광선에 걸릴 수 있어 쓰지 않음
    //   상태는 충돌체마다 기억 (충돌체가 새로 만들어지면 기억이 없으니 다시 맞춤)
    const setBlocking = (collider, home, blocking) => {
      if (collider && enabledCache.current.get(collider) !== blocking) {
        collider.setTranslationWrtParent(blocking ? home : { x: home.x, y: home.y - 50, z: home.z })
        enabledCache.current.set(collider, blocking)
      }
    }
    setBlocking(gateCollider.current, { x: 0, y: h / 2, z: d / 2 + 0.02 }, s.door < 0.85 || s.phase === 'closing')
    landingColliders.current.forEach((c, i) => setBlocking(c, { x: 0, y: levels[i] + 1.8, z: S + 0.08 }, doorAmount(s, i) < 0.85 || (s.phase === 'closing' && s.at === i)))

    // 문 그림: 칸 철문 + 층마다 승강로 철문 (접이식, 닫힘 = 1)
    const shut = 1 - smooth(s.door)
    const k = 0.12 + shut * 0.88
    if (gateL.current) gateL.current.scale.x = k
    if (gateR.current) gateR.current.scale.x = k
    landingGates.current.forEach((g, i) => {
      if (!g) return
      const kk = 0.12 + (1 - smooth(doorAmount(s, i))) * 0.88
      g.children[0].scale.x = kk
      g.children[1].scale.x = kk
    })
    const selected = s.trip ? s.trip.to : s.at
    if (lever.current) lever.current.rotation.z += (leverAngle(selected) - lever.current.rotation.z) * Math.min(1, dt * 6)

    // 카메라: 칸이 좁아(2.8m) 뒤에서 따라오는 카메라(3~5m)는 승강로 벽·위아래 바닥판 속으로 빠짐
    //   칸에 들어서면 열린 문 쪽에서 들여다보는 자리(2.6m), 운행하는 동안은 칸 안(1m)으로 당김. 그 뒤에는 마우스로 자유롭게
    if (controls?.rotateTo) {
      const camMode = onLift ? (s.trip && s.phase !== 'opening' ? 'ride' : 'in') : null
      if (camMode !== s.camMode) {
        if (camMode) {
          controls.minDistance = Math.min(controls.minDistance, 1)
          controls.rotateTo(yaw, 1.05, true)
          controls.dollyTo(camMode === 'ride' ? 1 : 2.6, true)
        }
        s.camMode = camMode
      }
      // 움직이는 동안은 카메라 중심을 캐릭터에 바로 맞춤: 공용 카메라의 부드러운 따라가기는 위아래로 빠르게 움직이면
      //   몇 m씩 뒤처졌다가 튀어서(11/27 측정: 칸 15m일 때 카메라 10m → 도착 뒤 34m) 바닥판·벽 속을 비췄음
      if (camMode === 'ride' && s.rideOffset != null && rider) {
        const q = rider.translation()
        controls.moveTo(q.x, q.y + 0.6, q.z, false) // 0.6 = FollowCamera LOOK_HEIGHT
      }
    }

    // 안내
    let mode = null
    if (onLift) mode = s.trip ? 'riding' : 'rider'
    else if (nearLevel !== -1) {
      if (s.trip && s.trip.to === nearLevel) mode = 'coming'
      else if (!s.trip && s.at === nearLevel) mode = null // 문 열려 있음 → 그냥 타면 됨
      else mode = 'call'
    }
    let cur = s.at
    levels.forEach((lv, i) => {
      if (Math.abs(lv - s.y) < Math.abs(levels[cur] - s.y)) cur = i
    })
    const next = { mode, level: nearLevel, cur, to: selected }
    const prev = uiRef.current
    if (prev.mode !== next.mode || prev.level !== next.level || prev.cur !== next.cur || prev.to !== next.to) {
      uiRef.current = next
      setUi(next)
    }
  })

  // 숫자 키(칸 안) / E 키(층 문 앞에서 부르기). 채팅 입력 중에는 무시
  useEffect(() => {
    if (ui.mode !== 'rider' && ui.mode !== 'call') return undefined
    const down = (event) => {
      if (event.repeat || isTyping(event.target) || useGameStore.getState().openPanel) return
      if (ui.mode === 'call') {
        if (event.code !== 'KeyE') return
        event.preventDefault()
        goRef.current(ui.level)
        return
      }
      const m = /^(?:Digit|Numpad)(\d)$/.exec(event.code)
      const key = m ? m[1] : event.code === 'KeyB' ? 'B' : null
      const to = key ? E.stops.findIndex((st) => st.key === key) : -1
      if (to < 0) return
      event.preventDefault()
      goRef.current(to)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [ui.mode, ui.level, E])

  const kbd = (k) => <kbd style={{ padding: '0 5px', borderRadius: 4, background: '#e8c35a', color: '#111', fontSize: 11, fontWeight: 700 }}>{k}</kbd>
  const riding = ui.mode === 'riding'
  const curKey = E.stops[ui.cur]?.key ?? '1'
  const toKey = E.stops[ui.to]?.key ?? '1'
  const start = toWorld(0, levels[0], 0)

  return (
    <>
      {/* 움직이는 칸: 바닥·벽·천장 충돌 + 앞 철문 충돌(문 닫혔을 때만) + 그림 */}
      <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[start.x, start.y, start.z]} rotation={[0, yaw, 0]} name={`jm-lift-${item.id}`}>
        <CuboidCollider args={[w / 2, 0.06, d / 2]} position={[0, -0.06, 0]} />
        <CuboidCollider args={[w / 2, h / 2, 0.05]} position={[0, h / 2, -d / 2]} />
        <CuboidCollider args={[0.05, h / 2, d / 2]} position={[-w / 2, h / 2, 0]} />
        <CuboidCollider args={[0.05, h / 2, d / 2]} position={[w / 2, h / 2, 0]} />
        <CuboidCollider args={[w / 2, 0.05, d / 2]} position={[0, h - 0.05, 0]} />
        <CuboidCollider ref={gateCollider} args={[w / 2, h / 2, 0.05]} position={[0, h / 2, d / 2 + 0.02]} />
        <CabLook w={w} h={h} d={d} planks={planks} cage={cage} gateL={gateL} gateR={gateR} lever={lever} stops={E.stops} leverAngle={leverAngle} curKey={curKey} toKey={toKey} riding={riding} sel={ui.to} />
      </RigidBody>

      {/* 층마다 승강로 문 자리: 충돌(칸이 그 층에 서서 문이 열렸을 때만 꺼짐) + 접이식 놋쇠 철문 */}
      <RigidBody type="fixed" colliders={false} position={[bx, baseY, bz]} rotation={[0, yaw, 0]} name={`jm-lift-doors-${item.id}`}>
        {levels.map((lv, i) => (
          <CuboidCollider key={i} ref={(c) => (landingColliders.current[i] = c)} args={[S, 1.8, 0.06]} position={[0, lv + 1.8, S + 0.08]} />
        ))}
      </RigidBody>
      <group position={[bx, baseY, bz]} rotation={[0, yaw, 0]}>
        {levels.map((lv, i) => (
          <group key={i} ref={(g) => (landingGates.current[i] = g)} position={[0, lv, S + 0.1]}>
            {[-1, 1].map((sd) => (
              <group key={sd} position={[sd * (S - 0.05), 0, 0]} scale={[0.12, 1, 1]}>
                <mesh position={[-sd * (S / 2 - 0.05), 1.75, 0]}>
                  <planeGeometry args={[S - 0.1, 3.4]} />
                  <meshStandardMaterial map={cage} transparent alphaTest={0.4} side={THREE.DoubleSide} metalness={0.6} roughness={0.35} color="#e8c35a" />
                </mesh>
                <Box p={[-sd * (S - 0.12), 1.75, 0]} s={[0.05, 3.4, 0.05]} m={BRASS} />
              </group>
            ))}
          </group>
        ))}
      </group>

      {ui.mode && (
        // onOcclude: 기준점(월드 원점)이 카메라 뒤에 있어도 숨기지 않게 (Html 기본 동작은 display: none)
        <Html calculatePosition={() => [0, 0]} onOcclude={() => {}} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          {/* 왼쪽 조작키 안내 아래에 둠 (오른쪽 아래는 미니맵이 가림) */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '210px 0 0 16px', boxSizing: 'border-box', pointerEvents: 'none' }}>
            <div style={{ width: 230, padding: '12px 14px', borderRadius: 14, background: 'rgba(24,14,8,0.86)', border: '2px solid #b8913c', color: '#fff', fontSize: 14, lineHeight: 1.5, pointerEvents: 'auto' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#f2c94c', marginBottom: 6 }}>{E.kind === 'guest' ? '손님용 엘리베이터' : '엘리베이터'}</div>
              {(ui.mode === 'rider' || ui.mode === 'riding') && (
                <>
                  {/* 층 목록: 위층이 위. 누르면 바로 출발 */}
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 3, marginBottom: 8 }}>
                    {E.stops.map((st, i) => {
                      const isHere = !riding && i === ui.cur
                      const isSel = riding ? i === ui.to : isHere
                      return (
                        <button
                          key={st.key}
                          type="button"
                          disabled={riding || isHere}
                          onClick={(e) => {
                            e.currentTarget.blur()
                            go(i)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8, border: 'none', textAlign: 'left', color: '#fff', cursor: riding || isHere ? 'default' : 'pointer', background: isSel ? (riding ? '#a24a36' : '#b8913c') : 'rgba(255,255,255,0.08)', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: isSel ? 800 : 500 }}
                        >
                          {kbd(st.key)}
                          <span style={{ width: 28, fontSize: 16, fontWeight: 900 }}>{floorName(st.key)}</span>
                          <span style={{ fontSize: 12, flex: 1 }}>{st.label}</span>
                          {isHere && <span style={{ fontSize: 11, opacity: 0.85 }}>지금</span>}
                        </button>
                      )
                    })}
                  </div>
                  {riding ? (
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#f2c94c', textAlign: 'center' }}>
                      {ui.cur === ui.to ? `${floorName(toKey)} 도착` : `${ui.to > ui.cur ? '▲' : '▼'} ${floorName(curKey)}`}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13 }}>숫자 키 {kbd('1')}~{kbd(String(E.stops[n - 1].key))} 또는 층을 누르면 문이 닫히고 출발해요</div>
                  )}
                </>
              )}
              {ui.mode === 'call' && (
                <>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>지금 칸은 {floorName(curKey)}에 있어요.</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      go(ui.level)
                    }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: 'none', background: '#b8913c', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {kbd('E')} 엘리베이터 부르기
                  </button>
                </>
              )}
              {ui.mode === 'coming' && (
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f2c94c', textAlign: 'center' }}>
                  {ui.cur === ui.level ? '곧 문이 열려요' : `오는 중 ${ui.level > ui.cur ? '▲' : '▼'} ${floorName(curKey)}`}
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </>
  )
}

// 칸 그림 (11/26 지민 요청: 영화 장면처럼 어두운 나무판 벽 + 옆벽 반원 청동 판에 놋쇠 레버 + 접이식 철문)
function CabLook({ w, h, d, planks, cage, gateL, gateR, lever, stops, leverAngle, curKey, toKey, riding, sel }) {
  return (
    <group>
      <Box p={[0, 0.05 - 0.1, 0]} s={[w, 0.1, d]} c="#3b2a1c" />
      <Box p={[0, h - 0.1, 0]} s={[w, 0.2, d]} c="#2a1a0e" />
      {[
        [0, -d / 2, w, 0],
        [-w / 2, 0, d, Math.PI / 2],
        [w / 2, 0, d, -Math.PI / 2],
      ].map(([x, z, len, r], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
          {/* 벽은 칸 안쪽에서만 보임(FrontSide, 앞면 = 안쪽): 칸이 좁아 카메라가 벽 밖에 있어도 벽 너머로 캐릭터가 보이게 */}
          <mesh position={[0, h / 2, 0.01]}>
            <planeGeometry args={[len, h - 0.2]} />
            <meshStandardMaterial map={planks} side={THREE.FrontSide} roughness={0.85} />
          </mesh>
          <Box p={[0, 1.0, 0.05]} s={[len - 0.1, 0.1, 0.08]} c="#6b4423" />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (w / 2 - 0.05), h / 2, d / 2]} s={[0.12, h, 0.12]} c="#5a3a1e" />
          <group ref={s < 0 ? gateL : gateR} position={[s * (w / 2 - 0.1), 0, d / 2 - 0.03]} scale={[0.12, 1, 1]}>
            <mesh position={[-s * (w / 4 - 0.05), h / 2 - 0.1, 0]}>
              <planeGeometry args={[w / 2 - 0.1, h - 0.4]} />
              <meshStandardMaterial map={cage} transparent alphaTest={0.4} side={THREE.DoubleSide} metalness={0.6} roughness={0.35} color="#e8c35a" />
            </mesh>
            <Box p={[-s * (w / 2 - 0.12), h / 2 - 0.1, 0]} s={[0.05, h - 0.4, 0.05]} m={BRASS} />
          </group>
        </group>
      ))}
      <Box p={[0, h + 0.05, d / 2]} s={[w + 0.2, 0.15, 0.15]} c="#5a3a1e" />
      {/* 층 표시: 문 위 = 지금 지나는 층, 칸 안 뒷벽 = 가는 층(출발하면 빨갛게) */}
      <mesh position={[0, h + 0.6, d / 2 + 0.06]}>
        <planeGeometry args={[1.3, 0.8]} />
        <GlowMaterial glow={0.9} map={floorTexture(curKey, false)} side={THREE.DoubleSide} />
      </mesh>
      <Box p={[0, h + 0.6, d / 2 + 0.02]} s={[1.45, 0.95, 0.04]} m={BRASS} />
      <mesh position={[0, h - 0.75, -d / 2 + 0.08]}>
        <planeGeometry args={[1.1, 0.75]} />
        <GlowMaterial glow={1.0} map={floorTexture(toKey, riding)} />
      </mesh>
      <Box p={[0, h - 0.75, -d / 2 + 0.05]} s={[1.25, 0.9, 0.04]} m={BRASS} />
      {/* 레버: 오른쪽 안 벽 붉은 옻칠 판 위 반원 청동 판, 놋쇠 팔 + 나무 손잡이. 위로 = 위층 */}
      <group position={[w / 2 - 0.12, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Box p={[LEVER_PIVOT[0] + 0.15, LEVER_PIVOT[1], -0.01]} s={[1.3, 1.5, 0.03]} c="#7a2416" />
        <group position={[LEVER_PIVOT[0], LEVER_PIVOT[1], 0.02]}>
          {stops.map((st, i) => {
            const a = leverAngle(i)
            return (
              <mesh key={st.key} position={[Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.01]}>
                <planeGeometry args={[0.22, 0.15]} />
                <GlowMaterial glow={0.8} map={floorTexture(st.key, i === sel)} />
              </mesh>
            )
          })}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} material={LEVER_BRONZE}>
            <cylinderGeometry args={[0.62, 0.62, 0.05, 24, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]} material={LEVER_HOLE}>
            <cylinderGeometry args={[0.42, 0.42, 0.02, 24, 1, false, 0, Math.PI]} />
          </mesh>
          {[-0.75, 0, 0.75].map((a) => (
            <Ball key={a} p={[Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0.05]} rad={0.035} m={LEVER_HOLE} />
          ))}
          <Box p={[-0.04, 0, 0.03]} s={[0.12, 1.3, 0.08]} m={LEVER_BRONZE} />
          <Ball p={[0, 0, 0.07]} rad={0.06} m={BRASS} />
          <group ref={lever} rotation={[0, 0, leverAngle(0)]}>
            <Box p={[LEVER_LEN / 2, 0, 0.09]} s={[LEVER_LEN, 0.07, 0.03]} m={BRASS} />
            <mesh position={[LEVER_LEN + 0.06, 0, 0.13]} rotation={[0, 0, -Math.PI / 2]} material={LEVER_WOOD}>
              <cylinderGeometry args={[0.075, 0.085, 0.24, 14]} />
            </mesh>
            <Ball p={[LEVER_LEN + 0.19, 0, 0.13]} rad={0.025} m={LEVER_HOLE} />
          </group>
        </group>
      </group>
    </group>
  )
}
