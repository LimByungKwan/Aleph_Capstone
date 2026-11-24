// (담당: 병관) 날개 벽화 앞 발자국과 엔딩 장면의 카메라·구도 맞추기 화면
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { create } from 'zustand'
import { composePhoto } from '../../../components/photo/composePhoto.js'
import { useGameStore } from '../../../store/gameStore.js'
import { labelLayer } from '../../labelLayer.js'
import { GEO, mat } from './kit.jsx'

export const MURAL_FRAME_PANEL = 'bkMuralFrame'
const STAND_Z = 6
const TARGET_LABELS = ['왼쪽 날개 끝', '오른쪽 날개 끝', '가운데 발자국']
const ALL_TARGETS = (1 << TARGET_LABELS.length) - 1
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
  const framed = useMuralFrame((s) => s.framed)
  const camera = useMemo(() => new PerspectiveCamera(60, 1, 0.1, 1000), [])
  const markers = useRef(null)
  const captured = useRef(null)
  const tmp = useMemo(() => ({ q: new Quaternion(), look: new Euler(0, 0, 0, 'YXZ'), point: new Vector3() }), [])

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
  useFrame(({ gl, size }) => {
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

    let next = 0
    targets.forEach((target, i) => {
      mural.localToWorld(tmp.point.set(...target)).project(camera)
      // 2D 안내 프레임의 좌우 9%, 위 16%, 아래 22% 여백과 맞춰요.
      if (Math.abs(tmp.point.x) <= 1 - FRAME.side * 2 && tmp.point.y >= FRAME.bottom * 2 - 1 &&
        tmp.point.y <= 1 - FRAME.top * 2 && Math.abs(tmp.point.z) < 1) next |= 1 << i
    })
    if (next !== previous) useMuralFrame.setState({ framed: next })
    if (request && captured.current !== request && markers.current) {
      captured.current = request
      if (next === ALL_TARGETS) {
        const guide = markers.current
        guide.visible = false
        try {
          gl.render(scene, camera)
          const src = cropFrame(gl.domElement)
          const finish = (photo, photoError) => {
            if (useGameStore.getState().openPanel?.type === MURAL_FRAME_PANEL && useMuralFrame.getState().request === request) {
              useMuralFrame.setState({ request: null, photo, photoError })
            }
          }
          composePhoto(src, PHOTO_INFO).then((url) => finish(url, false), () => finish(null, true))
        } catch {
          useMuralFrame.setState({ request: null, photoError: true })
        } finally {
          guide.visible = true
        }
        return
      }
      useMuralFrame.setState({ request: null, photoError: true })
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

  const shoot = () => {
    const state = useMuralFrame.getState()
    if (state.framed === ALL_TARGETS && !state.request) {
      drag.current = null
      useMuralFrame.setState({ request: Symbol(), photoError: false })
    }
  }

  const beginDrag = (event) => {
    if (capturing || photo || event.button !== 0 || event.target.closest('button, a')) return
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
    if (capturing || photo) return
    const direction = DIRECTIONS.find(({ key }) => key === event.key)
    if (!direction) return
    event.preventDefault()
    event.stopPropagation()
    turn(direction.yaw, direction.pitch)
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
      onLostPointerCapture={() => { drag.current = null }}>
      <header className="date-mural-header">
        <h2>엔딩 장면 맞추기</h2>
        <button ref={closeButton} type="button" className="ui-btn" onClick={onClose}>닫기</button>
      </header>
      <div className="date-mural-frame" data-ready={ready} aria-hidden="true" />
      <footer className="date-mural-controls">
        <p>날개 끝 두 곳과 발자국을 프레임 안에 넣으세요.</p>
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
            {capturing ? '찍는 중…' : '사진 찍기'}
          </button>
          <button type="button" className="ui-btn" disabled={!ready || capturing} onClick={() => {
            if (useMuralFrame.getState().framed === ALL_TARGETS) onComplete()
          }}>장면 완성</button>
        </div>
      </footer>
    </section>
  )
}
