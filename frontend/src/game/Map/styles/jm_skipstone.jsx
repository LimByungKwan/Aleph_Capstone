import { useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { SKIP_GOAL, useJmActivity } from './jm_activityStore.js'
import { canvasTexture, fitText, GlowMaterial, KR_FONT } from './jm_landmarks.jsx'
import { findPlayer } from '../../Player/findPlayer.js'

// 물수제비 (벚꽃 강변길, 「초속 5미터」 성지 근처) — 담당: 지민
//
// 강가 돌무더기 앞에서 E → 던지기 자세 (캐릭터 멈춤, 카메라가 하류 쪽을 봄) → Space 꾹 눌러 힘 → 떼면 던짐 → ESC 나가기
// 돌이 SKIP_GOAL번 이상 튀면 체험 완료.
//
// 계산 방식 (농구 슛과 같은 1/240초 고정 간격):
// - 물에 닿을 때 "부딪히는 각도"가 얕고(18° 미만) 앞으로 가는 속도가 충분하면(2.5m/s 초과) 튐 → 위로 튀는 속도 50%, 앞으로 75%
// - 너무 약하면 각도가 깊어 퐁당, 너무 세면(첫 착수 11.5m/s 초과) 물에 박힘 → 적당한 힘이 정답
// - 각도가 깊거나 느리면 퐁당 가라앉음. 물 밖(강둑·건너편)에 떨어지면 거기서 끝
// - 물 위인지는 강 중심선(item.skip.points)까지 거리 < 강폭/2 로 판단
// - 힘 게이지의 초록 칸은 같은 계산을 미리 돌려서 "3번 이상 튀는 힘"을 표시 (보이는 칸 = 실제 결과)

const G = 9.8
const FIXED_DT = 1 / 240
const LAUNCH_Y = 0.3 // 수면 가까이 낮게 던짐
const SKIP_ANGLE = THREE.MathUtils.degToRad(18)
const MIN_SPEED = 2.5
const MAX_FIRST_SPEED = 11.5 // 너무 세게 던지면 첫 번째에 물에 박힘
const NEAR_R = 2.4
const RIPPLES = 10
// (11/25 밤 지민 요청: 텍스트만 뜨고 움직임이 안 보임) 보이는 연출
//   - 힘 모으는 동안 캐릭터 오른손 옆에 돌이 보이고 힘만큼 뒤로 당겨짐 (던지기 준비 자세 대신)
//   - 날아가는 돌은 크게(지름 약 0.5m로 보이게) + 흰 꼬리, 튈 때마다 물방울·물결·횟수 숫자
const STONE_VIS = 2.6
const TRAIL_N = 14
const SPRAY_N = 60
const POP_N = 8

const speedOf = (power) => 3 + 12 * power // 앞으로 나가는 속도 (m/s)

function distToLine(points, x, z) {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz))
  }
  return best
}

// 돌 한 걸음. 반환: 'fly' | 'bounce' | 'sink' | 'land'
function stepStone(s, env, dt) {
  s.vy -= G * dt
  s.x += s.vx * dt
  s.y += s.vy * dt
  s.z += s.vz * dt
  if (s.y > env.waterY || s.vy >= 0) return 'fly'
  const overWater = distToLine(env.points, s.x - env.ox, s.z - env.oz) < env.width / 2 - 0.15
  if (!overWater) return 'land'
  const vh = Math.hypot(s.vx, s.vz)
  if (s.bounces === 0 && vh > MAX_FIRST_SPEED) return 'sink'
  if (Math.atan2(-s.vy, vh) < SKIP_ANGLE && vh > MIN_SPEED) {
    s.y = env.waterY
    s.vy = -s.vy * 0.5
    s.vx *= 0.75
    s.vz *= 0.75
    return 'bounce'
  }
  return 'sink'
}

function launchStone(env, power) {
  const v = speedOf(power)
  return { x: env.start.x, y: env.waterY + LAUNCH_Y, z: env.start.z, vx: env.dir.x * v, vy: -0.2, vz: env.dir.z * v, t: 0, acc: 0, bounces: 0 }
}

// 같은 계산으로 끝까지 돌려서 튄 횟수만 셈 (게이지 초록 칸용)
function simulateBounces(env, power) {
  const s = launchStone(env, power)
  for (let i = 0; i < 240 * 8; i++) {
    const r = stepStone(s, env, FIXED_DT)
    if (r === 'bounce') s.bounces++
    else if (r === 'sink' || r === 'land') break
  }
  return s.bounces
}

export function JmSkipSpot({ item }) {
  const scene = useThree((state) => state.scene)
  const getState = useThree((state) => state.get)
  const anchor = useRef(null)
  const stoneRef = useRef(null)
  const rippleRefs = useRef([])
  const ripples = useRef(Array.from({ length: RIPPLES }, () => ({ t: 99, x: 0, z: 0 })))
  const nextRipple = useRef(0)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const phase = useRef(0)
  const stone = useRef(null)
  const env = useRef(null)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), me: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), s: new THREE.Vector3(), p: new THREE.Vector3() }), [])
  const handRef = useRef(null)
  const trailRef = useRef(null)
  const sprayRef = useRef(null)
  const popRefs = useRef([])
  const trail = useRef(Array.from({ length: TRAIL_N }, () => new THREE.Vector3(0, -99, 0)))
  const spray = useRef(Array.from({ length: SPRAY_N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })))
  const sprayNext = useRef(0)
  const pops = useRef(Array.from({ length: POP_N }, () => ({ t: 99, x: 0, z: 0, n: 0 })))
  const popNext = useRef(0)
  const popTex = useMemo(() => Array.from({ length: 10 }, (_, n) => canvasTexture(`skippop:${n}`, 128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.strokeStyle = 'rgba(30,60,90,0.9)'
    ctx.lineWidth = 10
    ctx.font = `900 84px ${KR_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText(String(n), w / 2, h / 2 + 4)
    ctx.fillText(String(n), w / 2, h / 2 + 4)
  })), [])
  const popMats = useMemo(() => Array.from({ length: POP_N }, () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })), [])

  // 월드 좌표 계산 (구역 좌표 + 구역 origin). anchor = item.position의 월드 위치
  function getEnv() {
    if (env.current || !anchor.current) return env.current
    anchor.current.getWorldPosition(tmp.a)
    const ox = tmp.a.x - item.position[0]
    const oz = tmp.a.z - item.position[1]
    const sk = item.skip
    const e = {
      ox,
      oz,
      waterY: tmp.a.y + 0.05,
      width: sk.width,
      points: sk.points,
      start: { x: sk.start[0] + ox, z: sk.start[1] + oz },
      dir: { x: sk.dir[0], z: sk.dir[1] },
      stand: { x: tmp.a.x, z: tmp.a.z },
    }
    // 힘 0~1을 0.02 간격으로 미리 던져 보고 3번 이상 튀는 구간을 찾음
    e.zone = []
    for (let i = 0; i <= 50; i++) e.zone.push(simulateBounces(e, i / 50) >= SKIP_GOAL)
    env.current = e
    return e
  }

  // 키: E(던지기 자세), Space(힘 → 떼면 던짐)
  useEffect(() => {
    const down = (event) => {
      if (event.repeat) return
      const sk = useJmActivity.getState().skip
      const game = useGameStore.getState()
      if (event.code === 'KeyE' && sk.near && !sk.active && !game.openPanel && !game.nearbyPlaceId) {
        useJmActivity.getState().setSkip({ active: true, power: 0, charging: false, bounces: null })
        game.open({ type: 'jm_skip', placeId: item.id })
        faceRiver()
      }
      if (event.code === 'Space' && sk.active && !stone.current) {
        phase.current = 0
        useJmActivity.getState().setSkip({ charging: true, power: 0 })
      }
    }
    const up = (event) => {
      const sk = useJmActivity.getState().skip
      if (event.code === 'Space' && sk.active && sk.charging) {
        useJmActivity.getState().setSkip({ charging: false, bounces: null, throws: sk.throws + 1 })
        const e = getEnv()
        if (e) stone.current = launchStone(e, sk.power)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // ESC로 패널이 닫히면 던지기 자세도 풀림
  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        const sk = useJmActivity.getState().skip
        if (sk.active && state.openPanel?.placeId !== item.id) useJmActivity.getState().setSkip({ active: false, charging: false, power: 0 })
      }),
    [item.id],
  )

  function faceRiver() {
    const controls = getState().controls
    const e = getEnv()
    if (!controls?.rotateTo || !e) return
    controls.rotateTo(Math.atan2(-e.dir.x, -e.dir.z), 1.35, true)
  }

  // 튈 때 물방울 (작게, 위로 살짝 튀었다 떨어짐)
  function addSpray(x, z, count, up) {
    for (let k = 0; k < count; k++) {
      const d = spray.current[sprayNext.current]
      sprayNext.current = (sprayNext.current + 1) % SPRAY_N
      d.p.set(x, env.current.waterY, z)
      d.v.set((Math.random() - 0.5) * 1.4, up * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 1.4)
      d.life = 0.6
    }
  }
  function addPop(x, z, n) {
    const p = pops.current[popNext.current]
    popNext.current = (popNext.current + 1) % POP_N
    p.t = 0
    p.x = x
    p.z = z
    p.n = Math.min(9, n)
  }
  function addRipple(x, z, big) {
    const r = ripples.current[nextRipple.current]
    nextRipple.current = (nextRipple.current + 1) % RIPPLES
    r.t = 0
    r.x = x
    r.z = z
    r.big = big
  }

  function finish(bounces) {
    stone.current = null
    if (stoneRef.current) stoneRef.current.visible = false
    const store = useJmActivity.getState()
    const sk = store.skip
    store.setSkip({ bounces, best: Math.max(sk.best, bounces) })
    if (bounces >= SKIP_GOAL && store.complete('jm_skip')) {
      useUiStore.getState().toast?.(`🪨 물수제비 ${bounces}번! 강변 체험 완료`, 'success')
    }
  }

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const e = getEnv()
    if (!e) return
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = findPlayer(scene)
    }
    const store = useJmActivity.getState()
    const sk = store.skip
    if (player.current?.parent) {
      player.current.getWorldPosition(tmp.me)
      const near = Math.hypot(tmp.me.x - e.stand.x, tmp.me.z - e.stand.z) < NEAR_R
      if (near !== sk.near) store.setSkip({ near })
    }
    if (sk.active && sk.charging) {
      phase.current += delta * 1.1
      store.setSkip({ power: 1 - Math.abs(1 - (phase.current % 2)) })
    }

    // 날아가는 돌
    const s = stone.current
    if (s) {
      s.acc += Math.min(delta, 0.25)
      while (s.acc >= FIXED_DT && stone.current) {
        s.acc -= FIXED_DT
        s.t += FIXED_DT
        const r = stepStone(s, e, FIXED_DT)
        if (r === 'bounce') {
          s.bounces++
          addRipple(s.x, s.z, false)
          addSpray(s.x, s.z, 6, 1.6)
          addPop(s.x, s.z, s.bounces)
        } else if (r === 'sink') {
          addRipple(s.x, s.z, true)
          addSpray(s.x, s.z, 12, 2.2)
          finish(s.bounces)
        } else if (r === 'land' || s.t > 8) {
          finish(s.bounces)
        }
      }
      if (stone.current && stoneRef.current) {
        stoneRef.current.visible = true
        stoneRef.current.position.set(s.x, s.y, s.z)
        stoneRef.current.rotation.y += delta * 20
        // 꼬리: 지난 위치들을 한 칸씩 밀어 담음
        for (let i = TRAIL_N - 1; i > 0; i--) trail.current[i].copy(trail.current[i - 1])
        trail.current[0].set(s.x, s.y, s.z)
      }
    }
    if (!stone.current) for (const v of trail.current) v.y = -99
    if (trailRef.current) {
      trail.current.forEach((v, i) => {
        const sc = 0.09 * (1 - i / TRAIL_N)
        tmp.s.set(sc, sc, sc)
        tmp.m.compose(v, tmp.q.identity(), tmp.s)
        trailRef.current.setMatrixAt(i, tmp.m)
      })
      trailRef.current.instanceMatrix.needsUpdate = true
    }
    // 손에 든 돌: 던지기 자세일 때 캐릭터 오른쪽 허리 높이, 힘 모으면 뒤로 당겨짐
    if (handRef.current) {
      const show = sk.active && !stone.current && player.current?.parent
      handRef.current.visible = Boolean(show)
      if (show) {
        const back = sk.charging ? sk.power : 0
        const rx = e.dir.z
        const rz = -e.dir.x // 던지는 방향의 오른쪽
        tmp.p.set(tmp.me.x + rx * 0.45 - e.dir.x * (0.15 + back * 0.6), tmp.me.y + 0.1 + back * 0.25, tmp.me.z + rz * 0.45 - e.dir.z * (0.15 + back * 0.6))
        handRef.current.position.copy(tmp.p)
        handRef.current.rotation.y += delta * (sk.charging ? 4 : 0.5)
      }
    }
    // 물방울
    if (sprayRef.current) {
      spray.current.forEach((d, i) => {
        if (d.life > 0) {
          d.life -= delta
          d.v.y -= G * Math.min(delta, 0.05)
          d.p.addScaledVector(d.v, Math.min(delta, 0.05))
          if (d.p.y < e.waterY) d.life = 0
        }
        const sc = d.life > 0 ? 0.035 : 0
        tmp.s.set(sc, sc, sc)
        tmp.m.compose(d.p, tmp.q.identity(), tmp.s)
        sprayRef.current.setMatrixAt(i, tmp.m)
      })
      sprayRef.current.instanceMatrix.needsUpdate = true
    }
    // 튄 횟수 숫자: 튄 자리 위로 떠오르며 사라짐
    pops.current.forEach((p, i) => {
      const sp = popRefs.current[i]
      if (!sp) return
      if (p.t > 1.1) {
        sp.visible = false
        return
      }
      p.t += delta
      sp.visible = true
      if (popMats[i].map !== popTex[p.n]) {
        popMats[i].map = popTex[p.n]
        popMats[i].needsUpdate = true
      }
      sp.position.set(p.x, e.waterY + 0.6 + p.t * 0.8, p.z)
      sp.scale.setScalar(0.7)
      popMats[i].opacity = 1 - p.t / 1.1
    })

    // 물보라 동그라미: 1초 동안 커지며 사라짐
    ripples.current.forEach((r, i) => {
      const m = rippleRefs.current[i]
      if (!m) return
      if (r.t > 1.2) {
        m.visible = false
        return
      }
      r.t += delta
      m.visible = true
      const k = r.t / 1.2
      const size = (r.big ? 0.5 : 0.25) + k * (r.big ? 1.6 : 1.1)
      m.position.set(r.x, e.waterY + 0.02, r.z)
      m.scale.set(size, size, size)
      m.material.opacity = 0.75 * (1 - k)
    })
  })

  return (
    <>
      <group ref={anchor} />
      <SkipMarker />
      {createPortal(
        <>
          <mesh ref={stoneRef} visible={false} scale={[STONE_VIS, STONE_VIS * 0.4, STONE_VIS]}>
            <sphereGeometry args={[0.09, 12, 8]} />
            <meshStandardMaterial color="#6f6b64" />
          </mesh>
          <mesh ref={handRef} visible={false} scale={[1.6, 0.6, 1.6]}>
            <sphereGeometry args={[0.09, 12, 8]} />
            <meshStandardMaterial color="#6f6b64" />
          </mesh>
          <instancedMesh ref={trailRef} args={[null, null, TRAIL_N]} frustumCulled={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
          </instancedMesh>
          <instancedMesh ref={sprayRef} args={[null, null, SPRAY_N]} frustumCulled={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color="#eef8f8" transparent opacity={0.85} />
          </instancedMesh>
          {popMats.map((m, i) => (
            <sprite key={`p${i}`} ref={(el) => (popRefs.current[i] = el)} material={m} visible={false} />
          ))}
          {Array.from({ length: RIPPLES }, (_, i) => (
            <mesh key={i} ref={(m) => (rippleRefs.current[i] = m)} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.8, 1, 24]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </>,
        scene,
      )}
      <SkipHud zoneRef={env} />
    </>
  )
}

// 강가 표시: 납작한 돌 무더기 + 작은 나무 팻말 「물수제비」
function SkipMarker() {
  const tex = canvasTexture('skipsign', 256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#c9a272'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#3b2412'
    fitText(ctx, '물수제비', w * 0.86, 56, 'bold', KR_FONT, h * 0.7)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('물수제비', w / 2, h / 2 + 2)
  })
  return (
    <group>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-0.35 + (i % 3) * 0.3, 0.05 + Math.floor(i / 3) * 0.07, 0.1 + (i % 2) * 0.15]} scale={[1, 0.3, 1]}>
          <sphereGeometry args={[0.13, 10, 6]} />
          <meshStandardMaterial color={i % 2 ? '#8d8a84' : '#a5a29b'} flatShading />
        </mesh>
      ))}
      <mesh position={[0.45, 0.45, -0.1]}>
        <boxGeometry args={[0.06, 0.9, 0.06]} />
        <meshStandardMaterial color="#6b4a2f" />
      </mesh>
      <mesh position={[0.45, 0.85, -0.06]}>
        <planeGeometry args={[0.6, 0.22]} />
        <GlowMaterial map={tex} glow={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function SkipHud({ zoneRef }) {
  const sk = useJmActivity((state) => state.skip)
  const done = useJmActivity((state) => Boolean(state.completed.jm_skip))
  const size = useThree((state) => state.size)
  if (!sk.near && !sk.active) return null
  const zone = zoneRef.current?.zone ?? []
  // 초록 칸: 연속 구간들
  const spans = []
  zone.forEach((ok, i) => {
    if (!ok) return
    const last = spans[spans.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else spans.push([i, i])
  })
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ ...wrap, width: size.width, height: size.height }}>
        {!sk.active ? (
          <div style={chip}>
            <kbd style={kbd}>E</kbd> 물수제비 해 보기 {done && '· 완료 ✓'}
          </div>
        ) : (
          <div style={panel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              🪨 {sk.bounces === null ? '하류 쪽으로 던져 보세요' : `${sk.bounces}번 튀었어요`}
              <span style={{ opacity: 0.7, fontWeight: 400 }}> · 최고 {sk.best}번 · 목표 {SKIP_GOAL}번</span>
            </div>
            <div style={gauge}>
              {spans.map(([a, b]) => (
                <div key={a} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(a / 50) * 100}%`, width: `${((b - a + 1) / 50) * 100}%`, background: 'rgba(74,222,128,0.55)' }} />
              ))}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(sk.power * 100)}%`, background: '#60a5fa', opacity: 0.85 }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              <kbd style={kbd}>Space</kbd> 꾹 눌러 힘 조절 → 떼면 던지기 · 초록 칸이면 {SKIP_GOAL}번 이상 · <kbd style={kbd}>ESC</kbd> 나가기
            </div>
          </div>
        )}
      </div>
    </Html>
  )
}

const wrap = { position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const panel = { width: 340, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 14 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
const gauge = { position: 'relative', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }

export const JM_SKIP_STYLES = { jmSkipSpot: JmSkipSpot }
