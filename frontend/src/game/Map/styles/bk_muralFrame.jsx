// (담당: 병관) 날개 벽화 앞 발자국과 엔딩 장면의 카메라·구도 맞추기 화면
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Joystick, useJoystickStore } from 'ecctrl/input'
import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { create } from 'zustand'
import { useIsTouch } from '../../../components/mobile/MobileControls.jsx'
import { composePhoto } from '../../../components/photo/composePhoto.js'
import { useGameStore } from '../../../store/gameStore.js'
import { labelLayer } from '../../labelLayer.js'
import { usePlayerCharacter } from '../../Player/characterStore.js'
import { WAVE_FRAMES, WAVE_FRAME_STEP, WAVE_JOINTS } from './bk_muralWaveFrames.js'
import { GEO, mat } from './kit.jsx'
import { findPlayer } from '../../Player/findPlayer.js'

export const MURAL_FRAME_PANEL = 'bkMuralFrame'
const STAND_Z = 6
const TARGET_LABELS = ['왼쪽 날개 끝', '오른쪽 날개 끝', '가운데 발자국', '내 캐릭터']
const ALL_TARGETS = (1 << TARGET_LABELS.length) - 1
const PLAYER_TARGET = 1 << (TARGET_LABELS.length - 1)
const WAVE_BLEND_TIME = 0.24
const UP = new Vector3(0, 1, 0)
const FRAME = { side: 0.09, top: 0.16, bottom: 0.22 }
const PHOTO_INFO = { place: '날개 벽화 골목', zoneName: '데이트 코스 구역', color: '#ff8fb8' }
const FOOTPRINT = mat('#f9d1e3', { emissive: '#dd6a9a', emissiveIntensity: 0.55 })
const initial = { yaw: 0.17, pitch: 0.06, framed: 0, request: null, photo: null, photoError: false }

const useMuralFrame = create((set) => ({
  ...initial,
  turn: (yaw, pitch) => set((s) => ({
    yaw: MathUtils.clamp(s.yaw + yaw, -0.65, 0.65),
    pitch: MathUtils.clamp(s.pitch + pitch, -0.65, 0.25),
  })),
}))

export function resetMuralFrame() {
  useMuralFrame.setState(initial)
}

export function MuralFrameScene({ wingWidth, wingHeight, wingCenterY, wingZ }) {
  const anchor = useRef(null)
  const active = useGameStore((s) => s.openPanel?.type === MURAL_FRAME_PANEL)
  // 벽화 그림의 제일 바깥 깃털 끝은 텍스처 중앙에서 좌우 200px, 위로 27.2px.
  const targets = useMemo(() => {
    const wingX = wingWidth * 200 / 512
    const wingY = wingCenterY + wingHeight * 27.2 / 256
    const tipZ = wingZ + 0.05
    return [[-wingX, wingY, tipZ], [wingX, wingY, tipZ], [0, 0.22, STAND_Z]]
  }, [wingWidth, wingHeight, wingCenterY, wingZ])

  return (
    <group ref={anchor}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.17, 0.16, STAND_Z]} rotation={[0, side * 0.18, 0]}>
          <mesh geometry={GEO.cyl} material={FOOTPRINT} position={[0, 0, -0.105]} scale={[0.1, 0.012, 0.137]} />
          <mesh geometry={GEO.cyl} material={FOOTPRINT} position={[0, 0, 0.083]} scale={[0.066, 0.012, 0.09]} />
        </group>
      ))}
      {active && <MuralCamera anchor={anchor} targets={targets} />}
    </group>
  )
}

function MuralCamera({ anchor, targets }) {
  const scene = useThree((s) => s.scene)
  const controls = useThree((s) => s.controls)
  const { character } = usePlayerCharacter()
  const framed = useMuralFrame((s) => s.framed)
  const camera = useMemo(() => new PerspectiveCamera(60, 1, 0.1, 1000), [])
  const markers = useRef(null)
  const captured = useRef(null)
  const player = useRef(null)
  const wave = useRef(null)
  const tmp = useMemo(() => ({
    q: new Quaternion(), look: new Euler(0, 0, 0, 'YXZ'), point: new Vector3(),
    forward: new Vector3(), player: new Vector3(),
  }), [])

  useEffect(() => {
    if (!controls?.rotateAzimuthTo) return
    const originalAzimuth = controls.azimuthAngle
    return () => { controls.azimuthAngle = originalAzimuth }
  }, [controls])

  useEffect(() => {
    const layer = labelLayer.current
    const placeMarker = scene.getObjectByName('spot_mural')
    const markerWasVisible = placeMarker?.visible
    if (placeMarker) placeMarker.visible = false
    layer?.setAttribute('data-bk-mural-frame', '')
    return () => {
      if (placeMarker) placeMarker.visible = markerWasVisible
      layer?.removeAttribute('data-bk-mural-frame')
    }
  }, [scene])

  // 전용 카메라로 그려서 체험을 닫으면 원래 카메라가 바로 화면을 이어받아요.
  useFrame(({ gl, size, clock }) => {
    const mural = anchor.current
    if (!mural || size.width < 1 || size.height < 1) return
    const { yaw, pitch, framed: previous, request } = useMuralFrame.getState()
    const aspect = size.width / size.height
    if (camera.aspect !== aspect) {
      camera.aspect = aspect
      camera.fov = Math.max(60, MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(26)) / aspect)))
      camera.updateProjectionMatrix()
    }
    camera.position.copy(mural.localToWorld(tmp.point.set(0, 2.65, STAND_Z + 4.4)))
    mural.getWorldQuaternion(tmp.q)
    camera.quaternion.setFromEuler(tmp.look.set(pitch, yaw, 0)).premultiply(tmp.q)
    camera.updateMatrixWorld()

    // Ecctrl은 플레이 카메라 방향을 기준으로 움직여서, 보이는 촬영 방향과 맞춰요.
    if (controls?.rotateAzimuthTo) {
      camera.getWorldDirection(tmp.forward)
      const azimuth = Math.atan2(-tmp.forward.x, -tmp.forward.z)
      const turn = Math.atan2(Math.sin(azimuth - controls.azimuthAngle), Math.cos(azimuth - controls.azimuthAngle))
      if (Math.abs(turn) > 0.001) controls.azimuthAngle += turn
    }

    const inside = (point) => Math.abs(point.x) <= 1 - FRAME.side * 2 &&
      point.y >= FRAME.bottom * 2 - 1 && point.y <= 1 - FRAME.top * 2 && Math.abs(point.z) < 1
    let next = 0
    targets.forEach((target, i) => {
      mural.localToWorld(tmp.point.set(...target)).project(camera)
      if (inside(tmp.point)) next |= 1 << i
    })
    if (!player.current?.parent) player.current = findPlayer(scene)
    if (player.current) {
      player.current.getWorldPosition(tmp.player)
      if (inside(tmp.point.copy(tmp.player).project(camera))) next |= PLAYER_TARGET
    }
    if (next !== previous) useMuralFrame.setState({ framed: next })
    if (request && captured.current !== request && markers.current) {
      if (next !== ALL_TARGETS) {
        useMuralFrame.setState({ request: null, photoError: true })
      } else {
        if (wave.current?.request !== request) {
          const model = player.current?.getObjectByName('player-character-model')
          wave.current = prepareWave(request, model, WAVE_FRAMES[character.waveRig ?? character.id], clock.elapsedTime)
        }
        const pose = wave.current
        const elapsed = clock.elapsedTime - pose.started
        const takePhoto = elapsed >= pose.duration
        const guide = markers.current
        const guideWasVisible = guide.visible
        const finish = (photo, photoError) => {
          if (useGameStore.getState().openPanel?.type === MURAL_FRAME_PANEL && useMuralFrame.getState().request === request) {
            useMuralFrame.setState({ request: null, photo, photoError })
          }
        }
        try {
          if (pose.model) applyWave(pose, camera, elapsed)
          if (takePhoto) guide.visible = false
          gl.render(scene, camera)
          if (takePhoto) {
            captured.current = request
            composePhoto(cropFrame(gl.domElement), PHOTO_INFO).then((url) => finish(url, false), () => finish(null, true))
          }
        } catch {
          finish(null, true)
        } finally {
          guide.visible = guideWasVisible
          if (pose.model) restoreWave(pose)
        }
        return
      }
    }
    gl.render(scene, camera)
  }, 1)

  return (
    <group ref={markers}>
      {targets.map((target, i) => (
        <mesh key={TARGET_LABELS[i]} position={target} geometry={GEO.sphere} scale={0.085} renderOrder={10} userData={{ noShadow: true }}>
          <meshBasicMaterial color={framed & (1 << i) ? '#87ffcc' : '#ffd681'} depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
      ))}
    </group>
  )
}

function prepareWave(request, model, frames, started) {
  const bones = model && WAVE_JOINTS.map((name) => model.getObjectByName(name))
  if (!frames || !model?.parent || !bones.every((bone) => bone?.isBone)) {
    return { request, started, duration: 0 }
  }
  return {
    request, started, model, bones, frames,
    duration: WAVE_BLEND_TIME + (frames.length - 1) * WAVE_FRAME_STEP,
    originals: bones.map(() => new Quaternion()),
    originalRotation: new Quaternion(),
    world: new Quaternion(), parent: new Quaternion(), target: new Quaternion(), end: new Quaternion(),
    toCamera: new Vector3(),
  }
}

// 게임 캐릭터의 기본 애니메이션 위에 촬영용 팔 자세만 적용하고, 그린 뒤 원래 자세로 돌려놓아요.
function applyWave(pose, camera, elapsed) {
  const { model, originals, originalRotation, bones, frames, world, parent, target, end, toCamera } = pose
  originalRotation.copy(model.quaternion)
  bones.forEach((bone, index) => originals[index].copy(bone.quaternion))
  model.getWorldPosition(toCamera)
  toCamera.subVectors(camera.position, toCamera)
  const blend = MathUtils.smoothstep(elapsed, 0, WAVE_BLEND_TIME)
  target.setFromAxisAngle(UP, Math.atan2(toCamera.x, toCamera.z))
  model.parent.getWorldQuaternion(parent).invert()
  model.quaternion.slerp(target.premultiply(parent), blend)
  model.getWorldQuaternion(world)

  const sample = MathUtils.clamp((elapsed - WAVE_BLEND_TIME) / WAVE_FRAME_STEP, 0, frames.length - 1)
  const index = Math.floor(sample)
  const next = frames[Math.min(index + 1, frames.length - 1)]
  bones.forEach((bone, joint) => {
    target.fromArray(frames[index][joint]).normalize().slerp(end.fromArray(next[joint]).normalize(), sample - index)
    bone.parent.getWorldQuaternion(parent).invert()
    bone.quaternion.slerp(target.premultiply(world).premultiply(parent), blend)
  })
}

function restoreWave({ model, originalRotation, bones, originals }) {
  model.quaternion.copy(originalRotation)
  bones.forEach((bone, index) => bone.quaternion.copy(originals[index]))
}

function cropFrame(source) {
  const x = Math.round(source.width * FRAME.side)
  const y = Math.round(source.height * FRAME.top)
  const width = source.width - x * 2
  const height = source.height - y - Math.round(source.height * FRAME.bottom)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(source, x, y, width, height, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

const DIRECTIONS = [
  { key: 'ArrowLeft', label: '왼쪽 보기', symbol: '←', yaw: 0.08, pitch: 0 },
  { key: 'ArrowUp', label: '위 보기', symbol: '↑', yaw: 0, pitch: 0.08 },
  { key: 'ArrowDown', label: '아래 보기', symbol: '↓', yaw: 0, pitch: -0.08 },
  { key: 'ArrowRight', label: '오른쪽 보기', symbol: '→', yaw: -0.08, pitch: 0 },
]

export function MuralFrameView({ onClose, onComplete }) {
  const touch = useIsTouch()
  const framed = useMuralFrame((s) => s.framed)
  const capturing = useMuralFrame((s) => Boolean(s.request))
  const photo = useMuralFrame((s) => s.photo)
  const photoError = useMuralFrame((s) => s.photoError)
  const turn = useMuralFrame((s) => s.turn)
  const drag = useRef(null)
  const closeButton = useRef(null)
  const retakeButton = useRef(null)
  const shootButton = useRef(null)

  useEffect(() => {
    // 마우스 없이 체험을 시작했을 때도 바로 조작하거나 닫을 수 있게 해요.
    const previous = document.activeElement
    closeButton.current?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  useEffect(() => {
    if (photo) retakeButton.current?.focus()
  }, [photo])

  const reviewing = capturing || Boolean(photo)
  useEffect(() => {
    if (useGameStore.getState().openPanel?.type === MURAL_FRAME_PANEL) {
      useGameStore.setState({ inputLocked: reviewing })
    }
  }, [reviewing])

  useEffect(() => {
    // 방향키는 촬영 카메라에만 써요. 캐릭터에 전달되는 키는 WASD예요.
    const onArrow = (event) => {
      const direction = DIRECTIONS.find(({ key }) => key === event.key)
      if (!direction) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const state = useMuralFrame.getState()
      if (!state.request && !state.photo) turn(direction.yaw, direction.pitch)
    }
    window.addEventListener('keydown', onArrow, true)
    return () => window.removeEventListener('keydown', onArrow, true)
  }, [turn])

  useEffect(() => {
    if (!touch || reviewing) return
    return () => useJoystickStore.getState().resetJoystick()
  }, [reviewing, touch])

  const shoot = () => {
    const state = useMuralFrame.getState()
    if (state.framed === ALL_TARGETS && !state.request) {
      drag.current = null
      useMuralFrame.setState({ request: Symbol(), photoError: false })
    }
  }

  const beginDrag = (event) => {
    if (capturing || photo || event.button !== 0 || event.target.closest('button, a, .date-mural-stick')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const moveDrag = (event) => {
    if (drag.current?.id !== event.pointerId) return
    turn((event.clientX - drag.current.x) * 0.004, (event.clientY - drag.current.y) * 0.004)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
  }
  const ready = framed === ALL_TARGETS

  if (photo) return (
    <section className="date-mural-view date-mural-photo-view ui-interactive" role="dialog" aria-label="벽화 사진 미리보기" onKeyDown={onKeyDown}>
      <div className="date-mural-preview">
        <h2>벽화 사진 미리보기</h2>
        <img src={photo} alt="날개 벽화 골목에서 찍은 사진" />
        <div className="date-mural-buttons">
          <a className="ui-btn ui-btn--primary" href={photo} download="SceneWalk_날개_벽화_골목.jpg">사진 저장</a>
          <button ref={retakeButton} type="button" className="ui-btn" onClick={() => {
            useMuralFrame.setState({ photo: null })
            requestAnimationFrame(() => shootButton.current?.focus())
          }}>다시 찍기</button>
          <button type="button" className="ui-btn" onClick={onComplete}>장면 완성</button>
        </div>
      </div>
    </section>
  )

  return (
    <section className="date-mural-view ui-interactive" role="dialog" aria-label="엔딩 장면 맞추기"
      onKeyDown={onKeyDown} onPointerDown={beginDrag} onPointerMove={moveDrag}
      onLostPointerCapture={(event) => { if (drag.current?.id === event.pointerId) drag.current = null }}>
      <header className="date-mural-header">
        <h2>엔딩 장면 맞추기</h2>
        <button ref={closeButton} type="button" className="ui-btn" onClick={onClose}>닫기</button>
      </header>
      <div className="date-mural-frame" data-ready={ready} aria-hidden="true" />
      {touch && !capturing && (
        <div className="date-mural-stick" role="group" aria-label="캐릭터 이동">
          <Joystick joystickMaxRadius={32}
            joystickWrapperStyle={{ position: 'relative', width: 88, height: 88 }}
            joystickBaseStyle={{ background: '#fffdf86b', border: '2px solid #fffdf8a8' }}
            joystickKnobStyle={{ background: '#fffdf8d9' }} />
        </div>
      )}
      <footer className="date-mural-controls">
        <p>{touch ? '조이스틱으로 이동 · 화면을 끌어 구도 조절' : 'WASD로 이동 · 드래그나 방향키로 구도 조절'}</p>
        <p>날개 끝과 발자국, 내 캐릭터를 프레임에 넣으세요.</p>
        <ul aria-label="프레임에 들어온 지점" aria-live="polite">
          {TARGET_LABELS.map((label, i) => (
            <li key={label} data-framed={Boolean(framed & (1 << i))}>
              {framed & (1 << i) ? '✓' : '○'} {label}
            </li>
          ))}
        </ul>
        {photoError && <p role="alert">사진을 만들지 못했어요. 구도를 맞추고 다시 찍어 주세요.</p>}
        <div className="date-mural-buttons">
          {DIRECTIONS.map(({ key, label, symbol, yaw, pitch }) => (
            <button type="button" key={key} className="ui-btn" aria-label={label} disabled={capturing} onClick={() => turn(yaw, pitch)}>{symbol}</button>
          ))}
          <button ref={shootButton} type="button" className="ui-btn ui-btn--primary" disabled={!ready || capturing} onClick={shoot}>
            {capturing ? '포즈 잡는 중…' : '사진 찍기'}
          </button>
          <button type="button" className="ui-btn" disabled={!ready || capturing} onClick={() => {
            if (useMuralFrame.getState().framed === ALL_TARGETS) onComplete()
          }}>장면 완성</button>
        </div>
      </footer>
    </section>
  )
}
