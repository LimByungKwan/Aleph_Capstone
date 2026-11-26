// (담당: 병관) 달빛 와인바 테라스에서 혼자 즐기는 3잔 테이스팅과 개인 최고 기록
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { create } from 'zustand'
import { useGameStore } from '../../../store/gameStore.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { GEO, mat, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'
import { useDateMission } from './bk_dateMission.js'
import { readWineBest, saveWineBest, WINE_MISSION_ID, WINE_ROUND_COUNT as ROUND_COUNT, wineTastingPosition } from './bk_wineTastingData.js'

export { WINE_BAR_ID } from './bk_wineTastingData.js'
const PANEL = 'bk_wine_tasting'
const useSpot = create(() => ({ near: false }))
export const useWineTastingNear = () => useSpot((state) => state.near)
const markerMaterial = mat('#784966', { emissive: '#67405c', emissiveIntensity: 0.32 })

const MENU = [
  { name: '보랏빛 포도', scent: '알알이 익은 보라색 과일의 향', finish: '껍질처럼 살짝 떫은 끝맛' },
  { name: '홍차 베리', scent: '작고 붉은 열매와 갓 우린 차의 향', finish: '새콤함 뒤에 은은한 찻잎 맛' },
  { name: '청사과 스파클', scent: '갓 자른 초록 과일의 풋풋한 향', finish: '톡 쏘는 탄산과 산뜻한 신맛' },
  { name: '꿀배 블렌드', scent: '과수원의 달큰한 향과 꽃향기', finish: '꿀처럼 부드럽고 길게 남는 단맛' },
  { name: '자두 시나몬', scent: '과즙 많은 붉은 과일과 달큰한 나무 향', finish: '새콤한 맛 뒤에 따뜻한 향신료' },
  { name: '귤꽃 소다', scent: '상큼한 껍질과 흰 꽃 향', finish: '잔잔한 탄산과 쌉싸름한 끝맛' },
]

function shuffle(items) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function makeFlight() {
  return shuffle(MENU).slice(0, ROUND_COUNT).map((drink) => ({
    drink,
    choices: shuffle([drink, ...shuffle(MENU.filter((choice) => choice !== drink)).slice(0, 2)]),
  }))
}

export function WineTastingSpot({ item }) {
  const scene = useThree((state) => state.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const lastCheck = useRef(-Infinity)
  const position = useMemo(() => new Vector3(), [])
  const sign = useMemo(() => texMat(getSignTexture('달빛 테이스팅', '#402942', '#ffe1ae', 4)), [])

  useEffect(() => () => useSpot.setState({ near: false }), [])
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastCheck.current < 0.1 || !anchor.current) return
    lastCheck.current = clock.elapsedTime
    if (!player.current?.parent) player.current = scene.getObjectByName('player') ?? null
    let near = false
    if (player.current) {
      anchor.current.worldToLocal(player.current.getWorldPosition(position))
      near = position.y > -0.1 && position.y < 2.5 && Math.hypot(position.x, position.z) <= 1.45
    }
    if (near !== useSpot.getState().near) useSpot.setState({ near })
  })

  return (
    <group ref={anchor} position={wineTastingPosition(item)} userData={{ noShadow: true }}>
      <mesh geometry={GEO.cyl48} material={markerMaterial} position={[0, 0.006, 0]} scale={[0.57, 0.022, 0.57]} />
      <mesh geometry={GEO.plane} material={sign} position={[0, 1.48, -2.75]} scale={[1.46, 0.37, 1]} />
    </group>
  )
}

export function openWineTasting() {
  const game = useGameStore.getState()
  if (!useSpot.getState().near || game.openPanel || game.inputLocked) return false
  useDateMission.getState().close()
  game.open({ type: PANEL })
  return true
}

function closeTasting() {
  const game = useGameStore.getState()
  if (game.openPanel?.type === PANEL) game.close()
}

export function WineTastingHud({ enabled }) {
  const near = useWineTastingNear()
  const panel = useGameStore((state) => state.openPanel?.type)
  const userId = useUiStore((state) => state.userId)

  useEffect(() => {
    if (!enabled || !near) closeTasting()
  }, [enabled, near])

  if (!enabled || !near || panel !== PANEL) return null
  return <TastingDialog key={userId} userId={userId} />
}

function TastingDialog({ userId }) {
  const dialog = useRef(null)
  const [flight, setFlight] = useState(makeFlight)
  const [answers, setAnswers] = useState([])
  const [reveal, setReveal] = useState(false)
  const [best, setBest] = useState(() => readWineBest(userId) ?? 0)
  const stamped = useDateMission((state) => Boolean(state.saved.accounts[userId]?.stamps?.[WINE_MISSION_ID]))
  const round = answers.length - Number(reveal)
  const current = flight[round]
  const score = answers.filter(Boolean).length

  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])

  const answer = (choice) => {
    if (reveal) return
    const correct = choice === current.drink
    if (answers.length + 1 === ROUND_COUNT) {
      const record = Math.max(best, readWineBest(userId) ?? 0, score + Number(correct))
      setBest(record)
      saveWineBest(userId, record)
      useDateMission.getState().markDone(WINE_MISSION_ID)
    }
    setAnswers([...answers, correct])
    setReveal(true)
  }
  const retry = () => {
    setFlight(makeFlight())
    setAnswers([])
    setReveal(false)
  }
  const viewMission = () => {
    closeTasting()
    useDateMission.getState().openCard(WINE_MISSION_ID)
  }

  return (
    <dialog className="special-dialog wine-tasting ui-interactive" ref={dialog} aria-labelledby="wine-title"
      onCancel={(event) => { event.preventDefault(); closeTasting() }} onKeyDown={(event) => event.stopPropagation()}>
      <header className="special-dialog__head">
        <div><span className="special-tag">달빛 와인바 · 1인 체험</span><h2 id="wine-title">달빛 테이스팅</h2></div>
        <button type="button" className="ui-btn" aria-label="닫기" onClick={closeTasting}>×</button>
      </header>
      <div className="special-dialog__body">
        {current ? (
          <>
            <div className="wine-tasting__round"><span>시음 {round + 1}/{ROUND_COUNT}</span><span>최고 {best}/{ROUND_COUNT}</span></div>
            <p>무알코올 시음 메모를 읽고 어울리는 음료를 골라요.</p>
            <dl className="wine-tasting__notes">
              <dt>향</dt><dd>{current.drink.scent}</dd>
              <dt>끝맛</dt><dd>{current.drink.finish}</dd>
            </dl>
            {reveal ? (
              <>
                <p role="status" className="wine-tasting__feedback">{answers.at(-1) ? '맞혔어요!' : '이번 잔의 이름은'} <strong>{current.drink.name}</strong></p>
                <button type="button" className="ui-btn wine-tasting__primary" onClick={() => setReveal(false)}>{answers.length === ROUND_COUNT ? '기록 보기' : '다음 잔'}</button>
              </>
            ) : (
              <div className="wine-tasting__choices" aria-label="음료 선택">
                {current.choices.map((choice) => <button key={choice.name} type="button" className="ui-btn" onClick={() => answer(choice)}>{choice.name}</button>)}
              </div>
            )}
          </>
        ) : (
          <div className="wine-tasting__result">
            <h3>{score === ROUND_COUNT ? '세 잔의 풍미를 모두 맞혔어요!' : '오늘의 테이스팅을 마쳤어요'}</h3>
            <p>이번 기록 <strong>{score}/{ROUND_COUNT}</strong> · 최고 <strong>{best}/{ROUND_COUNT}</strong></p>
            <p>✓ 데이트 체험 완료 · {stamped ? '스탬프를 이미 받았어요.' : '스탬프를 받을 수 있어요.'}</p>
            <div className="special-actions">
              <button type="button" className="ui-btn wine-tasting__primary" onClick={viewMission}>{stamped ? '미션 안내 보기' : '스탬프 받으러 가기'}</button>
              <button type="button" className="ui-btn" onClick={retry}>새로운 조합으로 다시 하기</button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}
