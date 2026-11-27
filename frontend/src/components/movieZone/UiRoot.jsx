import { lazy, Suspense, useEffect } from 'react'
import { MOCK_USERS } from '../../api/mockDb.js'
import { listMyCoupons, listMyStamps } from '../../api/client.js'
import { currentUser, useUiStore } from './uiStore.js'
import { USE_SERVER } from '../../api/session.js'
import { AccountBox } from '../auth/LoginPage.jsx'
import { Toasts, useAsync } from './common.jsx'
import DialogBox from './DialogBox.jsx'
import CinemaOverlay from './CinemaOverlay.jsx'
import EntranceWelcome from './EntranceWelcome.jsx'
import PalaceSeatPrompt from './PalaceSeatPrompt.jsx'
import RickshawMenu from './RickshawMenu.jsx'
import PalaceGuideMenu from './PalaceGuideMenu.jsx'
import CarDriveHint from './CarDriveHint.jsx'
import PalaceTour from './PalaceTour.jsx'
import SpecialAccess from './SpecialAccess.jsx'
import { selectTimePass, timePassCount, useSpecialAccess, useTimePass } from './specialAccessStore.js'
import { CourseHud } from '../course/LumiCourse.jsx'
import Minimap from '../minimap/Minimap.jsx'
import MobileControls from '../mobile/MobileControls.jsx'
import Tutorial from '../tutorial/Tutorial.jsx'
import BadgeBook, { BadgeButton } from '../badges/BadgeBook.jsx'
import { PhotoButton, PhotoPreview } from '../photo/PhotoButton.jsx'
import SoundDirector, { SoundToggle } from '../sound/SoundDirector.jsx'
import DateMission from '../dateCourse/DateMission.jsx' // [병관] 데이트 코스 미션 (시간 탐정과 같은 모양)
import { HudMore } from '../../game/Map/styles/bk_hudMenu.jsx'
import DateCourseIntro, { DateCourseReplay } from '../dateCourse/DateCourseIntro.jsx'
import { sceneForPlace } from './sceneData.js'
import { usePortalStore } from './portalStore.js'
import { useGameStore } from '../../store/gameStore.js'
import './ui.css'
import './ui-components.css'
import './cinema.css'
import './breakwater.css'

const StampBook = lazy(() => import('./StampBook.jsx'))
const CouponBox = lazy(() => import('./CouponBox.jsx'))
const BreakwaterScene = lazy(() => import('./BreakwaterScene.jsx'))

if (import.meta.env.DEV) window.__scenewalk = { game: useGameStore, ui: useUiStore, portal: usePortalStore }

export default function UiRoot() {
  const modal = useUiStore((s) => s.modal)
  const closeModal = useUiStore((s) => s.closeModal)
  const inCinema = usePortalStore((s) => Boolean(s.active) && s.dismissedId !== s.active?.id)
  const specialPanel = useSpecialAccess((s) => s.panel)
  const specialEra = useSpecialAccess((s) => s.era)

  return (
    <div className="ui-root">
      <CinemaOverlay />
      {!inCinema && <Hud />}
      {!inCinema && (USE_SERVER ? <AccountBox /> : <RoleSwitcher />)}
      {!inCinema && <CourseHud />}
      {!inCinema && <Minimap />}
      {!inCinema && <MobileControls />}
      {!inCinema && !specialEra && <Tutorial />}
      <SceneHint />
      {!inCinema && <RickshawMenu />}
      {!inCinema && <PalaceGuideMenu />}
      {!inCinema && <CarDriveHint />}
      {!inCinema && <PalaceSeatPrompt />}
      <PalaceTour enabled={!inCinema && !modal && !specialPanel} />
      <SpecialAccess enabled={!inCinema && !modal} />
      <DateMission enabled={!inCinema && !modal} />
      <DateCourseIntro enabled={!inCinema && !modal && !specialPanel && !specialEra} />
      <DialogBox />
      <BreakwaterModal open={modal === 'breakwater'} />
      <EntranceWelcome />
      <Suspense fallback={null}>
        {modal === 'stampbook' && <StampBook onClose={closeModal} />}
        {modal === 'coupons' && <CouponBox onClose={closeModal} />}
      </Suspense>
      {modal === 'badges' && <BadgeBook onClose={closeModal} />}
      <PhotoPreview />
      <SoundDirector />
      <Toasts />
    </div>
  )
}

function BreakwaterModal({ open }) {
  const openPanel = useGameStore((s) => s.openPanel)
  // ESC(InteractionKeys)로 패널이 닫히면 장면도 같이 닫기
  useEffect(() => {
    if (open && !openPanel) useUiStore.getState().closeModal()
  }, [open, openPanel])

  return open ? <Suspense fallback={null}><BreakwaterScene /></Suspense> : null
}

// "안으로 들어가는" 촬영지(방파제 등) 근처에 오면 아래에 뜨는 안내 칩
function SceneHint() {
  const nearbyPlaceId = useGameStore((s) => s.nearbyPlaceId)
  const openPanel = useGameStore((s) => s.openPanel)
  const scene = nearbyPlaceId ? sceneForPlace(nearbyPlaceId) : null
  if (!scene || openPanel) return null
  return (
    <div className="ui-scene-hint" role="status">
      <kbd>E</kbd> {scene.enterLabel}
    </div>
  )
}

function Hud() {
  const userId = useUiStore((s) => s.userId)
  const openModal = useUiStore((s) => s.openModal)
  const user = currentUser(userId)
  const stamps = useAsync(() => listMyStamps({ userId }), [userId])
  const coupons = useAsync(() => listMyCoupons({ userId }), [userId])
  const timePass = useTimePass((state) => selectTimePass(state,userId))
  const totalStamps = (stamps.data?.stamps.length ?? 0) + timePassCount(timePass)
  const usable = (coupons.data?.coupons.filter((c) => !c.usedAt).length ?? 0)
    + Number(Boolean(timePass.couponIssuedAt)) + Number(Boolean(timePass.legacyCouponIssuedAt))

  return (
    <nav className="ui-hud bk-hud ui-interactive" aria-label="내 메뉴">
      <button type="button" className="ui-btn" onClick={(e) => (e.currentTarget.blur(), openModal('stampbook'))}>
        📖 스탬프북 <span className="ui-count">{totalStamps}</span>
      </button>
      <PhotoButton />
      <HudMore>
        <DateCourseReplay />
        <button type="button" className="ui-btn" onClick={(e) => (e.currentTarget.blur(), openModal('coupons'))}>
          🎟 쿠폰함 {usable > 0 && <span className="ui-count">{usable}</span>}
        </button>
        <BadgeButton onOpen={() => openModal('badges')} />
        <SoundToggle />
        {user.role === 'owner' && <a className="ui-btn" href="#/owner">🧑‍🍳 사장님 화면</a>}
      </HudMore>
    </nav>
  )
}

function RoleSwitcher() {
  const userId = useUiStore((s) => s.userId)
  const setUser = useUiStore((s) => s.setUser)

  return (
    <label className="ui-role ui-interactive">
      <span>시연 계정</span>
      <select value={userId} onChange={(e) => (setUser(e.target.value), e.target.blur())}>
        {MOCK_USERS.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </label>
  )
}
