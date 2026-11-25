import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import places from '@shared/places.json'
import { useGameStore } from '../../../store/gameStore.js'
import { useCourseStore } from '../../../store/courseStore.js'
import { useBadges } from '../../../store/badges.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useBkActivity } from './bk_activityStore.js'
import { labelLayer } from '../../labelLayer.js'
import { useDateMission } from './bk_dateMission.js'

// 데이트 코스 구역(BK) SKY 전망대 망원경. 담당: 병관
// 전망층 난간의 망원경(dateCourse.jsx DECK_SCOPES: 중앙 광장 쪽·애니 구역 쪽 2대) 앞에서 E → 망원경 화면
// - 드래그·방향키로 둘러보기, 휠·＋－로 확대, [◀ ▶]로 명소를 하나씩 자동 조준
// - 화면에 다른 구역 명소 이름·거리 표시, 가운데 맞춘 명소는 설명 + "여기로 길 안내"(미니맵, 루미 코스와 같은 방식)
// - 명소 5곳을 찾으면 🔭 배지. 카메라는 클로즈업만 덮어쓰고 공용 FollowCamera.jsx는 고치지 않음 (인형뽑기와 같은 방식)

const SCOPE_R = 6.25 // 망원경이 놓인 반지름 (dateCourse.jsx와 같음)
const STAND = 0.75 // 망원경에서 안쪽으로 이만큼이 손님 자리
const NEAR = 1.2
const EYE = new THREE.Vector3(0, 1.5, 0.75) // 보는 자리: 망원경 통 끝 바로 앞 (통이 화면을 가리지 않게, 망원경 기준 +z = 바깥)
const FOV_WIDE = 50
const FOV_TELE = 10
const PITCH_MIN = -0.6
const PITCH_MAX = 0.25
// 망원경을 보는 동안 맵 이름표(촬영지·카페 등, PlaceMarkers.jsx)를 숨김 — 공용 파일은 고치지 않고 이름표 층에 표시만 붙임
// (혜진 님 궁궐 실내와 같은 방식: labelLayer에 data 속성을 켜고 끔)
const HIDE_LABELS = 'data-bk-telescope'
const HIDE_LABELS_CSS = `[${HIDE_LABELS}] .map-place-label { display: none !important; }`
const YAW_RANGE = 1.4 // 망원경 정면에서 좌우로 돌 수 있는 한도(라디안, 약 80°) — 타워 안쪽 기둥을 보지 않게
const SPOT_GOAL = 5
const SPOT_KEY = 'scenewalk.telescope'
const ZONE_EMOJI = { HUB: '⛲', JM: '🌸', BK: '💕', HJ: '🎬', SG: '🎤' }
const ZONE_NAME = { HUB: '중앙 광장', JM: '애니메이션 구역', BK: '데이트 코스 구역', HJ: '영화·드라마 구역', SG: 'K-POP 구역' }
// 볼거리: 안내 NPC·전망대 자신은 빼고
const TARGETS = places.filter((p) => p.type !== 'npc' && p.id !== 'spot_bk_tower')

function readSpotted() {
  try {
    const list = JSON.parse(localStorage.getItem(SPOT_KEY))
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

// TowerDecor(dateCourse.jsx) 안에서 그려짐 → 좌표는 타워 기준 (전망층 바닥 = T.deckFloor)
export function TowerTelescopes({ T, angles }) {
  const scene = useThree((s) => s.scene)
  const anchors = useRef([])
  const hud = useRef(null) // 화면 안내 기준점: drei Html은 기준점이 카메라 뒤면 숨겨서, 늘 카메라 앞 2m에 둠
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), me: new THREE.Vector3() }), [])
  const store = () => useBkActivity.getState()

  useEffect(() => {
    const down = (event) => {
      const s = store().scope
      const game = useGameStore.getState()
      if (event.code === 'KeyE' && !event.repeat && s.near >= 0 && !s.active && !game.openPanel && !game.nearbyPlaceId) {
        store().setScope({ active: true, index: s.near })
        game.open({ type: 'bk_telescope', placeId: `telescope_${s.near}` })
      }
    }
    window.addEventListener('keydown', down)
    // ESC(공용 InteractionKeys)나 다른 화면이 패널을 닫으면 망원경도 닫힘
    const unsub = useGameStore.subscribe((state) => {
      const s = store().scope
      if (s.active && !String(state.openPanel?.placeId ?? '').startsWith('telescope_')) store().setScope({ active: false })
    })
    return () => {
      window.removeEventListener('keydown', down)
      unsub()
    }
  }, [])

  useFrame((state) => {
    if (hud.current?.parent) {
      state.camera.getWorldDirection(tmp.v)
      tmp.v.multiplyScalar(2).add(state.camera.position)
      hud.current.position.copy(hud.current.parent.worldToLocal(tmp.v))
    }
    const t = state.clock.elapsedTime
    const cur = store().scope
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    let near = -1
    if (player.current?.parent && !cur.active) {
      player.current.getWorldPosition(tmp.me)
      anchors.current.forEach((a, i) => {
        if (!a || near >= 0) return
        a.localToWorld(tmp.v.set(0, 0, -STAND))
        if (Math.hypot(tmp.me.x - tmp.v.x, tmp.me.z - tmp.v.z) < NEAR && Math.abs(tmp.me.y - tmp.v.y) < 2) near = i
      })
    }
    if (!cur.active && near !== cur.near) store().setScope({ near })
  })

  return (
    <group>
      {angles.map((a, i) => (
        <group key={i} ref={(el) => (anchors.current[i] = el)} position={[Math.sin(a) * SCOPE_R, T.deckFloor, Math.cos(a) * SCOPE_R]} rotation={[0, a, 0]} />
      ))}
      <group ref={hud}>
        <TelescopeHud anchors={anchors} />
      </group>
    </group>
  )
}

// 망원경 화면이 같이 쓰는 값 (카메라 쪽 ScopeCamera ↔ 화면 쪽 ScopeOverlay)
// drei Html 안은 R3F 밖이라 useThree·useFrame을 못 써서, 카메라 계산은 ScopeCamera가 하고 화면은 이 값을 읽고 바꿈
const view = {
  on: false,
  yaw: 0,
  pitch: 0,
  fov: FOV_WIDE,
  fovGoal: null,
  goal: null, // { yaw, pitch } 자동 조준
  keys: new Set(),
  dist: [], // 명소까지 거리(m)
  size: { width: 0, height: 0 },
  eye: new THREE.Vector3(),
}

function TelescopeHud({ anchors }) {
  const s = useBkActivity((state) => state.scope)
  const size = useThree((state) => state.size)
  const showHint = s.near >= 0 && !s.active
  return (
    <>
      {s.active && <ScopeCamera anchor={anchors.current[s.index]} />}
      {(showHint || s.active) && (
        <Html calculatePosition={() => [0, 0]} zIndexRange={s.active ? [16777272, 16777272] : [20, 0]} style={{ pointerEvents: 'none' }} onOcclude={keepVisible}>
          <div style={{ ...wrap, width: size.width, height: size.height }}>
            {showHint && (
              <div style={chip}>
                <kbd style={kbd}>E</kbd> 망원경 보기 🔭
              </div>
            )}
            {s.active && <ScopeOverlay width={size.width} height={size.height} />}
          </div>
        </Html>
      )}
    </>
  )
}

// 카메라 쪽: 접안렌즈 자리로 옮겨 view의 방향·화각대로 보게 하고, 이름표 위치·가운데 명소 계산
function ScopeCamera({ anchor }) {
  const camera = useThree((s) => s.camera)
  const tmp = useMemo(() => ({ fwd: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), p: new THREE.Vector3(), d: new THREE.Vector3() }), [])

  // 시작: 망원경이 바라보는 바깥쪽으로. 끝: 카메라 화각을 되돌림 (그다음은 3인칭 카메라가 다시 캐릭터 뒤로)
  useEffect(() => {
    if (!anchor) return undefined
    const savedFov = camera.fov
    anchor.getWorldQuaternion(tmp.q)
    tmp.fwd.set(0, 0, 1).applyQuaternion(tmp.q)
    const baseYaw = Math.atan2(-tmp.fwd.x, -tmp.fwd.z)
    Object.assign(view, { on: true, baseYaw, yaw: baseYaw, pitch: -0.12, fov: FOV_WIDE, fovGoal: null, goal: null })
    const down = (e) => view.keys.add(e.code)
    const up = (e) => view.keys.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    labelLayer.current?.setAttribute(HIDE_LABELS, '')
    return () => {
      labelLayer.current?.removeAttribute(HIDE_LABELS)
      view.on = false
      view.keys.clear()
      useBkActivity.getState().setScope({ focus: -1 })
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      camera.fov = savedFov
      camera.updateProjectionMatrix()
    }
  }, [anchor, camera, tmp])

  useFrame((_, delta) => {
    if (!anchor || !view.on) return
    const v = view
    const dt = Math.min(delta, 0.05)
    const keys = v.keys
    const pan = (v.fov / FOV_WIDE) * 1.2 * dt
    const press = (...codes) => codes.some((c) => keys.has(c))
    if (press('ArrowLeft', 'KeyA')) (v.yaw += pan), (v.goal = null)
    if (press('ArrowRight', 'KeyD')) (v.yaw -= pan), (v.goal = null)
    if (press('ArrowUp', 'KeyW')) (v.pitch += pan), (v.goal = null)
    if (press('ArrowDown', 'KeyS')) (v.pitch -= pan), (v.goal = null)
    if (press('Equal', 'NumpadAdd')) (v.fov *= 1 - dt), (v.fovGoal = null)
    if (press('Minus', 'NumpadSubtract')) (v.fov *= 1 + dt), (v.fovGoal = null)
    const k = 1 - Math.exp(-dt * 4)
    if (v.goal) {
      const dyaw = Math.atan2(Math.sin(v.goal.yaw - v.yaw), Math.cos(v.goal.yaw - v.yaw)) // 짧은 쪽으로 돌기
      v.yaw += dyaw * k
      v.pitch += (v.goal.pitch - v.pitch) * k
    }
    if (v.fovGoal) v.fov += (v.fovGoal - v.fov) * k
    v.pitch = THREE.MathUtils.clamp(v.pitch, PITCH_MIN, PITCH_MAX)
    const off = Math.atan2(Math.sin(v.yaw - v.baseYaw), Math.cos(v.yaw - v.baseYaw))
    v.yaw = v.baseYaw + THREE.MathUtils.clamp(off, -YAW_RANGE, YAW_RANGE)
    v.fov = THREE.MathUtils.clamp(v.fov, FOV_TELE, FOV_WIDE)

    // 카메라 덮어쓰기 (3인칭 카메라 조종이 끝난 뒤 실행됨 — 인형뽑기 클로즈업과 같음)
    anchor.localToWorld(v.eye.copy(EYE))
    camera.position.copy(v.eye)
    tmp.e.set(v.pitch, v.yaw, 0)
    camera.quaternion.setFromEuler(tmp.e)
    if (Math.abs(camera.fov - v.fov) > 0.01) {
      camera.fov = v.fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()

    // 가운데 십자선에 가장 가까운 명소 (확대할수록 더 정확히 맞춰야 함)
    camera.getWorldDirection(tmp.fwd)
    let best = -1
    let bestAngle = Infinity
    TARGETS.forEach((p, i) => {
      tmp.p.set(p.position[0], (p.position[1] ?? 0) + 3, p.position[2])
      tmp.d.subVectors(tmp.p, v.eye)
      v.dist[i] = Math.round(tmp.d.length())
      const angle = THREE.MathUtils.radToDeg(tmp.d.angleTo(tmp.fwd))
      if (angle < bestAngle && angle < Math.max(1, v.fov * 0.1)) {
        bestAngle = angle
        best = i
      }
    })
    if (best !== useBkActivity.getState().scope.focus) useBkActivity.getState().setScope({ focus: best })
  })
  return null
}

// 화면 쪽 (drei Html 안): 둥근 시야, 이름표, 설명 카드, 버튼. 카메라는 view 값만 바꿈
function ScopeOverlay({ width, height }) {
  const focus = useBkActivity((s) => s.scope.focus)
  const drag = useRef(null)
  const [aimIndex, setAimIndex] = useState(-1)
  const [spotted, setSpotted] = useState(readSpotted)
  const [caught, setCaught] = useState(readCaught)

  const aimAt = (index) => {
    const p = TARGETS[index]
    const dx = p.position[0] - view.eye.x
    const dz = p.position[2] - view.eye.z
    const dy = (p.position[1] ?? 0) + 3 - view.eye.y
    const flat = Math.hypot(dx, dz)
    view.goal = { yaw: Math.atan2(-dx, -dz), pitch: THREE.MathUtils.clamp(Math.atan2(dy, flat), PITCH_MIN, PITCH_MAX) }
    view.fovGoal = THREE.MathUtils.clamp(1800 / flat, FOV_TELE + 4, FOV_WIDE) // 멀수록 더 당겨 봄
    setAimIndex(index)
  }
  const step = (dir) => aimAt((aimIndex + dir + TARGETS.length) % TARGETS.length)
  const zoom = (k) => {
    view.fovGoal = null
    view.fov = THREE.MathUtils.clamp(view.fov * k, FOV_TELE, FOV_WIDE)
  }

  // 가운데 맞춘 명소를 "찾음"으로 기록 → 5곳이면 배지
  useEffect(() => {
    if (focus >= 0) useDateMission.getState().markDone('telescope') // 데이트 코스 미션: 명소 하나 찾기
    if (focus < 0 || spotted.has(TARGETS[focus].id)) return
    const next = new Set(spotted).add(TARGETS[focus].id)
    setSpotted(next)
    try {
      localStorage.setItem(SPOT_KEY, JSON.stringify([...next]))
    } catch {
      // 저장이 막힌 브라우저면 이번 접속에서만
    }
    if (next.size >= SPOT_GOAL && useBadges.getState().award('telescope')) {
      useUiStore.getState().toast('🔭 배지 획득: 전망대 망원경 탐험가', 'ok')
    }
  }, [focus, spotted])

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const scale = (view.fov / FOV_WIDE) * 0.003
    // 끄는 쪽으로 시야가 움직임 (오른쪽으로 끌면 오른쪽, 아래로 끌면 아래를 봄)
    view.yaw -= (e.clientX - drag.current.x) * scale
    view.pitch -= (e.clientY - drag.current.y) * scale
    view.goal = null
    drag.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => (drag.current = null)
  const onWheel = (e) => zoom(e.deltaY > 0 ? 1.12 : 0.88)

  const target = focus >= 0 ? TARGETS[focus] : null
  const goThere = () => {
    useCourseStore.getState().setCourse(
      [{ placeId: target.id, name: target.name, zone: target.zone, zoneName: ZONE_NAME[target.zone], type: target.type, position: target.position, reason: '🔭 망원경으로 찾은 곳' }],
      { telescope: target.id },
    )
    useGameStore.getState().close()
  }
  const radius = Math.min(width, height) * 0.42
  const stop = (e) => e.stopPropagation()

  return (
    <div style={{ ...full, width, height, cursor: 'grab' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
      {/* 둥근 시야 (바깥은 어둡게) + 테두리 + 십자선 */}
      <div style={{ ...full, width, height, pointerEvents: 'none', background: `radial-gradient(circle at 50% 50%, transparent ${radius - 4}px, rgba(8,6,20,0.96) ${radius}px)` }} />
      <div style={{ ...ring, width: radius * 2, height: radius * 2, left: width / 2 - radius, top: height / 2 - radius }} />
      <div style={{ ...cross, left: width / 2 - 14, top: height / 2 }} />
      <div style={{ ...cross, left: width / 2, top: height / 2 - 14, width: 1, height: 28 }} />

      <style>{HIDE_LABELS_CSS}</style>
      <ShootingStars width={width} height={height} radius={radius} onCatch={setCaught} />

      <div style={topBar} onPointerDown={stop}>
        🔭 찾은 명소 {Math.min(spotted.size, TARGETS.length)}/{SPOT_GOAL}
        {spotted.size >= SPOT_GOAL && ' 🏅'} · 🌠 별똥별 {caught}
      </div>

      <div style={bottom} onPointerDown={stop} onWheel={stop}>
        {target ? (
          <div style={card}>
            <div style={{ fontSize: 12, color: '#e7c35a', fontWeight: 700 }}>
              {ZONE_EMOJI[target.zone]} {ZONE_NAME[target.zone]} · 약 {view.dist[focus] ?? 0}m
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, margin: '2px 0 4px' }}>{target.name}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>{target.description}</div>
            <button type="button" style={{ ...btn, width: '100%', marginTop: 8 }} onClick={goThere}>🗺️ 여기로 길 안내 (미니맵)</button>
          </div>
        ) : (
          <div style={{ ...card, textAlign: 'center', opacity: 0.9 }}>드래그·방향키로 둘러보며 건물을 가운데 십자선에 맞춰 보세요. [다음 명소 ▶]를 누르면 자동으로 찾아가요. 가끔 떨어지는 🌠 별똥별을 눌러 소원도 빌어 보세요!</div>
        )}
        <div style={controlsRow}>
          <button type="button" style={ghostBtn} onClick={() => step(-1)}>◀ 이전 명소</button>
          <button type="button" style={ghostBtn} onClick={() => zoom(0.75)}>＋</button>
          <button type="button" style={ghostBtn} onClick={() => zoom(1.33)}>－</button>
          <button type="button" style={ghostBtn} onClick={() => step(1)}>다음 명소 ▶</button>
          <button type="button" style={btn} onClick={() => useGameStore.getState().close()}>닫기 <kbd style={kbd}>ESC</kbd></button>
        </div>
      </div>
    </div>
  )
}

// ── 🌠 별똥별 미니게임: 망원경으로 보는 동안 가끔(12~25초마다) 하늘을 가로지름 → 사라지기 전에 누르면 소원 성공
const STAR_FIRST = [5, 9] // 처음 별똥별까지 (초)
const STAR_GAP = [12, 25] // 그다음부터 간격 (초) — 너무 자주 떨어지지 않게
const STAR_LIFE = 1.6 // 화면을 가로지르는 시간 (초)
const STAR_GOAL = 3 // 이만큼 잡으면 배지
const STAR_KEY = 'scenewalk.shootingStars'
const WISHES = [
  '소원이 별에 닿았어요 ✨',
  '다음 데이트도 오늘처럼 반짝이기를 🌟',
  '둘이 함께 본 첫 별똥별이에요 💫',
  '빌었던 소원, 꼭 이뤄질 거예요 🌠',
  '오늘 밤 하늘이 두 사람 편이에요 🌙',
]
const between = ([a, b]) => a + Math.random() * (b - a)

function readCaught() {
  try {
    return Number(localStorage.getItem(STAR_KEY)) || 0
  } catch {
    return 0
  }
}

function ShootingStars({ width, height, radius, onCatch }) {
  const [star, setStar] = useState(null) // { id, x, y, dx, dy }
  const [wish, setWish] = useState(null)

  // 다음 별똥별 예약 (지금 떠 있는 게 끝나면 다시 예약)
  useEffect(() => {
    if (star) {
      const gone = setTimeout(() => setStar(null), STAR_LIFE * 1000)
      return () => clearTimeout(gone)
    }
    const first = readCaught() === 0 && !wish
    const wait = setTimeout(() => {
      // 둥근 시야 위쪽 절반에서 시작해 대각선 아래로
      const dir = Math.random() < 0.5 ? -1 : 1
      const x = width / 2 - dir * radius * (0.2 + Math.random() * 0.45)
      const y = height / 2 - radius * (0.35 + Math.random() * 0.4)
      setStar({ id: Date.now(), x, y, dx: dir * radius * 0.8, dy: radius * 0.45 })
    }, between(first ? STAR_FIRST : STAR_GAP) * 1000)
    return () => clearTimeout(wait)
  }, [star, wish, width, height, radius])

  useEffect(() => {
    if (!wish) return undefined
    const t = setTimeout(() => setWish(null), 2600)
    return () => clearTimeout(t)
  }, [wish])

  const catchIt = (e) => {
    e.stopPropagation() // 시야 드래그로 넘어가지 않게
    setStar(null)
    const count = readCaught() + 1
    try {
      localStorage.setItem(STAR_KEY, String(count))
    } catch {
      // 저장이 막힌 브라우저면 이번 접속에서만
    }
    onCatch(count)
    setWish(WISHES[Math.floor(Math.random() * WISHES.length)])
    if (count >= STAR_GOAL && useBadges.getState().award('shooting_star')) {
      setTimeout(() => useUiStore.getState().toast('🌠 배지 획득: 별똥별 소원', 'ok'), 800)
    }
  }

  return (
    <>
      <style>{STAR_CSS}</style>
      {star && (
        <button
          key={star.id}
          type="button"
          aria-label="별똥별 잡기"
          className="bk-shooting-star"
          onPointerDown={catchIt}
          style={{ ...starBtn, left: star.x, top: star.y, '--dx': `${star.dx}px`, '--dy': `${star.dy}px`, '--tilt': `${Math.atan2(star.dy, star.dx)}rad` }}
        >
          <span style={{ ...starTail, transform: `rotate(${Math.atan2(star.dy, star.dx)}rad)` }} />
          <span style={starHead}>✦</span>
        </button>
      )}
      {wish && <div style={{ ...wishBox, left: width / 2, top: height / 2 - radius * 0.55 }}>🌠 {wish}</div>}
    </>
  )
}

const STAR_CSS = `
@keyframes bkShootingStar { 0% { transform: translate(0, 0); opacity: 0 } 12% { opacity: 1 } 80% { opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)); opacity: 0 } }
@keyframes bkWish { 0% { opacity: 0; transform: translate(-50%, 6px) } 15% { opacity: 1; transform: translate(-50%, 0) } 85% { opacity: 1 } 100% { opacity: 0 } }
.bk-shooting-star { animation: bkShootingStar ${STAR_LIFE}s linear forwards; }
`
const starBtn = { position: 'absolute', width: 56, height: 56, marginLeft: -28, marginTop: -28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', pointerEvents: 'auto' }
const starHead = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', color: '#fff8d6', fontSize: 22, textShadow: '0 0 8px #fff, 0 0 18px #ffe08a' }
const starTail = { position: 'absolute', left: '50%', top: '50%', width: 90, height: 3, marginLeft: -90, marginTop: -1.5, borderRadius: 3, transformOrigin: '100% 50%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,248,214,0.95))' }
const wishBox = { position: 'absolute', padding: '6px 14px', borderRadius: 999, background: 'rgba(36,24,64,0.9)', border: '1px solid #ffe08a', color: '#fff8d6', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none', animation: 'bkWish 2.6s ease-out forwards' }

const wrap = { position: 'absolute', left: 0, top: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 72, boxSizing: 'border-box' }
const full = { position: 'absolute', left: 0, top: 0, pointerEvents: 'auto', touchAction: 'none' }
const ring = { position: 'absolute', borderRadius: '50%', border: '3px solid rgba(231,195,90,0.7)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)', pointerEvents: 'none' }
const cross = { position: 'absolute', width: 28, height: 1, background: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }
const topBar = { position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', padding: '4px 12px', borderRadius: 999, background: 'rgba(36,24,64,0.85)', color: '#fff', fontSize: 13, pointerEvents: 'auto', whiteSpace: 'nowrap' }
const bottom = { position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)', width: 'min(400px, calc(100vw - 24px))', pointerEvents: 'auto' }
const card = { padding: '10px 14px', borderRadius: 14, background: 'rgba(36,24,64,0.94)', color: '#fff', border: '1px solid rgba(231,195,90,0.5)', fontSize: 13 }
const controlsRow = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const btn = { padding: '7px 14px', borderRadius: 999, border: 'none', background: '#e7c35a', color: '#2a1d47', fontWeight: 700, cursor: 'pointer' }
const ghostBtn = { padding: '7px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(36,24,64,0.85)', color: '#fff', cursor: 'pointer' }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }

// drei Html 화면 고정 위치가 처음 한 번 숨겨진 채로 굳지 않게 (bk_clawMachine.jsx와 같음)
function keepVisible() {}
