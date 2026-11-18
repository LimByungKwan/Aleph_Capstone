import * as THREE from 'three'
import { DEFAULT_TIME, TIME_PRESETS } from './config.js'

// 지금 화면에 쓰이는 하늘·빛 값 (아침/점심/밤 사이를 부드럽게 오감).
// 하늘·햇빛·안개·구름·별이 모두 이 객체를 읽어요. 매 프레임 stepTimeOfDay()가 목표 시간대로 조금씩 이동.
// 최적화: 색 객체를 새로 만들지 않고 같은 객체 값만 바꿈 (메모리 할당 없음)

const start = TIME_PRESETS[DEFAULT_TIME]

export const live = {
  top: new THREE.Color(start.sky.top),
  middle: new THREE.Color(start.sky.middle),
  horizon: new THREE.Color(start.sky.horizon),
  sunGlow: new THREE.Color(start.sky.sun),
  sunDir: new THREE.Vector3(...start.sun).normalize(),
  lightColor: new THREE.Color(start.light.color),
  lightIntensity: start.light.intensity,
  hemiSky: new THREE.Color(start.hemi[0]),
  hemiGround: new THREE.Color(start.hemi[1]),
  hemiIntensity: start.hemi[2],
  fog: new THREE.Color(start.fog),
  cloud: new THREE.Color(start.cloud),
  stars: start.stars,
}

// 목표 시간대의 값 (색 객체는 미리 만들어 두고 재사용)
const targets = Object.fromEntries(
  Object.entries(TIME_PRESETS).map(([key, p]) => [
    key,
    {
      top: new THREE.Color(p.sky.top),
      middle: new THREE.Color(p.sky.middle),
      horizon: new THREE.Color(p.sky.horizon),
      sunGlow: new THREE.Color(p.sky.sun),
      sunDir: new THREE.Vector3(...p.sun).normalize(),
      lightColor: new THREE.Color(p.light.color),
      lightIntensity: p.light.intensity,
      hemiSky: new THREE.Color(p.hemi[0]),
      hemiGround: new THREE.Color(p.hemi[1]),
      hemiIntensity: p.hemi[2],
      fog: new THREE.Color(p.fog),
      cloud: new THREE.Color(p.cloud),
      stars: p.stars,
    },
  ]),
)

let settled = null // 이미 목표에 도착했으면 계산 생략

// 처음 화면은 저장된 시간대로 바로 맞춤 (전환 애니메이션 없이)
export function snapTimeOfDay(key) {
  stepTimeOfDay(key, 1, true)
}

export function stepTimeOfDay(key, delta, instant = false) {
  if (settled === key && !instant) return
  const t = targets[key] ?? targets[DEFAULT_TIME]
  const k = instant ? 1 : 1 - Math.exp(-delta * 3) // 약 1초에 걸쳐 부드럽게
  for (const name of ['top', 'middle', 'horizon', 'sunGlow', 'lightColor', 'hemiSky', 'hemiGround', 'fog', 'cloud']) live[name].lerp(t[name], k)
  live.sunDir.lerp(t.sunDir, k).normalize()
  live.lightIntensity += (t.lightIntensity - live.lightIntensity) * k
  live.hemiIntensity += (t.hemiIntensity - live.hemiIntensity) * k
  live.stars += (t.stars - live.stars) * k
  const done = Math.abs(live.lightIntensity - t.lightIntensity) < 0.002 && Math.abs(live.stars - t.stars) < 0.002 && live.top.equals(t.top)
  if (done || instant) settled = key
  else settled = null
}
