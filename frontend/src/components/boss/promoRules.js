// [1. 기획 > 차별화 전략] 홍보문구 규칙 검사 (저작권·초상권 보호)
// - 배우 실명 금지, 작품 대사 인용 금지, 로고 사용 금지
// - 가상 작품명·가상 가게만 사용
// 화면(입력 단계)과 AI 결과(출력 단계) 양쪽에서 같은 함수로 검사해요.

// 팀에서 금지할 실명 목록을 여기에 추가 (예: 실제 배우 이름). 비어 있어도 아래 패턴 검사는 동작해요.
export const BANNED_NAMES = []

const RULES = [
  {
    id: 'quote',
    // 큰따옴표·작은따옴표·겹낫표로 감싼 10자 이상 문장 → 대사 인용 의심 (작품명 「」은 짧아서 통과)
    test: (text) => /["“”'‘’『][^"“”'‘’『』]{10,}["“”'‘’』]/.test(text),
    message: '작품 대사를 인용한 것 같아요. 대사는 빼고 분위기만 표현해 주세요.',
  },
  {
    id: 'actor',
    test: (text) => /배우\s*[가-힣]{2,4}|[가-힣]{2,4}\s*배우/.test(text) || BANNED_NAMES.some((name) => name && text.includes(name)),
    message: '배우 실명은 쓸 수 없어요. "주인공", "두 사람"처럼 바꿔 주세요.',
  },
  {
    id: 'logo',
    test: (text) => /로고|logo|방송사\s*마크|ⓒ|©/i.test(text),
    message: '방송사·작품 로고는 쓸 수 없어요.',
  },
]

/** 글을 검사해서 지켜야 할 규칙 안내 문구 목록을 돌려줘요. 문제 없으면 빈 배열. */
export function checkPromoRules(...texts) {
  const joined = texts.filter(Boolean).join('\n')
  return RULES.filter((rule) => rule.test(joined)).map((rule) => rule.message)
}

export const PROMO_GUIDE = ['배우 실명 금지', '작품 대사 인용 금지', '로고·방송사 마크 금지', '가상 작품명·가상 가게만 사용']
