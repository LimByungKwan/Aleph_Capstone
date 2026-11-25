import { useGameStore } from '../../store/gameStore.js'
import { useCourseStore } from '../../store/courseStore.js'
import { tutorialTarget, useTutorial } from '../../store/tutorialStore.js'
import { useLiveDistance } from '../course/LumiCourse.jsx'
import { useIsTouch } from '../mobile/MobileControls.jsx'
import './tutorial.css'

// 처음 온 사람 안내 띠 (담당: 병관)
// 단계는 store/tutorialStore.js가 게임 상태를 보고 알아서 넘김.
// 대화창이 열려 있을 땐 띠를 숨기고, 2단계 안내는 루미 대화창(LumiCourse) 안에 나옴

const STEPS = {
  go: {
    num: 1,
    title: '루미 만나기',
    text: (touch) => `광장 분홍빛 아래에서 ${touch ? '**E 버튼**을' : '**E**를'} 눌러 대화해요.`,
  },
  talk: {
    num: 2,
    title: '추천 코스 고르기',
    text: () => '루미에게 말을 걸어 **예시 버튼**을 골라요.',
  },
  walk: {
    num: 3,
    title: '첫 스탬프 찍기',
    text: (touch) => `촬영지 바닥 원 안에서 ${touch ? '**E 버튼**' : '**E**'}를 눌러 **스탬프**를 찍어요.`,
  },
  done: {
    num: 3,
    title: '첫 스탬프 획득',
    text: () => '이제 자유롭게 골목을 걸어 보세요.',
  },
}

// **굵게** 표시만 지원하는 아주 작은 변환
function rich(text) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))
}

export default function Tutorial() {
  const step = useTutorial((s) => s.step)
  const skip = useTutorial((s) => s.skip)
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const hasCourse = useCourseStore((s) => s.course.length > 0)
  const touch = useIsTouch()
  const info = STEPS[step]
  const lumi = useTutorial(tutorialTarget)
  const dist = useLiveDistance(lumi?.position) // 1단계: 루미까지 남은 거리

  if (!info || (panelOpen && step !== 'done')) return null

  return (
    <div className={`tut${hasCourse ? ' tut--below-hud' : ''}${step === 'done' ? ' tut--done' : ''}`}>
      <div className="tut__body">
        <div role="status">
          <div className="tut__heading">
            <span className="tut__step" aria-label={`루미 안내 ${info.num}단계 / 3단계`}>{info.num}/3</span>
            <strong>{info.title}</strong>
          </div>
          <p className="tut__text">{rich(info.text(touch))}</p>
        </div>
        {dist && <span className="tut__dist" aria-label={`루미까지 ${dist}`}>{dist}</span>}
      </div>
      {step !== 'done' && (
        <button type="button" className="tut__skip ui-interactive" onClick={(e) => (e.currentTarget.blur(), skip())}>
          건너뛰기
        </button>
      )}
    </div>
  )
}
