// 애니 ↔ K-pop 사이 빈 땅: 바닷가 레일바이크 공원 — 담당: 지민 (11/27)
// 참고: 해안 레일바이크(지붕 달린 4바퀴 바이크, 철길 옆 소나무 줄·노란 울타리, 무지개 조명 터널)
//
// jmRailTrack      철길 그림 (자갈 + 침목 + 레일). item.track = { points: [[x, z], ...], closed }
// jmRailBike       E로 타서 W/S로 직접 모는 레일바이크 (철길 순환선 위). 내 화면에서만 움직임(다른 사람에게는 내 캐릭터만 보임)
// jmRailBikeParked 역 옆 대기선에 세워 둔 바이크들 (그림만)
// jmRailTunnel     풀 언덕 속 무지개 터널 (로컬 x = 철길 방향). 걷기 막는 판정은 JSON jmCollider
// jmRailStation    작은 시골역 승강장 + 지붕 + 역 이름판 + 매표소 (앞 +z = 철길 쪽). 걷는 바닥은 JSON jmCollider
// jmRailFence      철길 옆 노란 울타리 (item.points 를 잇는 선)
//
// 점 좌표는 모두 item.position 기준 (생성기는 position [0, 0] + 구역 좌표로 씀)
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useJoystickStore } from 'ecctrl/input'
import { Box, Cyl, GEO, Instances, mat } from './kit.jsx'
import { canvasTexture } from './jm_landmarks.jsx'
import { useGameStore } from '../../../store/gameStore.js'
import { requestPalaceWarp } from '../../../components/movieZone/palaceSeating.js'
import { useJmActivity } from './jm_activityStore.js'

const range = (n) => Array.from({ length: n }, (_, i) => i)
const GAUGE = 1.0 // 레일 사이 (바이크 바퀴 사이와 같게)

// ── 철길 곡선 (닫힌 순환선 / 열린 대기선) ─────────────────────
const curveCache = new Map()
export function railCurve(points, closed = true) {
  const key = JSON.stringify([points, closed])
  if (curveCache.has(key)) return curveCache.get(key)
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal')
  curve.arcLengthDivisions = 3000
  curve.updateArcLengths()
  const value = { curve, length: curve.getLength() }
  curveCache.set(key, value)
  return value
}

// 땅에 깐 띠 (자갈 바닥)
function stripGeometry(curve, n, width, y) {
  const pos = []
  const idx = []
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(Math.min(1, i / n), p)
    curve.getTangentAt(Math.min(1, i / n), t)
    const nx = t.z
    const nz = -t.x
    pos.push(p.x - nx * width / 2, y, p.z - nz * width / 2, p.x + nx * width / 2, y, p.z + nz * width / 2)
    if (i > 0) {
      const k = i * 2
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const nrm = g.attributes.normal
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0) // 방향과 상관없이 위를 보게
  return g
}

const SLEEPER = mat('#6b4a32', { roughness: 0.95 })
const RAIL = mat('#a7adb3', { roughness: 0.35, metalness: 0.6 })
const BALLAST_DOUBLE = new THREE.MeshStandardMaterial({ color: '#8f877a', roughness: 1, side: THREE.DoubleSide })

function JmRailTrack({ item }) {
  const { points, closed = true } = item.track
  const parts = useMemo(() => {
    const { curve, length } = railCurve(points, closed)
    const n = Math.max(4, Math.round(length / 0.6))
    const p = new THREE.Vector3()
    const q = new THREE.Vector3()
    const t = new THREE.Vector3()
    const sleepers = []
    const rails = []
    for (let i = 0; i <= n; i++) {
      const u = Math.min(1, i / n)
      curve.getPointAt(u, p)
      curve.getTangentAt(u, t)
      const yaw = Math.atan2(t.x, t.z)
      // 침목: 긴 쪽(로컬 x)이 철길을 가로지름 — rotation.y = 진행 방향 yaw면 로컬 z가 철길 방향
      if (i < n || !closed) sleepers.push({ p: [p.x, 0.07, p.z], s: [1.75, 0.1, 0.24], r: [0, yaw, 0] })
      if (i === n) break
      curve.getPointAt(Math.min(1, (i + 1) / n), q)
      const dx = q.x - p.x
      const dz = q.z - p.z
      const len = Math.hypot(dx, dz) + 0.03
      const segYaw = Math.atan2(dx, dz)
      const nx = Math.cos(segYaw)
      const nz = -Math.sin(segYaw)
      for (const side of [-1, 1]) {
        const o = (side * GAUGE) / 2
        rails.push({ p: [(p.x + q.x) / 2 + nx * o, 0.17, (p.z + q.z) / 2 + nz * o], s: [0.07, 0.1, len], r: [0, segYaw, 0] })
      }
    }
    return { strip: stripGeometry(curve, n, 2.5, 0.025), sleepers, rails }
  }, [points, closed])
  return (
    <group>
      <mesh geometry={parts.strip} material={BALLAST_DOUBLE} receiveShadow userData={{ noMerge: true }} />
      <Instances geometry={GEO.box} material={SLEEPER} items={parts.sleepers} />
      <Instances geometry={GEO.box} material={RAIL} items={parts.rails} />
    </group>
  )
}

// ── 레일바이크 모양 (로컬 +z = 앞) ──────────────────────────
// 아래 검은 틀 + 바퀴 4개(레일 위) + 앞쪽 빨간 판(번호) + 파란 의자 2개 + 지붕(반투명)
const BIKE_FRAME = mat('#2a2c30', { roughness: 0.6, metalness: 0.4 })
const BIKE_SEAT = mat('#2c5aa0', { roughness: 0.7 })
const BIKE_POLE = mat('#d9dde2', { roughness: 0.4, metalness: 0.5 })
const ROOF_COLORS = ['#3d8fd6', '#f2c230', '#e2739a', '#4fb38a']
const BODY_COLORS = ['#d2382c', '#d2382c', '#e2862c', '#d2382c']
export const SEAT_LOCAL = [0.37, 0.64, -0.15] // 운전석 좌판 가운데 (앞 +z를 볼 때 왼쪽 = 로컬 +x)

function numberTexture(n, bg) {
  return canvasTexture(`railbike:num:${n}:${bg}`, 128, 64, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, 34, 24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = bg
    ctx.font = 'bold 34px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), w / 2, h / 2 + 2)
  })
}

function BikeMesh({ variant = 0, number = 7, wheelRef }) {
  const roof = ROOF_COLORS[variant % ROOF_COLORS.length]
  const body = BODY_COLORS[variant % BODY_COLORS.length]
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: roof, transparent: true, opacity: 0.82, roughness: 0.4, side: THREE.DoubleSide }), [roof])
  return (
    <group>
      <Box p={[0, 0.36, 0]} s={[1.5, 0.1, 2.2]} m={BIKE_FRAME} />
      <Box p={[0, 0.3, 0.95]} s={[1.5, 0.18, 0.12]} m={BIKE_FRAME} />
      <Box p={[0, 0.3, -0.95]} s={[1.5, 0.18, 0.12]} m={BIKE_FRAME} />
      <group ref={wheelRef}>
        {[-1, 1].map((sx) =>
          [-0.78, 0.78].map((z) => (
            <mesh key={`${sx}${z}`} position={[(sx * GAUGE) / 2, 0.24, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.2, 0.2, 0.09, 14]} />
              <meshStandardMaterial color="#3a3d42" metalness={0.5} roughness={0.4} />
            </mesh>
          )),
        )}
      </group>
      {/* 앞쪽 빨간 판 + 번호 */}
      <Box p={[0, 0.66, 1.05]} s={[1.52, 0.52, 0.16]} c={body} />
      <mesh position={[0, 0.68, 1.135]}>
        <planeGeometry args={[0.56, 0.28]} />
        <meshStandardMaterial map={numberTexture(number, body)} roughness={0.6} />
      </mesh>
      <Box p={[0, 0.95, 1.03]} s={[1.52, 0.06, 0.2]} c="#f4f1ea" />
      {/* 의자 2개 + 등받이 + 손잡이 */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.37, 0, -0.15]}>
          <Box p={[0, 0.6, 0]} s={[0.52, 0.09, 0.5]} m={BIKE_SEAT} />
          <Box p={[0, 0.92, -0.26]} s={[0.52, 0.56, 0.08]} m={BIKE_SEAT} />
          <Box p={[0, 0.48, 0.55]} s={[0.12, 0.24, 0.3]} m={BIKE_FRAME} />
        </group>
      ))}
      <Box p={[0, 0.98, 0.5]} s={[1.1, 0.05, 0.05]} m={BIKE_POLE} />
      {/* 지붕 기둥 4개 + 지붕 */}
      {[-1, 1].map((sx) =>
        [-0.95, 0.95].map((z) => <Cyl key={`${sx}${z}`} p={[sx * 0.72, 1.22, z]} rad={0.03} h={1.72} m={BIKE_POLE} />),
      )}
      <mesh position={[0, 2.1, 0]} material={roofMat} userData={{ noMerge: true }}>
        <boxGeometry args={[1.62, 0.05, 2.25]} />
      </mesh>
      <Box p={[0, 2.06, 1.13]} s={[1.62, 0.12, 0.04]} c={roof} />
    </group>
  )
}

// ── 타는 레일바이크 ─────────────────────────────────────────
const RIDE_NEAR = 2.8 // 바이크 가운데에서 이 거리 안이면 "E 타기"
const MAX_SPEED = 6.5 // m/s (Shift: 1.5배)
const ACCEL = 3.2
const BRAKE = 7
const SIT_TIME = 0.45
// 다시 그려져도(구역 다시 불러오기) 바이크가 서 있던 자리를 기억 — 내 화면에서만
const rideMemory = new Map()
const ease = (t) => t * t * (3 - 2 * t)

function JmRailBike({ item }) {
  const { points, closed = true } = item.track
  const { curve, length } = useMemo(() => railCurve(points, closed), [points, closed])
  const scene = useThree((s) => s.scene)
  const getState = useThree((s) => s.get)
  const bike = useRef(null)
  const wheels = useRef(null)
  const playerRef = useRef(null)
  const lookup = useRef(-Infinity)
  const keys = useRef(new Set())
  const tmp = useMemo(
    () => ({
      p: new THREE.Vector3(),
      t: new THREE.Vector3(),
      seat: new THREE.Vector3(),
      me: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      inv: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      lq: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      e: new THREE.Euler(),
    }),
    [],
  )
  // 처음 자리: item.startAt [x, z]에서 가장 가까운 철길 점
  const state = useMemo(() => {
    if (rideMemory.has(item.id)) return rideMemory.get(item.id)
    let best = 0
    let bestD = Infinity
    const [sx, sz] = item.startAt ?? points[0]
    const p = new THREE.Vector3()
    for (let i = 0; i < 600; i++) {
      curve.getPointAt(i / 600, p)
      const d = Math.hypot(p.x - sx, p.z - sz)
      if (d < bestD) {
        bestD = d
        best = i / 600
      }
    }
    const value = { s: best * length, v: 0, dist: 0, sit: { phase: null, t: 0, model: null, saved: null, from: 0 }, cam: null, lapAt: 0 }
    rideMemory.set(item.id, value)
    return value
  }, [item.id, item.startAt, points, curve, length])

  // s(철길 위 거리) → 바이크 자리·방향
  const place = () => {
    const u = (((state.s % length) + length) % length) / length
    curve.getPointAt(u, tmp.p)
    curve.getTangentAt(u, tmp.t)
    const g = bike.current
    if (!g) return
    g.position.set(tmp.p.x, 0, tmp.p.z)
    g.rotation.set(0, Math.atan2(tmp.t.x, tmp.t.z), 0)
    g.updateMatrixWorld()
  }

  const findModel = () => playerRef.current?.getObjectByName('player-character-model') ?? null

  function mount() {
    const s = state.sit
    const model = findModel()
    if (model && !s.model) {
      s.model = model
      s.saved = { p: model.position.clone(), q: model.quaternion.clone(), s: model.scale.clone() }
    }
    s.from = s.model?.userData.seatProgress ?? 0
    s.phase = 'sitting'
    s.t = 0
    state.v = 0
    state.dist = 0
    const controls = getState().controls
    state.cam = controls?.distance ?? null
    if (controls?.dollyTo) controls.dollyTo(4.4, true)
  }

  function restoreModel() {
    const s = state.sit
    if (s.model && s.saved) {
      s.model.userData.seatProgress = 0
      s.model.position.copy(s.saved.p)
      s.model.quaternion.copy(s.saved.q)
      s.model.scale.copy(s.saved.s)
    }
    s.model = null
    s.saved = null
    s.phase = null
  }

  function dismount() {
    const s = state.sit
    state.v = 0
    keys.current.clear()
    useJmActivity.getState().setRail({ speed: 0, lap: false })
    // 바이크 오른쪽(로컬 -x = 순환선 안쪽, 역에서는 승강장 쪽) 1.6m에 내려 줌 — 터널 안이어도 벽(철길에서 2.1m) 안쪽
    //   승강장(높이 0.25) 위일 수 있어서 조금 높게 놓고 떨어지게
    place()
    const g = bike.current
    if (g) {
      g.localToWorld(tmp.me.set(-1.6, 0, -0.2))
      requestPalaceWarp([tmp.me.x, tmp.me.y + 1.4, tmp.me.z])
    }
    if (s.phase) {
      s.from = s.model?.userData.seatProgress ?? 0
      s.phase = 'standing'
      s.t = 0
    }
    const controls = getState().controls
    if (controls?.dollyTo && state.cam) controls.dollyTo(state.cam, true)
    state.cam = null
  }

  // E: 타기 / 내리기 (패널을 열어 캐릭터 이동 입력을 잠금 — 벤치와 같은 방식, ESC로도 내림)
  useEffect(() => {
    const drive = new Set(['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'])
    const down = (event) => {
      const rail = useJmActivity.getState().rail
      if (drive.has(event.code) && rail.active === item.id) keys.current.add(event.code)
      if (event.repeat || event.code !== 'KeyE') return
      const game = useGameStore.getState()
      if (rail.active === item.id) {
        if (game.openPanel?.placeId === item.id) game.close()
        return
      }
      const act = useJmActivity.getState()
      const busy = act.sit.active || act.shoot.active || act.skip.active
      if (rail.near === item.id && !busy && !game.openPanel && !game.nearbyPlaceId) {
        act.setRail({ active: item.id, lap: false })
        game.open({ type: 'jm_railbike', placeId: item.id })
        mount()
      }
    }
    const up = (event) => keys.current.delete(event.code)
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
    // mount는 ref·state만 씀
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // 패널이 닫히면(E 또는 ESC) 내림
  useEffect(
    () =>
      useGameStore.subscribe((game) => {
        const rail = useJmActivity.getState().rail
        if (rail.active === item.id && game.openPanel?.placeId !== item.id) {
          useJmActivity.getState().setRail({ active: null })
          dismount()
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id],
  )

  // 화면을 떠나면 모델 원래대로 (타고 있었다면 잠금도 풂)
  useEffect(
    () => () => {
      restoreModel()
      const rail = useJmActivity.getState().rail
      if (rail.active === item.id) {
        useJmActivity.getState().setRail({ active: null, near: null })
        const game = useGameStore.getState()
        if (game.openPanel?.placeId === item.id) game.close()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const time = clock.elapsedTime
    if (!playerRef.current?.parent && time - lookup.current > 1) {
      lookup.current = time
      playerRef.current = scene.getObjectByName('player') ?? null
    }
    const store = useJmActivity.getState()
    const rail = store.rail
    const riding = rail.active === item.id

    // 운전: W 앞으로, S 뒤로(멈춘 뒤 후진), 손 떼면 천천히 멈춤
    if (riding) {
      const k = keys.current
      const stick = useJoystickStore.getState().joysticks.default
      const fwd = k.has('KeyW') || k.has('ArrowUp') || (stick?.active && stick.y > 0.35)
      const back = k.has('KeyS') || k.has('ArrowDown') || (stick?.active && stick.y < -0.35)
      const max = MAX_SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? 1.5 : 1)
      if (fwd && !back) state.v += (state.v < 0 ? BRAKE : ACCEL) * dt
      else if (back && !fwd) state.v -= (state.v > 0 ? BRAKE : ACCEL * 0.6) * dt
      else state.v -= Math.sign(state.v) * Math.min(Math.abs(state.v), 1.4 * dt)
      state.v = THREE.MathUtils.clamp(state.v, -max * 0.4, max)
      state.s += state.v * dt
      state.dist += state.v * dt
      // 한 바퀴(앞으로 순환선 길이만큼) → 완주 안내 + 체험 완료 기록
      //   거리에서 한 바퀴를 빼서 다음 바퀴를 다시 셈 (안 빼면 안내가 꺼지는 4초마다 다시 뜸)
      if (closed && state.dist >= length) {
        state.dist -= length
        store.setRail({ lap: true })
        store.complete('jm_railbike_lap')
        state.lapAt = time
      }
      if (rail.lap && time - state.lapAt > 4) store.setRail({ lap: false })
      if (Math.abs(rail.speed - state.v) > 0.25) store.setRail({ speed: state.v })
    }
    place()
    // 바퀴 굴리기 (그림만)
    if (wheels.current && state.v) wheels.current.children.forEach((w) => (w.rotation.x += (state.v * dt) / 0.2))

    const g = bike.current
    const player = playerRef.current?.parent ? playerRef.current : null
    if (!g) return
    g.localToWorld(tmp.seat.set(...SEAT_LOCAL))

    // "E 타기" 안내: 바이크 가운데에서 RIDE_NEAR 안 (승강장 가운데에 서도 뜨게 — 승강장 가운데 ↔ 철길 2.2m)
    if (player && !riding) {
      player.getWorldPosition(tmp.me)
      g.getWorldPosition(tmp.p)
      const d = Math.hypot(tmp.me.x - tmp.p.x, tmp.me.z - tmp.p.z)
      const near = d < RIDE_NEAR && Math.abs(tmp.me.y - tmp.seat.y) < 1.8
      if (near && rail.near !== item.id) store.setRail({ near: item.id })
      else if (!near && rail.near === item.id) store.setRail({ near: null })
    }

    if (riding) {
      // 캐릭터 몸(물리)을 바이크 자리에 붙잡아 둠 (엘리베이터와 같은 방식)
      g.localToWorld(tmp.me.set(SEAT_LOCAL[0], 0, SEAT_LOCAL[2]))
      requestPalaceWarp([tmp.me.x, tmp.me.y + 1.05, tmp.me.z])
      // 카메라: 바이크 뒤에서 앞쪽을 보게 천천히 따라 돌림 (움직일 때만 — 멈추면 마우스로 둘러보기)
      const controls = getState().controls
      if (controls?.rotateTo && Math.abs(state.v) > 0.4) {
        g.getWorldDirection(tmp.t)
        controls.rotateTo(Math.atan2(-tmp.t.x, -tmp.t.z), controls.polarAngle, true)
      }
      // 터널 안에서는 카메라를 바짝 당김 (밖에 있으면 언덕이 화면을 가림)
      const tun = item.tunnel
      if (tun && controls?.dollyTo) {
        const inside = Math.abs(g.position.z - tun.z) < tun.half + 1 && g.position.x > tun.x0 - 3 && g.position.x < tun.x1 + 3
        const want = inside ? 2.2 : 4.4
        if (Math.abs(controls.distance - want) > 0.3) controls.dollyTo(want, true)
      }
    }

    // 앉기/일어나기: 캐릭터 모델을 운전석으로 (벤치와 같은 계산 — 바이크가 움직여서 매 프레임)
    const s = state.sit
    if (s.phase === 'sitting' && !s.model) {
      const model = findModel()
      if (model) {
        s.model = model
        s.saved = { p: model.position.clone(), q: model.quaternion.clone(), s: model.scale.clone() }
      }
    }
    if (s.phase && s.model && s.model.parent) {
      s.t = Math.min(1, s.t + dt / (s.model.userData.sitDuration || SIT_TIME))
      const k = s.phase === 'sitting' ? s.from + (1 - s.from) * ease(s.t) : s.from * (1 - ease(s.t))
      s.model.userData.seatProgress = k
      g.getWorldQuaternion(tmp.q)
      tmp.p.copy(tmp.seat)
      tmp.p.y -= s.model.userData.seatHipHeight ?? 0.45
      tmp.m.compose(tmp.p, tmp.q, tmp.s.set(1, 1, 1))
      s.model.parent.updateWorldMatrix(true, false)
      tmp.inv.copy(s.model.parent.matrixWorld).invert()
      tmp.m.premultiply(tmp.inv)
      tmp.m.decompose(tmp.p, tmp.lq, tmp.s)
      s.model.position.lerpVectors(s.saved.p, tmp.p, k)
      s.model.quaternion.slerpQuaternions(s.saved.q, tmp.lq, k)
      s.model.scale.lerpVectors(s.saved.s, tmp.s, k)
      if (s.phase === 'standing' && s.t >= 1) restoreModel()
    } else if (s.phase === 'standing') {
      restoreModel()
    }
  })

  return (
    <>
      <group ref={bike}>
        <BikeMesh variant={0} number={item.number ?? 7} wheelRef={wheels} />
      </group>
      <RailHud bikeId={item.id} />
    </>
  )
}

// Html은 항상 붙여 두고 안의 내용만 바꿈: drei Html을 붙였다 뗐다 하면(return null ↔ Html) React가 그리는 도중에
//   Html 전용 root가 지워지면서 "removeChild … not a child" 오류로 게임 화면 전체가 다시 그려질 수 있음
//   (11/27 직접 타 보며 확인: 그 순간 캐릭터 물리 몸체가 새로 만들어지고 바이크에서 내려짐)
function RailHud({ bikeId }) {
  const rail = useJmActivity((st) => st.rail)
  const placeNear = useGameStore((st) => Boolean(st.nearbyPlaceId))
  const size = useThree((st) => st.size)
  const active = rail.active === bikeId
  const hint = rail.near === bikeId && !rail.active && !placeNear
  const kmh = Math.round(Math.abs(rail.speed ?? 0) * 3.6)
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ ...wrap, width: size.width, height: size.height, display: hint || active ? 'flex' : 'none' }}>
        {active && rail.lap && <div style={{ ...chip, background: 'rgba(210,56,44,0.88)', marginBottom: 8, fontSize: 15 }}>한 바퀴 완주! 바닷길 레일바이크</div>}
        <div style={chip}>
          {active ? (
            <>
              <kbd style={kbd}>W</kbd> 앞으로 · <kbd style={kbd}>S</kbd> 브레이크·뒤로 · <kbd style={kbd}>Shift</kbd> 빠르게 · <kbd style={kbd}>E</kbd> 내리기
              <span style={{ opacity: 0.8 }}> · {kmh} km/h</span>
            </>
          ) : (
            <>
              <kbd style={kbd}>E</kbd> 레일바이크 타기
            </>
          )}
        </div>
      </div>
    </Html>
  )
}

const wrap = { position: 'absolute', left: 0, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 72, boxSizing: 'border-box' }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }

// ── 세워 둔 바이크 ──────────────────────────────────────────
// item.bikes = [[x, z, 방향(도)], ...] (item.position 기준)
function JmRailBikeParked({ item }) {
  return (
    <group>
      {(item.bikes ?? []).map(([x, z, deg], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, THREE.MathUtils.degToRad(deg ?? 0), 0]}>
          <BikeMesh variant={i + 1} number={(item.firstNumber ?? 11) + i} />
        </group>
      ))}
    </group>
  )
}

// ── 무지개 터널 (풀 언덕 속) ─────────────────────────────────
// size [길이(x), 언덕 높이, 언덕 폭]. item.inner [안쪽 폭, 안쪽 높이]
const RAINBOW = ['#ff4d4d', '#ff9a3c', '#ffe14d', '#5ee06a', '#4db8ff', '#6b6bff', '#c86bff']
const RAINBOW_MATS = RAINBOW.map((c) => mat(c, { emissive: c, emissiveIntensity: 1.3, roughness: 0.5 }))
const TUNNEL_WALL = mat('#3f3d47', { roughness: 0.95 })
const PORTAL_STONE = mat('#8d877c', { roughness: 1, flat: true })
const MOUND = new THREE.MeshStandardMaterial({ color: '#6f9a4e', roughness: 1, flatShading: true })

function tunnelSignTexture(text) {
  return canvasTexture(`railtunnel:${text}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#efe9dc'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#4a3424'
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, w - 8, h - 8)
    ctx.fillStyle = '#3a2a1e'
    ctx.font = 'bold 60px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 4)
  })
}

function JmRailTunnel({ item }) {
  const [len, H, W] = item.size
  const [iw, ih] = item.inner ?? [4.2, 3.4]
  const rings = useMemo(() => {
    const n = Math.floor((len - 1) / 1.3)
    return range(n).map((i) => ({ x: -len / 2 + 0.8 + i * 1.3, m: RAINBOW_MATS[i % RAINBOW_MATS.length] }))
  }, [len])
  const bushes = useMemo(() => {
    const out = []
    for (let i = 0; i < 9; i++) {
      const x = -len / 2 + 1.5 + ((len - 3) * ((i * 7) % 9)) / 8
      const z = ((i * 5) % 7) / 7 - 0.5
      out.push([x, z * W * 0.5, 0.7 + ((i * 3) % 4) * 0.18])
    }
    return out
  }, [len, W])
  return (
    <group>
      {/* 언덕: 철길 방향으로 누운 원통(양 끝 뚫림) — 아래 반은 땅속 */}
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[H, 1, W / 2]} material={MOUND} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, len, 22, 1, true]} />
      </mesh>
      {bushes.map(([x, z, s], i) => {
        const y = H * Math.sqrt(Math.max(0, 1 - (z / (W / 2)) ** 2))
        return (
          <mesh key={i} position={[x, y - 0.15, z]} scale={[s * 1.3, s * 0.8, s]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 2 ? '#4f7d3a' : '#5d8c43'} roughness={1} flatShading />
          </mesh>
        )
      })}
      {/* 터널 바닥 (안쪽은 풀 대신 콘크리트) — 자갈 띠(0.025)보다 아래 */}
      <Box p={[0, 0.012, 0]} s={[len + 0.4, 0.02, iw]} c="#5b5850" />
      {/* 안쪽 벽·천장 */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[0, ih / 2, s * (iw / 2 + 0.15)]} s={[len, ih, 0.3]} m={TUNNEL_WALL} />
      ))}
      <Box p={[0, ih + 0.15, 0]} s={[len, 0.3, iw + 0.6]} m={TUNNEL_WALL} />
      {/* 무지개 조명 고리 (벽 → 천장 → 벽) */}
      {rings.map((r, i) => (
        <group key={i} position={[r.x, 0, 0]}>
          <Box p={[0, ih / 2 + 0.2, -iw / 2 + 0.02]} s={[0.16, ih - 0.4, 0.04]} m={r.m} />
          <Box p={[0, ih / 2 + 0.2, iw / 2 - 0.02]} s={[0.16, ih - 0.4, 0.04]} m={r.m} />
          <Box p={[0, ih - 0.02, 0]} s={[0.16, 0.04, iw]} m={r.m} />
        </group>
      ))}
      {/* 양쪽 입구: 돌 벽(구멍 둘레) + 이름판 */}
      {[-1, 1].map((s) => (
        <group key={`portal${s}`} position={[s * (len / 2 + 0.2), 0, 0]}>
          {[-1, 1].map((z) => (
            <Box key={z} p={[0, H / 2, z * (iw / 2 + (W / 2 - iw / 2) / 2 + 0.2)]} s={[0.5, H, W / 2 - iw / 2 + 0.4]} m={PORTAL_STONE} />
          ))}
          <Box p={[0, (ih + H + 0.4) / 2, 0]} s={[0.5, H - ih + 0.4, iw + 0.2]} m={PORTAL_STONE} />
          <Box p={[s * 0.27, ih - 0.1, 0]} s={[0.1, 0.25, iw + 0.4]} c="#6b665e" />
          <mesh position={[s * 0.27, ih + 0.62, 0]} rotation={[0, s * Math.PI / 2, 0]}>
            <planeGeometry args={[2.6, 0.65]} />
            <meshStandardMaterial map={tunnelSignTexture(item.sign ?? '무지개 터널')} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── 레일바이크 역 ───────────────────────────────────────────
// size [길이(x), 지붕 높이, 승강장 깊이]. 앞(+z) = 철길 쪽 가장자리(노란 선)
function stationSignTexture(main, sub) {
  return canvasTexture(`railstation:${main}:${sub}`, 640, 200, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1f6f5c'
    ctx.fillRect(0, h * 0.68, w, h * 0.12)
    ctx.fillStyle = '#1e1e1e'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 74px sans-serif'
    ctx.fillText(main, w / 2, h * 0.36)
    ctx.font = 'bold 30px sans-serif'
    ctx.fillStyle = '#444'
    ctx.fillText(sub, w / 2, h * 0.9)
  })
}

function JmRailStation({ item }) {
  const [len, h, d] = item.size
  const top = 0.25
  const roofY = top + h
  return (
    <group>
      {/* 승강장 (콘크리트 + 철길 쪽 노란 점자 블록) */}
      <Box p={[0, top / 2, 0]} s={[len, top, d]} c="#c9c2b4" />
      <Box p={[0, top + 0.005, d / 2 - 0.35]} s={[len, 0.012, 0.3]} c="#f2c230" />
      {/* 지붕 기둥 + 맞배지붕 (붉은 기와) */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} p={[sx * (len / 2 - 1.5), top + h / 2, sz * (d / 2 - 0.5)]} rad={0.09} h={h} c="#f1efe8" />),
      )}
      {[-1, 1].map((sz) => (
        <Box key={sz} p={[0, roofY + 0.32, sz * (d / 4 + 0.15)]} s={[len - 1.2, 0.08, d / 2 + 0.75]} r={[sz * -0.32, 0, 0]} c="#b8463a" />
      ))}
      <Box p={[0, roofY + 0.62, 0]} s={[len - 1.2, 0.12, 0.2]} c="#7a2a20" />
      {/* 역 이름판 (지붕 밑, 철길 쪽) */}
      <mesh position={[0, roofY - 0.35, d / 2 - 0.45]}>
        <planeGeometry args={[2.4, 0.75]} />
        <meshStandardMaterial map={stationSignTexture(item.sign ?? '바닷길역', item.subSign ?? 'UMIBE · 海辺レールバイク')} roughness={0.7} />
      </mesh>
      <mesh position={[0, roofY - 0.35, d / 2 - 0.47]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.4, 0.75]} />
        <meshStandardMaterial map={stationSignTexture(item.sign ?? '바닷길역', item.subSign ?? 'UMIBE · 海辺レールバイク')} roughness={0.7} />
      </mesh>
      {/* 매표소: 승강장 동쪽 끝 바로 뒤(북쪽) 땅 — 승강장 위에 두면 동쪽에서 올라오는 길을 막음 */}
      <group position={[len / 2 - 1.1, 0, -d / 2 - 0.85]}>
        <Box p={[0, 1.1, 0]} s={[1.6, 2.2, 1.3]} c="#efe4cf" />
        <Box p={[0, 2.3, 0]} s={[1.9, 0.14, 1.6]} c="#7a2a20" />
        <Box p={[0, 1.35, 0.66]} s={[1.0, 0.55, 0.02]} c="#bfe3ee" />
        <Box p={[0, 1.95, 0.66]} s={[1.3, 0.28, 0.03]} c="#d2382c" />
      </group>
    </group>
  )
}

// ── 노란 울타리 ─────────────────────────────────────────────
// item.points = [[x, z], ...] (item.position 기준). 기둥 2m 간격 + 가로대 2줄
const FENCE_YELLOW = mat('#f2c230', { roughness: 0.6 })
function JmRailFence({ item }) {
  const parts = useMemo(() => {
    const posts = []
    const bars = []
    const pts = item.points ?? []
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const L = Math.hypot(bx - ax, bz - az)
      const yaw = Math.atan2(bx - ax, bz - az)
      const n = Math.max(1, Math.round(L / 2))
      for (let k = 0; k < n; k++) posts.push({ p: [ax + ((bx - ax) * k) / n, 0.5, az + ((bz - az) * k) / n], s: [0.08, 1, 0.08] })
      for (const y of [0.45, 0.9]) bars.push({ p: [(ax + bx) / 2, y, (az + bz) / 2], s: [0.05, 0.07, L + 0.05], r: [0, yaw, 0] })
    }
    if (pts.length) posts.push({ p: [pts.at(-1)[0], 0.5, pts.at(-1)[1]], s: [0.08, 1, 0.08] })
    return { posts, bars }
  }, [item.points])
  return (
    <group>
      <Instances geometry={GEO.box} material={FENCE_YELLOW} items={parts.posts} />
      <Instances geometry={GEO.box} material={FENCE_YELLOW} items={parts.bars} />
    </group>
  )
}

export const JM_RAILBIKE_STYLES = {
  jmRailTrack: JmRailTrack,
  jmRailBike: JmRailBike,
  jmRailBikeParked: JmRailBikeParked,
  jmRailTunnel: JmRailTunnel,
  jmRailStation: JmRailStation,
  jmRailFence: JmRailFence,
}
