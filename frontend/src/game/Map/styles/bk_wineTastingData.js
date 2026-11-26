// (담당: 병관) 달빛 와인바의 테이스팅 위치와 계정별 기록을 안내판과 체험에서 함께 씁니다.
export const WINE_BAR_ID = 'BK/b_wine'
export const WINE_MISSION_ID = 'wine'
export const WINE_ROUND_COUNT = 3
const RECORD_PREFIX = 'scenewalk.wine-tasting.'

export const wineTastingPosition = (item) => [item.size[0] / 2 - 0.55, 0.27, item.size[2] / 2 + 3.05]

export function readWineBest(userId) {
  try {
    const value = localStorage.getItem(RECORD_PREFIX + userId)
    if (value !== null && /^\d$/.test(value) && Number(value) <= WINE_ROUND_COUNT) return Number(value)
  } catch {
    // 저장소를 쓸 수 없는 경우에도 체험은 진행할 수 있어요.
  }
  return null
}

export function saveWineBest(userId, score) {
  try {
    localStorage.setItem(RECORD_PREFIX + userId, String(score))
  } catch {
    // 현재 기록은 화면에 표시해요.
  }
}

export function restoreWineCompletions(accounts) {
  const completedAt = new Date().toISOString()
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key?.startsWith(RECORD_PREFIX)) continue
    const userId = key.slice(RECORD_PREFIX.length)
    if (!userId || readWineBest(userId) === null) continue
    const pass = accounts[userId]
    if (!pass?.done?.[WINE_MISSION_ID]) {
      accounts[userId] = { ...pass, stamps: pass?.stamps ?? {}, done: { ...pass?.done, [WINE_MISSION_ID]: completedAt } }
    }
  }
}
