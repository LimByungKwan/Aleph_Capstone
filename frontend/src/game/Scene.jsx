import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { KeyboardControls, OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import MapLayout from './Map/MapLayout.jsx'
import PlaceMarkers from './Map/PlaceMarkers.jsx'
import Colliders from './Map/Colliders.jsx'
import { Elevators } from './Map/Terrain.jsx'
import PastelSky from './Map/PastelSky.jsx'
import Player, { KEYBOARD_MAP } from './Player/Player.jsx'
import FirstPersonCamera from './Player/FirstPersonCamera.jsx'
import FollowCamera from './Player/FollowCamera.jsx'
import PlaceSensors from './Interaction/PlaceSensors.jsx'
import FootSplashes from './Player/FootSplashes.jsx'
import InteractionKeys from './Interaction/InteractionKeys.jsx'
import { useGameStore } from '../store/gameStore.js'
import {
  CAMERA_MAX_ZOOM_OUT,
  CAMERA_START,
  CAMERA_TARGET,
  CAMERA_VIEW,
  FREE_CAMERA,
  PHYSICS_DEBUG,
  SHADOW_AREA,
  SHOW_ZONE_OWNERS,
  SHOW_ZONES,
  SUN_POSITION,
} from './config.js'
import { labelLayer } from './labelLayer.js'
import { zones } from './data/mapData.js'
import SeasonPicker from './SeasonPicker.jsx'
import { SEASON_LOOK, useSeason } from './seasons.js'
import SeasonalWeather from './Map/SeasonalWeather.jsx'

// 3D 화면 전체: 캔버스, 하늘, 조명, 물리, 캐릭터/카메라, 맵, 상호작용 지점
// 두 가지 모드: 둘러보기(맵 전체) ↔ 플레이(캐릭터 조종). 버튼으로 전환.
export default function Scene() {
  const [playing, setPlaying] = useState(!FREE_CAMERA)
  const [highDetail, setHighDetail] = useState(false)
  const playerRef = useRef(null) // 캐릭터 위치를 카메라·센서와 공유

  const startPlay = (event) => {
    event.currentTarget.blur() // 버튼에 포커스가 남으면 Space(점프)가 버튼을 다시 누름
    setPlaying(true)
  }

  const stopPlay = (event) => {
    event.currentTarget.blur()
    // 캐릭터가 사라지면 센서 "나감" 신호가 안 오므로 직접 초기화
    const { close, setNearby } = useGameStore.getState()
    close()
    setNearby(null)
    setPlaying(false)
  }

  const firstPerson = CAMERA_VIEW === 'first'

  return (
    <KeyboardControls map={KEYBOARD_MAP}>
      <div ref={labelLayer} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Canvas dpr={highDetail ? [1, 2] : 0.8} shadows={highDetail ? 'percentage' : false} camera={{ position: CAMERA_START, fov: 50, near: 0.1, far: 1000 }}>
          {/* 파스텔 하늘 + 구름 + 먼 산 + 바깥 풀밭 + 안개 */}
          <PastelSky />

          {/* 따뜻한 전체 조명 + 그림자 있는 태양광 1개 (그림자는 보고 있는 곳 주변만) */}
          <hemisphereLight args={['#fff0f5', '#c2ae98', 0.65]} />
          <SunLight castShadow={highDetail} />

          <MapLayout showStartMarker={!playing} highDetail={highDetail} />
          {playing && <SeasonalWeather playerRef={playerRef} />}
          <PlaceMarkers />

          {/* 물리 엔진(Rapier)은 처음에 잠깐 로딩이 필요해서 Suspense로 감쌈 */}
          <Suspense fallback={null}>
            <Physics debug={PHYSICS_DEBUG}>
              <Colliders />
              <Elevators playerRef={playerRef} />
              {playing && (
                <>
                  <Player playerRef={playerRef} showModel={!firstPerson} />
                  <FootSplashes playerRef={playerRef} />
                  <PlaceSensors playerRef={playerRef} />
                  {firstPerson ? <FirstPersonCamera playerRef={playerRef} /> : <FollowCamera playerRef={playerRef} />}
                </>
              )}
            </Physics>
          </Suspense>

          {playing ? <InteractionKeys /> : <OverviewCamera />}
        </Canvas>

        <HelpPanel playing={playing} onStart={startPlay} onStop={stopPlay} highDetail={highDetail} setHighDetail={setHighDetail} />
      </div>
    </KeyboardControls>
  )
}

// 태양광 + 그림자. 최적화: 그림자 범위를 맵 전체가 아니라 "카메라가 보고 있는 곳" 주변으로만 잡음
// → 멀리 있는 건물은 그림자 계산에서 빠지고, 같은 그림자 해상도로 더 선명해짐
const SHADOW_MIN_AREA = 35
const lookTarget = new THREE.Vector3()

function SunLight({ castShadow }) {
  const season = useSeason()
  const lightRef = useRef(null)
  const area = useRef(SHADOW_AREA)

  useFrame(({ camera, controls }) => {
    const light = lightRef.current
    if (!light) return
    if (controls?.getTarget) controls.getTarget(lookTarget)
    else if (controls?.target) lookTarget.copy(controls.target)
    else lookTarget.set(0, 0, 0)

    // 2m 단위로 맞춰 움직여서 그림자가 지글거리지 않게
    const x = Math.round(lookTarget.x / 2) * 2
    const z = Math.round(lookTarget.z / 2) * 2
    light.position.set(x + SUN_POSITION[0], SUN_POSITION[1], z + SUN_POSITION[2])
    light.target.position.set(x, 0, z)
    light.target.updateMatrixWorld()

    if (!castShadow) return
    const wanted = THREE.MathUtils.clamp(camera.position.distanceTo(lookTarget) * 0.9, SHADOW_MIN_AREA, SHADOW_AREA)
    if (Math.abs(wanted - area.current) > 3) {
      area.current = wanted
      const cam = light.shadow.camera
      cam.left = cam.bottom = -wanted
      cam.right = cam.top = wanted
      cam.updateProjectionMatrix()
    }
  })

  return (
    <directionalLight
      ref={lightRef}
      intensity={1.6}
      color={SEASON_LOOK[season].sun}
      castShadow={castShadow}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-SHADOW_AREA}
      shadow-camera-right={SHADOW_AREA}
      shadow-camera-top={SHADOW_AREA}
      shadow-camera-bottom={-SHADOW_AREA}
      shadow-camera-near={1}
      shadow-camera-far={600}
      shadow-bias={-0.0005}
    />
  )
}

// 둘러보기 카메라. 땅 밑으로 못 내려가고, 옆으로 끌면 땅과 평행하게 이동
function OverviewCamera() {
  const camera = useThree((state) => state.camera)

  // 플레이에서 돌아올 때 카메라를 맵 전체가 보이는 위치로 되돌림
  useEffect(() => {
    camera.position.set(...CAMERA_START)
  }, [camera])

  return (
    <OrbitControls
      makeDefault
      target={CAMERA_TARGET}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={3}
      maxDistance={CAMERA_MAX_ZOOM_OUT}
      screenSpacePanning={false}
    />
  )
}

// 왼쪽 위 안내 + 모드 전환 버튼 + (확인용) 게임 스토어 값
function HelpPanel({ playing, onStart, onStop, highDetail, setHighDetail }) {
  const nearbyPlaceId = useGameStore((state) => state.nearbyPlaceId)
  const openPanel = useGameStore((state) => state.openPanel)

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        padding: '10px 14px',
        borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.55)',
        color: '#fff',
        fontSize: 13,
        lineHeight: 1.6,
        pointerEvents: 'none',
      }}
    >
      <strong>SceneWalk AI</strong>
      <br />
      {playing
        ? 'WASD: 이동 · Shift: 달리기 · Space: 점프 · 마우스 드래그: 시점 회전 · E: 상호작용 · ESC: 닫기'
        : '왼쪽 드래그: 회전 · 오른쪽 드래그: 이동 · 휠: 확대/축소'}

      {SHOW_ZONES && <ZoneLegend />}
      <SeasonPicker />
      <label style={{ display: 'block', marginTop: 4, pointerEvents: 'auto' }}>
        <input
          type="checkbox"
          checked={highDetail}
          onChange={(event) => {
            setHighDetail(event.currentTarget.checked)
            event.currentTarget.blur()
          }}
        />{' '}
        고화질 (그림자·고해상도)
      </label>

      {playing && (
        <div style={{ marginTop: 6, fontFamily: 'Consolas, monospace', fontSize: 12 }}>
          nearbyPlaceId: {JSON.stringify(nearbyPlaceId)}
          <br />
          openPanel: {JSON.stringify(openPanel)}
        </div>
      )}

      <button
        type="button"
        onClick={playing ? onStop : onStart}
        style={{
          display: 'block',
          marginTop: 8,
          padding: '6px 12px',
          border: 'none',
          borderRadius: 6,
          background: playing ? '#e5e7eb' : '#22c55e',
          color: playing ? '#111' : '#fff',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        {playing ? '맵 전체 보기' : `▶ ${CAMERA_VIEW === 'first' ? '1인칭' : '3인칭'}으로 플레이하기`}
      </button>
    </div>
  )
}

// 구역 범례: "■ BK 분홍 / ■ JM 하늘 / ■ HJ 주황" (발표용이면 구역 이름만)
function ZoneLegend() {
  return (
    <div style={{ marginTop: 4 }}>
      {zones.map((zone, i) => (
        <span key={zone.zoneId} style={{ whiteSpace: 'nowrap' }}>
          {i > 0 && ' / '}
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              marginRight: 4,
              borderRadius: 2,
              background: zone.color,
              verticalAlign: 'middle',
            }}
          />
          {SHOW_ZONE_OWNERS ? `${zone.zoneId} ${zone.colorName}` : zone.name}
        </span>
      ))}
    </div>
  )
}
