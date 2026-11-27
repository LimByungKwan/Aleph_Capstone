import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { Box, Cyl, mat } from './kit.jsx'
import { CHEER_PANEL, useSgCheer } from './sg_cheerStore.js'
import { sgSpots } from './sg_spots.js'
import { findPlayer } from '../../Player/findPlayer.js'

// ── SUNSET WAVE 응원 자리 (SG) ─────────────────────
// 무대 앞 관객석의 응원봉 받침대 + 감지·E키. 화면 UI(리듬 게임)는 components/sg/CheerGame.jsx
// 감지 방식은 물결 레코딩 스튜디오(sg_studio.jsx)와 같음: places.json 센서 대신 useFrame 거리 계산
// 무대 스탬프 지점과 6m 넘게 떨어뜨려 둬서 스탬프 E와 겹치지 않음 (sg_kpop.json의 sg_cheer 위치)

const NEAR_DIST = 2.2
const FIND_PLAYER_EVERY = 1

const STICK = mat('#c4a5ff', { emissive: '#b18cff', emissiveIntensity: 1.8 })
const STAND = mat('#2b2340')

export function SgCheer({ item }) {
  return (
    <>
      <Box p={[0, 0.45, 0]} s={[0.5, 0.9, 0.5]} m={STAND} />
      <Cyl p={[0, 1.2, 0]} rad={0.07} h={0.6} m={STICK} />
      <CheerSensor id={item.id} />
    </>
  )
}

function CheerSensor({ id }) {
  const scene = useThree((state) => state.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const tmp = useMemo(() => ({ me: new THREE.Vector3(), spot: new THREE.Vector3() }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!player.current?.parent && t - lastLookup.current > FIND_PLAYER_EVERY) {
      lastLookup.current = t
      player.current = findPlayer(scene)
    }
    if (!player.current?.parent || !anchor.current) return
    anchor.current.getWorldPosition(tmp.spot)
    player.current.getWorldPosition(tmp.me)
    const near = Math.hypot(tmp.me.x - tmp.spot.x, tmp.me.z - tmp.spot.z) < NEAR_DIST
    if (near !== useSgCheer.getState().near) useSgCheer.getState().setNear(near)
  })

  // E: 게임 열기 (다른 패널이나 스탬프 안내가 떠 있으면 무시)
  useEffect(() => {
    const down = (event) => {
      if (event.repeat || event.code !== 'KeyE') return
      const game = useGameStore.getState()
      if (useSgCheer.getState().near && !game.openPanel && !game.nearbyPlaceId) game.open({ type: CHEER_PANEL, placeId: id })
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [id])

  return <group ref={(o) => { anchor.current = o; sgSpots.sg_cheer_spot = o }} /> // KpopGuide 워프 도착점으로 등록
}
