import { layout, zones } from '../data/mapData.js'
import { TOWER, terrainHeightAt } from '../Map/terrain.js'

export const DATE_INTRO_PANEL = 'dateCourseIntro'
export const dateIntroPlayback = { media: null, liveShot: null }

const zone = zones.find(({ zoneId }) => zoneId === 'BK')
const items = new Map([...layout.props, ...layout.buildings, ...layout.terrain].map(item => [item.id, item]))
const [x, z] = zone.origin
const tower = items.get('BK/tower')
const deckHeight = tower
  ? terrainHeightAt(layout.terrain, ...tower.position) + TOWER.deckFloor
  : 32

// 카메라 구도는 현재 맵의 건물·소품 위치를 기준으로 잡습니다.
function shot(start, end, title, description, anchor, eye, target, fov, light) {
  const item = items.get('BK/' + anchor)
  const [ax, az] = item?.position ?? zone.origin
  const ay = anchor === 'tower' ? deckHeight : item?.elevation ?? 0
  const offset = ([dx, dy, dz]) => [ax + dx, ay + dy, az + dz]
  return { start, end, title, description, eye: offset(eye), target: offset(target), fov, light }
}

const [width, depth] = zone.size
const wide = Math.max(width / 80, depth / 160)
export const dateIntroShots = [
  shot(3, 7, '데이트 코스', '분수 광장에서 별빛 전망대까지 함께 걸어요.', null,
    [91 * wide, 75 * wide, 52 * wide], [0, 5, 10], 39, 'sunset'),
  shot(7, 8.833, '소원 분수 광장', '분수에 동전을 던져 소원을 빌어요.', 'fountain', [10, 7, 7], [0, 1.5, 0], 46, 'day'),
  shot(8.833, 10.667, '소란 커피', '상대의 취향에 맞춰 음료를 만들어요.', 'b_cafe', [-4.5, 4.6, 10.5], [-.5, 3, .5], 47, 'day'),
  shot(10.667, 12.333, '한옥 인형뽑기', '집게로 기념 인형을 뽑아 봐요.', 'claw_booth', [-4, 3.5, -7.3], [0, 2, 0], 49, 'day'),
  shot(12.333, 14, '커플 타로', '서로의 답을 타로 세 장으로 풀어 봐요.', 'tarot_booth', [2.3, 3.2, -6.8], [0, 1.9, 0], 49, 'night'),
  shot(14, 15.833, '달빛 와인바', '향과 끝맛으로 무알코올 음료를 맞혀요.', 'b_wine', [-7, 6, 15], [0, 3, 0], 49, 'night'),
  shot(15.833, 17.667, '날개 벽화 골목', '날개 사이에 서서 영화의 엔딩을 재현해요.', 'b_wings', [-.3, 1.85, 7.1], [0, .91, 1.5], 39, 'night'),
  shot(17.667, 19.667, '커플 포토존', '하트 아치 앞에서 둘만의 네 컷을 남겨요.', 'couple_photo', [-7, 2.7, 1.5], [1, 2.2, 0], 44, 'night'),
  shot(19.667, 23.667, '별빛 전망대', '망원경으로 이웃 구역의 명소를 찾아봐요.', 'tower', [20, -2, -39], [0, -11, 0], 52, 'sunrise'),
  shot(23.667, 25.5, '전망대에서 바라본 거리', '걸어온 골목과 광장이 한눈에 보여요.', 'tower', [0, 3, 13], [x - (tower?.position[0] ?? x), 1 - deckHeight, z + 45 - (tower?.position[1] ?? z)], 42, 'day'),
]

export function shotAt(time) {
  return dateIntroShots.find(({ start, end }) => time >= start && time < end) ?? null
}
