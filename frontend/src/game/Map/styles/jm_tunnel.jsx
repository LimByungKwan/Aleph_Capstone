import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Box, Cyl, mat } from './kit.jsx'
import { JmEntryTitle } from './jm_entryTitle.jsx'
import { JM_RIVERBED_STYLES } from './jm_riverbed.jsx'
import { JM_CHANNEL_STYLES } from './jm_water.jsx'

// 애니 구역 입구 「붉은 터널 건물」 (11/25) — 담당: 지민
// 모티브: 「센과 치히로의 행방불명」 첫 장면의 터널 입구 (숲길 끝 붉은 회벽 건물 + 시계탑 같은 탑, 아래 아치형 어두운 터널,
//   앞에 두 얼굴 돌 석상, 길가 작은 돌 사당 / 터널을 빠져나오면 색유리 빛이 드는 대합실 같은 홀 → 밖은 온천 거리)
// 영화 속 건물을 그대로 옮기지 않고 공통 요소로만 만든 독자 디자인
// 소품 하나로 그림: size [폭, 높이, 길이], 로컬 +z = 남쪽(입구 쪽). 로컬 z: 건물 앞 +9 ~ 뒤 +3, 터널 +3 ~ -3, 홀 -3 ~ -9
// 걷는 판정(건물 양쪽 덩어리·터널 벽·홀 벽)은 생성 스크립트가 jmCollider로 (같은 숫자 TUNNEL)

// wing: (11/25 밤 지민 요청: 입구를 좌우로 넓혀 웅장하게) 가운데 탑 문 양옆 낮은 날개채(폭 w, 높이 h) + 끝 망루(폭 tower, 높이 towerH)
// (11/26 지민 요청: 영화 장면 사진처럼) 앞 덩어리 폭 9 · 높이 9.6, 양옆은 낮고 긴 벽(폭 10 · 높이 6.8 · 깊이 5)
export const TUNNEL = { wing: { w: 10, h: 6.8, d: 5 }, pass: 3.6, passH: 4.0, gate: { z0: 3, z1: 9, w: 9, h: 9.6 }, tube: { z0: 0, z1: 3 }, hall: { z0: -9, z1: 0, w: 14, h: 6.4 } }

// (11/26 지민 요청: 붉은 면에 이끼·사진 같은 디테일) 회벽 재질: 월드 좌표 노이즈로 얼룩·벗겨진 자리(밑의 밝은 회반죽)·
//   위에서 흘러내린 때·밑동과 군데군데 이끼를 셰이더에서 칠함 → 상자 크기와 상관없이 무늬 크기가 일정
const JM_NOISE = `
float jmH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float jmN(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(jmH(i), jmH(i + vec3(1,0,0)), f.x), mix(jmH(i + vec3(0,1,0)), jmH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(jmH(i + vec3(0,0,1)), jmH(i + vec3(1,0,1)), f.x), mix(jmH(i + vec3(0,1,1)), jmH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float jmF(vec3 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * jmN(p); p *= 2.03; a *= 0.5; } return s; }
`
const JM_WEATHER = `
{
  vec3 wp = vJmW;
  diffuseColor.rgb *= 0.84 + 0.34 * jmF(wp * 0.35);
  float fl = jmF(wp * 0.95 + 3.1);
  float flake = smoothstep(0.625, 0.64, fl);
  float rim = smoothstep(0.6, 0.625, fl) - flake;
  diffuseColor.rgb = mix(diffuseColor.rgb, uJmPale * (0.86 + 0.28 * jmF(wp * 3.0)), flake * uJmFlake);
  diffuseColor.rgb *= 1.0 - 0.32 * rim * uJmFlake;
  float st = jmF(vec3(wp.x * 1.7, wp.y * 0.12, wp.z * 1.7) + 9.0);
  diffuseColor.rgb *= 1.0 - 0.26 * smoothstep(0.42, 0.72, st);
  float mn = jmF(wp * 1.25 + 5.0);
  float m = (1.0 - smoothstep(0.05, 1.0 + 1.6 * mn, wp.y)) * smoothstep(0.33, 0.52, mn);
  m = max(m, smoothstep(0.69, 0.75, jmF(wp * 0.42 + 11.0)) * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, uJmMoss * (0.7 + 0.6 * jmF(wp * 4.0)), m * uJmMossAmt);
}
`
function weatheredMat(color, { flake = 1, moss = 1, roughness = 0.95 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uJmPale = { value: new THREE.Color('#d2b8a4') }
    sh.uniforms.uJmMoss = { value: new THREE.Color('#5a7a3a') }
    sh.uniforms.uJmFlake = { value: flake }
    sh.uniforms.uJmMossAmt = { value: moss }
    sh.vertexShader = `varying vec3 vJmW;
${sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vJmW = (modelMatrix * vec4(transformed, 1.0)).xyz;')}`
    sh.fragmentShader = `varying vec3 vJmW;
uniform vec3 uJmPale;
uniform vec3 uJmMoss;
uniform float uJmFlake;
uniform float uJmMossAmt;
${JM_NOISE}
${sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${JM_WEATHER}`)}`
  }
  m.customProgramCacheKey = () => `jmWeathered|${flake}|${moss}`
  return m
}
const RED_PLASTER = weatheredMat('#c25a50')
const GRIME = weatheredMat('#8f4a42', { flake: 0.3, roughness: 1 })
const WOOD_D = mat('#4a3324', { roughness: 0.9 })
const PLAQUE_FRAME = mat('#5a4636', { roughness: 0.8 })
const range = (n) => Array.from({ length: n }, (_, i) => i)
// 탑 치수: 붉은 나무 칸 → 발코니 → 아래가 퍼진 슬레이트 탑 → 시계 칸 → 구리 지붕
const T = { woodW: 3.6, woodH: 2.4, balW: 5.0, slateBot: 3.4, slateTop: 2.1, slateH: 4.6, clockW: 2.6, clockH: 2.3, roofW: 3.8, roofH: 3.0 }
const RED_DARK = mat('#8d3328', { roughness: 0.95 })
const STONE = mat('#8a8378', { roughness: 1, flat: true })
const STONE_DARK = mat('#5d5850', { roughness: 1, flat: true })
const ROOF = mat('#5e615f', { flat: true, roughness: 0.85, double: true })
const DARK = mat('#0b0a09', { roughness: 1 })
const TUBE_WALL = mat('#3a3631', { roughness: 1, double: true })
const LAMP = mat('#ffe7b0', { emissive: '#ffc46a', emissiveIntensity: 1.4 })
const MOUND = mat('#5f7d45', { flat: true, roughness: 1 })
const HALL_WALL = weatheredMat('#b9564b', { moss: 0.7 })
const MOSS = mat('#55704a', { roughness: 1 })

// 아치 모양 판(가운데가 뚫린 반원 아치 위쪽 벽) — 터널 입구 둘레
function archRing(outerW, h, innerW, innerH, depth = 0.6) {
  const s = new THREE.Shape()
  s.moveTo(-outerW / 2, 0)
  s.lineTo(-outerW / 2, h)
  s.lineTo(outerW / 2, h)
  s.lineTo(outerW / 2, 0)
  s.lineTo(innerW / 2, 0)
  const r = innerW / 2
  const spring = innerH - r
  s.lineTo(innerW / 2, spring)
  s.absarc(0, spring, r, 0, Math.PI, false)
  s.lineTo(-innerW / 2, 0)
  s.lineTo(-outerW / 2, 0)
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false })
}

// 반원 굴 (터널 천장)
function vaultGeometry(w, h, len) {
  const r = w / 2
  const g = new THREE.CylinderGeometry(r, r, len, 20, 1, true, -Math.PI / 2, Math.PI)
  g.rotateX(-Math.PI / 2) // 축 Y → Z, 반원이 위쪽으로
  g.translate(0, h - r, 0)
  return g
}

// ── 터널 안 대합실 (11/26 지민 요청: 보낸 장면 사진들 참고) ──
// 둥근 기둥 2줄 × 2 + 벽에 붙은 반기둥, 기둥 사이를 잇는 아치 갈비(납작한 반원) + 칸마다 둥근 천장,
// 높은 곳 아치 창(안쪽이 밝게 빛남) + 위쪽 둥근 4색 유리, 창에서 바닥까지 비스듬한 빛줄기,
// 기둥마다 튤립 모양 유리 등 3개, 기둥을 등지고 붙은 휘어진 나무 의자 한 쌍, 안쪽 벽 아래 작은 어두운 아치 문,
// 바랜 황록색 회벽(얼룩·벗겨짐·이끼), 바닥엔 떨어진 낙엽
// 좌표: JmTunnelGate 안 (로컬 +z = 남쪽 = 터널 쪽). TUNNEL.hall 범위 안에 그림
const HALL_OLIVE = weatheredMat('#8c8257', { flake: 0.7, moss: 0.45 })
const HALL_COLUMN = weatheredMat('#958f76', { flake: 0.35, moss: 0.4 })
const HALL_STONE_FLOOR = weatheredMat('#5f5a4b', { flake: 0, moss: 0.25, roughness: 0.85 })
const HALL_CEIL = mat('#4a4535', { roughness: 1, double: true })
const HALL_RIB = mat('#7d7760', { roughness: 0.95 })
const HALL_BAND = mat('#3b372d', { roughness: 0.9 })
const HALL_BAND_PALE = mat('#a39d84', { roughness: 0.9 })
const HALL_WIN = mat('#f3e7c4', { emissive: '#ffe2a0', emissiveIntensity: 0.9, roughness: 0.6 })
const HALL_DOOR = mat('#120f0b', { roughness: 1 })
const IRON = mat('#2a2622', { roughness: 0.6, metalness: 0.4 })
const TULIP = mat('#efe8d6', { emissive: '#ffe7b8', emissiveIntensity: 0.55, roughness: 0.35 })
const HALL_BENCH = mat('#5b4330', { roughness: 0.8 })
const STAIN = ['#c8463c', '#3f8f4a', '#3f6fc0', '#e0b440'].map((c) => mat(c, { emissive: c, emissiveIntensity: 1.1, roughness: 0.3, double: true }))
const BEAM = new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
const LEAF_C = ['#8a5a2a', '#a8642c', '#7a3a22', '#9c7a3a'].map((c) => mat(c, { roughness: 1, double: true }))
const HALL_SPRING = 3.7 // 아치가 시작하는 높이 (기둥 꼭대기)
const HALL_RISE = 1.6 // 기둥 사이 아치가 솟는 높이
const HALL_CEIL_Y = 6.0

// 납작한 반원 아치 갈비: a → b (수평 두 점), 높이 HALL_SPRING에서 시작해 rise만큼 솟음
function Rib({ a, b, rise = HALL_RISE, t = 0.11 }) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const span = Math.hypot(dx, dz)
  const r = span / 2
  return (
    <mesh
      position={[(a[0] + b[0]) / 2, HALL_SPRING, (a[1] + b[1]) / 2]}
      rotation={[0, -Math.atan2(dz, dx), 0]}
      scale={[1, rise / r, 1]}
      material={HALL_RIB}
    >
      <torusGeometry args={[r, t, 6, 18, Math.PI]} />
    </mesh>
  )
}

function HallColumn({ x, z, r = 0.32, half = false }) {
  const s = half ? 0.62 : 1
  return (
    <group position={[x, 0, z]}>
      {/* 받침: 넓은 고리 2단 + 어두운 무늬 띠 */}
      <Cyl p={[0, 0.12, 0]} rad={r * 1.45 * s} h={0.24} m={HALL_BAND_PALE} />
      <Cyl p={[0, 0.38, 0]} rad={r * 1.28 * s} h={0.28} m={HALL_BAND} />
      <Cyl p={[0, 0.56, 0]} rad={r * 1.2 * s} h={0.08} m={HALL_BAND_PALE} />
      <Cyl p={[0, HALL_SPRING / 2, 0]} rad={r * s} h={HALL_SPRING} m={HALL_COLUMN} />
      {/* 기둥머리: 고리 3개 */}
      {[0, 1, 2].map((i) => (
        <Cyl key={i} p={[0, HALL_SPRING - 0.5 + i * 0.16, 0]} rad={r * (1.12 + i * 0.1) * s} h={0.1} m={i === 1 ? HALL_BAND : HALL_BAND_PALE} />
      ))}
      <Box p={[0, HALL_SPRING - 0.04, 0]} s={[r * 3 * s, 0.08, r * 3 * s]} m={HALL_BAND_PALE} />
    </group>
  )
}

// 튤립 유리 등 3개 (기둥에 붙은 쇠 팔)
function Sconce({ x, z, dir, y = 2.9 }) {
  const a = Math.atan2(dir[0], dir[1])
  return (
    <group position={[x, y, z]} rotation={[0, a, 0]}>
      <Box p={[0, 0, 0.3]} s={[0.05, 0.05, 0.5]} m={IRON} />
      {[-0.2, 0, 0.2].map((dx, i) => (
        <group key={i} position={[dx, i === 1 ? 0.12 : 0, 0.5]}>
          <Box p={[0, -0.06, -0.06]} s={[0.03, 0.14, 0.03]} m={IRON} />
          <mesh position={[0, 0.06, 0]} material={TULIP}>
            <cylinderGeometry args={[0.085, 0.05, 0.17, 8]} />
          </mesh>
        </group>
      ))}
      <Box p={[0, 0, 0.5]} s={[0.48, 0.03, 0.03]} m={IRON} />
    </group>
  )
}

// 휘어진 등받이 나무 의자 (앞 = +z), 길이 len
function CurvedBench({ len = 1.8 }) {
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <Box key={`s${i}`} p={[0, 0.45, 0.05 + i * 0.11]} s={[len, 0.04, 0.09]} m={HALL_BENCH} />
      ))}
      {/* 등받이: 아래는 곧게, 위로 갈수록 뒤로 휘어 말림 */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const ang = -0.1 - i * 0.2
        return <Box key={`b${i}`} p={[0, 0.55 + i * 0.12 - i * i * 0.006, -0.03 - i * i * 0.012]} s={[len, 0.11, 0.035]} r={[ang, 0, 0]} m={HALL_BENCH} />
      })}
      {[-1, 1].map((e) => (
        <group key={e} position={[e * (len / 2 - 0.15), 0, 0.15]}>
          <Box p={[0, 0.22, 0]} s={[0.05, 0.44, 0.05]} m={IRON} />
          <Box p={[0, 0.03, 0]} s={[0.06, 0.06, 0.5]} m={IRON} />
          <Box p={[0, 0.43, 0]} s={[0.06, 0.04, 0.5]} m={IRON} />
        </group>
      ))}
    </group>
  )
}

// 높은 아치 창 (안쪽 벽에 붙음, 앞 = +z) + 위쪽 둥근 4색 유리
function HallWindow({ w = 0.9, h = 1.7 }) {
  const geo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-w / 2, 0)
    sh.lineTo(w / 2, 0)
    sh.lineTo(w / 2, h - w / 2)
    sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false)
    sh.lineTo(-w / 2, 0)
    return new THREE.ShapeGeometry(sh)
  }, [w, h])
  return (
    <group>
      <mesh geometry={geo} material={HALL_WIN} />
      {/* 창틀 깊이 (아래 턱) */}
      <Box p={[0, -0.04, 0.06]} s={[w + 0.12, 0.08, 0.14]} m={HALL_BAND_PALE} />
      {[0, 1, 2, 3].map((q) => (
        <mesh key={q} position={[0, h - w / 2, 0.02]} material={STAIN[q]}>
          <circleGeometry args={[0.2, 6, (q * Math.PI) / 2, Math.PI / 2]} />
        </mesh>
      ))}
      <mesh position={[0, h - w / 2, 0.025]} material={IRON}>
        <ringGeometry args={[0.2, 0.235, 20]} />
      </mesh>
      <Box p={[0, h - w / 2, 0.03]} s={[0.4, 0.025, 0.01]} m={IRON} />
      <Box p={[0, h - w / 2, 0.03]} s={[0.025, 0.4, 0.01]} m={IRON} />
    </group>
  )
}

// 창에서 바닥으로 비스듬히 떨어지는 빛줄기: 판 두 장을 엇갈려 어느 쪽에서 봐도 보이게 + 바닥 빛 얼룩
// from/to = [x, y, z] (같은 z, x-y 평면 안에서 기움), width = 창 폭 (z 방향)
function LightShaft({ from, to, width = 0.75 }) {
  const ax = to[0] - from[0]
  const ay = to[1] - from[1]
  const len = Math.hypot(ax, ay)
  const th = Math.atan2(-ax, ay) // 판의 긴 축(Y)을 빛 방향에 맞춤
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, from[2]]
  return (
    <group>
      <group position={mid} rotation={[0, 0, th]}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={BEAM}>
          <planeGeometry args={[width, len]} />
        </mesh>
        <mesh material={BEAM}>
          <planeGeometry args={[width * 0.7, len]} />
        </mesh>
      </group>
      <mesh position={[to[0], to[1] + 0.03, to[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.4, 0.75, 1]} material={BEAM}>
        <circleGeometry args={[0.6, 16]} />
      </mesh>
    </group>
  )
}

function JmWaitingHall({ hall, pass, passH }) {
  const x0 = -hall.w / 2 + 0.4 // 안쪽 벽면
  const x1 = hall.w / 2 - 0.4
  const zb = hall.z1 - 0.6 // 터널 쪽 벽 안쪽 면
  const zf = hall.z0 + 0.6 // 풀밭 쪽 벽 안쪽 면
  const hz = (hall.z0 + hall.z1) / 2
  const hd = hall.z1 - hall.z0
  const COLS_X = [-2.6, 2.6]
  const COLS_Z = [hz - 1.9, hz + 1.9]
  const gx = [x0, ...COLS_X, x1]
  const gz = [zf, ...COLS_Z, zb]
  const leaves = useMemo(() => {
    let seed = 9
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 110 }, () => [x0 + 0.3 + rnd() * (x1 - x0 - 0.6), zf + 0.2 + rnd() * (zb - zf - 0.4), rnd() * Math.PI, Math.floor(rnd() * LEAF_C.length), 0.05 + rnd() * 0.05])
  }, [x0, x1, zf, zb])
  return (
    <group>
      {/* 바닥 + 낙엽 */}
      <Box p={[0, 0.04, hz]} s={[hall.w - 0.4, 0.08, hd]} m={HALL_STONE_FLOOR} />
      {leaves.map(([x, z, r, c, s], i) => (
        <mesh key={i} position={[x, 0.085, z]} rotation={[-Math.PI / 2, 0, r]} scale={[s, s * 0.6, 1]} material={LEAF_C[c]}>
          <circleGeometry args={[1, 5]} />
        </mesh>
      ))}
      {/* 안쪽 벽면 (황록 회벽): 양옆 + 터널 쪽·풀밭 쪽 (가운데 아치 구멍은 겉벽 그대로) */}
      {[-1, 1].map((s) => (
        <Box key={`w${s}`} p={[s * (hall.w / 2 - 0.41), hall.h / 2, hz]} s={[0.02, hall.h - 0.1, hd - 1.2]} m={HALL_OLIVE} />
      ))}
      {[zb - 0.01, zf + 0.01].map((z, k) => (
        <group key={`e${k}`}>
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * (pass / 2 + (x1 - pass / 2) / 2), hall.h / 2, z]} s={[x1 - pass / 2, hall.h - 0.1, 0.02]} m={HALL_OLIVE} />
          ))}
          <Box p={[0, (passH + hall.h) / 2, z]} s={[pass, hall.h - passH, 0.02]} m={HALL_OLIVE} />
        </group>
      ))}
      {/* 기둥 + 벽 반기둥 */}
      {COLS_X.map((x) => COLS_Z.map((z) => <HallColumn key={`c${x}${z}`} x={x} z={z} />))}
      {COLS_Z.map((z) => [x0 + 0.12, x1 - 0.12].map((x) => <HallColumn key={`p${x}${z}`} x={x} z={z} half />))}
      {COLS_X.map((x) => [zb - 0.12, zf + 0.12].map((z) => <HallColumn key={`q${x}${z}`} x={x} z={z} half />))}
      {/* 아치 갈비: 기둥 줄을 따라 가로·세로 + 칸마다 대각선 + 둥근 천장 */}
      {gz.map((z) => gx.slice(0, -1).map((x, i) => <Rib key={`rx${x}${z}`} a={[x, z]} b={[gx[i + 1], z]} />))}
      {gx.map((x) => gz.slice(0, -1).map((z, i) => <Rib key={`rz${x}${z}`} a={[x, z]} b={[x, gz[i + 1]]} />))}
      {gx.slice(0, -1).map((xa, i) =>
        gz.slice(0, -1).map((za, j) => {
          const xb = gx[i + 1]
          const zb2 = gz[j + 1]
          return (
            <group key={`bay${i}${j}`}>
              <Rib a={[xa, za]} b={[xb, zb2]} rise={HALL_CEIL_Y - HALL_SPRING - 0.15} t={0.07} />
              <Rib a={[xa, zb2]} b={[xb, za]} rise={HALL_CEIL_Y - HALL_SPRING - 0.15} t={0.07} />
              <mesh position={[(xa + xb) / 2, HALL_SPRING + HALL_RISE - 0.05, (za + zb2) / 2]} scale={[(xb - xa) / 2, HALL_CEIL_Y - HALL_SPRING - HALL_RISE + 0.05, (zb2 - za) / 2]} material={HALL_CEIL}>
                <sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
            </group>
          )
        }),
      )}
      <Box p={[0, HALL_CEIL_Y + 0.02, hz]} s={[hall.w - 0.8, 0.04, hd - 1.2]} m={HALL_CEIL} />
      {/* 높은 아치 창: 양옆 벽 가운데 칸 + 터널 쪽 벽 양옆 */}
      {[-1, 1].map((s) => (
        <group key={`hw${s}`} position={[s * (x1 - 0.02), 3.3, hz]} rotation={[0, -s * (Math.PI / 2), 0]}>
          <HallWindow />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={`bw${s}`} position={[s * 4.6, 3.6, zb - 0.03]} rotation={[0, Math.PI, 0]}>
          <HallWindow w={0.8} h={1.5} />
        </group>
      ))}
      {/* 빛줄기: 서쪽 창 → 바닥 (해가 그쪽) + 터널 쪽 벽 창 하나 */}
      <LightShaft from={[x0 + 0.1, 4.2, hz]} to={[x0 + 3.6, 0.05, hz]} />
      {/* 터널 쪽 벽 서쪽 창 → 북쪽(풀밭 쪽)으로: x-y 평면 빛줄기를 y축으로 돌려 z 방향으로 */}
      <group position={[-4.6, 0, zb]} rotation={[0, Math.PI / 2, 0]}>
        <LightShaft from={[0.1, 4.3, 0]} to={[2.9, 0.05, 0]} width={0.65} />
      </group>
      {/* 안쪽 벽 아래 작은 어두운 아치 문 (터널 쪽 벽 양끝, 양옆 벽 풀밭 쪽) */}
      {[-1, 1].map((s) => (
        <group key={`dr${s}`}>
          <group position={[s * 5.3, 0.08, zb - 0.03]} rotation={[0, Math.PI, 0]}>
            <DoorArch />
          </group>
          <group position={[s * (x1 - 0.03), 0.08, zf + 1.2]} rotation={[0, -s * (Math.PI / 2), 0]}>
            <DoorArch />
          </group>
        </group>
      ))}
      {/* 기둥마다 튤립 등 + 등지고 붙은 휘어진 의자 한 쌍 */}
      {COLS_X.map((x) =>
        COLS_Z.map((z) => (
          <group key={`f${x}${z}`}>
            <Sconce x={x} z={z} dir={[Math.sign(x), 0]} />
            <Sconce x={x} z={z} dir={[-Math.sign(x), 0]} y={3.05} />
            <group position={[x, 0, z + 0.36]}>
              <CurvedBench />
            </group>
            <group position={[x, 0, z - 0.36]} rotation={[0, Math.PI, 0]}>
              <CurvedBench />
            </group>
          </group>
        )),
      )}
      {COLS_Z.map((z) => [x0, x1].map((x) => <Sconce key={`ws${x}${z}`} x={x + Math.sign(-x) * 0.1} z={z} dir={[-Math.sign(x), 0]} />))}
      {/* 따뜻한 실내 빛 하나 (그림자 없음) */}
      <pointLight position={[0, 3.2, hz]} color="#ffd9a0" intensity={6} distance={13} decay={1.6} />
    </group>
  )
}

function DoorArch() {
  const geo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.5, 0)
    sh.lineTo(0.5, 0)
    sh.lineTo(0.5, 1.75)
    sh.absarc(0, 1.75, 0.5, 0, Math.PI, false)
    sh.lineTo(-0.5, 0)
    return new THREE.ShapeGeometry(sh)
  }, [])
  return <mesh geometry={geo} material={HALL_DOOR} />
}

// ─────────────────────────────────────────────
// 입구 건물 겉모습 (11/26 지민 요청: 보낸 영화 장면 사진 5장과 최대한 비슷하게) — 그림은 우리 것으로 다시 그림, 글자도 우리 것(湯灯)
//   앞 덩어리: 바랜 주황빛 붉은 회벽 큰 상자(벗겨진 자리·때·이끼) + 밑동 회색 돌띠, 가운데 아치 입구,
//     드문드문 작은 둥근 창(하나는 4색 유리), 입구 위 어두운 나무 현판, 그 위 까치발 받친 시계 상자(색 칸 둘린 둥근 시계 + 둥근 지붕 모자), 맨 위 처마 띠
//   지붕: 회색 기와 맞배지붕(앞면은 둥글게 휜 박공), 용마루 끝 뿔 달린 귀면 기와
//   탑: 붉은 나무 칸(아치 창) → 붉은 난간 발코니 → 아래가 퍼진 검푸른 슬레이트 탑 → 네 면 시계 칸(금·검정 톱니 띠) → 넓게 퍼진 구리빛 초록 뾰족 지붕 + 금 구슬 꼭지
//   양옆: 낮고 긴 붉은 벽(둥근 창 줄) + 기와 맞배지붕, 대합실 겉벽 동쪽 박공엔 둥근 무늬
//   바닥: 입구 앞 갈라진 흰 시멘트 턱 + 붉은 흙 자국 + 풀 포기 + 낙엽 (JmEntranceGround), 굴 바닥은 먼지 낀 밝은 시멘트
// ─────────────────────────────────────────────
const SLATE = mat('#2f363b', { roughness: 0.8, flat: true })
const SLATE_D = mat('#22282c', { roughness: 0.85, flat: true })
const COPPER = mat('#5f8f77', { roughness: 0.6, metalness: 0.2, flat: true })
const COPPER_D = mat('#4a7562', { roughness: 0.7, flat: true })
const GOLD = mat('#c9a54a', { roughness: 0.4, metalness: 0.6 })
const RED_WOOD = mat('#b2482f', { roughness: 0.85 })
const RED_WOOD_D = mat('#8a3424', { roughness: 0.9 })
const RAIL_RED = mat('#c63a2a', { roughness: 0.7 })
const TRIM_PALE = mat('#d9cdb3', { roughness: 0.9 })
const PLINTH = weatheredMat('#9a958a', { flake: 0.25, moss: 0.8 })
const TILE = mat('#3d4246', { roughness: 0.7, flat: true, double: true })
const TILE_HI = mat('#5c6267', { roughness: 0.6, flat: true })
const CLOCK_IN = mat('#4b5862', { roughness: 0.6 })
const CLOCK_SEG = ['#e9dcc0', '#d9a49b', '#9fb8c9', '#e5c36a'].map((c) => mat(c, { roughness: 0.6 }))
const CLOCK_BLUE = mat('#24384f', { roughness: 0.5, emissive: '#0d1a28', emissiveIntensity: 0.4 })
const CEMENT = weatheredMat('#bfb49c', { flake: 0, moss: 0.35, roughness: 1 })
const CEMENT_IN = weatheredMat('#b9ae96', { flake: 0, moss: 0.1, roughness: 1 })
// (11/26 지민 요청: 입구 바닥이 어색함 → 더 자연스럽게) 바닥 자국은 모두 가장자리가 흐려지는 얼룩 텍스처로 (딱딱한 판·선 대신)
const softTexCache = {}
function softTexture(kind) {
  if (softTexCache[kind]) return softTexCache[kind]
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')
  let seed = kind.length * 97 + 13
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // 여러 겹의 흐린 원을 겹쳐 가장자리가 들쭉날쭉하고 부드러운 얼룩
  for (let i = 0; i < (kind === 'path' ? 140 : 46); i++) {
    const px = kind === 'path' ? 128 + (rnd() - 0.5) * 120 : 128 + (rnd() - 0.5) * 150 * rnd()
    const py = kind === 'path' ? rnd() * 256 : 128 + (rnd() - 0.5) * 150 * rnd()
    const r = kind === 'path' ? 30 + rnd() * 50 : 22 + rnd() * 60
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    const a = kind === 'light' ? 0.18 : 0.22
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.beginPath()
    x.arc(px, py, r, 0, Math.PI * 2)
    x.fill()
  }
  // 흙 알갱이
  if (kind !== 'light') {
    const img = x.getImageData(0, 0, 256, 256)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 0.75 + Math.random() * 0.5
      img.data[i + 3] = Math.min(255, img.data[i + 3] * n)
      const v = 200 + Math.random() * 55
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    }
    x.putImageData(img, 0, 0)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (kind === 'path') t.wrapT = THREE.RepeatWrapping
  softTexCache[kind] = t
  return t
}
function softMat(color, kind = 'blob', additive = false) {
  return new THREE.MeshStandardMaterial({
    color, map: softTexture(kind), transparent: true, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, ...(additive && { blending: THREE.AdditiveBlending, emissive: color, emissiveIntensity: 0.4 }),
  })
}
const CRACK = new THREE.MeshBasicMaterial({ color: '#6a6052', transparent: true, opacity: 0.45, depthWrite: false })
const DIRT = ['#7c5c42', '#6f5440', '#8a6a4c'].map((c) => softMat(c))
const DUST = softMat('#c9bca2')
// 풀잎: 가늘고 살짝 휜 잎 (색은 짙은·밝은 초록 섞음)
const GRASS_C = ['#5f8f3f', '#4f7f36', '#6f9f4a', '#43702f'].map((c) => mat(c, { roughness: 1, double: true }))

// 현판 글자 (어두운 나무에 새긴 듯한 글씨) — 캔버스로 한 번만 그림
let plaqueTex = null
function plaqueTexture() {
  if (plaqueTex) return plaqueTex
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const x = c.getContext('2d')
  x.fillStyle = '#3a2e26'
  x.fillRect(0, 0, 512, 320)
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(20,14,10,${0.15 + Math.random() * 0.2})`
    x.beginPath()
    const y = Math.random() * 320
    x.moveTo(0, y)
    x.bezierCurveTo(170, y + 8, 340, y - 8, 512, y + 4)
    x.stroke()
  }
  x.font = "bold 190px 'Zen Maru Gothic', 'Yu Mincho', 'MS Mincho', serif"
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillStyle = '#1c1511'
  x.fillText('湯灯', 262, 168)
  x.fillStyle = '#7d6c5a'
  x.fillText('湯灯', 256, 160)
  plaqueTex = new THREE.CanvasTexture(c)
  plaqueTex.colorSpace = THREE.SRGBColorSpace
  return plaqueTex
}

// 둥근 창: 돌 테 + 어두운 안 (stained면 4색 유리)
function Porthole({ p, r = 0.34, stained = false }) {
  return (
    <group position={p}>
      <mesh material={TRIM_PALE}>
        <ringGeometry args={[r, r * 1.32, 20]} />
      </mesh>
      <mesh position={[0, 0, -0.01]} material={stained ? IRON : DARK}>
        <circleGeometry args={[r, 20]} />
      </mesh>
      {stained &&
        [0, 1, 2, 3].map((q) => (
          <mesh key={q} position={[0, 0, 0.005]} material={STAIN[q]}>
            <circleGeometry args={[r * 0.82, 6, (q * Math.PI) / 2 + 0.05, Math.PI / 2 - 0.1]} />
          </mesh>
        ))}
    </group>
  )
}

// 색 칸 둘린 둥근 시계 (앞 = +z)
function RingClock({ r = 1 }) {
  return (
    <group>
      <mesh material={GOLD}>
        <ringGeometry args={[r * 1.02, r * 1.12, 40]} />
      </mesh>
      {range(12).map((i) => (
        <mesh key={i} position={[0, 0, 0.004]} material={CLOCK_SEG[i % 4]}>
          <ringGeometry args={[r * 0.72, r * 1.02, 4, 1, (i * Math.PI) / 6 + 0.02, Math.PI / 6 - 0.04]} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.002]} material={GOLD}>
        <ringGeometry args={[r * 0.68, r * 0.73, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.001]} material={CLOCK_IN}>
        <circleGeometry args={[r * 0.7, 32]} />
      </mesh>
      {/* 바늘: 금색 + 고리 */}
      <Box p={[-0.22 * r, 0.05 * r, 0.03]} s={[0.5 * r, 0.06 * r, 0.02]} r={[0, 0, 0.25]} m={GOLD} />
      <Box p={[0.26 * r, 0.02 * r, 0.035]} s={[0.56 * r, 0.05 * r, 0.02]} r={[0, 0, -0.08]} m={GOLD} />
      {[-0.42, 0, 0.46].map((dx) => (
        <mesh key={dx} position={[dx * r, dx * r * (dx < 0 ? -0.2 : -0.08), 0.04]} material={GOLD}>
          <ringGeometry args={[0.07 * r, 0.11 * r, 14]} />
        </mesh>
      ))}
    </group>
  )
}

// 네 면 탑 시계 (짙은 파랑 바탕 + 금 테 + 눈금)
function TowerClock({ r = 0.95 }) {
  return (
    <group>
      <mesh material={GOLD}>
        <ringGeometry args={[r, r * 1.1, 36]} />
      </mesh>
      <mesh position={[0, 0, -0.002]} material={CLOCK_BLUE}>
        <circleGeometry args={[r, 32]} />
      </mesh>
      <mesh position={[0, 0, 0.003]} material={SLATE_D}>
        <ringGeometry args={[r * 0.72, r * 0.95, 36]} />
      </mesh>
      {range(12).map((i) => (
        <Box key={i} p={[Math.sin((i * Math.PI) / 6) * r * 0.84, Math.cos((i * Math.PI) / 6) * r * 0.84, 0.01]} s={[0.05, 0.14, 0.01]} r={[0, 0, -(i * Math.PI) / 6]} m={GOLD} />
      ))}
      <Box p={[0.12, 0.25, 0.02]} s={[0.05, 0.55, 0.01]} r={[0, 0, -0.45]} m={TRIM_PALE} />
      <Box p={[-0.15, -0.08, 0.02]} s={[0.05, 0.4, 0.01]} r={[0, 0, -2.0]} m={TRIM_PALE} />
    </group>
  )
}

// 기와 맞배지붕: 용마루 = axis 방향, span = 처마에서 처마까지 폭, len = 용마루 길이, rise = 높이
// 기와 골(가는 띠) + 용마루 + 양 끝 박공 삼각 벽(wall 재질) + 귀면 기와(oni)
function GableRoof({ p, span, len, rise, axis = 'x', wall = RED_PLASTER, oni = true, gable = true, emblemSide = 0 }) {
  const half = span / 2
  const slope = Math.hypot(half, rise)
  const ang = Math.atan2(rise, half)
  const tri = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-half + 0.35, 0)
    s.lineTo(half - 0.35, 0)
    s.lineTo(0, rise - 0.25)
    s.lineTo(-half + 0.35, 0)
    return new THREE.ShapeGeometry(s)
  }, [half, rise])
  const rows = Math.max(3, Math.floor(slope / 0.32))
  return (
    <group position={p} rotation={[0, axis === 'z' ? Math.PI / 2 : 0, 0]}>
      {/* 여기서 로컬 x = 용마루 방향, z = 경사 방향 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, rise / 2, (s * half) / 2]} rotation={[s * ang, 0, 0]}>
          <Box p={[0, 0, 0]} s={[len + 0.6, 0.12, slope + 0.5]} m={TILE} />
          {range(rows).map((i) => (
            <Box key={i} p={[0, 0.09, -slope / 2 + 0.2 + (i * slope) / rows]} s={[len + 0.6, 0.06, 0.07]} m={TILE_HI} />
          ))}
          <Box p={[0, -0.02, s * ((slope + 0.5) / 2)]} s={[len + 0.7, 0.14, 0.12]} m={TILE_HI} />
        </group>
      ))}
      <Box p={[0, rise + 0.12, 0]} s={[len + 0.8, 0.3, 0.36]} m={TILE_HI} />
      {gable &&
        [-1, 1].map((e) => (
          <group key={e} position={[(e * len) / 2, 0, 0]} rotation={[0, (e * Math.PI) / 2, 0]}>
            <mesh geometry={tri} material={wall} position={[0, 0, -0.02]} />
            {/* 흰 박공 테 */}
            {[-1, 1].map((s) => (
              <Box key={s} p={[(s * half) / 2, rise / 2, 0.05]} s={[slope + 0.3, 0.16, 0.08]} r={[0, 0, -s * ang]} m={TRIM_PALE} />
            ))}
            {emblemSide === e && (
              <group position={[0, rise * 0.42, 0.06]}>
                <mesh material={RED_DARK}>
                  <circleGeometry args={[Math.min(0.9, rise * 0.22), 28]} />
                </mesh>
                <mesh position={[0, 0, 0.005]} material={SLATE_D}>
                  <ringGeometry args={[Math.min(0.9, rise * 0.22) * 0.82, Math.min(0.9, rise * 0.22), 28]} />
                </mesh>
                {/* 물결 무늬 (온천 표시 느낌) */}
                {[-0.25, 0, 0.25].map((dx) => (
                  <Box key={dx} p={[dx, 0, 0.01]} s={[0.07, 0.6, 0.01]} r={[0, 0, 0.25]} m={SLATE_D} />
                ))}
              </group>
            )}
          </group>
        ))}
      {oni && [-1, 1].map((e) => <Onigawara key={e} p={[(e * (len + 0.6)) / 2, rise + 0.2, 0]} face={e} />)}
    </group>
  )
}

// 용마루 끝 귀면 기와: 어두운 덩어리 + 앞으로 휜 뿔 셋
function Onigawara({ p, face }) {
  return (
    <group position={p} rotation={[0, face > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <Box p={[0, 0.25, 0]} s={[0.7, 0.75, 0.35]} m={SLATE_D} />
      <mesh position={[0, 0.3, 0.19]} material={SLATE}>
        <sphereGeometry args={[0.22, 8, 6]} />
      </mesh>
      {[-0.22, 0, 0.22].map((dx, i) => (
        <mesh key={i} position={[dx, 0.62, 0.05]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 1]} material={SLATE_D}>
          <torusGeometry args={[0.32, 0.045, 5, 10, Math.PI * 0.6]} />
        </mesh>
      ))}
    </group>
  )
}

// 둥글게 휜 박공(앞면): 처마 양 끝에서 솟아 가운데가 둥근 띠 (TubeGeometry)
function Karahafu({ p, w, h }) {
  const geo = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const x = -w / 2 + t * w
      const u = Math.abs(2 * t - 1)
      // 끝은 살짝 위로 휘고(오목), 가운데는 둥글게(볼록)
      const y = h * (u < 0.55 ? Math.cos((u / 0.55) * (Math.PI / 2)) ** 0.8 : 0) + h * 0.12 * Math.max(0, u - 0.55) * 2.2 - h * 0.05 * (1 - Math.min(1, Math.abs(u - 0.6) * 3))
      pts.push(new THREE.Vector3(x, Math.max(0, y), 0))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.14, 6, false)
  }, [w, h])
  return (
    <group position={p}>
      <mesh geometry={geo} material={TILE_HI} />
      <mesh geometry={geo} material={RAIL_RED} position={[0, -0.22, 0.04]} scale={[0.97, 0.95, 1]} />
    </group>
  )
}

// 입구 앞 바닥: 갈라진 흰 시멘트 턱 + 붉은 흙 자국 + 풀 포기 + 낙엽 (앞 = +z, 로컬 z0 = 벽면)
function JmEntranceGround({ z0, width }) {
  const parts = useMemo(() => {
    let seed = 41
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // 시멘트 턱: 벽에 붙은 직사각형 + 앞 가장자리는 깨진 듯 들쭉날쭉
    const slab = new THREE.Shape()
    const W = width
    const D = 2.6
    slab.moveTo(-W / 2, 0)
    slab.lineTo(W / 2, 0)
    for (let i = 0; i <= 14; i++) {
      const t = i / 14
      const x = W / 2 - t * W
      const y = D - (Math.abs(x) > W / 2 - 0.8 ? 0.6 + rnd() * 0.5 : rnd() * 0.35)
      slab.lineTo(x, y)
    }
    slab.lineTo(-W / 2, 0)
    const slabGeo = new THREE.ShapeGeometry(slab)
    // 금: 꺾인 가는 선
    const cracks = []
    for (let k = 0; k < 3; k++) {
      let x = (rnd() - 0.5) * W * 0.9
      let y = 0.1 + rnd() * 0.4
      for (let s = 0; s < 4; s++) {
        const nx = x + (rnd() - 0.5) * 0.7
        const ny = y + 0.25 + rnd() * 0.35
        if (ny > D - 0.3) break
        cracks.push([(x + nx) / 2, (y + ny) / 2, Math.hypot(nx - x, ny - y), Math.atan2(nx - x, ny - y)])
        x = nx
        y = ny
      }
    }
    // 흙 자국: 들쭉날쭉한 원 (턱 앞 가장자리와 길 쪽)
    const blob = (r) => {
      const s = new THREE.Shape()
      const n = 11
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2
        const rr = r * (0.7 + rnd() * 0.5)
        if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
        else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      return new THREE.ShapeGeometry(s)
    }
    const dirt = []
    for (let i = 0; i < 14; i++) {
      const x = (rnd() - 0.5) * (W + 3)
      const y = D - 0.3 + rnd() * 3.2
      dirt.push({ geo: blob(0.35 + rnd() * 0.7), x, y, sx: 1 + rnd() * 0.8, c: Math.floor(rnd() * DIRT.length), r: rnd() * Math.PI })
    }
    // 풀 포기: 벽 밑동(턱 양옆) + 흙 가장자리 + 턱 금 사이 작은 잡초
    const tufts = []
    const tuft = (x, y, h) => tufts.push([x, y, h, rnd() * Math.PI, Math.floor(rnd() * GRASS_C.length), 4 + Math.floor(rnd() * 4)])
    for (let i = 0; i < 26; i++) tuft((rnd() < 0.5 ? -1 : 1) * (W / 2 + 0.2 + rnd() * 3), 0.15 + rnd() * 0.7, 0.25 + rnd() * 0.35)
    for (let i = 0; i < 34; i++) tuft((rnd() - 0.5) * (W + 4), D + 0.1 + rnd() * 3, 0.2 + rnd() * 0.35)
    for (let i = 0; i < 8; i++) tuft((rnd() - 0.5) * W * 0.9, 0.4 + rnd() * (D - 0.8), 0.1 + rnd() * 0.12)
    const leaves = Array.from({ length: 40 }, () => [(rnd() - 0.5) * (W + 1), rnd() * (D + 1.5), rnd() * Math.PI, Math.floor(rnd() * LEAF_C.length), 0.05 + rnd() * 0.04])
    return { slabGeo, cracks, dirt, tufts, leaves }
  }, [width])
  return (
    <group position={[0, 0, z0]}>
      <mesh geometry={parts.slabGeo} material={CEMENT} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[1, 1, -1]} />
      <mesh geometry={parts.slabGeo} material={CEMENT} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[1.01, 1.01, -1]} />
      {parts.cracks.map(([x, y, len, a], i) => (
        <mesh key={`c${i}`} position={[x, 0.066, y]} rotation={[-Math.PI / 2, 0, a]} material={CRACK}>
          <planeGeometry args={[0.012, len]} />
        </mesh>
      ))}
      {/* 턱 가장자리·이음매에 쌓인 흙먼지 (턱과 흙길이 자연스럽게 이어지게) */}
      {[[-1.6, 2.3, 2.6, 1.2], [1.4, 2.4, 2.4, 1.0], [0, 2.7, 3.4, 1.3], [-2.4, 0.5, 1.4, 1.6], [2.5, 0.8, 1.3, 1.8]].map(([x, y, a, b], i) => (
        <mesh key={`du${i}`} position={[x, 0.068, y]} rotation={[-Math.PI / 2, 0, i]} scale={[a, b, 1]} material={DUST}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      {parts.dirt.map(({ x, y, sx, c, r }, i) => (
        <mesh key={`d${i}`} material={DIRT[c]} position={[x, 0.025 + i * 0.0005, y]} rotation={[-Math.PI / 2, 0, r]} scale={[1.6 * sx, 1.6, 1]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      {parts.tufts.map(([x, y, h, r, c, n], i) => (
        <group key={`t${i}`} position={[x, 0.03, y]} rotation={[0, r, 0]}>
          {range(n * 2).map((k) => {
            const hh = h * (0.55 + ((k * 37) % 10) / 20)
            const tilt = 0.25 + ((k * 13) % 7) / 18
            return (
              <mesh key={k} position={[Math.cos(k * 2.4) * 0.03, hh / 2 - 0.02, Math.sin(k * 2.4) * 0.03]} rotation={[tilt * Math.cos(k * 2.4), (k * Math.PI * 2) / (n * 2), tilt * Math.sin(k * 2.4)]} scale={[0.016, hh, 0.006]} material={GRASS_C[(c + k) % GRASS_C.length]}>
                <coneGeometry args={[1, 1, 3]} />
              </mesh>
            )
          })}
        </group>
      ))}
      {parts.leaves.map(([x, y, r, c, s], i) => (
        <mesh key={`l${i}`} position={[x, 0.07, y]} rotation={[-Math.PI / 2, 0, r]} scale={[s, s * 0.6, 1]} material={LEAF_C[c]}>
          <circleGeometry args={[1, 5]} />
        </mesh>
      ))}
    </group>
  )
}

export function JmTunnelGate({ item }) {
  const { pass, passH, gate, tube, hall, wing } = TUNNEL
  const geo = useMemo(() => {
    const front = archRing(gate.w, gate.h, pass, passH, 0.6)
    const back = archRing(gate.w, passH + 1.2, pass, passH)
    const hallBack = archRing(hall.w, hall.h, pass, passH)
    const hallFront = archRing(hall.w, hall.h, pass, passH)
    const vault = vaultGeometry(pass, passH, tube.z1 - tube.z0 + 0.2)
    const bayRoof = hipRoofGeometry(4.2, 2.0, 2.2, 0.1)
    const corRoof = hipRoofGeometry(pass + 2.8, tube.z1 - tube.z0 + 0.4, 1.3, 0.12)
    const spire = hipRoofGeometry(T.roofW, T.roofW, T.roofH, 0.05)
    // 아래가 퍼진 네모 슬레이트 탑: 4각 회전체 (반지름 = 반대각선)
    const pts = []
    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      const half = T.slateTop / 2 + (T.slateBot / 2 - T.slateTop / 2) * (1 - t) ** 2.2
      pts.push(new THREE.Vector2(half * Math.SQRT2, t * T.slateH))
    }
    const slate = new THREE.LatheGeometry(pts, 4, Math.PI / 4)
    slate.computeVertexNormals()
    const skirt = new THREE.CylinderGeometry(((T.roofW - 0.6) / 2) * Math.SQRT2, ((T.roofW + 1.4) / 2) * Math.SQRT2, 0.45, 4, 1, true, Math.PI / 4)
    return { front, back, hallBack, hallFront, vault, bayRoof, corRoof, spire, slate, skirt }
  }, [gate.w, gate.h, hall.w, hall.h, pass, passH, tube.z0, tube.z1])
  const gz = (gate.z0 + gate.z1) / 2
  const gd = gate.z1 - gate.z0
  const hz = (hall.z0 + hall.z1) / 2
  const hd = hall.z1 - hall.z0
  const side = (gate.w - pass) / 2
  const fz = gate.z1 // 앞면
  const wz0 = fz - 0.6 - wing.d // 양옆 벽 뒤
  const wzc = fz - 0.6 - wing.d / 2
  // 탑이 서는 높이 (앞 덩어리 지붕 용마루 근처)
  const ty = gate.h + 1.2
  return (
    <group scale={item?.scale ?? 1}>
      {/* ── 앞 덩어리 ── */}
      <mesh geometry={geo.front} material={RED_PLASTER} position={[0, 0, fz - 0.6]} />
      <mesh geometry={geo.back} material={RED_PLASTER} position={[0, 0, gate.z0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (pass / 2 + side / 2), gate.h / 2, gz - 0.3]} s={[side, gate.h, gd - 0.6]} m={RED_PLASTER} />
          {/* 밑동 회색 돌띠 (앞·옆) */}
          <Box p={[s * (pass / 2 + side / 2), 0.36, fz + 0.04]} s={[side, 0.72, 0.1]} m={PLINTH} />
          <Box p={[s * (gate.w / 2 + 0.04), 0.36, gz]} s={[0.1, 0.72, gd]} m={PLINTH} />
        </group>
      ))}
      {/* 뒤쪽(굴 쪽) 아치 위 벽 */}
      <Box p={[0, (passH + 1.2 + gate.h) / 2, gate.z0 + 0.3]} s={[gate.w, gate.h - passH - 1.2, 0.6]} m={RED_PLASTER} />
      {/* 아치 둘레 얇은 테 */}
      <Box p={[0, passH + 0.1, fz + 0.03]} s={[pass + 0.3, 0.16, 0.06]} m={GRIME} />
      {/* 둥근 창 (사진처럼 드문드문, 하나는 4색 유리) */}
      <Porthole p={[-3.05, 2.2, fz + 0.02]} />
      <Porthole p={[2.85, 3.4, fz + 0.02]} stained />
      <Porthole p={[-1.9, 5.1, fz + 0.02]} r={0.28} />
      {[-1, 1].map((s) => (
        <group key={`sp${s}`} position={[s * (gate.w / 2 + 0.02), 0, gz]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <Porthole p={[0, 3.9, 0]} r={0.3} />
        </group>
      ))}
      {/* 어두운 나무 현판 (우리 글자 「湯灯」) */}
      <group position={[0, 6.0, fz + 0.08]}>
        <Box p={[0, 0, 0]} s={[2.9, 1.75, 0.14]} m={PLAQUE_FRAME} />
        <mesh position={[0, 0, 0.075]}>
          <planeGeometry args={[2.6, 1.5]} />
          <meshStandardMaterial map={plaqueTexture()} roughness={0.85} />
        </mesh>
      </group>
      {/* 시계 상자: 까치발 → 상자 → 색 칸 둥근 시계 → 둥근 지붕 모자 */}
      <group position={[0, 0, fz]}>
        {range(5).map((i) => (
          <Box key={`k${i}`} p={[-1.1 + i * 0.55, 7.05 - (i % 2) * 0.05, 0.42]} s={[0.32, 0.55 + (i % 2) * 0.1, 0.84]} m={RED_PLASTER} />
        ))}
        <Box p={[0, 7.38, 0.5]} s={[2.9, 0.16, 1.0]} m={TRIM_PALE} />
        <Box p={[0, 8.35, 0.45]} s={[2.7, 1.9, 0.9]} m={RED_PLASTER} />
        <group position={[0, 8.35, 0.91]}>
          <RingClock r={0.85} />
        </group>
        <Box p={[0, 9.35, 0.55]} s={[3.1, 0.14, 1.1]} m={TRIM_PALE} />
        <Karahafu p={[0, 9.42, 1.0]} w={3.2} h={0.75} />
        <Box p={[0, 9.62, 0.5]} s={[3.0, 0.3, 1.0]} m={TILE} />
        {/* 모자 안 작은 반달 창 */}
        <mesh position={[0, 9.5, 1.02]} material={DARK}>
          <circleGeometry args={[0.22, 12, 0, Math.PI]} />
        </mesh>
      </group>
      {/* 처마 띠 + 기와 맞배지붕(앞은 둥근 박공) */}
      <Box p={[0, gate.h + 0.12, gz]} s={[gate.w + 0.5, 0.24, gd + 0.5]} m={TRIM_PALE} />
      <Box p={[0, gate.h + 0.34, gz]} s={[gate.w + 0.8, 0.2, gd + 0.8]} m={RED_WOOD_D} />
      <GableRoof p={[0, gate.h + 0.44, gz]} span={gate.w + 1.4} len={gd + 1.2} rise={2.4} axis="z" />
      <Karahafu p={[0, gate.h + 0.55, fz + 0.7]} w={gate.w * 0.62} h={1.25} />
      {/* ── 탑 ── 붉은 나무 칸 → 발코니 → 슬레이트 탑 → 시계 칸 → 구리 지붕 */}
      <group position={[0, ty, gz]}>
        <Box p={[0, T.woodH / 2, 0]} s={[T.woodW, T.woodH, T.woodW]} m={RED_WOOD} />
        {range(6).map((i) => (
          <Box key={`pl${i}`} p={[0, 0.3 + i * 0.36, T.woodW / 2 + 0.01]} s={[T.woodW, 0.03, 0.02]} m={RED_WOOD_D} />
        ))}
        {/* 아치 창 + 살 */}
        <group position={[0, 0.5, T.woodW / 2 + 0.02]}>
          <Box p={[0, 0.55, 0]} s={[0.7, 1.1, 0.02]} m={DARK} />
          <mesh position={[0, 1.1, 0]} material={DARK}>
            <circleGeometry args={[0.35, 12, 0, Math.PI]} />
          </mesh>
          {[-0.18, 0, 0.18].map((dx) => (
            <Box key={dx} p={[dx, 0.75, 0.01]} s={[0.03, 1.4, 0.02]} m={RED_WOOD_D} />
          ))}
          <Box p={[0, 0.6, 0.01]} s={[0.7, 0.03, 0.02]} m={RED_WOOD_D} />
        </group>
        <Box p={[1.15, 1.5, T.woodW / 2 + 0.02]} s={[0.22, 0.32, 0.02]} m={DARK} />
        {/* 발코니 바닥 + 까치발 + 붉은 난간 */}
        <Box p={[0, T.woodH + 0.1, 0]} s={[T.balW, 0.2, T.balW]} m={RED_WOOD_D} />
        {[-1, 1].map((s) =>
          [-0.9, 0.9].map((o) => (
            <group key={`br${s}${o}`}>
              <Box p={[o, T.woodH - 0.25, s * (T.woodW / 2 + 0.35)]} s={[0.14, 0.5, 0.7]} m={RED_WOOD_D} />
              <Box p={[s * (T.woodW / 2 + 0.35), T.woodH - 0.25, o]} s={[0.7, 0.5, 0.14]} m={RED_WOOD_D} />
            </group>
          )),
        )}
        {[0, 1, 2, 3].map((k) => (
          <group key={`rail${k}`} rotation={[0, (k * Math.PI) / 2, 0]}>
            <Box p={[0, T.woodH + 1.05, T.balW / 2 - 0.05]} s={[T.balW, 0.08, 0.08]} m={RAIL_RED} />
            <Box p={[0, T.woodH + 0.6, T.balW / 2 - 0.05]} s={[T.balW, 0.05, 0.05]} m={RAIL_RED} />
            {range(7).map((i) => (
              <Box key={i} p={[-T.balW / 2 + 0.1 + (i * (T.balW - 0.2)) / 6, T.woodH + 0.62, T.balW / 2 - 0.05]} s={[0.07, 0.86, 0.07]} m={RAIL_RED} />
            ))}
            {/* 난간 끝 금색 끝마개 */}
            <Box p={[T.balW / 2 - 0.05, T.woodH + 1.12, T.balW / 2 - 0.05]} s={[0.12, 0.08, 0.12]} m={GOLD} />
          </group>
        ))}
        {/* 아래가 퍼진 슬레이트 탑 + 작은 창 */}
        <mesh geometry={geo.slate} material={SLATE} position={[0, T.woodH + 0.2, 0]} />
        <Box p={[0, T.woodH + 0.2 + T.slateH * 0.62, T.slateTop / 2 + 0.12]} s={[0.22, 0.42, 0.04]} m={TRIM_PALE} />
        <Box p={[0, T.woodH + 0.2 + T.slateH * 0.62, T.slateTop / 2 + 0.14]} s={[0.14, 0.32, 0.03]} m={CLOCK_BLUE} />
        {/* 시계 칸 */}
        <group position={[0, T.woodH + 0.2 + T.slateH, 0]}>
          <Box p={[0, 0.15, 0]} s={[T.clockW + 0.2, 0.3, T.clockW + 0.2]} m={TRIM_PALE} />
          {/* 금·검정 톱니 띠 */}
          {[0, 1, 2, 3].map((k) => (
            <group key={`fr${k}`} rotation={[0, (k * Math.PI) / 2, 0]}>
              {range(9).map((i) => (
                <Box key={i} p={[-T.clockW / 2 + 0.17 + (i * (T.clockW - 0.34)) / 8, 0.45, T.clockW / 2 + 0.06]} s={[0.17, 0.3, 0.06]} m={i % 2 ? SLATE_D : GOLD} />
              ))}
            </group>
          ))}
          <Box p={[0, 0.6 + T.clockH / 2, 0]} s={[T.clockW, T.clockH, T.clockW]} m={SLATE_D} />
          {[0, 1, 2, 3].map((k) => (
            <group key={`tc${k}`} rotation={[0, (k * Math.PI) / 2, 0]}>
              <group position={[0, 0.6 + T.clockH / 2, T.clockW / 2 + 0.02]}>
                <TowerClock r={T.clockW * 0.36} />
              </group>
              {/* 모서리 금 기둥 */}
              <Box p={[T.clockW / 2, 0.6 + T.clockH / 2, T.clockW / 2]} s={[0.1, T.clockH, 0.1]} m={GOLD} />
            </group>
          ))}
          {/* 넓게 퍼진 처마 + 구리 뾰족 지붕 + 금 구슬 꼭지 */}
          <Box p={[0, 0.6 + T.clockH + 0.05, 0]} s={[T.clockW + 0.5, 0.1, T.clockW + 0.5]} m={GOLD} />
          <mesh geometry={geo.skirt} material={COPPER_D} position={[0, 0.6 + T.clockH + 0.25, 0]} />
          <mesh geometry={geo.spire} material={COPPER} position={[0, 0.6 + T.clockH + 0.45, 0]} />
          <group position={[0, 0.6 + T.clockH + 0.45 + T.roofH, 0]}>
            <Cyl p={[0, 0.12, 0]} rad={0.08} h={0.25} m={GOLD} />
            <mesh position={[0, 0.42, 0]} material={GOLD}>
              <sphereGeometry args={[0.24, 12, 10]} />
            </mesh>
            <Cyl p={[0, 0.95, 0]} rad={0.025} h={0.7} m={GOLD} />
          </group>
        </group>
      </group>
      {/* ── 양옆 낮고 긴 붉은 벽 (둥근 창 줄) + 기와 지붕 ── */}
      {[-1, 1].map((s) => {
        const wx = s * (gate.w / 2 + wing.w / 2)
        return (
          <group key={`wing${s}`}>
            <Box p={[wx, wing.h / 2, wzc]} s={[wing.w, wing.h, wing.d]} m={RED_PLASTER} />
            <Box p={[wx, 0.36, fz - 0.6 + 0.04]} s={[wing.w, 0.72, 0.1]} m={PLINTH} />
            {[0.22, 0.5, 0.78].map((t, i) => (
              <Porthole key={t} p={[s * (gate.w / 2 + wing.w * t), 4.2, fz - 0.6 + 0.02]} r={0.32} stained={i === 1 && s > 0} />
            ))}
            <Box p={[wx, wing.h + 0.1, wzc]} s={[wing.w + 0.4, 0.2, wing.d + 0.4]} m={RED_WOOD_D} />
            <GableRoof p={[wx, wing.h + 0.2, wzc]} span={wing.d + 1.2} len={wing.w + 0.2} rise={1.7} axis="x" oni={s > 0} />
          </group>
        )
      })}
      {/* ── 굴 (반원 천장, 먼지 낀 밝은 시멘트 바닥, 희미한 등) ── */}
      <mesh geometry={geo.vault} material={TUBE_WALL} position={[0, 0, (tube.z0 + tube.z1) / 2]} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (pass / 2 + 0.05), (passH - pass / 2) / 2, (tube.z0 + tube.z1) / 2]} s={[0.1, passH - pass / 2, tube.z1 - tube.z0 + 0.2]} m={TUBE_WALL} />
      ))}
      <Box p={[0, 0.03, (tube.z0 + gate.z1) / 2]} s={[pass, 0.06, gate.z1 - tube.z0]} m={CEMENT_IN} />
      {/* 입구로 들어온 빛이 바닥에 번진 자국 */}
      <mesh position={[0, 0.07, fz - 1.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.4, 1]} material={BEAM}>
        <circleGeometry args={[1.5, 20]} />
      </mesh>
      {[tube.z0 + 0.8, tube.z1 - 0.8].map((z) => (
        <Box key={z} p={[pass / 2 - 0.12, 2.6, z]} s={[0.1, 0.3, 0.3]} m={LAMP} />
      ))}
      {[-1, 1].map((s) => (
        <group key={`cor${s}`}>
          <Box p={[s * (pass / 2 + 0.45), (passH + 0.5) / 2, (tube.z0 + tube.z1) / 2]} s={[0.7, passH + 0.5, tube.z1 - tube.z0]} m={RED_PLASTER} />
        </group>
      ))}
      <Box p={[0, passH + 0.6, (tube.z0 + tube.z1) / 2]} s={[pass + 2.2, 0.2, tube.z1 - tube.z0]} m={WOOD_D} />
      <mesh geometry={geo.corRoof} material={ROOF} position={[0, passH + 0.7, (tube.z0 + tube.z1) / 2]} />
      {/* ── 대합실: 겉벽은 붉은 회벽, 안쪽은 JmWaitingHall, 지붕은 기와 맞배(동쪽 박공에 둥근 무늬) ── */}
      <mesh geometry={geo.hallBack} material={HALL_WALL} position={[0, 0, hall.z1 - 0.6]} />
      <mesh geometry={geo.hallFront} material={HALL_WALL} position={[0, 0, hall.z0]} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (hall.w / 2 - 0.2), hall.h / 2, hz]} s={[0.4, hall.h, hd]} m={HALL_WALL} />
      ))}
      <JmWaitingHall hall={hall} pass={pass} passH={passH} />
      <Box p={[0, hall.h + 0.02, hz]} s={[hall.w, 0.08, hd]} m={HALL_WALL} />
      <Box p={[0, hall.h + 0.14, hz]} s={[hall.w + 0.5, 0.2, hd + 0.5]} m={RED_WOOD_D} />
      <GableRoof p={[0, hall.h + 0.24, hz]} span={hd + 1.4} len={hall.w + 0.4} rise={2.6} axis="x" wall={HALL_WALL} emblemSide={1} />
      {/* 풀밭 쪽 면: 아치 위로 튀어나온 시계 탑 칸 + 큰 둥근 시계 + 회색 뾰족 지붕 + 금 꼭지 (11/25 사진 참고) */}
      <group position={[0, 0, hall.z0 - 0.55]}>
        <Box p={[0, (passH + 0.4 + hall.h + 3.2) / 2, 0]} s={[3.6, hall.h + 3.2 - passH - 0.4, 1.1]} m={HALL_WALL} />
        <Box p={[0, passH + 0.35, 0.1]} s={[4.0, 0.3, 1.3]} m={GRIME} />
        <group position={[0, hall.h + 1.1, -0.56]} rotation={[0, Math.PI, 0]}>
          <RingClock r={1.1} />
        </group>
        <mesh geometry={geo.bayRoof} material={ROOF} position={[0, hall.h + 3.2, 0]} />
        <Cyl p={[0, hall.h + 5.8, 0]} rad={0.08} h={0.9} m={STONE_DARK} />
        <Cyl p={[0, hall.h + 6.35, 0]} rad={0.2} h={0.25} c="#c9a54a" />
      </group>
      {/* ── 바닥: 입구 앞 시멘트 턱·흙·풀 ── */}
      <JmEntranceGround z0={fz} width={pass + 2.6} />
    </group>
  )
}

// ── 돌 석상 (길가 수호 석상, 화강암) ──
// (11/26 지민 요청: 보낸 화강암 석상 사진과 최대한 같게) 높이 1.25m 통짜 돌 하나
//   모양: 둥근 머리에 두건처럼 테가 둘린 얼굴 → 목 들어감 → 어깨 → 앞으로 모은 팔이 가로 띠처럼 불룩 → 아래는 넓은 통 몸, 바닥 평평
//   얼굴: 테 안쪽이 오목하게 들어가고 그 안에 감은 눈(눈두덩·볼 사이 가는 골), 넓은 코, 큰 볼, 양 끝이 올라간 두꺼운 입술의 활짝 웃는 입
//   표면: 밝은 회색 화강암 알갱이(캔버스 무늬) + 패인 곳 그늘(꼭짓점 색), 밑동은 흙때
//   만드는 법: 높이 t(0~1) × 둘레 각 θ 격자를 직접 짜서 반지름 = 옆모습 곡선 + 얼굴·팔 굴곡
const SH = 1.25 // 높이 (m)
// 옆모습: [높이 비율, 반지름 비율(× SH)] — 목 없는 종 모양(폭 ÷ 높이 ≈ 0.8)
const PROFILE = [
  [0, 0.385], [0.04, 0.4], [0.12, 0.405], [0.25, 0.398], [0.38, 0.38], [0.5, 0.355], [0.6, 0.33], [0.7, 0.3],
  [0.78, 0.268], [0.85, 0.228], [0.91, 0.178], [0.955, 0.12], [0.985, 0.06], [1, 0],
]
function profileAt(t) {
  let i = 0
  while (i < PROFILE.length - 2 && t > PROFILE[i + 1][0]) i++
  const p0 = PROFILE[Math.max(0, i - 1)][1]
  const [ta, p1] = PROFILE[i]
  const [tb, p2] = PROFILE[i + 1]
  const p3 = PROFILE[Math.min(PROFILE.length - 1, i + 2)][1]
  const s = Math.min(1, Math.max(0, (t - ta) / (tb - ta)))
  // Catmull-Rom (부드럽게 잇기)
  const v = 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s)
  return Math.max(0, v) * SH
}
const g1 = (x, c, w) => Math.exp(-(((x - c) / w) ** 2))
const g2 = (u, v, cu, cv, su, sv) => Math.exp(-(((u - cu) / su) ** 2) - (((v - cv) / sv) ** 2))
const sstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

// θ: 0 = 앞(+z, 길 쪽), t: 0 바닥 ~ 1 정수리 → { d: 반지름 더할 값(m), g: 패인 정도 0~1 }
// (11/26 2차, 지민이 보낸 석상 모형 사진) 목 없이 머리·몸이 한 덩어리인 종 모양, 두건 테 안 넓적한 얼굴, 턱 밑에 모은 손
function statueRelief(th, t) {
  let d = 0.003 * Math.sin(th * 7 + t * 23) * Math.sin(th * 3 - t * 17) // 돌 표면 아주 살짝 울퉁불퉁
  let g = 0
  const at = Math.abs(th)
  // ── 얼굴: 두건 테 안쪽 (위 반쪽 앞면 거의 전체) ──
  const u = th / 1.05
  const v = (t - 0.59) / 0.245
  const e = Math.sqrt(u * u + v * v)
  if (e < 1.5) {
    const rec = sstep(1.0, 0.8, e)
    const rimW = sstep(-0.95, -0.35, v) // 테는 이마·옆, 턱 쪽은 옷깃 주름이 받음
    d -= 0.04 * rec
    d += 0.026 * g1(e, 1.04, 0.13) * rimW // 두꺼운 두건 테
    const edge = g1(e, 0.86, 0.05) * rimW // 테 안쪽 경계 그늘
    g = Math.max(g, edge * 0.45)
    if (rec > 0) {
      let f = 0
      for (const eu of [-0.4, 0.4]) {
        f += 0.014 * g2(u, v, eu, 0.42, 0.26, 0.13) // 눈두덩
        const du = (u - eu) / 0.24
        if (Math.abs(du) < 1) {
          const dist = Math.abs(v - (0.3 + 0.08 * (1 - du * du))) // 감은 눈 (가운데가 올라간 활 모양)
          if (dist < 0.055) {
            const k = (1 - dist / 0.055) * Math.sqrt(1 - du * du)
            f -= 0.014 * k
            g = Math.max(g, k)
          }
        }
        f += 0.03 * g2(u, v, eu * 1.5, -0.12, 0.26, 0.26) // 볼
        f -= 0.008 * g2(u, v, eu * 0.32, -0.1, 0.06, 0.045) // 콧구멍
        g = Math.max(g, 0.5 * g2(u, v, eu * 0.32, -0.1, 0.05, 0.04))
      }
      // 코: 미간에서 내려와 아래가 넓적
      const nw = 0.07 + 0.11 * sstep(0.35, -0.1, v)
      f += 0.036 * Math.exp(-((u / nw) ** 2)) * sstep(0.42, 0.22, v) * sstep(-0.2, -0.05, v)
      f += 0.02 * g2(u, v, 0, -0.06, 0.2, 0.08) // 콧방울
      // 입: 볼까지 닿는 반달 웃음 + 두꺼운 입술
      const mu = u / 0.72
      if (Math.abs(mu) < 1) {
        const w = 1 - mu * mu
        const mc = -0.4 + 0.3 * mu * mu
        const h = 0.17 * Math.pow(w, 0.75)
        if (v < mc && v > mc - h) {
          const k = Math.min(v - (mc - h), mc - v) / (h / 2)
          f -= 0.03 * Math.min(1, k * 1.4)
          g = Math.max(g, Math.min(1, 0.65 + k))
        }
        f += 0.016 * g1(v, mc + 0.07, 0.06) * w
        f += 0.018 * g1(v, mc - h - 0.06, 0.07) * w
      }
      f += 0.012 * g2(u, v, 0, -0.88, 0.45, 0.1) // 턱
      d += f * rec
    }
  }
  // ── 옷깃 주름: 얼굴 아래에서 가운데(손)로 내려가는 U자 선, 그 위 천은 살짝 겹쳐 도톰 ──
  const cu = th / 1.25
  if (Math.abs(cu) < 1.3) {
    const line = 0.29 + 0.17 * Math.min(1, cu * cu)
    const k = g1(t, line, 0.012) * sstep(1.3, 0.9, Math.abs(cu))
    d -= 0.012 * k
    g = Math.max(g, k * 0.6)
    d += 0.012 * sstep(line - 0.005, line + 0.03, t) * sstep(line + 0.2, line + 0.05, t) * sstep(1.3, 0.8, Math.abs(cu))
  }
  // ── 턱 밑에 모은 두 손 (작은 덩어리 + 가운데 골 + 손가락 줄) ──
  const hand = g2(th, t, 0, 0.245, 0.21, 0.06)
  d += 0.045 * hand
  const split = g1(th, 0, 0.018) * g2(th, t, 0, 0.245, 0.3, 0.06)
  d -= 0.01 * split
  g = Math.max(g, split * 0.6)
  for (const ft of [0.215, 0.25, 0.285]) {
    const fk = g1(t, ft, 0.005) * g1(th, 0, 0.17) * (1 - g1(th, 0, 0.03))
    d -= 0.003 * fk
    g = Math.max(g, fk * 0.3)
  }
  // 밑단: 바닥 위로 살짝 둘린 띠
  d += 0.008 * g1(t, 0.035, 0.02)
  g = Math.max(g, g1(t, 0.065, 0.01) * 0.3)
  return { d, g }
}

function granitePattern() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')
  x.fillStyle = '#cfcec8'
  x.fillRect(0, 0, 256, 256)
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const cols = ['#8d8c87', '#d9d8d2', '#74736e', '#a9a8a2', '#e4e3dd', '#5f5e5a']
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = cols[Math.floor(rnd() * cols.length)]
    const r = rnd() < 0.85 ? 1 : 2
    x.fillRect(Math.floor(rnd() * 256), Math.floor(rnd() * 256), r, r)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function statueGeometry() {
  const NT = 320 // 둘레
  const NH = 260 // 높이
  const pos = []
  const uv = []
  const col = []
  for (let j = 0; j <= NH; j++) {
    const t = j / NH
    const base = profileAt(t)
    for (let i = 0; i <= NT; i++) {
      const th = -Math.PI + (i / NT) * Math.PI * 2
      const { d, g } = statueRelief(th, t)
      const r = Math.max(0, base + d * Math.min(1, base / 0.05))
      const dz = 0.86 + 0.04 * Math.cos(th) // 앞뒤로 살짝 납작
      pos.push(Math.sin(th) * r, t * SH, Math.cos(th) * r * dz)
      uv.push((i / NT) * 5, t * 3.2)
      // 그늘: 패인 곳 어둡게, 밑동 흙때, 정수리는 살짝 밝게
      let k = 1 - 0.55 * g
      k *= 0.78 + 0.22 * sstep(0, 0.08, t)
      k *= 1 + 0.06 * sstep(0.8, 1, t)
      const dirt = 1 - sstep(0, 0.06, t)
      col.push(k * (1 - 0.03 * dirt), k * (1 - 0.06 * dirt), k * (1 - 0.1 * dirt))
    }
  }
  const idx = []
  const row = NT + 1
  for (let j = 0; j < NH; j++)
    for (let i = 0; i < NT; i++) {
      const a = j * row + i
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  // 바닥 마개
  const c0 = pos.length / 3
  pos.push(0, 0, 0)
  uv.push(0, 0)
  col.push(0.6, 0.58, 0.55)
  for (let i = 0; i < NT; i++) idx.push(c0, i + 1, i)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

let statueMat = null
export function JmTwoFaceStatue() {
  const geo = useMemo(statueGeometry, [])
  if (!statueMat) statueMat = new THREE.MeshStandardMaterial({ map: granitePattern(), vertexColors: true, roughness: 0.95 })
  return (
    <group>
      {/* noMerge: 구역 메시 합치기(jm_perf)는 꼭짓점 색을 버려서, 합치면 그늘이 사라짐 */}
      <mesh geometry={geo} material={statueMat} castShadow receiveShadow userData={{ noMerge: true }} />
      {/* 발치 흙 (사진처럼 둘레가 살짝 드러난 흙) */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]}>
        <circleGeometry args={[0.62, 24]} />
        <meshStandardMaterial color="#4a3f33" roughness={1} />
      </mesh>
    </group>
  )
}

// ── 길가 작은 돌 사당 ──
export function JmStoneHokora() {
  const roof = useMemo(() => hipRoofGeometry(0.9, 0.8, 0.35, 0.05), [])
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[0.8, 0.4, 0.7]} m={STONE_DARK} />
      <Box p={[0, 0.65, 0]} s={[0.55, 0.5, 0.5]} m={STONE} />
      <Box p={[0, 0.65, 0.26]} s={[0.25, 0.3, 0.02]} m={DARK} />
      <mesh geometry={roof} material={STONE_DARK} position={[0, 0.9, 0]} />
      <mesh position={[0.25, 0.95, 0.1]} scale={[0.16, 0.06, 0.2]} material={MOSS}>
        <sphereGeometry args={[1, 8, 6]} />
      </mesh>
    </group>
  )
}

// ── 입구 숲길 (11/26 지민 요청: 구역에 들어서면 작은 숲길, 그 안에 숨은 터널 입구) ──
// item.size [폭, _, 길이], item.trunks [[x, z, 높이, 반지름]] (소품 가운데 기준, 생성 스크립트가 만들어 줌 + 같은 자리 jmCollider)
// item.avoid [[x, z, r]] 덤불을 두지 않을 자리(워프 도착·석등·석상·사당)
// 그림: 그늘진 숲 바닥 + 흙길·박힌 돌 + 줄기(뿌리 쪽 굵게, 살짝 기움) + 잎 덩어리 지붕(길 위에서 맞닿음) + 덤불·고사리 + 잎 사이로 떨어진 햇빛 얼룩
const FOREST_FLOOR = mat('#41592f', { roughness: 1 })
const FOREST_PATH = softMat('#7a6244', 'path')
const FOREST_FLOOR_SOFT = softMat('#3a5229')
const PATH_STONES = ['#8a8476', '#7a7466', '#958c7c'].map((c) => mat(c, { roughness: 1, flat: true }))
// 반쯤 묻힌 모난 돌: 들쭉날쭉한 다각형을 얇게 세움
const stoneGeoCache = []
function stoneGeo(k) {
  if (stoneGeoCache[k]) return stoneGeoCache[k]
  const sh = new THREE.Shape()
  let seed = k * 31 + 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const n = 7 + (k % 3)
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 0.75 + rnd() * 0.35
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.08, bevelSegments: 2 })
  g.rotateX(-Math.PI / 2)
  return (stoneGeoCache[k] = g)
}
const BARK = mat('#4a3a2c', { roughness: 1, flat: true })
const BARK_D = mat('#3a2d22', { roughness: 1, flat: true })
const LEAVES = ['#3f6b2e', '#4f7d34', '#5d8a3a', '#355f29'].map((c) => mat(c, { roughness: 0.95, flat: true }))
const FERN = mat('#4f7f33', { roughness: 1, flat: true, double: true })
const SUN_SPOT = new THREE.MeshBasicMaterial({ color: '#fff0b0', map: softTexture('light'), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })
const LEAF_BLOB = new THREE.IcosahedronGeometry(1, 1)

export function JmForestPath({ item }) {
  const [W, , D] = item.size ?? [40, 9, 18]
  const trunks = item.trunks ?? []
  const avoid = item.avoid ?? []
  const parts = useMemo(() => {
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const blobs = [] // [x, y, z, sx, sy, sz, 색]
    const crowns = trunks.map(([x, z, h, r]) => {
      const lean = [(x > 0 ? -1 : 1) * (0.25 + rnd() * 0.35), (rnd() - 0.5) * 0.3] // 길 쪽으로 기울어 지붕이 맞닿음
      const top = [x + lean[0] * h * 0.25, h, z + lean[1] * h * 0.25]
      const n = 4 + Math.floor(rnd() * 3)
      for (let k = 0; k < n; k++) {
        const s = 1.1 + rnd() * 1.1 + r * 3
        blobs.push([top[0] + (rnd() - 0.5) * 2.6, top[1] - 0.9 + rnd() * 1.2, top[2] + (rnd() - 0.5) * 2.6, s, s * 0.7, s, Math.floor(rnd() * LEAVES.length)])
      }
      return { x, z, h, r, lean }
    })
    // 길 위 아치 지붕
    for (let z = -D / 2 + 3; z < D / 2; z += 1.6) {
      blobs.push([(rnd() - 0.5) * 1.6, 5.6 + rnd() * 0.5, z + (rnd() - 0.5) * 0.8, 1.5 + rnd() * 0.8, 0.7, 1.4 + rnd() * 0.6, Math.floor(rnd() * LEAVES.length)])
    }
    const blocked = (x, z, r) => Math.abs(x) < 1.7 + r || z < -D / 2 + 2.6 || avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + r)
    const bushes = []
    for (let i = 0; i < 70; i++) {
      const x = (rnd() - 0.5) * W
      const z = -D / 2 + 2.6 + rnd() * (D - 2.8)
      const s = 0.35 + rnd() * 0.6
      if (blocked(x, z, s * 0.6)) continue
      if (trunks.some(([tx, tz, , tr]) => Math.hypot(tx - x, tz - z) < tr + 0.3)) continue
      bushes.push([x, z, s, Math.floor(rnd() * LEAVES.length), rnd() < 0.45])
    }
    const stones = []
    for (let z = -D / 2 + 1; z < D / 2; z += 0.75 + rnd() * 0.5) {
      if (rnd() < 0.35) continue
      stones.push([(rnd() - 0.5) * 1.8, z, 0.18 + rnd() * 0.22, rnd() * Math.PI, Math.floor(rnd() * 6)])
    }
    const spots = []
    for (let i = 0; i < 22; i++) {
      const z = -D / 2 + 2 + rnd() * (D - 2)
      const x = (rnd() - 0.5) * (rnd() < 0.6 ? 3 : 12)
      spots.push([x, z, 0.25 + rnd() * 0.5, 0.15 + rnd() * 0.3, rnd() * Math.PI])
    }
    return { crowns, blobs, bushes, stones, spots }
  }, [trunks, avoid, W, D])
  return (
    <group>
      {/* 숲 바닥 (길 양쪽) + 흙길 */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (W / 4 + 0.8), 0.012, 0.6]} s={[W / 2 - 1.6, 0.02, D - 1.2]} m={FOREST_FLOOR} />
      ))}
      {/* 가장자리가 숲 바닥으로 흐려지는 흙길 (두 겹: 넓고 흐린 것 + 가운데 진한 것) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={FOREST_PATH}>
        <planeGeometry args={[4.6, D]} />
      </mesh>
      <mesh position={[0, 0.024, 0]} rotation={[-Math.PI / 2, 0, 0]} material={FOREST_PATH} scale={[0.6, 1, 1]}>
        <planeGeometry args={[4.6, D]} />
      </mesh>
      {parts.stones.map(([x, z, r, rot, k], i) => (
        <mesh key={`s${i}`} geometry={stoneGeo(k)} position={[x, 0.0, z]} rotation={[0, rot, 0]} scale={[r, 1, r * 0.8]} material={PATH_STONES[k % 3]} />
      ))}
      {/* 줄기 */}
      {parts.crowns.map(({ x, z, h, r, lean }, i) => (
        <group key={`t${i}`} position={[x, 0, z]} rotation={[lean[1] * 0.25, 0, -lean[0] * 0.25]}>
          <mesh position={[0, h / 2, 0]} material={i % 3 ? BARK : BARK_D}>
            <cylinderGeometry args={[r * 0.55, r, h, 7]} />
          </mesh>
          <mesh position={[0, 0.15, 0]} material={BARK_D}>
            <cylinderGeometry args={[r, r * 1.7, 0.3, 7]} />
          </mesh>
        </group>
      ))}
      {/* 잎 덩어리 */}
      {parts.blobs.map(([x, y, z, sx, sy, sz, c], i) => (
        <mesh key={`b${i}`} geometry={LEAF_BLOB} material={LEAVES[c]} position={[x, y, z]} scale={[sx, sy, sz]} />
      ))}
      {/* 덤불·고사리 */}
      {parts.bushes.map(([x, z, s, c, fern], i) =>
        fern ? (
          <group key={`f${i}`} position={[x, 0, z]}>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} position={[0, s * 0.35, 0]} rotation={[0.9, (k * Math.PI * 2) / 5, 0]} scale={[s * 0.25, s * 0.9, 0.02]} material={FERN}>
                <coneGeometry args={[1, 1, 4]} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh key={`u${i}`} geometry={LEAF_BLOB} material={LEAVES[c]} position={[x, s * 0.35, z]} scale={[s, s * 0.6, s]} />
        ),
      )}
      {/* 잎 사이로 떨어진 햇빛 */}
      {parts.spots.map(([x, z, a, b, rot], i) => (
        <mesh key={`l${i}`} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, rot]} scale={[a, b, 1]} material={SUN_SPOT}>
          <circleGeometry args={[1, 12]} />
        </mesh>
      ))}
    </group>
  )
}

// ── 터널·풀밭 양옆 숲 조각 (11/26 지민 요청: 숲 규모를 터널 양옆·풀밭 양쪽까지) ──
// 생성 스크립트가 16m 칸마다 소품 하나: item.trunks [[x, z, 높이, 반지름]], item.bushes [[x, z, 크기]] (칸 가운데 기준, 줄기 자리에 jmCollider)
// 나무 밑은 그늘진 숲 바닥 원, 잎 덩어리는 입구 숲길과 같은 재질
export function JmForest({ item }) {
  const trunks = item.trunks ?? []
  const bushes = item.bushes ?? []
  const parts = useMemo(() => {
    let seed = Math.round(Math.abs((item.position?.[0] ?? 0) * 31 + (item.position?.[1] ?? 0) * 17)) + 5
    const rnd = () => ((seed = (seed * 16807 + 11) % 2147483647) / 2147483647)
    const blobs = []
    const stems = trunks.map(([x, z, h, r]) => {
      const lean = [(rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5]
      const n = 4 + Math.floor(rnd() * 2)
      for (let k = 0; k < n; k++) {
        const sz = 1.3 + rnd() * 1.1 + r * 3
        blobs.push([x + lean[0] * h * 0.25 + (rnd() - 0.5) * 2.6, h - 0.9 + rnd() * 1.3, z + lean[1] * h * 0.25 + (rnd() - 0.5) * 2.6, sz, sz * 0.72, sz, Math.floor(rnd() * LEAVES.length)])
      }
      return { x, z, h, r, lean }
    })
    return { blobs, stems, bush: bushes.map(([x, z, sz]) => [x, z, sz, Math.floor(rnd() * LEAVES.length), rnd() < 0.4]) }
  }, [trunks, bushes, item.position])
  return (
    <group>
      {parts.stems.map(({ x, z, h, r, lean }, i) => (
        <group key={`t${i}`}>
          <mesh position={[x, 0.014, z]} rotation={[-Math.PI / 2, 0, i]} material={FOREST_FLOOR_SOFT}>
            <planeGeometry args={[5, 5]} />
          </mesh>
          <group position={[x, 0, z]} rotation={[lean[1] * 0.25, 0, -lean[0] * 0.25]}>
            <mesh position={[0, h / 2, 0]} material={i % 3 ? BARK : BARK_D}>
              <cylinderGeometry args={[r * 0.55, r, h, 7]} />
            </mesh>
            <mesh position={[0, 0.15, 0]} material={BARK_D}>
              <cylinderGeometry args={[r, r * 1.7, 0.3, 7]} />
            </mesh>
          </group>
        </group>
      ))}
      {parts.blobs.map(([x, y, z, sx, sy, sz, c], i) => (
        <mesh key={`b${i}`} geometry={LEAF_BLOB} material={LEAVES[c]} position={[x, y, z]} scale={[sx, sy, sz]} />
      ))}
      {parts.bush.map(([x, z, sz, c, fern], i) =>
        fern ? (
          <group key={`f${i}`} position={[x, 0, z]}>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} position={[0, sz * 0.35, 0]} rotation={[0.9, (k * Math.PI * 2) / 5, 0]} scale={[sz * 0.25, sz * 0.9, 0.02]} material={FERN}>
                <coneGeometry args={[1, 1, 4]} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh key={`u${i}`} geometry={LEAF_BLOB} material={LEAVES[c]} position={[x, sz * 0.35, z]} scale={[sz, sz * 0.6, sz]} />
        ),
      )}
    </group>
  )
}

// ── 이끼 낀 돌길 덮개 (11/26 지민 요청) ──
// 공용 돌길(Roads.jsx) 위에 얹는 얇은 장식: 큰 이끼 덩이(가장자리에 많이), 돌 사이 줄눈 이끼, 길가 풀 포기
// item.size [폭, _, 길이] = 길과 같은 크기, item.seed
const MOSS_C = ['#5d7a3a', '#6e8a42', '#4f6a33', '#7f9a4c'].map((c) => mat(c, { roughness: 1 }))
const GRASS_BLADE = mat('#5f8a3a', { roughness: 1, flat: true, double: true })
export function JmMossPath({ item }) {
  const [w, , d] = item.size
  const parts = useMemo(() => {
    let seed = (item.seed ?? 3) + 17
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const long = d >= w // 길 방향
    const L = long ? d : w
    const W = long ? w : d
    const at = (u, v) => (long ? [v, u] : [u, v]) // u = 길 따라, v = 가로
    const patches = []
    const n = Math.round(L * 2.2)
    for (let i = 0; i < n; i++) {
      const u = (rnd() - 0.5) * L
      const edge = rnd() < 0.65
      const v = edge ? (rnd() < 0.5 ? -1 : 1) * (W / 2 - rnd() * 0.5) : (rnd() - 0.5) * W * 0.8
      const s = edge ? 0.25 + rnd() * 0.45 : 0.12 + rnd() * 0.22
      patches.push([...at(u, v), s, s * (0.5 + rnd() * 0.5), rnd() * Math.PI, Math.floor(rnd() * MOSS_C.length)])
    }
    const joints = [] // 돌 사이 가는 이끼 줄
    for (let u = -L / 2 + 0.4; u < L / 2; u += 0.55 + rnd() * 0.25) joints.push([...at(u, (rnd() - 0.5) * 0.4), W * (0.4 + rnd() * 0.4), Math.floor(rnd() * MOSS_C.length)])
    const tufts = []
    for (let i = 0; i < Math.round(L * 1.4); i++) {
      const u = (rnd() - 0.5) * L
      const v = (rnd() < 0.5 ? -1 : 1) * (W / 2 + 0.05 - rnd() * 0.2)
      tufts.push([...at(u, v), 0.18 + rnd() * 0.22, rnd() * Math.PI])
    }
    return { patches, joints, tufts, long }
  }, [w, d, item.seed])
  return (
    <group>
      {parts.patches.map(([x, z, a, b, r, c], i) => (
        <mesh key={`p${i}`} position={[x, 0.075, z]} rotation={[-Math.PI / 2, 0, r]} scale={[a, b, 1]} material={MOSS_C[c]}>
          <circleGeometry args={[1, 7]} />
        </mesh>
      ))}
      {parts.joints.map(([x, z, len, c], i) => (
        <Box key={`j${i}`} p={[x, 0.072, z]} s={parts.long ? [len, 0.004, 0.06] : [0.06, 0.004, len]} m={MOSS_C[c]} />
      ))}
      {parts.tufts.map(([x, z, h, r], i) => (
        <group key={`t${i}`} position={[x, 0.06, z]} rotation={[0, r, 0]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, h / 2, 0]} rotation={[0.25 * (k - 1), (k * Math.PI) / 3, 0.2 * (k - 1)]} scale={[0.05, h, 0.012]} material={GRASS_BLADE}>
              <coneGeometry args={[1, 1, 3]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export const JM_TUNNEL_STYLES = { jmTunnelGate: JmTunnelGate, jmTwoFaceStatue: JmTwoFaceStatue, jmStoneHokora: JmStoneHokora, jmForestPath: JmForestPath, jmForest: JmForest, jmMossPath: JmMossPath, jmEntryTitle: JmEntryTitle, ...JM_RIVERBED_STYLES, ...JM_CHANNEL_STYLES }
