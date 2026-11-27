import { useEffect, useRef, useState } from 'react'
import { startServerWake, usePreload } from './jm_preload.js'
import '../loading/loading-screen.css'
import './auth.css'

// [지민] 첫 접속 화면 두 가지 (11/27) — 흐름은 jm_preload.js 맨 위 주석
//   MapLoadingLook: 게임 코드를 받는 동안. 병관님 로딩 화면(components/loading/LoadingScreen.jsx)과 똑같은 모양이라
//                   코드가 다 오면 병관님 화면이 같은 자리에서 이어 감 (진행 막대 5%에서 시작하는 것까지 같게)
//   GateOverlay:    로딩이 끝난 뒤 맵 위에 뜨는 로그인 창 (읽기 쉬운 보통 카드 + 서버 준비 상태)
//   병관님 파일은 CSS(.ld*)만 가져다 씀. LoadingScreen.jsx를 import하면 three.js 쪽(drei)이 첫 화면 묶음에 딸려 와서
//   팁·구역 목록은 아래에 복사해 둠 (바뀌면 LoadingScreen.jsx TIPS·ZONES와 맞추기)
const TIPS = [
  '루미에게 "배고파", "심심해"처럼 기분을 말해 보세요. 딱 맞는 코스를 골라 줘요.',
  '촬영지 바닥의 원 안에서 E를 누르면 스탬프를 찍을 수 있어요.',
  '스탬프를 모으면 같은 작품과 이어진 가게의 쿠폰이 열려요.',
  '데이트 코스 구역 별빛 전망대에 오르면 골목 전체가 한눈에 보여요.',
  '오른쪽 아래 미니맵에 다음 목적지가 분홍 점으로 표시돼요.',
  '휴대폰에서는 왼쪽 조이스틱으로 걷고, 화면을 끌어 둘러볼 수 있어요.',
]
const ZONES = [
  { name: '애니메이션', color: '#7cc8ff' },
  { name: '데이트 코스', color: '#ff8fb8' },
  { name: '영화·드라마', color: '#ffa45c' },
  { name: 'K-POP', color: '#b18cff' },
]
const FIRST_PERCENT = 5 // 병관님 화면이 파일 목록을 받기 전 보여 주는 값과 같게

function useTip() {
  const tip = usePreload((s) => s.tip)
  useEffect(() => {
    if (usePreload.getState().tip == null) usePreload.setState({ tip: Math.floor(Math.random() * TIPS.length) })
    const id = setInterval(() => usePreload.setState((st) => ({ tip: ((st.tip ?? 0) + 1) % TIPS.length })), 3200)
    return () => clearInterval(id)
  }, [])
  return tip ?? 0
}

function Pins() {
  return (
    <div className="ld__pins" aria-hidden="true">
      {ZONES.map((z, i) => (
        <span key={z.name} className="ld__pin" style={{ '--c': z.color, '--d': `${i * 0.18}s` }} />
      ))}
    </div>
  )
}

function Title() {
  return (
    <>
      <h1 className="ld__title">
        Scene<span>Walk</span>
      </h1>
      <p className="ld__sub">덕질 성지를 걷는 3D 골목</p>
    </>
  )
}

/** 게임 코드를 받는 동안 (App.jsx Suspense 자리) — 병관님 로딩 화면과 같은 모양 */
export function MapLoadingLook() {
  const tip = useTip()
  useEffect(() => {
    startServerWake()
    usePreload.setState({ fallbackShown: true })
  }, [])
  return (
    <div className="ld" role="status" aria-live="polite" aria-label="SceneWalk 불러오는 중">
      <div className="ld__sky" aria-hidden="true">
        <span className="ld__cloud ld__cloud--1" />
        <span className="ld__cloud ld__cloud--2" />
        <span className="ld__cloud ld__cloud--3" />
      </div>
      <div className="ld__card">
        <Pins />
        <Title />
        <div className="ld__bar" aria-hidden="true">
          <div className="ld__fill" style={{ width: `${FIRST_PERCENT}%` }} />
          <span className="ld__walker" style={{ left: `${FIRST_PERCENT}%` }}>
            🚶
          </span>
        </div>
        <div className="ld__meta">
          <span>골목 지도를 받는 중…</span>
          <span className="ld__pct">{FIRST_PERCENT}%</span>
        </div>
        <ul className="ld__zones" aria-hidden="true">
          {ZONES.map((z) => (
            <li key={z.name} style={{ '--c': z.color }}>
              {z.name}
            </li>
          ))}
        </ul>
        <p className="ld__tip" key={tip}>
          <b>루미의 팁</b> {TIPS[tip]}
        </p>
      </div>
    </div>
  )
}

/**
 * 로딩이 끝난 뒤 맵 위 로그인 창 — 뒤로 캐릭터 없는 맵 전체가 보임
 * 로딩이 끝난 뒤에 뜨므로 로딩 화면 요소는 없이, 게임 UI와 같은 색(종이색·분홍→테라코타)·글꼴의 보통 로그인 카드 (11/27 지민)
 * 오른쪽 위 작은 표시: 서버 깨우는 중 → 깨어나면 "✓ 준비 완료"(로그인 버튼과 같은 분홍→테라코타)로 톡 바뀜
 */
export function GateOverlay({ children, entering = false }) {
  const server = usePreload((s) => s.server)
  const loadingDone = usePreload((s) => s.loadingDone)
  const ready = server === 'ready' || server === 'off'
  const wasReady = useRef(ready)
  const [cheer, setCheer] = useState(false)

  useEffect(() => {
    startServerWake()
  }, [])

  // 로딩 화면이 걷히면: 이메일 칸에 커서 + (그때 이미 준비돼 있으면) 준비 완료 연출
  //   이미 다른 칸에 입력 중이면 커서를 빼앗지 않음
  useEffect(() => {
    if (!loadingDone) return
    if (wasReady.current) setCheer(true)
    const active = document.activeElement
    if (active && active !== document.body) return
    document.getElementById('auth-email')?.focus()
  }, [loadingDone])

  // 로그인 창이 보이는 동안 서버가 깨어나면 그때 연출
  useEffect(() => {
    if (ready && !wasReady.current && usePreload.getState().loadingDone) setCheer(true)
    wasReady.current = ready
  }, [ready])

  // 창 안의 키 입력은 여기서 멈춤 → 뒤의 맵 카메라 조작(방향키 등)으로 새지 않음
  const stop = (event) => event.stopPropagation()

  return (
    <div className={`jm-gate${ready ? ' is-ready' : ''}`} onKeyDown={stop} onKeyUp={stop}>
      <main className="jm-gate__card" aria-labelledby="auth-heading">
        {/* 로딩이 끝난 뒤라 로딩 화면 요소(핀·큰 제목)는 없음. 색·글꼴만 게임 UI와 같게 */}
        <div className="jm-gate__top">
          <span className="jm-gate__brand">
            Scene<span>Walk</span>
          </span>
          <span className={`jm-gate__status${ready ? ' is-ready' : ''}${cheer ? ' is-cheer' : ''}`} role="status" key={cheer ? 'cheer' : 'calm'}>
            {ready ? (
              <>
                <span className="jm-gate__check" aria-hidden="true">
                  ✓
                </span>
                준비 완료
              </>
            ) : (
              <>
                <span className="jm-gate__spinner" aria-hidden="true" />
                {server === 'slow' ? '서버가 늦게 깨어나는 중' : '서버 깨우는 중'}
              </>
            )}
          </span>
        </div>
        {entering ? (
          <div className="jm-gate__entering" role="status">
            <span className="jm-gate__spinner jm-gate__spinner--big" aria-hidden="true" />
            <p className="auth-title" id="auth-heading">
              입장하는 중…
            </p>
            <p className="ui-sub">캐릭터와 골목을 준비하고 있어요. 곧 시작해요.</p>
          </div>
        ) : (
          children
        )}
        {!ready && !entering && <p className="jm-gate__note">먼저 입력해 두셔도 돼요. 서버가 깨어나면 이어서 로그인돼요.</p>}
      </main>
    </div>
  )
}
