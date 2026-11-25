// [2. 설계 > 화면 설계] 압축 경복궁 배치 (혜진 영화·드라마 구역)
// 실제 경복궁 안내도(광화문 → 흥례문 → 근정문 → 근정전 → 사정전 → 강녕전 → 교태전, 서쪽 경회루·수정전, 동쪽 동궁·자경전·향원정)를
// 약 74 × 103m 땅에 맞게 줄인 배치예요. 뒤쪽(후원)에는 향원정·건청궁·태원전과 소나무 숲이 있어요.
//
// 좌표계 "A": ax = 궁궐 가운데 축(x = -8)에서 좌우 거리, az = 궁궐 깊이 방향 거리.
//   - 근정전 아이템(haewol_palace)이 az = PALACE_ORIGIN_Z 자리에 있어요. 구역 z = 아이템 z + (az - PALACE_ORIGIN_Z).
//   - 구역 입구에서 들어오면 광화문이 맨 앞, az가 커질수록 궁궐 깊숙한 곳이에요.
// 이 파일 하나로 3D 모양(HjGyeongbokPalace.jsx)과 충돌 박스(hj_drama.json의 gb_* 항목)를 만들어요.
// 배치를 바꾸면 충돌 박스도 다시 만들어야 해요 (만드는 방법은 HjGyeongbokPalace.jsx 맨 위 설명 참고).

export const AXIS_X = 0 // 궁궐 가운데 축 (구역 좌표 x)
export const PALACE_ORIGIN_Z = -14 // haewol_palace 아이템 위치 z (근정전 실내·착석 좌표의 기준)

// 담장 바깥 테두리
export const BOUNDS = { minX: -37, maxX: 37, minZ: -31, maxZ: 72 }
export const WALL_H = 2.4
export const WALL_T = 1

// 광화문: 석축(무지개문 3개) + 2층 문루
export const GWANGHWAMUN = { az: -31, width: 13.3, depth: 2.5, title: '광화문' }
// 무지개문 사이 기둥(지나갈 수 없는 부분) x 범위
export const GWANGHWAMUN_PIERS = [
  [-6.65, -4.97],
  [-2.83, -1.45],
  [1.45, 2.83],
  [4.97, 6.65],
]

// 담장 (지나갈 수 없음). [시작ax, 시작az, 끝ax, 끝az]
export const WALLS = [
  // 앞 담장 (광화문 양옆)
  [-37, -31, -6.65, -31],
  [6.65, -31, 37, -31],
  // 옆 담장 (영추문·건춘문 자리 3m 비움)
  [-37, -31, -37, -22.5],
  [-37, -19.5, -37, 72],
  [37, -31, 37, -22.5],
  [37, -19.5, 37, 72],
  // 뒤 담장 (신무문 자리 3.2m 비움)
  [-37, 72, -1.6, 72],
  [1.6, 72, 37, 72],
  // 흥례문 줄 (가운데 흥례문 9m)
  [-14, -24, -4.5, -24],
  [4.5, -24, 14, -24],
  // 침전(강녕전·교태전)과 후원 사이 담장 (가운데 4m 비움)
  [-14, 44, -2, 44],
  [2, 44, 14, 44],
]

// 전각 (Pavilion으로 그림). solid: 충돌 박스 여부(열린 문은 false), upper: 2층 지붕, ornate: 단청·창 장식
export const HALLS = [
  { id: 'heungnyemun', title: '흥례문', ax: 0, az: -24, w: 9, d: 4, h: 2.6, open: true, upper: true },
  { id: 'geunjeongmun', title: '근정문', ax: 0, az: -16, w: 8.6, d: 4.1, h: 2.74, open: true, upper: true },
  { id: 'sajeongjeon', title: '사정전', ax: 0, az: 17, w: 10.5, d: 6, h: 3.2, ornate: true, solid: true },
  { id: 'gangnyeongjeon', title: '강녕전', ax: 0, az: 27, w: 12.5, d: 5.6, h: 3.0, ornate: true, solid: true },
  { id: 'gyotaejeon', title: '교태전', ax: 0, az: 36, w: 11, d: 5.2, h: 3.0, ornate: true, solid: true },
  { id: 'sujeongjeon', title: '수정전', ax: -26, az: -16.5, w: 12, d: 4.8, h: 2.8, ornate: true, solid: true },
  { id: 'donggung', title: '동궁 자선당', ax: 26, az: -14, w: 12, d: 5, h: 2.8, ornate: true, solid: true },
  { id: 'jagyeongjeon', title: '자경전', ax: 27, az: 34, w: 12, d: 5, h: 2.8, ornate: true, solid: true },
  // 넓힌 양옆: 동궁 비현각 · 소주방(궁중 부엌) · 흥복전
  { id: 'bihyeongak', title: '비현각', ax: 26, az: -5, w: 10, d: 4.5, h: 2.6, ornate: true, solid: true },
  { id: 'sojubang', title: '소주방', ax: 27, az: 18, w: 11, d: 4.5, h: 2.5, solid: true },
  { id: 'heungbokjeon', title: '흥복전', ax: -26, az: 38, w: 13, d: 5, h: 2.9, ornate: true, solid: true },
  // 후원: 건청궁(향원정 북쪽) · 태원전(서북쪽)
  { id: 'geoncheonggung', title: '건청궁', ax: 16, az: 66, w: 12, d: 4.4, h: 2.6, ornate: true, solid: true },
  { id: 'taewonjeon', title: '태원전', ax: -24, az: 60, w: 13, d: 5, h: 2.9, ornate: true, solid: true },
  // 옆·뒤 문 (열린 문)
  { id: 'yeongchumun', title: '영추문', ax: -37, az: -21, w: 3.6, d: 1.8, h: 2.3, open: true, rotation: 90 },
  { id: 'geonchunmun', title: '건춘문', ax: 37, az: -21, w: 3.6, d: 1.8, h: 2.3, open: true, rotation: 90 },
  { id: 'sinmumun', title: '신무문', ax: 0, az: 72, w: 4.4, d: 1.8, h: 2.3, open: true },
]

// 근정전을 둘러싼 행각(회랑). 지붕 있는 긴 복도, 지나갈 수 없음
export const CORRIDORS = [
  { id: 'cloister_w', ax: -13, az: -3.5, w: 25, d: 2.2, h: 2.0, rotation: 90 },
  { id: 'cloister_e', ax: 13, az: -3.5, w: 25, d: 2.2, h: 2.0, rotation: 90 },
  { id: 'cloister_fw', ax: -8.6, az: -16, w: 7.6, d: 2.2, h: 2.0 },
  { id: 'cloister_fe', ax: 8.6, az: -16, w: 7.6, d: 2.2, h: 2.0 },
  { id: 'cloister_bw', ax: -7.4, az: 9, w: 11.2, d: 2.2, h: 2.0 },
  { id: 'cloister_be', ax: 7.4, az: 9, w: 11.2, d: 2.2, h: 2.0 },
]

// 연못: 경회루(서쪽, 큰 네모 연못) · 향원정(동쪽 뒤, 둥근 섬)
export const PONDS = [
  { id: 'gyeonghoeru_pond', ax: -26, az: 16, w: 15, d: 16 },
  { id: 'hyangwon_pond', ax: 12, az: 54, w: 14, d: 12 },
]

// 연못 위 누각 (돌기둥 받침 위)
export const POND_PAVILIONS = [
  { id: 'gyeonghoeru', title: '경회루', ax: -26, az: 16, w: 10, d: 7.5, h: 2.9, podium: 1.15, upper: true, ornate: true },
  { id: 'hyangwonjeong', title: '향원정', ax: 12, az: 54, w: 3.2, d: 3.2, h: 2.1, podium: 0.55, upper: true, ornate: true },
]

// 아미산: 교태전 뒤 계단식 꽃동산 + 육각 굴뚝
export const AMISAN = { ax: 0, az: 40.5, w: 9, d: 2.6, h: 1.0 }

// 해태 한 쌍 (광화문 앞)
export const HAETAE = [
  [-7.6, -33.6],
  [7.6, -33.6],
]

// 품계석 (근정문 ~ 근정전 계단 사이, 가운데 길 양옆)
export const PUMGYE_ROWS = { axOffset: 3.2, fromAz: -14.6, toAz: -10.2, count: 4 }

// 가운데 박석길 뒤쪽: 근정전 뒤 행각 ~ 신무문
export const BACK_PATH = { fromAz: 9.5, toAz: 72 }

// 향원정 다리(취향교): 연못 남쪽 가장자리 ~ 정자 (보기용, 건너가지는 못해요)
export const BRIDGE = { ax: 12, fromAz: 47.8, toAz: 52.3, width: 0.9 }

// 후원 소나무 [ax, az, 크기]
export const TREES = [
  [-31.2, 47, 1.1], [-26, 49.5, 0.9], [-31.8, 53, 1], [-11.7, 47.5, 0.85], [-7.1, 51, 1],
  [-10.4, 56, 0.9], [-31.2, 66, 1.05], [-25.3, 68.5, 0.9], [-9.1, 64, 1], [-5.9, 68.5, 0.85],
  [3.6, 46.2, 0.8], [2.6, 58, 1], [29.3, 47.5, 1], [31.2, 52, 0.9], [29.9, 58.5, 1.05],
  [31.9, 44, 0.85], [29.3, 26, 0.9], [22.1, 22, 0.85], [-31.2, 34, 0.95],
]
