// [지민] 스탬프 진행률 계산 (React·파일 import 없음 → node로 바로 테스트 가능)
// 완주 기준(전체 / 명소만 / 구역별)이 아직 안 정해져서, 세 가지를 모두 계산해 둔다.
// 화면은 필요한 것만 골라 쓰면 됨 → 기준이 바뀌어도 이 파일·서버는 그대로

/** 스탬프를 받을 수 있는 장소 = NPC를 뺀 전부 (DB collect_stamp 규칙과 같음) */
export function stampablePlaces(places) {
  return places.filter((p) => p.type !== 'npc')
}

const count = (list, has) => {
  const collected = list.filter((p) => has.has(p.id)).length
  return { collected, total: list.length, complete: list.length > 0 && collected === list.length }
}

/**
 * @param {{ placeId: string }[]} stamps  listMyStamps()의 stamps (mock·서버 모양 같음)
 * @param {{ id, type, zone, name }[]} places  shared/places.json
 * @returns {{
 *   collected, total, complete,                       // 전체 (명소 + 가게)
 *   spots: { collected, total, complete },             // 명소(spot)만
 *   zones: { [zone]: { collected, total, complete } }, // 구역별 (JM·HJ·BK·SG)
 *   missing: { id, name, zone, type }[],               // 아직 안 받은 곳 (워프 목적지 안내용)
 * }}
 */
export function stampProgress(stamps, places) {
  const targets = stampablePlaces(places)
  // 장소 목록에서 빠진 스탬프·중복은 세지 않음
  const has = new Set((stamps ?? []).map((s) => s.placeId))
  const zones = {}
  for (const zone of new Set(targets.map((p) => p.zone))) {
    zones[zone] = count(targets.filter((p) => p.zone === zone), has)
  }
  return {
    ...count(targets, has),
    spots: count(targets.filter((p) => p.type === 'spot'), has),
    zones,
    missing: targets.filter((p) => !has.has(p.id)).map(({ id, name, zone, type }) => ({ id, name, zone, type })),
  }
}
