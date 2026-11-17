import { checkPromoRules } from './promoRules.js'

// [3. 개발 > 기초개발] 홍보문구 "가짜 AI" (병관님 AI API가 붙기 전 화면 개발용)
// 손님 유형(target) × 분위기(tone)로 캡션 3안 + 해시태그 + (선택) 릴스 대본을 만들어요.

const TONES = {
  warm: {
    label: '따스한 감성형',
    tag: '감성 폭발 힐링형',
    open: ['골목 끝, 그 장면이 머물던 자리', '천천히 걷다 보면 만나는 작은 쉼표', '드라마 속 계절이 아직 남아 있는 곳'],
    close: ['오늘은 여기서 잠깐 쉬어 가요. 🌸', '그날의 공기를 한 잔에 담았어요. ☕', '당신의 장면도 이곳에서 시작돼요. 🎞️'],
  },
  bright: {
    label: '유쾌한 위트형',
    tag: '위트 발랄형',
    open: ['발걸음이 멈추는 아늑한 골목!', '스탬프 찍고 왔다면 여기로 GO', '촬영지 순례 끝? 이제 쉴 차례!'],
    close: ['같이 오면 즐거움도 두 배예요 ✨', '인증샷 찍고 쿠폰 쓰고! 📸', '지금 바로 놀러 오세요 🙌'],
  },
  plain: {
    label: '담백한 안내형',
    tag: '깔끔 정보형',
    open: ['촬영지 근처 조용한 가게입니다.', '골목 산책 중 들르기 좋은 곳입니다.', '촬영지에서 걸어서 1분 거리입니다.'],
    close: ['편하게 들러 주세요.', '스탬프 쿠폰 사용 가능합니다.', '영업시간에 맞춰 방문해 주세요.'],
  },
}

const TARGETS = {
  couple: { label: '🌸 봄날을 거니는 연인들', line: '둘이 나란히 앉기 좋은 창가 자리가 기다려요.', tag: '#데이트코스' },
  traveler: { label: '☕ 골목길을 산책하는 힐링 여행자', line: '걷다 지친 다리를 쉬어 가기 좋은 곳이에요.', tag: '#골목여행' },
  worker: { label: '💼 지친 하루 끝에 쉬고픈 직장인', line: '퇴근길에 잠깐 들러 하루를 내려놓으세요.', tag: '#퇴근길힐링' },
}

export const TONE_OPTIONS = Object.entries(TONES).map(([value, t]) => ({ value, label: t.label }))
export const TARGET_OPTIONS = Object.entries(TARGETS).map(([value, t]) => ({ value, label: t.label }))

// 「여름이 머무는 정류장」 → 여름이머무는정류장
function tagify(text) {
  return String(text ?? '')
    .replace(/[「」『』"'()[\]]/g, '')
    .replace(/드라마|영화|웹드라마/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function generatePromoMock({ shopName, workTitle, offer, menu, target = 'traveler', tone = 'warm', includeReels = false }) {
  const t = TONES[tone] ?? TONES.warm
  const who = TARGETS[target] ?? TARGETS.traveler
  const work = workTitle ? `${workTitle.replace(/^(드라마|영화|웹드라마)\s*/, '')} 촬영지` : '촬영지'
  const perk = offer ? `스탬프 쿠폰으로 ${offer} 혜택도 드려요.` : ''
  const item = menu ? `대표 메뉴는 ${menu}.` : ''

  const captions = [0, 1, 2].map((i) =>
    [
      `${t.open[i]}, ${shopName}.`,
      i === 0 ? `${work} 산책 뒤에 들르기 좋아요.` : '',
      i === 1 ? item : '',
      i === 2 ? who.line : '',
      perk,
      t.close[i],
    ]
      .filter(Boolean)
      .join(' '),
  )

  const hashtags = [
    `#${tagify(shopName)}`,
    workTitle ? `#${tagify(workTitle)}` : null,
    '#촬영지투어',
    who.tag,
    '#SceneWalk',
    offer ? '#스탬프쿠폰' : null,
    menu ? `#${tagify(menu)}` : null,
  ].filter(Boolean)

  const reels = includeReels
    ? [
        '[0~3초] 골목 입구에서 천천히 걸어 들어가는 뒷모습',
        `[3~7초] ${work} 표지판 앞 스탬프 찍는 손`,
        `[7~11초] ${shopName} 문을 여는 장면 + 자막: ${offer ? `스탬프 쿠폰 ${offer}` : '오늘의 쉼표'}`,
        `[11~15초] ${menu || '음료'} 클로즈업 → 가게 이름 자막으로 마무리`,
      ].join('\n')
    : null

  return { captions, hashtags, reels, tag: t.tag, warnings: checkPromoRules(...captions, reels) }
}
