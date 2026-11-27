import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// 애니 구역 입장 컷신 「꺼진 등불」 30초 (11/26 지민 결정: 영상 파일 대신 게임 안 카메라로) — 담당: 지민
// 새 그림 없이 이미 지은 마을을 카메라가 날아다니며 찍음. 공용 FollowCamera.jsx는 고치지 않고,
// 망원경(bk_telescope)처럼 재생 중에만 매 프레임 카메라를 덮어씀. 끝나면 3인칭 카메라가 다시 캐릭터 뒤로.
// 언제 나오나: 입구 쪽에서 터널에 처음 들어설 때 한 번 (이 브라우저 기준, localStorage). ESC·Space·Enter·클릭으로 건너뛰기
// 끝나면 플레이어는 터널 안에 서 있고, 터널을 나서면 jm_entryTitle의 세로쓰기 제목이 이어서 뜸 (그래서 마지막 자막 없음)
// 「등불이 꺼짐」은 화면 전체 색 빼기(캔버스 CSS filter)로 표현. 좌표 = shared/places.json 명장면 위치(월드 좌표)
// 개발 중에만: 왼쪽 아래 「▶ 컷신 시험」 버튼, 콘솔 window.__jmIntro(), 다시 자동 재생 보려면 window.__jmIntroReset()

const SEEN_KEY = 'jm-intro-seen-v1'
const FADE = 0.35 // 컷 사이 암전(초)
const lerp = (a, b, k) => a + (b - a) * k
const clamp01 = (x) => Math.min(1, Math.max(0, x))
// 색 빼기 정도 g(0=원래 색, 1=거의 회색·어둡게) → 캔버스 filter
const greyFilter = (g) => (g <= 0.001 ? '' : `grayscale(${0.85 * g}) brightness(${1 - 0.45 * g}) contrast(${1 - 0.1 * g})`)

// black = 암전 화면에 가운데 자막. 나머지는 카메라가 from → to 로 움직이며 look 을 바라봄
// grey(t, sec) = 그 장면의 색 빼기 정도
const SHOTS = [
  { sec: 4.5, black: true, lines: ['어릴 적 보았던 장면들은', '사라지지 않고, 이 터널 너머에 남아 있다.'] },
  {
    // 마을 전경: 높이 떠서 온천장 쪽으로
    sec: 4.5,
    from: [0, 48, -112],
    to: [0, 36, -150],
    look: [0, 6, -205],
    lines: ['터널 너머, 등불의 마을.', '이야기를 기억하는 이가 올 때마다 등불이 켜졌다.'],
  },
  {
    // 명장면 ⑤ 붉은 다리: 옆으로 천천히 돌기
    sec: 4,
    from: [-11, 14, -208],
    to: [9, 13, -209],
    look: [0, 9, -221.5],
    lines: ['마을 곳곳엔 오래된 이야기가', '하나씩 잠들어 있었다.'],
  },
  {
    // 명장면 ③ 등나무 숲길: 다가가는 동안 색이 빠지고 어두워짐 (등불이 꺼짐)
    sec: 5,
    from: [37, 8.6, -181],
    to: [41, 7.6, -186],
    look: [46, 6, -192],
    grey: (t) => clamp01((t - 1.2) / 2.8),
    lines: ['찾아오는 발길이 끊기자', '등불도 하나둘 꺼져 갔다.'],
  },
  { sec: 3, black: true, lines: ['그리고 오늘,', '터널 저편에서 발소리가 들렸다.'] },
  {
    // 터널 안: 출구 빛 쪽으로 걸어 들어감 (발소리)
    sec: 5,
    from: [0, 2.2, -62],
    to: [0, 2.2, -71],
    look: [0, 2.4, -95],
    grey: () => 0.55,
    steps: true,
    lines: [],
  },
  {
    // 음식점 거리 입구, 눈높이: 회색으로 꺼진 거리에 색이 다시 돌아옴
    sec: 4,
    from: [0, 9, -144],
    to: [0, 8.8, -150],
    look: [0, 7, -200],
    grey: (t) => 1 - clamp01((t - 1.2) / 2),
    lines: [],
  },
]
const TOTAL = SHOTS.reduce((s, x) => s + x.sec, 0)
const SKIP_KEYS = new Set(['Escape', 'Space', 'Enter'])

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}
function writeSeen(v) {
  try {
    if (v) localStorage.setItem(SEEN_KEY, '1')
    else localStorage.removeItem(SEEN_KEY)
  } catch {
    /* 저장 못 하는 브라우저면 매번 처음처럼 */
  }
}

// anchor = jm_entryTitle 소품 자리(터널 뒤 출구 한가운데). 로컬 +z = 터널 쪽, len = 터널 길이, hw = 반폭
export function JmIntroCutscene({ anchor, len = 18, hw = 4 }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const play = useRef(null) // { t0 } 재생 중 / { hold } 개발용 고정
  const tmp = useRef({ p: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), l: new THREE.Vector3(), me: new THREE.Vector3() })
  const [state, setState] = useState({ on: false, shot: -1, key: 0 })
  const root = useRef(null)
  const fadeEl = useRef(null)
  const player = useRef(null)
  const lookupAt = useRef(0)
  const lastZ = useRef(null)
  const audio = useRef(null)
  const shotRef = useRef(-1) // 장면 바뀜 감지 (state는 한 프레임 늦을 수 있어서 따로)

  const stop = () => {
    play.current = null
    gl.domElement.style.filter = ''
    stopSteps(audio)
    setState((s) => ({ ...s, on: false, shot: -1 }))
  }
  const start = () => {
    writeSeen(true)
    play.current = { t0: performance.now() }
    shotRef.current = -1
    setState((s) => ({ on: true, shot: 0, key: s.key + 1 }))
  }

  // 화면 위 겹침(자막·위아래 검은 띠·암전)은 문서에 직접 붙임 (jm_entryTitle과 같은 방식)
  useEffect(() => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    root.current = createRoot(el)
    return () => {
      const r = root.current
      root.current = null
      gl.domElement.style.filter = ''
      stopSteps(audio)
      setTimeout(() => {
        r?.unmount()
        el.remove()
      })
    }
  }, [gl])

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__jmIntro = start
    window.__jmIntroReset = () => writeSeen(false)
    // 장면 캡처용: window.__jmShot([x,y,z], [lookX,lookY,lookZ]) 로 카메라 고정, window.__jmShot() 로 해제
    window.__jmShot = (pos, look) => {
      play.current = pos ? { hold: { pos, look } } : null
      document.body.classList.toggle('jm-it-playing', !!pos)
    }
    return () => {
      delete window.__jmIntro
      delete window.__jmIntroReset
      delete window.__jmShot
    }
  }, [])

  useEffect(() => {
    root.current?.render(<Overlay state={state} fadeRef={fadeEl} onStart={start} onSkip={stop} />)
  }, [state])

  // 재생 중: 걷기 키를 막고(캐릭터가 안 움직이게), 건너뛰기 키만 받음
  useEffect(() => {
    if (!state.on) return undefined
    document.body.classList.add('jm-it-playing')
    const block = (e) => {
      if (SKIP_KEYS.has(e.code) && e.type === 'keydown') stop()
      e.stopImmediatePropagation()
      e.preventDefault()
    }
    window.addEventListener('keydown', block, true)
    window.addEventListener('keyup', block, true)
    return () => {
      window.removeEventListener('keydown', block, true)
      window.removeEventListener('keyup', block, true)
      document.body.classList.remove('jm-it-playing')
    }
  }, [state.on])

  useFrame(({ clock }) => {
    const p = play.current
    // 재생 전: 입구 쪽(z ≥ len)에서 터널 안으로 들어서는 순간 처음 한 번만 시작
    if (!p) {
      const t = clock.elapsedTime
      if (!player.current?.parent && t - lookupAt.current > 1) {
        lookupAt.current = t
        player.current = scene.getObjectByName('player') ?? null
      }
      if (!player.current?.parent || !anchor?.current) return
      const me = tmp.current.me
      player.current.getWorldPosition(me)
      anchor.current.worldToLocal(me)
      const inTunnel = Math.abs(me.x) < hw && me.z > 0 && me.z < len
      if (inTunnel && lastZ.current !== null && lastZ.current >= len && !readSeen()) start()
      lastZ.current = me.z
      return
    }
    if (p.hold) {
      camera.position.fromArray(p.hold.pos)
      camera.lookAt(tmp.current.l.fromArray(p.hold.look))
      camera.updateMatrixWorld()
      return
    }
    const t = (performance.now() - p.t0) / 1000
    if (t >= TOTAL) {
      if (fadeEl.current) fadeEl.current.style.opacity = '0'
      stop()
      return
    }
    let acc = 0
    let i = 0
    while (i < SHOTS.length - 1 && t >= acc + SHOTS[i].sec) acc += SHOTS[i++].sec
    const shot = SHOTS[i]
    const local = t - acc
    if (i !== shotRef.current) {
      shotRef.current = i
      if (shot.steps) startSteps(audio, shot.sec)
      setState((s) => (s.on ? { ...s, shot: i } : s))
    }
    if (shot.black) {
      if (fadeEl.current) fadeEl.current.style.opacity = '1'
      return
    }
    const k = THREE.MathUtils.smootherstep(local / shot.sec, 0, 1)
    const v = tmp.current
    v.p.lerpVectors(v.a.fromArray(shot.from), v.b.fromArray(shot.to), k)
    camera.position.copy(v.p)
    camera.lookAt(v.l.fromArray(shot.look))
    camera.updateMatrixWorld()
    gl.domElement.style.filter = greyFilter(shot.grey ? shot.grey(local, shot.sec) : 0)
    // 컷 앞뒤로 짧게 어두워짐 (마지막 컷은 검게 끝나지 않고 그대로 게임으로 넘어감)
    const fadeIn = Math.max(0, 1 - local / FADE)
    const fadeOut = i === SHOTS.length - 1 ? 0 : Math.max(0, 1 - (shot.sec - local) / FADE)
    if (fadeEl.current) fadeEl.current.style.opacity = String(Math.min(1, Math.max(fadeIn, fadeOut)))
  })

  return null
}

// 발소리: 짧은 잡음을 저역 필터로 걸러 0.55초마다 (오디오 파일·외부 요청 없음)
function startSteps(audio, sec) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = audio.current ?? new Ctx()
    audio.current = ctx
    const len = Math.floor(ctx.sampleRate * 0.12)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
    const t0 = ctx.currentTime + 0.3
    for (let s = 0; s * 0.55 < sec - 0.6; s++) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 700 + (s % 2) * 120
      const g = ctx.createGain()
      g.gain.value = lerp(0.18, 0.45, Math.min(1, s / 6)) // 점점 가까워짐
      src.connect(f).connect(g).connect(ctx.destination)
      src.start(t0 + s * 0.55)
    }
  } catch {
    /* 소리 못 내는 환경이면 조용히 */
  }
}
function stopSteps(audio) {
  try {
    audio.current?.close()
  } catch {
    /* 이미 닫힘 */
  }
  audio.current = null
}

function Overlay({ state, fadeRef, onStart, onSkip }) {
  const shot = SHOTS[state.shot]
  return (
    <>
      <style>{CSS}</style>
      {import.meta.env.DEV && !state.on ? (
        <button type="button" className="jm-it__test" onClick={onStart}>
          ▶ 컷신 시험
        </button>
      ) : null}
      {state.on ? (
        <div className="jm-it" onClick={onSkip} role="presentation">
          <div className="jm-it__bar jm-it__bar--top" />
          <div className="jm-it__bar jm-it__bar--bottom" />
          <div ref={fadeRef} className="jm-it__fade" />
          {shot?.lines.length ? (
            <div key={`${state.key}-${state.shot}`} className={`jm-it__lines${shot.black ? ' is-center' : ''}`} role="status" aria-live="polite">
              {shot.lines.map((l, i) => (
                <div key={i} style={{ animationDelay: `${0.4 + i * 0.6}s` }}>
                  {l}
                </div>
              ))}
            </div>
          ) : null}
          <div className="jm-it__skip">ESC · 클릭으로 건너뛰기</div>
        </div>
      ) : null}
    </>
  )
}

const CSS = `
/* 공용 HUD(.ui-root)가 z-index 16777280이라 그보다 위에 두고, 재생 중엔 HUD·조작 안내를 숨김 */
.jm-it { position: fixed; inset: 0; z-index: 2147483000; cursor: pointer; }
body.jm-it-playing .ui-root, body.jm-it-playing .bk-game-help { visibility: hidden; }
/* 조작 키 안내(sg/KeyHints.jsx)는 클래스가 없어 인라인 스타일로 찾음 — 남의 파일이라 고치지 않음 */
body.jm-it-playing #root div[aria-hidden="true"][style*="z-index: 20"] { visibility: hidden; }
.jm-it__bar { position: absolute; left: 0; right: 0; height: 11vh; background: #000; }
.jm-it__bar--top { top: 0; }
.jm-it__bar--bottom { bottom: 0; }
.jm-it__fade { position: absolute; inset: 0; background: #000; opacity: 1; pointer-events: none; }
.jm-it__lines { position: absolute; left: 16px; right: 16px; bottom: calc(11vh + 28px); text-align: center;
  color: #f4ecdc; font-family: 'Noto Serif KR', 'Nanum Myeongjo', 'NanumMyeongjo', serif; font-size: clamp(15px, 2.1vw, 22px);
  line-height: 1.75; letter-spacing: .04em; text-shadow: 0 1px 6px rgba(0,0,0,.85); pointer-events: none; }
.jm-it__lines.is-center { bottom: auto; top: 50%; transform: translateY(-50%); }
.jm-it__lines > div { opacity: 0; animation: jm-it-line .8s ease-out forwards; }
@keyframes jm-it-line { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.jm-it__skip { position: absolute; right: 20px; bottom: calc(11vh - 30px); color: rgba(255,255,255,.55); font-size: 12px; pointer-events: none; }
.jm-it__test { position: fixed; left: 16px; bottom: 64px; z-index: 2147483000; padding: 8px 12px; border: 0; border-radius: 8px;
  background: rgba(20,20,30,.78); color: #fff; font-size: 13px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .jm-it__lines > div { animation: none; opacity: 1; } }
`
