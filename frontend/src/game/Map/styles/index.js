import { Cafe, Hanok, Modern, Mural, StoneWall } from './buildings.jsx'
import { Bench, Bins, BusShelter, Fence, Lamp, Pavilion, SignPost, Tree, Vending } from './props.jsx'
import { HJ_STYLES } from './hj/index.js'

// hub.json / zones/*.json의 "style" 이름 ↔ 그리는 컴포넌트
// 새 스타일을 만들면 여기에 한 줄 추가하면 돼요.
export const STYLES = {
  // 건물
  hanok: Hanok,
  modern: Modern,
  cafe: Cafe,
  mural: Mural,
  stoneWall: StoneWall,
  // 소품
  tree: Tree,
  lamp: Lamp,
  bench: Bench,
  bins: Bins,
  pavilion: Pavilion,
  busShelter: BusShelter,
  signPost: SignPost,
  fence: Fence,
  vending: Vending,
  // 구역 전용 (혜진: 고백 담벼락·여름 정류장·영화 포털)
  ...HJ_STYLES,
}
