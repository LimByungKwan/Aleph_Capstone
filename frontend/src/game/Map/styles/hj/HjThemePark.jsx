import NearOnly from './HjNearOnly.jsx'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { SeatedPerson } from './HjPeople.jsx'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { sharedSeconds } from '../../../../components/movieZone/hjSync.js'
import {
  BALLOON_DECOR, BALLOON_FIELD, BALLOON_PAD, ENTRANCE, HERDS, JEEP_ROUTE, LAKE, PARK, PARKING, PATHS, PATH_W, RIDES, ROCKS, SAFARI, SAFARI_BOARD,
} from './themeParkLayout.js'

// [3. 개발 > 프론트엔드] 해월 드림파크 (style: "hjThemePark") — 혜진 영화·드라마 구역, 경복궁 동쪽 빈 땅
// 동물원 지도처럼 빽빽한 숲 사이로 크림색 길이 굽이굽이 이어지는 작은 놀이공원 (압축판):
//  · 서쪽 입구 광장(주차장·매표소·꽃밭) → 남쪽 놀이기구: 관람차 · 회전목마 · 회전그네
//  · 가운데 열기구 마당: 줄에 매인 장식 열기구 + 타는 열기구(내려앉으면 E로 타기 → 공원 위를 한 바퀴)
//  · 북쪽 사파리: 울타리 안 초원·호수·바위 절벽에 코끼리·기린·얼룩말·코뿔소·사자·타조·홍학,
//    남쪽 정류장에서 사파리 지프(E로 타기)를 타고 한 바퀴
// 아이템 기준 좌표 = 공원 기준 (themeParkLayout.js). 놀이기구·열기구·지프는 서버 시각으로 움직여 모두 같은 화면을 봐요.

const P = mat('#ffffff', { roughness: 0.8 })
const SHINY = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.3 })
const BULB = mat('#fff3c4', { emissive: '#ffd77a', emissiveIntensity: 1.1 })
const FLAME = mat('#ffb347', { emissive: '#ff8a1f', emissiveIntensity: 1.6, transparent: true, opacity: 0.85 })
const WATER = mat('#5fb0c9', { transparent: true, opacity: 0.85, roughness: 0.15 })
const LEAF = mat('#ffffff', { roughness: 0.95, flat: true })
const BARK = mat('#6b4f3a', { roughness: 0.95 })

// 숲 나무 (성능): 잎은 20면체, 줄기는 뚜껑 없는 6각 기둥 — 낮은 다각형 모양은 같고 삼각형은 1/4
const LOW_LEAF = new THREE.IcosahedronGeometry(1, 0)
const LOW_TRUNK = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true)
const LOW_CONE = new THREE.ConeGeometry(1, 1, 6, 1, true)
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)

// 점과 선분 거리 (나무를 길 위에 심지 않으려고)
function distToPaths(x, z) {
  let best = Infinity
  for (const line of PATHS) {
    for (let i = 1; i < line.length; i += 1) {
      const [ax, az] = line[i - 1]
      const [bx, bz] = line[i]
      const dx = bx - ax
      const dz = bz - az
      const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1)
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
    }
  }
  return best
}
const inRect = (x, z, r, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m

// ── 캔버스 무늬 ──
const texCache = new Map()
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key)
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  draw(ctx, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  texCache.set(key, t)
  return t
}
const matCache = new Map()
const texMatOr = (t, color, extra = {}) => {
  if (!t) return mat(color)
  const key = t.uuid + JSON.stringify(extra)
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, ...extra }))
  return matCache.get(key)
}
// 세로 줄무늬 (차양·천막·열기구 풍선)
const stripeMat = (key, colors, n = 12) =>
  texMatOr(canvasTex(`tp-stripe-${key}`, 256, 64, (ctx, W, H) => {
    for (let i = 0; i < n; i += 1) {
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect((i * W) / n, 0, W / n + 1, H)
    }
  }), colors[0], { side: THREE.DoubleSide })
const giraffeMat = () =>
  texMatOr(canvasTex('tp-giraffe', 128, 128, (ctx, W, H) => {
    ctx.fillStyle = '#f2d79a'
    ctx.fillRect(0, 0, W, H)
    const r = seeded(3)
    for (let k = 0; k < 26; k += 1) {
      ctx.fillStyle = '#b8692e'
      ctx.beginPath()
      const x = r() * W
      const y = r() * H
      for (let p = 0; p < 6; p += 1) {
        const a = (p / 6) * Math.PI * 2
        const rr = 9 + r() * 5
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      ctx.fill()
    }
  }), '#e0b46a')
const zebraMat = () =>
  texMatOr(canvasTex('tp-zebra', 128, 128, (ctx, W, H) => {
    ctx.fillStyle = '#f5f3ee'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#1d1d1f'
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath()
      ctx.moveTo((i * W) / 9, 0)
      ctx.quadraticCurveTo((i * W) / 9 + 10, H / 2, (i * W) / 9 - 4, H)
      ctx.lineTo((i * W) / 9 + 6, H)
      ctx.quadraticCurveTo((i * W) / 9 + 18, H / 2, (i * W) / 9 + 7, 0)
      ctx.fill()
    }
  }), '#e8e6e0')

// ── 땅: 입구 광장·주차장·길·사파리 초원·호수 ──
function Grounds() {
  const { segs, joints } = useMemo(() => {
    const segs = []
    const joints = []
    for (const line of PATHS) {
      line.forEach(([x, z], i) => {
        joints.push({ p: [x, 0.045, z], s: [PATH_W / 2, 0.03, PATH_W / 2], c: '#eadbb7' })
        if (!i) return
        const [ax, az] = line[i - 1]
        const len = Math.hypot(x - ax, z - az)
        segs.push({ p: [(x + ax) / 2, 0.045, (z + az) / 2], s: [PATH_W, 0.03, len], r: [0, Math.atan2(x - ax, z - az), 0], c: '#eadbb7' })
      })
    }
    // 길 테두리 돌 (양옆 가는 띠)
    return { segs, joints }
  }, [])
  const patches = useMemo(() => {
    const r = seeded(77)
    const list = []
    for (let k = 0; k < 70; k += 1) {
      const x = SAFARI.x0 + 2 + r() * (SAFARI.x1 - SAFARI.x0 - 4)
      const z = SAFARI.z0 + 2 + r() * (SAFARI.z1 - SAFARI.z0 - 4)
      if (Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) < 1.25) continue
      const s = 2 + r() * 4
      list.push({ p: [x, 0.03 + k * 0.0002, z], s: [s, 0.01, s * (0.6 + r() * 0.5)], c: r() > 0.5 ? '#8fa65a' : '#c9b07a' })
    }
    return list
  }, [])
  return (
    <>
      {/* 입구 광장 + 주차장 (아스팔트·주차선) */}
      <mesh position={[(ENTRANCE.x0 + ENTRANCE.x1) / 2, 0.04, (ENTRANCE.z0 + ENTRANCE.z1) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ENTRANCE.x1 - ENTRANCE.x0, ENTRANCE.z1 - ENTRANCE.z0]} />
        <meshStandardMaterial color="#e6d7b2" roughness={0.9} />
      </mesh>
      <mesh position={[(PARKING.x0 + PARKING.x1) / 2, 0.05, (PARKING.z0 + PARKING.z1) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[PARKING.x1 - PARKING.x0, PARKING.z1 - PARKING.z0]} />
        <meshStandardMaterial color="#55585d" roughness={0.95} />
      </mesh>
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={i} position={[PARKING.x0 + 1.5 + i * 2.8, 0.06, PARKING.z0 + 1.6]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.12, 3]} />
          <meshBasicMaterial color="#f2f2ee" />
        </mesh>
      ))}
      <Instances geometry={GEO.box} material={P} items={segs} />
      <Instances geometry={GEO.cyl} material={P} items={joints} />
      {/* 사파리 초원 + 풀·흙 얼룩 */}
      <mesh position={[(SAFARI.x0 + SAFARI.x1) / 2, 0.025, (SAFARI.z0 + SAFARI.z1) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[SAFARI.x1 - SAFARI.x0, SAFARI.z1 - SAFARI.z0]} />
        <meshStandardMaterial color="#a9ad66" roughness={1} />
      </mesh>
      <Instances geometry={GEO.cyl8} material={P} items={patches} />
      {/* 호수: 모래 테두리 + 물 */}
      <mesh position={[LAKE.x, 0.04, LAKE.z]} scale={[LAKE.rx + 1.4, 0.04, LAKE.rz + 1.4]} geometry={GEO.cyl}>
        <meshStandardMaterial color="#d9c391" roughness={1} />
      </mesh>
      <mesh position={[LAKE.x, 0.07, LAKE.z]} scale={[LAKE.rx, 0.04, LAKE.rz]} geometry={GEO.cyl} material={WATER} />
    </>
  )
}

// ── 숲: 공원 둘레와 구역 사이를 빽빽하게 (지도처럼), 사파리 안에는 우산 모양 아카시아 ──
function Forest() {
  const { trunks, crowns, pines, acacia } = useMemo(() => {
    const r = seeded(4242)
    const trunks = []
    const crowns = []
    const pines = []
    const acacia = []
    const greens = ['#3f7a3a', '#4f8a43', '#5e9a4c', '#2f6534', '#6fa755']
    const blocked = (x, z) => {
      if (distToPaths(x, z) < PATH_W / 2 + 1.6) return true
      if (inRect(x, z, ENTRANCE, 2)) return true
      if (inRect(x, z, SAFARI, 1.5)) return true
      for (const ride of Object.values(RIDES)) if (Math.hypot(x - ride.x, z - ride.z) < ride.r + 4.5) return true
      if (Math.hypot(x - BALLOON_FIELD.x, z - BALLOON_FIELD.z) < BALLOON_FIELD.r + 3) return true
      for (const [bx, bz] of BALLOON_DECOR) if (Math.hypot(x - bx, z - bz) < 4) return true
      return false
    }
    for (let k = 0; k < 4000 && crowns.length + pines.length / 2 < 520; k += 1) {
      const x = -PARK.w / 2 + 1 + r() * (PARK.w - 2)
      const z = -PARK.d / 2 + 1 + r() * (PARK.d - 2)
      if (blocked(x, z)) continue
      const s = 0.9 + r() * 0.8
      if (r() < 0.3) {
        trunks.push({ p: [x, 1.0 * s, z], s: [0.18 * s, 2 * s, 0.18 * s] })
        const c = r() > 0.5 ? '#2f5f3a' : '#3b6f42'
        pines.push({ p: [x, 2.6 * s, z], s: [1.4 * s, 2.2 * s, 1.4 * s], c })
        pines.push({ p: [x, 3.9 * s, z], s: [1.0 * s, 1.7 * s, 1.0 * s], c })
      } else {
        trunks.push({ p: [x, 0.9 * s, z], s: [0.2 * s, 1.8 * s, 0.2 * s] })
        crowns.push({ p: [x, 2.6 * s, z], s: [1.8 * s, 1.6 * s, 1.8 * s], c: greens[Math.floor(r() * greens.length)] })
        if (r() > 0.5) crowns.push({ p: [x + 0.5 * s, 3.3 * s, z - 0.3 * s], s: [1.1 * s, 1.0 * s, 1.1 * s], c: greens[Math.floor(r() * greens.length)] })
      }
    }
    // 아카시아 (사파리): 가는 줄기 + 납작하고 넓은 잎
    for (const [x, z] of [[-30, 26], [28, 34], [-12, 30], [32, 66], [-30, 58], [10, 64], [-22, 84], [26, 84], [-34, 44], [0, 78]]) {
      acacia.push({ p: [x, 1.6, z], s: [0.18, 3.2, 0.18], c: '#7a5a40' })
      acacia.push({ p: [x, 3.4, z], s: [3.2, 0.55, 2.6], c: '#5f8a3c' })
    }
    return { trunks, crowns, pines, acacia }
  }, [])
  return (
    <>
      <Instances geometry={LOW_TRUNK} material={BARK} items={trunks} />
      <Instances geometry={LOW_LEAF} material={LEAF} items={crowns} />
      <Instances geometry={LOW_CONE} material={LEAF} items={pines} />
      <Instances geometry={GEO.sphere} material={LEAF} items={acacia} />
    </>
  )
}

// ── 입구 문 + 매표소 + 꽃밭 + 가게·벤치·가로등 ──
function Entrance() {
  const sign = getSignTexture('해월 드림파크', '#2b3a67', '#ffd77a', 4.5)
  const { boxes, cyls, flowers, lamps } = useMemo(() => {
    const r = seeded(9)
    const boxes = []
    const cyls = []
    const flowers = []
    const lamps = []
    const gx = ENTRANCE.gateX
    const gz = ENTRANCE.gateZ
    // 매표소 두 채
    for (const dz of [-5.8, 5.8]) {
      boxes.push({ p: [gx + 1.5, 1.3, gz + dz], s: [2.4, 2.6, 2.2], c: '#f4ead4' })
      boxes.push({ p: [gx + 1.5, 2.75, gz + dz], s: [2.9, 0.3, 2.7], c: '#d8403a' })
      boxes.push({ p: [gx + 2.72, 1.5, gz + dz], s: [0.04, 0.9, 1.4], c: '#9cc7dd' })
    }
    // 꽃밭 (입구 광장 둘레)
    const palette = ['#f2c13d', '#e9692c', '#d8418a', '#f5f0e6', '#b04fc4', '#ff8fb1']
    for (const [x0, z0, w, d] of [[-34, -84.5, 10, 2]]) { // 주차장 쪽은 비우고 북쪽에만
      boxes.push({ p: [x0 + w / 2, 0.2, z0 + d / 2], s: [w, 0.4, d], c: '#7a5a3f' })
      for (let k = 0; k < 40; k += 1) flowers.push({ p: [x0 + 0.4 + r() * (w - 0.8), 0.52, z0 + 0.3 + r() * (d - 0.6)], s: [0.2, 0.16, 0.2], c: palette[Math.floor(r() * palette.length)] })
    }
    // 가게 (팝콘·아이스크림·기념품): 줄무늬 차양은 따로
    for (const [x, z] of [[-18, -84], [4, -84.5], [26, -32]]) {
      boxes.push({ p: [x, 1.2, z], s: [3, 2.4, 2.4], c: '#fbf3e4' })
      boxes.push({ p: [x, 1.0, z - 1.25], s: [2.6, 0.12, 0.3], c: '#c98f5a' })
    }
    // 가로등 + 벤치: 길을 따라
    for (const line of PATHS) {
      for (let i = 1; i < line.length; i += 1) {
        const [ax, az] = line[i - 1]
        const [bx, bz] = line[i]
        const len = Math.hypot(bx - ax, bz - az)
        const nx = -(bz - az) / len
        const nz = (bx - ax) / len
        for (let t = 6; t < len - 2; t += 12) {
          const x = ax + ((bx - ax) * t) / len + nx * (PATH_W / 2 + 0.4)
          const z = az + ((bz - az) * t) / len + nz * (PATH_W / 2 + 0.4)
          cyls.push({ p: [x, 1.7, z], s: [0.07, 3.4, 0.07], c: '#2f3b48' })
          lamps.push({ p: [x, 3.5, z], s: [0.22, 0.28, 0.22] })
          const bxp = ax + ((bx - ax) * (t + 6)) / len - nx * (PATH_W / 2 + 0.5)
          const bzp = az + ((bz - az) * (t + 6)) / len - nz * (PATH_W / 2 + 0.5)
          boxes.push({ p: [bxp, 0.42, bzp], s: [1.8, 0.08, 0.5], c: '#a8784a', r: [0, Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0] })
        }
      }
    }
    return { boxes, cyls, flowers, lamps }
  }, [])
  const gx = ENTRANCE.gateX
  const gz = ENTRANCE.gateZ
  return (
    <>
      {/* 입구 문: 줄무늬 기둥 두 개 + 아치 간판 + 깃발 */}
      {[-3.6, 3.6].map((dz) => (
        <group key={dz} position={[gx, 0, gz + dz]}>
          <mesh geometry={GEO.cyl} material={stripeMat('gate', ['#e2463c', '#fbf3e4'], 8)} position={[0, 3, 0]} scale={[0.45, 6, 0.45]} />
          <mesh geometry={GEO.sphere} material={mat('#ffd77a', { emissive: '#ffb83a', emissiveIntensity: 0.4 })} position={[0, 6.35, 0]} scale={[0.6, 0.6, 0.6]} />
          <mesh geometry={GEO.cyl} material={P} position={[0, 7.3, 0]} scale={[0.03, 1.6, 0.03]} />
          <mesh geometry={GEO.box} material={mat(dz > 0 ? '#2f6fd1' : '#f2a33a', { double: true })} position={[0, 7.7, 0.45]} scale={[0.02, 0.5, 0.8]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={mat('#2b3a67')} position={[gx, 5.4, gz]} scale={[0.5, 1.4, 8.4]} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[gx + s * 0.27, 5.4, gz]} rotation-y={s < 0 ? -Math.PI / 2 : Math.PI / 2}>
          <planeGeometry args={[7.6, 1.2]} />
          <meshBasicMaterial map={sign} />
        </mesh>
      ))}
      <Instances geometry={GEO.box} material={P} items={boxes} />
      <Instances geometry={GEO.cyl8} material={P} items={cyls} />
      <Instances geometry={GEO.sphere} material={P} items={flowers} />
      <Instances geometry={GEO.sphere} material={BULB} items={lamps} />
      {/* 가게 줄무늬 차양 */}
      {[[-18, -84], [4, -84.5], [26, -32]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.75, z - 1.1]} rotation-x={0.45} material={stripeMat(`awn${i}`, i === 1 ? ['#3b8fd9', '#fbf3e4'] : ['#e2463c', '#fbf3e4'], 10)}>
          <planeGeometry args={[3.3, 1.5]} />
        </mesh>
      ))}
    </>
  )
}

// ── 관람차: 바퀴는 공원 x 방향을 바라보고 천천히 돌아요 (곤돌라는 늘 똑바로) ──
const GONDOLA_COLORS = ['#e2463c', '#f2a33a', '#f2d03a', '#4fb36a', '#3b8fd9', '#8a5ad1']
function FerrisWheel() {
  const { x, z, r, hub } = RIDES.wheel
  const wheel = useRef(null)
  const gondolas = useRef([])
  const N = 12
  const { spokes, bulbs } = useMemo(() => {
    const spokes = []
    const bulbs = []
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2
      for (const dz of [-1.1, 1.1]) spokes.push({ p: [Math.cos(a) * r / 2, Math.sin(a) * r / 2, dz], s: [0.12, r, 0.12], r: [0, 0, a + Math.PI / 2] })
    }
    for (let i = 0; i < 48; i += 1) {
      const a = (i / 48) * Math.PI * 2
      for (const dz of [-1.1, 1.1]) bulbs.push({ p: [Math.cos(a) * (r + 0.15), Math.sin(a) * (r + 0.15), dz], s: [0.12, 0.12, 0.12] })
    }
    return { spokes, bulbs }
  }, [r])
  useFrame(() => {
    const a = sharedSeconds() * 0.1
    if (wheel.current) wheel.current.rotation.z = a
    gondolas.current.forEach((g) => g && (g.rotation.z = -a))
  })
  return (
    <group position={[x, 0, z]} rotation-y={Math.PI / 2}>
      {/* 받침 + A자 다리 */}
      <mesh geometry={GEO.box} position={[0, 0.3, 0]} scale={[9, 0.6, 7]}>
        <meshStandardMaterial color="#d9d2c2" roughness={0.9} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-2.6, 2.6].map((sz) => {
          const bx = sx * 4
          const len = Math.hypot(bx, hub)
          return <mesh key={`${sx}${sz}`} geometry={GEO.cyl8} material={SHINY} position={[bx / 2, hub / 2, sz]} rotation-z={Math.atan2(bx, hub)} scale={[0.22, len, 0.22]} />
        }),
      )}
      <mesh geometry={GEO.cyl} material={SHINY} position={[0, hub, 0]} rotation-x={Math.PI / 2} scale={[0.6, 5.6, 0.6]} />
      <group ref={wheel} position={[0, hub, 0]}>
        {[-1.1, 1.1].map((dz) => (
          <mesh key={dz} position={[0, 0, dz]}>
            <torusGeometry args={[r, 0.18, 8, 64]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.4} metalness={0.3} />
          </mesh>
        ))}
        <Instances geometry={GEO.box} material={SHINY} items={spokes} />
        <Instances geometry={GEO.sphere} material={BULB} items={bulbs} />
        {Array.from({ length: N }, (_, i) => {
          const a = (i / N) * Math.PI * 2
          return (
            <group key={i} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
              <group ref={(el) => (gondolas.current[i] = el)}>
                <mesh geometry={GEO.cyl8} material={SHINY} position={[0, -0.6, 0]} scale={[0.05, 1.2, 0.05]} />
                <mesh geometry={GEO.box} position={[0, -1.8, 0]} scale={[1.5, 1.4, 1.5]}>
                  <meshStandardMaterial color={GONDOLA_COLORS[i % GONDOLA_COLORS.length]} roughness={0.5} />
                </mesh>
                <mesh geometry={GEO.box} position={[0, -1.65, 0]} scale={[1.52, 0.55, 1.2]}>
                  <meshStandardMaterial color="#cfe6f2" transparent opacity={0.55} />
                </mesh>
                <mesh geometry={GEO.dome} position={[0, -1.1, 0]} scale={[0.85, 0.4, 0.85]}>
                  <meshStandardMaterial color="#fbf3e4" />
                </mesh>
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}

// ── 회전목마: 줄무늬 천막 지붕 + 두 줄 목마가 오르내리며 돌아요 ──
function Horse({ color, saddle }) {
  return (
    <group>
      <mesh geometry={GEO.sphere} position={[0, 0, 0]} scale={[0.32, 0.34, 0.7]} material={mat(color)} />
      <mesh geometry={GEO.cyl8} position={[0, 0.35, 0.55]} rotation-x={-0.6} scale={[0.14, 0.55, 0.14]} material={mat(color)} />
      <mesh geometry={GEO.box} position={[0, 0.62, 0.82]} rotation-x={0.4} scale={[0.2, 0.22, 0.42]} material={mat(color)} />
      <mesh geometry={GEO.box} position={[0, 0.55, 0.42]} scale={[0.06, 0.4, 0.3]} material={mat('#f2d03a')} />
      <mesh geometry={GEO.box} position={[0, 0.3, 0]} scale={[0.36, 0.08, 0.42]} material={mat(saddle)} />
      {[[-0.16, 0.4], [0.16, 0.4], [-0.16, -0.4], [0.16, -0.4]].map(([lx, lz], i) => (
        <mesh key={i} geometry={GEO.cyl8} position={[lx, -0.42, lz]} rotation-x={i < 2 ? -0.5 : 0.5} scale={[0.06, 0.55, 0.06]} material={mat(color)} />
      ))}
    </group>
  )
}
function Carousel() {
  const { x, z, r } = RIDES.carousel
  const spin = useRef(null)
  const horses = useRef([])
  const list = useMemo(() => {
    const out = []
    const colors = [['#f7f3ea', '#d8403a'], ['#7a4a2a', '#3b8fd9'], ['#2a2626', '#f2a33a'], ['#e8d2b0', '#8a5ad1']]
    for (const [ring, n] of [[2.6, 8], [4.4, 12]]) {
      for (let i = 0; i < n; i += 1) out.push({ a: (i / n) * Math.PI * 2 + ring, ring, c: colors[(i + n) % colors.length] })
    }
    return out
  }, [])
  useFrame(() => {
    const t = sharedSeconds()
    if (spin.current) spin.current.rotation.y = t * 0.45
    horses.current.forEach((h, i) => h && (h.position.y = 1.35 + Math.sin(t * 2 + i) * 0.3))
  })
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.cyl} position={[0, 0.25, 0]} scale={[r + 0.4, 0.5, r + 0.4]}>
        <meshStandardMaterial color="#c9a24a" roughness={0.6} />
      </mesh>
      <group ref={spin}>
        <mesh geometry={GEO.cyl} position={[0, 0.55, 0]} scale={[r, 0.12, r]}>
          <meshStandardMaterial color="#8f3a2c" roughness={0.7} />
        </mesh>
        <mesh geometry={GEO.cyl} position={[0, 2.5, 0]} scale={[0.9, 4, 0.9]} material={stripeMat('carousel-core', ['#f2d03a', '#d8403a'], 8)} />
        {list.map((h, i) => (
          <group key={i} position={[Math.cos(h.a) * h.ring, 0, Math.sin(h.a) * h.ring]} rotation-y={-h.a}>
            <mesh geometry={GEO.cyl8} material={BRASS} position={[0, 2.4, 0]} scale={[0.04, 3.8, 0.04]} />
            <group ref={(el) => (horses.current[i] = el)} position={[0, 1.35, 0]}>
              <Horse color={h.c[0]} saddle={h.c[1]} />
            </group>
          </group>
        ))}
        {/* 줄무늬 천막 지붕 + 둘레 장식 띠 + 꼭대기 */}
        <mesh geometry={GEO.cone} position={[0, 5.6, 0]} scale={[r + 0.9, 2.2, r + 0.9]} material={stripeMat('carousel', ['#d8403a', '#fbf3e4'], 16)} />
        <mesh geometry={GEO.cyl} position={[0, 4.4, 0]} scale={[r + 0.9, 0.5, r + 0.9]} material={stripeMat('carousel-band', ['#2f6fd1', '#f2d03a'], 24)} />
        <mesh geometry={GEO.sphere} position={[0, 6.9, 0]} scale={[0.35, 0.35, 0.35]} material={BULB} />
      </group>
    </group>
  )
}
const BRASS = new THREE.MeshStandardMaterial({ color: '#d4b25a', roughness: 0.3, metalness: 0.7 })

// ── 회전그네: 가운데 탑 꼭대기가 돌면 그네 의자들이 바깥으로 날아올라요 ──
function SwingRide() {
  const { x, z } = RIDES.swing
  const top = useRef(null)
  const pivots = useRef([])
  const N = 12
  useFrame(() => {
    const t = sharedSeconds()
    // 40초마다: 20초 돌고 20초 쉬어요
    const cycle = t % 40
    const on = cycle < 20 ? smooth(0, 4, cycle) * (1 - smooth(16, 20, cycle)) : 0
    if (top.current) top.current.rotation.y = t * 0.9 * (0.2 + on)
    const swing = on * 0.62
    pivots.current.forEach((p) => p && (p.rotation.z = swing))
  })
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.cyl} position={[0, 0.2, 0]} scale={[2.4, 0.4, 2.4]}>
        <meshStandardMaterial color="#d9d2c2" />
      </mesh>
      <mesh geometry={GEO.cyl} position={[0, 5, 0]} scale={[0.45, 10, 0.45]} material={stripeMat('swing-pole', ['#3b8fd9', '#fbf3e4'], 10)} />
      <group ref={top} position={[0, 9.6, 0]}>
        <mesh geometry={GEO.cone} position={[0, 0.9, 0]} scale={[3.6, 1.6, 3.6]} material={stripeMat('swing-top', ['#f2a33a', '#fbf3e4'], 12)} />
        <mesh geometry={GEO.cyl} scale={[3.4, 0.3, 3.4]} material={stripeMat('swing-ring', ['#d8403a', '#f2d03a'], 24)} />
        {Array.from({ length: N }, (_, i) => (
          <group key={i} rotation-y={(i / N) * Math.PI * 2}>
            <group ref={(el) => (pivots.current[i] = el)} position={[3.1, -0.2, 0]}>
              <mesh geometry={GEO.cyl8} material={SHINY} position={[0, -2.1, 0]} scale={[0.025, 4.2, 0.025]} />
              <mesh geometry={GEO.box} position={[0, -4.25, 0]} scale={[0.55, 0.08, 0.55]}>
                <meshStandardMaterial color={GONDOLA_COLORS[i % GONDOLA_COLORS.length]} />
              </mesh>
              <mesh geometry={GEO.box} position={[-0.24, -3.95, 0]} scale={[0.06, 0.55, 0.55]}>
                <meshStandardMaterial color={GONDOLA_COLORS[i % GONDOLA_COLORS.length]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

// ── 열기구 ──
const BALLOON_SKINS = [
  ['#e2463c', '#f2d03a', '#3b8fd9', '#fbf3e4'],
  ['#4fb36a', '#fbf3e4', '#f2a33a', '#fbf3e4'],
  ['#8a5ad1', '#ff8fb1', '#f2d03a', '#3b8fd9'],
  ['#2f6fd1', '#fbf3e4', '#e2463c', '#fbf3e4'],
]
// 바구니 조각: 바닥, 벽 4면(높이 0.95), 위 가죽 테두리 4줄, 모서리 기둥
const BASKET = [
  { p: [0, 0.06, 0], s: [1.9, 0.12, 1.9], c: '#8a6440' },
  ...[-1, 1].flatMap((s) => [
    { p: [s * 0.92, 0.55, 0], s: [0.08, 0.95, 1.9], c: '#a77a4c' },
    { p: [0, 0.55, s * 0.92], s: [1.9, 0.95, 0.08], c: '#a77a4c' },
    { p: [s * 0.92, 1.05, 0], s: [0.16, 0.1, 2.0], c: '#6b4a2e' },
    { p: [0, 1.05, s * 0.92], s: [2.0, 0.1, 0.16], c: '#6b4a2e' },
  ]),
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ({ p: [x * 0.92, 0.55, z * 0.92], s: [0.12, 1.0, 0.12], c: '#6b4a2e' })),
]
const WICKER = mat('#ffffff', { roughness: 0.95 })
function Balloon({ skin = 0, burner = null }) {
  return (
    <group>
      {/* 풍선(세로 줄무늬 천) + 아래 치마 + 줄 + 버들 바구니 */}
      <mesh geometry={GEO.sphere} position={[0, 6.6, 0]} scale={[3.4, 4.0, 3.4]} material={stripeMat(`balloon${skin}`, BALLOON_SKINS[skin], 16)} />
      <mesh geometry={GEO.cone} position={[0, 3.0, 0]} rotation-x={Math.PI} scale={[1.6, 1.6, 1.6]} material={stripeMat(`balloon${skin}`, BALLOON_SKINS[skin], 16)} />
      {[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z], i) => (
        <mesh key={i} geometry={GEO.cyl8} position={[x * 0.85, 1.9, z * 0.85]} rotation={[z * 0.35, 0, -x * 0.35]} scale={[0.025, 1.8, 0.025]}>
          <meshStandardMaterial color="#6b5a48" />
        </mesh>
      ))}
      {/* 버들 바구니: 속이 빈 상자 (바닥 + 낮은 벽 4면 + 위 테두리) → 안에 탄 사람이 보여요 */}
      <Instances geometry={GEO.box} material={WICKER} items={BASKET} />
      <mesh geometry={GEO.cyl8} position={[0, 2.35, 0]} scale={[0.25, 0.4, 0.25]} material={SHINY} />
      {burner && <mesh ref={burner} geometry={GEO.cone} position={[0, 2.95, 0]} scale={[0.22, 0.7, 0.22]} material={FLAME} />}
    </group>
  )
}
function DecorBalloons() {
  const refs = useRef([])
  useFrame(() => {
    const t = sharedSeconds()
    refs.current.forEach((g, i) => {
      if (!g) return
      g.position.y = 5.5 + Math.sin(t * 0.5 + i * 2) * 0.6
      g.rotation.y = Math.sin(t * 0.2 + i) * 0.3
    })
  })
  return BALLOON_DECOR.map(([x, z], i) => (
    <group key={i} position={[x, 0, z]}>
      <mesh geometry={GEO.cyl8} position={[0, 3, 0]} scale={[0.02, 6, 0.02]}>
        <meshStandardMaterial color="#e8e2d4" />
      </mesh>
      <mesh geometry={GEO.box} position={[0, 0.2, 0]} scale={[0.4, 0.4, 0.4]}>
        <meshStandardMaterial color="#8a8378" />
      </mesh>
      <group ref={(el) => (refs.current[i] = el)} scale={0.75}>
        <Balloon skin={(i + 1) % BALLOON_SKINS.length} />
      </group>
    </group>
  ))
}

// 타는 열기구: 착륙 22초(E로 타기·내리기) → 10초 떠오름 → 46초 공원 위를 한 바퀴 → 10초 내려앉음
const B_SCHED = { LAND: 22, UP: 10, CRUISE: 46, DOWN: 10 }
const B_CENTER = [0, -20]
const B_RADIUS = 34
const B_HEIGHT = 24
const B_SEATS = [[-0.45, -0.45, Math.PI * 1.25], [0.45, -0.45, Math.PI * 0.75], [-0.45, 0.45, -Math.PI * 0.25], [0.45, 0.45, Math.PI * 0.25]].map(([x, z, yaw], i) => ({ id: `b${i}`, x, y: 0.62, z, yaw, taken: false }))
function BalloonRide() {
  const ref = useRef(null)
  const flame = useRef(null)
  const vehicle = useMemo(() => ({ id: 'park_balloon', label: '열기구', stopped: true, w: 2.2, l: 2.2, reach: 2.6, seats: [] }), [])
  useEffect(() => registerVehicle(vehicle), [vehicle])
  const phi0 = Math.atan2(BALLOON_PAD.z - B_CENTER[1], BALLOON_PAD.x - B_CENTER[0])
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const { LAND, UP, CRUISE, DOWN } = B_SCHED
    const t = sharedSeconds() % (LAND + UP + CRUISE + DOWN)
    let k = 0 // 0 = 착륙 자리, 1 = 원 위
    let phi = phi0
    let y = 0
    let burn = 0
    if (t < LAND) {
      k = 0
    } else if (t < LAND + UP) {
      const u = (t - LAND) / UP
      k = smooth(0.2, 1, u)
      y = B_HEIGHT * smooth(0, 1, u)
      burn = 1
    } else if (t < LAND + UP + CRUISE) {
      const u = (t - LAND - UP) / CRUISE
      k = 1
      phi = phi0 + u * Math.PI * 2
      y = B_HEIGHT + Math.sin(u * Math.PI * 4) * 1.5
      burn = Math.sin(t * 3) > 0.6 ? 1 : 0
    } else {
      const u = (t - LAND - UP - CRUISE) / DOWN
      k = 1 - smooth(0, 0.8, u)
      phi = phi0 + Math.PI * 2
      y = B_HEIGHT * (1 - smooth(0, 1, u))
    }
    const cx = B_CENTER[0] + Math.cos(phi) * B_RADIUS
    const cz = B_CENTER[1] + Math.sin(phi) * B_RADIUS
    g.position.set(BALLOON_PAD.x + (cx - BALLOON_PAD.x) * k, y, BALLOON_PAD.z + (cz - BALLOON_PAD.z) * k)
    g.rotation.y = t * 0.05
    if (flame.current) {
      flame.current.visible = burn > 0
      flame.current.scale.y = 0.6 + Math.random() * 0.3
    }
    vehicle.stopped = t < LAND
    updateVehicleWorld(vehicle, g, B_SEATS, [0, 0.1, 2.4])
  })
  const people = B_SEATS.filter((s) => s.taken)
  return (
    <group ref={ref} position={[BALLOON_PAD.x, 0, BALLOON_PAD.z]}>
      <Balloon skin={0} burner={flame} />
      {people.map((s, i) => (
        <SeatedPerson key={s.id} look={i * 3 + 5} position={[s.x, s.y, s.z]} yaw={s.yaw} />
      ))}
    </group>
  )
}
function BalloonField() {
  const { x, z, r } = BALLOON_FIELD
  return (
    <>
      <mesh position={[x, 0.035, z]} scale={[r, 0.03, r]} geometry={GEO.cyl}>
        <meshStandardMaterial color="#7fae5a" roughness={1} />
      </mesh>
      {/* 착륙 표시 (흰 원 + H 대신 열기구 그림 판) */}
      <mesh position={[BALLOON_PAD.x, 0.06, BALLOON_PAD.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.4, 2.8, 32]} />
        <meshBasicMaterial color="#fbf3e4" />
      </mesh>
      <mesh position={[x + r - 0.6, 1.2, z]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[3.6, 0.9]} />
        <meshBasicMaterial map={getSignTexture('🎈 열기구 타는 곳 · 내려앉으면 E', '#fbf3e4', '#2b3a67', 4)} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

// ── 사파리: 울타리 · 바위 절벽 · 정류장 · 지프 · 동물 ──
function SafariSet() {
  const { posts, rails, rocks } = useMemo(() => {
    const posts = []
    const rails = []
    const rocks = []
    const { x0, x1, z0, z1 } = SAFARI
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az)
      for (let t = 0; t <= len; t += 3) posts.push({ p: [ax + ((bx - ax) * t) / len, 0.7, az + ((bz - az) * t) / len], s: [0.14, 1.4, 0.14], c: '#7a5a3f' })
      for (const y of [0.55, 1.15]) rails.push({ p: [(ax + bx) / 2, y, (az + bz) / 2], s: [ax === bx ? 0.08 : len, 0.1, ax === bx ? len : 0.08], c: '#9a744f' })
    }
    const r = seeded(31)
    for (let x = ROCKS.x - ROCKS.w / 2; x <= ROCKS.x + ROCKS.w / 2; x += 3.2) {
      const s = 2.5 + r() * 2.5
      rocks.push({ p: [x, s * 0.45, ROCKS.z - r() * 2], s: [s * 1.3, s, s], r: [0, r() * 3, 0], c: r() > 0.5 ? '#a8a294' : '#8f897c' })
    }
    // 사자 바위 (가운데 높은 평평한 바위)
    rocks.push({ p: [6, 1.3, 91], s: [5, 2.6, 4], r: [0, 0.3, 0], c: '#b3ab98' })
    return { posts, rails, rocks }
  }, [])
  return (
    <>
      <Instances geometry={GEO.box} material={P} items={posts} />
      <Instances geometry={GEO.box} material={P} items={rails} />
      <Instances geometry={GEO.rock} material={P} items={rocks} />
      {/* 사파리 정류장: 초가 지붕 쉼터 + 간판 */}
      <group position={[SAFARI_BOARD.x, 0, SAFARI_BOARD.z - 0.6]}>
        {[[-2.2, -1], [2.2, -1], [-2.2, 1], [2.2, 1]].map(([x, z], i) => (
          <mesh key={i} geometry={GEO.cyl8} position={[x, 1.4, z]} scale={[0.12, 2.8, 0.12]}>
            <meshStandardMaterial color="#6b4a2e" />
          </mesh>
        ))}
        <mesh geometry={GEO.cone} position={[0, 3.3, 0]} scale={[3.6, 1.3, 2.4]}>
          <meshStandardMaterial color="#c9a66b" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 2.35, -1.05]} rotation-y={Math.PI}>
          <planeGeometry args={[3.6, 0.7]} />
          <meshBasicMaterial map={getSignTexture('🦒 사파리 지프 · 서면 E로 타기', '#3d5a2a', '#ffe9a8', 5)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <SafariJeep />
      <Animals />
    </>
  )
}

// 사파리 지프: 정류장 16초(E로 타기·내리기) → 지프 길을 한 바퀴 (초속 5m)
const JEEP_SPEED = 5
const JEEP_DWELL = 16
const JEEP_SEATS = [-1.2, 0.1, 1.4].flatMap((z, row) => [-0.5, 0.5].map((x, k) => ({ id: `j${row}${k}`, x, y: 1.05, z, yaw: 0, taken: false })))
function SafariJeep() {
  const ref = useRef(null)
  const route = useMemo(() => {
    const pts = [...JEEP_ROUTE, JEEP_ROUTE[0]].map(([x, z]) => new THREE.Vector3(x, 0, z))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    return { curve, len: curve.getLength() }
  }, [])
  const vehicle = useMemo(() => ({ id: 'park_safari_jeep', label: '사파리 지프', stopped: true, w: 2.4, l: 5.2, reach: 5.2, seats: [] }), [])
  useEffect(() => registerVehicle(vehicle), [vehicle])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const drive = route.len / JEEP_SPEED
    const t = sharedSeconds() % (JEEP_DWELL + drive)
    const u = t < JEEP_DWELL ? 0 : ((t - JEEP_DWELL) * JEEP_SPEED) / route.len
    route.curve.getPointAt(Math.min(0.9999, u), tmp)
    g.position.set(tmp.x, 0, tmp.z)
    route.curve.getTangentAt(Math.min(0.9999, u), tmp)
    g.rotation.y = Math.atan2(tmp.x, tmp.z)
    vehicle.stopped = t < JEEP_DWELL
    updateVehicleWorld(vehicle, g, JEEP_SEATS, [0, 0.1, 0])
    // 내리는 자리는 울타리 밖 정류장
    vehicle.exit[0] = PARK.x + SAFARI_BOARD.x
    vehicle.exit[1] = 0.1
    vehicle.exit[2] = PARK.z + SAFARI_BOARD.z
  })
  const people = JEEP_SEATS.filter((s) => s.taken)
  return (
    <group ref={ref}>
      {/* 차체(카키) + 바퀴 + 의자 + 줄무늬 지붕 */}
      <mesh geometry={GEO.box} position={[0, 0.75, 0]} scale={[2.3, 0.6, 5]}>
        <meshStandardMaterial color="#8a8452" roughness={0.7} />
      </mesh>
      <mesh geometry={GEO.box} position={[0, 1.15, 2.1]} scale={[2.3, 0.5, 0.9]}>
        <meshStandardMaterial color="#7a7446" roughness={0.7} />
      </mesh>
      {[[-1.1, 1.7], [1.1, 1.7], [-1.1, -1.6], [1.1, -1.6]].map(([x, z], i) => (
        <mesh key={i} geometry={GEO.cyl} position={[x, 0.45, z]} rotation-z={Math.PI / 2} scale={[0.45, 0.32, 0.45]}>
          <meshStandardMaterial color="#1f1f21" />
        </mesh>
      ))}
      {JEEP_SEATS.map((s) => (
        <mesh key={s.id} geometry={GEO.box} position={[s.x, s.y - 0.08, s.z]} scale={[0.85, 0.12, 0.6]}>
          <meshStandardMaterial color="#5a3e2b" />
        </mesh>
      ))}
      {[[-1.05, -2.2], [1.05, -2.2], [-1.05, 2.0], [1.05, 2.0]].map(([x, z], i) => (
        <mesh key={i} geometry={GEO.cyl8} position={[x, 1.9, z]} scale={[0.05, 1.8, 0.05]} material={SHINY} />
      ))}
      <mesh geometry={GEO.box} position={[0, 2.82, -0.1]} scale={[2.5, 0.08, 4.8]} material={stripeMat('jeep', ['#f2d03a', '#2b2a29'], 14)} />
      {people.map((s, i) => (
        <SeatedPerson key={s.id} look={i * 5 + 2} position={[s.x, s.y, s.z]} yaw={s.yaw} />
      ))}
    </group>
  )
}

// ── 동물: 무리마다 정해진 자리 둘레를 천천히 거닐어요 ──
function AnimalBody({ kind }) {
  switch (kind) {
    case 'elephant': {
      const m = mat('#9a9893')
      return (
        <group>
          <mesh geometry={GEO.sphere} material={m} position={[0, 2.0, 0]} scale={[1.25, 1.15, 1.9]} />
          {[[-0.6, 0.9], [0.6, 0.9], [-0.6, -0.9], [0.6, -0.9]].map(([x, z], i) => <mesh key={i} geometry={GEO.cyl8} material={m} position={[x, 0.85, z]} scale={[0.32, 1.7, 0.32]} />)}
          <mesh geometry={GEO.sphere} material={m} position={[0, 2.55, 1.85]} scale={[0.75, 0.8, 0.7]} />
          {[-1, 1].map((s) => <mesh key={s} geometry={GEO.sphere} material={mat('#8a8782')} position={[s * 0.75, 2.6, 1.6]} scale={[0.12, 0.7, 0.55]} />)}
          <mesh geometry={GEO.cyl8} material={m} position={[0, 1.9, 2.45]} rotation-x={0.25} scale={[0.16, 1.4, 0.16]} />
          <mesh geometry={GEO.cyl8} material={m} position={[0, 1.15, 2.6]} rotation-x={-0.4} scale={[0.12, 0.5, 0.12]} />
          {[-1, 1].map((s) => <mesh key={s} geometry={GEO.cone} material={mat('#f6f2e8')} position={[s * 0.35, 2.1, 2.35]} rotation-x={1.9} scale={[0.07, 0.6, 0.07]} />)}
          <mesh geometry={GEO.cyl8} material={m} position={[0, 1.9, -1.9]} rotation-x={-0.3} scale={[0.05, 0.8, 0.05]} />
        </group>
      )
    }
    case 'giraffe': {
      const m = giraffeMat()
      const dark = mat('#8a5a2a')
      return (
        <group>
          <mesh geometry={GEO.sphere} material={m} position={[0, 2.3, 0]} scale={[0.55, 0.55, 1.0]} />
          {[[-0.25, 0.55], [0.25, 0.55], [-0.25, -0.55], [0.25, -0.55]].map(([x, z], i) => <mesh key={i} geometry={GEO.cyl8} material={m} position={[x, 1.05, z]} scale={[0.09, 2.1, 0.09]} />)}
          <mesh geometry={GEO.cyl8} material={m} position={[0, 3.5, 0.85]} rotation-x={0.45} scale={[0.17, 2.4, 0.17]} />
          <mesh geometry={GEO.box} material={m} position={[0, 4.65, 1.45]} rotation-x={0.4} scale={[0.26, 0.26, 0.6]} />
          {[-1, 1].map((s) => <mesh key={s} geometry={GEO.cyl8} material={dark} position={[s * 0.08, 4.95, 1.3]} scale={[0.035, 0.25, 0.035]} />)}
          <mesh geometry={GEO.box} material={dark} position={[0, 3.6, 0.7]} rotation-x={0.45} scale={[0.05, 2.0, 0.08]} />
          <mesh geometry={GEO.cyl8} material={m} position={[0, 2.1, -1.05]} rotation-x={-0.4} scale={[0.03, 0.7, 0.03]} />
        </group>
      )
    }
    case 'zebra': {
      const m = zebraMat()
      const black = mat('#1d1d1f')
      return (
        <group>
          <mesh geometry={GEO.sphere} material={m} position={[0, 1.25, 0]} scale={[0.42, 0.45, 0.85]} />
          {[[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]].map(([x, z], i) => <mesh key={i} geometry={GEO.cyl8} material={m} position={[x, 0.5, z]} scale={[0.07, 1.0, 0.07]} />)}
          <mesh geometry={GEO.cyl8} material={m} position={[0, 1.65, 0.75]} rotation-x={0.7} scale={[0.15, 0.75, 0.15]} />
          <mesh geometry={GEO.box} material={m} position={[0, 1.85, 1.05]} rotation-x={0.9} scale={[0.2, 0.22, 0.55]} />
          <mesh geometry={GEO.box} material={black} position={[0, 1.78, 0.68]} rotation-x={0.7} scale={[0.05, 0.75, 0.1]} />
          <mesh geometry={GEO.cyl8} material={black} position={[0, 1.1, -0.9]} rotation-x={-0.4} scale={[0.03, 0.6, 0.03]} />
        </group>
      )
    }
    case 'rhino': {
      const m = mat('#8a8478')
      return (
        <group>
          <mesh geometry={GEO.sphere} material={m} position={[0, 1.15, 0]} scale={[0.85, 0.75, 1.45]} />
          {[[-0.45, 0.75], [0.45, 0.75], [-0.45, -0.75], [0.45, -0.75]].map(([x, z], i) => <mesh key={i} geometry={GEO.cyl8} material={m} position={[x, 0.4, z]} scale={[0.22, 0.8, 0.22]} />)}
          <mesh geometry={GEO.box} material={m} position={[0, 1.05, 1.55]} rotation-x={0.3} scale={[0.6, 0.55, 0.85]} />
          <mesh geometry={GEO.cone} material={mat('#d8d0bc')} position={[0, 1.4, 1.9]} rotation-x={0.35} scale={[0.14, 0.55, 0.14]} />
          <mesh geometry={GEO.cone} material={mat('#d8d0bc')} position={[0, 1.4, 1.55]} scale={[0.09, 0.28, 0.09]} />
        </group>
      )
    }
    case 'lion': {
      const m = mat('#c9974f')
      return (
        <group>
          <mesh geometry={GEO.sphere} material={m} position={[0, 0.95, 0]} scale={[0.42, 0.42, 0.85]} />
          {[[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]].map(([x, z], i) => <mesh key={i} geometry={GEO.cyl8} material={m} position={[x, 0.4, z]} scale={[0.1, 0.8, 0.1]} />)}
          <mesh geometry={GEO.ico} material={mat('#7a4a22', { flat: true })} position={[0, 1.3, 0.75]} scale={[0.55, 0.55, 0.45]} />
          <mesh geometry={GEO.sphere} material={m} position={[0, 1.3, 0.98]} scale={[0.3, 0.3, 0.3]} />
          <mesh geometry={GEO.cyl8} material={m} position={[0, 1.0, -1.0]} rotation-x={-0.9} scale={[0.04, 0.8, 0.04]} />
          <mesh geometry={GEO.sphere} material={mat('#5a3418')} position={[0, 1.25, -1.35]} scale={[0.1, 0.1, 0.1]} />
        </group>
      )
    }
    case 'ostrich': {
      return (
        <group>
          <mesh geometry={GEO.sphere} material={mat('#2a2626')} position={[0, 1.35, 0]} scale={[0.45, 0.4, 0.6]} />
          <mesh geometry={GEO.sphere} material={mat('#f4f0e6')} position={[0, 1.45, -0.5]} scale={[0.3, 0.25, 0.25]} />
          {[-0.15, 0.15].map((x) => <mesh key={x} geometry={GEO.cyl8} material={mat('#d9a99a')} position={[x, 0.55, 0]} scale={[0.05, 1.1, 0.05]} />)}
          <mesh geometry={GEO.cyl8} material={mat('#e3b8a8')} position={[0, 2.0, 0.4]} scale={[0.06, 1.2, 0.06]} />
          <mesh geometry={GEO.sphere} material={mat('#e3b8a8')} position={[0, 2.65, 0.48]} scale={[0.12, 0.1, 0.18]} />
        </group>
      )
    }
    case 'flamingo':
    default: {
      const m = mat('#f08aa0')
      return (
        <group>
          <mesh geometry={GEO.sphere} material={m} position={[0, 1.0, 0]} scale={[0.22, 0.2, 0.36]} />
          <mesh geometry={GEO.cyl8} material={m} position={[0, 0.5, 0]} scale={[0.025, 1.0, 0.025]} />
          <mesh geometry={GEO.cyl8} material={m} position={[0, 1.3, 0.2]} rotation-x={0.5} scale={[0.04, 0.6, 0.04]} />
          <mesh geometry={GEO.cyl8} material={m} position={[0, 1.6, 0.28]} rotation-x={-0.4} scale={[0.04, 0.35, 0.04]} />
          <mesh geometry={GEO.cone} material={mat('#2a2626')} position={[0, 1.72, 0.42]} rotation-x={2.2} scale={[0.04, 0.18, 0.04]} />
        </group>
      )
    }
  }
}
function Animals() {
  const list = useMemo(() => {
    const r = seeded(55)
    return HERDS.flatMap(([kind, x, z, radius, n]) =>
      Array.from({ length: n }, (_, i) => ({
        kind, x, z, radius: radius * (0.6 + r() * 0.5), phase: (i / n) * Math.PI * 2 + r(), speed: (kind === 'flamingo' ? 0.03 : 0.05) * (0.7 + r() * 0.6), dir: r() > 0.5 ? 1 : -1,
      })),
    )
  }, [])
  const refs = useRef([])
  useFrame(() => {
    const t = sharedSeconds()
    list.forEach((a, i) => {
      const g = refs.current[i]
      if (!g) return
      const ang = a.phase + t * a.speed * a.dir
      g.position.set(a.x + Math.cos(ang) * a.radius, Math.abs(Math.sin(t * 2.4 + i)) * 0.03, a.z + Math.sin(ang) * a.radius * 0.7)
      // 걷는 방향(접선)을 바라봐요
      g.rotation.y = Math.atan2(-Math.sin(ang) * a.dir, Math.cos(ang) * 0.7 * a.dir)
    })
  })
  return list.map((a, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      <AnimalBody kind={a.kind} />
    </group>
  ))
}

export default function HjThemePark() {
  return (
    <group>
      <Grounds />
      <Forest />
      <Entrance />
      {/* 놀이기구·사파리는 가까이 있을 때만 그려요 (성능). 열기구는 하늘에 떠 있어 멀리서도 보여요 */}
      <NearOnly radius={170} center={[0, 0, -60]}>
        <FerrisWheel />
        <Carousel />
        <SwingRide />
      </NearOnly>
      <BalloonField />
      <DecorBalloons />
      <BalloonRide />
      <NearOnly radius={150} center={[0, 0, 57]}>
        <SafariSet />
      </NearOnly>
    </group>
  )
}

// ── 충돌 (물리 안에서 그려요: PalaceTourPresence) ──
export function ThemeParkColliders() {
  const boxes = useMemo(() => {
    const list = []
    const add = (x, y, z, w, h, d) => list.push([x, y, z, w, h, d])
    const { x0, x1, z0, z1 } = SAFARI
    add((x0 + x1) / 2, 1.25, z0, x1 - x0, 2.5, 0.3) // 사파리 울타리 4면
    add((x0 + x1) / 2, 1.25, z1, x1 - x0, 2.5, 0.3)
    add(x0, 1.25, (z0 + z1) / 2, 0.3, 2.5, z1 - z0)
    add(x1, 1.25, (z0 + z1) / 2, 0.3, 2.5, z1 - z0)
    add(RIDES.wheel.x, 4, RIDES.wheel.z, 7, 8, 9) // 관람차 받침·다리
    add(RIDES.carousel.x, 2, RIDES.carousel.z, RIDES.carousel.r * 2 + 0.6, 4, RIDES.carousel.r * 2 + 0.6)
    add(RIDES.swing.x, 2.5, RIDES.swing.z, 5, 5, 5) // 회전그네 탑 (의자가 도는 둘레는 비워요)
    for (const dz of [-5.8, 5.8]) add(ENTRANCE.gateX + 1.5, 1.4, ENTRANCE.gateZ + dz, 2.4, 2.8, 2.2) // 매표소
    for (const dz of [-3.6, 3.6]) add(ENTRANCE.gateX, 3, ENTRANCE.gateZ + dz, 0.9, 6, 0.9) // 문 기둥
    for (const [x, z] of [[-18, -84], [4, -84.5], [26, -32]]) add(x, 1.2, z, 3, 2.4, 2.4) // 가게
    return list
  }, [])
  return (
    <RigidBody type="fixed" colliders={false} position={[PARK.x, 0, PARK.z]} name="HJ/theme_park">
      {boxes.map(([x, y, z, w, h, d], i) => (
        <CuboidCollider key={i} args={[w / 2, h / 2, d / 2]} position={[x, y, z]} />
      ))}
    </RigidBody>
  )
}
