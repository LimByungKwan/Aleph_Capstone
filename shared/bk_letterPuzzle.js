// (담당: 병관) 골목 편지의 역할, 단서 장소, 그림과 색
export const LETTER_EPISODE_ID = 'letter'
export const LETTER_TITLE = '둘이 푸는 골목 편지'
export const LETTER_ROLES = ['sequence', 'palette']
export const LETTER_STATIONS = {
  sequence: { mission: 'cafe', point: [75.5, 17], title: '소란 커피 · 컵 받침' },
  palette: { mission: 'mural', point: [120.5, 4.5], title: '날개 벽화 골목 · 타일' },
}
export const LETTER_STATION_RADIUS = 3

export const LETTER_SYMBOLS = {
  moon: { icon: '🌙', label: '달' },
  flower: { icon: '🌸', label: '꽃' },
  star: { icon: '⭐', label: '별' },
}
export const LETTER_COLORS = {
  blue: { label: '파랑', swatch: '#4071ba' },
  pink: { label: '분홍', swatch: '#c94673' },
  yellow: { label: '노랑', swatch: '#d4a01b' },
}
export const LETTER_ENDINGS = [
  '오늘 찾아낸 편지는 두 사람이 함께 열었어요. 다음에 이 골목에서 만나면, 이번엔 당신이 먼저 나를 찾아 주세요.',
  '한 사람의 컵 받침과 다른 사람의 벽화가 만나 길이 열렸어요. 길을 헤매더라도 오늘처럼 같이 찾아봐요.',
  '이 골목에 편지를 남겨요. 오늘을 떠올리고 싶을 때는 같은 자리에서 서로의 이름을 불러 주세요.',
]
