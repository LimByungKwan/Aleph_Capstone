import ConfessionWall from './ConfessionWall.jsx'
import SummerShelter from './SummerShelter.jsx'
import HjBrickBuilding from './HjBuildings.jsx'
import HjBlossomGate from './HjGate.jsx'
import HjEntranceGate from './HjEntranceGate.jsx'
import { HjPortHouse, HjVillageGate, HjVillageWall } from './HjCoastalVillage.jsx'
import { HjFoxAltar, HjMoonForest } from './HjMoonForest.jsx'
import HjPalace from './HjPalace.jsx'
import HjGyeongbokgung from './HjGyeongbokgung.jsx' // main 버전 (지금 맵에선 안 씀)
import HjGyeongbokPalace from './HjGyeongbokPalace.jsx'
import {
  HjBanner,
  HjGlobeLamp,
  HjMarketStall,
  HjPlatform,
  HjPowerLine,
  HjRailCrossing,
  HjTramStop,
  HjTunnelPortal,
  HjRailway,
  HjVerticalSign,
  HjVintageCar,
} from './HjGyeongseongStreet.jsx'
import HjSeoulStation from './HjSeoulStation.jsx'
import HjGovernmentGeneral from './HjGovernmentGeneral.jsx'
import { HjTramExhibit } from './HjTramCar.jsx'
import { HjSteamTrain } from './HjTrainCars.jsx'
import HjTree from './HjTree.jsx'
import HjRickshawRide from './HjRickshawRide.jsx'
import HjDrivableCar from './HjDrivableCar.jsx'
import { HjAdColumn, HjClockTower, HjCultureHouse, HjGasLamp, HjGovernmentHall, HjModernBuilding, HjRickshaw, HjStation, HjTram, HjTramLine } from './HjGyeongseong.jsx'
import { HjAnalogHanok, HjAnalogLabel, HjGoldenSet } from './HjAnalogSet.jsx'
import { HjBoat, HjBreakwater, HjLighthouse, HjSea } from './HjHarbor.jsx'
import { HjBugaksan } from './HjBugaksan.jsx'
import HjThemePark from './HjThemePark.jsx'
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
  // 1930년대 경성 거리 (HjGyeongseong.jsx)
  hjGyeongbokPalace: HjGyeongbokPalace, // 압축 경복궁 (배치: gyeongbokLayout.js)
  hjGyeongbokgung: HjGyeongbokgung, // main 버전 경복궁 (지금 맵에선 안 씀)
  hjModernBuilding: HjModernBuilding, // 근대 석조·벽돌 상가 (돔·원기둥·극장 간판)
  hjStation: HjStation, // 돔 지붕 역사 + 시계
  hjTramLine: HjTramLine, // 전차 선로 + 가공선
  hjTram: HjTram, // 오가는 전차 (실내 포함)
  hjTramExhibit: HjTramExhibit, // 들어가 볼 수 있는 전시 전차
  hjGasLamp: HjGasLamp,
  hjRickshaw: HjRickshaw,
  hjRickshawRide: HjRickshawRide, // 타는 인력거 (인력거꾼 + 목적지 고르기, 길: rickshawRoutes.js)
  hjAdColumn: HjAdColumn, // 광고탑
  hjClockTower: HjClockTower, // 광장 시계탑
  // 경성 거리 2탄 (HjGyeongseongStreet.jsx)
  hjSeoulStation: HjSeoulStation, // 경성역 (붉은 벽돌 + 초록 돔 + 장미창)
  hjRailway: HjRailway, // 기차길 (bedOnly면 자갈 둑만)
  hjTunnelPortal: HjTunnelPortal, // 기차 터널 입구
  hjRailCrossing: HjRailCrossing, // 선로 건널목
  hjTramStop: HjTramStop, // 전차 정류장 안전지대
  hjSteamTrain: HjSteamTrain, // 증기기관차 + 객차
  hjPlatform: HjPlatform, // 승강장
  hjPowerLine: HjPowerLine, // 전신주 + 전깃줄 (points)
  hjGlobeLamp: HjGlobeLamp, // 방울 가로등
  hjVerticalSign: HjVerticalSign, // 세로 간판
  hjBanner: HjBanner, // 세로 깃발
  hjMarketStall: HjMarketStall, // 노점
  hjVintageCar: HjVintageCar, // 클래식 자동차
  hjDrivableCar: HjDrivableCar, // 직접 운전하는 클래식 자동차 (다니는 곳: driveArea.js)
  hjGovernmentGeneral: HjGovernmentGeneral, // 조선총독부 (들어갈 수 있는 청사, 배치: govLayout.js)
  hjGovernmentHall: HjGovernmentHall, // 총독부 청사 (돔 탑 석조 관청)
  hjCultureHouse: HjCultureHouse, // 문화주택(2층 양옥)
  hjPalace: HjPalace,
  hjFoxAltar: HjFoxAltar,
  hjMoonForest: HjMoonForest,
  hjPortHouse: HjPortHouse,
  hjVillageGate: HjVillageGate,
  hjVillageWall: HjVillageWall,
  hjAnalogHanok: HjAnalogHanok,
  hjAnalogLabel: HjAnalogLabel,
  hjGoldenSet: HjGoldenSet,
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

  hjBlossomGate: HjBlossomGate, // 구역 입구 벚꽃 전구줄 아치
  hjEntranceGate: HjEntranceGate, // 입장 트리거 (밟거나 클릭 → 환영 배너). arch:false면 바닥 띠만
  hjCurvedRoad: HjCurvedRoad, // 굽은 도로 (점선 중앙선 + 연석 + 인도)
  hjCrosswalk: HjCrosswalk,
  hjBrickBuilding: HjBrickBuilding, // 빈티지 벽돌 건물 (줄무늬 차양, SEOUL 1988 벽화)
  hjSea: HjSea, // 출렁이는 바다
  hjThemePark: HjThemePark, // 해월 드림파크 (경복궁 동쪽: 놀이기구·열기구·사파리)
  hjBugaksan: HjBugaksan, // 경복궁 뒤 북악산·인왕산·북한산 (경성거리 북쪽 맵 바깥)
  hjBreakwater: HjBreakwater, // 방파제 + 테트라포드
  hjLighthouse: HjLighthouse, // 빨강·흰 등대 (도는 불빛)
  hjBoat: HjBoat, // 고깃배
  hjCherryTree: HjCherryTree,
  hjTree: HjTree, // 계절 따라 바뀌는 나무 (kind: oak 정자나무 · linden 가로수 · maple 단풍)
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
