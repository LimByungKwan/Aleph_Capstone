import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Ball, Box, Cyl, GEO, Instances, mat } from './kit.jsx'
import { canvasTexture, getJpSignTexture, KR_FONT } from './jm_landmarks.jsx'
import { InteractiveSeat } from './jm_bench.jsx'
import { NearOnly } from './jm_yutoya.jsx'
import { findPlayer } from '../../Player/findPlayer.js'
import { useGameStore } from '../../../store/gameStore.js'
import { currentUser, useUiStore } from '../../../components/movieZone/uiStore.js'

// ── (11/27 지민 결정: 3층 나안) 온천장 3층 — 긴 복도 · 문 다섯 개 · 모자이크 방 · 주인의 집무실 ──
// 자리 값은 생성 스크립트 YU_TOP (여관 가운데 기준 로컬, y = 3층 바닥). 벽·가구 충돌도 생성 스크립트가 만듦
// 참고: 지민이 보낸 영화 장면(무늬 벽지 복도, 일렬로 열린 붉은 문들, 아치 벽난로·붉은 카펫·벨벳 긴 의자, 큰 책상·놋쇠 스탠드)
//   영화 캐릭터는 넣지 않음. 문 문양은 영화 글자 대신 여관 이름 글자 「湯」
// 기능: 1 다가가면 문이 차례로 열림(끼익) · 2 벽난로 E로 켜고 끄기 · 3 숙박부에 내 이름 쓰기 · 6 복도 초상화 눈이 따라옴
//       8 큰 창 커튼 E로 열기(밤바다) · 9 모자이크 바닥 퍼즐(순서대로 밟기) · 10 주인 의자에 앉기(jm_bench.jsx InteractiveSeat)

const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
const canAct = () => {
  const g = useGameStore.getState()
  return !g.openPanel && !g.nearbyPlaceId && !g.inputLocked
}

// ── 소리 (파일 없이) ──
let audio = null
const ctx = () => {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
    return audio
  } catch {
    return null
  }
}
function noise(a, len) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const n = a.createBufferSource()
  n.buffer = buf
  return n
}
function playCreak(vol = 0.5) {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const o = a.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(180, t)
  o.frequency.linearRampToValueAtTime(260, t + 0.35)
  o.frequency.linearRampToValueAtTime(150, t + 0.8)
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 900
  f.Q.value = 6
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.12 * vol, t + 0.08)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
  o.connect(f).connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + 1)
}
function playChime(freq = 660, vol = 0.4) {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const o = a.createOscillator()
  o.type = 'sine'
  o.frequency.value = freq
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.3 * vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + 0.8)
}
function playFire() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const n = noise(a, 0.6)
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 700
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
  n.connect(f).connect(g).connect(a.destination)
  n.start(t)
}

// ── 그림(캔버스) ──
function damaskTex(key, bg, fg) {
  return canvasTexture(`jmtop:damask:${key}`, 256, 256, (c, w, h) => {
    c.fillStyle = bg
    c.fillRect(0, 0, w, h)
    c.strokeStyle = fg
    c.lineWidth = 7
    c.lineCap = 'round'
    for (const [ox, oy] of [[0, 0], [w / 2, h / 2], [w, 0], [0, h], [w, h]]) {
      c.save()
      c.translate(ox, oy)
      for (const s of [-1, 1]) {
        c.beginPath()
        c.moveTo(0, -60)
        c.bezierCurveTo(s * 50, -40, s * 50, 10, s * 14, 22)
        c.bezierCurveTo(s * 40, 40, s * 30, 70, 0, 60)
        c.stroke()
        c.beginPath()
        c.arc(s * 26, -18, 9, 0, Math.PI * 2)
        c.stroke()
      }
      c.restore()
    }
  })
}
function carpetTex() {
  return canvasTexture('jmtop:carpet', 512, 512, (c, w, h) => {
    c.fillStyle = '#5a1418'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = '#c99a3c'
    c.lineWidth = 10
    c.strokeRect(22, 22, w - 44, h - 44)
    c.lineWidth = 4
    c.strokeRect(48, 48, w - 96, h - 96)
    c.fillStyle = '#21305a'
    for (let i = 0; i < 12; i++) {
      const x = 60 + (i * (w - 120)) / 11
      for (const y of [35, h - 35]) {
        c.beginPath()
        c.moveTo(x, y - 9)
        c.lineTo(x + 9, y)
        c.lineTo(x, y + 9)
        c.lineTo(x - 9, y)
        c.fill()
      }
    }
    c.strokeStyle = '#d8a548'
    c.lineWidth = 6
    for (const [cx, cy, r] of [[w / 2, h / 2, 120], [w / 2, h / 2, 70]]) {
      c.beginPath()
      c.ellipse(cx, cy, r * 1.4, r, 0, 0, Math.PI * 2)
      c.stroke()
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      c.beginPath()
      c.moveTo(w / 2 + Math.cos(a) * 100, h / 2 + Math.sin(a) * 70)
      c.quadraticCurveTo(w / 2 + Math.cos(a + 0.3) * 200, h / 2 + Math.sin(a + 0.3) * 150, w / 2 + Math.cos(a) * 220, h / 2 + Math.sin(a) * 170)
      c.stroke()
    }
  })
}
function runnerTex() {
  return canvasTexture('jmtop:runner', 128, 512, (c, w, h) => {
    c.fillStyle = '#2f4a2a'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#1f3a6a'
    c.fillRect(8, 0, 12, h)
    c.fillRect(w - 20, 0, 12, h)
    c.fillStyle = '#c99a3c'
    for (let y = 0; y < h; y += 64) {
      c.beginPath()
      c.moveTo(w / 2, y + 10)
      c.lineTo(w / 2 + 28, y + 32)
      c.lineTo(w / 2, y + 54)
      c.lineTo(w / 2 - 28, y + 32)
      c.fill()
    }
    c.fillStyle = '#a8322a'
    for (let y = 32; y < h; y += 64) c.fillRect(w / 2 - 5, y - 5, 10, 10)
  })
}
function mosaicTex() {
  return canvasTexture('jmtop:mosaic', 256, 256, (c, w, h) => {
    c.fillStyle = '#1f5a46'
    c.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
      const k = (x * 7 + y * 13) % 5
      c.fillStyle = ['#2a6f56', '#1a4f3e', '#c9a24a', '#2f7a5e', '#174536'][k]
      c.fillRect(x + 1, y + 1, 14, 14)
    }
    c.strokeStyle = '#e2c27a'
    c.lineWidth = 6
    c.beginPath()
    c.arc(w / 2, h / 2, 90, 0, Math.PI * 2)
    c.stroke()
  })
}
function rosetteTex() {
  return canvasTexture('jmtop:rosette', 512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    const cx = w / 2
    c.strokeStyle = '#e2c27a'
    for (const [r, lw] of [[250, 12], [200, 6], [120, 8]]) {
      c.lineWidth = lw
      c.beginPath()
      c.arc(cx, cx, r, 0, Math.PI * 2)
      c.stroke()
    }
    c.fillStyle = '#c9a24a'
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      c.beginPath()
      c.ellipse(cx + Math.cos(a) * 160, cx + Math.sin(a) * 160, 26, 12, a, 0, Math.PI * 2)
      c.fill()
    }
  })
}
function checkerTex() {
  return canvasTexture('jmtop:checker', 128, 128, (c, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.fillStyle = (x + y) % 2 ? '#ece6da' : '#1d1a18'
      c.fillRect((x * w) / 4, (y * h) / 4, w / 4, h / 4)
    }
  })
}
function doorTex() {
  return canvasTexture('jmtop:door', 128, 320, (c, w, h) => {
    c.fillStyle = '#b8322a'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#efe0bf'
    c.fillRect(14, 16, w - 28, h * 0.48)
    c.fillRect(14, h * 0.62, w - 28, h * 0.12)
    c.fillRect(14, h * 0.8, w - 28, h * 0.14)
    c.strokeStyle = '#c99a3c'
    c.lineWidth = 5
    c.beginPath()
    c.ellipse(w / 2, h * 0.26, 34, 62, 0, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = '#c99a3c'
    c.font = `bold 44px ${KR_FONT}`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('湯', w / 2, h * 0.27)
  })
}
function seaTex() {
  return canvasTexture('jmtop:nightsea', 512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#0b1430')
    g.addColorStop(0.6, '#1b2c5a')
    g.addColorStop(0.62, '#0d2140')
    g.addColorStop(1, '#06101f')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#fff6d8'
    c.beginPath()
    c.arc(w * 0.72, h * 0.22, 18, 0, Math.PI * 2)
    c.fill()
    for (let i = 0; i < 60; i++) c.fillRect((i * 97) % w, (i * 53) % (h * 0.55), 1.5, 1.5)
    c.fillStyle = 'rgba(255,240,190,0.5)'
    for (let i = 0; i < 26; i++) c.fillRect(w * 0.72 - 20 + Math.sin(i) * 14, h * 0.64 + i * 3.3, 40 - i, 1.2)
    c.fillStyle = '#ffcf7a'
    for (let i = 0; i < 14; i++) c.fillRect(30 + i * 9, h * 0.6, 5, 3) // 멀리 바다 전차 창 불빛
  })
}
function portraitTex(k) {
  return canvasTexture(`jmtop:portrait${k}`, 160, 200, (c, w, h) => {
    c.fillStyle = k ? '#2c3a2a' : '#3a2a2c'
    c.fillRect(0, 0, w, h)
    c.fillStyle = k ? '#6b4a8a' : '#5a3a2a'
    c.beginPath()
    c.ellipse(w / 2, h * 0.92, 62, 50, 0, Math.PI, 0)
    c.fill()
    c.fillStyle = '#e2c49a'
    c.beginPath()
    c.ellipse(w / 2, h * 0.45, 40, 52, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = k ? '#d9d4c8' : '#3b2a20'
    c.beginPath()
    c.ellipse(w / 2, h * 0.24, 42, 22, 0, Math.PI, 0)
    c.fill()
    c.strokeStyle = '#5a3a2a'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(w / 2 - 16, h * 0.62)
    c.quadraticCurveTo(w / 2, h * (k ? 0.66 : 0.6), w / 2 + 16, h * 0.62)
    c.stroke()
    if (!k) {
      c.fillStyle = '#3b2a20'
      c.fillRect(w / 2 - 20, h * 0.55, 40, 6)
    }
  })
}
function ledgerTex(names) {
  const t = canvasTexture(`jmtop:ledger:${names.join('|')}`, 256, 160, (c, w, h) => {
    c.fillStyle = '#f2ead4'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#c9b88e'
    c.fillRect(w / 2 - 2, 0, 4, h)
    c.fillStyle = '#5a2a1a'
    c.font = `bold 16px ${KR_FONT}`
    c.fillText('宿帳 숙박부', 12, 22)
    c.font = `13px ${KR_FONT}`
    names.slice(-8).forEach((n, i) => c.fillText(`${i + 1}. ${n}`, i < 4 ? 12 : w / 2 + 10, 48 + (i % 4) * 26))
  })
  return t
}

const Key = ({ k = 'E', label }) => (
  <div style={{ transform: 'translate(-50%, -100%)', display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(32,20,14,0.86)', color: '#fff6e2', padding: '5px 10px', borderRadius: 999, fontFamily: KR_FONT, fontSize: 13, whiteSpace: 'nowrap' }}>
    <span style={{ background: '#e8c35a', color: '#2b1a12', borderRadius: 4, padding: '0 6px', fontWeight: 700 }}>{k}</span>
    {label}
  </div>
)
const Toast = ({ text }) => (
  <div style={{ transform: 'translate(-50%, -100%)', background: 'rgba(32,20,14,0.9)', color: '#ffe9b0', padding: '7px 12px', borderRadius: 10, fontFamily: KR_FONT, fontSize: 13, whiteSpace: 'nowrap', border: '1px solid rgba(232,195,90,0.7)' }}>{text}</div>
)

const WALL_COLOR = { band: '#5a2a24', hall: '#5a2a24', part: '#4a1f1c', store: '#c99aa8', room: '#5a2a24' }
const ROOM_COLOR = { red: '#9e3329', green: '#3f6233', gold: '#a8823a', violet: '#56467a' }
const LS_KEY = 'jm_yutoya_ledger'
const readLedger = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

export function JmYuTop({ item }) {
  return (
    <NearOnly radius={80}>{/* (11/27 최적화) 안 움직이는 벽·가구는 재질별로 합쳐 그림 — 움직이거나 재질이 바뀌는 것은 userData.noMerge */}
      <TopFloor T={item.top} id={item.id} />
    </NearOnly>
  )
}

function TopFloor({ T, id }) {
  const y = T.y
  const h = T.h
  const { scene } = useThree()
  const group = useRef(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  const me = useRef({ x: 0, y: -99, z: 0, on: false })

  const tex = useMemo(() => ({
    office: damaskTex('office', '#5a1418', '#9a6a2a'),
    hall: damaskTex('hall', '#4a1a14', '#8a5a26'),
    mosaicWall: damaskTex('mosaicwall', '#e8dcc0', '#c9a24a'),
    carpet: carpetTex(),
    runner: runnerTex(),
    mosaic: mosaicTex(),
    rosette: rosetteTex(),
    checker: checkerTex(),
    door: doorTex(),
    sea: seaTex(),
    p0: portraitTex(0),
    p1: portraitTex(1),
  }), [])
  useMemo(() => {
    for (const k of ['office', 'hall', 'mosaicWall', 'mosaic', 'checker']) tex[k].wrapS = tex[k].wrapT = THREE.RepeatWrapping
  }, [tex])

  // ── 상태 ──
  const [fireOn, setFireOn] = useState(true)
  const [curtain, setCurtain] = useState(false)
  const [names, setNames] = useState(readLedger)
  const [prompt, setPrompt] = useState(null) // { p, label }
  const [toast, setToast] = useState(null) // { p, text, until }
  const zone = useRef(null)
  const doorAmt = useRef(T.doors.map(() => 0))
  const doorWas = useRef(T.doors.map(() => false))
  const doorRefs = useRef([])
  const flames = useRef(null)
  const fireGlow = useRef(null) // (11/27 최적화) 점조명 대신 바닥 불빛 판 — 점조명은 맵 전체 재질 계산을 늘림
  const curtainRefs = useRef([])
  const curtainAmt = useRef(0)
  const eyes = useRef([])
  const puzzle = useRef({ next: 0, done: false, flash: 0 })
  const [lit, setLit] = useState(0) // 켜진 타일 수 (그림 다시 그리기용)
  const tileMats = useMemo(() => Array.from({ length: T.puzzle.n }, () => mat('#e2c27a', { emissive: '#ffcf7a', emissiveIntensity: 0.05 }).clone()), [T.puzzle.n])
  const rosetteMat = useRef(null)

  const ledger = useMemo(() => ledgerTex(names), [names])

  // 기능 영역 (로컬)
  const W = T.window
  const spots = useMemo(() => ({
    fire: { p: [T.fire[0] + 1.8, T.fire[1]], r: 2.6, label: () => (fireOn ? '벽난로 불 끄기' : '벽난로 불 켜기'), lift: 3.2 },
    ledger: { p: [T.desk[0], T.desk[1] + 1.6], r: 1.8, label: () => '숙박부에 이름 쓰기', lift: 1.8 },
    // 커튼: 주인 의자(앉기 E)와 겹치지 않게 창 서쪽 끝에서
    curtain: { p: [W.x0 + 1.6, T.office[1] + 2.1], r: 2.2, label: () => (curtain ? '커튼 닫기' : '커튼 열기 · 밤바다'), lift: 3.6 },
  }), [T, W, fireOn, curtain])

  const act = (k) => {
    if (k === 'fire') {
      setFireOn((o) => !o)
      playFire()
    } else if (k === 'curtain') {
      setCurtain((o) => !o)
      playCreak(0.3)
    } else if (k === 'ledger') {
      const name = currentUser(useUiStore.getState().userId)?.name || '손님'
      const d = new Date()
      const entry = `${name} (${d.getMonth() + 1}/${d.getDate()})`
      setNames((prev) => {
        const next = [...prev, entry].slice(-8)
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next))
        } catch {
          // 저장이 막힌 브라우저면 이 화면에서만
        }
        return next
      })
      playChime(880)
      setToast({ p: [T.desk[0], y + 2.6, T.desk[1]], text: `숙박부에 「${name}」 이름이 적혔어요`, until: performance.now() + 3500 })
    }
  }
  const actRef = useRef(act)
  actRef.current = act
  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'KeyE' || e.repeat || isTyping(e.target) || !zone.current || !canAct()) return
      actRef.current(zone.current)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const player = findPlayer(scene)
    const m = me.current
    if (player && group.current) {
      player.getWorldPosition(v)
      group.current.worldToLocal(v)
      m.x = v.x
      m.y = v.y
      m.z = v.z
      m.on = v.y > y - 0.6 && v.y < y + 3
    } else m.on = false
    // (11/27 최적화) 3층 근처(층 높이 ±4m, 건물 안팎 40m)에 없으면 문·불꽃·퍼즐 계산을 건너뜀
    if (!player || Math.abs(m.y - y) > 4 || Math.hypot(m.x, m.z) > 40) {
      if (zone.current) {
        zone.current = null
        setPrompt(null)
      }
      return
    }

    // 1 문: 3m 안이면 열림 (끼익 한 번)
    T.doors.forEach((d, i) => {
      const near = m.on && Math.hypot(m.x - d.p[0], m.z - d.p[1]) < 3.2
      if (near && !doorWas.current[i]) playCreak(0.5)
      doorWas.current[i] = near
      doorAmt.current[i] = THREE.MathUtils.damp(doorAmt.current[i], near ? 1 : 0, near ? 3.2 : 1.6, dt)
      const g = doorRefs.current[i]
      if (g) {
        const a = doorAmt.current[i] * 1.45
        g.children[0].rotation.y = -a * d.open
        g.children[1].rotation.y = a * d.open
      }
    })

    // 2 벽난로 불꽃
    if (flames.current) {
      flames.current.visible = fireOn
      flames.current.children.forEach((f, i) => {
        f.scale.y = 0.8 + Math.sin(t * 9 + i * 1.7) * 0.18 + Math.sin(t * 23 + i) * 0.06
      })
    }
    if (fireGlow.current) fireGlow.current.material.emissiveIntensity = fireOn ? 1.1 + Math.sin(t * 11) * 0.2 : 0

    // 6 초상화 눈: 캐릭터 쪽으로 눈동자 이동 (그림 면 기준 가로·세로)
    eyes.current.forEach((pupil, i) => {
      if (!pupil) return
      const [px] = T.portraits[Math.floor(i / 2)]
      const dx = m.on ? THREE.MathUtils.clamp((m.x - px) / 6, -1, 1) : 0
      const dy = m.on ? THREE.MathUtils.clamp((m.y + 1.2 - (y + 2.0)) / 4, -1, 1) : 0
      pupil.position.x = pupil.userData.bx + dx * 0.022 // 초상화가 복도 북쪽 벽에서 +z(남쪽)를 봄
      pupil.position.y = pupil.userData.by + dy * 0.014
    })

    // 8 커튼
    curtainAmt.current = THREE.MathUtils.damp(curtainAmt.current, curtain ? 1 : 0, 3, dt)
    curtainRefs.current.forEach((c, i) => {
      if (!c) return
      const s = i ? 1 : -1
      const half = (W.x1 - W.x0) / 4
      c.position.x = (W.x0 + W.x1) / 2 + s * (half + curtainAmt.current * half * 1.3)
      c.scale.x = 1 - curtainAmt.current * 0.45
    })

    // 9 모자이크 퍼즐: 다음 타일 은은하게 깜빡, 밟으면 켜짐. 틀린 타일 → 처음부터
    const P = puzzle.current
    const [pcx, pcz] = T.puzzle.c
    tileMats.forEach((mm, i) => {
      if (P.done || i < P.next) mm.emissiveIntensity = 1.4
      else if (i === P.next) mm.emissiveIntensity = 0.15 + (Math.sin(t * 3) * 0.5 + 0.5) * 0.35
      else mm.emissiveIntensity = 0.05
      if (P.flash > 0) mm.emissive.set('#ff4a3a')
      else mm.emissive.set('#ffcf7a')
    })
    P.flash = Math.max(0, P.flash - dt)
    if (m.on && !P.done) {
      for (let i = 0; i < T.puzzle.n; i++) {
        const a = (i / T.puzzle.n) * Math.PI * 2
        const tx = pcx + Math.cos(a) * T.puzzle.r
        const tz = pcz + Math.sin(a) * T.puzzle.r
        if (Math.hypot(m.x - tx, m.z - tz) < 0.6) {
          if (i === P.next) {
            P.next++
            playChime(520 + P.next * 70)
            if (P.next >= T.puzzle.n) {
              P.done = true
              playChime(1040, 0.6)
              setToast({ p: [pcx, y + 2.4, pcz], text: '모자이크가 빛나요! 퍼즐 완성', until: performance.now() + 4000 })
            }
            setLit(P.next)
          } else if (i > P.next) { // 이미 켠 타일을 지나가는 건 괜찮음 — 아직 안 켠 엉뚱한 타일만 처음부터
            P.next = 0
            P.flash = 0.6
            setLit(0)
          }
          break
        }
      }
    }
    if (rosetteMat.current) rosetteMat.current.emissiveIntensity = P.done ? 0.9 + Math.sin(t * 2) * 0.3 : 0.08

    // 안내 (가장 가까운 기능 하나)
    let best = null
    let bd = Infinity
    if (m.on) for (const [k, sp] of Object.entries(spots)) {
      const d = Math.hypot(m.x - sp.p[0], m.z - sp.p[1])
      if (d < sp.r && d < bd) {
        bd = d
        best = k
      }
    }
    if (best !== zone.current) {
      zone.current = best
      setPrompt(best ? { k: best } : null)
    }
    if (toast && performance.now() > toast.until) setToast(null)
  })

  const [ox0, oz0, ox1, oz1] = T.office
  const [mx0, mz0, mx1, mz1] = T.mosaic
  const B = T.band
  const iz = -oz0
  const ix = ox1
  const books = useMemo(() => {
    const out = []
    const cols = ['#54352c', '#1f3a5f', '#2f4a2a', '#5a3d2a', '#7c5a1a', '#3b2a4f', '#6a2420']
    for (const [bx, bz] of T.books) for (let r = 0; r < 5; r++) for (let i = 0; i < 20; i++) {
      out.push({ p: [bx - 0.3, y + 0.35 + r * 0.6, bz - 2.8 + i * 0.28], s: [0.3, 0.42 + ((i * 7 + r) % 3) * 0.06, 0.2], c: cols[(i + r * 3) % cols.length] })
    }
    return out
  }, [T, y])
  const coins = useMemo(() => Array.from({ length: 50 }, (_, i) => {
    const a = i * 2.4
    const r = (i % 7) * 0.08
    return { p: [T.desk[0] + 1.3 + Math.cos(a) * r, y + 0.98 + Math.floor(i / 7) * 0.025, T.desk[1] + Math.sin(a) * r * 0.6], s: [0.09, 0.02, 0.09] }
  }), [T, y])
  const cushions = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const layer = Math.floor(i / 9)
    const a = ((i % 9) / 9) * Math.PI * 2 + layer
    const r = layer === 2 ? 0.4 : 1.2 - layer * 0.4
    return { p: [T.pile[0] + Math.cos(a) * r, y + 0.35 + layer * 0.45, T.pile[1] + Math.sin(a) * r], s: [0.75, 0.32, 0.6], c: ['#e86a8a', '#7ac7e8', '#f2c94c', '#9be38a', '#c39bf0'][i % 5] }
  }), [T, y])

  const wallPlane = (x, z, len, rot, map, rep = 1.6) => {
    const tt = map.clone()
    tt.needsUpdate = true
    tt.repeat.set(len / rep, h / rep)
    return (
      <mesh position={[x, y + h / 2, z]} rotation={[0, rot, 0]}>
        <planeGeometry args={[len, h]} />
        <meshStandardMaterial map={tt} roughness={0.85} />
      </mesh>
    )
  }
  const floor = (x0, z0, x1, z1, map, rep, yy = 0.02) => {
    const tt = map.clone()
    tt.needsUpdate = true
    if (rep) tt.repeat.set((x1 - x0) / rep, (z1 - z0) / rep)
    return (
      <mesh position={[(x0 + x1) / 2, y + yy, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        <meshStandardMaterial map={tt} roughness={0.7} />
      </mesh>
    )
  }

  // 바닥·벽·벽지는 한 번만 만듦 (상태가 바뀔 때마다 무늬 텍스처를 다시 복제하지 않게)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const statics = useMemo(() => (
    <>
      {/* ── 바닥 ── */}
      {floor(ox0 + 0.1, oz0, ox1, oz1 - 0.1, tex.checker, 1.6)}
      {floor(2, -12, 20, 6, tex.carpet, 0, 0.03)}
      {/* 모자이크 바닥: 2층에서 올라오는 계단 구멍(T.hole)은 비움 */}
      {(T.hole ? [[mx0, mz0, mx1 - 0.1, T.hole[1]], [mx0, T.hole[3], mx1 - 0.1, mz1 - 0.1], [mx0, T.hole[1], T.hole[0], T.hole[3]]] : [[mx0, mz0, mx1 - 0.1, mz1 - 0.1]]).map(([a, b, c, d]) => <group key={`${a}${b}`}>{floor(a, b, c, d, tex.mosaic, 4)}</group>)}
      <mesh position={[T.puzzle.c[0], y + 0.03, T.puzzle.c[1]]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noMerge: true }}>
        <planeGeometry args={[8.2, 8.2]} />
        <meshStandardMaterial ref={rosetteMat} map={tex.rosette} transparent emissive="#ffcf7a" emissiveMap={tex.rosette} emissiveIntensity={0.08} depthWrite={false} />
      </mesh>
      {/* 긴 복도(앞벽 쪽 띠) + 엘리베이터 앞 작은 홀: 흑백 바닥 + 가운데 카펫 길 */}
      {floor(T.hall.x0, T.hall.z0 + 0.1, T.hall.x1, T.hall.z1, tex.checker, 1.2)}
      {floor(T.vest.x0, T.vest.z0 + 0.1, T.vest.x1, T.vest.z1 + 0.1, tex.checker, 1.2)}
      {floor(T.hall.x0 + 0.2, (T.hall.z0 + T.hall.z1) / 2 - 0.65, T.hall.x1 - 0.1, (T.hall.z0 + T.hall.z1) / 2 + 0.65, tex.runner, 0, 0.03)}
      {T.rooms.slice(1).map(([a, b]) => <group key={a}>{floor(a + 0.1, B + 0.1, b - 0.1, iz, tex.checker, 1.0)}</group>)}
      {/* ── 천장 (짙은 격자) ── */}
      <mesh position={[0, y + h - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ix * 2, iz * 2]} />
        <meshStandardMaterial color="#1e120e" roughness={0.9} />
      </mesh>

      {/* ── 벽 (충돌은 생성 스크립트, 여기서는 두께 0.25 상자 + 양면 벽지) ── */}
      {T.walls.map(([x0, z0, x1, z1, kind], i) => {
        const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
        const len = Math.hypot(x1 - x0, z1 - z0)
        return <Box key={i} p={[(x0 + x1) / 2, y + h / 2, (z0 + z1) / 2]} s={alongX ? [len, h, 0.25] : [0.25, h, len]} c={WALL_COLOR[kind]} />
      })}
      {T.doors.map((d) => (
        <Box key={`l${d.id}`} p={[d.p[0], y + d.h + (h - d.h) / 2, d.p[1]]} s={d.along === 'x' ? [d.w, h - d.h, 0.26] : [0.26, h - d.h, d.w]} c="#3a1a14" />
      ))}
      {/* 집무실: 바깥 세 벽 + 칸막이 집무실 쪽 = 붉은 무늬 벽지 */}
      {wallPlane((ox0 + ox1) / 2, oz0 + 0.06, ox1 - ox0, 0, tex.office)}
      {wallPlane(ox1 - 0.06, (oz0 + oz1) / 2, oz1 - oz0, -Math.PI / 2, tex.office)}
      {wallPlane(ox0 + 0.14, (oz0 + oz1) / 2, oz1 - oz0, Math.PI / 2, tex.office)}
      {wallPlane((ox0 + ox1) / 2, oz1 - 0.14, ox1 - ox0, Math.PI, tex.office)}
      {/* 모자이크 방: 크림·금 무늬 벽 */}
      {wallPlane((mx0 + mx1) / 2, mz0 + 0.06, mx1 - mx0, 0, tex.mosaicWall)}
      {wallPlane(mx0 + 0.06, (mz0 + mz1) / 2, mz1 - mz0, Math.PI / 2, tex.mosaicWall)}
      {wallPlane(mx1 - 0.14, (mz0 + mz1) / 2, mz1 - mz0, -Math.PI / 2, tex.mosaicWall)}
      {wallPlane((mx0 + mx1) / 2, mz1 - 0.14, mx1 - mx0, Math.PI, tex.mosaicWall)}
      {/* 긴 복도: 짙은 무늬 벽지 + 아래 나무 판 */}
      {(() => {
        const H = T.hall
        const cx = (H.x0 + H.x1) / 2
        const len = H.x1 - H.x0
        return (
          <>
            {wallPlane(cx, H.z0 + 0.14, len, 0, tex.hall, 1.2)}
            {wallPlane(cx, H.z1 - 0.06, len, Math.PI, tex.hall, 1.2)}
            {[H.z0 + 0.15, H.z1 - 0.08].map((z) => (
              <group key={z}>
                <Box p={[cx, y + 0.55, z]} s={[len, 1.1, 0.06]} c="#2a1a12" />
                <Box p={[cx, y + 1.12, z]} s={[len, 0.06, 0.08]} c="#c9a24a" />
              </group>
            ))}
          </>
        )
      })()}
      {/* 방 네 칸: 방마다 벽 색 + 금 테 판 */}
      {T.rooms.slice(1).map(([a, b, col]) => (
        <group key={col}>
          {[[(a + b) / 2, B + 0.14, b - a, 0], [(a + b) / 2, iz - 0.06, b - a, Math.PI]].map(([x, z, len, r], j) => (
            <group key={j} position={[x, y, z]} rotation={[0, r, 0]}>
              <Box p={[0, h / 2, 0]} s={[len - 0.2, h, 0.02]} c={ROOM_COLOR[col]} />
              <Box p={[0, 0.6, 0.02]} s={[len - 0.2, 1.2, 0.03]} c="#2a1a12" />
              <Box p={[0, 1.22, 0.04]} s={[len - 0.2, 0.08, 0.04]} c="#c9a24a" />
              <Box p={[0, 2.6, 0.03]} s={[Math.min(2.4, len - 1.2), 2.0, 0.02]} c="#efe0bf" />
              <Box p={[0, 2.6, 0.04]} s={[Math.min(2.6, len - 1.0), 2.2, 0.01]} c="#c9a24a" />
            </group>
          ))}
        </group>
      ))}

    </>
  ), [T])
  return (
    <group ref={group}>
      {statics}
      {/* ── 1 문 다섯 개(+모자이크·창고): 붉은 두짝문, 금 「湯」 ── */}
      {T.doors.map((d, i) => {
        const half = d.w / 2
        const rot = d.along === 'x' ? 0 : Math.PI / 2
        return (
          <group key={d.id} position={[d.p[0], y, d.p[1]]} rotation={[0, rot, 0]}>
            <group ref={(el) => (doorRefs.current[i] = el)} userData={{ noMerge: true }}>
              {[-1, 1].map((s) => (
                <group key={s} position={[s * half, 0, 0]}>
                  <mesh position={[-s * (half / 2), d.h / 2, 0]}>
                    <boxGeometry args={[half - 0.04, d.h - 0.05, 0.08]} />
                    <meshStandardMaterial map={tex.door} roughness={0.5} />
                  </mesh>
                  <Ball p={[-s * (half - 0.25), d.h * 0.48, 0.07]} rad={0.06} c="#c9a24a" />
                </group>
              ))}
            </group>
            <Box p={[0, d.h + 0.06, 0]} s={[d.w + 0.3, 0.12, 0.32]} c="#c9a24a" />
            {[-1, 1].map((s) => <Box key={s} p={[s * (half + 0.06), d.h / 2, 0]} s={[0.12, d.h, 0.32]} c="#c9a24a" />)}
          </group>
        )
      })}

      {/* ── 집무실 ── */}
      {/* 큰 책상 + 금 원 문양 + 책·잉크병·서류 상자·금화 */}
      <group position={[T.desk[0], y, T.desk[1]]}>
        <Box p={[0, 0.45, 0]} s={[4.4, 0.9, 1.6]} c="#3b2216" />
        <Box p={[0, 0.93, 0]} s={[4.6, 0.08, 1.75]} c="#2a170e" />
        <mesh position={[0, 0.48, 0.81]}>
          <circleGeometry args={[0.36, 28]} />
          <meshStandardMaterial map={getJpSignTexture('湯', '#3b2216', '#c9a24a', 1)} />
        </mesh>
        <mesh position={[0, 0.48, 0.805]}>
          <ringGeometry args={[0.36, 0.42, 28]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.5} roughness={0.4} />
        </mesh>
        {[[-1.7, 0.2], [-1.45, 0.25]].map(([x, yy], k) => <Box key={k} p={[x, 0.97 + k * 0.12, -0.3]} s={[0.7, 0.1, 0.5]} c={k ? '#5a2a1a' : '#1f3a5f'} />)}
        <Cyl p={[1.9, 1.08, -0.35]} rad={0.08} h={0.22} c="#3a7a6a" />
        <Cyl p={[2.1, 1.06, -0.2]} rad={0.07} h={0.18} c="#b8913c" />
        <Box p={[0.9, 1.02, 0.25]} s={[0.9, 0.12, 0.6]} c="#1e2a3a" />
        {/* 3 숙박부 (펼친 책) */}
        <mesh position={[-0.4, 0.985, 0.35]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noMerge: true }}>
          <planeGeometry args={[0.9, 0.56]} />
          <meshStandardMaterial map={ledger} roughness={0.9} />
        </mesh>
      </group>
      <Instances geometry={GEO.cyl} material={mat('#d8b04a', { metalness: 0.6, roughness: 0.3 })} items={coins} />
      {/* 10 주인 의자: 앉기 (앞 = +z, 책상 너머 문을 봄) */}
      <group position={[T.chair[0], y, T.chair[1]]}>
        <InteractiveSeat id={`${id}_chair`} seatHeight={0.55} label="주인 의자에 앉기">
          <Box p={[0, 0.5, 0]} s={[1.2, 0.2, 1.1]} c="#7a1e2a" />
          {/* 등받이는 앉았을 때 뒤에서 보는 카메라를 가리지 않게 머리 높이 아래까지만 */}
          <Box p={[0, 1.25, -0.5]} s={[1.2, 1.5, 0.2]} c="#7a1e2a" />
          <Box p={[0, 2.05, -0.5]} s={[1.4, 0.16, 0.26]} c="#c9a24a" />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Box p={[s * 0.62, 0.8, 0]} s={[0.12, 0.5, 1.0]} c="#c9a24a" />
              <Box p={[s * 0.5, 0.2, 0.4]} s={[0.1, 0.4, 0.1]} c="#c9a24a" />
              <Box p={[s * 0.5, 0.2, -0.4]} s={[0.1, 0.4, 0.1]} c="#c9a24a" />
            </group>
          ))}
        </InteractiveSeat>
      </group>
      {/* 놋쇠 스탠드: 긴 팔 + 원뿔 갓 */}
      <group position={[T.lamp[0], y, T.lamp[1]]}>
        <Cyl p={[0, 0.04, 0]} rad={0.3} h={0.08} c="#b8913c" />
        <Cyl p={[0, 1.3, 0]} rad={0.04} h={2.6} c="#b8913c" />
        <Box p={[-0.45, 2.55, 0]} s={[0.9, 0.04, 0.04]} c="#b8913c" />
        <mesh position={[-0.9, 2.35, 0]}>
          <coneGeometry args={[0.38, 0.4, 20, 1, true]} />
          <meshStandardMaterial color="#f6e2a6" emissive="#ffd27a" emissiveIntensity={1.1} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 2 아치 벽난로 (칸막이에 붙어 동쪽을 봄) */}
      <group position={[T.fire[0] + 0.12, y, T.fire[1]]} rotation={[0, Math.PI / 2, 0]}>
        <Box p={[0, 1.4, 0.3]} s={[3.6, 2.8, 0.6]} c="#2a2624" />
        <Box p={[0, 2.86, 0.4]} s={[3.9, 0.14, 0.8]} c="#3e3532" />
        <mesh position={[0, 1.05, 0.61]}>
          <circleGeometry args={[0.95, 32, 0, Math.PI]} />
          <meshStandardMaterial color="#120c0a" />
        </mesh>
        <Box p={[0, 0.5, 0.61]} s={[1.9, 1.0, 0.01]} c="#120c0a" />
        <group ref={flames} position={[0, 0.25, 0.5]} userData={{ noMerge: true }}>
          {[-0.45, -0.15, 0.15, 0.45].map((x, i) => (
            <mesh key={x} position={[x, 0.35, 0]} scale={[1, 1, 1]}>
              <coneGeometry args={[0.2 + (i % 2) * 0.06, 0.9 + (i % 2) * 0.3, 10]} />
              <meshStandardMaterial color="#ffb347" emissive="#ff7a1a" emissiveIntensity={2.2} transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
        {[-0.75, 0.75].map((x) => (
          <group key={x} position={[x, 0, 0.75]}>
            <Cyl p={[0, 0.25, 0]} rad={0.12} h={0.5} c="#2b2522" />
            <mesh position={[0, 0.75, 0]}>
              <coneGeometry args={[0.1, 0.6, 10]} />
              <meshStandardMaterial color="#3a332e" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        ))}
        {/* 불빛이 앞 돌바닥에 번진 듯한 판 (점조명 대신) */}
        <mesh ref={fireGlow} position={[0, 0.045, 1.3]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noMerge: true }}>
          <circleGeometry args={[1.5, 24]} />
          <meshStandardMaterial color="#3a2010" emissive="#ff8a3a" emissiveIntensity={1.1} transparent opacity={0.55} depthWrite={false} />
        </mesh>
        {/* 앞 반들한 돌바닥 (불빛이 비침) */}
        <mesh position={[0, 0.035, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.2, 2]} />
          <meshStandardMaterial color="#3a3432" roughness={0.15} metalness={0.2} />
        </mesh>
      </group>
      {/* 붉은 벨벳 긴 의자 (벽난로를 봄) */}
      <group position={[T.chaise[0], y, T.chaise[1]]} rotation={[0, -Math.PI / 2, 0]}>
        <Box p={[0, 0.35, 0]} s={[2.8, 0.4, 1.0]} c="#8a1e2e" />
        <Box p={[0, 0.85, -0.4]} s={[2.8, 0.8, 0.2]} c="#8a1e2e" />
        <Cyl p={[1.35, 0.7, 0.05]} rad={0.28} h={1.0} c="#8a1e2e" r={[Math.PI / 2, 0, 0]} />
        <Cyl p={[1.35, 0.7, 0.56]} rad={0.2} h={0.04} c="#c9a24a" r={[Math.PI / 2, 0, 0]} />
        {[-1.2, 1.2].map((x) => <Box key={x} p={[x, 0.08, 0.3]} s={[0.1, 0.16, 0.1]} c="#c9a24a" />)}
      </group>
      {/* 장식장 */}
      <group position={[T.cabinet[0], y, T.cabinet[1]]} rotation={[0, Math.PI, 0]}>
        <Box p={[0, 1.0, 0]} s={[2.4, 2.0, 0.55]} c="#3b2216" />
        <Box p={[0, 2.05, 0]} s={[2.5, 0.1, 0.6]} c="#c9a24a" />
        <Box p={[0, 1.15, 0.29]} s={[2.0, 1.4, 0.02]} m={mat('#cfe3ea', { transparent: true, opacity: 0.35, roughness: 0.1 })} />
      </group>
      {/* 책장 벽 */}
      {T.books.map(([x, z]) => (
        <group key={z}>
          <Box p={[x - 0.32, y + 1.6, z]} s={[0.6, 3.2, 6.1]} c="#2e1a12" />
          <Box p={[x - 0.32, y + 3.25, z]} s={[0.7, 0.12, 6.3]} c="#c9a24a" />
        </group>
      ))}
      <Instances geometry={GEO.box} material={mat('#ffffff')} items={books} />
      {/* 8 큰 창 + 무거운 커튼 */}
      <group position={[0, y, oz0 + 0.08]}>
        <mesh position={[(W.x0 + W.x1) / 2, 2.5, 0]}>
          <planeGeometry args={[W.x1 - W.x0, 2.9]} />
          <meshStandardMaterial map={tex.sea} emissive="#ffffff" emissiveMap={tex.sea} emissiveIntensity={0.55} />
        </mesh>
        {Array.from({ length: 6 }, (_, k) => <Box key={k} p={[W.x0 + (k * (W.x1 - W.x0)) / 5, 2.5, 0.03]} s={[0.08, 2.9, 0.05]} c="#1e140f" />)}
        <Box p={[(W.x0 + W.x1) / 2, 2.5, 0.03]} s={[W.x1 - W.x0, 0.08, 0.05]} c="#1e140f" />
        <Box p={[(W.x0 + W.x1) / 2, 4.1, 0.15]} s={[W.x1 - W.x0 + 1.6, 0.3, 0.3]} c="#5a1018" />
      </group>
      {[0, 1].map((i) => (
        <mesh key={i} ref={(el) => (curtainRefs.current[i] = el)} position={[0, y + 2.3, oz0 + 0.3]} userData={{ noMerge: true }}>
          <boxGeometry args={[(W.x1 - W.x0) / 2 + 0.3, 3.7, 0.14]} />
          <meshStandardMaterial color="#6a1420" roughness={0.9} />
        </mesh>
      ))}
      {/* 금 액자 그림 */}
      {[[ox0 + 0.2, -12, Math.PI / 2], [ox0 + 0.2, 6, Math.PI / 2], [2.8, oz0 + 0.12, 0], [20.4, oz0 + 0.12, 0]].map(([x, z, r], k) => (
        <group key={k} position={[x, y + 2.6, z]} rotation={[0, r, 0]}>
          <Box p={[0, 0, 0]} s={[2.0, 1.5, 0.08]} c="#c9a24a" />
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[1.7, 1.2]} />
            <meshStandardMaterial map={k % 2 ? tex.p1 : tex.sea} />
          </mesh>
        </group>
      ))}

      {/* ── 큰 꽃병 ── */}
      {T.vases.map(([x, z], k) => (
        <group key={k} position={[x, y, z]}>
          <mesh position={[0, 0.85, 0]} scale={[0.45, 0.85, 0.45]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color={k % 2 ? '#2f6a8a' : '#c96a3a'} roughness={0.35} />
          </mesh>
          <Cyl p={[0, 1.75, 0]} rad={0.18} h={0.3} c="#d8c39a" />
          <Cyl p={[0, 0.06, 0]} rad={0.48} h={0.12} c="#2a170e" />
        </group>
      ))}

      {/* ── 모자이크 방: 기둥 · 대기 의자 · 6 퍼즐 타일 ── */}
      {T.columns.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, y, z]}>
          <Cyl p={[0, h / 2, 0]} rad={0.38} h={h} c="#ece6da" />
          <Box p={[0, 0.15, 0]} s={[0.95, 0.3, 0.95]} c="#c9a24a" />
          <Box p={[0, h - 0.2, 0]} s={[1.0, 0.4, 1.0]} c="#c9a24a" />
        </group>
      ))}
      {/* (11/27) 기둥 옆 화분 (구성안 11번) */}
      {T.columns.map(([x, z]) => (
        <group key={`pl${x}${z}`} position={[x + 0.9, y, z + 0.6]}>
          <Cyl p={[0, 0.3, 0]} rad={0.35} h={0.6} c="#2f6a8a" />
          <Cyl p={[0, 0.62, 0]} rad={0.37} h={0.06} c="#c9a24a" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[Math.cos(k) * 0.25, 1.2 + (k % 2) * 0.25, Math.sin(k) * 0.25]} rotation={[Math.cos(k) * 0.7, k, Math.sin(k) * 0.7]} scale={[0.18, 0.7, 0.05]} geometry={GEO.sphere}>
              <meshStandardMaterial color="#3f7a3a" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* (11/27) 길 안내: 2층 계단으로 올라온 곳 → 금빛 문(복도) → 집무실 */}
      {[[-5.6, T.band - 0.2, Math.PI, '집무실 · 엘리베이터 ↑ 이 문으로'], [T.hall.x0 + 1.6, T.hall.z0 + 0.2, 0, '집무실 → 복도 끝 붉은 문']].map(([x, z, r, text], k) => (
        <group key={`sg${k}`} position={[x, y, z]} rotation={[0, r, 0]}>
          <mesh position={[0, k === 0 ? 3.75 : 2.6, k === 0 ? -0.1 : 0.02]}>
            <planeGeometry args={[2.2, 0.5]} />
            <meshStandardMaterial map={getJpSignTexture(text, '#2b1a12', '#e8c35a', 2.2 / 0.5)} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {T.benches.map(([x, z]) => (
        <group key={`b${x}`} position={[x, y, z]} rotation={[0, Math.PI, 0]}>
          <Box p={[0, 0.35, 0]} s={[2.8, 0.4, 0.9]} c="#8a1e2e" />
          <Box p={[0, 0.85, -0.38]} s={[2.8, 0.8, 0.16]} c="#8a1e2e" />
        </group>
      ))}
      {Array.from({ length: T.puzzle.n }, (_, i) => {
        const a = (i / T.puzzle.n) * Math.PI * 2
        return (
          <group key={i} position={[T.puzzle.c[0] + Math.cos(a) * T.puzzle.r, y + 0.04, T.puzzle.c[1] + Math.sin(a) * T.puzzle.r]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={tileMats[i]} userData={{ noMerge: true }}>
              <circleGeometry args={[0.55, 28]} />
            </mesh>
            <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, -a - Math.PI / 2]}>
              <planeGeometry args={[0.6, 0.6]} />
              <meshStandardMaterial map={getJpSignTexture('一二三四五六'[i], '#1f5a46', '#f6e7c8', 1)} transparent opacity={0.9} />
            </mesh>
          </group>
        )
      })}
      {/* 창고(아기 방): 쿠션 더미 */}
      {cushions.map((c, i) => (
        <mesh key={i} geometry={GEO.sphere} position={c.p} scale={c.s}>
          <meshStandardMaterial color={c.c} roughness={0.9} />
        </mesh>
      ))}

      {/* ── 6 긴 복도 초상화 (눈이 따라옴) ── */}
      {T.portraits.map(([x, z], k) => (
        <group key={k} position={[x, y + 2.2, z + 0.17]}>
          <Box p={[0, 0, 0]} s={[1.3, 1.6, 0.08]} c="#c9a24a" />
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[1.1, 1.4]} />
            <meshStandardMaterial map={k ? tex.p1 : tex.p0} />
          </mesh>
          {[-1, 1].map((s) => {
            const bx = s * 0.12
            const by = 0.1
            return (
              <group key={s}>
                <mesh position={[bx, by, 0.055]}>
                  <circleGeometry args={[0.055, 16]} />
                  <meshBasicMaterial color="#f6f1e6" />
                </mesh>
                <mesh ref={(el) => { if (el) { el.userData.bx = bx; el.userData.by = by; el.userData.noMerge = true; eyes.current[k * 2 + (s > 0 ? 1 : 0)] = el } }} position={[bx, by, 0.06]}>
                  <circleGeometry args={[0.025, 12]} />
                  <meshBasicMaterial color="#1a120e" />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}
      {/* 복도 벽 등 */}
      {[-9, -5, -1, 3].map((x) => (
        <group key={x} position={[x, y + 2.4, T.hall.z1 - 0.2]} rotation={[0, Math.PI, 0]}>
          <Box p={[0, -0.15, 0]} s={[0.06, 0.3, 0.12]} c="#c9a24a" />
          <Ball p={[0, 0.05, 0.08]} rad={0.13} c="#ffe3a8" />
        </group>
      ))}

      {/* ── 샹들리에 ── */}
      {T.chandeliers.map(([cx, cz], k) => (
        <group key={k} position={[cx, y + h - 0.35, cz]}>
          <Cyl p={[0, -0.15, 0]} rad={0.04} h={0.5} c="#c9a24a" />
          {[[1.0, -0.6, 10], [0.65, -1.0, 8], [0.3, -1.35, 6]].map(([r, yy, n], j) => (
            <group key={j}>
              <Cyl p={[0, yy, 0]} rad={r} h={0.05} c="#c9a24a" />
              {Array.from({ length: n }, (_, q) => {
                const a = (q / n) * Math.PI * 2
                return <Ball key={q} p={[Math.cos(a) * r, yy - 0.2, Math.sin(a) * r]} rad={0.09} m={mat('#fff1d6', { emissive: '#ffcf7a', emissiveIntensity: 0.9 })} />
              })}
            </group>
          ))}
        </group>
      ))}

      {/* ── 안내 ── */}
      {prompt && spots[prompt.k] && (
        <Html position={[spots[prompt.k].p[0], y + spots[prompt.k].lift, spots[prompt.k].p[1]]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Key label={spots[prompt.k].label()} />
        </Html>
      )}
      {toast && (
        <Html position={toast.p} zIndexRange={[21, 0]} style={{ pointerEvents: 'none' }}>
          <Toast text={toast.text} />
        </Html>
      )}
      {lit > 0 && !puzzle.current.done && (
        <Html position={[T.puzzle.c[0], y + 1.8, T.puzzle.c[1]]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Toast text={`모자이크 ${lit} / ${T.puzzle.n}`} />
        </Html>
      )}
    </group>
  )
}
