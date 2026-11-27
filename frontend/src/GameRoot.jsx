import { Component, Suspense, useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { USE_SERVER } from './api/session.js'
import { cachedCharacterIds, getPlayerCharacter } from './api/serverApi.js'
import { usePreload } from './components/auth/jm_preload.js'
import { LoginGate } from './components/auth/LoginPage.jsx'
import Scene from './game/Scene.jsx'
import { characters, useCharacterStore } from './game/Player/characterStore.js'
import { useUiStore } from './components/movieZone/uiStore.js'
import UiRoot from './components/movieZone/UiRoot.jsx'
import AdminLauncher from './components/admin/AdminLauncher.jsx'
import { AuditionInteraction, CheerInteraction, StudioInteraction } from './components/sg/SgInteractionUi.jsx' // main #122: 패널은 열 때만 받음
import KpopGuide from './components/sg/KpopGuide.jsx'
import KeyHints from './components/sg/KeyHints.jsx'
import ClockTowerMap from './components/sg/ClockTowerMap.jsx'
import KpopIntro from './components/sg/KpopIntro.jsx'

// 게임 화면 (#/): 3D 맵 + 게임 UI(대화창·스탬프북·쿠폰함 — 혜진, 스튜디오·응원·오디션·K-POP — 성근, 관리자 버튼 — 성근)
// 11/27 지민: App.jsx에 있던 목록을 그대로 옮김. 이 파일 하나를 App.jsx가 lazy로 불러서,
//   three.js·물리 엔진이 든 큰 묶음을 받는 동안 작은 첫 화면 묶음으로 로딩 화면부터 보여 줌 (components/auth/jm_preload.js)
// 게임 화면에 새 UI를 붙일 때는 여기에 추가 (App.jsx는 주소 나누기·로그인만)
// locked(11/27 지민): 로그인 전 — 맵만 보여 주고 캐릭터·게임 UI는 숨김 (그 위에 App.jsx가 로그인 창을 띄움)
//   로그인 직후에는 그 계정이 고른 캐릭터를 서버에서 알아내고 모델까지 받은 뒤에 풀어 줌
//   (안 기다리면 기본 캐릭터가 먼저 섰다가 → 임시 모양 → 고른 캐릭터로 바뀌어서 여러 명이 떨며 나타나는 것처럼 보였음 — 11/27 지민 발견)
export default function GameRoot({ locked = false }) {
  // 로그인 창 단계(로딩이 걷힌 뒤)에 저장된 캐릭터 모델 미리 받기 — 맵 로딩과 겹치지 않게 로딩이 끝난 다음에
  const loadingDone = usePreload((st) => st.loadingDone)
  usePrefetchCachedModels(locked && loadingDone)
  const { ready, warm } = useCharacterReady(!locked)
  // 로그인 직후 "입장하는 중…" 카드가 먼저 그려진 다음에 캐릭터를 세움 (같이 하면 무거운 작업에 묶여 카드가 늦게 보임)
  const painted = useAfterTwoFrames(!locked)
  const waiting = locked || !ready || !painted
  const entered = useEntered(locked, waiting)
  // 한 번 들어온 뒤에는 다시 잠그지 않음 — 설정창에서 캐릭터를 바꿔도 그 자리에서 모델만 바뀜
  //   (잠그면 캐릭터가 출발점으로 돌아가고 열린 창이 닫히고 멀티 접속이 끊겼다 다시 붙었음 — 11/27 리뷰)
  const hold = locked || (!entered && waiting)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {warm}
      <Scene locked={hold} />
      {!hold && <GameUi />}
      {/* 로그인 직후~첫 화면까지 "입장하는 중…" (App.jsx의 로그인 창과 같은 카드). 여기서 직접 띄우고 걷음 */}
      {!locked && !entered && <LoginGate entering />}
    </div>
  )
}

// [11/27] 캐릭터가 서고 첫 화면을 다 그린 뒤(두 프레임 뒤) "입장하는 중…" 카드를 걷음 (useEntered)
//   (캐릭터가 서면 카메라가 광장으로 내려오면서 근처 건물 세부·셰이더를 만드느라 1~2초 화면이 멈춤 — 배포 빌드 측정.
//    멈춘 화면 대신 카드가 보이게. 프레임이 멈춰 있는 동안엔 requestAnimationFrame도 안 와서 멈춤이 끝난 뒤에 걷힘)
function useAfterTwoFrames(on) {
  const [done, setDone] = useState(on)
  useEffect(() => {
    if (!on) return setDone(false)
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setDone(true))
    })
    return () => cancelAnimationFrame(id)
  }, [on])
  return on && done
}

/** 입장 끝났나: 로그인 직후 false → 캐릭터가 서고(hold 풀림) 두 프레임 뒤 true. 로그아웃하면 다시 false
 *  처음부터 로그인돼 있던 경우(로딩 화면이 가림)는 처음부터 true */
function useEntered(locked, hold) {
  const [entered, setEntered] = useState(!locked)
  useEffect(() => {
    if (locked) setEntered(false)
  }, [locked])
  useEffect(() => {
    if (locked || hold || entered) return undefined
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [locked, hold, entered])
  return entered
}

const GIVE_UP_MS = 12_000

/** 로그인한 계정의 캐릭터 정보 + 모델(GLB)이 준비됐는지 { ready, warm(모델 미리 받기 — 화면에 붙일 것) }. active가 false면(로그인 전) 기다리지 않음 */
function useCharacterReady(active) {
  const userId = useUiStore((s) => s.userId)
  const known = useCharacterStore((s) => Boolean(s.byUser[userId] || s.errors[userId]))
  const model = useCharacterStore((s) => (s.byUser[userId] ?? characters[0]).model)
  const [loadedModel, setLoadedModel] = useState(null)
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    if (!active || !userId) return undefined
    if (USE_SERVER && applyCachedCharacter(userId)) return undefined
    useCharacterStore.getState().load(userId)
    // 서버 답이 끝내 안 오면 "입장하는 중…"에 갇히지 않게: 기다리다 기본 캐릭터로 입장 (답이 늦게 오면 그때 바뀜)
    setGaveUp(false)
    const id = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(id)
  }, [active, userId])

  if (!active) return { ready: true, warm: null }
  if (!known && !gaveUp) return { ready: false, warm: null }
  if (loadedModel === model) return { ready: true, warm: null }
  return { ready: false, warm: <ModelWarm key={model} model={model} onReady={setLoadedModel} /> }
}

// [11/27] 로그인 직후 "고른 캐릭터" 서버 답이 3초 넘게 걸렸음 → 이 브라우저에 저장된 값이 있으면 그걸로 바로 세우고,
//   서버 값은 뒤에서 확인해서 다르면(다른 기기에서 바꾼 경우) 그때 바꿈. 저장된 값이 없으면(이 기기 첫 로그인) 원래대로 기다림
function applyCachedCharacter(userId) {
  const store = useCharacterStore
  if (store.getState().byUser[userId]) return true
  const cached = characters.find((c) => c.id === cachedCharacterIds()[userId])
  if (!cached) return false
  const put = (character) => store.setState((st) => ({ byUser: { ...st.byUser, [userId]: character } }))
  put(cached)
  getPlayerCharacter({ userId })
    .then(({ character }) => {
      // 그사이 설정창에서 새로 골랐으면(byUser가 바뀜) 늦게 온 서버 값으로 덮지 않음
      if (character && store.getState().byUser[userId] === cached && cached.id !== character.id) put(character)
    })
    .catch(() => {}) // 확인 실패 → 저장된 값 그대로
  return true
}

// 로그인 창이 떠 있는 동안: 이 브라우저에 저장된 캐릭터 모델을 미리 받아 둠 → 로그인 뒤 모델 받기도 기다리지 않음
function usePrefetchCachedModels(active) {
  useEffect(() => {
    if (!active || !USE_SERVER) return
    const ids = new Set(Object.values(cachedCharacterIds()))
    for (const c of characters) if (ids.has(c.id)) useGLTF.preload(import.meta.env.BASE_URL + c.model)
  }, [active])
}

// 고른 캐릭터 모델을 drei 캐시에 미리 올려 둠 (화면엔 안 그림) → 캐릭터가 나타날 때 임시 모양 없이 바로 그 모델
//   받기 시작은 effect에서 (렌더 중에 시작하면 로딩 진행률(useProgress)이 렌더 도중 바뀌어 React 경고가 났음)
function ModelWarm({ model, onReady }) {
  const [started, setStarted] = useState(false)
  useEffect(() => {
    useGLTF.preload(import.meta.env.BASE_URL + model)
    setStarted(true)
  }, [model])
  if (!started) return null
  return (
    <WarmErrorBoundary onError={() => onReady(model)}>
      <Suspense fallback={null}>
        <Warmed model={model} onReady={onReady} />
      </Suspense>
    </WarmErrorBoundary>
  )
}
// 모델 파일을 못 받아도(404·네트워크) 게임 전체가 하얗게 꺼지지 않게: 미리 받기만 포기하고 입장
//   (실제 캐릭터는 CharacterModel.jsx의 자체 오류 처리로 대체 모양이 나옴)
class WarmErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.error('[GameRoot] 캐릭터 모델 미리 받기 실패', error)
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
function Warmed({ model, onReady }) {
  useGLTF(import.meta.env.BASE_URL + model)
  useEffect(() => onReady(model), [model, onReady])
  return null
}

function GameUi() {
  return (
    <>
      <UiRoot />
      <StudioInteraction />
      <AdminLauncher />
      <CheerInteraction />
      <AuditionInteraction />
      <KpopGuide />
      <KeyHints />
      <ClockTowerMap />
      <KpopIntro />
    </>
  )
}
