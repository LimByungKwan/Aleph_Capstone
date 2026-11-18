import { useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { COIN_GOAL, useBkActivity } from './bk_activityStore.js'

// 데이트 코스 구역(BK) 체험: 분수 동전 던지기 (소원 빌기). 담당: 병관
//
// 분수 가까이에서 E → 던지기 모드 (캐릭터 멈춤, 카메라가 분수 쪽으로) → Space 꾹 눌러 힘 조절 → 떼면 던짐 → ESC로 나감
// 위쪽 작은 물받이에 동전이 들어가면 소원 성공 (하트가 퐁퐁), COIN_GOAL번 넣으면 체험 완료.
//
// 지민 님 농구(jm_activities.jsx)와 같은 방식: 물리 엔진 없이 동전 하나만 직접 계산 → 가볍고 공용 파일을 안 건드림.
// 동전·물 튀김·하트는 던질 때만 보이고, 평소에는 계산도 거의 없음.

const G = 9.8
const LAUNCH_ANGLE = THREE.MathUtils.degToRad(50)
const NEAR_DIST = 6 // 분수 가운데에서 이 거리 안이면 던질 수 있음
const TOSS_TIME = 3 // 동전 하나가 끝나기까지(초)
const FIXED_DT = 1 / 240
// 분수 높이·크기 (dateCourse.jsx Fountain과 같은 값, 분수 바닥 기준)
const BOWL = { y: 1.83, r: 0.8 } // 위쪽 물받이 (성공)
const POOL = { y: 0.72, r: 1.75 } // 아래 연못
// 힘 게이지 → 속도 배율. 시뮬레이션으로 맞춤: 거리 2.5~5.5m에서 약 0.40~0.60이 들어가는 힘
const powerToFactor = (p) => 1 + 0.6 * (p - 0.5)

const COIN_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 14)
const COIN_MAT = new THREE.MeshStandardMaterial({ color: '#e7c35a', metalness: 0.7, roughness: 0.3, emissive: '#6b5212', emissiveIntensity: 0.3 })
const SPLASH_GEO = new THREE.RingGeometry(0.7, 1, 24).rotateX(-Math.PI / 2)
const HEART_COUNT = 10

export function FountainCoinToss({ item }) {
  const scene = useThree((state) => state.scene)
  const getState = useThree((state) => state.get)
  const anchor = useRef(null) // 분수 그룹 안의 빈 그룹 → 월드 좌표 계산용
  const coinRef = useRef(null)
  const splashRef = useRef(null)
  const heartsRef = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const phase = useRef(0)
  const toss = useRef(null) // 지금 날아가는 동전 (없으면 null)
  const splash = useRef(null) // { pos, t, big }
  const hearts = useRef(-1) // 하트 연출 경과 시간 (-1이면 없음)

  const tmp = useMemo(() => ({ center: new THREE.Vector3(), me: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() }), [])
  const splashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e8f7ff', transparent: true, opacity: 0, depthWrite: false }), [])
  const heartMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff8fb8', emissive: '#ff5c8a', emissiveIntensity: 0.8, transparent: true, opacity: 1 }), [])
  const heartGeo = useMemo(() => heartGeometry(), [])
  const heartSeeds = useMemo(() => Array.from({ length: HEART_COUNT }, (_, i) => ({ a: (i / HEART_COUNT) * Math.PI * 2, speed: 0.8 + ((i * 37) % 10) / 20, r: 0.3 + ((i * 53) % 10) / 25 })), [])

  // 키 입력: E(던지기 모드), Space(힘 모으기 → 떼면 던지기)
  useEffect(() => {
    const down = (event) => {
      if (event.repeat) return
      const c = useBkActivity.getState().coin
      const game = useGameStore.getState()
      if (event.code === 'KeyE' && c.near && !c.active && !game.openPanel && !game.nearbyPlaceId) {
        useBkActivity.getState().startCoin()
        // 캐릭터를 멈춤 (ESC로 나가기) — placeId가 places.json에 없어서 대화창은 뜨지 않음
        game.open({ type: 'bk_coin', placeId: item.id })
        faceFountain()
      }
      if (event.code === 'Space' && c.active && !toss.current) {
        phase.current = 0
        useBkActivity.getState().setCoin({ charging: true, power: 0 })
      }
    }
    const up = (event) => {
      const c = useBkActivity.getState().coin
      if (event.code === 'Space' && c.active && c.charging) {
        useBkActivity.getState().setCoin({ charging: false })
        launch(c.power)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // launch·faceFountain은 ref만 씀
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // ESC(공용 InteractionKeys)로 패널이 닫히면 던지기 모드도 끝냄
  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        const c = useBkActivity.getState().coin
        if (c.active && state.openPanel?.placeId !== item.id) useBkActivity.getState().endCoin()
      }),
    [item.id],
  )

  // 카메라(공용 CameraControls)를 캐릭터 뒤 → 분수 쪽으로. 공용 FollowCamera.jsx는 고치지 않음
  function faceFountain() {
    const controls = getState().controls
    if (!controls?.rotateTo || !player.current) return
    anchor.current.getWorldPosition(tmp.center)
    player.current.getWorldPosition(tmp.me)
    controls.rotateTo(Math.atan2(tmp.me.x - tmp.center.x, tmp.me.z - tmp.center.z), 1.25, true)
  }

  function launch(power) {
    const p = player.current
    if (!p || !anchor.current) return
    anchor.current.getWorldPosition(tmp.center)
    p.getWorldPosition(tmp.me)
    const base = tmp.center.y
    const start = tmp.me.clone()
    start.y += 0.5 // 손 높이 (캐릭터 중심 기준)
    const dir = tmp.center.clone().sub(start)
    dir.y = 0
    const d = dir.length()
    dir.normalize()
    start.addScaledVector(dir, 0.3)
    const dist = Math.max(0.5, d - 0.3)
    const dy = base + BOWL.y - start.y
    // 50°로 던졌을 때 물받이 가운데에 떨어지는 속도: v² = g·d² / (2cos²θ·(d·tanθ − dy))
    const denom = 2 * Math.cos(LAUNCH_ANGLE) ** 2 * (dist * Math.tan(LAUNCH_ANGLE) - dy)
    const v = Math.sqrt((G * dist * dist) / Math.max(denom, 0.01)) * powerToFactor(power)
    const vel = dir.multiplyScalar(v * Math.cos(LAUNCH_ANGLE))
    vel.y = v * Math.sin(LAUNCH_ANGLE)
    toss.current = { pos: start, vel, t: 0, acc: 0, prevY: start.y, result: null }
    const c = useBkActivity.getState().coin
    useBkActivity.getState().setCoin({ tosses: c.tosses + 1, lastResult: null })
  }

  // 동전 한 걸음: 중력 → 물받이/연못/바닥 판정
  function step(b, dt) {
    b.vel.y -= G * dt
    b.prevY = b.pos.y
    b.pos.addScaledVector(b.vel, dt)
    if (b.vel.y >= 0) return
    const base = tmp.center.y
    const horiz = Math.hypot(b.pos.x - tmp.center.x, b.pos.z - tmp.center.z)
    const crossed = (y) => b.prevY > base + y && b.pos.y <= base + y
    if (crossed(BOWL.y) && horiz < BOWL.r) return land(b, 'wish', base + BOWL.y)
    if (crossed(POOL.y) && horiz < POOL.r) return land(b, 'pool', base + POOL.y)
    if (b.pos.y <= base + 0.02) return land(b, 'miss', base + 0.02)
  }

  function land(b, result, y) {
    b.result = result
    b.pos.y = y
    if (result !== 'miss') splash.current = { pos: b.pos.clone(), t: 0, big: result === 'wish' }
    if (result === 'wish') hearts.current = 0
    finishToss()
  }

  function finishToss() {
    const result = toss.current?.result ?? 'miss'
    toss.current = null
    if (coinRef.current) coinRef.current.visible = false
    const store = useBkActivity.getState()
    const c = store.coin
    if (!c.active) return
    const wishes = c.wishes + (result === 'wish' ? 1 : 0)
    store.setCoin({ wishes, lastResult: result })
    if (result === 'wish' && wishes >= COIN_GOAL && store.complete('bk_fountain_coin')) {
      useUiStore.getState().toast?.(`💗 소원 ${COIN_GOAL}번 성공! 분수 동전 던지기 완료`, 'success')
    }
  }

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (!anchor.current) return

    // 캐릭터 찾기 (다시 생기거나 바뀔 수 있어서 가끔 다시 찾음)
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    const store = useBkActivity.getState()
    const c = store.coin

    if (player.current?.parent) {
      anchor.current.getWorldPosition(tmp.center)
      player.current.getWorldPosition(tmp.me)
      const near = Math.hypot(tmp.me.x - tmp.center.x, tmp.me.z - tmp.center.z) < NEAR_DIST && Math.abs(tmp.me.y - tmp.center.y) < 2
      if (near !== c.near) store.setCoin({ near })
    } else if (c.near) store.setCoin({ near: false })

    // 힘 게이지 (0 → 1 → 0 왕복)
    if (c.active && c.charging) {
      phase.current += delta * 1.2
      store.setCoin({ power: 1 - Math.abs(1 - (phase.current % 2)) })
    }

    // 날아가는 동전 (고정 간격으로 나눠 계산 → 프레임이 느려도 같은 힘이면 같은 결과)
    const b = toss.current
    if (b) {
      anchor.current.getWorldPosition(tmp.center)
      b.acc += Math.min(delta, 0.25)
      while (toss.current && b.acc >= FIXED_DT) {
        step(b, FIXED_DT)
        b.acc -= FIXED_DT
        b.t += FIXED_DT
      }
      if (toss.current && coinRef.current) {
        coinRef.current.visible = true
        coinRef.current.position.copy(b.pos)
        coinRef.current.rotation.x += delta * 14
        coinRef.current.rotation.z += delta * 5
      }
      if (toss.current && b.t > TOSS_TIME) finishToss()
    }

    // 물 튀김 고리 (0.6초)
    const s = splash.current
    if (splashRef.current) {
      if (s) {
        s.t += delta
        const k = s.t / 0.6
        splashRef.current.visible = k < 1
        splashRef.current.position.copy(s.pos)
        splashRef.current.position.y += 0.01
        splashRef.current.scale.setScalar((s.big ? 0.12 : 0.18) + k * (s.big ? 0.5 : 0.7))
        splashMat.opacity = 0.8 * (1 - k)
        if (k >= 1) splash.current = null
      } else splashRef.current.visible = false
    }

    // 소원 성공 하트 (1.6초 동안 분수 위로 퐁퐁)
    const hearts3 = heartsRef.current
    if (hearts3) {
      if (hearts.current >= 0) {
        hearts.current += delta
        const k = hearts.current / 1.6
        hearts3.visible = k < 1
        anchor.current.getWorldPosition(tmp.center)
        heartSeeds.forEach((h, i) => {
          const r = h.r + k * 0.6
          tmp.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, h.a + k * 1.5)
          tmp.m.compose(
            tmp.d.set(tmp.center.x + Math.cos(h.a + k) * r, tmp.center.y + 2.3 + k * 2.2 * h.speed, tmp.center.z + Math.sin(h.a + k) * r),
            tmp.q,
            new THREE.Vector3().setScalar(0.18 * (1 - k * 0.4)),
          )
          hearts3.setMatrixAt(i, tmp.m)
        })
        hearts3.instanceMatrix.needsUpdate = true
        heartMat.opacity = 1 - k * k
        if (k >= 1) hearts.current = -1
      } else hearts3.visible = false
    }
  })

  return (
    <>
      <group ref={anchor} />
      {/* 동전·물 튀김·하트는 분수 그룹이 아니라 장면 맨 위에 그려서 월드 좌표를 그대로 씀 */}
      {createPortal(
        <>
          <mesh ref={coinRef} geometry={COIN_GEO} material={COIN_MAT} visible={false} />
          <mesh ref={splashRef} geometry={SPLASH_GEO} material={splashMat} visible={false} renderOrder={3} />
          <instancedMesh ref={heartsRef} args={[heartGeo, heartMat, HEART_COUNT]} visible={false} frustumCulled={false} />
        </>,
        scene,
      )}
      <CoinHud />
    </>
  )
}

// 작은 하트 모양 (납작한 판)
function heartGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, -0.35)
  s.bezierCurveTo(-0.6, 0.1, -0.5, 0.65, 0, 0.35)
  s.bezierCurveTo(0.5, 0.65, 0.6, 0.1, 0, -0.35)
  return new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false }).center()
}

// 화면 안내: 가까이 오면 "E 동전 던지기", 던지기 모드면 힘 게이지 + 소원 횟수
function CoinHud() {
  const c = useBkActivity((state) => state.coin)
  const done = useBkActivity((state) => Boolean(state.completed.bk_fountain_coin))
  const size = useThree((state) => state.size)
  const showHint = c.near && !c.active
  if (!showHint && !c.active) return null
  const message = { wish: '퐁당! 소원이 이루어질 거예요 💗 ', pool: '아래 연못에 빠졌어요… ', miss: '분수 밖으로 날아갔어요! ' }[c.lastResult] ?? ''

  // 분수 위치와 상관없이 화면 왼쪽 위(0,0)에 캔버스 크기 그대로 깔기 (지민 님 농구 HUD와 같은 방식)
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ ...hudWrap, width: size.width, height: size.height }}>
        {showHint && (
          <div style={chip}>
            <kbd style={kbd}>E</kbd> 분수에 동전 던지기 (소원 빌기) {done && '· 완료 ✓'}
          </div>
        )}
        {c.active && (
          <div style={panel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              🪙 소원 {Math.min(c.wishes, COIN_GOAL)} / {COIN_GOAL} {done && '완료 ✓'}{' '}
              <span style={{ opacity: 0.7, fontWeight: 400 }}>· 던진 동전 {c.tosses}</span>
            </div>
            <div style={gauge}>
              <div style={sweet} />
              <div style={{ ...gaugeFill, width: `${Math.round(c.power * 100)}%` }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              {message}
              <kbd style={kbd}>Space</kbd> 꾹 눌러 힘 조절 → 떼면 던지기 · 분홍 칸 = 위쪽 물받이 · <kbd style={kbd}>ESC</kbd> 나가기
            </div>
          </div>
        )}
      </div>
    </Html>
  )
}

const hudWrap = { position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const panel = { width: 330, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 14 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
const gauge = { position: 'relative', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }
// 위쪽 물받이에 들어가는 힘 구간 (약 0.40 ~ 0.60)
const sweet = { position: 'absolute', left: '40%', width: '20%', top: 0, bottom: 0, background: 'rgba(249,168,212,0.7)' }
const gaugeFill = { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#e7c35a', opacity: 0.85 }
