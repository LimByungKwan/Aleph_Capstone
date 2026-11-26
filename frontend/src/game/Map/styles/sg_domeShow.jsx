import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSettings } from '../../settingsStore.js'
import { live } from '../../timeOfDay.js'
import { Instances, GEO, mat } from './kit.jsx'
import { DOME, FIREWORK_HEIGHT, domeBasePoints } from './sg_domeShape.js'

// ── K-POP 돔 조명 쇼 (SG) ────────────────────────
// 1) 돔 바닥선을 따라 2m 간격 서치라이트: 바닥선 바로 바깥에 세우고 빔이 바깥·위로 흔들림
//    (안쪽에 두면 돔 캐노피에 빔이 가로막힘). 빔 160여 개를 InstancedMesh 하나로 그림
// 2) 밤인 동안(설정 ⚙ 시간대 '밤') 돔보다 20m 위에서 폭죽: 몇 초 몰아 터뜨리고 몇 초 쉬기를 반복. 중앙 광장 시계탑에서 보임
//    입자 하나하나를 Points 하나에 모아 CPU로 갱신 (draw call 2개: 입자 + 꼬리 없음)
// 개발 중 확인용: 브라우저 콘솔에서 window.__sgFireworks() 로 바로 발사

const LIGHT_STEP = 2
const LIGHT_OUT = 0.4 // 바닥선 바깥으로 (동쪽 광장 나무까지 여유 2m)
const BEAM_LENGTH = 45
const BEAM_COLORS = ['#ff5cb8', '#9b5cff', '#5ce1ff', '#ffd166']

// 꼭짓점이 아래(원점), 위로 넓어지는 열린 원뿔
const BEAM_GEO = new THREE.ConeGeometry(1, 1, 12, 1, true).rotateX(Math.PI).translate(0, 0.5, 0)
const BEAM_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
const HOUSING = mat('#18181c', { roughness: 0.5, metalness: 0.5 })

export function KpopDomeShow() {
  return (
    <>
      <Searchlights />
      <Fireworks />
    </>
  )
}

function Searchlights() {
  const points = useMemo(() => domeBasePoints(LIGHT_STEP, { skipGate: true }), [])
  const ref = useRef(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const housings = useMemo(
    () => points.map((p) => ({ p: [p.x + p.nx * LIGHT_OUT, 0.25, p.z + p.nz * LIGHT_OUT], s: [0.45, 0.5, 0.45] })),
    [points],
  )

  useEffect(() => {
    const mesh = ref.current
    const color = new THREE.Color()
    points.forEach((_, i) => mesh.setColorAt(i, color.set(BEAM_COLORS[i % BEAM_COLORS.length])))
    mesh.instanceColor.needsUpdate = true
  }, [points])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    BEAM_MAT.opacity = 0.035 + 0.075 * live.stars // 낮에는 은은하게, 밤에는 진하게
    points.forEach((p, i) => {
      dummy.position.set(p.x + p.nx * LIGHT_OUT, 0.5, p.z + p.nz * LIGHT_OUT)
      dummy.rotation.set(0, Math.atan2(p.nx, p.nz), 0) // 로컬 +z = 바깥 방향
      dummy.rotateX(0.3 + 0.25 * Math.sin(t * 0.9 + i * 0.22)) // 바깥으로 기울었다 섰다 (물결처럼 번짐)
      dummy.rotateZ(0.35 * Math.sin(t * 0.6 + i * 0.5)) // 좌우 흔들림
      dummy.scale.set(1.3, BEAM_LENGTH, 1.3)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={ref} args={[BEAM_GEO, BEAM_MAT, points.length]} frustumCulled={false} userData={{ noShadow: true }} />
      <Instances geometry={GEO.box} material={HOUSING} items={housings} />
    </>
  )
}

// ── 폭죽 ─────────────────────────────────────────
const VOLLEY_SECONDS = 5 // 한 번 몰아 터뜨리는 시간
const PAUSE_SECONDS = 6 // 다음 묶음까지 쉬는 시간 (11/26: 1분 쇼 한 번 → 짧게 반복으로)
const MAX_PARTICLES = 12000 // 한 묶음 마지막(3발씩 몰아침) 동시 입자 수천 개 + 여유
const GRAVITY = -9.8
const PALETTE = ['#ff4fa3', '#b18cff', '#5ce1ff', '#ffd166', '#ffffff', '#7dff9b', '#ff7a45']
// 폭죽이 올라가는 바닥 범위: 돔 안쪽 (캐노피 아래를 피해 가운데 쪽)
const LAUNCH = { minX: DOME.minX + 18, maxX: DOME.maxX - 18, minZ: DOME.minZ + 18, maxZ: DOME.maxZ - 18 }

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

// 입자 풀: 배열 재사용, 매 프레임 새 객체 없음
function createPool() {
  return {
    pos: new Float32Array(MAX_PARTICLES * 3),
    vel: new Float32Array(MAX_PARTICLES * 3),
    base: new Float32Array(MAX_PARTICLES * 3), // 원래 색
    col: new Float32Array(MAX_PARTICLES * 3), // 화면 색 (수명에 따라 어두워짐)
    life: new Float32Array(MAX_PARTICLES), // 남은 수명(초), 0이면 빈칸
    maxLife: new Float32Array(MAX_PARTICLES),
    drag: new Float32Array(MAX_PARTICLES),
    gravity: new Float32Array(MAX_PARTICLES),
    kind: new Uint8Array(MAX_PARTICLES), // 0 불꽃, 1 올라가는 로켓(터질 때 폭발), 2 작은 2차 폭발을 내는 불꽃
    burst: new Uint8Array(MAX_PARTICLES), // 로켓이 터질 모양
    next: 0,
  }
}

function emit(pool, x, y, z, vx, vy, vz, color, life, { drag = 0.985, gravity = GRAVITY * 0.35, kind = 0, burst = 0 } = {}) {
  // 빈칸을 찾아 넣음 (꽉 차면 가장 오래된 칸을 덮어씀)
  let i = pool.next
  for (let n = 0; n < MAX_PARTICLES && pool.life[i] > 0; n++) i = (i + 1) % MAX_PARTICLES
  pool.next = (i + 1) % MAX_PARTICLES
  const j = i * 3
  pool.pos[j] = x; pool.pos[j + 1] = y; pool.pos[j + 2] = z
  pool.vel[j] = vx; pool.vel[j + 1] = vy; pool.vel[j + 2] = vz
  pool.base[j] = color.r; pool.base[j + 1] = color.g; pool.base[j + 2] = color.b
  pool.life[i] = pool.maxLife[i] = life
  pool.drag[i] = drag
  pool.gravity[i] = gravity
  pool.kind[i] = kind
  pool.burst[i] = burst
}

const tmpColor = new THREE.Color()
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// 폭발 모양 5가지
function explode(pool, x, y, z, shape) {
  const c1 = tmpColor.set(pick(PALETTE)).clone()
  const c2 = new THREE.Color(pick(PALETTE))
  const sphere = (count, speed, color, opts) => {
    for (let k = 0; k < count; k++) {
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const v = speed * (0.85 + Math.random() * 0.3)
      emit(pool, x, y, z, s * Math.cos(a) * v, u * v, s * Math.sin(a) * v, color, opts.life * (0.8 + Math.random() * 0.4), opts)
    }
  }
  if (shape === 0) {
    // 모란: 두 색 구
    sphere(220, 15, c1, { life: 2.2 })
    sphere(90, 8, c2, { life: 1.8 })
  } else if (shape === 1) {
    // 고리: 기울어진 원판 모양
    const tilt = Math.random() * Math.PI
    for (let k = 0; k < 160; k++) {
      const a = (k / 160) * Math.PI * 2
      const v = 16
      emit(pool, x, y, z, Math.cos(a) * v, Math.sin(a) * Math.cos(tilt) * v, Math.sin(a) * Math.sin(tilt) * v, c1, 2.2)
    }
    sphere(60, 5, c2, { life: 1.5 })
  } else if (shape === 2) {
    // 버드나무: 금빛이 길게 늘어지며 떨어짐
    sphere(200, 11, new THREE.Color('#ffcc66'), { life: 4, drag: 0.97, gravity: GRAVITY * 0.6 })
  } else if (shape === 3) {
    // 크로셋: 큰 불꽃이 흩어지다 각자 작게 다시 터짐
    sphere(40, 13, c1, { life: 1.1, kind: 2 })
  } else {
    // 하트
    for (let k = 0; k < 140; k++) {
      const a = (k / 140) * Math.PI * 2
      const hx = 16 * Math.sin(a) ** 3
      const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)
      emit(pool, x, y, z, hx * 0.9, hy * 0.9, 0, new THREE.Color('#ff4fa3'), 2.4, { gravity: GRAVITY * 0.15 })
    }
  }
}

function launch(pool, shape = Math.floor(Math.random() * 5)) {
  const x = LAUNCH.minX + Math.random() * (LAUNCH.maxX - LAUNCH.minX)
  const z = LAUNCH.minZ + Math.random() * (LAUNCH.maxZ - LAUNCH.minZ)
  const top = FIREWORK_HEIGHT + Math.random() * 10 // 돔보다 20~30m 위에서 터짐
  const vy = Math.sqrt(2 * -GRAVITY * top) // 이 속도로 쏘면 꼭대기(속도 0)가 top 높이
  emit(pool, x, 0.5, z, (Math.random() - 0.5) * 2, vy, (Math.random() - 0.5) * 2, tmpColor.set('#fff3c4'), 10, { drag: 1, gravity: GRAVITY, kind: 1, burst: shape })
}

// 한 묶음의 발사 계획: 처음엔 한 발씩, 점점 잦아지다가 마지막 1.5초는 3발씩 몰아침
export function fireworkSchedule(seconds = VOLLEY_SECONDS) {
  const plan = []
  for (let t = 0; t < seconds - 1.5; t += 0.7 - (t / seconds) * 0.4) plan.push({ t, count: t > seconds * 0.4 ? 2 : 1 })
  for (let t = seconds - 1.5; t < seconds; t += 0.5) plan.push({ t, count: 3 })
  return plan
}

function Fireworks() {
  const timeOfDay = useSettings((s) => s.timeOfDay)
  const pool = useMemo(createPool, [])
  const show = useRef(null) // { start, plan, index }
  const pointsRef = useRef(null)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pool.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(pool.col, 3))
    return g
  }, [pool])
  const material = useMemo(
    () => new THREE.PointsMaterial({ size: 1.6, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    [],
  )
  useEffect(() => () => { geometry.dispose(); material.map.dispose(); material.dispose() }, [geometry, material])

  // 시작 시각은 다음 프레임에서 정함 (밤 상태로 처음 들어올 때 지난 발사가 한꺼번에 몰리지 않게)
  const start = () => { show.current = { start: null, plan: fireworkSchedule(), index: 0 } }

  // 밤으로 바뀌면(또는 밤 상태로 들어오면) 첫 묶음. 다음 묶음은 아래 useFrame이 이어서 예약
  useEffect(() => {
    if (timeOfDay === 'night') start()
  }, [timeOfDay])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__sgFireworks = start
    return () => { delete window.__sgFireworks }
  }, [])

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05) // 탭을 다녀오면 한 번에 크게 튀지 않게
    const s = show.current
    if (s) {
      s.start ??= clock.elapsedTime
      const t = clock.elapsedTime - s.start
      while (s.index < s.plan.length && s.plan[s.index].t <= t) {
        for (let k = 0; k < s.plan[s.index].count; k++) launch(pool)
        s.index++
      }
      // 묶음이 끝나면 아직 밤일 때만 PAUSE_SECONDS 뒤에 다음 묶음 (start가 미래라 그때까지 발사 없음)
      if (s.index >= s.plan.length) {
        show.current = useSettings.getState().timeOfDay === 'night'
          ? { start: clock.elapsedTime + PAUSE_SECONDS, plan: fireworkSchedule(), index: 0 }
          : null
      }
    }

    let alive = 0
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pool.life[i] <= 0) continue
      const j = i * 3
      pool.life[i] -= delta
      pool.vel[j + 1] += pool.gravity[i] * delta
      const d = pool.drag[i] ** (delta * 60)
      pool.vel[j] *= d
      pool.vel[j + 1] *= d
      pool.vel[j + 2] *= d
      pool.pos[j] += pool.vel[j] * delta
      pool.pos[j + 1] += pool.vel[j + 1] * delta
      pool.pos[j + 2] += pool.vel[j + 2] * delta

      if (pool.kind[i] === 1) {
        // 로켓: 꼬리 불꽃을 남기며 오르다가 꼭대기(속도가 아래로 바뀜)에서 폭발
        if (Math.random() < 0.6) emit(pool, pool.pos[j], pool.pos[j + 1], pool.pos[j + 2], 0, -2, 0, tmpColor.set('#ffb35c'), 0.5)
        if (pool.vel[j + 1] <= 0) {
          pool.life[i] = 0
          explode(pool, pool.pos[j], pool.pos[j + 1], pool.pos[j + 2], pool.burst[i])
          continue
        }
      } else if (pool.kind[i] === 2 && pool.life[i] <= 0) {
        // 크로셋 조각이 꺼질 때 작은 구로 다시 터짐
        tmpColor.setRGB(pool.base[j], pool.base[j + 1], pool.base[j + 2])
        for (let k = 0; k < 14; k++) {
          const a = Math.random() * Math.PI * 2
          const u = Math.random() * 2 - 1
          const r = Math.sqrt(1 - u * u) * 6
          emit(pool, pool.pos[j], pool.pos[j + 1], pool.pos[j + 2], Math.cos(a) * r, u * 6, Math.sin(a) * r, tmpColor, 0.8)
        }
      }
      // 반짝임: 수명 끝으로 갈수록 어두워지고, 살짝 깜빡임
      const k = Math.max(0, pool.life[i] / pool.maxLife[i]) * (0.75 + 0.25 * Math.random())
      pool.col[j] = pool.base[j] * k
      pool.col[j + 1] = pool.base[j + 1] * k
      pool.col[j + 2] = pool.base[j + 2] * k
      if (pool.life[i] <= 0) pool.col[j] = pool.col[j + 1] = pool.col[j + 2] = 0
      alive++
    }
    if (pointsRef.current) pointsRef.current.visible = alive > 0
    if (alive === 0) return // 쇼가 없을 때는 GPU로 버퍼를 다시 보내지 않음
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} visible={false} />
}

// styles/index.js에서 한 줄로 등록 (sg_kpop.json의 style 이름)
export const SG_DOME_SHOW_STYLES = { kpopDomeShow: KpopDomeShow }
