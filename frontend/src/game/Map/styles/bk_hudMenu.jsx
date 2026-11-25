// (담당: 병관) 게임 상단의 보조 기능을 한 메뉴에 모아 보여 줍니다.
import { useId } from 'react'
import '../../../components/tutorial/tutorial.css'

export function HudMore({ children }) {
  const id = useId()
  return (
    <>
      <button type="button" className="ui-btn bk-hud-more" popoverTarget={id}>
        더보기 <span aria-hidden="true">⌄</span>
      </button>
      <div id={id} className="bk-hud-menu ui-interactive" popover="auto" aria-label="더보기"
        onClick={(event) => {
          if (event.target.closest('button, a')) event.currentTarget.hidePopover()
        }}>
        {children}
      </div>
    </>
  )
}
