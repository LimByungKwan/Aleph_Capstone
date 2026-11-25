// [지민] 스탬프 진행률 훅 — 워프 해금 같은 "다 모으면" 기능용
//
//   const progress = useStampProgress()
//   progress.complete          // 전체 완주 (명소 + 가게)
//   progress.spots.complete    // 명소만 완주
//   progress.zones.JM.complete // 애니 구역 완주
//   progress.missing           // 아직 안 받은 장소 목록
//
// mock 모드·서버 모드(로그인) 둘 다 동작. 스탬프를 받으면(bumpData) 자동으로 다시 계산됨
import places from '@shared/places.json'
import { listMyStamps } from './client.js'
import { useAsync } from '../components/movieZone/common.jsx'
import { useUiStore } from '../components/movieZone/uiStore.js'
import { stampProgress } from './stampProgressCore.js'

export function useStampProgress() {
  const userId = useUiStore((s) => s.userId)
  const { data, loading, error } = useAsync(() => listMyStamps({ userId }), [userId])
  return { ...stampProgress(data?.stamps, places), loading, error }
}
