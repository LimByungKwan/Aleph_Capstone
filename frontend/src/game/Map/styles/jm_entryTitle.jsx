import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { findPlayer } from '../../Player/findPlayer.js'

// 애니 구역 입장 안내 (11/26 지민 결정: 「터널을 나서는 순간 세로쓰기 제목」) — 담당: 지민
// 터널 안을 걷는 동안 화면 가장자리가 점점 어두워지고, 풀밭 쪽 출구를 나서는 순간 확 밝아지며
// 화면 왼쪽(조작 안내 아래)에 세로 글씨 「터널 너머엔 / 등불의 마을」이 한 글자씩 써지고 아래에 마을 이름 (11/26 지민 요청: 한글, 다른 문구, 왼쪽 자리). 바람 소리(Web Audio 합성, 파일 없음).
// 버튼 없음, 걷는 걸 막지 않음. 5.5초 뒤 사라지고, 다시 지나가도 60초 안에는 또 뜨지 않음.
// 소품 자리 = 터널 뒤(풀밭 쪽) 출구 한가운데. 로컬 +z = 터널 쪽(남), 0보다 작아지면 터널을 나선 것
// item.tunnel = 터널 길이(m), item.halfWidth = 터널 반폭
const SHOW_MS = 5500
const COOLDOWN_MS = 60000
// 세로쓰기는 오른쪽 줄부터 읽음: 첫 줄 = 오른쪽, 둘째 줄 = 왼쪽 (' ' = 반 칸 띄움)
const TITLE_LINES = [
  ['터', '널', ' ', '너', '머', '엔'],
  ['등', '불', '의', ' ', '마', '을'],
]

export function JmEntryTitle({ item }) {
  const len = item?.tunnel ?? 18
  const hw = item?.halfWidth ?? 4
  const anchor = useRef(null)
  const player = useRef(null)
  const lookupAt = useRef(0)
  const wasInside = useRef(false)
  const lastShown = useRef(-Infinity)
  const tmp = useRef(new THREE.Vector3())
  const [inside, setInside] = useState(false)
  const [shownAt, setShownAt] = useState(0)
  const scene = useThree((s) => s.scene)
  const root = useRef(null)

  // 화면 위 겹침은 3D 안이 아니라 문서에 직접 붙임 (drei Html은 이 소품 칸에서 붙지 않았음)
  useEffect(() => {
    const el = document.createElement('div')
    el.className = 'jm-et-host'
    document.body.appendChild(el)
    root.current = createRoot(el)
    return () => {
      const r = root.current
      root.current = null
      setTimeout(() => {
        r?.unmount()
        el.remove()
      })
    }
  }, [])
  // 개발 중 확인용: 브라우저 콘솔에서 window.__jmEntryTitle() 로 바로 띄움 (배포 빌드엔 없음)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__jmEntryTitle = () => setShownAt(performance.now())
    return () => {
      delete window.__jmEntryTitle
    }
  }, [])
  useEffect(() => {
    root.current?.render(<Overlay inside={inside} shownAt={shownAt} />)
  }, [inside, shownAt])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!player.current?.parent && t - lookupAt.current > 1) {
      lookupAt.current = t
      player.current = findPlayer(scene)
    }
    if (!player.current?.parent || !anchor.current) return
    player.current.getWorldPosition(tmp.current)
    anchor.current.worldToLocal(tmp.current)
    const { x, z } = tmp.current
    const inTunnel = Math.abs(x) < hw && z > 0 && z < len
    if (inTunnel !== wasInside.current) {
      // 터널 안 → 출구 밖(z < 0)으로 나설 때만 제목
      if (!inTunnel && z <= 0 && Math.abs(x) < hw + 2) {
        const now = performance.now()
        if (now - lastShown.current > COOLDOWN_MS) {
          lastShown.current = now
          setShownAt(now)
          playWind()
        }
      }
      wasInside.current = inTunnel
      setInside(inTunnel)
    }
  })

  useEffect(() => {
    if (!shownAt) return
    const id = setTimeout(() => setShownAt(0), SHOW_MS)
    return () => clearTimeout(id)
  }, [shownAt])

  return <group ref={anchor} />
}

function Overlay({ inside, shownAt }) {
  return (
    <>
      <style>{CSS}</style>
      <div className="jm-et">
        <div className={`jm-et__dark${inside ? ' is-on' : ''}`} />
        {shownAt ? (
          <div key={shownAt}>
            <div className="jm-et__flash" />
            <div className="jm-et__title" role="status" aria-live="polite" aria-label="터널 너머엔 등불의 마을, 유아카리 마을에 오신 걸 환영해요">
              <div className="jm-et__main">
                <Line chars={TITLE_LINES[0]} start={0} />
              </div>
              <div className="jm-et__col">
                <div className="jm-et__main">
                  <Line chars={TITLE_LINES[1]} start={TITLE_LINES[0].length} />
                </div>
                <div className="jm-et__sub">유아카리 마을</div>
                <div className="jm-et__seal">등</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

// 한 줄의 글자들 (글자마다 조금씩 늦게 써짐, ' '는 반 칸 빈자리)
function Line({ chars, start }) {
  return chars.map((ch, i) =>
    ch === ' ' ? (
      <span key={i} className="jm-et__gap" />
    ) : (
      <span key={i} style={{ animationDelay: `${0.35 + (start + i) * 0.2}s` }}>
        {ch}
      </span>
    ),
  )
}

// 바람 소리: 흰 소음을 대역 통과 필터로 걸러 3초 동안 밀려왔다 빠지게 (오디오 파일·외부 요청 없음)
function playWind() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const dur = 3.2
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(320, ctx.currentTime)
    bp.frequency.linearRampToValueAtTime(900, ctx.currentTime + 1.2)
    bp.frequency.linearRampToValueAtTime(420, ctx.currentTime + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.9)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur)
    src.connect(bp).connect(gain).connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + dur)
    setTimeout(() => ctx.close(), (dur + 0.3) * 1000)
  } catch {
    // 소리를 못 내는 환경이면 조용히 넘어감
  }
}

const CSS = `
.jm-et { position: fixed; inset: 0; z-index: 30; overflow: hidden; pointer-events: none; }
.jm-et__dark { position: absolute; inset: 0; opacity: 0; transition: opacity 1.4s ease;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(5,4,3,0.82) 100%); }
.jm-et__dark.is-on { opacity: 1; }
.jm-et__flash { position: absolute; inset: 0; background: #fff8e6; opacity: 0; animation: jm-et-flash 1.6s ease-out; }
.jm-et__title { position: absolute; left: 4%; top: 30%; display: flex; flex-direction: row-reverse; align-items: flex-start; gap: 6px;
  animation: jm-et-out 0.9s ease-in 4.6s forwards; }
.jm-et__main { writing-mode: vertical-rl; font-family: 'Noto Serif KR', 'Nanum Myeongjo', 'Batang', 'AppleMyungjo', serif; font-weight: 700;
  font-size: clamp(28px, 4.2vw, 52px); line-height: 1.05; color: #1f1a14; letter-spacing: 0.08em;
  text-shadow: 0 0 18px rgba(255,248,230,0.9), 0 0 4px rgba(255,248,230,0.9); }
.jm-et__main span { display: inline-block; opacity: 0; clip-path: inset(0 0 100% 0); filter: blur(2px);
  animation: jm-et-brush 0.55s cubic-bezier(.3,.7,.4,1) forwards; }
.jm-et__main .jm-et__gap { display: inline-block; height: 0.45em; animation: none; opacity: 0; }
.jm-et__col { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-top: 0.9em; }
.jm-et__sub { writing-mode: vertical-rl; font-family: 'Noto Serif KR', serif; font-size: 15px; letter-spacing: 0.35em; color: #3a2f24;
  text-shadow: 0 0 10px rgba(255,248,230,0.95); opacity: 0; animation: jm-et-fade 0.8s ease 2.6s forwards; }
.jm-et__seal { width: 30px; height: 30px; display: grid; place-items: center; border: 2px solid #b8352a; color: #b8352a; border-radius: 4px;
  font-family: 'Noto Serif KR', 'Batang', serif; font-size: 18px; background: rgba(255,248,230,0.7); opacity: 0; transform: scale(1.4);
  animation: jm-et-seal 0.35s ease-out 3s forwards; }
@keyframes jm-et-flash { 0% { opacity: 0.75 } 100% { opacity: 0 } }
@keyframes jm-et-brush { 0% { opacity: 1; clip-path: inset(0 0 100% 0); filter: blur(2px) } 100% { opacity: 1; clip-path: inset(0 0 0 0); filter: blur(0) } }
@keyframes jm-et-fade { to { opacity: 1 } }
@keyframes jm-et-seal { to { opacity: 1; transform: scale(1) } }
@keyframes jm-et-out { to { opacity: 0; transform: translateY(-8px) } }
@media (prefers-reduced-motion: reduce) {
  .jm-et__main span, .jm-et__sub, .jm-et__seal { animation-duration: 0.01s; animation-delay: 0s !important; }
  .jm-et__flash { display: none; }
}
`
