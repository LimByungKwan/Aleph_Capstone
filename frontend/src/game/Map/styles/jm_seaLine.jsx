import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Box, GEO, Instances, mat } from './kit.jsx'
import { SeaTramCar, TRAM } from './jm_seaTram.jsx'
import { JmSeaStation, STATION, TICKET_SPOT } from './jm_seaStation.jsx'
import { WadeSplash } from './jm_water.jsx'
import { withMerge } from './jm_perf.jsx'
import { HjSteamTrain } from './hj/HjTrainCars.jsx'
import { layout } from '../../data/mapData.js'
import { remoteVehicle, sharedSeconds, useRemoteSeats } from '../../../components/movieZone/hjSync.js'
import { sendHj } from '../../multiplayer/realtimeStore.js'
import { GYEONGSEONG_ARRIVE } from '../../../components/movieZone/timeTravel.js'
import { registerVehicle, updateVehicleWorld, vehicles } from '../../../components/movieZone/rideSeats.js'
import { registerWarpSpot, usePalaceSeatStore } from '../../../components/movieZone/palaceSeating.js'
import { SeaRideView } from './jm_seaRide.jsx'
import { findPlayer } from '../../Player/findPlayer.js'
import { PRICE as TICKET_PRICE, RIDES as TICKET_RIDES, useSeaTicket } from './jm_seaTicket.js'
import { useWallet } from '../../../components/movieZone/wallet.js'
import { HJ_EXIT_SIDE, HJ_START_Z, HJ_TRAIN, HJ_X, SEA_APPROACH_T, SEA_APPROACH_V, SEA_DWELL, SEA_LEAVE_T, seaRefZ } from './jm_seaHj.js'

// 애니 구역(JM) 바다 철길 — 담당: 지민 (11/26, 11/27 E로 부르는 전차 + 산속 터널을 지나 경성역까지)
// 湯灯駅(애니 구역 바다 위 역) → 바다를 크게 돌아 → 북악산 기슭 터널 → 산속 터널 → 경성역 2번 선로(혜진 님 gs_tunnel_s 쪽)
//   ① 湯灯駅 부두에서 E「바다 전차 부르기」 → 전차가 바다 쪽에서 들어와 서고 문이 열림 (내 화면에만 있는 전차)
//   ② 타면(E) 「출발까지 N초」 → 문 닫히고 서서히 출발 → 바다를 돌아 산속 터널로
//      경성역에 들어가는 때를 혜진 님 경복궁 기차(HJ_TRAIN, 같은 선로) 시간표에 맞춤: 그 기차가 터널 안 출발점에서 떠나는 순간
//      내 기차가 그 자리에 그 속도로 닿게 달리는 시간을 늘였다 줄임 → 두 기차가 겹치지 않고 한 대처럼 이어짐
//   ③ 산속 터널 안(벽·천장·등불)에서 전차가 경복궁 증기기관차 모습으로 바뀜 (같은 좌석 자리로 옮겨 앉음)
//      → 터널을 나와 경복궁 기차와 똑같이 움직여(역에 가까울수록 천천히) 경성역에 섬
//      그 기차가 터널 밖으로 다 나오면 진짜 경복궁 기차의 같은 좌석으로 넘겨줌 (모양·자리가 같아서 티 안 남) → 경성역에서 E로 내림
//   - 진짜 경복궁 기차가 없으면(구역을 안 불러옴 등) 내 기차가 그대로 역에 서고 E로 내림, 출발 시각이 되면 승강장에 내려 줌
//   - 혜진 구역 파일은 안 고침(경복궁 기차 모양 HjSteamTrain은 불러다 씀). 시간표 숫자는 jm_seaHj.js
//   - 아무도 안 타면 40초 뒤 바다 쪽으로 떠나고, 다시 부를 수 있음
// item.line = { pts: [[x, z], ...] 경성역 쪽 터널 입구 → 湯灯駅 쪽 끝 (아이템 기준 좌표), station: 湯灯駅 서는 점 번호, mouthZ: 바다 쪽 터널 입구 z (아이템 기준) }


// ── 내 전차 운행 ──
const COME_DIST = 400 // 부르면 이만큼 바다 쪽에서 나타나 들어옴 (m)
const COME_T = 24 // 들어오는 시간(초)
const WAIT_MAX = 40 // 아무도 안 타면 이만큼 뒤 떠남
const DOOR_CLOSE = 2.5 // 출발 이만큼 전에 문 닫힘 (그 뒤로는 못 내림)
const BOARD_MIN = 10 // 첫 사람이 탄 뒤 이만큼 서 있다 출발 (11/27: 4초면 멀티에서 같이 탈 틈이 없었음)
// (11/27 지민 요청) 湯灯駅 → 산속 터널 안 경복궁 기차 출발점까지 30초. 경복궁 기차 시간표는 기다리지 않음
//   (예전: 같은 선로의 진짜 경복궁 기차와 시간을 맞추느라 1분 반~2분) → 우리 기차가 경복궁 기차 모양으로 스스로 경성역까지 가고,
//   그동안 진짜 경복궁 기차는 이 화면에서 잠깐 숨김
const RUN_T = 30
const ACC = 4 // 출발·감속 가속도 (m/s²) — 800m 넘는 바다 구간을 30초에 달리려면 빨리 붙고 빨리 줄여야 함
const CAR_LEN = TRAM.len
const CAR_W = TRAM.w
const CAR_GAP = 0.2
const CAR_OFF = CAR_LEN / 2 + CAR_GAP / 2
const RAIL_Y = 0.3 // 레일 윗면 (자갈 둑이 물결 바로 위로 살짝 드러나는 높이 → 바다 위를 달리는 철길)
const POLE_X = 4.5 // 전봇대: 선로 가운데에서 떨어진 거리 (湯灯駅 승강장 반대편)
const TUBE_W = 2.5 // 산속 터널 안 반폭
const TUBE_H = 3.2 // 벽 높이 (그 위 둥근 천장 반지름 TUBE_W)
// 경복궁 기차 모양(HjSteamTrain) 안 좌석: 1호 객차 셋째 줄(앞을 봄) 왼쪽 안쪽 자리 (hj/HjTrainCars.jsx coachSeats 'c2l0'과 같은 자리)
//   (11/27) 첫 줄(c0l0)은 객차 맨 뒤라 카메라가 끝벽 너머로 가서 어두웠음 → 뒤로 3m 여유가 있는 셋째 줄
const HJ_COACH_Z = -4.2
const HJ_SEAT = { id: 'c2l0', x: -0.55, y: 0.9 + 0.46, z: HJ_COACH_Z - 5.1 + 2 * 1.7 - 0.12, yaw: 0, taken: false }
// 경복궁 기차 모양의 좌석 전체 = hj/HjTrainCars.jsx coachSeats + loungeSeats와 같은 배치·id (여럿이 같이 타도 각자 자리로,
//   진짜 기차로 넘겨줄 때도 같은 id 자리로). 첫 자리는 HJ_SEAT(셋째 줄)부터
function hjCopySeats() {
  const list = []
  for (let i = 0; i < 7; i += 1) {
    const z = HJ_COACH_Z - 5.1 + i * 1.7
    const facing = i % 2 === 0 ? 1 : -1
    for (const side of [-1, 1]) {
      for (const k of [0, 1]) list.push({ id: `c${i}${side > 0 ? 'r' : 'l'}${k}`, x: side * (0.55 + k * 0.45), y: 0.9 + 0.46, z: z - facing * 0.12, yaw: facing > 0 ? 0 : Math.PI, taken: false })
    }
  }
  const LOUNGE_Z = -16.8
  for (let i = 0; i < 4; i += 1) {
    const zt = LOUNGE_Z - 4.2 + i * 2.6
    for (const side of [-1, 1]) {
      for (const f of [-1, 1]) list.push({ id: `l${i}${side > 0 ? 'r' : 'l'}${f > 0 ? 'b' : 'f'}`, x: side * 0.85, y: 0.9 + 0.45, z: zt - f * 0.75, yaw: f > 0 ? 0 : Math.PI, taken: false })
    }
  }
  const first = list.findIndex((st) => st.id === HJ_SEAT.id)
  return [list[first], ...list.filter((_, i) => i !== first)]
}

// 선을 0.5m 간격 점으로 (위치·방향·누적 길이) → 매 프레임 거리로 바로 찾기
function buildPath(line, offset) {
  const curve = new THREE.CatmullRomCurve3(line.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
  const total = curve.getLength()
  const n = Math.ceil(total / 0.5)
  const P = new Float32Array((n + 1) * 2)
  const D = new Float32Array((n + 1) * 2)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = curve.getPointAt(t)
    const d = curve.getTangentAt(t)
    P[i * 2] = p.x
    P[i * 2 + 1] = p.z
    const l = Math.hypot(d.x, d.z) || 1
    D[i * 2] = d.x / l
    D[i * 2 + 1] = d.z / l
  }
  const step = total / n
  const near = (x, z) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i <= n; i++) {
      const dd = (P[i * 2] - x) ** 2 + (P[i * 2 + 1] - z) ** 2
      if (dd < bd) {
        bd = dd
        best = i
      }
    }
    return best * step
  }
  const sStation = near(...line.pts[line.station])
  let sMouth = 0
  for (let i = 0; i <= n; i++) {
    if (P[i * 2 + 1] < line.mouthZ) {
      sMouth = i * step
      break
    }
  }
  const at = (s, out) => {
    const f = Math.min(n, Math.max(0, s / step))
    const i = Math.min(n - 1, Math.floor(f))
    const u = f - i
    out.x = P[i * 2] + (P[i * 2 + 2] - P[i * 2]) * u
    out.z = P[i * 2 + 1] + (P[i * 2 + 3] - P[i * 2 + 1]) * u
    out.dx = D[i * 2] + (D[i * 2 + 2] - D[i * 2]) * u
    out.dz = D[i * 2 + 1] + (D[i * 2 + 3] - D[i * 2 + 1]) * u
    const l = Math.hypot(out.dx, out.dz) || 1
    out.dx /= l
    out.dz /= l
    return out
  }
  // 경복궁 기차가 터널 안에서 출발하는 자리 (월드 → 아이템 기준)
  const sJoin = near(HJ_X - offset[0], HJ_START_Z - offset[1])
  // 모양 바꾸는 곳 (11/27 지민 요청: 산 터널에 들어가자마자): 두 량이 막 다 들어간 자리 = 차 밖 카메라가 차 안으로 돌아오는 때
  const sSwap = Math.max(sJoin + 2, sMouth + 1 - (CAR_LEN + CAR_GAP / 2) - 0.3)
  return { total, sStation, sMouth, sJoin, sSwap, at, step }
}

// 출발 계획: 지금 S초에 탔으면 언제 출발해서 몇 초 동안 달릴지
//   경복궁 기차 출발점에 닿는 때가 그 기차 시간표 0초가 되도록
function planRun(S) {
  const runFrom = S + BOARD_MIN
  return { runFrom, runD: RUN_T, arrive: runFrom + RUN_T }
}

// 달린 거리: 서서히 빨라져(ACC) 같은 속도로 달리다 서서히 줄여 끝 속도 v1로 dist만큼, 딱 T초에
function runCurve(dist, T, v1) {
  const B = T + v1 / ACC
  const disc = B * B - (4 * (dist + (v1 * v1) / (2 * ACC))) / ACC
  const vc = disc > 0 ? ((B - Math.sqrt(disc)) * ACC) / 2 : dist / T
  const ta = vc / ACC
  const td = Math.max(0, (vc - v1) / ACC)
  const tc = Math.max(0, T - ta - td)
  const d1 = 0.5 * ACC * ta * ta
  const d2 = d1 + vc * tc
  return (t) => {
    if (t <= 0) return 0
    if (t < ta) return 0.5 * ACC * t * t
    if (t < ta + tc) return d1 + vc * (t - ta)
    const u = Math.min(t - ta - tc, td)
    return Math.min(dist, d2 + vc * u - 0.5 * ACC * u * u)
  }
}

// ── 바다 철길 겉모습 ──
const RAIL_M = mat('#2b2622', { roughness: 0.5, metalness: 0.45 })
const SLEEPER_M = mat('#3b2e24')
const BED_M = mat('#77716a', { roughness: 1 })
const POLE_M = mat('#4a3a2c')
const PORTAL_STONE = mat('#8e877b', { roughness: 0.95 })
const PORTAL_RED = mat('#9a3a2a', { roughness: 0.8 })
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })

// 레일·전선처럼 선을 따라가는 가는 막대 (윗면 + 양옆)
function stripGeometry(path, from, to, offset, lat, y, w, h) {
  const pos = []
  const idx = []
  const o = {}
  const n = Math.max(2, Math.ceil((to - from) / 1))
  for (let i = 0; i <= n; i++) {
    const s = from + ((to - from) * i) / n
    path.at(s, o)
    const nx = -o.dz
    const nz = o.dx
    const off = offset(s) + lat
    const cx = o.x + nx * off
    const cz = o.z + nz * off
    for (const [k, yy] of [[-1, y], [1, y], [1, y + h], [-1, y + h]]) pos.push(cx + nx * k * (w / 2), yy, cz + nz * k * (w / 2))
    if (i > 0) {
      const a = (i - 1) * 4
      const b = i * 4
      // 윗면(2-3), 바깥 옆면(1-2), 안쪽 옆면(3-0)
      for (const [p, q] of [[3, 2], [2, 1], [0, 3]]) idx.push(a + p, a + q, b + p, b + p, a + q, b + q)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function mergeGeometries(list) {
  const pos = []
  const idx = []
  for (const g of list) {
    const base = pos.length / 3
    pos.push(...g.attributes.position.array)
    for (const i of g.index.array) idx.push(base + i)
    g.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function SeaTrack({ path }) {
  const { rails, bed, wire, sleepers, poles, arms } = useMemo(() => {
    const from = 3 // 경성역 쪽 끝 3m는 혜진 님 2번 선로(gs_railway_2)와 겹침 → 거기서부터 이어짐
    const to = path.total
    const out = path.sMouth + 4 // 전봇대·전선은 바다 쪽 터널 밖에만
    const zero = () => 0
    const sleepers = []
    const o = {}
    const railGeos = [-0.72, 0.72].map((lat) => stripGeometry(path, from, to, zero, lat, RAIL_Y - 0.08, 0.09, 0.08))
    const bed = stripGeometry(path, from, to, zero, 0, -0.2, 3.2, 0.32) // 자갈 둑
    for (let s = from; s <= to; s += 0.9) {
      path.at(s, o)
      sleepers.push({ p: [o.x, RAIL_Y - 0.13, o.z], s: [2.3, 0.1, 0.24], r: [0, Math.atan2(o.dx, o.dz), 0] })
    }
    // 전봇대: 16m마다 한쪽에, 팔은 가운데 위 전선까지
    const poles = []
    const arms = []
    for (let s = out + 6; s <= to; s += 16) {
      path.at(s, o)
      const nx = -o.dz
      const nz = o.dx
      poles.push({ p: [o.x + nx * POLE_X, 3, o.z + nz * POLE_X], s: [0.18, 6, 0.18] })
      arms.push({ p: [o.x + (nx * POLE_X) / 2, 5.6, o.z + (nz * POLE_X) / 2], s: [POLE_X + 0.3, 0.1, 0.1], r: [0, Math.atan2(o.dx, o.dz), 0] })
    }
    const wire = stripGeometry(path, out, to, zero, 0, 5.42, 0.03, 0.03)
    return { rails: mergeGeometries(railGeos), bed, wire, sleepers, poles, arms }
  }, [path])
  useEffect(() => () => { rails.dispose(); bed.dispose(); wire.dispose() }, [rails, bed, wire])
  return (
    <group>
      <mesh geometry={rails} material={RAIL_M} receiveShadow />
      <mesh geometry={bed} material={BED_M} receiveShadow />
      <Instances geometry={GEO.box} material={SLEEPER_M} items={sleepers} />
      <Instances geometry={GEO.box} material={POLE_M} items={poles} castShadow />
      <Instances geometry={GEO.box} material={POLE_M} items={arms} />
      <mesh geometry={wire} material={RAIL_M} />
    </group>
  )
}

// ── 산속 터널 (바다 쪽 입구 → 경성역 쪽 혜진 님 터널 입구): 돌 바닥·벽·둥근 천장, 아치 띠, 등불(발광만, 점광원 없음) ──
const TUBE_STONE = mat('#4a443d', { roughness: 1, double: true })
const TUBE_RIB = mat('#6b6358', { roughness: 1, double: true })
const TUBE_FLOOR = mat('#2f2b27', { roughness: 1 })
const TUBE_LAMP = mat('#ffe2a8', { emissive: '#ffc070', emissiveIntensity: 1.6 })
// 반원통 천장: 축 = 로컬 z(길이 방향), 위쪽 반만. 크기 [반지름, 반지름, 길이]
const VAULT_GEO = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2)
function TunnelTube({ path }) {
  const parts = useMemo(() => {
    const floor = []
    const walls = []
    const vault = []
    const ribArcs = []
    const ribPosts = []
    const lamps = []
    const o = {}
    const to = path.sMouth - 0.3 // 바다 쪽 입구 얼굴 바로 안쪽까지 (앞으로 튀어나오지 않게)
    const SEG = 3
    for (let s = 0; s < to; s += SEG) {
      const len = Math.min(SEG, to - s)
      path.at(s + len / 2, o)
      const yaw = Math.atan2(o.dx, o.dz)
      const nx = Math.cos(yaw)
      const nz = -Math.sin(yaw)
      floor.push({ p: [o.x, -0.02, o.z], s: [TUBE_W * 2, 0.26, len + 0.05], r: [0, yaw, 0] }) // 윗면 0.11: 산 밑으로 이어진 바닷물(높이 ~0.05)이 비치지 않게
      for (const k of [-1, 1]) walls.push({ p: [o.x + nx * k * TUBE_W, TUBE_H / 2, o.z + nz * k * TUBE_W], s: [0.3, TUBE_H, len + 0.05], r: [0, yaw, 0] })
      // 둥근 천장: 반원통(축 = 선로 방향)
      vault.push({ p: [o.x, TUBE_H, o.z], s: [TUBE_W, TUBE_W, len + 0.05], r: [0, yaw, 0] })
    }
    for (let s = 4; s < to - 1; s += 8) {
      path.at(s, o)
      const yaw = Math.atan2(o.dx, o.dz)
      const nx = Math.cos(yaw)
      const nz = -Math.sin(yaw)
      ribArcs.push({ p: [o.x, TUBE_H, o.z], s: [TUBE_W - 0.12, TUBE_W - 0.12, 0.5], r: [0, yaw, 0] })
      for (const k of [-1, 1]) ribPosts.push({ p: [o.x + nx * k * (TUBE_W - 0.12), TUBE_H / 2, o.z + nz * k * (TUBE_W - 0.12)], s: [0.2, TUBE_H, 0.5], r: [0, yaw, 0] })
      const k = Math.round(s / 8) % 2 ? 1 : -1
      lamps.push({ p: [o.x + nx * k * (TUBE_W - 0.2), 2.7, o.z + nz * k * (TUBE_W - 0.2)], s: [0.18, 0.26, 0.18], r: [0, yaw, 0] })
    }
    return { floor, walls, vault, ribArcs, ribPosts, lamps }
  }, [path])
  return (
    <group>
      <Instances geometry={GEO.box} material={TUBE_FLOOR} items={parts.floor} />
      <Instances geometry={GEO.box} material={TUBE_STONE} items={parts.walls} />
      <Instances geometry={VAULT_GEO} material={TUBE_STONE} items={parts.vault} />
      <Instances geometry={VAULT_GEO} material={TUBE_RIB} items={parts.ribArcs} />
      <Instances geometry={GEO.box} material={TUBE_RIB} items={parts.ribPosts} />
      <Instances geometry={GEO.box} material={TUBE_LAMP} items={parts.lamps} />
    </group>
  )
}

// 북악산 기슭 바다 쪽 터널 입구 얼굴 — 가운데가 뚫려 있어 안쪽 터널이 보임. 앞(-z)이 바다(선이 나아가는 쪽)를 봄
const MOUTH_DARK = new THREE.MeshBasicMaterial({ color: '#0b0a09' })
const OPEN_W = 4.0
const OPEN_H = 5.3
function PortalInner({ path }) {
  const p = useMemo(() => path.at(path.sMouth, {}), [path])
  const yaw = Math.atan2(-p.dx, -p.dz)
  const side = (9 - OPEN_W) / 2
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, yaw, 0]}>
      {[-1, 1].map((k) => (
        <Box key={k} p={[k * (OPEN_W / 2 + side / 2), 3.1, -0.1]} s={[side, 6.2, 0.8]} m={PORTAL_STONE} />
      ))}
      <Box p={[0, (OPEN_H + 6.2) / 2, -0.1]} s={[OPEN_W, 6.2 - OPEN_H, 0.8]} m={PORTAL_STONE} />
      <Box p={[0, 6.35, -0.15]} s={[9.6, 0.35, 1.1]} m={PORTAL_RED} />
      {/* 붉은 문틀 */}
      {[-1, 1].map((k) => (
        <Box key={k} p={[k * (OPEN_W / 2 + 0.12), OPEN_H / 2, -0.56]} s={[0.3, OPEN_H, 0.14]} m={PORTAL_RED} />
      ))}
      <Box p={[0, OPEN_H + 0.1, -0.56]} s={[OPEN_W + 0.54, 0.3, 0.14]} m={PORTAL_RED} />
      {/* 바깥(바다 쪽)에서만 보이는 어두운 굴 막: 입구 근처에 혜진 님 산 표면·나무 밑동이 터널 안으로 들어와 있어서 가림.
          한쪽 면만 그려서 터널 안에서는 바깥이 보이고, 전차는 그대로 통과함 */}
      <mesh position={[0, OPEN_H / 2, -0.4]} rotation={[0, Math.PI, 0]} material={MOUTH_DARK}>
        <planeGeometry args={[OPEN_W, OPEN_H]} />
      </mesh>
      {/* 입구와 산속 터널 사이 짧은 통로 */}
      {[-1, 1].map((k) => (
        <Box key={`w${k}`} p={[k * (OPEN_W / 2 + 0.15), OPEN_H / 2, 1.5]} s={[0.3, OPEN_H, 3]} m={TUBE_STONE} />
      ))}
      <Box p={[0, OPEN_H + 0.1, 1.5]} s={[OPEN_W + 0.6, 0.2, 3]} m={TUBE_STONE} />
    </group>
  )
}

// 입구도 안 움직이니 합쳐 그림
const Portal = withMerge(PortalInner)

// ── 바다 전차 (두 량) ──
// 좌석: -x 쪽 긴 의자 7자리(+x 보고), +x 쪽(문 쪽) 문 사이 의자 4자리(-x 보고). y = 앉는 면
function carSeats() {
  const y = TRAM.floor + 0.5
  // x = 쿠션 가운데 (jm_seaTram.jsx 긴 의자: 벽에서 0.36 안쪽, 깊이 0.56). (11/27) 쿠션 앞 끝(0.62)이라 몸이 의자에서 떨어져 보였음
  // 첫 자리는 차 가운데(문 앞이 아니게, 터널에서 카메라가 뒤로 3m 물러나도 차 안) → 가운데부터 양옆으로
  const left = [0, -1.1, 1.1, -2.2, 2.2, -3.3, 3.3].map((z, i) => ({ id: `b${i}`, x: -CAR_W / 2 + 0.38, y, z, yaw: Math.PI / 2, taken: false }))
  const right = [-0.65, 0.65, -1.95, 1.95].map((z, i) => ({ id: `d${i}`, x: CAR_W / 2 - 0.38, y, z, yaw: -Math.PI / 2, taken: false }))
  return [...left, ...right]
}

// 앉은 사람을 다른 탈것 좌석으로 옮김. prefer: 좌석 id 끝이 같은 자리를 먼저 (같은 모양 기차끼리 자리 그대로)
function moveRider(seat, target, prefer) {
  const free = (prefer && target?.seats?.find((s) => !s.taken && s.id.endsWith(`/${prefer}`))) || target?.seats?.find((s) => !s.taken)
  if (!free) return false
  seat.taken = false
  free.taken = true
  usePalaceSeatStore.setState({ seated: free, nearby: null, requested: false })
  return true
}

// 湯灯駅 부두의 「E 바다 전차 부르기」 자리. palaceSeating의 오르내리는 자리(warp spot) 목록에 한 번만 올림
//   (지울 수 없는 목록이라, 코드가 다시 불려도 같은 물건을 계속 쓰고 내용만 바꿈)
const CALL = globalThis.__jmSeaCall ?? (globalThis.__jmSeaCall = { id: 'jm_sea_call', position: [0, -999, 0], radius: 0, prompt: '', action: () => {} })
registerWarpSpot(CALL)
function setCallPrompt(prompt, radius) {
  if (CALL.prompt === prompt && CALL.radius === radius) return
  CALL.prompt = prompt
  CALL.radius = radius
  // 안내 글자가 바뀌면 한 프레임 비워서 다시 잡게 (palaceSeating은 같은 물건이면 다시 안 그림)
  if (usePalaceSeatStore.getState().nearby === CALL) usePalaceSeatStore.setState({ nearby: null })
}

// 湯灯駅에 서서 문을 열었을 때만 켜는 전차 바닥·벽·발판 충돌 (11/27: 열린 문으로 걸어 들어가면 바닥 아래로 빠졌음)
//   물리 몸체는 <Physics> 안에서만 만들 수 있어서 Scene.jsx가 JmSeaTramColliders를 그림 (jm_guestLift와 같은 방식)
//   poses: 역에 선 두 량의 [월드 x, 레일 높이 y, z, 방향] — 처음 한 번 계산
export const seaTramDock = (() => {
  const subs = new Set()
  const dock = {
    active: false,
    poses: [],
    station: null, // 승강장 [월드 x, y, z, 방향] — 처음 자리 계산 때 채움
    sub: (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    get: () => dock.active,
    set: (v) => {
      if (dock.active === v) return
      dock.active = v
      subs.forEach((f) => f())
    },
    setStation: (v) => {
      dock.station = v
      subs.forEach((f) => f())
    },
  }
  return dock
})()
const DOOR_SEGS = [[-CAR_LEN / 2, -TRAM.doorZ - TRAM.doorW / 2], [-TRAM.doorZ + TRAM.doorW / 2, TRAM.doorZ - TRAM.doorW / 2], [TRAM.doorZ + TRAM.doorW / 2, CAR_LEN / 2]]
// 맵 서쪽 벽 밖으로 나간 선로 옆 물 밑 바닥(jm_sea_walk_w, opensBoundary)의 둘레 벽: 벽 밖 부분의 북·남·서쪽
//   (맵 벽에는 Colliders.jsx westWallSegments가 이 바닥 폭만큼 구멍을 냄 → 여기서 막지 않으면 바다로 떨어짐)
const WALK_W = layout.props.find((r) => r.id === 'JM/jm_sea_walk_w') ?? null
function WalkPocketWalls() {
  if (!WALK_W) return null
  const [gw] = layout.ground.size
  const [gcx] = layout.ground.center ?? [0, 0]
  const westEdge = gcx - gw / 2
  const [x, z] = WALK_W.position
  const [w, , d] = WALK_W.size
  const x0 = x - w / 2
  if (x0 >= westEdge) return null
  const len = westEdge - x0
  const H = 5
  return (
    <RigidBody type="fixed" colliders={false} name="JM/sea_walk_walls">
      {[-1, 1].map((k) => (
        <CuboidCollider key={k} args={[len / 2, H / 2, 0.5]} position={[x0 + len / 2, H / 2, z + k * (d / 2 + 0.5)]} />
      ))}
      <CuboidCollider args={[0.5, H / 2, d / 2 + 1]} position={[x0 - 0.5, H / 2, z]} />
    </RigidBody>
  )
}
// 물튐 구간 (월드): 물 밑 걷는 바닥 jm_sea_walk_w의 맵 안쪽 끝(옛 부두 자리 x -69)부터 승강장 동쪽 계단(x -150)까지, 선로 양옆 폭 9m
// ── 선착장 → 湯灯駅 정강이 깊이 물 (11/27) ──
//   땅(높이 0) 위 바다 물이 0.05라 물이 신발 바닥에도 안 닿아 "판 위를 걷는" 느낌이었고, 옛 얕은 물 띠(0.12)와 높이도 달랐음
//   → 선로를 따라 한 줄로 물 높이 WADE_Y의 얕은 물: 색은 그 자리 바다(jm_ocean) 정점 색, 가장자리는 투명하게 녹여 바다와 이어짐,
//     물결·움직임 없음. 자갈 둑은 물에 잠기고 레일 윗면(0.3)만 물 위로 살짝 (참고: 물에 잠긴 선로를 걷는 장면)
const WADE_Y = 0.28
const WADE = { x0: -150.5, x1: -31, z: -215, half: 4.6, fadeSide: 2.6, fadeEnd: 3, alpha: 0.62 } // 월드 좌표
const WALK_SPLASH = { x: (WADE.x0 + WADE.x1) / 2, z: WADE.z, w: WADE.x1 - WADE.x0, len: WADE.half * 2 - 1, y: WADE_Y + 0.01 }
const WADE_M = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.35, metalness: 0.05, depthWrite: false })
function WadeWater({ offset }) {
  const scene = useThree((st) => st.scene)
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    let alive = true
    let tries = 0
    // 바다 판이 먼저 그려져야 색을 읽을 수 있어서, 생길 때까지 잠깐씩 기다림
    const build = () => {
      if (!alive) return
      const ocean = scene.getObjectByName('jm-ocean')
      if (!ocean && tries++ < 40) return void setTimeout(build, 250)
      // 띠 둘레(+3m) 안의 바다 정점만 골라 두고, 띠 정점마다 가장 가까운 바다 정점 색을 씀
      const near = []
      if (ocean) {
        ocean.updateWorldMatrix(true, false)
        const pa = ocean.geometry.attributes.position
        const ca = ocean.geometry.attributes.color
        const v = new THREE.Vector3()
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(ocean.matrixWorld)
          if (v.x > WADE.x0 - 6 && v.x < WADE.x1 + 6 && Math.abs(v.z - WADE.z) < WADE.half + 6) near.push([v.x, v.z, ca.getX(i), ca.getY(i), ca.getZ(i)])
        }
      }
      const NX = Math.ceil((WADE.x1 - WADE.x0) / 1)
      const NZ = 12
      const pos = []
      const col = []
      const idx = []
      for (let j = 0; j <= NZ; j++)
        for (let i = 0; i <= NX; i++) {
          const x = WADE.x0 + ((WADE.x1 - WADE.x0) * i) / NX
          const dz = -WADE.half + (2 * WADE.half * j) / NZ
          let best = null
          let bd = Infinity
          for (const n of near) {
            const d = (n[0] - x) ** 2 + (n[1] - WADE.z - dz) ** 2
            if (d < bd) {
              bd = d
              best = n
            }
          }
          const [r, g, b] = best ? [best[2], best[3], best[4]] : [0.16, 0.34, 0.45]
          const side = Math.min(1, (WADE.half - Math.abs(dz)) / WADE.fadeSide)
          const end = Math.min(1, (x - WADE.x0) / WADE.fadeEnd, (WADE.x1 - x) / WADE.fadeEnd)
          const a = Math.max(0, Math.min(side, end))
          pos.push(x - offset[0], WADE_Y, WADE.z + dz - offset[1])
          col.push(r, g, b, WADE.alpha * a * a * (3 - 2 * a))
          if (i < NX && j < NZ) {
            const k = j * (NX + 1) + i
            idx.push(k, k + NX + 1, k + 1, k + 1, k + NX + 1, k + NX + 2)
          }
        }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
      g.setIndex(idx)
      g.computeVertexNormals()
      setGeo(g)
    }
    build()
    return () => {
      alive = false
    }
  }, [scene, offset])
  useEffect(() => () => geo?.dispose(), [geo])
  if (!geo) return null
  return <mesh geometry={geo} material={WADE_M} renderOrder={2} userData={{ noMerge: true }} />
}
function StationCollider() {
  const p = seaTramDock.station
  if (!p) return null
  const [x, y, z, yaw] = p
  const cx = STATION.edge + STATION.width / 2
  return (
    <RigidBody type="fixed" colliders={false} position={[x, y, z]} rotation={[0, yaw, 0]} name="JM/sea_station">
      <CuboidCollider args={[STATION.width / 2, STATION.top / 2 + 0.15, STATION.len / 2]} position={[cx, STATION.top / 2 - 0.15, 0]} />
      {/* 여관 쪽 끝 계단 (jm_seaStation.jsx Platform) */}
      {[0, 1, 2].map((i) => (
        <CuboidCollider key={i} args={[STATION.width / 2 - 0.3, 0.125, 0.2]} position={[cx, (STATION.top * (3 - i)) / 4 - 0.1, STATION.len / 2 + 0.35 + i * 0.4]} />
      ))}
    </RigidBody>
  )
}
export function JmSeaTramColliders() {
  const active = useSyncExternalStore(seaTramDock.sub, seaTramDock.get)
  // 승강장은 처음 자리 계산(첫 프레임) 뒤에 생김 → 그때 한 번 다시 그리게 station도 구독 값에 섞음
  useSyncExternalStore(seaTramDock.sub, () => seaTramDock.station)
  const fl = TRAM.floor
  if (!active || !seaTramDock.poses.length) return [<StationCollider key="st" />, <WalkPocketWalls key="pw" />]
  return [<StationCollider key="st" />, <WalkPocketWalls key="pw" />, ...seaTramDock.poses.map(([x, y, z, yaw], i) => (
    <RigidBody key={i} type="fixed" colliders={false} position={[x, y, z]} rotation={[0, yaw, 0]} name="JM/sea_tram_dock">
      {/* 바닥 (윗면 = 차 바닥) */}
      <CuboidCollider args={[CAR_W / 2, 0.1, CAR_LEN / 2]} position={[0, fl - 0.1, 0]} />
      {/* -x 옆벽(문 없음), +x 옆벽(문 두 곳 비움), 앞뒤 끝벽 */}
      <CuboidCollider args={[0.06, 1.25, CAR_LEN / 2]} position={[-CAR_W / 2, fl + 1.25, 0]} />
      {DOOR_SEGS.map(([a, b]) => (
        <CuboidCollider key={a} args={[0.06, 1.25, (b - a) / 2]} position={[CAR_W / 2, fl + 1.25, (a + b) / 2]} />
      ))}
      {[-1, 1].map((e) => (
        <CuboidCollider key={e} args={[CAR_W / 2, 1.25, 0.06]} position={[0, fl + 1.25, (e * CAR_LEN) / 2]} />
      ))}
      {/* 문 밖 발판 (부두 0.75 → 발판 → 차 바닥, 한 번에 높지 않게) */}
      {[-TRAM.doorZ, TRAM.doorZ].map((dz) => (
        <CuboidCollider key={dz} args={[0.3, 0.05, TRAM.doorW / 2]} position={[CAR_W / 2 + 0.3, fl - 0.27, dz]} />
      ))}
    </RigidBody>
  ))]
}

// ── 멀티 (11/27) ──
// 바다 전차 운행은 "부른 시각·출발 시각·터널 시각" 몇 개로 정해지고 움직임은 서버 시계(sharedSeconds)로 계산됨
//   → 운행 중인 화면은 그 시각들을 혜진 님 탈것 메시지(hj.veh, 서버 hj_world.js가 중계, 서버는 안 고침)에 실어 보냄
//   → 받은 화면은 같은 운행으로 맞춤 → 모든 화면에서 같은 전차가 같은 때 같은 자리에 (같이 타면 서로 좌석에 앉아 보임)
//   hj.veh는 숫자 3개(±1000)와 r(±100)만 받아서: p = [부른·출발·터널 시각을 1000으로 나눈 나머지], r = 단계 번호
//   맞추는 규칙: 내가 없음(idle)이면 받은 운행으로 / 먼저 부른 운행이 이김 / 같은 운행이면 더 나아간 단계(누가 타서 출발 대기)로
const SYNC_ID = 'jmsea.train'
const PHASES = ['idle', 'coming', 'waiting', 'hold', 'run', 'arrive', 'away']
const RUNNING = new Set(['hold', 'run', 'arrive'])
// 1000으로 나눈 나머지 m → 지금(S)에 가장 가까운 시각
const nearestAbs = (S, m) => S + ((((m - S) % 1000) + 1500) % 1000) - 500
const mod1000 = (t) => ((t % 1000) + 1000) % 1000

// ride.phase: idle(없음) → coming(들어오는 중) → waiting(문 열고 기다림) → hold(탔음, 출발 대기) → run(달림) → arrive(경복궁 기차로 경성역까지) → idle
//             waiting에서 아무도 안 타면 → away(떠남) → idle
// ride.form: 'tram'(바다 전차) | 'hj'(경복궁 기차 모양) — 산속 터널 안 sSwap에서 바뀜
const HJ_COPY_ITEM = {
  ride: false, // 이 모양은 좌석 등록 안 함 (내 좌석은 아래 copyVehicle)
  route: { start: 0, station: 0, end: 0, clip: [-1e4, 1e4] }, // 움직임은 바깥 그룹을 내가 옮김
  exitSide: HJ_EXIT_SIDE,
}
// 모양 쪽 시계(HjTrainCars: t = (서버 시각 + phase) % 68)가 늘 10초(달리는 중)이게 — 60~68초면 "쉼"이라 통째로 숨어서
//   (11/27 리뷰) 30초 운행으로 바뀐 뒤 운행 시각이 그 구간과 겹치면 손님이 허공에 앉아 터널·경성역을 지났음
const makeCopyItem = (id) => {
  const it = { ...HJ_COPY_ITEM, id }
  Object.defineProperty(it, 'phase', { get: () => 10 - (((sharedSeconds() % 68) + 68) % 68) })
  return it
}
function SeaTrainRun({ item, path, runs }) {
  const cars = useRef([])
  const blockers = useRef([])
  const copy = useRef(null)
  const doors = useRef([[], []])
  const offset = item.position ?? [0, 0]
  const carVehicles = useMemo(
    () => [0, 1].map((c) => ({ id: `${item.id}/train/car${c}`, label: '바다 전차', fare: null, stopped: false, quietWhileMoving: true, w: CAR_W, l: CAR_LEN, reach: 3, seats: [] })),
    [item.id],
  )
  // reach 0: 경성역 승강장에서 이 기차에 새로 타지 못하게 (내리기만)
  const copyVehicle = useMemo(() => ({ id: `${item.id}/train/hj`, label: '기차', fare: null, stopped: false, quietWhileMoving: true, w: 2.8, l: 46, reach: 0, seats: [] }), [item.id])
  const seatDefs = useMemo(() => [carSeats(), carSeats()], [])
  const copySeats = useMemo(() => hjCopySeats(), [])
  const copyItem = useMemo(() => makeCopyItem(`${item.id}/hjcopy`), [item.id])
  const ride = useMemo(() => ({ phase: 'idle', form: 'tram', t0: 0, waitUntil: 0, awayAt: 0, called: false, runFrom: 0, runD: 0, arrive: 0, curve: null, s: path.sStation, open: 0, callPlaced: false }), [path])
  useEffect(() => {
    const off = [...carVehicles, copyVehicle].map((v) => registerVehicle(v))
    return () => off.forEach((f) => f())
  }, [carVehicles, copyVehicle])
  useEffect(() => {
    CALL.action = () => {
      if (ride.phase !== 'idle') return
      // 회수권이 없거나 5칸 다 썼으면 → 발매기에서 사기 (코인). 다 쓴 표가 남아 있으면 먼저 완주 도장
      const ticket = useSeaTicket.getState()
      if (!ticket.valid()) {
        ticket.finishIfFull()
        ticket.buy()
        return
      }
      ride.phase = 'coming'
      ride.form = 'tram'
      ride.t0 = sharedSeconds()
      ride.called = true // 부른 사람 화면이 운행 시각을 보냄
    }
    return () => {
      CALL.action = () => {}
      setCallPrompt('', 0)
    }
  }, [ride])
  // 매 프레임 새로 만들지 않고 다시 쓰는 것들 (11/27 최적화: 쓰레기 수거 때 끊김 줄이기)
  const tmp = useMemo(() => ({ o: {}, v: new THREE.Vector3(), w: new THREE.Vector3(), remote: new Set(), real: null, realAt: -1, hid: false, idleDone: false, out: {}, p: [0, 0, 0], sentAt: 0, stExit: null, prompt: '' }), [])
  // 진짜 경복궁 기차를 내가 숨긴 채 사라지면(저장·구역 이동) 되돌려 놓기
  useEffect(() => () => {
    if (tmp.hid && tmp.real) tmp.real.visible = true
  }, [tmp])
  const prefix = `${item.id}/train/`
  useFrame(({ scene }, dt) => {
    const S = sharedSeconds()
    const seated = usePalaceSeatStore.getState().seated
    const onTram = Boolean(seated?.vehicle && carVehicles.includes(seated.vehicle))
    const onCopy = seated?.vehicle === copyVehicle
    const mine = onTram || onCopy
    const L = path.sStation

    // ── 멀티: 다른 사람이 탄 좌석 · 다른 화면의 운행 맞추기 ──
    const remoteSeatIds = tmp.remote
    remoteSeatIds.clear()
    const rseats = useRemoteSeats.getState().seats
    for (const k in rseats) if (rseats[k]?.seat?.startsWith(prefix)) remoteSeatIds.add(rseats[k].seat)
    const remoteOnMine = remoteSeatIds.size > 0
    const rv = remoteVehicle(SYNC_ID)
    const rPhase = rv ? PHASES[Math.round(rv.r)] : null
    // (11/27 리뷰) 끊긴 뒤 1.5초 동안 남는 옛 메시지: 이미 끝난 운행·떠나는 전차는 받지 않음
    const r = rPhase && rPhase !== 'idle' && rPhase !== 'away' ? { phase: rPhase, t0: nearestAbs(S, rv.p[0]), runFrom: nearestAbs(S, rv.p[1]), arrive: nearestAbs(S, rv.p[2]) } : null
    // waiting 동안 p[1] = 떠날 시각(안에 사람이 서 있으면 늘어남). 옛 화면은 t0를 보내니 최소 기본값
    const rWait = r ? Math.max(r.runFrom, r.t0 + COME_T + WAIT_MAX) : 0
    const rOver = r && ((r.phase === 'arrive' && S > r.arrive + SEA_APPROACH_T + SEA_DWELL + SEA_LEAVE_T) || (r.phase === 'waiting' && S > rWait))
    if (r && !rOver) {
      let adopt = false
      if (ride.phase === 'idle') adopt = true
      else if (Math.abs(r.t0 - ride.t0) > 0.3) adopt = r.t0 < ride.t0
      else if (RUNNING.has(r.phase) && (ride.phase === 'coming' || ride.phase === 'waiting')) adopt = true
      else if (ride.phase === 'hold' && r.phase === 'hold' && r.runFrom < ride.runFrom - 0.3) adopt = true
      if (!adopt && ride.phase === 'waiting' && r.phase === 'waiting' && Math.abs(r.t0 - ride.t0) <= 0.3) ride.waitUntil = Math.max(ride.waitUntil, rWait)
      if (adopt) {
        Object.assign(ride, { phase: r.phase, t0: r.t0, waitUntil: r.phase === 'waiting' ? rWait : r.t0 + COME_T + WAIT_MAX })
        if (RUNNING.has(r.phase)) {
          Object.assign(ride, { runFrom: r.runFrom, arrive: r.arrive, runD: r.arrive - r.runFrom })
          ride.curve = runCurve(L - path.sJoin, ride.runD, SEA_APPROACH_V)
        }
      }
    }


    // 부르는 자리: 역에 선 전차의 문 앞(부두 위). 처음 한 번 월드 좌표로 계산
    const parent = cars.current[0]?.parent
    if (!ride.callPlaced && parent) {
      parent.updateWorldMatrix(true, false) // 막 붙은 첫 프레임엔 월드 행렬이 아직 안 정해졌을 수 있음
      const o = path.at(L, tmp.o)
      const yaw = Math.atan2(o.dx, o.dz)
      // 부르는 자리 = 승차권 발매기 앞 (역 기준 좌표 → 월드). 차 기준 +x(승강장 쪽) = 월드 (cos yaw, -sin yaw), +z = (sin yaw, cos yaw)
      const [tx, , tz] = TICKET_SPOT
      const ax = tx - 0.9 // 발매기 앞 (승강장 가운데 쪽)
      tmp.v.set(o.x + Math.cos(yaw) * ax + Math.sin(yaw) * tz, 0, o.z - Math.sin(yaw) * ax + Math.cos(yaw) * tz)
      parent.localToWorld(tmp.v)
      CALL.position = [tmp.v.x, STATION.top + 0.95, tmp.v.z]
      // 승강장 바닥 충돌용 (역 기준 원점 = 선로 위 역 점)
      const so = parent.localToWorld(new THREE.Vector3(o.x, 0, o.z))
      seaTramDock.setStation([so.x, so.y, so.z, yaw])
      // 역에 선 두 량 자리 (바닥 충돌용)
      seaTramDock.poses = [1, -1].map((k) => {
        const c = path.at(L + k * CAR_OFF, {})
        const w = parent.localToWorld(new THREE.Vector3(c.x, RAIL_Y, c.z))
        return [w.x, w.y, w.z, Math.atan2(c.dx, c.dz)]
      })
      ride.callPlaced = true
    }
    // 코드가 다시 불려(개발 중 저장 등) 운행 기록이 사라졌는데 예전 전차 좌석에 앉아 있으면 → 湯灯駅 부두에 내려 줌
    //   (그대로 두면 사라진 좌석에 묶여 공중에 멈추거나 선로에 떨어짐)
    if (seated?.vehicle && !mine && String(seated.vehicle.id ?? '').startsWith(`${item.id}/train`)) seated.vehicle.forceExit = CALL.position
    // 문 열고 서 있는 동안 차 안에 서 있으면(앉지 않고 걸어 들어옴) 떠나지 않고 기다림
    let inside = false
    const pl = (ride.phase === 'waiting' || ride.phase === 'hold') && findPlayer(scene)
    if (pl) {
      pl.getWorldPosition(tmp.v)
      for (const g of cars.current) {
        if (!g) continue
        const lp = g.worldToLocal(tmp.w.copy(tmp.v))
        if (Math.abs(lp.x) < CAR_W / 2 && Math.abs(lp.z) < CAR_LEN / 2 && lp.y > 0.3) inside = true
      }
    }

    // ── 운행 단계 ──
    let stopped = false
    let copyStopped = false
    let copyForceExit = null
    let hjT = -1 // arrive 단계의 경복궁 기차 시간표 초
    switch (ride.phase) {
      case 'idle':
        break
      case 'coming': {
        const k = Math.min(1, (S - ride.t0) / COME_T)
        ride.s = L - COME_DIST * (1 - k) * (1 - k) // 역에 가까울수록 천천히
        if (k >= 1) {
          ride.phase = 'waiting'
          ride.waitUntil = ride.t0 + COME_T + WAIT_MAX // 부른 시각으로 정함 → 모든 화면에서 같은 때 떠남
        }
        break
      }
      case 'waiting':
        ride.s = L
        stopped = true
        if (onTram) {
          Object.assign(ride, planRun(S), { phase: 'hold' })
          ride.curve = runCurve(L - path.sJoin, ride.runD, SEA_APPROACH_V)
        } else if (inside) {
          ride.waitUntil = Math.max(ride.waitUntil, S + 8)
        } else if (S > ride.waitUntil) {
          ride.phase = 'away'
          ride.awayAt = S // t0(부른 시각)는 그대로: 다른 화면과 같은 운행인지 가리는 값
        }
        break
      case 'hold':
        ride.s = L
        stopped = S < ride.runFrom - DOOR_CLOSE
        if (!onTram && !remoteOnMine && stopped) {
          // 출발 전에 내림 → 다시 기다림
          ride.phase = 'waiting'
          ride.waitUntil = S + WAIT_MAX
        } else if (S >= ride.runFrom) {
          ride.phase = 'run'
          if (onTram) useSeaTicket.getState().punch() // 출발할 때 차장 검표: 회수권 한 칸
        }
        break
      case 'run':
        ride.s = L - ride.curve(S - ride.runFrom)
        if (S >= ride.runFrom + ride.runD) {
          ride.s = path.sJoin
          ride.phase = 'arrive'
        }
        break
      case 'arrive': {
        // 경복궁 기차 모양으로 경성역까지: SEA_APPROACH_T초 들어가 서고 → SEA_DWELL초 정차(E로 내림) → 북쪽 터널로 떠남
        hjT = S - ride.arrive
        if (hjT > SEA_APPROACH_T + SEA_DWELL + SEA_LEAVE_T) {
          ride.phase = 'idle'
          break
        }
        copyStopped = hjT >= SEA_APPROACH_T && hjT < SEA_APPROACH_T + SEA_DWELL
        if (copyStopped && copyVehicle.exit) {
          // 값만 옮겨 적음 (살아 있는 exit 배열을 넘기면 다음에 기차가 옮겨질 때 같이 바뀜 → 터널 속에 내려졌음)
          const e = (tmp.stExit ??= [0, 0, 0])
          e[0] = copyVehicle.exit[0]
          e[1] = copyVehicle.exit[1]
          e[2] = copyVehicle.exit[2]
        }
        // 떠날 때까지 안 내렸으면 경성역 승강장에 내려 줌 (보통은 jm_seaRide가 떠나기 직전에 먼저 내려 줌)
        if (hjT >= SEA_APPROACH_T + SEA_DWELL && onCopy) copyForceExit = tmp.stExit ?? GYEONGSEONG_ARRIVE
        break
      }
      case 'away': {
        const k = Math.min(1, (S - ride.awayAt) / COME_T)
        ride.s = L - COME_DIST * k * k
        if (k >= 1) ride.phase = 'idle'
        break
      }
    }
    // 산속 터널 안에서 모양 바꾸기: 전차 → 경복궁 기차 (탄 사람은 같은 자리로)
    //   (11/27) 화면이 느리면(탭 전환·창 가림) 한 프레임에 몇 초씩 건너뛰어 run → arrive로 바로 넘어가며 바꾸기를 놓쳤음
    //   → 사라진 전차 좌석에 손님이 남아 터널 공중에 멈춤. arrive에서도 바꾸고, 아직 전차 좌석이면 다시 옮김
    if ((ride.phase === 'run' || ride.phase === 'arrive') && ride.form === 'tram' && ride.s <= path.sSwap) ride.form = 'hj'
    if (ride.form === 'hj' && onTram && (ride.phase === 'run' || ride.phase === 'arrive')) {
      // 전차 좌석마다 옮겨 갈 자리를 정해 둠 (같이 탄 사람들이 같은 순간 옮겨도 서로 다른 자리 → 겹쳐 안 보이던 문제)
      const ci = carVehicles.indexOf(seated.vehicle)
      const si = seated.vehicle.seats.indexOf(seated)
      const pair = copySeats[(ci * seatDefs[0].length + Math.max(0, si)) % copySeats.length]
      moveRider(seated, copyVehicle, pair.id)
    }
    if (ride.phase === 'idle' || ride.phase === 'coming') ride.form = 'tram'
    // 그래도 운행이 끝났는데(idle) 좌석에 남아 있으면 → 전차는 湯灯駅 승강장, 경복궁 기차 모양은 그 자리 승강장 쪽에 내려 줌
    const tramForceExit = ride.phase === 'idle' && onTram ? CALL.position : null
    if (ride.phase === 'idle' && onCopy) copyForceExit = tmp.stExit ?? GYEONGSEONG_ARRIVE
    if (ride.phase === 'idle' && !onCopy) {
      ride.called = false
      tmp.stExit = null
    }

    // 부르는 자리 안내 (전차가 서 있으면 palaceSeating이 「바다 전차 타기」를 먼저 띄움)
    if (ride.phase === 'idle') {
      const ticket = useSeaTicket.getState()
      const valid = ticket.valid()
      const n = valid ? ticket.left() : useWallet.getState().coins
      const key = valid ? n : -1 - n
      if (tmp.prompt !== key) {
        tmp.prompt = key // 바뀔 때만 글자를 새로 만듦
        setCallPrompt(
          valid ? `🚃 바다 전차 부르기 · 회수권 ${n}/${TICKET_RIDES}` : `🎫 바다 전차 회수권 사기 · ${TICKET_RIDES}회 · 코인 ${TICKET_PRICE}개 (가진 코인 ${n})`,
          3.2,
        )
      }
    } else if (ride.phase === 'coming') setCallPrompt('🚃 바다 전차가 오고 있어요…', 3.2)
    else if (ride.phase === 'run' || ride.phase === 'arrive' || ride.phase === 'hold') setCallPrompt('🚃 전차가 떠났어요 · 잠시 뒤 다시 부를 수 있어요', 3.2)
    else setCallPrompt('', 0)
    if (ride.phase !== 'idle') tmp.prompt = ''

    // 문: 서 있으면 열림, 출발 전 닫힘
    const want = stopped ? 1 : 0
    ride.open += Math.sign(want - ride.open) * Math.min(Math.abs(want - ride.open), Math.min(dt, 0.1) / 1.2)

    const tramShown = ride.form === 'tram' && ride.phase !== 'idle'
    seaTramDock.set(stopped)
    // (11/27 최적화) 전차가 없고 아무도 안 탔으면: 한 번 숨기고 정리한 뒤로는 차·좌석·문 계산을 건너뜀 (좌석 66개 위치 계산 등)
    const busy = ride.phase !== 'idle' || mine || remoteOnMine
    if (!busy && tmp.idleDone) return
    tmp.idleDone = !busy
    for (let c = 0; c < 2; c++) {
      const g = cars.current[c]
      if (!g) continue
      // c=0: 湯灯駅 쪽 칸, c=1: 터널 쪽 칸
      const sc = ride.s + (c === 0 ? 1 : -1) * CAR_OFF
      const o = path.at(sc, tmp.o)
      g.position.set(o.x, RAIL_Y, o.z)
      g.rotation.y = Math.atan2(o.dx, o.dz)
      g.visible = tramShown
      // 카메라 가림막: 내가 이 전차에 앉아 있을 때만 제자리. 아니면 땅 밑으로 치움
      //   (공용 카메라는 처음 모아 둔 가림막을 보이든 안 보이든 계속 부딪힘 → 역 근처에서 카메라가 뒤통수에 붙었음)
      if (blockers.current[c]) blockers.current[c].position.y = onTram ? 0 : -500
      const v = carVehicles[c]
      v.stopped = stopped
      v.forceExit = tramForceExit
      updateVehicleWorld(v, g, seatDefs[c], [CAR_W / 2 + 1.6, 0.6, 0])
      // 다른 사람이 앉은 좌석은 차 있음으로 (같은 자리에 겹쳐 앉지 않게)
      for (const st of v.seats) st.taken = st === seated || remoteSeatIds.has(st.id)
      const d = doors.current[c]
      for (let i = 0; i < 4; i++) {
        if (!d[i]) continue
        const center = i < 2 ? -TRAM.doorZ : TRAM.doorZ
        d[i].position.z = center + (i % 2 ? 1 : -1) * (0.3 + ride.open * 0.58)
      }
    }
    // 경복궁 기차 모양: run 동안은 내 선로를 따라(터널 안), arrive부터는 경복궁 기차와 같은 식으로 경성역까지
    const cg = copy.current
    if (cg) {
      // 막 바뀐 때는 경복궁 기차 꼬리(라운지차)가 아직 바다 쪽 입구 밖에 있음 → 탄 사람(차 안 시점)에게만 보이고,
      //   밖에서 보는 사람(같이 안 탄 사람)에게는 꼬리까지 다 들어간 뒤부터 보이게
      const tailIn = ride.s + 23.5 < path.sMouth
      const copyShown = ride.form === 'hj' && (ride.phase === 'run' || ride.phase === 'arrive') && (onCopy || tailIn || ride.phase === 'arrive')
      if (ride.phase === 'arrive') {
        cg.position.set(HJ_X - offset[0], 0, seaRefZ(hjT) - offset[1])
        cg.rotation.y = 0
      } else {
        // 쓰지 않을 때는 산속 터널 안 출발점에 둠 (이 모양 안 점광원이 엉뚱한 데를 비추지 않게).
        //   바뀐 뒤(hj)엔 안 보여도 선로를 따라감 — 그사이 옮겨 앉은 다른 손님이 터널 한 점에 멈춰 보이지 않게
        const o = path.at(ride.form === 'hj' ? ride.s : path.sJoin, tmp.o)
        cg.position.set(o.x, 0, o.z)
        cg.rotation.y = Math.atan2(-o.dx, -o.dz) // 앞 = 경성역 쪽 (선의 거꾸로)
      }
      cg.visible = copyShown
      // 우리 기차가 경복궁 기차 모양으로 터널·경성역에 있는 동안: 같은 선로의 진짜 경복궁 기차(혜진 님)를 이 화면에서만 잠깐 숨김
      //   (겹치지 않게. 혜진 님 기차 시간표·좌석은 그대로, 보이기만 끔). 장면 전체를 매 프레임 훑지 않게 한 번 찾아 둠
      const hideReal = ride.form === 'hj' && (ride.phase === 'run' || ride.phase === 'arrive')
      // 못 찾았을 때 장면 전체(수만 개)를 매 프레임 훑지 않게 0.5초에 한 번만
      if ((hideReal || tmp.hid) && !tmp.real?.parent && S - tmp.realAt > 0.5) {
        tmp.realAt = S
        tmp.real = scene.getObjectByName(HJ_TRAIN) ?? null
      }
      // 내가 숨긴 것만 되돌림 (남이 꺼 둔 걸 켜지 않게)
      if (tmp.real && hideReal && tmp.real.visible) {
        tmp.real.visible = false
        tmp.hid = true
      } else if (tmp.real && !hideReal && tmp.hid) {
        tmp.real.visible = true
        tmp.hid = false
      }
      copyVehicle.stopped = copyStopped
      copyVehicle.forceExit = copyForceExit
      updateVehicleWorld(copyVehicle, cg, copySeats, [HJ_EXIT_SIDE * (2.8 / 2 + 1.7), 0.45, HJ_COACH_Z])
      for (const st of copyVehicle.seats) st.taken = st === seated || remoteSeatIds.has(st.id)
    }
    // 탈 때 화면 연출(jm_seaRide.jsx)이 읽는 값
    // 멀티: 운행 중이면 운행 시각을 보냄 (서버 모드에서만 실제로 나감, 0.1초 간격)
    //   (11/27 리뷰) 공용 sendVehicle은 모든 탈것이 0.1초 창 하나를 같이 써서, 이게 먼저 부르면 인력거·차·레일바이크 위치가 안 나갔음
    //   → 따로 0.3초 간격, 탄 사람·부른 사람 화면만
    if (ride.phase !== 'idle' && (mine || ride.called) && S - tmp.sentAt >= 0.3) {
      tmp.sentAt = S
      const p = tmp.p
      p[0] = mod1000(ride.t0)
      p[1] = mod1000(ride.phase === 'waiting' || ride.phase === 'coming' ? ride.waitUntil || ride.t0 : ride.runFrom || ride.t0)
      p[2] = mod1000(ride.arrive || ride.t0)
      sendHj({ t: 'hj.veh', v: SYNC_ID, p, r: PHASES.indexOf(ride.phase) })
    }

    // 바다 구간 차 밖 카메라(jm_seaRide.jsx)용: 두 량 가운데(월드)와 선 방향
    const mid = path.at(ride.s, tmp.o)
    if (parent) parent.localToWorld(tmp.v.set(mid.x, RAIL_Y, mid.z))
    const out = tmp.out
    out.ride = ride
    out.mine = mine
    out.onCopy = onCopy
    out.hjT = hjT
    out.S = S
    out.sJoin = path.sJoin
    out.sStation = L
    out.sMouth = path.sMouth
    out.center = tmp.v
    out.dx = mid.dx
    out.dz = mid.dz
    runs[0] = out
  })
  return (
    <>
      {[0, 1].map((c) => (
        <group key={c} ref={(el) => (cars.current[c] = el)} visible={false}>
          <SeaTramCar head={c === 0 ? 1 : -1} number={c + 1} pantograph={c === 0} bellows={c === 0} doorRefs={doors.current[c]} />
          {/* 3인칭 카메라가 차 벽·지붕을 뚫지 않게 (FollowCamera가 이름으로 찾음). 탔을 때만 제자리 (위 useFrame) */}
          <group ref={(el) => (blockers.current[c] = el)} position={[0, -500, 0]}>
            {[-1, 1].map((s) => (
              <mesh key={s} name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[s * (CAR_W / 2 - 0.02), TRAM.floor + 1.4, 0]} scale={[0.06, 3.2, CAR_LEN]} />
            ))}
            <mesh name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[0, TRAM.floor + 2.9, 0]} scale={[CAR_W, 0.06, CAR_LEN]} />
          </group>
        </group>
      ))}
      <group ref={copy} visible={false}>
        <HjSteamTrain item={copyItem} />
      </group>
    </>
  )
}

export function JmSeaLine({ item }) {
  const path = useMemo(() => buildPath(item.line, item.position ?? [0, 0]), [item.line, item.position])
  const runs = useMemo(() => [null], [])
  if (import.meta.env.DEV) window.__jmSeaLine = { path, runs }
  const st = useMemo(() => path.at(path.sStation, {}), [path])
  const offsetMemo = useMemo(() => item.position ?? [0, 0], [item.position])
  return (
    <group>
      <SeaTrack path={path} />
      <TunnelTube path={path} />
      <Portal path={path} />
      <group position={[st.x, 0, st.z]} rotation={[0, Math.atan2(st.dx, st.dz), 0]}>
        <JmSeaStation />
      </group>
      <SeaTrainRun item={item} path={path} runs={runs} />
      {/* 선착장 → 湯灯駅 계단: 정강이 깊이 물 + 걸으면 물방울·물결 고리 (둑도 물에 잠겨서 한 높이로 충분) */}
      <WadeWater offset={offsetMemo} />
      <group position={[WALK_SPLASH.x - offsetMemo[0], 0, WALK_SPLASH.z - offsetMemo[1]]}>
        <WadeSplash w={WALK_SPLASH.w} len={WALK_SPLASH.len} y={WALK_SPLASH.y} />
      </group>
      <SeaRideView runs={runs} />
    </group>
  )
}

// ── 땅 메우기: 바다 윤곽(jm_ocean)을 서쪽으로 민 자리에 맵 바깥 풀밭과 같은 색 땅 ──
// item.fill.pts: [[x, z], ...] 아이템 기준 다각형. 물(jmOcean)·모래가 이 위에 그려지도록 깊이를 살짝 뒤로 (jm_water.jsx OCEAN_M이 더 앞)
const FILL_M = new THREE.MeshStandardMaterial({ color: '#789957', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
export function JmLandFill({ item }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(item.fill.pts.map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [item.fill])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={FILL_M} position={[0, item.fill.y ?? 0.044, 0]} receiveShadow userData={{ noMerge: true }} />
}

// jmSeaWalk: 湯灯駅 가는 물 밑 바닥 — 그림 없음 (충돌 상자는 Colliders.jsx가 size·elevation으로 만듦)
const JmSeaWalk = () => null
export const JM_SEALINE_STYLES = { jmSeaLine: JmSeaLine, jmLandFill: JmLandFill, jmSeaWalk: JmSeaWalk }
