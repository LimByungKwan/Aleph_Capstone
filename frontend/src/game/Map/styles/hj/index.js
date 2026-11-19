import ConfessionWall from './ConfessionWall.jsx'
import FilmPortal from './FilmPortal.jsx'
import SummerShelter from './SummerShelter.jsx'
import HjBrickBuilding from './HjBuildings.jsx'
import HjBlossomGate from './HjGate.jsx'
import HjEntranceGate from './HjEntranceGate.jsx'
import { HjAnalogHanok, HjAnalogLabel, HjGoldenSet, HjAnalogBooth } from './HjAnalogSet.jsx'
import { HjBoat, HjBreakwater, HjLighthouse, HjSea } from './HjHarbor.jsx'
import { HjCrosswalk, HjCurvedRoad } from './HjStreet.jsx'
import {
  HjAFrameSign,
  HjBicycle,
  HjCafeSet,
  HjCar,
  HjCherryTree,
  HjFruitCart,
  HjLantern,
  HjMailbox,
  HjPetals,
  HjStringLights,
} from './HjProps.jsx'

// [3. 개발 > 기초개발/서비스] 혜진(HJ) 영화·드라마 구역 전용 모양들
// 공용 styles/index.js에서 ...HJ_STYLES 한 줄로 등록돼요. 다른 구역에서 써도 되지만 수정은 혜진에게.
// 이름이 다른 사람 style과 겹치지 않게 새 모양은 "hj" 로 시작해요.
import { HjBlueGate, HjHanokBench, HjSnackSteam, HjStoryCue } from './HjDramaDetails.jsx'
import { HjCyberGrid, HjCyberTower, HjEraBarrier, HjFloatingCar, HjLunarBase, HjRetroCrew, HjRetroStairs, HjRift, HjSkywalk } from './HjTimeDistrict.jsx'

export const HJ_STYLES = {
  hjAnalogHanok: HjAnalogHanok,
  hjAnalogLabel: HjAnalogLabel,
  hjGoldenSet: HjGoldenSet,
  hjAnalogBooth: HjAnalogBooth,
  hjBoothWallCollider: () => null,
  hjCyberGrid: HjCyberGrid,
  hjEraBarrier: HjEraBarrier,
  hjCyberTower: HjCyberTower,
  hjFloatingCar: HjFloatingCar,
  hjLunarBase: HjLunarBase,
  hjRetroCrew: HjRetroCrew,
  hjRetroStairs: HjRetroStairs,
  hjRift: HjRift,
  hjSkywalk: HjSkywalk,
  hjBlueGate: HjBlueGate,
  hjHanokBench: HjHanokBench,
  hjSnackSteam: HjSnackSteam,
  hjStoryCue: HjStoryCue,
  confessionWall: ConfessionWall, // 촬영지 '고백 담벼락' — 붉은 벽돌 + 담쟁이 + 전구줄
  summerShelter: SummerShelter, // 촬영지 '여름 정류장' — 민트·나무 정류장 + 포스터
  filmPortal: FilmPortal, // '영화 속으로 입장' 포털 (들어가면 레터박스 연출)

  hjBlossomGate: HjBlossomGate, // 구역 입구 벚꽃 전구줄 아치
  hjEntranceGate: HjEntranceGate, // 입장 트리거 (밟거나 클릭 → 환영 배너). arch:false면 바닥 띠만
  hjCurvedRoad: HjCurvedRoad, // 굽은 도로 (점선 중앙선 + 연석 + 인도)
  hjCrosswalk: HjCrosswalk,
  hjBrickBuilding: HjBrickBuilding, // 빈티지 벽돌 건물 (줄무늬 차양, SEOUL 1988 벽화)
  hjSea: HjSea, // 출렁이는 바다
  hjBreakwater: HjBreakwater, // 방파제 + 테트라포드
  hjLighthouse: HjLighthouse, // 빨강·흰 등대 (도는 불빛)
  hjBoat: HjBoat, // 고깃배
  hjCherryTree: HjCherryTree,
  hjStringLights: HjStringLights,
  hjAFrameSign: HjAFrameSign, // 입간판
  hjLantern: HjLantern, // 바닥 등롱
  hjFruitCart: HjFruitCart,
  hjCafeSet: HjCafeSet,
  hjMailbox: HjMailbox,
  hjBicycle: HjBicycle,
  hjCar: HjCar,
  hjPetals: HjPetals, // 흩날리는 꽃잎
}
