// [3. 개발 > 프론트엔드] 근정전의 좌석 위치. 가구와 착석 좌표가 같은 값을 사용합니다.
export const ROOM_FLOOR = 0.065
export const PALACE_SEATS = [
  { id: 'left-cushion', label: '왼쪽 방석', position: [-1.74, ROOM_FLOOR, 0.08], surfaceOffset: 0.112 },
  { id: 'right-cushion', label: '오른쪽 방석', position: [1.74, ROOM_FLOOR, 0.08], surfaceOffset: 0.112 },
  { id: 'throne', label: '왕의 자리(어좌)', position: [0, 0.42, 1.92], surfaceOffset: 0.379 },
]
