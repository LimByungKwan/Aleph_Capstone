import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { KeyboardControls, OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import MapLayout from './Map/MapLayout.jsx'
import PlaceMarkers from './Map/PlaceMarkers.jsx'
import CourseMarker from './Map/CourseMarker.jsx'
import Colliders from './Map/Colliders.jsx'
import { Elevators } from './Map/Terrain.jsx'
import { JmGuestLifts } from './Map/styles/jm_guestLift.jsx' // [지민] 애니 구역 온천장 손님용 엘리베이터 (병관님 Elevators와 같은 방식, 11/27)
import PastelSky from './Map/PastelSky.jsx'
import Player, { KEYBOARD_MAP } from './Player/Player.jsx'
import FirstPersonCamera from './Player/FirstPersonCamera.jsx'
import FollowCamera from './Player/FollowCamera.jsx'
import DateCourseCamera from './Player/DateCourseCamera.jsx'
import { DATE_INTRO_PANEL } from './Player/dateIntroTimeline.js'
import PlaceSensors from './Interaction/PlaceSensors.jsx'
import FootSplashes from './Player/FootSplashes.jsx'
import InteractionKeys from './Interaction/InteractionKeys.jsx'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'
import { useGameStore } from '../store/gameStore.js'
import {
  CAMERA_MAX_ZOOM_OUT,
  CAMERA_START,
  CAMERA_TARGET,
  CAMERA_VIEW,
  FREE_CAMERA,
  PHYSICS_DEBUG,
  SHADOW_AREA,
  SUN_POSITION,
} from './config.js'
import { labelLayer } from './labelLayer.js'
import { useSettings } from './settingsStore.js'
import { live } from './timeOfDay.js'
import SettingsPanel from './SettingsPanel.jsx'
import SeasonalWeather from './Map/SeasonalWeather.jsx'
import ShaderWarmup from './ShaderWarmup.jsx'
import PointLightLock from './PointLightLock.jsx'
import { layout, southGroundExtension } from './data/mapData.js'
import PalaceTourPresence from '../components/movieZone/PalaceTourPresence.jsx'
import MultiplayerPresence from './multiplayer/MultiplayerPresence.jsx' // [지민] 멀티 접속
import ChatBox from './multiplayer/ChatBox.jsx' // [지민] 말풍선 채팅 입력창
import { WarpZones } from './Map/styles/bk_warpZones.jsx' // [병관] 구역 워프존

// 3D 화면 전체: 캔버스, 하늘, 조명, 물리, 캐릭터/카메라, 맵, 상호작용 지점
// 두 가지 모드: 둘러보기(맵 전체) ↔ 플레이(캐릭터 조종). 버튼으로 전환.
// locked(11/27 지민): 로그인 전 — 캐릭터 없이 맵 전체 보기만 (모드 전환 버튼·설정창도 숨김). 로그인하면 바로 플레이
export default function Scene({ locked = false }) {
  const [playing, setPlaying] = useState(!FREE_CAMERA && !locked)
  const dateIntro = useGameStore((s) => s.openPanel?.type === DATE_INTRO_PANEL)
  // 그래픽 품질은 설정창(⚙)과 왼쪽 '고화질' 체크박스가 같은 값을 씀 (기본: 낮음)
  const highDetail = useSettings((state) => state.quality === 'high')
  const playerRef = useRef(null) // 캐릭터 위치를 카메라·센서와 공유
  const gameCamera = useMemo(() => {
    const camera = new THREE.PerspectiveCamera(50, 1, .25, 1000)
    camera.position.set(...CAMERA_START)
    camera.lookAt(0, 0, 0)
    return camera
  }, [])

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

  // [지민] 로그인하면 캐릭터 생성, 로그아웃하면 다시 맵 전체 보기 (그때는 열려 있던 창·근처 표시도 정리)
  useEffect(() => {
    if (!locked) {
      if (!FREE_CAMERA) setPlaying(true)
      return
    }
    const { close, setNearby } = useGameStore.getState()
    close()
    setNearby(null)
    setPlaying(false)
  }, [locked])

  return (
    <KeyboardControls map={KEYBOARD_MAP}>
      <div ref={labelLayer} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* 첫 접속 로딩 화면 (모델·텍스처 다운로드 + 셰이더 준비가 끝나면 사라짐) */}
        <LoadingScreen />
        {/* 고화질도 화면 해상도는 최대 1.5배까지 (2배면 그려야 할 픽셀이 1.8배 늘어 렉의 주원인) */}
        {/* near 0.25: 0.1이면 100m 앞 깊이 정밀도가 ~6mm라 몇 mm 차이로 겹친 바닥·지붕이 멀리서 물결처럼 깜빡임 (11/27) → 2.5배 정밀
            캐릭터 몸통 반경이 0.3m라 1인칭에서도 벽이 0.25m 안으로 안 들어와 잘리지 않음 */}
        <Canvas className="game-world" dpr={highDetail ? [1, 1.5] : 0.8} shadows={highDetail ? 'percentage' : false} camera={gameCamera}>
          {/* 파스텔 하늘 + 구름 + 먼 산 + 바깥 풀밭 + 안개 */}
          <PastelSky fullBackdrop={dateIntro} />

          {/* 전체 조명 + 그림자 있는 태양광(밤에는 달빛) 1개 — 계절·시간대에 따라 색·세기가 바뀜 (그림자는 보고 있는 곳 주변만) */}
          <SkyAmbient />
          <SunLight castShadow={highDetail} />
          {highDetail && <ShadowThrottle />}

          <MapLayout showStartMarker={!playing && !dateIntro} highDetail={highDetail} />
          <group visible={!dateIntro}>
            {playing && <SeasonalWeather playerRef={playerRef} />}
            <PlaceMarkers />
            <CourseMarker />
            <WarpZones playerRef={playerRef} />
          </group>

          {/* 물리 엔진(Rapier)은 처음에 잠깐 로딩이 필요해서 Suspense로 감쌈 */}
          <Suspense fallback={null}>
            <Physics debug={PHYSICS_DEBUG}>
              <Colliders />
              <Elevators playerRef={playerRef} />
              <JmGuestLifts playerRef={playerRef} />
              {playing && (
                <>
                  <group visible={!dateIntro}>
                    <Player playerRef={playerRef} showModel={!firstPerson} />
                    <PalaceTourPresence playerRef={playerRef} />
                    <MultiplayerPresence playerRef={playerRef} />
                    <FootSplashes playerRef={playerRef} />
                  </group>
                  <PlaceSensors playerRef={playerRef} />
                  {firstPerson ? <FirstPersonCamera playerRef={playerRef} camera={gameCamera} /> : <FollowCamera playerRef={playerRef} camera={gameCamera} />}
                </>
              )}
            </Physics>
          </Suspense>

          {playing ? <InteractionKeys /> : <OverviewCamera camera={gameCamera} />}
          {dateIntro && <DateCourseCamera />}
          <PointLightLock />
          <ShaderWarmup trigger={`${playing}-${highDetail}`} camera={gameCamera} />
        </Canvas>

        {!locked && <HelpPanel playing={playing} onStart={startPlay} onStop={stopPlay} />}
        {!locked && <SettingsPanel />}
        {playing && <ChatBox />}
      </div>
    </KeyboardControls>
  )
}

// 태양광 + 그림자. 최적화: 그림자 범위를 맵 전체가 아니라 "카메라가 보고 있는 곳" 주변으로만 잡음
// → 멀리 있는 건물은 그림자 계산에서 빠지고, 같은 그림자 해상도로 더 선명해짐
const SHADOW_MIN_AREA = 35
const lookTarget = new THREE.Vector3()

const SUN_DISTANCE = Math.hypot(...SUN_POSITION)

// 그림자 지도는 두 프레임에 한 번만 다시 그림 (그림자 계산이 고화질 렉의 가장 큰 원인)
// 해·건물은 거의 안 움직여서 눈으로는 차이가 없음
function ShadowThrottle() {
  const gl = useThree((state) => state.gl)
  const frame = useRef(0)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])
  useFrame(() => {
    if (frame.current++ % 2 === 0) gl.shadowMap.needsUpdate = true
  })
  return null
}

function SunLight({ castShadow }) {
  const lightRef = useRef(null)
  const area = useRef(SHADOW_AREA)

  useFrame(({ camera, controls }) => {
    const light = lightRef.current
    if (!light) return
    if (camera.userData.showFullMap) camera.getWorldDirection(lookTarget).multiplyScalar(40).add(camera.position)
    else if (controls?.getTarget) controls.getTarget(lookTarget)
    else if (controls?.target) lookTarget.copy(controls.target)
    else lookTarget.set(0, 0, 0)

    // 시간대에 따라 해(밤엔 달)의 색·세기·방향
    light.color.copy(live.lightColor)
    light.intensity = live.lightIntensity

    // 2m 단위로 맞춰 움직여서 그림자가 지글거리지 않게
    const x = Math.round(lookTarget.x / 2) * 2
    const z = Math.round(lookTarget.z / 2) * 2
    const dir = live.sunDir
    light.position.set(x + dir.x * SUN_DISTANCE, Math.max(dir.y, 0.15) * SUN_DISTANCE, z + dir.z * SUN_DISTANCE)
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
      color="#fff4e6"
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

// 전체 조명 (하늘빛 + 땅에서 반사되는 빛): 시간대에 따라 색·세기
function SkyAmbient() {
  const ref = useRef(null)
  useFrame(() => {
    const light = ref.current
    if (!light) return
    light.color.copy(live.hemiSky)
    light.groundColor.copy(live.hemiGround)
    light.intensity = live.hemiIntensity
  })
  return <hemisphereLight ref={ref} args={['#fff0f5', '#c2ae98', 0.65]} />
}

// 둘러보기 카메라. 땅 밑으로 못 내려가고, 옆으로 끌면 땅과 평행하게 이동
const overviewSouthLimit = southGroundExtension
  ? Math.max(126, southGroundExtension.position[1] + southGroundExtension.size[2] / 2)
  : 126
// [혜진] 둘러보기에서 끌어 볼 수 있는 범위: 맵 땅 전체(+ 맵 끝 밖으로 넓힌 땅 opensBoundary)까지
const overviewBounds = (() => {
  const [gw, gd] = layout.ground.size
  const [gcx, gcz] = layout.ground.center ?? [0, 0]
  let x0 = Math.min(-126, gcx - gw / 2)
  let x1 = Math.max(126, gcx + gw / 2)
  let z0 = Math.min(-126, gcz - gd / 2)
  let z1 = Math.max(overviewSouthLimit, gcz + gd / 2)
  for (const item of layout.roads.filter((r) => r.opensBoundary)) {
    const [x, z] = item.position
    const [w, , d] = item.size
    x0 = Math.min(x0, x - w / 2)
    x1 = Math.max(x1, x + w / 2)
    z0 = Math.min(z0, z - d / 2)
    z1 = Math.max(z1, z + d / 2)
  }
  return { x0, x1, z0, z1 }
})()

function OverviewCamera({ camera }) {
  const controlsRef = useRef(null)
  const keys = useRef(new Set())
  const movement = useRef({ forward: new THREE.Vector3(), right: new THREE.Vector3(), offset: new THREE.Vector3() })

  // 플레이에서 돌아올 때 카메라를 맵 전체가 보이는 위치로 되돌림
  useEffect(() => {
    camera.position.set(...CAMERA_START)
    // 전체 보기에서 1~2cm 간격의 도로·바닥을 구분할 수 있게 깊이 정밀도를 높여요.
    const previousNear = camera.near
    camera.near = 1.2
    camera.updateProjectionMatrix()
    return () => {
      camera.near = previousNear
      camera.updateProjectionMatrix()
    }
  }, [camera])

  useEffect(() => {
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    const onDown = (event) => {
      if (!arrows.includes(event.code) || event.target.closest?.('input, select, textarea, button, [contenteditable]')) return
      event.preventDefault()
      keys.current.add(event.code)
    }
    const onUp = (event) => keys.current.delete(event.code)
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      clear()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls || !keys.current.size) return
    const pressed = keys.current
    const { forward, right, offset } = movement.current
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.set(-forward.z, 0, forward.x)
    offset.copy(forward).multiplyScalar(Number(pressed.has('ArrowUp')) - Number(pressed.has('ArrowDown')))
    offset.addScaledVector(right, Number(pressed.has('ArrowRight')) - Number(pressed.has('ArrowLeft')))
    offset.normalize().multiplyScalar(55 * Math.min(delta, 0.05))
    camera.position.add(offset)
    controls.target.add(offset)
    controls.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      makeDefault
      target={CAMERA_TARGET}
      minPolarAngle={0.18}
      maxPolarAngle={1.20}
      minDistance={3}
      maxDistance={CAMERA_MAX_ZOOM_OUT}
      screenSpacePanning={false}
      enableDamping
      dampingFactor={0.16}
      rotateSpeed={0.45}
      panSpeed={0.82}
      zoomSpeed={0.75}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
      onChange={() => {
        const controls = controlsRef.current
        if (!controls) return
        const { target } = controls
        const x = THREE.MathUtils.clamp(target.x, overviewBounds.x0, overviewBounds.x1)
        const z = THREE.MathUtils.clamp(target.z, overviewBounds.z0, overviewBounds.z1)
        camera.position.x += x - target.x
        camera.position.z += z - target.z
        target.x = x
        target.z = z
      }}
    />
  )
}

// 왼쪽 위 안내 + 모드 전환 버튼 + (확인용) 게임 스토어 값
function HelpPanel({ playing, onStart, onStop }) {
  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="bk-game-help">
      <div className="bk-game-help__bar">
        <strong>SceneWalk AI</strong>
        <button type="button" aria-expanded={showHelp} aria-controls="scenewalk-help"
          onClick={(event) => { setShowHelp(!showHelp); event.currentTarget.blur() }}>
          조작 안내
        </button>
        <button type="button" onClick={playing ? onStop : onStart}>
          {playing ? '맵 전체 보기' : `${CAMERA_VIEW === 'first' ? '1인칭' : '3인칭'}으로 플레이하기`}
        </button>
      </div>
      <div id="scenewalk-help" className="bk-game-help__panel" hidden={!showHelp}>
        {playing && isTouch
          ? '왼쪽 조이스틱: 이동 · 화면 드래그: 시점 회전 · 두 손가락: 확대/축소 · E 버튼: 상호작용'
          : playing
          ? 'WASD: 이동 · Shift: 달리기 · Space: 점프 · 마우스 드래그: 시점 회전 · E: 상호작용 · ESC: 닫기'
          : '왼쪽 드래그·방향키: 이동 · 오른쪽 드래그: 회전 · 휠: 확대/축소'}
      </div>
    </div>
  )
}
