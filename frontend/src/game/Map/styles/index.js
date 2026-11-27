import { Cafe, Hanok, Modern, Mural, StoneWall } from './buildings.jsx'
import { Bench, Bins, BusShelter, Fence, Lamp, Pavilion, SignPost, Tree, Vending } from './props.jsx'
import { HJ_STYLES } from './hj/index.js'
import { JM_STYLES } from './jm_japanese.jsx'
import {
  Bollard,
  CherryTree,
  ContainerPopup,
  CouplePhotoZone,
  CubeGallery,
  FlowerBed,
  GlassCafe,
  GreenhouseCafe,
  Landscape,
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
  BkBlocker,
} from './dateCourse.jsx'
import { BdayCafe, PopupStore, Stage } from './kpop.jsx'
import { FilmingAlleyShop } from './filmingAlley.jsx'
import { SgStudio } from './sg_studio.jsx'
import { SgCheer } from './sg_cheer.jsx'
import { SgFanNpc } from './sg_fanNpc.jsx'
import { SG_AUDITION_STYLES } from './sg_audition.jsx'
import { SG_DOME_STYLES } from './sg_dome.jsx'
import { SG_DOME_SHOW_STYLES } from './sg_domeShow.jsx'
import { SungrayBeach } from './beach.jsx'
import { FestivalCart } from './festival.jsx'
import { ClawBooth } from './bk_clawMachine.jsx'
import { TarotBooth } from './bk_tarotBooth.jsx'
import { GuideBoard } from './bk_guideBoard.jsx'
import { SunsetPavilion } from './bk_sunsetPavilion.jsx'
import {
  HubBuskingStage, HubClockTower, HubCompass, HubCompassBorder, HubFoodTruck, HubGardenCourt,
  HubGardenLantern, HubLoungeChair, HubMapBoard, HubPergola, HubPlantingBed, HubPromenade, HubSignpost, HubTreeBench,
} from './hub.jsx'

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
  couplePhotoZone: CouplePhotoZone,
  landscape: Landscape,
  greenhouseCafe: GreenhouseCafe,
  clawBooth: ClawBooth, // 인형뽑기 부스 + 미니게임 (bk_clawMachine.jsx)
  tarotBooth: TarotBooth, // 커플 타로 텐트 (bk_tarotBooth.jsx)
  bkGuideBoard: GuideBoard, // 데이트 코스 안내판 (bk_guideBoard.jsx)
  bkSunsetPavilion: SunsetPavilion,
  bkBlocker: BkBlocker, // 데이트 코스: 눈에 안 보이는 충돌 상자 (커플 포토존 등)
  // K-POP (SG)
  stage: Stage,
  sungrayBeach: SungrayBeach,
  festivalCart: FestivalCart,
  agencyLobby: FilmingAlleyShop,
  artistLounge: FilmingAlleyShop,
  soundStudio: SgStudio,
  cheerSpot: SgCheer, // 응원봉 리듬 게임 (sg_cheer.jsx)
  fanWaver: SgFanNpc, // 팬 문화 거리의 손 흔드는 팬 (sg_fanNpc.jsx)
  ...SG_AUDITION_STYLES, // 썬그레이 오디션 세트·게이트·파일런 (sg_audition.jsx)
  ...SG_DOME_STYLES, // 잠실 주경기장 느낌 돔 (sg_dome.jsx, Codex 작성)
  ...SG_DOME_SHOW_STYLES, // 돔 바닥선 서치라이트·밤 폭죽 (sg_domeShow.jsx)
  bdayCafe: BdayCafe,
  popupStore: PopupStore,
  practiceRoom: FilmingAlleyShop,
  videoShop: FilmingAlleyShop,
  snackBar: FilmingAlleyShop,
  coinKaraoke: FilmingAlleyShop,
  recordShop: FilmingAlleyShop,
  photoStudio: FilmingAlleyShop,
  // 중앙 광장 (hub.json)
  hubCompass: HubCompass,
  hubClockTower: HubClockTower,
  hubTreeBench: HubTreeBench,
  hubSignpost: HubSignpost,
  hubMapBoard: HubMapBoard,
  hubPergola: HubPergola,
  hubFoodTruck: HubFoodTruck,
  hubBuskingStage: HubBuskingStage,
  hubPromenade: HubPromenade,
  hubGardenCourt: HubGardenCourt,
  hubGardenLantern: HubGardenLantern,
  hubCompassBorder: HubCompassBorder,
  hubPlantingBed: HubPlantingBed,
  hubLoungeChair: HubLoungeChair,
}
