import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useGameStore } from '../../../store/gameStore.js'
import { Ball, Box, Cyl, GEO, Instances, mat, texMat } from './kit.jsx'
import { AUDITION_PANEL, JUDGES, useSgAudition } from './sg_auditionStore.js'
import { getSignTexture } from './textures.js'
import { sgSpots } from './sg_spots.js'

// ── 썬그레이 오디션 (SG) ─────────────────────────
// 뮤비 촬영 골목 끝의 오디션 세트 + 골목 입구 게이트 + 구역 입구 파일런 간판
// 화면 UI(미리 듣기·녹음·결과)는 components/sg/AuditionPanel.jsx
// - 세트는 collider:false(안으로 걸어 들어감), 옆·뒤 벽 충돌은 sg_kpop.json의 sg_audition_wall_* 상자가 맡음
// - 감지·E키는 응원봉 게임(sg_cheer.jsx)과 같은 방식: useFrame 거리 계산
// - 빛나는 부품은 실제 조명 대신 emissive + 더하기 합성 빔 (조명 수를 늘리지 않음)

const NEAR_DIST = 1.8
const FIND_PLAYER_EVERY = 1
const glow = { userData: { noShadow: true } }

const DARK = mat('#17121f', { roughness: 0.3, metalness: 0.4 })
const FLOOR = mat('#1b1626', { roughness: 0.25, metalness: 0.35 })
const METAL = mat('#c3c6cf', { roughness: 0.35, metalness: 0.8 })
const DESK = mat('#f4eefc', { roughness: 0.4 })
const SEAT = mat('#2b2340', { roughness: 0.6 })
const PINK = mat('#ff7ab6', { emissive: '#ff4fa3', emissiveIntensity: 2.2 })
const PURPLE = mat('#b18cff', { emissive: '#9b5cff', emissiveIntensity: 2.2 })
const WARM = mat('#fff3c4', { emissive: '#ffd166', emissiveIntensity: 2.5 })
const SPOT = new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.35, depthWrite: false })
const beam = (color, opacity = 0.12) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
const BEAM_GEO = new THREE.ConeGeometry(1, 1, 24, 1, true) // 꼭짓점이 위(+y)
const signMat = (text, bg, fg, aspect, glowing = 0.9) => texMat(getSignTexture(text, bg, fg, aspect), { emissive: '#ffffff', emissiveIntensity: glowing })

// ── 1. 구역 입구 파일런: 입구로 들어오는 사람 정면(+z)에 큰 간판 ──
export function AuditionPylon({ item }) {
  const [w, h] = item.size
  const panelH = w * 0.5
  return (
    <>
      <Cyl p={[0, (h - panelH) / 2, 0]} rad={0.18} h={h - panelH} m={METAL} />
      <Box p={[0, h - panelH / 2, 0]} s={[w + 0.3, panelH + 0.3, 0.3]} m={DARK} />
      <mesh {...glow} geometry={GEO.plane} position={[0, h - panelH * 0.38, 0.16]} scale={[w, panelH * 0.62, 1]} material={signMat('SUNGRAY 오디션', '#2b1d42', '#ffd6f0', w / (panelH * 0.62), 1.2)} />
      <mesh {...glow} geometry={GEO.plane} position={[0, h - panelH * 0.84, 0.16]} scale={[w, panelH * 0.3, 1]} material={signMat('뮤비 골목 안에서 지금 도전 ▶', '#ff4fa3', '#ffffff', w / (panelH * 0.3), 1)} />
      <Marquee w={w + 0.3} y={h + 0.2} z={0.18} />
      <Marquee w={w + 0.3} y={h - panelH - 0.2} z={0.18} />
    </>
  )
}

// ── 2. 골목 입구 게이트: 네온 기둥 + 전구 간판 + 하늘로 흔들리는 서치라이트 ──
export function AuditionGate({ item }) {
  const [w, h] = item.size
  const x = w / 2 - 0.3
  return (
    <>
      {[-x, x].map((px, i) => (
        <group key={px} position={[px, 0, 0]}>
          <Box p={[0, h / 2, 0]} s={[0.5, h, 0.5]} m={DARK} />
          <Box {...glow} p={[0, h / 2, 0.26]} s={[0.12, h - 0.4, 0.04]} m={i ? PURPLE : PINK} />
          <Box {...glow} p={[0, h / 2, -0.26]} s={[0.12, h - 0.4, 0.04]} m={i ? PURPLE : PINK} />
          <Searchlight y={h} color={i ? '#b18cff' : '#ff7ab6'} phase={i * Math.PI} />
        </group>
      ))}
      <Box p={[0, h - 0.7, 0]} s={[w, 1.4, 0.4]} m={DARK} />
      <mesh {...glow} geometry={GEO.plane} position={[0, h - 0.7, 0.21]} scale={[w - 0.6, 1.1, 1]} material={signMat('SUNGRAY AUDITION', '#1a1030', '#ffe066', (w - 0.6) / 1.1, 1.4)} />
      <mesh {...glow} geometry={GEO.plane} position={[0, h - 0.7, -0.21]} rotation={[0, Math.PI, 0]} scale={[w - 0.6, 1.1, 1]} material={signMat('SUNGRAY AUDITION', '#1a1030', '#ffe066', (w - 0.6) / 1.1, 1.4)} />
      <Marquee w={w} y={h + 0.05} z={0.22} />
      <Marquee w={w} y={h - 1.45} z={0.22} />
    </>
  )
}

// 간판 테두리 전구: 짝수·홀수 전구가 번갈아 깜빡임 (재질 두 개의 밝기만 바꿔서 draw call은 그대로)
// mat()은 같은 값이면 재질을 공유하므로, 밝기를 바꾸는 전구는 따로 만듦
const BULB_A = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd166', emissiveIntensity: 2.5 })
const BULB_B = BULB_A.clone()
function Marquee({ w, y, z }) {
  const count = Math.max(4, Math.round(w / 0.35))
  const bulbs = (odd) =>
    Array.from({ length: count }, (_, i) => i).filter((i) => i % 2 === odd).map((i) => ({ p: [-w / 2 + (w * (i + 0.5)) / count, y, z], s: [0.09, 0.09, 0.09] }))
  useFrame(({ clock }) => {
    const on = Math.floor(clock.elapsedTime * 3) % 2 === 0
    BULB_A.emissiveIntensity = on ? 3 : 0.3
    BULB_B.emissiveIntensity = on ? 0.3 : 3
  })
  return (
    <>
      <Instances geometry={GEO.sphere} material={BULB_A} items={bulbs(0)} />
      <Instances geometry={GEO.sphere} material={BULB_B} items={bulbs(1)} />
    </>
  )
}

function Searchlight({ y, color, phase }) {
  const ref = useRef(null)
  const material = useMemo(() => beam(color, 0.1), [color])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime * 0.6 + phase
    ref.current.rotation.set(0.35 * Math.sin(t), 0, 0.45 * Math.cos(t * 0.8))
  })
  // 원뿔 꼭짓점을 기둥 꼭대기에 두고 위로 넓어지게 (뒤집은 원뿔)
  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh {...glow} geometry={BEAM_GEO} material={material} position={[0, 12, 0]} rotation={[Math.PI, 0, 0]} scale={[2.2, 24, 2.2]} />
    </group>
  )
}

// ── 3. 오디션 세트 (앞(+z)이 골목 입구 쪽, 뒤(-z)가 LED 벽) ──
export const SINGER_Z = -1.2 // 지원자가 서는 자리 (세트 가운데 기준)

export function AuditionSet({ item }) {
  const [w, h, d] = item.size
  const back = -d / 2 + 0.25
  return (
    <>
      <Box p={[0, 0.03, 0]} s={[w - 0.8, 0.06, d - 0.4]} m={FLOOR} />
      {/* LED 벽 + 위아래 네온 띠 */}
      <Box p={[0, h * 0.5, back]} s={[w - 1.2, h * 0.62, 0.12]} m={DARK} />
      <mesh {...glow} geometry={GEO.plane} position={[0, h * 0.5, back + 0.07]} scale={[w - 1.6, h * 0.55, 1]} material={signMat('SUNGRAY GLOBAL AUDITION', '#1a1030', '#ff9bd2', (w - 1.6) / (h * 0.55), 1.1)} />
      <Box {...glow} p={[0, h * 0.18, back + 0.08]} s={[w - 1.2, 0.08, 0.04]} m={PINK} />
      <Box {...glow} p={[0, h * 0.82, back + 0.08]} s={[w - 1.2, 0.08, 0.04]} m={PURPLE} />
      {/* 앞쪽 위 간판 (골목에서 보임) */}
      <Box p={[0, h - 0.4, d / 2 - 0.2]} s={[w, 0.8, 0.3]} m={DARK} />
      <mesh {...glow} geometry={GEO.plane} position={[0, h - 0.4, d / 2 - 0.04]} scale={[w - 0.4, 0.62, 1]} material={signMat('★ 오디션룸 ★ ON AIR', '#ff2d55', '#ffffff', (w - 0.4) / 0.62, 1.3)} />
      <Marquee w={w} y={h + 0.05} z={d / 2 - 0.02} />
      {/* 천장 트러스 + 조명 3개가 마이크 자리를 비춤 */}
      <Box p={[0, h - 0.2, SINGER_Z + 0.4]} s={[w - 1, 0.18, 0.18]} m={METAL} />
      {[-2.4, 0, 2.4].map((x, i) => (
        <group key={x}>
          <Box p={[x, h - 0.45, SINGER_Z + 0.4]} s={[0.36, 0.36, 0.36]} m={DARK} />
          <SpotBeam from={[x, h - 0.6, SINGER_Z + 0.4]} to={[0, 0, SINGER_Z]} color={i === 1 ? '#fff3c4' : i ? '#b18cff' : '#ff7ab6'} />
        </group>
      ))}
      {/* 마이크 자리: 바닥 원 + 스탠드 */}
      <mesh {...glow} geometry={GEO.cyl} material={SPOT} position={[0, 0.07, SINGER_Z]} scale={[1.1, 0.01, 1.1]} />
      <Cyl p={[0, 0.75, SINGER_Z - 0.35]} rad={0.025} h={1.5} m={METAL} />
      <Cyl p={[0, 0.02, SINGER_Z - 0.35]} rad={0.22} h={0.04} m={METAL} />
      <Ball p={[0, 1.55, SINGER_Z - 0.35]} rad={0.06} m={DARK} />
      {/* 뮤비 촬영 느낌: 삼각대 카메라 */}
      <Cyl p={[w / 2 - 1.4, 0.7, 0.6]} rad={0.04} h={1.4} m={METAL} />
      <Box p={[w / 2 - 1.4, 1.5, 0.6]} s={[0.5, 0.35, 0.3]} r={[0, -0.7, 0]} m={DARK} />
      <Ball {...glow} p={[w / 2 - 1.4, 1.62, 0.6]} rad={0.04} m={PINK} />
      <JudgeTable z={2.2} />
      <AuditionSensor id={item.id} />
    </>
  )
}

function SpotBeam({ from, to, color }) {
  const material = useMemo(() => beam(color, 0.13), [color])
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const dir = b.clone().sub(a)
    const len = dir.length()
    // 원뿔은 꼭짓점이 +y → -y 방향(넓은 밑면)이 목표를 보게 회전
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize())
    return { position: a.clone().add(b).multiplyScalar(0.5), quaternion: q, length: len }
  }, [from, to])
  return <mesh {...glow} geometry={BEAM_GEO} material={material} position={position} quaternion={quaternion} scale={[0.7, length, 0.7]} />
}

// 심사위원 책상: 지원자(-z) 쪽을 바라봄
function JudgeTable({ z }) {
  return (
    <group position={[0, 0, z]}>
      <Box p={[0, 0.74, 0]} s={[6.6, 0.06, 0.9]} m={DESK} />
      <Box p={[0, 0.38, -0.4]} s={[6.6, 0.7, 0.05]} m={DESK} />
      <Box {...glow} p={[0, 0.06, -0.44]} s={[6.6, 0.04, 0.03]} m={PINK} />
      {JUDGES.map((judge, i) => {
        const x = (i - 1) * 2.2
        return (
          <group key={judge.role} position={[x, 0, 0]}>
            <mesh {...glow} geometry={GEO.plane} position={[0, 0.45, -0.43]} rotation={[0, Math.PI, 0]} scale={[1.5, 0.34, 1]} material={signMat(judge.role, '#1a1030', judge.color, 1.5 / 0.34, 1)} />
            <Box p={[0, 0.78, -0.1]} s={[0.5, 0.03, 0.35]} m={WARM} {...glow} />
            <JudgeSeat model={judge.model} />
          </group>
        )
      })}
    </group>
  )
}

class ModelBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('[audition] 심사위원 모델을 불러오지 못했습니다.', error) }
  render() { return this.state.failed ? null : this.props.children }
}

// 의자 + 앉은 심사위원 (책상 뒤 +z, 지원자 쪽 -z를 바라봄)
function JudgeSeat({ model }) {
  return (
    <group position={[0, 0, 0.75]}>
      <Box p={[0, 0.23, 0]} s={[0.55, 0.46, 0.55]} m={SEAT} />
      <Box p={[0, 0.8, 0.3]} s={[0.55, 0.7, 0.08]} m={SEAT} />
      <ModelBoundary>
        <Suspense fallback={null}>
          <SeatedJudge path={model} />
        </Suspense>
      </ModelBoundary>
    </group>
  )
}

const SEAT_TOP = 0.46
function SeatedJudge({ path }) {
  const { scene, animations } = useGLTF(import.meta.env.BASE_URL + path)
  const { model, lift } = useMemo(() => {
    const object = clone(scene)
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.frustumCulled = false
      }
    })
    const sit = animations.find((clip) => clip.name === 'Sit')
    if (!sit) return { model: object, lift: 0 }
    // Sit 동작 마지막 장면에 멈춤 (믹서를 멈추면 원래 자세로 돌아가므로 그대로 둠)
    const mixer = new THREE.AnimationMixer(object)
    const action = mixer.clipAction(sit).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    mixer.setTime(sit.duration)
    object.updateMatrixWorld(true)
    const hips = object.getObjectByName('Hips')?.getWorldPosition(new THREE.Vector3()).y ?? SEAT_TOP
    return { model: object, lift: SEAT_TOP - (hips - 0.06) } // 엉덩이를 의자 높이에 맞춤
  }, [scene, animations])
  return <primitive object={model} position={[0, lift, 0]} rotation={[0, Math.PI, 0]} />
}

// 마이크 앞에 서면 안내, E로 패널 열기 (다른 패널·스탬프 안내가 떠 있으면 무시)
function AuditionSensor({ id }) {
  const scene = useThree((state) => state.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const tmp = useMemo(() => ({ me: new THREE.Vector3(), spot: new THREE.Vector3() }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!player.current?.parent && t - lastLookup.current > FIND_PLAYER_EVERY) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    if (!player.current?.parent || !anchor.current) return
    anchor.current.getWorldPosition(tmp.spot)
    player.current.getWorldPosition(tmp.me)
    const near = Math.hypot(tmp.me.x - tmp.spot.x, tmp.me.z - tmp.spot.z) < NEAR_DIST
    if (near !== useSgAudition.getState().near) useSgAudition.getState().setNear(near)
  })

  useEffect(() => {
    const down = (event) => {
      if (event.repeat || event.code !== 'KeyE') return
      const game = useGameStore.getState()
      if (useSgAudition.getState().near && !game.openPanel && !game.nearbyPlaceId) game.open({ type: AUDITION_PANEL, placeId: id })
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [id])

  return <group ref={(o) => { anchor.current = o; sgSpots.sg_audition_spot = o }} position={[0, 0, SINGER_Z]} /> // KpopGuide 워프 도착점으로 등록
}

JUDGES.forEach((judge) => useGLTF.preload(import.meta.env.BASE_URL + judge.model))

// styles/index.js에서 한 줄로 등록 (sg_kpop.json의 style 이름)
export const SG_AUDITION_STYLES = { auditionSet: AuditionSet, auditionGate: AuditionGate, auditionPylon: AuditionPylon }
