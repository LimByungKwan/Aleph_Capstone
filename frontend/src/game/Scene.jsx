import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { KeyboardControls, OrbitControls, Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import MapLayout from './Map/MapLayout.jsx'
import PlaceMarkers from './Map/PlaceMarkers.jsx'
import Colliders from './Map/Colliders.jsx'
import Player, { KEYBOARD_MAP } from './Player/Player.jsx'
import FirstPersonCamera from './Player/FirstPersonCamera.jsx'
import FollowCamera from './Player/FollowCamera.jsx'
import PlaceSensors from './Interaction/PlaceSensors.jsx'
import InteractionKeys from './Interaction/InteractionKeys.jsx'
import { useGameStore } from '../store/gameStore.js'
import { CAMERA_START, CAMERA_TARGET, CAMERA_VIEW, FREE_CAMERA, PHYSICS_DEBUG, SUN_POSITION } from './config.js'
import { labelLayer } from './labelLayer.js'

// 3D 화면 전체: 캔버스, 하늘, 조명, 물리, 캐릭터/카메라, 맵, 상호작용 지점
// 두 가지 모드: 둘러보기(맵 전체) ↔ 플레이(캐릭터 조종). 버튼으로 전환.
export default function Scene() {
  const [playing, setPlaying] = useState(!FREE_CAMERA)
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
        <Canvas shadows="percentage" camera={{ position: CAMERA_START, fov: 50, near: 0.1, far: 500 }}>
          <Sky sunPosition={SUN_POSITION} turbidity={6} rayleigh={1.5} />

          {/* 약한 전체 조명 + 그림자 있는 태양광 1개 */}
          <hemisphereLight args={['#ffffff', '#b9a98f', 0.6]} />
          <directionalLight
            position={SUN_POSITION}
            intensity={1.6}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-45}
            shadow-camera-right={45}
            shadow-camera-top={35}
            shadow-camera-bottom={-35}
            shadow-camera-near={1}
            shadow-camera-far={150}
            shadow-bias={-0.0005}
          />

          <MapLayout showStartMarker={!playing} />
          <PlaceMarkers />

          {/* 물리 엔진(Rapier)은 처음에 잠깐 로딩이 필요해서 Suspense로 감쌈 */}
          <Suspense fallback={null}>
            <Physics debug={PHYSICS_DEBUG}>
              <Colliders />
              {playing && (
                <>
                  <Player playerRef={playerRef} showModel={!firstPerson} />
                  <PlaceSensors playerRef={playerRef} />
                  {firstPerson ? <FirstPersonCamera playerRef={playerRef} /> : <FollowCamera playerRef={playerRef} />}
                </>
              )}
            </Physics>
          </Suspense>

          {playing ? <InteractionKeys /> : <OverviewCamera />}
        </Canvas>

        <HelpPanel playing={playing} onStart={startPlay} onStop={stopPlay} />
      </div>
    </KeyboardControls>
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
      maxDistance={90}
      screenSpacePanning={false}
    />
  )
}

// 왼쪽 위 안내 + 모드 전환 버튼 + (확인용) 게임 스토어 값
function HelpPanel({ playing, onStart, onStop }) {
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
      <strong>SceneWalk AI · 골목 맵 (블록아웃)</strong>
      <br />
      {playing
        ? 'WASD: 이동 · Shift: 달리기 · Space: 점프 · 마우스 드래그: 시점 회전 · E: 상호작용 · ESC: 닫기'
        : '왼쪽 드래그: 회전 · 오른쪽 드래그: 이동 · 휠: 확대/축소'}

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
