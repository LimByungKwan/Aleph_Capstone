import * as THREE from 'three'
import { DEFAULT_TIME, TIME_PRESETS } from './config.js'

// 지금 화면에 쓰이는 하늘·빛 값 (시간대: 아침/점심/밤, 설정창 ⚙).
// 하늘은 계절과 상관없이 같고(점심 = config.js SKY_COLORS 푸른 하늘), 계절은 나무·날씨만 바꿔요.
// 하늘·햇빛·안개·구름·별이 모두 이 live 객체를 읽고, stepTimeOfDay()가 매 프레임 목표로 부드럽게 옮겨요.
// 최적화: 색 객체를 새로 만들지 않고 값만 바꿈, 목표에 도착하면 계산 생략

const COLOR_KEYS = ['top', 'middle', 'horizon', 'sunGlow', 'lightColor', 'hemiSky', 'hemiGround', 'fog', 'cloud']

const targetCache = new Map()

function buildTarget(time) {
  const p = TIME_PRESETS[time] ?? TIME_PRESETS[DEFAULT_TIME]
  const c = (hex) => new THREE.Color(hex)
  return {
    top: c(p.sky.top),
    middle: c(p.sky.middle),
    horizon: c(p.sky.horizon),
    sunGlow: c(p.sky.sun),
    sunDir: new THREE.Vector3(...p.sun).normalize(),
    lightColor: c(p.light.color),
    lightIntensity: p.light.intensity,
    hemiSky: c(p.hemi[0]),
    hemiGround: c(p.hemi[1]),
    hemiIntensity: p.hemi[2],
    fog: c(p.fog),
    cloud: c(p.cloud),
    stars: p.stars,
  }
}

function targetFor(time) {
  if (!targetCache.has(time)) targetCache.set(time, buildTarget(time))
  return targetCache.get(time)
}

const start = buildTarget(DEFAULT_TIME)
export const live = {
  ...Object.fromEntries(COLOR_KEYS.map((name) => [name, start[name].clone()])),
  sunDir: start.sunDir.clone(),
  lightIntensity: start.lightIntensity,
  hemiIntensity: start.hemiIntensity,
  stars: start.stars,
}

let settled = null // 이미 목표에 도착했으면 계산 생략

export function blendTimeOfDay(from, to, amount) {
  const a = targetFor(from)
  const b = targetFor(to)
  for (const name of COLOR_KEYS) live[name].lerpColors(a[name], b[name], amount)
  live.sunDir.lerpVectors(a.sunDir, b.sunDir, amount).normalize()
  for (const name of ['lightIntensity', 'hemiIntensity', 'stars']) {
    live[name] = THREE.MathUtils.lerp(a[name], b[name], amount)
  }
  settled = null
}

// 처음 화면은 저장된 시간대로 바로 맞춤 (전환 애니메이션 없이)
export function snapTimeOfDay(time) {
  if (settled === time) return
  stepTimeOfDay(time, 1, true)
}

export function stepTimeOfDay(time, delta, instant = false) {
  if (settled === time && !instant) return
  const t = targetFor(time)
  const k = instant ? 1 : 1 - Math.exp(-delta * 3) // 약 1초에 걸쳐 부드럽게
  for (const name of COLOR_KEYS) live[name].lerp(t[name], k)
  live.sunDir.lerp(t.sunDir, k).normalize()
  live.lightIntensity += (t.lightIntensity - live.lightIntensity) * k
  live.hemiIntensity += (t.hemiIntensity - live.hemiIntensity) * k
  live.stars += (t.stars - live.stars) * k
  const done = Math.abs(live.lightIntensity - t.lightIntensity) < 0.002 && Math.abs(live.stars - t.stars) < 0.002 && live.top.equals(t.top)
  settled = done || instant ? time : null
}
