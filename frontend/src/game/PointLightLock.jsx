import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLoadState } from '../store/loadState.js'

// [SG 성능 최적화] 점광원 "가까운 것만 켜기" + 개수 고정
// 1) three.js는 켜진 조명 개수를 셰이더에 넣는다 → 개수가 바뀌면 모든 재질 셰이더를 다시 컴파일해서 멈춘다.
// 2) 화면의 모든 픽셀이 켜진 점광원 전부를 반복 계산한다 → 23개면 GPU 시간이 약 2.5배 (측정: 14.2ms → 조명 없이 5.7ms).
// 그래서 원래 점광원은 숨기고(개수에서 빠짐), POOL_SIZE개짜리 조명 묶음을 카메라에서 가까운 원래 조명 자리로 옮겨 쓴다.
// 묶음은 항상 켜져 있어서 개수가 변하지 않고, 원래 조명의 색·세기·거리는 매번 그대로 복사한다.
// shortcut: 처음 한 번 찾은 조명만 다룬다(지금 조명은 모두 고정 위치·한 번만 생성). 나중에 새로 생기는 점광원은 개수에 더해진다.
const POOL_SIZE = 6
const PICK_EVERY = 10 // 프레임마다 다시 고르면 낭비라서 10프레임에 한 번

const lightPos = new THREE.Vector3()

export default function PointLightLock() {
  const scene = useThree((state) => state.scene)
  const state = useRef(null)
  const mapReady = useLoadState((s) => s.mapReady) // 맵 소품(점광원 포함)을 다 붙인 뒤에 찾음 (MapLayout이 나눠 붙임)

  useEffect(() => {
    if (!mapReady) return
    const sources = []
    scene.traverse((object) => {
      if (object.isPointLight) sources.push(object)
    })
    sources.forEach((light) => (light.visible = false))
    const pool = Array.from({ length: POOL_SIZE }, () => {
      const light = new THREE.PointLight('#ffffff', 0)
      scene.add(light)
      return light
    })
    state.current = { sources, pool, frame: 0 }
    if (import.meta.env.DEV) console.info(`[PointLightLock] 점광원 ${sources.length}개 중 가까운 ${POOL_SIZE}개만 켬`)
    return () => {
      pool.forEach((light) => scene.remove(light))
      sources.forEach((light) => (light.visible = true))
      state.current = null
    }
  }, [scene, mapReady])

  useFrame(({ camera }) => {
    const s = state.current
    if (!s || s.frame++ % PICK_EVERY !== 0) return
    // 빛이 닿는 거리(distance)를 빼서, 멀어도 넓게 비추는 조명을 먼저 고름
    const ranked = s.sources
      .map((light) => {
        light.getWorldPosition(lightPos)
        return { light, pos: lightPos.clone(), score: camera.position.distanceTo(lightPos) - (light.distance || Infinity) }
      })
      .sort((a, b) => a.score - b.score)
    s.pool.forEach((target, i) => {
      const pick = ranked[i]
      if (!pick) return void (target.intensity = 0) // 원래 조명이 묶음보다 적으면 남는 칸은 끔 (켜진 채로 두어 개수 유지)
      target.position.copy(pick.pos)
      target.color.copy(pick.light.color)
      target.intensity = pick.light.intensity
      target.distance = pick.light.distance
      target.decay = pick.light.decay
    })
  })

  return null
}
