import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { Box, Cyl, GEO, Instances, mat } from './kit.jsx'
import { FilmingAlleyShop } from './filmingAlley.jsx'
import { useSgStudio } from './sg_studioStore.js'

// ── 물결 레코딩 스튜디오 (SG) ─────────────────────
// 기존 골목 가게 모양(FilmingAlleyShop) + 2층 외벽 장식 + TTS 체험의 3D 쪽(감지·E키)
// 화면 UI(안내·입력창)는 components/sg/StudioPanel.jsx
//
// - 감지는 places.json 센서가 아니라 useFrame 거리 계산 → 스탬프 대화창이 뜨지 않고, 바닥 표시도 안 생김
// - E를 누르면 공용 gameStore.open()으로 캐릭터 이동을 멈춤 (지민님 농구 체험과 같은 방식)
//   placeId가 places.json에 없어서 혜진님 대화창은 뜨지 않음

const NEAR_DIST = 3.5 // 정면 가운데에서 이 거리 안이면 안내
const FIND_PLAYER_EVERY = 1 // 캐릭터를 다시 찾는 간격(초)

const NEON = mat('#64cdbc', { emissive: '#64cdbc', emissiveIntensity: 1.6 })
const VINYL = mat('#17171c', { roughness: 0.3, metalness: 0.2 })
const LABEL = mat('#ffb2bd', { emissive: '#ff8fa3', emissiveIntensity: 0.6 })
const ON_AIR = mat('#ff4d6d', { emissive: '#ff2d55', emissiveIntensity: 2 })
const facing = [Math.PI / 2, 0, 0] // 원기둥을 눕혀 정면(+z)을 보게

export function SgStudio({ item }) {
  const [w, h, d] = item.size
  return (
    <>
      <FilmingAlleyShop item={item} />
      <StudioFacade w={w} h={h} front={d / 2} />
      <StudioSensor id={item.id} front={d / 2} />
    </>
  )
}

// 2층 외벽(어두운 유리창 위): 음파 모양 네온 막대 + 양옆 LP판 + ON AIR 등
// 막대 수십 개는 <Instances>로 한 번에 그림
function StudioFacade({ w, h, front }) {
  const z = front + 0.06
  const bars = useMemo(() => {
    const count = 25
    const span = w - 6
    return Array.from({ length: count }, (_, i) => {
      const height = 0.2 + 0.85 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.23))
      return { p: [-span / 2 + (i * span) / (count - 1), h - 1.05, z], s: [0.14, height, 0.06] }
    })
  }, [w, h, z])

  return (
    <group>
      <Instances geometry={GEO.box} material={NEON} items={bars} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 - 1.5), h - 1.05, z]}>
          <Cyl p={[0, 0, 0]} rad={0.95} h={0.06} m={VINYL} r={facing} />
          <Cyl p={[0, 0, 0.04]} rad={0.32} h={0.03} m={LABEL} r={facing} />
        </group>
      ))}
      <Box p={[0, h - 0.25, z]} s={[1.6, 0.36, 0.1]} m={ON_AIR} userData={{ noShadow: true }} />
    </group>
  )
}

function StudioSensor({ id, front }) {
  const scene = useThree((state) => state.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const tmp = useMemo(() => ({ me: new THREE.Vector3(), spot: new THREE.Vector3() }), [])

  // 가까이 있는지: 매 프레임 거리 계산, 값이 바뀔 때만 저장소에 씀 (안 바뀌면 다시 그리기 없음)
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
    if (near !== useSgStudio.getState().near) useSgStudio.getState().setNear(near)
  })

  // E: 녹음실 열기 (다른 패널·지점 안내가 떠 있으면 무시해서 겹치지 않게)
  useEffect(() => {
    const down = (event) => {
      if (event.repeat || event.code !== 'KeyE') return
      const s = useSgStudio.getState()
      const game = useGameStore.getState()
      if (s.near && s.step === 'closed' && !game.openPanel && !game.nearbyPlaceId) {
        s.setError(null)
        s.setStep('input')
        game.open({ type: 'sg_studio', placeId: id })
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [id])

  // ESC(공용 InteractionKeys)나 닫기 버튼으로 패널이 닫히면 재생도 멈추고 닫힘 상태로
  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        if (useSgStudio.getState().step === 'closed' || state.openPanel?.placeId === id) return
        window.speechSynthesis?.cancel()
        useSgStudio.getState().setStep('closed')
      }),
    [id],
  )

  return <group ref={anchor} position={[0, 0, front + 1.5]} />
}
