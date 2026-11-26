import { useMemo } from 'react'
import * as THREE from 'three'
import { GEO, Instances, mat, texMat } from '../kit.jsx'
import { getCofferCeilingTexture, getDragonPanelTexture } from './hjTextures.js'

// [3. 개발 > 프론트엔드] 근정전 실내 장식 (혜진 영화·드라마 구역 · 경복궁)
// HjPalaceInterior(바닥·벽·어좌·일월오봉도) 위에 사진 속 장식을 더해요. 좌표는 정전 실내 기준(가운데 0, 앞 -z).
//  - 우물반자: 초록 틀 + 파란 칸 연꽃 무늬 천장
//  - 보개천장: 어좌 위 계단식으로 들어간 칸 + 금빛 쌍룡
//  - 닫집: 어좌 위에 매단 작은 집 모양 장식 (층층 공포 + 붉은 틀 + 드림 장식)
//  - 용상 둘레 붉은 난간과 앞 계단 난간

const ROOM_W = 13.2
const ROOM_D = 6.56
const CEIL_Y = 3.44
const PARTS = mat('#ffffff', { roughness: 0.85 })
const GOLD = '#c99a45'
// 황룡 보개 자리: 실내 들보(z -0.83 · 1.08) 사이 가운데 → 어좌 앞에서 올려다보면 닫집에 가리지 않고 보여요
const DRAGON_Z = 0.125

function useRepeatTexture(get, rx, ry) {
  return useMemo(() => {
    const base = get()
    if (!base) return mat('#2f6b58', { double: true })
    const t = base.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8, emissive: '#2a2418', emissiveIntensity: 0.25 })
  }, [get, rx, ry])
}

export default function HjThroneHall() {
  const ceiling = useRepeatTexture(getCofferCeilingTexture, ROOM_W / 1.2, ROOM_D / 1.2)
  const dragon = useMemo(() => {
    const t = getDragonPanelTexture()
    return t ? texMat(t, { emissive: '#ffffff', emissiveIntensity: 0.6 }) : mat(GOLD)
  }, [])
  const parts = useMemo(() => {
    const list = []
    // 보개: 닫집 바로 앞 천장(들보 사이)에 세 단으로 들어간 네모 틀 (아래에서 보면 계단식)
    const cz = DRAGON_Z
    ;[
      [1.62, 3.4, '#2f6b58'],
      [1.45, 3.35, '#c8423a'],
      [1.3, 3.3, '#2a4f8a'],
    ].forEach(([size, y, c]) => {
      for (const s of [-1, 1]) {
        list.push({ p: [0, y, cz + (s * size) / 2], s: [size, 0.08, 0.16], c })
        list.push({ p: [(s * size) / 2, y, cz], s: [0.16, 0.08, size], c })
      }
    })
    // 보개 둘레 작은 공포 줄
    for (let i = 0; i < 9; i += 1) {
      const t = -0.78 + (i * 1.56) / 8
      for (const s of [-1, 1]) {
        list.push({ p: [t, 3.38, cz + s * 0.78], s: [0.1, 0.08, 0.14], c: i % 2 ? '#3f7d6a' : '#e9b949' })
        list.push({ p: [s * 0.78, 3.38, cz + t], s: [0.14, 0.08, 0.1], c: i % 2 ? '#3f7d6a' : '#e9b949' })
      }
    }
    // 닫집: 어좌 위 2.7~3.3m에 매단 집 모양 (앞 -z 쪽이 정면)
    const dz = 2.15
    const dw = 3.2
    const dd = 1.7
    const y0 = 2.72
    list.push({ p: [0, 3.32, dz], s: [dw + 0.3, 0.08, dd + 0.3], c: '#2f6b58' }) // 지붕판
    for (const s of [-1, 1]) {
      list.push({ p: [s * (dw / 2), y0 + 0.08, dz], s: [0.12, 0.16, dd], c: '#a0372c' })
    }
    list.push({ p: [0, y0 + 0.08, dz - dd / 2], s: [dw, 0.16, 0.12], c: '#a0372c' })
    // 층층 공포 (앞·옆)
    for (let layer = 0; layer < 4; layer += 1) {
      const y = y0 + 0.22 + layer * 0.09
      const grow = layer * 0.06
      const n = 14
      for (let i = 0; i <= n; i += 1) {
        const x = -dw / 2 + (i * dw) / n
        list.push({ p: [x, y, dz - dd / 2 - grow], s: [0.1, 0.07, 0.14 + grow], c: layer % 2 ? '#3f7d6a' : '#2a4f8a' })
      }
      for (const s of [-1, 1]) {
        for (let i = 0; i <= 7; i += 1) {
          const z = dz - dd / 2 + (i * dd) / 7
          list.push({ p: [s * (dw / 2 + grow), y, z], s: [0.14 + grow, 0.07, 0.1], c: layer % 2 ? '#3f7d6a' : '#2a4f8a' })
        }
      }
    }
    // 드림 장식 (앞으로 늘어진 붉은·금빛 술)
    for (let i = 0; i < 16; i += 1) {
      const x = -dw / 2 + 0.1 + (i * (dw - 0.2)) / 15
      list.push({ p: [x, y0 - 0.06, dz - dd / 2 - 0.02], s: [0.05, 0.18, 0.03], c: i % 2 ? '#c8423a' : GOLD })
    }
    // 닫집 양옆 기둥 (일월오봉도 앞)
    for (const s of [-1, 1]) list.push({ p: [s * (dw / 2), 1.6, dz + dd / 2 - 0.1], s: [0.12, 2.3, 0.12], c: '#a0372c' })
    // 용상 둘레 붉은 난간 (단 위, 앞 가운데 계단 자리 비움)
    const front = 2.02 - 2.15 / 2 + 0.06
    const railY = 0.42
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 0.45))
      for (let i = 0; i <= n; i += 1) {
        const x = x0 + ((x1 - x0) * i) / n
        const z = z0 + ((z1 - z0) * i) / n
        list.push({ p: [x, railY + 0.2, z], s: [0.06, 0.4, 0.06], c: '#b5402f' })
        list.push({ p: [x, railY + 0.43, z], s: [0.09, 0.06, 0.09], c: GOLD })
      }
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
      list.push({ p: [(x0 + x1) / 2, railY + 0.38, (z0 + z1) / 2], s: alongX ? [len, 0.05, 0.07] : [0.07, 0.05, len], c: '#b5402f' })
      list.push({ p: [(x0 + x1) / 2, railY + 0.17, (z0 + z1) / 2], s: alongX ? [len, 0.2, 0.03] : [0.03, 0.2, len], c: '#c85a3f' })
    }
    rail(-2.85, front, -0.62, front)
    rail(0.62, front, 2.85, front)
    rail(-2.85, front, -2.85, 3.0)
    rail(2.85, front, 2.85, 3.0)
    // 앞 계단 (붉은 판 + 양옆 난간)
    for (let k = 0; k < 3; k += 1) list.push({ p: [0, 0.06 + k * 0.12, front - 0.55 + k * 0.18], s: [1.2, 0.12 + k * 0.0, 0.2], c: '#a0452f' })
    for (const s of [-1, 1]) {
      list.push({ p: [s * 0.62, 0.55, front - 0.3], s: [0.06, 0.06, 0.62], r: [0.5, 0, 0], c: '#b5402f' })
      list.push({ p: [s * 0.62, 0.3, front - 0.5], s: [0.06, 0.5, 0.06], c: '#b5402f' })
    }
    return list
  }, [])
  return (
    <group>
      {/* 우물반자 천장 (아래를 보는 면) */}
      <mesh position={[0, CEIL_Y, 0]} rotation-x={Math.PI / 2} material={ceiling}>
        <planeGeometry args={[ROOM_W - 0.1, ROOM_D - 0.1]} />
      </mesh>
      {/* 보개천장 황룡 */}
      <mesh position={[0, 3.43, DRAGON_Z]} rotation-x={Math.PI / 2} material={dragon}>
        <planeGeometry args={[1.22, 1.22]} />
      </mesh>
      <Instances geometry={GEO.box} material={PARTS} items={parts} />
    </group>
  )
}
