import { layout } from '../../data/mapData.js'
import { sharedSeconds } from '../../../components/movieZone/hjSync.js'

// 애니 구역 바다 전차가 경성역으로 들어갈 때 맞춰 달리는 경복궁 기차 — 담당: 지민 (11/27)
// 혜진 님 hj/HjTrainCars.jsx와 같은 값이어야 해요 (혜진 구역 파일은 안 고침):
//   터널에서 나와 22초(역에 가까울수록 천천히) → 경성역 정차 16초 → 22초 → 8초 쉼 = 68초
//   t = (서버 시각 + item.phase) % 68, 기차 기준점 z = route.start + (station - start) * (1 - (1 - t/22)²)
export const HJ_PERIOD = 68
export const HJ_IN = 22 // 터널 출발 → 경성역 도착(초)
export const HJ_DWELL = 16

const mod = (a, n) => ((a % n) + n) % n
// 바다 쪽 터널(gs_tunnel_s)에서 나와 경성역으로 가는 경복궁 기차: 시간표 시작점이 바다 쪽(월드 z가 가장 작은)인 기차
//   (혜진 쪽이 이름·방향을 바꿔도 따라감. destination이 있는 기차는 현대 서울로 가는 시간 열차라 빼요)
const worldZ = (p, local) => p.position[1] + ((p.rotationDeg ?? 0) % 360 === 180 ? -local : local)
export const HJ_ITEM = (() => {
  const trains = layout.props.filter((p) => p.style === 'hjSteamTrain' && p.route && !p.destination && Math.abs(p.position[0] + 46.6) < 6)
  return [...trains].sort((a, b) => worldZ(a, a.route.start) - worldZ(b, b.route.start))[0] ?? null
})()
export const HJ_PHASE = HJ_ITEM?.phase ?? 0
export const HJ_TRAIN = HJ_ITEM?.id ?? 'HJ/gs_train_2'
/** 경복궁 기차 시간표 안의 지금 초 (0 = 터널 안 출발점, HJ_IN = 경성역 도착). S를 주면 그 서버 시각 기준 */
export const hjTime = (S = sharedSeconds()) => mod(S + HJ_PHASE, HJ_PERIOD)
/** 시간표 t초(0 ~ HJ_IN + HJ_DWELL)일 때 기차 기준점의 월드 z (정차 뒤는 역 자리) */
export function hjRefZ(t) {
  const r = HJ_ITEM?.route ?? { start: -60, station: -16 }
  const k = Math.min(1, Math.max(0, t / HJ_IN))
  const pos = r.start + (r.station - r.start) * (1 - (1 - k) * (1 - k))
  return worldZ(HJ_ITEM ?? { position: [0, 260] }, pos)
}
/** 경복궁 기차 출발점의 월드 z와 그때 속도(m/s) — 내 전차가 이 자리·속도로 넘겨줘야 이어 달리는 것처럼 보임 */
export const HJ_START_Z = hjRefZ(0)
export const HJ_START_V = HJ_ITEM ? (2 * Math.abs(HJ_ITEM.route.station - HJ_ITEM.route.start)) / HJ_IN : 4
export const HJ_X = HJ_ITEM?.position[0] ?? -49.7
export const HJ_EXIT_SIDE = HJ_ITEM?.exitSide ?? 1

// ── (11/27 지민 요청: 30초 운행) 바다 전차가 경복궁 기차 시간표를 기다리지 않고 스스로 경성역까지 ──
//   터널 안 경복궁 기차 출발점에서 경성역 정차 자리까지 SEA_APPROACH_T초(역에 가까울수록 천천히) → SEA_DWELL초 정차 →
//   SEA_LEAVE_T초 동안 북쪽 터널로 떠남. 그동안 진짜 경복궁 기차(같은 선로)는 이 화면에서 잠깐 숨김 (jm_seaLine.jsx)
export const SEA_APPROACH_T = 10
export const SEA_DWELL = 14
export const SEA_LEAVE_T = 12
const R = HJ_ITEM?.route ?? { start: -60, station: -16, end: 68 }
const HJ_POS_Z = HJ_ITEM?.position[1] ?? 260
const ROT180 = (HJ_ITEM?.rotationDeg ?? 0) % 360 === 180
const toWorld = (pos) => HJ_POS_Z + (ROT180 ? -pos : pos)
/** 바다 전차(경복궁 기차 모양)의 기차 기준점 월드 z — t = 터널 안 출발점을 지난 뒤 초 */
export function seaRefZ(t) {
  if (t < SEA_APPROACH_T) {
    const k = Math.max(0, t / SEA_APPROACH_T)
    return toWorld(R.start + (R.station - R.start) * (1 - (1 - k) * (1 - k)))
  }
  if (t < SEA_APPROACH_T + SEA_DWELL) return toWorld(R.station)
  const u = Math.min(1, (t - SEA_APPROACH_T - SEA_DWELL) / SEA_LEAVE_T)
  return toWorld(R.station + (R.end - R.station) * u * u)
}
/** 출발점에서의 속도 (m/s) — 바다 구간 끝 속도를 여기에 맞춰야 이어 달리는 것처럼 보임 */
export const SEA_APPROACH_V = (2 * Math.abs(R.station - R.start)) / SEA_APPROACH_T
