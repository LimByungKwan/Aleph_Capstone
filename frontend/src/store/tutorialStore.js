import { create } from 'zustand'
import places from '@shared/places.json'
import { useGameStore } from './gameStore.js'
import { useCourseStore } from './courseStore.js'
import { useUiStore } from '../components/movieZone/uiStore.js'

// 처음 온 사람 튜토리얼 (담당: 병관) — 화면: components/tutorial/Tutorial.jsx
// step: 'go'(루미에게 가기) → 'talk'(코스 받기) → 'walk'(첫 스탬프) → 'done'
//       'off' = 끝났거나 건너뜀 (localStorage에 기억 → 다시 안 나옴)
const KEY = 'scenewalk.tutorial'
const LUMI = places.find((p) => p.type === 'npc')

function readSaved() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
function save(value) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // 저장이 막힌 브라우저면 이번 접속에서만 기억
  }
}

export const useTutorial = create((set, get) => ({
  step: readSaved() === 'off' ? 'off' : 'go',
  next: (step) => {
    if (get().step === 'off') return
    set({ step })
    if (step === 'done') {
      save('off')
      setTimeout(() => get().step === 'done' && set({ step: 'off' }), 4500) // 축하 문구 잠깐 보여 주고 닫기
    }
  },
  skip: () => {
    save('off')
    set({ step: 'off' })
  },
  restart: () => {
    save('go')
    set({ step: 'go' })
  },
}))

// 1단계 목적지: 루미 (코스 표시 빛기둥·미니맵이 같이 씀)
// 항상 같은 객체를 돌려줘야 함 (zustand 선택 함수가 매번 새 객체를 주면 화면이 무한히 다시 그려짐)
const LUMI_TARGET = LUMI ? { placeId: LUMI.id, name: '루미에게 가기', zoneName: '중앙 광장', type: 'npc', position: LUMI.position } : null
export const tutorialTarget = (state) => (state.step === 'go' ? LUMI_TARGET : null)

// 게임 상태를 보고 단계를 알아서 넘김 (다른 팀원 파일을 고치지 않고 구독만 함)
useGameStore.subscribe((state, prev) => {
  const { step, next } = useTutorial.getState()
  const opened = state.openPanel && state.openPanel !== prev.openPanel
  if (step === 'go' && opened && state.openPanel.placeId === LUMI?.id) next('talk')
})
useCourseStore.subscribe((state, prev) => {
  const { step, next } = useTutorial.getState()
  if ((step === 'go' || step === 'talk') && state.course.length && state.course !== prev.course) next('walk')
})
// 스탬프를 찍으면 대화창(혜진님 DialogBox)이 bumpData()를 부름 → 촬영지·가게 창이 열려 있을 때 데이터가 바뀌면 완료
useUiStore.subscribe((state, prev) => {
  const { step, next } = useTutorial.getState()
  const panel = useGameStore.getState().openPanel
  if (step === 'walk' && state.dataVersion !== prev.dataVersion && panel && panel.type !== 'npc') next('done')
})
