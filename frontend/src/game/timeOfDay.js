import * as THREE from 'three'
import { DEFAULT_TIME, TIME_PRESETS } from './config.js'
import { SEASON_LOOK } from './seasons.js'

// 지금 화면에 쓰이는 하늘·빛 값 = 계절(혜진 님 seasons.js) × 시간대(아침/점심/밤, 설정창 ⚙).
// - 점심: 계절 하늘색·안개·햇빛 색 그대로
// - 아침: 아침 노을 색에 계절 하늘을 조금 섞음
// - 밤: 계절과 상관없이 별이 뜨는 밤하늘
// 하늘·햇빛·안개·구름·별이 모두 이 live 객체를 읽고, stepTimeOfDay()가 매 프레임 목표로 부드럽게 옮겨요.
// 최적화: 색 객체를 새로 만들지 않고 값만 바꿈, 목표에 도착하면 계산 생략

const COLOR_KEYS = ['top', 'middle', 'horizon', 'sunGlow', 'lightColor', 'hemiSky', 'hemiGround', 'fog', 'cloud']

const targetCache = new Map()

function buildTarget(time, season) {
  const p = TIME_PRESETS[time] ?? TIME_PRESETS[DEFAULT_TIME]
  const look = SEASON_LOOK[season] ?? SEASON_LOOK.spring
  const c = (hex) => new THREE.Color(hex)
  const target = {
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
  // 계절 색 반영 (밤에는 반영하지 않음)
  const seasonMix = time === 'noon' ? 1 : time === 'morning' ? 0.3 : 0
  if (seasonMix > 0) {
    target.top.lerp(c(look.sky[0]), seasonMix)
    target.middle.lerp(c(look.sky[1]), seasonMix)
    target.horizon.lerp(c(look.sky[2]), seasonMix)
    target.fog.lerp(c(look.fog), seasonMix)
    target.lightColor.lerp(c(look.sun), seasonMix)
  }
  return target
}

function targetFor(time, season) {
  const key = `${time}|${season}`
  if (!targetCache.has(key)) targetCache.set(key, buildTarget(time, season))
  return targetCache.get(key)
}

const start = buildTarget(DEFAULT_TIME, 'spring')
export const live = {
  ...Object.fromEntries(COLOR_KEYS.map((name) => [name, start[name].clone()])),
  sunDir: start.sunDir.clone(),
  lightIntensity: start.lightIntensity,
  hemiIntensity: start.hemiIntensity,
  stars: start.stars,
}

let settled = null // 이미 목표에 도착했으면 계산 생략

// 처음 화면은 저장된 시간대·지금 계절로 바로 맞춤 (전환 애니메이션 없이)
export function snapTimeOfDay(time, season) {
  stepTimeOfDay(time, season, 1, true)
}

export function stepTimeOfDay(time, season, delta, instant = false) {
  const key = `${time}|${season}`
  if (settled === key && !instant) return
  const t = targetFor(time, season)
  const k = instant ? 1 : 1 - Math.exp(-delta * 3) // 약 1초에 걸쳐 부드럽게
  for (const name of COLOR_KEYS) live[name].lerp(t[name], k)
  live.sunDir.lerp(t.sunDir, k).normalize()
  live.lightIntensity += (t.lightIntensity - live.lightIntensity) * k
  live.hemiIntensity += (t.hemiIntensity - live.hemiIntensity) * k
  live.stars += (t.stars - live.stars) * k
  const done = Math.abs(live.lightIntensity - t.lightIntensity) < 0.002 && Math.abs(live.stars - t.stars) < 0.002 && live.top.equals(t.top)
  settled = done || instant ? key : null
}
