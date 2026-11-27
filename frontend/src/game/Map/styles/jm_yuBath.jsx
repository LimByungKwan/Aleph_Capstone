import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { create } from 'zustand'
import { Box } from './kit.jsx'
import { canvasTexture, KR_FONT } from './jm_landmarks.jsx'
import { findPlayer } from '../../Player/findPlayer.js'
import { useGameStore } from '../../../store/gameStore.js'
import { onJmMessage, sendJm } from '../../multiplayer/realtimeStore.js'

// ── (11/27 지민 결정: 누각 기능 1) 약탕 패 고르기 ──
// 1층 큰 목욕탕 누각 앞 나무 패 판. E를 누를 때마다 맑은 탕 → 유자 → 쑥 → 장미 → 박하 → 맑은 탕 …
// 고르면 여섯 탕의 물빛이 그 색으로 천천히 바뀜 (jm_yutoya.jsx useWaterMaterial이 이 저장소를 읽음)
// 멀티 접속 중이면 서버(server/src/jm_lifts.js)가 모두에게 보내고 기억해 둠 → 늦게 들어온 사람도 같은 탕
// (기능 3 누각 위 전망대는 그림·충돌이라 jm_yutoya.jsx YuPavilion + 생성 스크립트)

export const HERBS = [
  { name: '맑은 탕', color: '#8ed6cc' },
  { name: '유자탕', color: '#f2cf5b' },
  { name: '쑥탕', color: '#86c26e' },
  { name: '장미탕', color: '#f19ab4' },
  { name: '박하탕', color: '#9fe7f2' },
]
export const useYuHerb = create(() => ({ i: 0 }))
const HERB_ID = 'jm_yutoya_herb'
let listening = false
function listen() {
  if (listening) return
  listening = true
  onJmMessage((msg) => {
    if ((msg.t === 'jm.bath.herb' || msg.t === 'jm.bath.herbState') && msg.id === HERB_ID && Number.isInteger(msg.i) && HERBS[msg.i]) useYuHerb.setState({ i: msg.i })
  })
}

const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
const canAct = () => {
  const g = useGameStore.getState()
  return !g.openPanel && !g.nearbyPlaceId && !g.inputLocked
}
let audio = null // (11/27 최적화) 누를 때마다 새로 만들지 않고 하나를 같이 씀
function chime(freq) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    const a = audio
    if (a.state === 'suspended') a.resume()
    const t = a.currentTime
    const o = a.createOscillator()
    o.frequency.value = freq
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
    o.connect(g).connect(a.destination)
    o.start(t)
    o.stop(t + 0.9)
  } catch {
    // 소리 없이
  }
}
function tagTex(i) {
  const h = HERBS[i]
  return canvasTexture(`jmbath:tag${i}`, 96, 256, (c, w, hh) => {
    c.fillStyle = '#c9a26a'
    c.fillRect(0, 0, w, hh)
    c.fillStyle = h.color
    c.fillRect(0, 0, w, 40)
    c.fillStyle = '#3a2214'
    c.font = `bold 30px ${KR_FONT}`
    c.textAlign = 'center'
    const label = h.name.replace('탕', '')
    ;[...label].forEach((ch, k) => c.fillText(ch, w / 2, 90 + k * 40))
  })
}

const Key = ({ label, sub }) => (
  <div style={{ transform: 'translate(-50%, -100%)', background: 'rgba(32,20,14,0.88)', color: '#fff6e2', padding: '6px 11px', borderRadius: 12, fontFamily: KR_FONT, fontSize: 13, whiteSpace: 'nowrap', textAlign: 'center' }}>
    <span style={{ background: '#e8c35a', color: '#2b1a12', borderRadius: 4, padding: '0 6px', fontWeight: 700, marginRight: 6 }}>E</span>
    {label}
    {sub && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{sub}</div>}
  </div>
)

export function JmYuBath({ item }) {
  const B = item.bath
  const y = B.y
  const [bx, bz] = B.board
  const group = useRef(null)
  const { scene } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const nearRef = useRef(false)
  const [near, setNear] = useState(false)
  const herb = useYuHerb((s) => s.i)
  const tags = useMemo(() => HERBS.map((_, i) => tagTex(i)), [])
  const sel = useRef([])

  useEffect(() => {
    listen()
    const down = (e) => {
      if (e.code !== 'KeyE' || e.repeat || isTyping(e.target) || !nearRef.current || !canAct()) return
      const next = (useYuHerb.getState().i + 1) % HERBS.length
      useYuHerb.setState({ i: next })
      sendJm({ t: 'jm.bath.herb', id: HERB_ID, i: next })
      chime(520 + next * 90)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    sel.current.forEach((m, i) => {
      if (m) m.position.z = i === herb ? 0.06 + Math.sin(t * 3) * 0.02 : 0
    })
    const p = findPlayer(scene)
    if (!p || !group.current) return
    p.getWorldPosition(v)
    group.current.worldToLocal(v)
    const n = Math.hypot(v.x - bx, v.z - (bz + 1.2)) < 2.2 && v.y > y - 0.5 && v.y < y + 2.5
    if (n !== nearRef.current) {
      nearRef.current = n
      setNear(n)
    }
  })

  const span = (HERBS.length - 1) * 0.55
  return (
    <group ref={group}>
      {/* 패 판: 나무 틀 + 지붕 + 걸린 패 다섯 (지금 고른 패가 앞으로 살짝 나옴) */}
      <group position={[bx, y, bz]}>
        {[-1, 1].map((s) => <Box key={s} p={[s * (span / 2 + 0.45), 1.05, 0]} s={[0.12, 2.1, 0.12]} c="#5a3d2a" />)}
        <Box p={[0, 2.12, 0]} s={[span + 1.3, 0.1, 0.4]} c="#7d3d2a" />
        <Box p={[0, 1.95, 0]} s={[span + 1.0, 0.06, 0.06]} c="#3a2214" />
        {HERBS.map((h, i) => (
          <group key={i} position={[-span / 2 + i * 0.55, 1.35, 0.04]} ref={(el) => (sel.current[i] = el)}>
            <Box p={[0, 0.42, 0]} s={[0.012, 0.3, 0.012]} c="#2a1a12" />
            <mesh>
              <planeGeometry args={[0.36, 0.95]} />
              <meshStandardMaterial map={tags[i]} side={THREE.DoubleSide} emissive={i === herb ? h.color : '#000000'} emissiveIntensity={i === herb ? 0.35 : 0} />
            </mesh>
          </group>
        ))}
      </group>
      {near && (
        <Html position={[bx, y + 2.6, bz + 0.3]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Key label="약탕 패 바꾸기" sub={`지금: ${HERBS[herb].name} → 다음: ${HERBS[(herb + 1) % HERBS.length].name}`} />
        </Html>
      )}
    </group>
  )
}
