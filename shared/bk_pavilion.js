// (담당: 병관) 노을등 정자 발판과 기분에 어울리는 대화 질문
export const PAVILION_CENTER = [82.75, -55.95]
export const PAVILION_FLOOR = 6.02
export const PAVILION_PADS = [-1.15, 1.15]
export const MOODS = { calm: '편안함', flutter: '설렘', adventure: '모험' }

const prompts = {
  calm: '같이 있는 순간 중 언제 가장 편안해요?',
  flutter: '오늘 함께한 순간 중 어느 장면을 사진으로 남기고 싶어요?',
  adventure: '내일 하루가 비면 둘이 어디에 가 보고 싶어요?',
  'calm/flutter': '둘이 다시 걷고 싶은 길이 있다면 어디예요? 그 길에서 무엇을 하고 싶어요?',
  'adventure/calm': '서로의 휴일을 하루씩 맡아 계획한다면 어떤 곳에 데려가고 싶어요?',
  'adventure/flutter': '둘이 아직 해 본 적 없는 데이트 중 가장 기대되는 건 뭐예요?',
}

export function pavilionPrompt(first, second = first) {
  return prompts[first === second ? first : [first, second].sort().join('/')]
}

export function pavilionPad(position) {
  if (!position) return -1
  const [x, y, z] = position
  if (y < PAVILION_FLOOR - 0.3 || y > PAVILION_FLOOR + 2.1) return -1
  const [cx, cz] = PAVILION_CENTER
  return PAVILION_PADS.findIndex((offset) => Math.hypot(x - cx - offset, z - cz) <= 0.84)
}
