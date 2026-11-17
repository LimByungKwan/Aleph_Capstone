import { Cafe, Hanok, Modern, Mural, StoneWall } from './buildings.jsx'
import { Bench, Bins, BusShelter, Fence, Lamp, Pavilion, SignPost, Tree, Vending } from './props.jsx'
import { JM_STYLES } from './jm_japanese.jsx'
import {
  Bollard,
  CherryTree,
  FlowerBed,
  Fountain,
  HanokCafe,
  HanokShop,
  LanternLamp,
  LockFence,
  NeonWings,
  ObservationTower,
  Rock,
  RooftopRestaurant,
  RoundPlaza,
  Telescope,
  Terrace,
} from './dateCourse.jsx'

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
  // 애니메이션 구역(JM) 일본풍: jmTorii, jmMachiya, jmShrine, jmLantern
  ...JM_STYLES,
  // 데이트 코스 (BK)
  hanokShop: HanokShop,
  hanokCafe: HanokCafe,
  rooftopRestaurant: RooftopRestaurant,
  neonWings: NeonWings,
  observationTower: ObservationTower,
  cherryTree: CherryTree,
  lanternLamp: LanternLamp,
  fountain: Fountain,
  roundPlaza: RoundPlaza,
  lockFence: LockFence,
  telescope: Telescope,
  bollard: Bollard,
  flowerBed: FlowerBed,
  rock: Rock,
  terrace: Terrace,
}
