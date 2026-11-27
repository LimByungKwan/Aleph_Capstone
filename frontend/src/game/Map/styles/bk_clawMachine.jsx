import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGameStore } from '../../../store/gameStore.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useBkActivity } from './bk_activityStore.js'
import { GEO, mat, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'
import { HanokRoof, INTERIOR_MAT, LANTERN, nightGlow, piece } from './dateCourse.jsx'
import { findPlayer } from '../../Player/findPlayer.js'

// 데이트 코스 구역(BK) 인형뽑기 부스 + 미니게임. 담당: 병관
//
// 기계 앞에서 E → 조작 모드(캐릭터 멈춤, 기계 유리 상자를 크게 보는 전용 카메라로 바뀜)
// 1·2·3 또는 화면 버튼으로 난이도(쉬움·보통·어려움) 선택
// ←↑↓→ 또는 WASD로 집게 이동 → Space로 내리기 → 집게가 내려가 인형을 집고 올라와 배출구로 → 놓기
// 인형 가운데를 정확히 노릴수록 잘 잡히고, 올라오다 미끄러질 수도 있음. 인형 1개를 뽑으면 체험 완료. ESC로 나감.
//
// 물리 엔진 없이 집게·인형만 직접 계산 (지민 님 농구, 분수 동전 던지기와 같은 방식) → 가볍고 공용 파일을 안 건드림.
// 부스·기계 모양은 조각을 1개로 합치고, 움직이는 집게·인형만 따로 그림.

// ── 기계 안 좌표 (기계 가운데 기준, 앞 = +z) ──
const LIFT = 0.18 // 부스 마루가 높아진 만큼 기계 전체를 올림
const M = { z: 0.1, bodyH: 0.95, floorY: 1.09 + LIFT, topY: 2.1 + LIFT, half: [0.55, 0.45] }
const CHUTE = { x: -0.45, z: 0.33, r: 0.15 } // 배출구 (앞 왼쪽)
const DROP_SPEED = 0.7 // m/s (위아래)
// 난이도: time 한 판 이동 시간(초), speed 집게 속도(m/s), radius 집을 수 있는 거리,
//         best/edge 가운데·가장자리에서 잡힐 확률, slip 올라오다 미끄러질 확률
export const CLAW_LEVELS = {
  easy: { label: '쉬움', key: 'Digit1', time: 25, speed: 0.45, radius: 0.14, best: 0.95, edge: 0.6, slip: 0.08 },
  normal: { label: '보통', key: 'Digit2', time: 15, speed: 0.55, radius: 0.11, best: 0.75, edge: 0.3, slip: 0.25 },
  hard: { label: '어려움', key: 'Digit3', time: 10, speed: 0.7, radius: 0.09, best: 0.55, edge: 0.15, slip: 0.4 },
}
const levelOf = (c) => CLAW_LEVELS[c.level] ?? CLAW_LEVELS.normal
// 인형이 놓일 수 있는 빈자리 (배출구 근처 제외) 중 아무 데나
function randomSpot(random = Math.random) {
  for (;;) {
    const x = (random() * 2 - 1) * (M.half[0] - 0.08)
    const z = (random() * 2 - 1) * (M.half[1] - 0.08)
    if (Math.hypot(x - CHUTE.x, z - CHUTE.z) > CHUTE.r + 0.2) return [x, z]
  }
}
const START = [0.3, -0.1] // 한 판 시작할 때 집게 위치
const DOLL_SPOTS = [
  [0.35, -0.25],
  [0.05, -0.3],
  [-0.3, -0.25],
  [0.4, 0.18],
  [0.1, 0.06],
  [-0.2, 0.0],
  [0.28, 0.38],
  [-0.05, 0.32],
]
const DOLL_KINDS = [
  { body: '#f9a8d4', head: '#fbcfe8', ear: '#f472b6' }, // 분홍 곰
  { body: '#ffffff', head: '#f5f5f4', ear: '#fda4af' }, // 하얀 토끼
  { body: '#fde68a', head: '#fef3c7', ear: '#f59e0b' }, // 노란 병아리
  { body: '#c4b5fd', head: '#ddd6fe', ear: '#8b5cf6' }, // 보라 곰
  { body: '#a5f3fc', head: '#cffafe', ear: '#22d3ee' }, // 하늘 고양이
]

const C = { cream: '#fbf3e6', coral: '#ff8a7a', pink: '#f9a8d4', dark: '#3b3633', wood: '#8b5e3c', woodLight: '#b07a4f', beam: '#6b3f2a', stone: '#b9b4a8', hanji: '#f6eedd', gold: '#e7c35a', lamp: '#fff1c9' }
// 부스 크기 (앞 = +z = 거리 쪽)
const B = { w: 3.4, d: 2.6, postH: 2.7 }
const GLASS = mat('#e6f4ff', { transparent: true, opacity: 0.18, roughness: 0.05, double: true })
const CLAW_MAT = mat('#cfd3d8', { metalness: 0.6, roughness: 0.35 })

// ── 부스 + 기계 모양 (한 번만 만들어 재사용) ──
let boothGeo = null
function boothGeometry() {
  if (boothGeo) return boothGeo
  const P = []
  const hw = B.w / 2
  const hd = B.d / 2
  // 돌 기단 + 나무 마루
  P.push(piece('box', [0, 0.12, 0], [B.w + 0.3, 0.24, B.d + 0.3], C.stone))
  P.push(piece('box', [0, 0.26, 0], [B.w, 0.05, B.d], C.woodLight))
  // 기둥 4개 (주춧돌 + 나무 기둥) + 위 보(가로 들보)
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    P.push(piece('box', [x, 0.36, z], [0.36, 0.2, 0.36], '#9c958b'))
    P.push(piece('cyl', [x, 0.28 + B.postH / 2, z], [0.12, B.postH, 0.12], C.wood))
  }
  for (const z of [-hd, hd]) P.push(piece('box', [0, B.postH + 0.2, z], [B.w + 0.3, 0.22, 0.22], C.beam))
  for (const x of [-hw, hw]) P.push(piece('box', [x, B.postH + 0.2, 0], [0.22, 0.22, B.d + 0.3], C.beam))
  // 뒷벽·옆벽: 한지 벽 + 나무 창살 (아래는 나무 판벽)
  const lattice = (cx, cz, w, rotY) => {
    const parts = [piece('box', [0, 1.55, 0], [w, 2.3, 0.06], C.hanji), piece('box', [0, 0.6, 0.02], [w, 0.65, 0.07], C.woodLight)]
    const cols = Math.round(w / 0.32)
    for (let i = 1; i < cols; i++) parts.push(piece('box', [-w / 2 + (w * i) / cols, 1.75, 0.04], [0.035, 1.9, 0.03], C.wood))
    for (let j = 0; j < 6; j++) parts.push(piece('box', [0, 0.95 + j * 0.34, 0.04], [w, 0.035, 0.03], C.wood))
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, 0, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1))
    parts.forEach((g) => g.applyMatrix4(m))
    return parts
  }
  P.push(...lattice(0, -hd + 0.05, B.w - 0.24, 0))
  P.push(...lattice(-hw + 0.05, -0.35, B.d - 0.95, Math.PI / 2))
  P.push(...lattice(hw - 0.05, -0.35, B.d - 0.95, -Math.PI / 2))
  // 처마 밑 분홍 장식 띠 + 벚꽃 화분 두 개 (앞 양옆)
  P.push(piece('box', [0, B.postH + 0.02, hd + 0.12], [B.w + 0.2, 0.08, 0.04], C.pink))
  for (const sx of [-1, 1]) {
    const x = sx * (hw + 0.45)
    P.push(piece('box', [x, 0.25, hd - 0.2], [0.55, 0.5, 0.55], '#a35d47'))
    P.push(piece('cyl', [x, 0.9, hd - 0.2], [0.05, 0.9, 0.05], '#6b4f3a'))
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      P.push(piece('ico1', [x + Math.cos(a) * 0.22, 1.45 + (k % 2) * 0.12, hd - 0.2 + Math.sin(a) * 0.22], [0.26, 0.2, 0.26], k % 2 ? '#fbcfe8' : '#f9a8d4', 0.15))
    }
  }
  const machineStart = P.length
  // 기계 몸통 (분홍) + 앞 조작판(조이스틱·버튼·동전 투입구) + 상품 꺼내는 문
  P.push(piece('box', [0, 0.1 + M.bodyH / 2, M.z], [1.4, M.bodyH, 1.2], C.pink))
  P.push(piece('box', [0, 0.98, M.z + 0.68], [1.4, 0.08, 0.3], C.cream))
  P.push(piece('cyl', [0.25, 1.06, M.z + 0.7], [0.025, 0.12, 0.025], C.dark))
  P.push(piece('ico1', [0.25, 1.14, M.z + 0.7], [0.05, 0.05, 0.05], '#ef4444'))
  P.push(piece('cyl', [0.48, 1.03, M.z + 0.7], [0.05, 0.03, 0.05], '#ef4444', 0.8))
  P.push(piece('box', [-0.3, 0.75, M.z + 0.61], [0.12, 0.2, 0.02], C.gold, 0.5))
  P.push(piece('box', [-0.45, 0.38, M.z + 0.61], [0.36, 0.3, 0.02], '#2b2d30'))
  // 유리 상자 모서리 기둥 + 위 간판 상자(전구 둘레)
  for (const [x, z] of [[-0.69, M.z - 0.59], [0.69, M.z - 0.59], [-0.69, M.z + 0.59], [0.69, M.z + 0.59]]) P.push(piece('box', [x, 1.65, z], [0.04, 1.2, 0.04], C.cream))
  P.push(piece('box', [0, 2.42, M.z], [1.5, 0.36, 1.3], C.woodLight))
  for (let i = 0; i < 12; i++) P.push(piece('ico', [-0.66 + i * 0.12, 2.42, M.z + 0.66], [0.035, 0.035, 0.035], C.lamp, 1.8))
  // 유리 상자 안 바닥 + 배출구(어두운 구멍 + 투명 칸막이는 따로) + 집게 레일
  P.push(piece('box', [0, M.floorY - 0.02, M.z], [1.36, 0.04, 1.16], '#fde4ef'))
  P.push(piece('box', [CHUTE.x, M.floorY + 0.001, M.z + CHUTE.z], [CHUTE.r * 2, 0.01, CHUTE.r * 2], '#2b2d30'))
  for (const z of [-0.5, 0.5]) P.push(piece('box', [0, 2.2, M.z + z], [1.3, 0.03, 0.03], '#9ca3af'))
  // 바닥판·구멍·레일은 이미 M.floorY 기준이라 빼고, 나머지 기계 조각만 올림
  for (let i = machineStart; i < P.length - 4; i++) P[i].translate(0, LIFT, 0)
  P[P.length - 2].translate(0, LIFT, 0)
  P[P.length - 1].translate(0, LIFT, 0)
  boothGeo = mergeGeometries(P)
  P.forEach((g) => g.dispose())
  return boothGeo
}

// 인형 모양 (몸통·머리·귀) — 종류마다 한 번만
const dollGeos = new Map()
function dollGeometry(kind) {
  if (dollGeos.has(kind)) return dollGeos.get(kind)
  const k = DOLL_KINDS[kind]
  const g = mergeGeometries([
    piece('ico1', [0, 0.1, 0], [0.11, 0.1, 0.1], k.body),
    piece('ico1', [0, 0.24, 0.01], [0.085, 0.08, 0.08], k.head),
    piece('ico1', [-0.06, 0.32, 0], [0.03, 0.035, 0.025], k.ear),
    piece('ico1', [0.06, 0.32, 0], [0.03, 0.035, 0.025], k.ear),
    piece('ico', [0, 0.23, 0.085], [0.02, 0.015, 0.01], '#3b3633'),
  ])
  dollGeos.set(kind, g)
  return g
}

export function ClawBooth({ item }) {
  // 한옥 가게처럼 진한 나무 현판 + 크림 글씨
  const sign = item.signs?.[0] ?? { text: '인형뽑기', bg: '#5b3a29', fg: '#fbf3e6' }
  const signMat = useMemo(() => nightGlow(texMat(getSignTexture(sign.text, sign.bg, sign.fg, 1.9 / 0.42), { emissive: '#ffffff', emissiveIntensity: 0.2 }), 0.9), [sign.text, sign.bg, sign.fg])
  return (
    <group userData={{ noShadow: true }}>
      <mesh geometry={boothGeometry()} material={INTERIOR_MAT} />
      {/* 기와 지붕 (데이트 코스 한옥 가게와 같은 지붕) */}
      <HanokRoof w={B.w + 1.1} d={B.d + 1.0} y={B.postH + 0.3} h={1.05} lift={0.35} />
      {/* 처마 끝 청사초롱 두 개 */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (B.w / 2 + 0.05), B.postH - 0.2, B.d / 2 + 0.25]}>
          <mesh geometry={GEO.cyl8} material={mat('#2b2d30')} position={[0, 0.32, 0]} scale={[0.01, 0.3, 0.01]} />
          <mesh geometry={GEO.cyl} material={mat('#d64b3c', { emissive: '#ff6a4d', emissiveIntensity: 0.4 })} scale={[0.17, 0.36, 0.17]} />
          <mesh geometry={GEO.cyl} material={LANTERN} position={[0, 0, 0]} scale={[0.12, 0.2, 0.12]} />
        </group>
      ))}
      {/* 현판 (처마 밑 앞쪽) */}
      <mesh geometry={GEO.box} material={mat(C.beam)} position={[0, B.postH - 0.12, B.d / 2 + 0.13]} scale={[2.05, 0.52, 0.06]} />
      <mesh geometry={GEO.plane} material={signMat} position={[0, B.postH - 0.12, B.d / 2 + 0.165]} scale={[1.9, 0.42, 1]} />
      {/* 유리 상자 + 배출구 칸막이 (투명) */}
      <mesh geometry={GEO.box} material={GLASS} position={[0, 1.65 + LIFT, M.z]} scale={[1.38, 1.18, 1.18]} renderOrder={2} />
      <mesh geometry={GEO.box} material={GLASS} position={[CHUTE.x, M.floorY + 0.12, M.z + CHUTE.z]} scale={[CHUTE.r * 2 + 0.02, 0.24, CHUTE.r * 2 + 0.02]} renderOrder={2} />
      <ClawGame item={item} />
    </group>
  )
}

// ════════════════════════════════════════════
// 게임
// ════════════════════════════════════════════
function ClawGame({ item }) {
  const scene = useThree((state) => state.scene)
  const getState = useThree((state) => state.get)
  // 클로즈업: 화면 카메라는 그대로 두고, 3인칭 카메라 조종(공용 FollowCamera, 우선순위 -1)이 끝난 뒤
  // 매 프레임 위치·방향만 기계 앞으로 덮어씀 → 공용 파일을 안 건드리고, 끝나면 3인칭 화면으로 돌아감
  const closeUp = useRef({ on: false, pos: new THREE.Vector3(), quat: new THREE.Quaternion() })
  const anchor = useRef(null)
  const clawRef = useRef(null)
  const cableRef = useRef(null)
  const prongRefs = useRef([])
  const dollRefs = useRef([])
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const keys = useRef(new Set())
  const touchKeys = useRef(new Map())
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), me: new THREE.Vector3(), front: new THREE.Vector3(), q: new THREE.Quaternion(), look: new THREE.Vector3(), m: new THREE.Matrix4(), q2: new THREE.Quaternion() }), [])

  // 인형 상태: 기계 안 위치 x, z (y는 바닥), 집혔는지, 떨어지는 중인지, 이미 뽑혔는지
  const dolls = useRef(DOLL_SPOTS.map(([x, z], i) => ({ x, z, y: 0, vy: 0, kind: i % DOLL_KINDS.length, held: false, won: false, rot: (i * 1.7) % (Math.PI * 2) })))
  // 집게 상태
  const claw = useRef({ x: START[0], z: START[1], y: M.topY, open: 0.2, held: -1, timer: 0, slipAt: -1 })

  const store = () => useBkActivity.getState()

  function open() {
    const c = store().claw
    const game = useGameStore.getState()
    if (!c.near || c.active || game.openPanel || game.nearbyPlaceId) return
    store().startClaw(levelOf(c).time)
    resetClaw()
    game.open({ type: 'bk_claw', placeId: item.id })
    enterCloseUp()
  }

  // 키 입력
  useEffect(() => {
    const down = (event) => {
      const c = store().claw
      if (event.code === 'KeyE' && !event.repeat && !c.active) return open()
      if (!c.active) return
      keys.current.add(event.code)
      if (event.code === 'Space' && !event.repeat && c.phase === 'move') startDrop()
      // 1·2·3: 난이도 (집게를 움직이는 중에만 바꿀 수 있고, 시간도 새로 시작)
      const picked = Object.entries(CLAW_LEVELS).find(([, lv]) => lv.key === event.code)
      if (picked && c.phase === 'move') setLevel(picked[0])
    }
    const up = (event) => keys.current.delete(event.code)
    const clearInput = () => { keys.current.clear(); touchKeys.current.clear() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clearInput)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clearInput)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // ESC(공용 InteractionKeys)로 패널이 닫히면 조작 끝
  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        const c = store().claw
        if (c.active && state.openPanel?.placeId !== item.id) {
          store().endClaw()
          keys.current.clear()
          touchKeys.current.clear()
          exitCloseUp()
          // 집고 있던 인형은 그 자리에 떨어뜨림
          const cl = claw.current
          if (cl.held >= 0) dropHeld()
          cl.y = M.topY
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id],
  )

  function resetClaw() {
    const cl = claw.current
    if (cl.held >= 0) dropHeld()
    // 새로 시작할 때마다 인형 자리를 살짝 흩뜨림 (같은 조작으로 매번 뽑히지 않게)
    dolls.current.forEach((d) => {
      if (d.held || d.won) return
      d.x = THREE.MathUtils.clamp(d.x + (Math.random() - 0.5) * 0.1, -M.half[0] + 0.08, M.half[0] - 0.08)
      d.z = THREE.MathUtils.clamp(d.z + (Math.random() - 0.5) * 0.1, -M.half[1] + 0.08, M.half[1] - 0.08)
    })
    Object.assign(cl, { x: START[0], z: START[1], y: M.topY, open: 0.2, timer: 0, slipAt: -1 })
    keys.current.clear()
  }

  // 클로즈업 시작: 지금 카메라 자리에서 출발해 기계 앞으로 부드럽게 다가감
  function enterCloseUp() {
    const camera = getState().camera
    closeUp.current.pos.copy(camera.position)
    closeUp.current.quat.copy(camera.quaternion)
    closeUp.current.on = true
    // 밑에서 도는 3인칭 카메라도 기계 쪽을 보게 돌려 둠 (화면 안내가 보이고, ESC 뒤에도 기계를 바라봄)
    const controls = getState().controls
    if (controls?.rotateTo && anchor.current) {
      anchor.current.getWorldQuaternion(tmp.q)
      tmp.front.set(0, 0, 1).applyQuaternion(tmp.q)
      controls.rotateTo(Math.atan2(tmp.front.x, tmp.front.z), 1.2, false)
    }
  }
  function exitCloseUp() {
    closeUp.current.on = false // 덮어쓰기를 멈추면 3인칭 카메라가 다시 캐릭터 뒤로
  }

  function setLevel(level) {
    store().setClaw({ level, timeLeft: CLAW_LEVELS[level].time })
  }

  function startDrop() {
    if (store().claw.phase !== 'move') return
    const cl = claw.current
    cl.timer = 0
    store().setClaw({ phase: 'drop', tries: store().claw.tries + 1, lastResult: null })
  }

  function dropHeld() {
    const cl = claw.current
    const d = dolls.current[cl.held]
    if (!d) return
    d.held = false
    d.x = cl.x
    d.z = cl.z
    d.y = Math.max(0, cl.y - 0.36 - M.floorY)
    d.vy = 0
    cl.held = -1
  }

  // 집게 아래 가장 가까운 인형
  function nearestDoll(x, z) {
    let best = -1
    let bestD = Infinity
    dolls.current.forEach((d, i) => {
      if (d.won || d.held) return
      const dist = Math.hypot(d.x - x, d.z - z)
      if (dist < bestD) {
        bestD = dist
        best = i
      }
    })
    return { index: best, dist: bestD }
  }

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    if (!anchor.current) return
    const st = store()
    const c = st.claw
    const cl = claw.current

    const cu = closeUp.current
    if (cu.on && !c.active) cu.on = false
    if (cu.on) {
      // 기계 앞 위쪽에서 유리 상자 안을 내려다보는 자리
      anchor.current.localToWorld(tmp.v.set(0, M.floorY + 1.05, M.z + 2.05))
      anchor.current.localToWorld(tmp.look.set(0, M.floorY + 0.3, M.z))
      const k = 1 - Math.exp(-dt * 4)
      cu.pos.lerp(tmp.v, k)
      tmp.m.lookAt(cu.pos, tmp.look, THREE.Object3D.DEFAULT_UP)
      tmp.q2.setFromRotationMatrix(tmp.m)
      cu.quat.slerp(tmp.q2, k)
      const camera = getState().camera
      camera.position.copy(cu.pos)
      camera.quaternion.copy(cu.quat)
      camera.updateMatrixWorld()
    }

    // 캐릭터 찾기 + 기계 앞인지 (앞쪽 1.9m 안)
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = findPlayer(scene)
    }
    if (player.current?.parent) {
      anchor.current.localToWorld(tmp.v.set(0, 0, M.z + 1.0))
      player.current.getWorldPosition(tmp.me)
      const near = Math.hypot(tmp.me.x - tmp.v.x, tmp.me.z - tmp.v.z) < 1.9 && Math.abs(tmp.me.y - tmp.v.y) < 2
      if (near !== c.near) st.setClaw({ near })
    } else if (c.near) st.setClaw({ near: false })

    if (c.active) {
      switch (c.phase) {
        case 'move': {
          const pressed = (code, alternate) => keys.current.has(code) || keys.current.has(alternate) || touchKeys.current.has(code)
          const dx = Number(pressed('ArrowRight', 'KeyD')) - Number(pressed('ArrowLeft', 'KeyA'))
          const dz = Number(pressed('ArrowDown', 'KeyS')) - Number(pressed('ArrowUp', 'KeyW'))
          const speed = levelOf(c).speed
          cl.x = THREE.MathUtils.clamp(cl.x + dx * speed * dt, -M.half[0], M.half[0])
          cl.z = THREE.MathUtils.clamp(cl.z + dz * speed * dt, -M.half[1], M.half[1])
          cl.open += (0.2 - cl.open) * Math.min(1, dt * 6)
          const left = Math.max(0, c.timeLeft - dt)
          if (Math.ceil(left * 10) !== Math.ceil(c.timeLeft * 10)) st.setClaw({ timeLeft: left })
          else c.timeLeft = left
          if (left <= 0) startDrop()
          break
        }
        case 'drop': {
          // 내려가며 집게 벌림. 인형이 바로 아래 있으면 인형 머리 높이까지만
          cl.open += (0.75 - cl.open) * Math.min(1, dt * 5)
          const { dist } = nearestDoll(cl.x, cl.z)
          const stopY = M.floorY + (dist < levelOf(c).radius * 1.6 ? 0.3 : 0.06) + 0.06
          cl.y = Math.max(stopY, cl.y - DROP_SPEED * dt)
          if (cl.y <= stopY) {
            cl.timer = 0
            st.setClaw({ phase: 'grab' })
          }
          break
        }
        case 'grab': {
          cl.timer += dt
          cl.open += (0.12 - cl.open) * Math.min(1, dt * 5)
          if (cl.timer > 0.7) {
            // 가운데를 정확히 노릴수록 잘 잡힘 (가운데 75% → 가장자리 30%)
            const { index, dist } = nearestDoll(cl.x, cl.z)
            const lv = levelOf(c)
            const chance = dist < 0.04 ? lv.best : lv.best - ((dist - 0.04) / (lv.radius - 0.04)) * (lv.best - lv.edge)
            if (index >= 0 && dist < lv.radius && Math.random() < chance) {
              cl.held = index
              dolls.current[index].held = true
              cl.slipAt = Math.random() < lv.slip ? 0.25 + Math.random() * 0.6 : -1 // 올라가기~옮기기 중 미끄러질 시점
            }
            cl.timer = 0
            st.setClaw({ phase: 'lift' })
          }
          break
        }
        case 'lift':
        case 'return': {
          if (c.phase === 'lift') {
            cl.y = Math.min(M.topY, cl.y + DROP_SPEED * 0.8 * dt)
            if (cl.y >= M.topY) {
              cl.timer = 0
              st.setClaw({ phase: 'return' })
            }
          } else {
            // 배출구 위로 천천히 이동
            const ddx = CHUTE.x - cl.x
            const ddz = CHUTE.z - cl.z
            const dd = Math.hypot(ddx, ddz)
            const step = levelOf(c).speed * 0.8 * dt
            if (dd <= step) {
              cl.x = CHUTE.x
              cl.z = CHUTE.z
              cl.timer = 0
              st.setClaw({ phase: 'release' })
            } else {
              cl.x += (ddx / dd) * step
              cl.z += (ddz / dd) * step
            }
          }
          // 미끄러짐: 진행도(올라감 0~0.5, 옮김 0.5~1)가 slipAt을 지나면 놓침
          if (cl.held >= 0 && cl.slipAt >= 0) {
            const progress = c.phase === 'lift' ? 0.5 * ((cl.y - M.floorY) / (M.topY - M.floorY)) : 0.5 + 0.5 * (1 - Math.min(1, Math.hypot(CHUTE.x - cl.x, CHUTE.z - cl.z) / 0.9))
            if (progress >= cl.slipAt) {
              dropHeld()
              cl.slipAt = -1
              st.setClaw({ lastResult: 'slip' })
            }
          }
          break
        }
        case 'release': {
          cl.timer += dt
          cl.open += (0.75 - cl.open) * Math.min(1, dt * 5)
          if (cl.timer > 0.25 && cl.held >= 0) {
            const d = dolls.current[cl.held]
            d.held = false
            d.x = cl.x
            d.z = cl.z
            d.y = cl.y - 0.36 - M.floorY
            d.vy = 0
            d.won = true // 배출구로 쏙 (떨어지는 연출 뒤 사라짐)
            cl.held = -1
            const wins = st.claw.wins + 1
            st.setClaw({ wins, lastResult: 'win' })
            useUiStore.getState().toast?.(`🧸 인형 뽑기 성공! (${wins}개째)`, 'success')
            if (st.complete('bk_claw')) useUiStore.getState().toast?.('💗 인형뽑기 체험 완료', 'success')
          }
          if (cl.timer > 0.9) {
            if (st.claw.lastResult === null) st.setClaw({ lastResult: 'miss' })
            // 다음 판: 시작 위치로
            Object.assign(cl, { x: START[0], z: START[1], timer: 0 })
            st.setClaw({ phase: 'move', timeLeft: levelOf(st.claw).time })
          }
          break
        }
      }
    }

    // 떨어지는 인형 (놓쳤거나 배출구로 들어갈 때)
    dolls.current.forEach((d) => {
      if (d.held) return
      if (d.y > 0 || d.vy !== 0 || (d.won && d.y > -0.6)) {
        d.vy -= 9.8 * dt
        d.y += d.vy * dt
        const floor = d.won ? -0.6 : 0
        if (d.y <= floor) {
          d.y = floor
          d.vy = 0
        }
      }
    })
    // 뽑힌 인형은 잠시 뒤 기계 안 아무 빈자리로 다시 채움 (계속 즐길 수 있게, 매번 다른 자리)
    dolls.current.forEach((d) => {
      if (d.won && d.y <= -0.6) {
        const [x, z] = randomSpot()
        Object.assign(d, { x, z, y: 0.6, vy: 0, won: false })
      }
    })

    // 화면 갱신: 집게, 줄, 집게 발, 인형
    if (clawRef.current) clawRef.current.position.set(cl.x, cl.y, M.z + cl.z)
    if (cableRef.current) {
      const len = Math.max(0.02, 2.2 + LIFT - cl.y)
      cableRef.current.position.set(cl.x, cl.y + len / 2, M.z + cl.z)
      cableRef.current.scale.set(0.012, len, 0.012)
    }
    prongRefs.current.forEach((p) => p && (p.rotation.x = cl.open))
    dolls.current.forEach((d, i) => {
      const mesh = dollRefs.current[i]
      if (!mesh) return
      if (d.held) mesh.position.set(cl.x, cl.y - 0.36, M.z + cl.z)
      else mesh.position.set(d.x, M.floorY + d.y, M.z + d.z)
      mesh.visible = !(d.won && d.y <= -0.25)
    })
  })

  return (
    <>
      <group ref={anchor} />
      {/* 인형들 */}
      {dolls.current.map((d, i) => (
        <mesh key={i} ref={(el) => (dollRefs.current[i] = el)} geometry={dollGeometry(d.kind)} material={INTERIOR_MAT} rotation={[0, d.rot, 0]} />
      ))}
      {/* 집게 줄 + 집게 (가운데 통 + 발 3개) */}
      <mesh ref={cableRef} geometry={GEO.cyl8} material={CLAW_MAT} />
      <group ref={clawRef}>
        <mesh geometry={GEO.cyl} material={CLAW_MAT} position={[0, -0.05, 0]} scale={[0.06, 0.1, 0.06]} />
        {[0, 1, 2].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI * 2) / 3, 0]}>
            <group position={[0, -0.1, 0.04]} ref={(el) => (prongRefs.current[k] = el)}>
              <mesh geometry={GEO.box} material={CLAW_MAT} position={[0, -0.09, 0]} scale={[0.025, 0.18, 0.025]} />
              <mesh geometry={GEO.box} material={CLAW_MAT} position={[0, -0.18, -0.03]} rotation={[0.9, 0, 0]} scale={[0.025, 0.08, 0.025]} />
            </group>
          </group>
        ))}
      </group>
      {/* 화면 안내: 기준점을 유리 상자 안에 둠 (drei Html은 기준점이 카메라 뒤면 숨겨서, 클로즈업 때도 항상 보이게) */}
      <group position={[0, M.floorY, M.z]}>
        <ClawHud open={open} startDrop={startDrop} touchKeys={touchKeys} />
      </group>
    </>
  )
}

// 화면 안내: 기계 앞이면 "E 인형뽑기", 조작 중이면 남은 시간·획득 수·조작법
function ClawHud({ open, startDrop, touchKeys }) {
  const setLevel = (level) => useBkActivity.getState().setClaw({ level, timeLeft: CLAW_LEVELS[level].time })
  const c = useBkActivity((state) => state.claw)
  const done = useBkActivity((state) => Boolean(state.completed.bk_claw))
  const size = useThree((state) => state.size)
  const showHint = c.near && !c.active
  if (!showHint && !c.active) return null
  const phaseText = { drop: '집게가 내려가요…', grab: '꽉 잡는 중…', lift: '올라가는 중…', return: '배출구로 옮기는 중…', release: '놓는 중…' }[c.phase]
  const result = { win: '🎉 뽑았어요! ', slip: '아앗, 미끄러졌어요! ', miss: '아깝다! 다시 해 봐요. ' }[c.lastResult] ?? ''
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} onOcclude={keepVisible}>
      <div style={{ ...hudWrap, width: size.width, height: size.height }}>
        {showHint && (
          <button type="button" style={chip} onClick={open}>
            <kbd style={kbd}>E</kbd> 인형뽑기 하기 {done && '· 완료 ✓'}
          </button>
        )}
        {c.active && (
          <div style={panel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              🧸 뽑은 인형 {c.wins} {done && '· 완료 ✓'} <span style={{ opacity: 0.7, fontWeight: 400 }}>· 시도 {c.tries}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
              난이도
              {Object.entries(CLAW_LEVELS).map(([id, lv], i) => (
                <button
                  key={id}
                  type="button"
                  disabled={c.phase !== 'move'}
                  onClick={(event) => {
                    setLevel(id)
                    event.currentTarget.blur() // Space가 버튼을 다시 누르지 않게
                  }}
                  style={{ ...levelBtn, ...(c.level === id ? levelOn : null), opacity: c.phase === 'move' ? 1 : 0.5 }}
                >
                  {i + 1} {lv.label}
                </button>
              ))}
            </div>
            <div style={gauge}>
              <div style={{ ...gaugeFill, width: `${Math.round((c.phase === 'move' ? c.timeLeft / levelOf(c).time : 0) * 100)}%` }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              {result}
              {phaseText ?? (
                <>
                  <kbd style={kbd}>←↑↓→</kbd>/<kbd style={kbd}>WASD</kbd> 집게 이동 · <kbd style={kbd}>Space</kbd> 내리기 · 남은 시간 {Math.ceil(c.timeLeft)}초
                </>
              )}{' '}
              · <kbd style={kbd}>ESC</kbd> 나가기
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {[["ArrowLeft", "왼쪽", "←"], ["ArrowUp", "앞", "↑"], ["ArrowDown", "뒤", "↓"], ["ArrowRight", "오른쪽", "→"]].map(([code, label, arrow]) => (
                <button key={code} type="button" className="ui-btn" style={touchButton} aria-label={`집게 ${label}으로 이동`}
                  disabled={c.phase !== 'move'} onPointerDown={(event) => {
                    if (event.button !== 0) return
                    event.currentTarget.setPointerCapture(event.pointerId)
                    touchKeys.current.set(code, event.pointerId)
                  }} onLostPointerCapture={(event) => { if (touchKeys.current.get(code) === event.pointerId) touchKeys.current.delete(code) }}>{arrow}</button>
              ))}
              <button type="button" className="ui-btn ui-btn--primary" style={touchButton} disabled={c.phase !== 'move'} onClick={startDrop}>내리기</button>
              <button type="button" className="ui-btn" style={touchButton} onClick={() => useGameStore.getState().close()}>나가기</button>
            </div>
          </div>
        )}
      </div>
    </Html>
  )
}

const hudWrap = { position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }
const chip = { padding: '6px 12px', border: 0, borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13, pointerEvents: 'auto', cursor: 'pointer' }
const panel = { width: 'min(360px, calc(100vw - 28px))', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 14 }
const touchButton = { pointerEvents: 'auto', touchAction: 'none' }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
const gauge = { position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }
const gaugeFill = { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#f9a8d4' }
const levelBtn = { pointerEvents: 'auto', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }
const levelOn = { background: '#f9a8d4', color: '#3b3633', border: '1px solid #f9a8d4', fontWeight: 700 }

// drei Html은 화면 고정 위치(calculatePosition)일 때 처음 한 번만 "카메라 뒤인지" 보고 숨긴 채로 굳을 수 있음
// → onOcclude를 넘기면 스스로 숨기지 않으므로, 아무것도 안 하는 함수로 항상 보이게
function keepVisible() {}
