import cardData from '@shared/bk_tarot/tarot_cards.json'
import { deleteTarotReading, listTarotReadings, saveTarotReading } from '../../../api/client.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useBadges } from '../../../store/badges.js'
import { useDateMission } from './bk_dateMission.js'

// 데이트 코스 구역(BK) 커플 타로 기록 (담당: 병관)
// 저장은 지민 님 client.js 함수 그대로: 로그인(서버 모드) → Supabase tarot_readings, 아니면 이 브라우저
// 규칙 (docs/bk-couple-tarot-plan.md 5장): 두 사람 답 원문·별명은 저장 X → 카드 id·요약·일치도 같은 정해진 값만
// 저장이 실패해도 결과 화면은 그대로 (모두 try/catch)

const CARDS = Object.fromEntries(cardData.cards.map((c) => [c.id, c]))
const savedSeeds = new Set() // 같은 결과를 두 번 저장하지 않게 (개발 모드 이중 실행·다시 그리기)

export const cardById = (id) => CARDS[id] ?? null

/** 지난번 기록을 먼저 읽고 이번 결과를 저장 → { last, saved, error } */
export async function recordReading(result) {
  const userId = useUiStore.getState().userId
  let last = null
  try {
    const { readings } = await listTarotReadings({ userId, limit: 2 })
    last = readings.find((x) => x.detail?.seed !== result.seed) ?? null
  } catch (error) {
    console.warn('[tarot] 지난 기록을 못 읽었어요', error)
  }
  if (savedSeeds.has(result.seed)) return { last, saved: null, error: null }
  savedSeeds.add(result.seed)
  try {
    const { reading } = await saveTarotReading({
      userId,
      spread: 'couple',
      cards: result.cards.map((c) => c.id),
      // 별명도 두 번째 사람 정보라 빼고 저장 ("민지님과 준호님은" → "두 사람은")
      summary: result.summary.replace(`${result.names.a}님과 ${result.names.b}님은`, '두 사람은'),
      detail: {
        match: result.match,
        hits: result.hits,
        focus: result.focus,
        reversed: result.cards.map((c) => c.reversed),
        missionPlaceId: result.mission?.placeId ?? null,
        courseIds: (result.course ?? []).map((c) => c.placeId),
        seed: result.seed,
      },
    })
    return { last, saved: reading, error: null }
  } catch (error) {
    savedSeeds.delete(result.seed)
    console.warn('[tarot] 기록 저장 실패', error)
    return { last, saved: null, error: error?.message || '기록을 저장하지 못했어요.' }
  }
}

export async function removeReading(readingId) {
  const userId = useUiStore.getState().userId
  await deleteTarotReading({ userId, readingId })
}

/** 결과를 받은 순간 주는 배지 (미션 완료 배지는 store/badges.js가 코스 완주 때 줌) */
export function awardTarotBadges(result) {
  useDateMission.getState().markDone('tarot') // 데이트 코스 미션
  const { award } = useBadges.getState()
  const { toast } = useUiStore.getState()
  const won = []
  if (award('tarot_first')) won.push('🔮 배지 획득: 커플 타로 첫 점')
  if (result.match >= 80 && award('tarot_match')) won.push('💞 배지 획득: 서로를 잘 아는 사이')
  won.forEach((text, i) => setTimeout(() => toast(text, 'ok'), 600 + i * 900))
}
