import { Cafe, Hanok, Modern, Mural, StoneWall } from './buildings.jsx'
import { Bench, Bins, BusShelter, Fence, Lamp, Pavilion, SignPost, Tree, Vending } from './props.jsx'
import { HJ_STYLES } from './hj/index.js'
import { JM_STYLES } from './jm_japanese.jsx'
import {
  Bollard,
  CherryTree,
  ContainerPopup,
  CubeGallery,
  FlowerBed,
  GlassCafe,
  GreenhouseCafe,
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
  // 영화·드라마 구역(HJ) 전용: 고백 담벼락·여름 정류장·영화 포털·hj* 모양들
  ...HJ_STYLES,
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
  // 데이트 코스 현대 건물 (BK)
  glassCafe: GlassCafe,
  cubeGallery: CubeGallery,
  containerPopup: ContainerPopup,
  greenhouseCafe: GreenhouseCafe,
}
