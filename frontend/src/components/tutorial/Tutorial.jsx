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
    text: (touch) => `광장 가운데 분홍 빛기둥 아래 **루미**에게 가서 ${touch ? '**E 버튼**을' : '**E 키**를'} 눌러 보세요`,
  },
  talk: {
    num: 2,
    text: () => '루미에게 다시 말을 걸어 **예시 버튼**을 하나 눌러 보세요. 코스를 골라 줘요',
  },
  walk: {
    num: 3,
    text: (touch) => `분홍 빛기둥을 따라가서 촬영지 바닥 원 안에서 ${touch ? '**E 버튼**' : '**E**'} → **스탬프 찍기**!`,
  },
  done: {
    num: 3,
    text: () => '완료! 🎉 첫 스탬프를 찍었어요. 이제 자유롭게 골목을 걸어 보세요',
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
    <div className={`tut ui-interactive${hasCourse ? ' tut--below-hud' : ''}${touch ? ' tut--touch' : ''}${step === 'done' ? ' tut--done' : ''}`} role="status" aria-live="polite">
      <span className="tut__lumi" aria-hidden="true">
        🧚
      </span>
      <div className="tut__body">
        <span className="tut__step">
          처음 오셨군요! 루미의 안내 {info.num}/3
        </span>
        <p className="tut__text">
          {rich(info.text(touch))}
          {dist && <span className="tut__dist">루미까지 {dist}</span>}
        </p>
      </div>
      {step !== 'done' && (
        <button type="button" className="tut__skip" onClick={(e) => (e.currentTarget.blur(), skip())}>
          건너뛰기
        </button>
      )}
    </div>
  )
}
