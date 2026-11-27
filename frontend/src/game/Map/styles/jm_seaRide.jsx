import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { requestPalaceWarp, usePalaceSeatStore } from '../../../components/movieZone/palaceSeating.js'
import { GYEONGSEONG_ARRIVE } from '../../../components/movieZone/timeTravel.js'
import { useZoneEntryStore } from '../../../components/movieZone/zoneEntryStore.js'
import { layout } from '../../data/mapData.js'
import { findPlayer } from '../../Player/findPlayer.js'
import { SEA_APPROACH_T, SEA_DWELL } from './jm_seaHj.js'
import { RIDES as TICKET_RIDES, useSeaTicket } from './jm_seaTicket.js'

// 애니 구역(JM) 바다 전차를 탔을 때 화면 연출 — 담당: 지민 (11/26, 11/27 다시 짬)
//   ① 오른쪽 위 안내판: 湯灯駅 ━━🚃━━ 경성역 진행 막대 + 「출발까지 N초」「경성역까지 약 N초」
//   ② 가운데 안내 문구: 문 닫힘 → 출발 → 바다 → 터널 → 경복궁 구역 → 곧 도착 → 도착(E로 내림)
//   카메라: 바다 구간은 차 밖에서 전차를 따라감(B안) → 터널부터는 공용 3인칭(차 안). 화면을 가리는 암전 없음. 무게: 3D 물체 없음 (화면 위 글자 판)
//   ③ (11/27 지민 제보) 경성역에 내린 뒤 갑자기 시작 지점(광장)으로 옮겨졌다는 문제: 혼자 모드에선 다시 안 나타나서 원인 미확인
//      → 내린 뒤 6초 안에 캐릭터가 시작 지점 근처로 튀면 경성역 승강장으로 되돌리고 콘솔에 기록을 남김
const CAPTION_SEC = 3.6
// 바다 구간 차 밖 카메라 모양: back 뒤로 · side 옆으로(음수 = 전봇대 반대쪽) · up 위로 · ahead 앞쪽 바라볼 점 · lookUp 바라볼 높이 (m)
//   window = 차 안 창가 (앉은 캐릭터 어깨 너머로 창밖)
//   개발 중 비교용: 콘솔에서 window.__jmSeaCamMode = 'high' | 'side' | 'back' | 'window'
export const SEA_CAM_MODES = {
  high: { back: 17, side: -7, up: 7.5, ahead: 6, lookUp: 1.5 }, // 11/27 B안 첫 모양 (공중에서 내려다봄)
  side: { back: 1, side: -8.5, up: 2.2, ahead: 4, lookUp: 1.6, k: 6 }, // 옆에서 나란히 (창 높이) — 굽은 길에서 안 놓치게 빨리 따라감
  back: { back: 13, side: -1.6, up: 3.0, ahead: 16, lookUp: 1.8 }, // 뒤에서 낮게 따라감 (선로 앞쪽을 봄)
  front: { back: -15, side: -3, up: 2.4, ahead: -6, lookUp: 1.4, k: 5 }, // 앞에서 다가오는 전차를 봄
  window: null,
}
const SEA_CAM_DEFAULT = 'back'
// (11/27 지민 요청) 바다 구간은 여러 각도로 바뀌며 보여 줌: 湯灯駅 → 터널 입구까지 간 거리 비율에 따라 장면을 끊어 바꿈
//   뒤(출발) → 위(바다를 크게 도는 모습) → 뒤(터널로) → 입구에서 멈춰 들어가는 모습
// (11/27) 창가 장면은 차 안 벽·창틀이 카메라와 같이 움직여 사진처럼 멈춰 보여서 빼고, 30초 운행에 맞춰 각도를 3개로
const SEA_SHOTS = [
  [0.4, 'back'],
  [0.74, 'high'],
  [1, 'back'],
]
// 터널에서 차 안 캐릭터 시점으로 돌아올 때: 공용 FollowCamera와 같은 바라보는 높이, 거리 3m(공용 최소), 18° 위에서
const LOOK_HEIGHT = 0.6
const RETURN_DIST = 3
const AUTO_EXIT_BEFORE = 1.2 // 경성역에서 기차가 떠나기 이만큼(초) 전에 자동으로 내려 줌
const RETURN_TILT = (18 * Math.PI) / 180
const ORANGE = '#ffb36b'
const GUARD_SEC = 6
const SPAWN = layout.playerStart // [x, z] 시작 지점 (Player.jsx PLAYER_SPAWN과 같은 자리)

function makeOverlay() {
  const root = document.createElement('div')
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147482000;font-family:system-ui,sans-serif'
  const board = document.createElement('div')
  board.style.cssText =
    'position:absolute;right:16px;top:76px;width:min(360px,calc(100vw - 32px));box-sizing:border-box;' +
    'padding:10px 16px 11px;border-radius:14px;background:rgba(24,18,14,0.82);color:#f6ead2;box-shadow:0 6px 22px rgba(0,0,0,0.28);' +
    'opacity:0;transition:opacity 0.4s,top 0.4s'
  board.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:700;letter-spacing:0.03em">' +
    '<span>湯灯駅 <small style="opacity:.65;font-weight:600">유토역</small></span><span data-k="title" style="font-size:11px;opacity:.7;font-weight:600"></span>' +
    '<span>京城駅 <small style="opacity:.65;font-weight:600">경성역</small></span></div>' +
    '<div style="position:relative;height:16px;margin:7px 4px 6px">' +
    '<div style="position:absolute;left:0;right:0;top:7px;height:3px;border-radius:2px;background:rgba(246,234,210,0.22)"></div>' +
    `<div data-k="fill" style="position:absolute;left:0;top:7px;height:3px;border-radius:2px;background:${ORANGE};width:0%"></div>` +
    '<div style="position:absolute;left:-4px;top:4px;width:9px;height:9px;border-radius:50%;background:#f6ead2"></div>' +
    '<div style="position:absolute;right:-4px;top:4px;width:9px;height:9px;border-radius:50%;border:2px solid #f6ead2;box-sizing:border-box;background:#18120e"></div>' +
    '<div style="position:absolute;left:80%;top:2px;width:2px;height:13px;background:rgba(246,234,210,0.35)"></div>' +
    '<div data-k="dot" style="position:absolute;top:-3px;left:0%;transform:translateX(-50%);font-size:16px;line-height:1">🚃</div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;white-space:nowrap"><span data-k="status" style="font-weight:700"></span><span data-k="hint" style="opacity:.6;overflow:hidden;text-overflow:ellipsis"></span></div>'
  const cap = document.createElement('div')
  cap.style.cssText =
    'position:absolute;left:50%;top:44%;transform:translateX(-50%);padding:10px 22px;border-radius:999px;width:max-content;max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;' +
    'background:rgba(20,16,12,0.74);color:#f6ead2;font:600 17px/1.35 system-ui,sans-serif;letter-spacing:0.02em;text-align:center;word-break:keep-all;' +
    'opacity:0;transition:opacity 0.5s'
  root.append(board, cap)
  document.body.appendChild(root)
  const q = (k) => board.querySelector(`[data-k="${k}"]`)
  return { root, board, cap, fill: q('fill'), dot: q('dot'), status: q('status'), hint: q('hint'), title: q('title') }
}

export function SeaRideView({ runs }) {
  const ui = useMemo(() => ({ el: null, camOn: false, journey: false, far: false, said: new Set(), capUntil: 0, endAt: 0, last: {}, exit: null, guard: null }), [])
  const tmp = useMemo(() => ({ c: new THREE.Vector3(), f: new THREE.Vector3(), want: new THREE.Vector3(), wantLook: new THREE.Vector3(), cam: new THREE.Vector3(), lk: new THREE.Vector3() }), [])
  useEffect(() => {
    ui.el = makeOverlay()
    return () => {
      ui.el.root.remove()
      ui.el = null
    }
  }, [ui])

  useFrame(({ camera, clock, scene, controls }, dt) => {
    const el = ui.el
    if (!el) return
    const now = clock.elapsedTime
    const run = runs[0]
    const seated = usePalaceSeatStore.getState().seated
    const onMine = Boolean(run?.mine)
    const once = (key, text) => {
      if (ui.said.has(key)) return
      ui.said.add(key)
      el.cap.textContent = text
      ui.capUntil = now + CAPTION_SEC
    }
    const set = (k, v) => {
      if (ui.last[k] === v) return
      ui.last[k] = v
      if (k === 'fill') el.fill.style.width = v
      else if (k === 'dot') el.dot.style.left = v
      else if (k === 'top') el.board.style.top = v
      else if (k === 'boardOp') el.board.style.opacity = v
      else if (k === 'capOp') el.cap.style.opacity = v
      else el[k].textContent = v
    }

    // 여정 시작 / 끝
    if (onMine && !ui.journey) {
      ui.journey = true
      ui.far = false
      ui.autoExit = false
      ui.said.clear()
      ui.endAt = 0
      once('board', '🚃 바다 전차에 탔어요 · 경성역(경복궁) 방면')
    }
    if (ui.journey && !onMine && !ui.endAt) {
      // 내림: 湯灯駅에서 출발 전에 내렸거나, 경성역에 내렸거나
      if (ui.far) {
        // 회수권 5칸을 다 썼으면 「5회 완주」 도장 (표 카드가 뜸) — 아니면 보통 도착 문구
        if (!useSeaTicket.getState().finishIfFull()) once('end', '경성역에 내렸어요 · 역 앞에서 전차를 타면 경복궁 쪽으로 가요')
        ui.guard = { until: now + GUARD_SEC, exit: GYEONGSEONG_ARRIVE }
      }
      ui.endAt = now + 2.5
    }
    if (ui.endAt && now > ui.endAt) {
      ui.journey = false
      ui.endAt = 0
    }

    let progress = 0
    let title = '바다 전차'
    // 경성역까지 가는 마지막 구간: 터널 안 출발점을 지난 뒤 t초 (경복궁 기차 모양)
    let hjT = -1
    let atStation = false
    if (onMine) {
      const { ride, S } = run
      if (ride.form === 'hj') title = '경복궁 기차'
      if (ride.phase === 'hold') {
        const left = Math.ceil(ride.runFrom - S)
        set('status', left > 2 ? `출발까지 ${left}초` : '출입문이 닫힙니다')
        const tk = useSeaTicket.getState()
        set('hint', left > 2 ? `회수권 ${tk.left()}/${TICKET_RIDES} · 출발 때 검표` : '')
        if (S >= ride.runFrom - 2.5) once('close', '출입문이 닫힙니다 · 곧 출발해요')
      } else if (ride.phase === 'run') {
        progress = 0.8 * Math.min(1, (run.sStation - ride.s) / (run.sStation - run.sJoin))
        set('status', `경성역까지 약 ${Math.max(1, Math.ceil(ride.arrive - S + SEA_APPROACH_T))}초`)
        set('hint', ride.s > run.sMouth ? '바다 → 북악산 터널 → 경성역' : '북악산 터널')
        once('go', '출발합니다 · 다음 역은 경성역(경복궁 구역)이에요')
        if (progress > 0.25) once('sea', '湯灯 바다를 크게 돌아 북악산 터널로 가요')
        if (ride.s - run.sMouth < 110) once('soon-tunnel', '잠시 후 북악산 터널로 들어갑니다')
        if (ride.s < run.sMouth) once('tunnel', '북악산 터널을 지나요 · 나가면 경성역이에요')
      } else if (ride.phase === 'arrive') {
        hjT = run.hjT
        atStation = Boolean(seated?.vehicle?.stopped)
      }
    }
    if (hjT >= 0) {
      ui.far = true
      once('gb', '경복궁 구역 · 1930 경성 기차로 경성역에 들어가요')
      progress = atStation ? 1 : 0.8 + 0.2 * Math.min(1, hjT / SEA_APPROACH_T)
      if (atStation) {
        // 경성역이 이 여정의 종점: 경복궁 기차는 16초 정차 뒤 다시 떠나고, 반대편 터널에 들어갈 때에야 손님을 내려 줘서
        //   "조금씩 움직이고 카메라만 돌리다 갑자기 하차"가 됐음(11/27) → 떠나기 직전에 승강장에 내려 줌 (E 누른 것과 같은 길)
        const left = SEA_APPROACH_T + SEA_DWELL - AUTO_EXIT_BEFORE - hjT
        set('status', '경성역 도착 · E로 내려요')
        set('hint', left > 0 ? `${Math.ceil(left)}초 뒤 내려 드려요` : '')
        once('arrive', '경성역 도착 · E로 내려요 (종점)')
        if (left <= 0 && !ui.autoExit) {
          ui.autoExit = true
          usePalaceSeatStore.setState({ requested: true })
        }
      } else {
        set('status', `경성역까지 약 ${Math.max(1, Math.ceil(SEA_APPROACH_T - hjT))}초`)
        set('hint', '경복궁 기차')
        if (SEA_APPROACH_T - hjT < 6) once('soon', '곧 경성역에 도착합니다 · 내리실 준비를 해 주세요')
      }
    }

    // ── 바다 구간 차 밖 카메라 (11/27 지민 선택 B안) ──
    //   달리는 동안 전차 뒤·옆 위에서 따라감 → 앞 칸이 바다 쪽 터널 입구에 닿으면 카메라를 그 자리에 세워
    //   전차가 터널로 들어가는 모습을 보여 줌 → 두 량이 다 들어가면 공용 3인칭(차 안)으로 돌아감
    //   공용 FollowCamera.jsx는 고치지 않음. 매 프레임 위치·방향만 덮어씀 (인형뽑기·입장 컷신과 같은 방식)
    let chase = false
    let mode = (import.meta.env.DEV && window.__jmSeaCamMode) || SEA_CAM_DEFAULT
    if (onMine && run.ride.phase === 'run' && run.ride.form === 'tram' && run.center) {
      const { ride } = run
      if (!(import.meta.env.DEV && window.__jmSeaCamMode)) {
        const prog = (run.sStation - ride.s) / Math.max(1, run.sStation - run.sMouth)
        mode = (SEA_SHOTS.find(([until]) => prog < until) ?? SEA_SHOTS[SEA_SHOTS.length - 1])[1]
      }
      // 장면이 바뀌면 끊어서(이어 붙이지 않고) 새 자리에서 시작
      if (ui.shot !== mode) {
        ui.shot = mode
        ui.camOn = false
      }
      const front = ride.s - 11.2 // 터널 쪽 앞 끝 (선 위 거리)
      const tail = ride.s + 11.2
      const cm = SEA_CAM_MODES[mode]
      if (!cm && seated?.position) {
        // 창가: 앉은 자리 머리 뒤에서 앉은 방향(창 쪽)을 봄 — 터널 안에서도 이어짐
        chase = true
        const yaw = seated.yaw ?? 0
        tmp.f.set(Math.sin(yaw), 0, Math.cos(yaw))
        tmp.cam.set(seated.position[0] - tmp.f.x * 0.45, seated.position[1] + 0.5, seated.position[2] - tmp.f.z * 0.45)
        tmp.lk.set(seated.position[0] + tmp.f.x * 6, seated.position[1] + 0.2, seated.position[2] + tmp.f.z * 6)
        ui.camOn = true
        camera.position.copy(tmp.cam)
        camera.lookAt(tmp.lk)
        camera.updateMatrixWorld()
      } else if (cm && tail > run.sMouth + 1) {
        chase = true
        if (front > run.sMouth + 3 || !ui.camOn) {
          // 진행 방향 = 선이 줄어드는 쪽
          tmp.f.set(-run.dx, 0, -run.dz)
          tmp.want.copy(run.center).addScaledVector(tmp.f, -cm.back)
          tmp.want.x += tmp.f.z * cm.side
          tmp.want.z += -tmp.f.x * cm.side
          tmp.want.y += cm.up
          tmp.wantLook.copy(run.center).addScaledVector(tmp.f, cm.ahead)
          tmp.wantLook.y += cm.lookUp
          if (!ui.camOn) {
            tmp.cam.copy(tmp.want)
            tmp.lk.copy(tmp.wantLook)
            ui.camOn = true
          } else {
            const t = 1 - Math.exp(-Math.min(dt, 0.1) * (cm.k ?? 2.5))
            tmp.cam.lerp(tmp.want, t)
            tmp.lk.lerp(tmp.wantLook, t)
          }
        } else {
          // 터널 입구에서는 카메라를 세우고 전차 꽁무니를 바라봄
          const t = 1 - Math.exp(-Math.min(dt, 0.1) * 3)
          tmp.lk.lerp(run.center, t)
        }
        camera.position.copy(tmp.cam)
        camera.lookAt(tmp.lk)
        camera.updateMatrixWorld()
      }
    }
    if (!chase && ui.camOn) {
      ui.camOn = false
      ui.shot = null
      // 공용 3인칭 카메라는 캐릭터가 움직일 때만 화면을 다시 맞춤 → 덮어쓴 화면이 남지 않게 지금 바로 제자리로
      //   (11/27: 바다 위에서 공중 카메라 화면이 그대로 멈춰 있던 문제)
      if (onMine && seated?.position && run?.center && controls?.setLookAt) {
        // 전차가 터널로 다 들어감 → 차 안 캐릭터 시점으로. 공용 카메라는 출발 전 각도를 기억하고 있어서 그대로 두면
        //   엉뚱한 쪽으로 튀었다가 벽 가림막에 당겨지며 이상하게 돌아옴(11/27) → 캐릭터 바로 뒤에서 진행 방향을 보게 맞춰 둠
        //   거리 3m(공용 최소 거리): 첫 자리(앞 칸 끝 쪽 의자)에서 뒤로 3m면 차 안이라 벽·지붕 가림막에 안 걸림
        const [px, py, pz] = seated.position
        tmp.f.set(-run.dx, 0, -run.dz) // 진행 방향
        tmp.wantLook.set(px, py + LOOK_HEIGHT, pz)
        tmp.want.copy(tmp.wantLook).addScaledVector(tmp.f, -RETURN_DIST * Math.cos(RETURN_TILT))
        tmp.want.y += RETURN_DIST * Math.sin(RETURN_TILT)
        controls.setLookAt(tmp.want.x, tmp.want.y, tmp.want.z, tmp.wantLook.x, tmp.wantLook.y, tmp.wantLook.z, false)
      } else if (controls?.getPosition && controls?.getTarget) {
        controls.getPosition(tmp.want)
        controls.getTarget(tmp.wantLook)
        controls.setLookAt(tmp.want.x, tmp.want.y, tmp.want.z, tmp.wantLook.x, tmp.wantLook.y, tmp.wantLook.z, false)
      }
    }

    // 경성역에 내린 직후 시작 지점으로 튀었으면 되돌림 (⑤)
    if (ui.guard) {
      const p = findPlayer(scene)
      if (now > ui.guard.until || !p) ui.guard = p ? null : ui.guard
      else {
        p.getWorldPosition(tmp.c)
        if (Math.hypot(tmp.c.x - SPAWN[0], tmp.c.z - SPAWN[1]) < 8) {
          const [x, y, z] = ui.guard.exit
          console.warn('[jm_seaRide] 경성역에 내린 뒤 캐릭터가 시작 지점으로 옮겨졌어요 → 승강장으로 되돌림', { at: [tmp.c.x, tmp.c.y, tmp.c.z], back: ui.guard.exit })
          requestPalaceWarp([x, y + 1, z])
          ui.guard = null
        }
      }
    }

    if (ui.journey && !ui.endAt) {
      set('fill', `${(progress * 100).toFixed(1)}%`)
      set('dot', `${(progress * 100).toFixed(1)}%`)
      set('title', title)
    }
    // 개발 중 확인용: 콘솔에서 window.__jmSeaPeek = { pos: [x,y,z], look: [x,y,z] } → 그 자리에서 보기 (null이면 끔)
    const peek = import.meta.env.DEV && window.__jmSeaPeek
    if (import.meta.env.DEV) window.__jmSeaCam = camera
    if (peek) {
      camera.position.set(...peek.pos)
      camera.lookAt(...peek.look)
      camera.updateMatrixWorld()
    }
    set('boardOp', ui.journey && !ui.endAt ? '1' : '0') // 바뀔 때만 DOM에 씀 (11/27 최적화)
    // 혜진 님 구역 입장 카드(가운데 위)가 떠 있으면 안내판을 그 아래로 내림
    set('top', useZoneEntryStore.getState().areaWelcome ? '300px' : '76px')
    set('capOp', now < ui.capUntil ? '1' : '0')
  })
  return null
}
