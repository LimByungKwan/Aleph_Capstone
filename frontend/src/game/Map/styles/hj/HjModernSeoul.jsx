import { BANK_END, BRIDGES, CHANNELS, dryRects, SeoulWaterfront } from './SeoulWaterfront.jsx'
import { SeoulPedestrians } from './SeoulPedestrians.jsx'
import { SeoulTrainShell } from './SeoulTrainShell.jsx'
import { HjTimeRouteSign } from './HjTimeRouteSign.jsx'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { MountainRange } from './HjBugaksan.jsx'
import { Gwanghwamun, Wall } from './HjGyeongbokPalace.jsx'
import { HanokHall } from './HjHanok.jsx'
import { StoneFloor } from './HjPalaceGround.jsx'
import { GWANGHWAMUN } from './gyeongbokLayout.js'
import { SeatedPerson } from './HjPeople.jsx'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { sharedSeconds } from '../../../../components/movieZone/hjSync.js'
import { GYEONGSEONG_ARRIVE, SEOUL_CENTER, SEOUL_GATE_Z as GATE_Z, SEOUL_STATION, useTimeTravel } from '../../../../components/movieZone/timeTravel.js'

// [3. 개발 > 프론트엔드] 2026 현대 서울 (혜진 영화·드라마 구역 — 시간 열차의 도착지)
// 1930 경성 증기기관차를 타고 북악산 터널로 들어가면 여기 역 승강장에 내려요.
//  남쪽: 서울역 승강장(유리 지붕·역 이름판·출발 안내판) + 동서로 달리는 하얀 전동 열차(타고 터널로 가면 1930 경성으로)
//  가운데: 광화문 광장 — 넓은 잔디밭, 양옆 꽃밭(국화), 바닥 분수, 은행나무 줄, 벤치·가로등
//  양옆: 차로(차선·횡단보도·신호등·자동차·버스) + 인도 + 유리 빌딩 숲
//  북쪽: 광화문과 궁 담장, 그 너머 근정전 지붕들, 뒤로 북악산 (사진 기반)
// 사방은 낮은 산으로 둘러싸 지평선을 막아요. 본 맵에서 아주 멀리 있어서 가까이 있을 때만 그려요 (충돌 박스는 늘 있음).
// 좌표: SEOUL_CENTER 기준 (+z 북쪽)

const P = mat('#ffffff', { roughness: 0.8 })
const SHINY = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.35 })
const GLASS_DARK = mat('#26394a', { transparent: true, opacity: 0.5, roughness: 0.1 })
const CANOPY_GLASS = mat('#cfe6f2', { transparent: true, opacity: 0.35, roughness: 0.05, double: true })
const LED = mat('#eaf6ff', { emissive: '#d6efff', emissiveIntensity: 0.9 })
const WATER = mat('#e8f8ff', { emissive: '#bfe8ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.6, roughness: 0.1 })
const LAMP = mat('#fff6dc', { emissive: '#ffe6a8', emissiveIntensity: 0.8 })

// ── 배치 값 ──
const PLATFORM = SEOUL_STATION.platform
const TRACK_Z = SEOUL_STATION.trackZ
const PLAZA = { x: 22, z0: -88, z1: 84 } // 광장 (가로 ±22)
const ROAD = { x0: 22, x1: 38 } // 양쪽 차로
const WALK = { x0: 38, x1: 44 } // 인도
const LAWN = [-9, 9, -45, 55]
const STEPS = 6 // 승강장 → 광장 계단

function seeded(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

// 빌딩 목록 (양쪽 3줄). [x, z, 가로, 세로, 높이, 외벽 종류]
const BUILDINGS = (() => {
  const r = seeded(29)
  const list = []
  for (const side of [-1, 1]) {
    for (const [x0, x1, hMin, hMax] of [[48, 74, 18, 42], [80, 106, 30, 68], [112, 138, 24, 56]]) {
      let z = -86
      while (z < 82) {
        const d = 18 + r() * 12
        if (z + d > 84) break
        const w = (x1 - x0) * (0.75 + r() * 0.25)
        list.push({ x: side * (x0 + w / 2), z: z + d / 2, w, d: d - 3, h: hMin + r() * (hMax - hMin), kind: Math.floor(r() * 4) })
        z += d + 2
      }
    }
  }
  // A low cultural hall breaks the west-side tower row beside the square.
  const hall = list.find(b => b.x < -44 && b.x > -76 && b.z > 0)
  if (hall) Object.assign(hall, { cultural: true, h: 10, kind: 3 })
  return list.filter(b => !CHANNELS.some(([a,c]) => b.x+b.w/2 > a && b.x-b.w/2 < c))
})()

// 차 목록: [x, z, 방향(1 북·-1 남), 종류(0 승용·1 버스), 색]
const CARS = (() => {
  const r = seeded(7)
  const colors = ['#f2f2f0', '#1d1f24', '#a9aeb5', '#2a5aa8', '#b8322b', '#e8e4d8', '#3d4a3f']
  const list = []
  for (const side of [-1, 1]) {
    for (const lane of [0, 1, 2]) {
      const x = side * (24 + lane * 4.6 + 1.9)
      let z = -78 + r() * 10
      while (z < 76) {
        const bus = lane === 2 && r() > 0.6
        list.push({ x, z, dir: side, bus, color: bus ? (r() > 0.5 ? '#2f63c4' : '#3c9a4f') : colors[Math.floor(r() * colors.length)] })
        z += (bus ? 16 : 9) + r() * 16
      }
    }
  }
  // 횡단보도 위는 비워요
  return list.filter((c) => ![-80, -10, 60].some((cz) => Math.abs(c.z - cz) < (c.bus ? 8 : 5)))
})()

// ── 캔버스 무늬 ──
const texCache = new Map()
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  const k = `${key}|${repeat.join(',')}`
  if (texCache.has(k)) return texCache.get(k)
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
  t.repeat.set(...repeat)
  t.anisotropy = 4
  texCache.set(k, t)
  return t
}
// 유리 빌딩 외벽: 층마다 창 띠 + 세로 멀리언, 군데군데 불 켜진 창
const FACADES = [
  ['#5f7f96', '#a9c4d6', '#2f4252'], // 푸른 유리
  ['#4f8a8a', '#a2d0cc', '#2d4d4c'], // 청록 유리
  ['#3a3f47', '#7d8794', '#1f2328'], // 검은 유리
  ['#c9c1b2', '#7f8d99', '#8a8273'], // 석재 + 창
]
const facadeMats = new Map()
function facadeMat(kind, w, h) {
  const reps = [Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 12))]
  const key = `${kind}|${reps.join('x')}`
  if (facadeMats.has(key)) return facadeMats.get(key)
  const [wall, glass, frame] = FACADES[kind]
  const t = canvasTex(`facade${kind}`, 128, 128, (ctx, W, H) => {
    const r = seeded(3 + kind)
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, W, H)
    for (let fy = 0; fy < 4; fy += 1) {
      for (let fx = 0; fx < 4; fx += 1) {
        const lit = r() > 0.82
        ctx.fillStyle = lit ? '#ffe7a8' : glass
        ctx.globalAlpha = lit ? 0.9 : 0.85 + r() * 0.15
        ctx.fillRect(fx * 32 + 3, fy * 32 + 6, 26, 22)
        ctx.globalAlpha = 0.32
        ctx.fillStyle = lit ? '#82674c' : '#dcf1ff'
        ctx.fillRect(fx*32+4, fy*32+7, 24, lit ? 4+r()*8 : 3)
        ctx.globalAlpha = 1
        ctx.fillStyle = frame
        ctx.fillRect(fx*32+17, fy*32+6, 1, 22)
      }
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = frame
    for (let i = 0; i <= 4; i += 1) ctx.fillRect(i * 32 - 1, 0, 2, H)
  }, reps)
  const m = t ? new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .14, roughness: kind === 3 ? 0.85 : 0.35, metalness: kind === 3 ? 0 : 0.25 }) : mat(wall)
  facadeMats.set(key, m)
  return m
}
function asphaltMat(rx, rz) {
  const t = canvasTex('asphalt', 128, 128, (ctx, W, H) => {
    const r = seeded(17)
    ctx.fillStyle = '#4b4e53'
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 900; i += 1) {
      const v = 60 + r() * 40
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`
      ctx.fillRect(r() * W, r() * H, 1.5, 1.5)
    }
  }, [rx, rz])
  return t ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }) : mat('#4b4e53')
}

// ── 바닥: 승강장 앞 광장(포석) · 잔디 · 차로(아스팔트) · 인도 ──
function Grounds() {
  const plazaRects = useMemo(() => {
    const [lx0, lx1, lz0, lz1] = LAWN
    return [
      [-PLAZA.x, PLAZA.x, PLAZA.z0, lz0],
      [-PLAZA.x, PLAZA.x, lz1, PLAZA.z1],
      [-PLAZA.x, lx0, lz0, lz1],
      [lx1, PLAZA.x, lz0, lz1],
      [-150, 150, -92, PLAZA.z0], // 승강장 앞 넓은 마당
      [-WALK.x1, -WALK.x0, PLAZA.z0, PLAZA.z1],
      [WALK.x0, WALK.x1, PLAZA.z0, PLAZA.z1],
    ]
  }, [])
  const lawn = useMemo(() => [LAWN], [])
  const roadLen = PLAZA.z1 - PLAZA.z0
  const lines = useMemo(() => {
    const list = []
    for (const side of [-1, 1]) {
      for (const lx of [26.6, 31.2]) {
        for (let z = PLAZA.z0 + 2; z < PLAZA.z1 - 2; z += 6) list.push({ p: [side * lx, 0.025, z], s: [0.15, 0.01, 3], c: '#f2f2ee' })
      }
      list.push({ p: [side * (ROAD.x0 + 0.3), 0.025, (PLAZA.z0 + PLAZA.z1) / 2], s: [0.15, 0.01, roadLen], c: '#f0c23b' }) // 노란 중앙선 쪽
      // 횡단보도
      for (const cz of [-80, -10, 60]) {
        for (let k = 0; k < 8; k += 1) list.push({ p: [side * (ROAD.x0 + 1 + k * 2), 0.026, cz], s: [1.1, 0.01, 4], c: '#f4f4f0' })
        list.push({ p: [side * (ROAD.x0 + 8), 0.025, cz + 2.6], s: [16, 0.01, 0.4], c: '#f4f4f0' }) // 정지선
      }
    }
    return list
  }, [roadLen])
  const curbs = useMemo(() => {
    const list = []
    for (const side of [-1, 1]) {
      for (const x of [ROAD.x0, ROAD.x1]) list.push({ p: [side * x, 0.08, (PLAZA.z0 + PLAZA.z1) / 2], s: [0.3, 0.16, roadLen], c: '#c9c6bd' })
    }
    return list
  }, [roadLen])
  return (
    <>
      {/* 바탕 땅 (바깥 바다 위를 덮어요) */}
      {dryRects(-160,160,-160,160).map(([a,b,c,d])=>(
        <mesh key={a+','+c} position={[(a+b)/2,0,(c+d)/2]} rotation-x={-Math.PI/2}>
          <planeGeometry args={[b-a,d-c]}/><meshStandardMaterial color="#6f8f58" />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (ROAD.x0 + ROAD.x1) / 2, 0.012, (PLAZA.z0 + PLAZA.z1) / 2]} rotation-x={-Math.PI / 2} material={asphaltMat(4, 40)}>
          <planeGeometry args={[ROAD.x1 - ROAD.x0, roadLen]} />
        </mesh>
      ))}
      {/* 빌딩 블록 바닥 */}
      {[[-140,-44,-92,92],...dryRects(44,140,-92,92)].map(([a,b,c,d])=>(
        <mesh key={a+','+c} position={[(a+b)/2,.01,(c+d)/2]} rotation-x={-Math.PI/2}>
          <planeGeometry args={[b-a,d-c]}/><meshStandardMaterial color="#b9b6ae" roughness={.95}/>
        </mesh>
      ))}
      <StoneFloor kind="paver" rects={plazaRects} y={0.02} />
      <StoneFloor kind="lawn" rects={lawn} y={0.03} />
      <Instances geometry={GEO.box} material={P} items={lines} />
      <Instances geometry={GEO.box} material={P} items={curbs} />
    </>
  )
}

// ── 광장 꾸미기: 꽃밭·분수·은행나무·벤치·가로등·신호등·버스 정류장 ──
function PlazaDecor() {
  const { boxes, cyls, flowers, leaves, lamps } = useMemo(() => {
    const r = seeded(41)
    const boxes = []
    const cyls = []
    const flowers = []
    const leaves = []
    const lamps = []
    const [, , lz0, lz1] = LAWN
    // 꽃밭: 잔디 양옆 긴 화단 (나무 테두리 + 국화 송이)
    const palette = ['#f2c13d', '#e9692c', '#d8418a', '#f5f0e6', '#b04fc4', '#f08aa8']
    for (const side of [-1, 1]) {
      boxes.push({ p: [side * 11.6, 0.22, (lz0 + lz1) / 2], s: [2.6, 0.44, lz1 - lz0], c: '#7a5a3f' })
      boxes.push({ p: [side * 11.6, 0.45, (lz0 + lz1) / 2], s: [2.3, 0.04, lz1 - lz0 - 0.3], c: '#4a3a2c' })
      for (let z = lz0 + 0.6; z < lz1 - 0.4; z += 0.55) {
        for (const dx of [-0.75, 0, 0.75]) {
          const s = 0.26 + r() * 0.12
          leaves.push({ p: [side * 11.6 + dx + (r() - 0.5) * 0.2, 0.55, z], s: [s * 1.3, s, s * 1.3], c: '#4f7d43' })
          flowers.push({ p: [side * 11.6 + dx + (r() - 0.5) * 0.25, 0.7 + r() * 0.08, z + (r() - 0.5) * 0.25], s: [s, s * 0.7, s], c: palette[Math.floor(r() * palette.length)] })
        }
      }
    }
    // 바닥 분수: 얕은 물판 + 물줄기 (높이는 매 프레임 바뀜 — Fountain)
    // 은행나무 줄 + 벤치 + 가로등
    for (const side of [-1, 1]) {
      for (let z = -80; z <= 78; z += 10) {
        const x = side * 19.5
        cyls.push({ p: [x, 1.6, z], s: [0.18, 3.2, 0.18], c: '#5a4636' })
        const s = 2.2 + r() * 0.5
        leaves.push({ p: [x, 3.9, z], s: [s, s * 1.3, s], c: r() > 0.5 ? '#e6c23a' : '#d9b42f' })
        leaves.push({ p: [x + 0.4, 4.9, z - 0.2], s: [s * 0.7, s * 0.9, s * 0.7], c: '#efcf48' })
      }
      for (let z = -75; z <= 75; z += 15) {
        const x = side * 16.4
        // 벤치 (나무 좌판 + 철 다리)
        boxes.push({ p: [x, 0.45, z + 5], s: [0.6, 0.08, 2.2], c: '#a8784a' })
        boxes.push({ p: [x + side * 0.27, 0.75, z + 5], s: [0.08, 0.5, 2.2], c: '#a8784a' })
        for (const dz of [-0.9, 0.9]) boxes.push({ p: [x, 0.22, z + 5 + dz], s: [0.55, 0.44, 0.08], c: '#3a3d42' })
        // 가로등 (가는 기둥 + 위 등)
        cyls.push({ p: [x, 2.6, z], s: [0.08, 5.2, 0.08], c: '#3a3d42' })
        boxes.push({ p: [x - side * 0.4, 5.15, z], s: [0.9, 0.08, 0.2], c: '#3a3d42' })
        lamps.push({ p: [x - side * 0.75, 5.05, z], s: [0.35, 0.12, 0.25] })
      }
      // 신호등 (횡단보도 양끝)
      for (const cz of [-80, -10, 60]) {
        for (const x of [ROAD.x0 - 0.8, ROAD.x1 + 0.8]) {
          cyls.push({ p: [side * x, 2.1, cz + 3], s: [0.09, 4.2, 0.09], c: '#2b2d31' })
          boxes.push({ p: [side * x, 4.0, cz + 3], s: [0.35, 0.95, 0.3], c: '#1f2125' })
        }
      }
      // 버스 정류장 (인도 위): 지붕 + 유리 벽 + 의자
      const bx = side * 41
      boxes.push({ p: [bx, 2.7, 22], s: [2.2, 0.12, 6], c: '#2f3b48' })
      for (const dz of [-2.9, 2.9]) boxes.push({ p: [bx + side * 0.9, 1.35, 22 + dz], s: [0.12, 2.7, 0.12], c: '#2f3b48' })
      boxes.push({ p: [bx + side * 0.6, 0.5, 22], s: [0.5, 0.08, 4.5], c: '#9aa3ad' })
      boxes.push({ p: [bx, 2.35, 22], s: [0.6, 0.5, 1.6], c: '#1f6fd1' }) // 노선 안내판
    }
    return { boxes, cyls, flowers, leaves, lamps }
  }, [])
  return (
    <>
      <Instances geometry={GEO.box} material={P} items={boxes} />
      <Instances geometry={GEO.cyl8} material={P} items={cyls} />
      <Instances geometry={GEO.sphere} material={P} items={flowers} />
      <Instances geometry={GEO.ico} material={P} items={leaves} />
      <Instances geometry={GEO.box} material={LAMP} items={lamps} />
      <Fountain />
    </>
  )
}

// 바닥 분수: 승강장 앞 광장 (물줄기 높이가 물결처럼 오르내려요)
function Fountain() {
  const ref = useRef(null)
  const jets = useMemo(() => {
    const list = []
    for (let i = 0; i < 9; i += 1) for (let j = 0; j < 3; j += 1) list.push([-8 + i * 2, -72 + j * 3])
    return list
  }, [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    jets.forEach(([x, z], i) => {
      const h = 0.6 + (Math.sin(t * 1.6 + i * 0.7) * 0.5 + 0.5) * 2.2
      tmp.position.set(x, h / 2, z)
      tmp.scale.set(0.09, h, 0.09)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <mesh position={[0, 0.035, -69]} rotation-x={-Math.PI / 2} material={WATER}>
        <planeGeometry args={[19, 8]} />
      </mesh>
      <instancedMesh ref={ref} args={[GEO.cyl8, WATER, jets.length]} frustumCulled={false} />
    </>
  )
}

// ── 빌딩 숲 ──
function Buildings() {
  const roofs = useMemo(() => {
    const list = []
    for (const b of BUILDINGS) {
      const street = b.x - Math.sign(b.x)*b.w/2
      if (b.cultural) {
        list.push({p:[b.x,b.h+.6,b.z],s:[b.w+3,1.2,b.d+3],c:'#918d86'})
        list.push({p:[b.x-2,b.h+2.6,b.z],s:[b.w*.7,4,b.d*.72],c:'#aaa399'})
        for(let dz=-b.d/2+1;dz<b.d/2;dz+=2.8){
          list.push({p:[street+1.2,4.9,b.z+dz],s:[.75,9.8,.76],c:'#e3d9c4'})
        }
      }
      for (let dz=-b.d/2+1.4;dz<b.d/2-1;dz+=2.7) {
        list.push({p:[street-Math.sign(b.x)*.14,1.82,b.z+dz],s:[.14,2.72,2.2],c:'#577a82'})
        if (b.kind===3) list.push({p:[street,b.h/2,b.z+dz],s:[.58,b.h,.44],c:'#cec9bc'})
      }
      if(b.kind===1 || b.kind===2) {
        for(let y=5;y<b.h;y+=4.6) list.push({p:[b.x,y,b.z],s:[b.w+.4,.19,b.d+.4],c:'#899ca7'})
      }
      if(b.kind===0){
        list.push({p:[street,3.5,b.z],s:[2.1,.22,b.d*.86],c:'#9badbb'})
        list.push({p:[b.x,b.h+2.25,b.z],s:[b.w*.76,4.5,b.d*.76],c:'#526b82'})
      }
      list.push({ p: [b.x, b.h + 0.15, b.z], s: [b.w + 0.3, 0.3, b.d + 0.3], c: '#8b9099' })
      list.push({ p: [b.x + b.w * 0.2, b.h + 1.1, b.z - b.d * 0.15], s: [b.w * 0.3, 1.6, b.d * 0.3], c: '#9aa0a8' }) // 옥상 기계실
      list.push({ p: [b.x, 2.0, b.z - Math.sign(b.x) * 0], s: [b.w + 0.2, 4, b.d + 0.2], c: ['#2f3b48', '#3d4a3f', '#4a3f3a', '#c9c1b2'][b.kind] }) // 1층 상가 띠
    }
    return list
  }, [])
  return (
    <>
      {BUILDINGS.map((b, i) => (
        <mesh key={i} geometry={GEO.box} material={facadeMat(b.kind, Math.max(b.w, b.d), b.h)} position={[b.x, b.h / 2, b.z]} scale={[b.w, b.h, b.d]} />
      ))}
      {/* Across the river, twin residential towers and the low waterfront skyline. */}
      {[[-48,50,9],[-34,42,8],[-16,13,13],[3,16,15],[25,14,14],[48,22,18]].map(([z,h,w])=>(
        <group key={z} position={[162,0,z]}>
          <mesh geometry={GEO.box} material={facadeMat(0,w,h)} position-y={h/2} scale={[8,h,w]}/>
          <mesh geometry={GEO.box} material={facadeMat(2,w,h*.2)} position-y={h+1.5} scale={[6,3,w*.76]}/>
        </group>
      ))}
      <Instances geometry={GEO.box} material={P} items={roofs} />
    </>
  )
}

// ── 자동차·버스 ──
function Cars() {
  const { bodies, glass, wheels } = useMemo(() => {
    const bodies = []
    const glass = []
    const wheels = []
    for (const c of CARS) {
      const L = c.bus ? 11 : 4.4
      const W = c.bus ? 2.5 : 1.85
      const H = c.bus ? 2.9 : 0.75
      bodies.push({ p: [c.x, 0.35 + H / 2, c.z], s: [W, H, L], c: c.color })
      if (c.bus) {
        glass.push({ p: [c.x, 2.0, c.z], s: [W + 0.02, 1.1, L - 1.2] })
        bodies.push({ p: [c.x, 3.32, c.z], s: [W - 0.3, 0.12, L - 1.5], c: '#e8e8e8' })
      } else {
        bodies.push({ p: [c.x, 1.35, c.z - c.dir * 0.2], s: [W - 0.15, 0.55, L * 0.55], c: c.color })
        glass.push({ p: [c.x, 1.36, c.z - c.dir * 0.2], s: [W - 0.1, 0.44, L * 0.5] })
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) wheels.push({ p: [c.x + sx * (W / 2 - 0.12), 0.35, c.z + sz * (L / 2 - (c.bus ? 1.8 : 0.85))], s: [0.35, 0.22, 0.35], r: [0, 0, Math.PI / 2], c: '#1a1a1c' })
    }
    return { bodies, glass, wheels }
  }, [])
  return (
    <>
      <Instances geometry={GEO.box} material={SHINY} items={bodies} />
      <Instances geometry={GEO.box} material={GLASS_DARK} items={glass} />
      <Instances geometry={GEO.cyl8} material={P} items={wheels} />
    </>
  )
}

// ── 서울역 승강장 + 선로 + 터널 ──
function Station() {
  const { boxes, cyls } = useMemo(() => {
    const boxes = []
    const cyls = []
    const { x0, x1, z0, z1, top } = PLATFORM
    const cx = (x0 + x1) / 2
    // 승강장 몸통 + 윗면 + 노란 점자 블록 + 흰 안전선
    boxes.push({ p: [cx, top / 2, (z0 + z1) / 2], s: [x1 - x0, top, z1 - z0], c: '#b7b4ab' })
    boxes.push({ p: [cx, top + 0.01, (z0 + z1) / 2], s: [x1 - x0, 0.02, z1 - z0], c: '#d8d4ca' })
    boxes.push({ p: [cx, top + 0.025, z0 + 0.9], s: [x1 - x0, 0.01, 0.45], c: '#f0c23b' })
    boxes.push({ p: [cx, top + 0.025, z0 + 0.35], s: [x1 - x0, 0.01, 0.12], c: '#f4f4f0' })
    // 스크린도어 기둥 (선로 쪽, 열차 문 자리는 비움)
    for (let x = x0 + 2; x < x1 - 1; x += 4) boxes.push({ p: [x, top + 1.0, z0 + 0.2], s: [0.12, 2.0, 0.12], c: '#9aa3ad' })
    // 계단 (승강장 → 광장, 북쪽 가운데)
    for (let k = 0; k < STEPS; k += 1) {
      const h = top - (top / STEPS) * k
      boxes.push({ p: [0, h / 2, z1 + 0.25 + k * 0.5], s: [16, h, 0.5], c: k % 2 ? '#c9c5bb' : '#bdb9ae' })
    }
    // 유리 지붕: 기둥 + 들보 + 유리판
    for (let x = x0 + 4; x <= x1 - 4; x += 12) {
      cyls.push({ p: [x, top + 2.6, (z0 + z1) / 2 + 1], s: [0.16, 5.2, 0.16], c: '#e6e8ea' })
      boxes.push({ p: [x, top + 5.25, (z0 + z1) / 2], s: [0.22, 0.25, z1 - z0 + 3], c: '#e6e8ea' })
    }
    boxes.push({ p: [cx, top + 5.4, z0 - 1.2], s: [x1 - x0 + 2, 0.22, 0.25], c: '#e6e8ea' })
    boxes.push({ p: [cx, top + 5.4, z1 + 1.2], s: [x1 - x0 + 2, 0.22, 0.25], c: '#e6e8ea' })
    // 선로: 자갈 띠 + 침목 + 레일 (터널 사이)
    boxes.push({ p: [0, 0.03, TRACK_Z], s: [310, 0.06, 4.2], c: '#7c7872' })
    for (let x = -152; x <= 152; x += 0.9) boxes.push({ p: [x, 0.1, TRACK_Z], s: [0.28, 0.1, 2.6], c: '#9b9790' })
    for (const dz of [-0.72, 0.72]) boxes.push({ p: [0, 0.2, TRACK_Z + dz], s: [304, 0.12, 0.09], c: '#6d7177' })
    // 선로 뒤(남쪽) 방음벽
    for (let x = -148; x <= 148; x += 4) boxes.push({ p: [x, 1.4, TRACK_Z - 3.4], s: [3.9, 2.8, 0.2], c: x % 8 ? '#cfd8de' : '#bcc7cf' })
    // 선로 옆 낮은 울타리 (승강장 밖)
    for (const [a, b] of [[-148, x0], [x1, 148]]) {
      boxes.push({ p: [(a + b) / 2, 0.9, z0 - 0.25], s: [b - a, 0.06, 0.06], c: '#8a9199' })
      for (let x = a; x <= b; x += 3) boxes.push({ p: [x, 0.5, z0 - 0.25], s: [0.08, 1.0, 0.08], c: '#8a9199' })
    }
    // 터널 입구 (동·서): 콘크리트 문틀
    for (const side of [-1, 1]) {
      const x = side * 150
      boxes.push({ p: [x, 3.6, TRACK_Z + 3.1], s: [3, 7.2, 1.6], c: '#a8a49b' })
      boxes.push({ p: [x, 3.6, TRACK_Z - 3.1], s: [3, 7.2, 1.6], c: '#a8a49b' })
      boxes.push({ p: [x, 7.6, TRACK_Z], s: [3, 1.2, 8], c: '#a8a49b' })
      boxes.push({ p: [x + side * 1.4, 3.3, TRACK_Z], s: [0.2, 6.6, 4.6], c: '#141516' })
    }
    return { boxes, cyls }
  }, [])
  const { x0, x1, z0, z1, top } = PLATFORM
  const board = getSignTexture('시간 열차 · 1930 경성행 — 열차가 서면 E로 타요', '#101418', '#ffb43a', 9)
  return (
    <>
      <Instances geometry={GEO.box} material={P} items={boxes} />
      <Instances geometry={GEO.cyl8} material={P} items={cyls} />
      <mesh position={[(x0 + x1) / 2, top + 5.5, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} material={CANOPY_GLASS}>
        <planeGeometry args={[x1 - x0 + 2, z1 - z0 + 3]} />
      </mesh>
      {/* 역 이름판 (양쪽에서 보이게) + 출발 안내판 */}
      {[-24, 24].map((x) => (
        <group key={x} position={[x, top + 3.4, (z0 + z1) / 2 + 1]}>
          <HjTimeRouteSign width={6} />
        </group>
      ))}
      <mesh position={[0, top + 3.7, z0 + 1.6]} rotation-y={Math.PI}>
        <planeGeometry args={[9, 1]} />
        <meshBasicMaterial map={board} />
      </mesh>
      <mesh position={[0, top + 3.7, z0 + 1.6]}>
        <planeGeometry args={[9, 1]} />
        <meshBasicMaterial map={board} />
      </mesh>
      {/* 승강장 천장 조명 줄 */}
      {[-30, -18, -6, 6, 18, 30].map((x) => (
        <mesh key={x} geometry={GEO.box} material={LED} position={[x, top + 5.05, (z0 + z1) / 2]} scale={[6, 0.06, 0.3]} />
      ))}
    </>
  )
}

// ── 광화문 + 궁 담장 + 너머 전각 지붕 + 북악산 ──
function PalaceNorth() {
  return (
    <>
      <group position={[0, 0, GATE_Z - GWANGHWAMUN.az]}>
        <Gwanghwamun />
      </group>
      <Wall from={[-70, GATE_Z]} to={[-7.1, GATE_Z]} />
      <Wall from={[7.1, GATE_Z]} to={[70, GATE_Z]} />
      {/* 담장 너머: 흥례문 · 근정전 (지붕이 겹쳐 보이게) */}
      <HanokHall position={[0, 0.2, GATE_Z + 16]} width={9} depth={3.4} height={2.6} bays={3} sideBays={2} base={0.15} mode="gate" roof="hip" upper japsang={5} />
      <HanokHall position={[0, 1.2, GATE_Z + 34]} width={16} depth={9} height={4.2} bays={5} sideBays={3} base={1.2} mode="open" roof="hip" upper japsang={7} />
      <HanokHall position={[-22, 0.4, GATE_Z + 28]} width={12} depth={4.5} height={2.8} bays={7} sideBays={2} base={0.4} roof="hipgable" />
      <HanokHall position={[24, 0.4, GATE_Z + 24]} width={12} depth={4.5} height={2.8} bays={7} sideBays={2} base={0.4} roof="hipgable" />
    </>
  )
}

// 사방 산: 북쪽 북악산(사진처럼 광화문 뒤로) + 동·서·남 낮은 산
const SIDE_PEAKS = [
  [0, 70, 120, 60, 46, 1.2, 0.2, 0],
  [-130, 90, 110, 70, 40, 1.2, 0.2, 0],
  [125, 80, 110, 60, 55, 1.3, 0.3, 0],
  [40, 190, 150, 70, 96, 1.2, 0.45, 1],
]
function Mountains() {
  return (
    <>
      <group position={[0, 0, 124]}>
        <MountainRange width={560} depth={320} />
      </group>
      <group position={[156, 0, 0]} rotation-y={Math.PI / 2}>
        <MountainRange peaks={SIDE_PEAKS} width={420} depth={260} trees={300} rocks={10} />
      </group>
      <group position={[-156, 0, 0]} rotation-y={-Math.PI / 2}>
        <MountainRange peaks={SIDE_PEAKS} width={420} depth={260} trees={300} rocks={10} />
      </group>
      <group position={[0, 0, -112]} rotation-y={Math.PI}>
        <MountainRange peaks={SIDE_PEAKS} width={420} depth={260} trees={300} rocks={10} />
      </group>
    </>
  )
}

// ── 시간 열차 (하얀 전동 열차 3량): 동서로 달려요. 서울역에 서면 E로 타기 → 동쪽 터널로 들어가면 1930 경성으로 ──
const T_W = 3.0
const T_FLOOR = 1.0
const CAR_L = 16
const CAR_Z = { lead: 16.6, mid: 0, tail: -16.6 }
function trainSeats() {
  const list = []
  for (const [car, cz] of [['lead', CAR_Z.lead - 1.5], ['mid', CAR_Z.mid]]) {
    for (let i = 0; i < 8; i += 1) {
      const z = cz - 5.6 + i * 1.35
      for (const side of [-1, 1]) for (const k of [0, 1]) list.push({ id: `${car}${i}${side > 0 ? 'r' : 'l'}${k}`, x: side * (0.5 + k * 0.52), y: T_FLOOR + 0.46, z, yaw: 0, taken: false })
    }
  }
  return list
}
function TrainCar({ z, nose = 0 }) {
  // nose: 1 = 앞(+z) 머리, -1 = 뒤(-z) 머리, 0 = 가운데 칸
  const items = useMemo(() => {
    const list = []
    const len = CAR_L - (nose ? 3 : 0)
    const zc = z - nose * 1.5
    const b = (p, s, c) => list.push({ p, s, c })
    b([0, T_FLOOR - 0.35, zc], [T_W - 0.2, 0.5, len], '#6d7177') // 차 밑
    b([0, T_FLOOR - 0.04, zc], [T_W - 0.1, 0.08, len], '#9aa3ad') // 바닥
    b([0, T_FLOOR + 2.45, zc], [0.5, 0.04, len - 0.6], '#eaf6ff') // 천장 조명 (밝은 판)
    // 좌석: 파란 등받이 의자 (기차 좌석 자리와 같은 줄)
    if (nose >= 0) {
      for (let i = 0; i < 8; i += 1) {
        const sz = (nose ? CAR_Z.lead - 1.5 : CAR_Z.mid) - 5.6 + i * 1.35
        for (const side of [-1, 1]) {
          b([side * 0.76, T_FLOOR + 0.25, sz], [1.0, 0.42, 0.5], '#2c5aa8')
          b([side * 0.76, T_FLOOR + 0.8, sz - 0.24], [1.0, 0.75, 0.1], '#2c5aa8')
          b([side * 0.76, T_FLOOR + 1.12, sz - 0.24], [1.0, 0.14, 0.12], '#f3f5f7') // 머리 받침 덮개
        }
      }
    }
    // 연결부(검은 고무 주름)
    if (nose <= 0) b([0, T_FLOOR + 1.2, z + CAR_L / 2 + 0.3], [T_W - 0.5, 2.4, 0.6], '#2a2c30')
    // 바퀴 뭉치
    for (const dz of [-len / 2 + 2.2, len / 2 - 2.2]) b([0, 0.45, zc + dz], [T_W - 0.6, 0.6, 2.4], '#3a3d42')
    return list
  }, [z, nose])
  return (
    <>
      <Instances geometry={GEO.box} material={P} items={items} />
      <group position-z={z} rotation-y={nose < 0 ? Math.PI : 0}>
        <SeoulTrainShell cab={nose !== 0} />
      </group>
    </>
  )
}

const ROUTE = { start: -235, station: 0, end: 235, clip: [-149, 149] }
const SCHEDULE = { IN: 16, DWELL: 24, OUT: 16, GAP: 8 }
function SeoulTrain() {
  const ref = useRef(null)
  const parts = useRef({})
  const seats = useMemo(() => trainSeats(), [])
  const vehicle = useMemo(() => ({ id: 'seoul_time_train', label: '시간 열차', stopped: true, w: T_W, l: 50, reach: 5.2, seats: [] }), [])
  useEffect(() => registerVehicle(vehicle), [vehicle])
  useFrame(() => {
    if (!ref.current) return
    const { IN, DWELL, OUT, GAP } = SCHEDULE
    const period = IN + DWELL + OUT + GAP
    const t = (sharedSeconds() + 11) % period
    let pos = ROUTE.end
    let stopped = false
    let shown = true
    if (t < IN) {
      const k = t / IN
      pos = ROUTE.start + (ROUTE.station - ROUTE.start) * (1 - (1 - k) * (1 - k))
    } else if (t < IN + DWELL) {
      pos = ROUTE.station
      stopped = true
    } else if (t < IN + DWELL + OUT) {
      const k = (t - IN - DWELL) / OUT
      pos = ROUTE.station + (ROUTE.end - ROUTE.station) * k * k
    } else shown = false
    ref.current.position.z = pos
    const [lo, hi] = ROUTE.clip
    for (const [name, offset] of Object.entries(CAR_Z)) {
      const g = parts.current[name]
      if (g) g.visible = shown && pos + offset - CAR_L / 2 <= hi && pos + offset + CAR_L / 2 >= lo
    }
    vehicle.stopped = stopped
    updateVehicleWorld(vehicle, ref.current, seats, [-(T_W / 2 + 1.7), 0.9, 0]) // 내리는 쪽 = 승강장(북쪽)
    // 열차 가운데 칸이 동쪽 터널로 들어가면 → 시간 터널 → 1930 경성역 승강장
    const midIn = shown && pos + CAR_Z.mid >= lo && pos + CAR_Z.mid <= hi
    const leaving = pos > ROUTE.station
    vehicle.forceExit = !midIn && leaving ? GYEONGSEONG_ARRIVE : null
    vehicle.exitTransition = !midIn && leaving ? 'toGyeongseong' : null
  })
  const people = seats.filter((s) => s.taken)
  return (
    <group position={[0, 0, TRACK_Z]} rotation-y={Math.PI / 2}>
      <group ref={ref}>
        <group ref={(el) => (parts.current.lead = el)}>
          <TrainCar z={CAR_Z.lead} nose={1} />
        </group>
        <group ref={(el) => (parts.current.mid = el)}>
          <TrainCar z={CAR_Z.mid} />
        </group>
        <group ref={(el) => (parts.current.tail = el)}>
          <TrainCar z={CAR_Z.tail} nose={-1} />
        </group>
        {people.map((s, i) => (
          <SeatedPerson key={s.id} look={i * 7 + 2} position={[s.x, s.y, s.z]} yaw={s.yaw} />
        ))}
      </group>
    </group>
  )
}

// ── 충돌 박스 (늘 있어요: 도착하자마자 바닥이 있어야 해서) ──
function SeoulColliders() {
  const boxes = useMemo(() => {
    const list = []
    const add = (x, y, z, sx, sy, sz) => list.push({ x, y, z, sx, sy, sz })
    for(const [a,b,c,d] of dryRects(-170,170,-170,170)) add((a+b)/2,-.5,(c+d)/2,b-a,1,d-c)
    for(const [a,b] of CHANNELS){
      let start=-BANK_END
      for(const [left,,z,w] of BRIDGES.filter(([left])=>left===a)){
        const end=z-w/2
        add((a+b)/2,.55,(start+end)/2,b-a,1.1,end-start)
        add((left+b)/2,-.09,z,b-a+.6,.22,w)
        start=z+w/2
      }
      add((a+b)/2,.55,(start+BANK_END)/2,b-a,1.1,BANK_END-start)
    } // 땅
    const { x0, x1, z0, z1, top } = PLATFORM
    add((x0 + x1) / 2, top / 2, (z0 + z1) / 2, x1 - x0, top, z1 - z0) // 승강장
    for (let k = 0; k < STEPS; k += 1) {
      const h = top - (top / STEPS) * k
      add(0, h / 2, z1 + 0.25 + k * 0.5, 16, h, 0.5)
    }
    add(0, 2, z0 - 0.3, 300, 4, 0.4) // 선로 쪽 (승강장 끝·울타리) — 선로로 못 내려가요
    add(0, 3, GATE_Z, 300, 6, 1.6) // 북쪽 광화문·담장
    add(-145, 3, -5, 2, 6, 200) // 서쪽 끝
    add(145, 3, -5, 2, 6, 200) // 동쪽 끝
    for (const b of BUILDINGS) add(b.x, b.h / 2, b.z, b.w, b.h, b.d)
    for (const c of CARS) add(c.x, c.bus ? 1.8 : 0.9, c.z, c.bus ? 2.5 : 1.85, c.bus ? 3.4 : 1.6, c.bus ? 11 : 4.4)
    return list
  }, [])
  return (
    <RigidBody type="fixed" colliders={false} position={SEOUL_CENTER} name="HJ/modern_seoul">
      {boxes.map((b, i) => (
        <CuboidCollider key={i} args={[b.sx / 2, b.sy / 2, b.sz / 2]} position={[b.x, b.y, b.z]} />
      ))}
    </RigidBody>
  )
}

export default function HjModernSeoul() {
  const active = useTimeTravel((s) => s.seoulActive)
  return (
    <>
      <SeoulColliders />
      {active && (
        <group position={SEOUL_CENTER} name="HJ/modern_seoul_view">
          <Grounds />
          <PlazaDecor />
          <Buildings />
          <SeoulWaterfront />
          <SeoulPedestrians />
          <Cars />
          <Station />
          <PalaceNorth />
          <Mountains />
          <SeoulTrain />
        </group>
      )}
    </>
  )
}
