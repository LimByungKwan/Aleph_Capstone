// (담당: 병관) 화면과 멀티 서버가 함께 읽는 데이트 에피소드 순서
export const EPISODE_STEPS = {
  alley: ['cafe', 'mural'],
  starlight: ['photo', 'telescope'],
}

export function episodeSteps(id) {
  return Object.hasOwn(EPISODE_STEPS, id) ? EPISODE_STEPS[id] : null
}
