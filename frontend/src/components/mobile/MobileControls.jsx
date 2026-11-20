import { useEffect, useState } from 'react'
import { Joystick, useJoystickStore } from 'ecctrl/input'
import { useGameStore } from '../../store/gameStore.js'
import { useTouchInput } from '../../store/touchInput.js'
import './mobile-controls.css'

// 모바일(터치 화면) 조작 (담당: 병관)
// - 왼쪽 아래: 이동 조이스틱 (ecctrl 기본 조이스틱, Player.jsx가 useJoystickStore를 읽음)
// - 오른쪽 아래: [E] 상호작용 · [점프] · [달리기] 버튼
// - 화면을 한 손가락으로 끌면 카메라 회전, 두 손가락으로 벌리면 확대 (FollowCamera의 기본 터치)
// 키보드·마우스만 있는 PC에서는 보이지 않음

const touchQuery = '(pointer: coarse)'

export function useIsTouch() {
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(touchQuery).matches)
  useEffect(() => {
    const media = window.matchMedia?.(touchQuery)
    if (!media) return undefined
    const onChange = () => setTouch(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return touch
}

// 키보드 E와 똑같이 동작하게 (대화창·미니게임 모두 window의 KeyE를 듣고 있음)
function pressE() {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }))
}

export default function MobileControls() {
  const isTouch = useIsTouch()
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const nearby = useGameStore((s) => Boolean(s.nearbyPlaceId))
  const run = useTouchInput((s) => s.run)
  const setRun = useTouchInput((s) => s.setRun)
  const setJump = useTouchInput((s) => s.setJump)

  // 대화창이 열리면 조이스틱을 놓은 것으로 (손을 떼지 않아도 캐릭터가 멈추게)
  useEffect(() => {
    if (panelOpen) useJoystickStore.getState().resetJoystick()
  }, [panelOpen])

  if (!isTouch || panelOpen) return null

  const hold = (on) => ({
    onPointerDown: (e) => (e.preventDefault(), on(true)),
    onPointerUp: () => on(false),
    onPointerCancel: () => on(false),
    onPointerLeave: () => on(false),
  })

  return (
    <div className="mc">
      <div className="mc__stick ui-interactive">
        <Joystick
          joystickMaxRadius={46}
          joystickWrapperStyle={{ position: 'relative', width: 120, height: 120 }}
          joystickBaseStyle={{ background: 'rgba(255,253,248,0.35)', border: '2px solid rgba(255,255,255,0.8)' }}
          joystickKnobStyle={{ background: 'rgba(255,253,248,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
        />
      </div>
      <div className="mc__buttons ui-interactive">
        <button type="button" className={`mc__btn mc__btn--e${nearby ? ' is-ready' : ''}`} onPointerDown={(e) => (e.preventDefault(), pressE())} aria-label="상호작용 (E)">
          E
        </button>
        <button type="button" className="mc__btn" {...hold(setJump)} aria-label="점프">
          점프
        </button>
        <button type="button" className={`mc__btn${run ? ' is-on' : ''}`} onPointerDown={(e) => (e.preventDefault(), setRun(!run))} aria-label="달리기 켜고 끄기" aria-pressed={run}>
          달리기
        </button>
      </div>
    </div>
  )
}
