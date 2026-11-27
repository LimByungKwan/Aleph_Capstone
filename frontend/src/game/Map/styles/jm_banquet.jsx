import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { layout } from '../../data/mapData.js'
import { Ball, Box, Cyl, GEO, Instances, mat } from './kit.jsx'
import { canvasTexture, KR_FONT } from './jm_landmarks.jsx'
import { findPlayer } from '../../Player/findPlayer.js'
import { useGameStore } from '../../../store/gameStore.js'
import { onJmMessage, sendJm } from '../../multiplayer/realtimeStore.js'
import { NearOnly } from './jm_yutoya.jsx'

// ── (11/27 지민 요청) 온천장 2층 큰 연회장: 1 무대 큰 북 · 2 차린 연회 상 · 3 손님 신들 · 4 바다 쪽 미닫이 + 발코니 ──
// 자리 값은 생성 스크립트 YU_FEAST (여관 가운데 기준 로컬 좌표, y = 2층 바닥). 충돌(무대·북·상·발코니)도 생성 스크립트가 만듦
// - 북: 무대 앞에서 E → 둥 소리 + 연회장 초롱이 한꺼번에 번쩍. 멀티 접속 중이면 서버(server/src/jm_lifts.js)를 거쳐 다른 화면에서도 같이
// - 손님 신들: 방석 위 크고 흐릿한 손님. 가까이 가면 한 줄 말을 함 (영화 캐릭터를 따라 하지 않은 얼굴 없는 빛 덩어리)
// - 미닫이: 닫혔을 때 막는 충돌이 있어야 해서 물리(<Physics>) 안에서 그림 → JmBanquetDoors (jm_guestLift.jsx의 JmGuestLifts가 같이 그림)

const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
const canAct = () => {
  const g = useGameStore.getState()
  return !g.openPanel && !g.nearbyPlaceId && !g.inputLocked
}

// 북 소리: 파일 없이 낮은 사인파(110 → 48Hz) + 짧은 잡음으로 「둥」
let audio = null
function playDrum(vol) {
  if (vol <= 0.02) return
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
    const t = audio.currentTime
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.35)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.8 * vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    o.connect(g).connect(audio.destination)
    o.start(t)
    o.stop(t + 1)
    const len = Math.floor(audio.sampleRate * 0.08)
    const buf = audio.createBuffer(1, len, audio.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
    const n = audio.createBufferSource()
    n.buffer = buf
    const f = audio.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 900
    const ng = audio.createGain()
    ng.gain.value = 0.25 * vol
    n.connect(f).connect(ng).connect(audio.destination)
    n.start(t)
  } catch {
    // 소리를 못 내는 브라우저면 빛만
  }
}

// 손님 신들이 하는 말 (가까이 가면 한 줄)
const LINES = [
  '오늘 탕물이 유난히 맑구먼.',
  '북소리가 나면 술상이 한 번 더 돈다네.',
  '사람 손님은 오랜만이야. 천천히 즐기게.',
  '바다 쪽 미닫이를 열어 보게. 전차가 지나갈 때가 제일 좋아.',
  '무대의 북, 한 번 쳐 보겠나?',
  '이 집 튀김은 백 년째 같은 맛이지.',
  '엘리베이터는 3층 주인 방까지 간다더군.',
]

function kohakuTexture() {
  return canvasTexture('jmbq:kohaku', 512, 64, (ctx, w, h) => {
    const n = 16
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#f3eee4' : '#b8322a'
      ctx.fillRect((i * w) / n, 0, w / n + 1, h)
    }
  })
}
function goldScreenTexture() {
  return canvasTexture('jmbq:goldscreen', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9a24a'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,240,190,0.35)'
    for (let i = 0; i < 6; i++) ctx.fillRect((i * w) / 6 + 4, 0, 2, h)
    // 물결 + 솟은 해 (흔한 금 병풍 무늬)
    ctx.strokeStyle = '#2f5d7a'
    ctx.lineWidth = 5
    for (let r = 0; r < 4; r++) {
      ctx.beginPath()
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.72 + r * 14 + Math.sin(x / 26 + r) * 7)
      ctx.stroke()
    }
    ctx.fillStyle = '#c4392b'
    ctx.beginPath()
    ctx.arc(w * 0.68, h * 0.3, 34, 0, Math.PI * 2)
    ctx.fill()
  })
}
function skinTexture() {
  return canvasTexture('jmbq:drumskin', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e9dcc0'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#a8322a'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2)
    ctx.stroke()
  })
}

const Bubble = ({ text, sub }) => (
  <div style={{ transform: 'translate(-50%, -100%)', background: 'rgba(32,20,14,0.86)', color: '#fff6e2', padding: '6px 10px', borderRadius: 10, fontFamily: KR_FONT, fontSize: 13, whiteSpace: 'nowrap', border: '1px solid rgba(232,195,90,0.6)' }}>
    {text}
    {sub && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{sub}</div>}
  </div>
)
const Key = ({ k, label }) => (
  <div style={{ transform: 'translate(-50%, -100%)', display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(32,20,14,0.86)', color: '#fff6e2', padding: '5px 10px', borderRadius: 999, fontFamily: KR_FONT, fontSize: 13, whiteSpace: 'nowrap' }}>
    <span style={{ background: '#e8c35a', color: '#2b1a12', borderRadius: 4, padding: '0 6px', fontWeight: 700 }}>{k}</span>
    {label}
  </div>
)

// 북을 친 시각 (초) — 이 화면에서 친 것·다른 사람이 친 것 모두
const drum = { t: -99 }

// (11/27 최적화) NearOnly(합치기)는 바깥에 두고 상태(가까움·말풍선)는 안쪽에만 → 안내가 뜨고 질 때마다 다시 합치지 않게
export function JmBanquetHall({ item }) {
  return (
    <NearOnly radius={70}>
      <BanquetInner item={item} />
    </NearOnly>
  )
}

function BanquetInner({ item }) {
  const F = item.feast
  const y = F.y
  const top = y + F.stageH
  const group = useRef(null)
  const skin = useRef(null)
  const sticks = useRef(null)
  const ghostRefs = useRef([])
  const [near, setNear] = useState(false)
  const [talk, setTalk] = useState(-1)
  const nearRef = useRef(false)
  const distRef = useRef(99)
  const { scene } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])

  const lantern = useMemo(() => mat('#f6e2c0', { emissive: '#ff9a4a', emissiveIntensity: 0.8 }).clone(), [])
  const lanternRed = useMemo(() => mat('#c8443a', { emissive: '#ff5a3a', emissiveIntensity: 0.6 }).clone(), [])
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9e2ff', emissive: '#8fa6ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.6 }), [])
  const kohaku = useMemo(() => kohakuTexture(), [])
  const gold = useMemo(() => goldScreenTexture(), [])
  const skinTex = useMemo(() => skinTexture(), [])

  const [sx0, sz0, sx1, sz1] = F.stage
  const hit = (remote) => {
    drum.t = performance.now() / 1000
    playDrum(remote ? Math.max(0, 1 - distRef.current / 40) : 1)
    if (!remote) sendJm({ t: 'jm.drum.hit', id: item.id })
  }
  const hitRef = useRef(hit)
  hitRef.current = hit

  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'KeyE' || e.repeat || isTyping(e.target) || !nearRef.current || !canAct()) return
      hitRef.current(false)
    }
    window.addEventListener('keydown', down)
    const off = onJmMessage((msg) => {
      if (msg.t === 'jm.drum.hit' && msg.id === item.id) hitRef.current(true)
    })
    return () => {
      window.removeEventListener('keydown', down)
      off()
    }
  }, [item.id])

  // 상 두 줄: 자리(1.2m마다) 양쪽 방석·그릇, 두 자리마다 술병
  const set = useMemo(() => {
    const cushions = []
    const bowls = []
    const plates = []
    const bottles = []
    const sticksA = []
    for (const z of F.rows) {
      for (const [a, b] of F.segs) {
        const n = Math.floor((b - a) / 1.2)
        for (let i = 0; i < n; i++) {
          const x = a + 0.6 + i * ((b - a - 1.2) / Math.max(1, n - 1))
          for (const sd of [-1, 1]) {
            cushions.push({ p: [x, y + 0.06, z + sd * 0.82], s: [0.62, 0.12, 0.56], c: (i + (sd > 0 ? 1 : 0)) % 2 ? '#7d3b44' : '#3f4f6e' })
            bowls.push({ p: [x - 0.14, y + 0.43, z + sd * 0.22], s: [0.11, 0.07, 0.11] })
            plates.push({ p: [x + 0.16, y + 0.4, z + sd * 0.2], s: [0.16, 0.015, 0.16] })
            sticksA.push({ p: [x, y + 0.405, z + sd * 0.33], s: [0.36, 0.015, 0.02] })
          }
          if (i % 2 === 0) bottles.push({ p: [x + 0.6, y + 0.53, z], s: [0.07, 0.26, 0.07] })
        }
      }
    }
    return { cushions, bowls, plates, bottles, sticksA }
  }, [F, y])
  const lanterns = useMemo(() => {
    const out = []
    for (const z of F.rows) for (let x = -3.2; x < sx0 - 0.5; x += 2.4) out.push({ p: [x, y + 3.55, z], red: out.length % 2 === 1 })
    return out
  }, [F, y, sx0])

  useFrame(({ clock }) => {
    const now = performance.now() / 1000
    const since = now - drum.t
    const flash = since < 3 ? Math.exp(-since * 2.2) : 0
    lantern.emissiveIntensity = 0.8 + flash * 2.6
    lanternRed.emissiveIntensity = 0.6 + flash * 2.2
    if (skin.current) skin.current.scale.setScalar(1 + (since < 0.5 ? Math.sin(since * 40) * Math.exp(-since * 8) * 0.06 : 0))
    if (sticks.current) sticks.current.rotation.z = since < 0.4 ? -Math.sin((since / 0.4) * Math.PI) * 0.6 : 0
    const t = clock.elapsedTime
    ghostRefs.current.forEach((g, i) => {
      if (g) g.position.y = Math.sin(t * 0.9 + i * 1.7) * 0.06
    })
    // 캐릭터 위치(이 연회장 기준)
    const player = findPlayer(scene)
    if (!player || !group.current) return
    player.getWorldPosition(v)
    group.current.worldToLocal(v)
    distRef.current = Math.hypot(v.x - F.drum[0], v.z - F.drum[1]) // 다른 사람이 친 북 소리 크기용 (멀어도 계속)
    // (11/27 최적화) 2층 근처가 아니면 가까움·말풍선 계산은 건너뜀 (북·초롱 번쩍임은 위에서 이미 처리)
    if (Math.abs(v.y - y) > 5 || Math.hypot(v.x, v.z) > 40) {
      if (nearRef.current) {
        nearRef.current = false
        setNear(false)
      }
      if (talk !== -1) setTalk(-1)
      return
    }
    const onFloor = v.y > y - 0.5 && v.y < y + 3
    const n = onFloor && Math.hypot(v.x - (sx0 - 0.4), v.z - F.drum[1]) < 3.2
    if (n !== nearRef.current) {
      nearRef.current = n
      setNear(n)
    }
    let best = -1
    let bd = 2.4
    if (onFloor) F.ghosts.forEach(([gx, gz], i) => {
      const d = Math.hypot(v.x - gx, v.z - gz)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    if (best !== talk) setTalk(best)
  })

  const B = F.balcony
  const front = F.door.z + 0.15
  return (
    // 무대·상·방석 등 안 움직이는 부품은 바깥 NearOnly가 재질별로 합쳐 그림. 움직이는 것은 userData.noMerge
    <group ref={group}>
      {/* ── 무대 ── */}
      <Box p={[(sx0 + sx1) / 2, y + F.stageH / 2, (sz0 + sz1) / 2]} s={[sx1 - sx0, F.stageH, sz1 - sz0]} c="#6b4630" />
      <Box p={[sx0 + 0.02, top - 0.04, (sz0 + sz1) / 2]} s={[0.06, 0.08, sz1 - sz0]} c="#c9a24a" />
      <Box p={[(F.step + sx0) / 2 - 0.18, y + 0.125, F.drum[1]]} s={[0.35, 0.25, 3]} c="#5a3a24" />
      <Box p={[(F.step + sx0) / 2 + 0.17, y + 0.25, F.drum[1]]} s={[0.35, 0.5, 3]} c="#5a3a24" />
      {/* 뒤 벽: 홍백 막 + 금 병풍 6폭 (지그재그) */}
      <mesh position={[sx1 + 0.08, top + 2.9, (sz0 + sz1) / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[sz1 - sz0, 1.0]} />
        <meshStandardMaterial map={kohaku} roughness={0.8} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const pw = (sz1 - sz0 - 0.6) / 6
        const z = sz0 + 0.3 + pw * (i + 0.5)
        return (
          <mesh key={i} position={[sx1 - 0.35 + (i % 2 ? 0.18 : 0), top + 1.25, z]} rotation={[0, -Math.PI / 2 + (i % 2 ? 0.28 : -0.28), 0]}>
            <planeGeometry args={[pw + 0.06, 2.4]} />
            <meshStandardMaterial map={gold} side={THREE.DoubleSide} metalness={0.3} roughness={0.45} />
          </mesh>
        )
      })}
      {/* ── 큰 북 (서쪽을 봄) ── */}
      <group position={[F.drum[0], top, F.drum[1]]}>
        {[-0.45, 0.45].map((z) => (
          <group key={z}>
            <Box p={[0, 0.45, z]} s={[0.14, 0.9, 0.14]} c="#2b1a12" r={[0, 0, 0.35]} />
            <Box p={[0, 0.45, z]} s={[0.14, 0.9, 0.14]} c="#2b1a12" r={[0, 0, -0.35]} />
          </group>
        ))}
        <Cyl p={[0, 1.35, 0]} rad={0.68} h={1.0} c="#7a3b1c" r={[0, 0, Math.PI / 2]} />
        {[-0.36, 0.36].map((x) => <Cyl key={x} p={[x, 1.35, 0]} rad={0.71} h={0.08} c="#c9a24a" r={[0, 0, Math.PI / 2]} />)}
        <mesh ref={skin} position={[-0.51, 1.35, 0]} rotation={[0, -Math.PI / 2, 0]} userData={{ noMerge: true }}>
          <circleGeometry args={[0.64, 28]} />
          <meshStandardMaterial map={skinTex} roughness={0.7} />
        </mesh>
        <group ref={sticks} position={[-0.9, 1.35, 0]} userData={{ noMerge: true }}>
          {[-0.18, 0.18].map((z) => <Cyl key={z} p={[0.1, 0.25, z]} rad={0.03} h={0.6} c="#d8c39a" r={[0, 0, -0.5]} />)}
        </group>
      </group>
      {near && (
        <Html position={[F.drum[0] - 0.6, top + 2.4, F.drum[1]]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Key k="E" label="큰 북 치기" />
        </Html>
      )}
      {/* ── 연회 상 두 줄 ── */}
      {F.rows.map((z) =>
        F.segs.map(([a, b]) => (
          <group key={`${z}${a}`}>
            <Box p={[(a + b) / 2, y + 0.37, z]} s={[b - a, 0.06, 0.8]} c="#3a1712" />
            <Box p={[(a + b) / 2, y + 0.17, z]} s={[b - a - 0.1, 0.34, 0.7]} c="#2b1a12" />
          </group>
        )),
      )}
      <Instances geometry={GEO.box} material={mat('#ffffff', { roughness: 0.9 })} items={set.cushions} />
      <Instances geometry={GEO.cyl} material={mat('#9b2a22', { roughness: 0.35 })} items={set.bowls} />
      <Instances geometry={GEO.cyl} material={mat('#f1e8d6')} items={set.plates} />
      <Instances geometry={GEO.box} material={mat('#d8c39a')} items={set.sticksA} />
      <Instances geometry={GEO.cyl} material={mat('#efe9dc', { roughness: 0.3 })} items={set.bottles} />
      {/* 상 위 초롱 줄 (북을 치면 번쩍) */}
      {F.rows.map((z) => <Box key={`cord${z}`} p={[(sx0 - 3.7) / 2, y + 3.95, z]} s={[sx0 + 3.7, 0.02, 0.02]} c="#2b1a12" />)}
      <group userData={{ noMerge: true }}>{lanterns.map((l, i) => <Ball key={i} p={l.p} s={[0.3, 0.38, 0.3]} m={l.red ? lanternRed : lantern} />)}</group>
      {/* ── 손님 신들 ── */}
      {F.ghosts.map(([gx, gz, face, sc], i) => (
        <group key={i} position={[gx, y, gz]} rotation={[0, face > 0 ? 0 : Math.PI, 0]}>
          <group ref={(el) => (ghostRefs.current[i] = el)} userData={{ noMerge: true }}>
            <Ball p={[0, 0.7 * sc, 0]} s={[0.5 * sc, 0.75 * sc, 0.45 * sc]} m={ghostMat} />
            <Ball p={[0, 1.55 * sc, 0.02]} rad={0.3 * sc} m={ghostMat} />
          </group>
          {talk === i && (
            <Html position={[0, 2.1 * sc, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <Bubble text={LINES[i % LINES.length]} sub="손님 신" />
            </Html>
          )}
        </group>
      ))}
      {/* ── 바다 쪽 발코니 (1층 처마 위) ── */}
      <group position={[0, y, 0]}>
        <Box p={[(B.x0 + B.x1) / 2, -0.06, front + B.d / 2 - 0.15]} s={[B.x1 - B.x0, 0.12, B.d]} c="#5a3a24" />
        <Box p={[(B.x0 + B.x1) / 2, 1.05, front + B.d - 0.2]} s={[B.x1 - B.x0, 0.1, 0.1]} c="#a2513a" />
        {[B.x0, B.x1].map((x) => <Box key={x} p={[x, 1.05, front + B.d / 2 - 0.15]} s={[0.1, 0.1, B.d]} c="#a2513a" />)}
        {Array.from({ length: 7 }, (_, i) => <Box key={i} p={[B.x0 + (i * (B.x1 - B.x0)) / 6, 0.5, front + B.d - 0.2]} s={[0.1, 1.0, 0.1]} c="#a2513a" />)}
        {/* 문틀 (바깥) */}
        <Box p={[(F.door.x0 + F.door.x1) / 2, F.door.h + 0.08, front + 0.02]} s={[F.door.x1 - F.door.x0 + 0.3, 0.16, 0.1]} c="#2b1a12" />
        {[F.door.x0, F.door.x1].map((x) => <Box key={x} p={[x, F.door.h / 2, front + 0.02]} s={[0.16, F.door.h, 0.1]} c="#2b1a12" />)}
      </group>
    </group>
  )
}

// ── 미닫이 (물리 안): 닫혀 있으면 막고, E로 열고 닫음. 이 화면에서만 (멀티 동기화는 안 함) ──
const FEASTS = layout.props.filter((p) => p.style === 'jmBanquetHall' && p.feast?.door)
export function JmBanquetDoors({ playerRef }) {
  return FEASTS.map((item) => <SlidingDoor key={item.id} item={item} playerRef={playerRef} />)
}
function SlidingDoor({ item, playerRef }) {
  const F = item.feast
  const D = F.door
  const [bx, bz] = item.position
  const baseY = item.elevation ?? 0
  const [open, setOpen] = useState(false)
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)
  const openAmt = useRef(0)
  const left = useRef(null)
  const right = useRef(null)
  const w = D.x1 - D.x0
  const cx = bx + (D.x0 + D.x1) / 2
  const cz = bz + D.z
  const y0 = baseY + F.y

  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'KeyE' || e.repeat || isTyping(e.target) || !nearRef.current || !canAct()) return
      setOpen((o) => !o)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  useFrame((_, delta) => {
    openAmt.current = THREE.MathUtils.damp(openAmt.current, open ? 1 : 0, 6, delta)
    const o = openAmt.current * (w / 2 - 0.1)
    if (left.current) left.current.position.x = -w / 4 - o
    if (right.current) right.current.position.x = w / 4 + o
    const player = playerRef?.current
    if (!player?.currPos) return
    const p = player.body?.translation() ?? player.currPos
    const n = Math.abs(p.x - cx) < w / 2 + 1.2 && Math.abs(p.z - cz) < 2.4 && p.y > y0 - 0.5 && p.y < y0 + 3
    if (n !== nearRef.current) {
      nearRef.current = n
      setNear(n)
    }
  })

  const panel = (ref, x) => (
    <group ref={ref} position={[x, 0, 0]}>
      <Box p={[0, D.h / 2, 0]} s={[w / 2, D.h, 0.06]} c="#f4ead2" />
      {[-1, 1].map((s) => <Box key={s} p={[(s * w) / 4, D.h / 2, 0.04]} s={[0.08, D.h, 0.05]} c="#3b2216" />)}
      {[0.05, 0.36, 0.66, 0.97].map((t) => <Box key={t} p={[0, D.h * t, 0.04]} s={[w / 2, 0.06, 0.05]} c="#3b2216" />)}
      {[-w / 8, 0, w / 8].map((xx) => <Box key={xx} p={[xx, D.h / 2, 0.035]} s={[0.035, D.h, 0.03]} c="#3b2216" />)}
    </group>
  )
  return (
    <>
      <group position={[cx, y0, cz - 0.28]}>
        {panel(left, -w / 4)}
        {panel(right, w / 4)}
        {near && (
          <Html position={[0, D.h + 0.4, -0.4]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <Key k="E" label={open ? '미닫이 닫기' : '미닫이 열기 · 바다 발코니'} />
          </Html>
        )}
      </group>
      {/* 닫혔을 때만 막는 충돌 (월드 좌표) */}
      {!open && (
        <RigidBody type="fixed" colliders={false} position={[cx, y0 + D.h / 2, cz]}>
          <CuboidCollider args={[w / 2, D.h / 2, 0.15]} />
        </RigidBody>
      )}
    </>
  )
}
