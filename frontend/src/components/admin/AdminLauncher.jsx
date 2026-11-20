import { useEffect } from 'react'
import { logVisit } from '../../api/client.js'
import { currentUser, useUiStore } from '../movieZone/uiStore.js'

// [성근] 3D 맵 위에 붙는 관리자용 조각
// 1) 게임에 들어오면 접속 기록 (같은 사람은 하루 1번 — client.js가 중복을 거름)
// 2) 관리자 계정이면 오른쪽 위 HUD(혜진님 UiRoot) 아래에 📊 버튼
export default function AdminLauncher() {
  const userId = useUiStore((s) => s.userId)
  useEffect(() => {
    logVisit({ userId }).catch((error) => console.warn('[admin] 접속 기록 실패', error))
  }, [userId])

  if (currentUser(userId).role !== 'admin') return null
  return (
    <a className="ui-btn" href="#/admin" style={{ position: 'absolute', top: 60, right: 12, zIndex: 20 }}>
      📊 관리자 화면
    </a>
  )
}
