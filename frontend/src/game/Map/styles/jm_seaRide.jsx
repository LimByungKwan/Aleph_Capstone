import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePalaceSeatStore } from '../../../components/movieZone/palaceSeating.js'

// 애니 구역(JM) 바다 전차를 탔을 때 화면 연출 — 담당: 지민 (11/26)
//   ① 바깥에서 보기: 바다 전차에 앉아 있는 동안 카메라가 차 밖 뒤·옆 위에서 전차를 따라감 → 바다를 도는 모습이 보임
//      공용 FollowCamera.jsx는 고치지 않음. 3인칭 카메라 조종이 끝난 뒤 매 프레임 위치·방향만 덮어씀 (인형뽑기·입장 컷신과 같은 방식)
//      내리면(또는 터널 안에서 경복궁 기차로 옮겨 타면) 덮어쓰기를 멈춰서 원래 3인칭 화면으로 돌아감
//   ② 터널·도착: 터널에 가까워지면 화면이 서서히 어두워지고(터널 안은 검게), 경복궁 기차로 옮겨 타는 순간 밝아지며 행선 글자
//      湯灯駅에 서면 도착 글자
//   무게: 새 3D 물체 없음 (카메라 계산 + 화면 위 글자 판 하나)
const CAM_BACK = 17
const CAM_SIDE = 7
const CAM_UP = 7.5
const DARK_NEAR = 18 // 터널 입구 이만큼(m) 앞부터 어두워짐
const FADE_IN = 1.4 // 옮겨 탄 뒤 밝아지는 시간(초)
const CAPTION_SEC = 3.2

function makeOverlay() {
  const root = document.createElement('div')
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147482000'
  const black = document.createElement('div')
  black.style.cssText = 'position:absolute;inset:0;background:#05070a;opacity:0'
  const cap = document.createElement('div')
  cap.style.cssText =
    'position:absolute;left:50%;top:18%;transform:translateX(-50%);padding:10px 22px;border-radius:999px;' +
    'background:rgba(20,16,12,0.72);color:#f6ead2;font:600 18px/1.3 system-ui,sans-serif;letter-spacing:0.04em;' +
    'white-space:nowrap;opacity:0;transition:opacity 0.5s'
  root.append(black, cap)
  document.body.appendChild(root)
  return { root, black, cap }
}

export function SeaRideView({ runs, path }) {
  const ui = useMemo(() => ({ el: null, onMine: false, fade: 0, capUntil: 0, wasStopped: false, wasHidden: false, dir: 1, inited: false }), [])
  const tmp = useMemo(() => ({ c: new THREE.Vector3(), f: new THREE.Vector3(), want: new THREE.Vector3(), wantLook: new THREE.Vector3(), cam: new THREE.Vector3(), lk: new THREE.Vector3() }), [])
  useEffect(() => {
    ui.el = makeOverlay()
    return () => {
      ui.el.root.remove()
      ui.el = null
    }
  }, [ui])

  useFrame(({ camera, clock }, dt) => {
    const el = ui.el
    if (!el) return
    const now = clock.elapsedTime
    const seated = usePalaceSeatStore.getState().seated
    const run = runs[0]?.vehicles.includes(seated?.vehicle) ? runs[0] : null
    const caption = (text) => {
      el.cap.textContent = text
      ui.capUntil = now + CAPTION_SEC
    }

    // 바다 전차에서 경복궁 기차로 옮겨 탄 순간: 검은 화면에서 밝아지며 행선 글자
    if (ui.onMine && !run && seated?.vehicle?.id?.startsWith('HJ/')) {
      ui.fade = 1
      caption('경복궁 구역 · 경성역 방면')
    }

    let dark = 0
    if (run) {
      const st = run.st
      if (!ui.onMine) {
        // 막 탔을 때
        ui.inited = false
        ui.wasStopped = st.stopped
        ui.wasHidden = !!st.hidden
        caption('바다 전차 · 경복궁 방면')
      }
      if (!st.stopped) ui.dir = st.dir
      if (st.hidden) dark = 1
      else if (st.dir < 0) dark = Math.max(0, 1 - (st.s - path.sMouth) / DARK_NEAR)
      if (st.hidden && !ui.wasHidden) caption('터널을 지나는 중…')
      if (st.stopped && !ui.wasStopped) caption('湯灯駅 도착 · E로 내려요')
      ui.wasStopped = st.stopped
      ui.wasHidden = !!st.hidden

      // 바깥에서 보기: 두 량 가운데를 뒤·옆 위에서 따라감 (터널 안에서는 멈춰 둠)
      const [a, b] = run.cars
      if (a && b && !st.hidden) {
        tmp.c.copy(a.position).add(b.position).multiplyScalar(0.5)
        a.parent.localToWorld(tmp.c)
        tmp.f.set(run.dx, 0, run.dz).multiplyScalar(ui.dir)
        tmp.want.copy(tmp.c).addScaledVector(tmp.f, -CAM_BACK)
        tmp.want.x += tmp.f.z * CAM_SIDE
        tmp.want.z += -tmp.f.x * CAM_SIDE
        tmp.want.y += CAM_UP
        tmp.wantLook.copy(tmp.c).addScaledVector(tmp.f, 6)
        tmp.wantLook.y += 1.5
        if (!ui.inited) {
          tmp.cam.copy(tmp.want)
          tmp.lk.copy(tmp.wantLook)
          ui.inited = true
        } else {
          const t = 1 - Math.exp(-Math.min(dt, 0.1) * 2.5)
          tmp.cam.lerp(tmp.want, t)
          tmp.lk.lerp(tmp.wantLook, t)
        }
      }
      if (ui.inited) {
        camera.position.copy(tmp.cam)
        camera.lookAt(tmp.lk)
        camera.updateMatrixWorld()
      }
    }
    ui.onMine = Boolean(run)

    ui.fade = Math.max(0, ui.fade - dt / FADE_IN)
    el.black.style.opacity = String(Math.max(dark, ui.fade))
    el.cap.style.opacity = now < ui.capUntil ? '1' : '0'
  })
  return null
}
