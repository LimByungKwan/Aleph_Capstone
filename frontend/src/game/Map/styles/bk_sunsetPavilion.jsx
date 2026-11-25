// (담당: 병관) 전망대 산책로의 노을등 정자와 두 사람이 함께 켜는 등불
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MOODS, PAVILION_PADS, pavilionPad, pavilionPrompt } from '@shared/bk_pavilion.js'
import { useGameStore } from '../../../store/gameStore.js'
import { onTarotMessage, sendTarot, useRealtimeStore } from '../../multiplayer/realtimeStore.js'
import { hipRoofGeometry } from './geometry.js'
import { GEO, Instances, mat, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'

const TITLE = '노을등 정자'
const wood = mat('#ffffff', { flat: true })
const tile = mat('#304b4c', { flat: true, double: true })
const amber = mat('#ffe4a8', { emissive: '#ff963d', emissiveIntensity: 0.95 })
const paper = mat('#efc998', { emissive: '#dc9450', emissiveIntensity: 0.16 })
const pink = mat('#f1a7a5', { emissive: '#f27772', emissiveIntensity: 0.32 })
const blue = mat('#b4cfd1', { emissive: '#7ac5cf', emissiveIntensity: 0.24 })
const noShadow = { noShadow: true }
const box = (p, s, c) => ({ p, s, c })
const oak = '#825239'
const dark = '#563a30'
const gold = '#b9835b'
const lanternCap = mat('#795036')
const lanternGold = mat('#c69257')
const tassel = mat('#a94736')
const lanternPaper = new THREE.LatheGeometry(Array.from({ length: 29 }, (_, i) => {
  const t = i / 28
  const shoulder = 0.12 + 0.15 * Math.sin(Math.PI * t) ** 0.75
  const rib = i % 4 === 2 ? -0.007 : 0
  return new THREE.Vector2(shoulder + rib, 0.48 * (t - 0.5))
}), 24)

const floors = [box([0, -0.10, -3.79], [3.54, 0.20, 2.38], '#bf8b60'), box([0, -0.12, 0], [6.7, 0.24, 5.27], '#bf8b60')]
const railEdges = [
  [[-1.77, 0, -3.65], [0.11, 1.08, 2.04]], [[1.77, 0, -3.65], [0.11, 1.08, 2.04]],
  [[-2.53, 0, -2.63], [1.52, 1.08, 0.11]], [[2.53, 0, -2.63], [1.52, 1.08, 0.11]],
  [[-3.29, 0, 0], [0.11, 1.08, 5.28]], [[3.29, 0, 0], [0.11, 1.08, 5.28]],
  [[0, 0, 2.6], [6.63, 1.08, 0.11]],
]
const posts = [-1, 1].flatMap((side) => [-1.9, 1.9].map((z) => box([side * 2.72, 1.44, z], [0.22, 2.88, 0.22], dark)))
const seats = [-1, 1].map((side) => box([side * 2.82, 0.38, 0.45], [0.53, 0.19, 1.8], oak))
const trim = [
  ...floors, ...posts, ...seats,
  ...railEdges.flatMap(([[x, , z], [w, , d]]) => [0.47, 1.01].map((y) => box([x, y, z], [w, 0.09, d], oak))),
  ...railEdges.flatMap(([[x, , z], [w, , d]]) => {
    const count = Math.ceil(Math.max(w, d) / 1.1)
    return Array.from({ length: count + 1 }, (_, i) => {
      const ratio = i / count - 0.5
      return box([x + (w > d ? (w - 0.1) * ratio : 0), 0.53, z + (d > w ? (d - 0.1) * ratio : 0)], [0.09, 1.06, 0.09], dark)
    })
  }),
  ...Array.from({ length: 20 }, (_, i) => box([0, 0.004, -2.52 + i * 0.26], [6.55, 0.01, 0.014], gold)),
  ...Array.from({ length: 10 }, (_, i) => box([0, 0.004, -4.86 + i * 0.24], [3.45, 0.01, 0.014], gold)),
  ...[-1, 1].flatMap((side) => [
    box([side * 2.74, -2.85, 1.72], [0.22, 5.5, 0.22], dark),
    box([side * 2.74, -2.85, -1.72], [0.22, 5.5, 0.22], dark),
    box([side * 1.45, -2.85, -4.3], [0.16, 5.5, 0.16], oak),
    box([side * 2.35, 0.28, 2.05], [0.93, 0.54, 0.45], dark),
    box([side * 2.35, 0.55, 2.05], [0.99, 0.09, 0.51], gold),
    box([side * 2.72, 2.78, 0], [0.26, 0.20, 4], oak),
    box([0, 2.78, side * 1.92], [5.65, 0.20, 0.25], oak),
    box([side * 1.77, 1.12, -4.57], [0.18, 0.27, 0.18], dark),
  ]),
]
const flowers = [-1, 1].flatMap((side) => Array.from({ length: 11 }, (_, i) =>
  box([side * 2.35 + (i % 6 - 2.5) * 0.14, 0.59 + (i % 3) * 0.06, 1.95 + Math.floor(i / 6) * 0.21],
    [0.20, 0.19, 0.20], ['#d98ca1', '#f1b498', '#f2ddc4', '#687d57'][i % 4]),
))
const lanterns = [-1, 1].flatMap((side) => [
  { position: [side * 1.1, 2.19, -1.92], hanging: true, scale: 1 },
  { position: [side * 1.77, 1.42, -4.57], hanging: false, scale: 0.57 },
])

function PavilionLantern({ position, scale, hanging, lit }) {
  return (
    <group position={position} scale={scale} name="bk-sunset-lantern" userData={noShadow}>
      <mesh geometry={lanternPaper} material={lit ? amber : paper} userData={noShadow} />
      {[-1, 1].map((side) => (
        <group key={side} position={[0, side * 0.25, 0]}>
          <mesh geometry={GEO.cyl} material={lanternCap} scale={[0.143, 0.04, 0.143]} userData={noShadow} />
          <mesh geometry={GEO.cyl} material={lanternGold} position={[0, -side * 0.021, 0]} scale={[0.127, 0.012, 0.127]} userData={noShadow} />
        </group>
      ))}
      {hanging && (
        <>
          <mesh geometry={GEO.cyl8} material={lanternCap} position={[0, 0.37, 0]} scale={[0.014, 0.22, 0.014]} userData={noShadow} />
          <mesh geometry={GEO.cyl8} material={tassel} position={[0, -0.33, 0]} scale={[0.027, 0.12, 0.027]} userData={noShadow} />
        </>
      )}
    </group>
  )
}

export function SunsetPavilion({ item }) {
  const roof = useMemo(() => hipRoofGeometry(6.45, 4.9, 1.28, 0.57), [])
  useEffect(() => () => roof.dispose(), [roof])
  const sign = useMemo(() => texMat(getSignTexture(TITLE, '#48302c', '#ffedc6', 4), { emissive: '#ffffff', emissiveIntensity: 0.24 }), [])
  const [glow, setGlow] = useState(0)
  const lightLanterns = useCallback(() => setGlow(performance.now()), [])
  useEffect(() => {
    if (!glow) return
    const timer = setTimeout(() => setGlow(0), 12_000)
    return () => clearTimeout(timer)
  }, [glow])

  return (
    <group userData={noShadow}>
      <Instances geometry={GEO.box} material={wood} items={trim} />
      <Instances geometry={GEO.ico} material={wood} items={flowers} />
      {lanterns.map((lantern) => <PavilionLantern key={lantern.position.join('/')} {...lantern} lit={Boolean(glow)} />)}
      <mesh geometry={roof} material={tile} position={[0, 2.86, 0]} />
      <mesh geometry={GEO.box} material={mat(dark)} position={[0, 2.61, -2.13]} scale={[1.86, 0.49, 0.11]} />
      <mesh geometry={GEO.plane} material={sign} position={[0, 2.61, -2.2]} rotation={[0, Math.PI, 0]} scale={[1.74, 0.435, 1]} />
      {PAVILION_PADS.map((x, i) => (
        <mesh key={x} geometry={GEO.cyl48} material={i === 0 ? pink : blue} position={[-x, 0.018, 0]} scale={[0.59, 0.025, 0.59]} />
      ))}
      <PavilionInteraction item={item} onLight={lightLanterns} />
    </group>
  )
}

function PavilionInteraction({ item, onLight }) {
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const active = useGameStore((state) => state.openPanel?.placeId === item.id)
  const [pad, setPad] = useState(-1)
  const currentPad = useRef(-1)
  const player = useRef(null)
  const hud = useRef(null)
  const vectors = useMemo(() => ({ eye: new THREE.Vector3(), feet: new THREE.Vector3(), position: [0, 0, 0] }), [])

  const open = useCallback(() => {
    const game = useGameStore.getState()
    if (currentPad.current >= 0 && !game.openPanel && !game.inputLocked) game.open({ type: 'bk_pavilion', placeId: item.id })
  }, [item.id])

  useEffect(() => {
    const down = (event) => {
      if (event.code === 'KeyE' && !event.repeat && !event.defaultPrevented && !event.target?.closest?.('button, input, textarea, select, [contenteditable]')) open()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [open])

  useFrame(({ camera }) => {
    if (hud.current?.parent) {
      camera.getWorldDirection(vectors.eye).multiplyScalar(2).add(camera.position)
      hud.current.position.copy(hud.current.parent.worldToLocal(vectors.eye))
    }
    if (!player.current?.parent) player.current = scene.getObjectByName('player') ?? null
    const next = player.current ? pavilionPad(player.current.getWorldPosition(vectors.feet).toArray(vectors.position)) : -1
    if (next === currentPad.current) return
    currentPad.current = next
    setPad(next)
    if (next < 0 && useGameStore.getState().openPanel?.placeId === item.id) useGameStore.getState().close()
  })

  return (
    <group ref={hud}>
      {(active || pad >= 0) && (
        <Html calculatePosition={() => [0, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[16777272, 16777272]}>
          <div className="date-pavilion-hud" style={{ width: size.width, height: size.height }}>
            {active ? <LanternDialog onLight={onLight} /> : (
              <button type="button" className="ui-btn date-pavilion-open" onClick={open}><kbd>E</kbd> 노을등 정자 · 등불 켜기</button>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

const notices = {
  sending: '등불을 준비하고 있어요.',
  waiting: '다른 발판에 선 친구가 등불을 켜면 질문이 열려요. 20초 동안 기다려요.',
  expired: '다른 발판에서 응답이 없었어요. 다시 시도할 수 있어요.',
  off_pad: '분홍색 또는 하늘색 발판 가운데에 서고 다시 눌러 주세요.',
}

function LanternDialog({ onLight }) {
  const dialog = useRef(null)
  const online = useRealtimeStore((state) => state.status === 'online')
  const [mood, setMood] = useState('')
  const [result, setResult] = useState(null)
  const busy = ['sending', 'waiting'].includes(result?.status)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    const off = onTarotMessage((message) => {
      if (message.t !== 'episode.pavilion.status') return
      setResult(message)
      if (message.status === 'lit') onLight()
    })
    return () => {
      element.close()
      off()
      sendTarot({ t: 'episode.pavilion.cancel' })
    }
  }, [onLight])
  useEffect(() => {
    if (!online) setResult((previous) => ['sending', 'waiting'].includes(previous?.status) ? null : previous)
  }, [online])

  const close = () => useGameStore.getState().close()
  const lightTogether = () => {
    setResult({ status: 'sending' })
    sendTarot({ t: 'episode.pavilion.light', mood })
  }
  const lightAlone = () => {
    setResult({ status: 'solo', prompt: pavilionPrompt(mood) })
    onLight()
  }

  return (
    <dialog ref={dialog} className="date-pavilion-dialog" aria-labelledby="pavilion-title" onCancel={(event) => { event.preventDefault(); close() }}>
      <header>
        <div><span>전망대 산책로</span><h2 id="pavilion-title">{TITLE}</h2></div>
        <button type="button" className="ui-btn" onClick={close} aria-label="정자 닫기">×</button>
      </header>
      <div className="date-pavilion-body">
        <p>오늘의 기분을 골라 보세요. 둘이 서로 다른 발판에서 등불을 켜면 같은 질문이 열려요.</p>
        <div className="special-actions" aria-label="오늘의 기분" role="group">
          {Object.entries(MOODS).map(([key, label]) => <button key={key} type="button" className="ui-btn" aria-pressed={mood === key} disabled={busy} onClick={() => { setMood(key); setResult(null) }}>{label}</button>)}
        </div>
        <div className="special-actions">
          {online && <button type="button" className="ui-btn ui-btn--primary" disabled={!mood || busy} onClick={lightTogether}>둘이 등불 켜기</button>}
          <button type="button" className="ui-btn" disabled={!mood || busy} onClick={lightAlone}>혼자 질문 뽑기</button>
        </div>
        <div role="status" aria-live="polite">
          {result?.prompt ? (
            <section className="date-pavilion-card">
              <h3>{result.status === 'lit' ? '두 사람이 켠 등불' : '나의 노을등 질문'}</h3>
              {result.moods && <p>{result.moods.map((key) => MOODS[key]).join(' · ')}</p>}
              <p>{result.prompt}</p>
            </section>
          ) : notices[result?.status] && <p className="date-pavilion-notice">{notices[result.status]}</p>}
        </div>
      </div>
    </dialog>
  )
}
