// (담당: 병관) 날개 벽화 앞 발자국과 엔딩 장면의 카메라·구도 맞추기 화면
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { create } from 'zustand'
import { useGameStore } from '../../../store/gameStore.js'
import { labelLayer } from '../../labelLayer.js'
import { GEO, mat } from './kit.jsx'

export const MURAL_FRAME_PANEL = 'bkMuralFrame'
const STAND_Z = 6
const TARGET_LABELS = ['왼쪽 날개 끝', '오른쪽 날개 끝', '가운데 발자국']
const ALL_TARGETS = (1 << TARGET_LABELS.length) - 1
const FOOTPRINT = mat('#f9d1e3', { emissive: '#dd6a9a', emissiveIntensity: 0.55 })
const initial = { yaw: 0.17, pitch: 0.06, framed: 0 }

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
    const { yaw, pitch, framed: previous } = useMuralFrame.getState()
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
      if (Math.abs(tmp.point.x) <= 0.82 && tmp.point.y >= -0.56 && tmp.point.y <= 0.68 && Math.abs(tmp.point.z) < 1) next |= 1 << i
    })
    if (next !== previous) useMuralFrame.setState({ framed: next })
    gl.render(scene, camera)
  }, 1)

  return targets.map((target, i) => (
    <mesh key={TARGET_LABELS[i]} position={target} geometry={GEO.sphere} scale={0.085} renderOrder={10} userData={{ noShadow: true }}>
      <meshBasicMaterial color={framed & (1 << i) ? '#87ffcc' : '#ffd681'} depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  ))
}

const DIRECTIONS = [
  { key: 'ArrowLeft', label: '왼쪽 보기', symbol: '←', yaw: 0.08, pitch: 0 },
  { key: 'ArrowUp', label: '위 보기', symbol: '↑', yaw: 0, pitch: 0.08 },
  { key: 'ArrowDown', label: '아래 보기', symbol: '↓', yaw: 0, pitch: -0.08 },
  { key: 'ArrowRight', label: '오른쪽 보기', symbol: '→', yaw: -0.08, pitch: 0 },
]

export function MuralFrameView({ onClose, onComplete }) {
  const framed = useMuralFrame((s) => s.framed)
  const turn = useMuralFrame((s) => s.turn)
  const drag = useRef(null)
  const closeButton = useRef(null)

  useEffect(() => {
    // 마우스 없이 체험을 시작했을 때도 바로 조작하거나 닫을 수 있게 해요.
    const previous = document.activeElement
    closeButton.current?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  const beginDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return
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
    }
    const direction = DIRECTIONS.find(({ key }) => key === event.key)
    if (!direction) return
    event.preventDefault()
    event.stopPropagation()
    turn(direction.yaw, direction.pitch)
  }
  const ready = framed === ALL_TARGETS

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
        <div className="date-mural-buttons">
          {DIRECTIONS.map(({ key, label, symbol, yaw, pitch }) => (
            <button type="button" key={key} className="ui-btn" aria-label={label} onClick={() => turn(yaw, pitch)}>{symbol}</button>
          ))}
          <button type="button" className="ui-btn ui-btn--primary" disabled={!ready} onClick={() => {
            if (useMuralFrame.getState().framed === ALL_TARGETS) onComplete()
          }}>장면 완성</button>
        </div>
      </footer>
    </section>
  )
}
