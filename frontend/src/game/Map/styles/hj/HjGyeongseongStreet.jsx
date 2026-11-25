import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Ball, Box, Cone, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { getVerticalSignTexture } from './hjTextures.js'

// [3. 개발 > 프론트엔드] 1930년대 경성 거리 2탄 (혜진 영화·드라마 구역)
// 참고한 장면: 경성역(붉은 벽돌 + 흰 돌 띠 + 초록 돔), 기차길·증기기관차·승강장, 전신주와 전깃줄,
// 방울 가로등, 세로 간판·깃발, 노점, 클래식 자동차. 상호는 모두 가상의 이름이에요.
// 모두 size [가로 w, 높이 h, 깊이/길이 d], 앞면 +z.

const BRICK = '#a9483a'
const BRICK_DARK = '#8b3a2f'
const STONE = '#efe6d2'
const STONE_DARK = '#cfc4ad'
const COPPER = '#4f8a6a'
const IRON = '#2d2b29'
const WOOD = '#6b4a33'
const WINDOW_LIT = mat('#ffe2ae', { emissive: '#ffc27a', emissiveIntensity: 0.6 })
const WINDOW_DARK = mat('#5d6f7a', { roughness: 0.3, metalness: 0.2 })
const PARTS = mat('#ffffff', { roughness: 0.85 })
const GLASS_ROSE = mat('#f3d9a6', { emissive: '#e9a85a', emissiveIntensity: 0.55 })

// 경성역은 들어갈 수 있게 HjSeoulStation.jsx로 옮겼어요.

// ── 기차길 (style: "hjRailway") — 자갈 둑 + 침목 + 레일 2줄. 길이 방향 = z ──
// item.bedOnly: true면 선로 없이 넓은 자갈 둑만 (size[0] 폭) — 바다 위 선로 바닥용
export function HjRailway({ item }) {
  const [bedW, , length] = item.size
  if (item.bedOnly) {
    return (
      <group>
        <Box p={[0, 0.08, 0]} s={[bedW, 0.16, length]} c="#8a8174" />
        <Box p={[-bedW / 2 - 0.3, 0.3, 0]} s={[0.6, 0.6, length]} c="#a59d8e" />
      </group>
    )
  }
  const ties = useMemo(() => {
    const list = []
    for (let z = -length / 2 + 0.35; z < length / 2; z += 0.7) list.push({ p: [0, 0.27, z], s: [2.5, 0.12, 0.26], c: '#5e4a3a' })
    return list
  }, [length])
  return (
    <group>
      <Box p={[0, 0.1, 0]} s={[3.4, 0.2, length]} c="#8d8478" />
      <Box p={[0, 0.2, 0]} s={[2.8, 0.06, length]} c="#a39a8c" />
      <Instances geometry={GEO.box} material={PARTS} items={ties} />
      {[-0.72, 0.72].map((x) => (
        <Box key={x} p={[x, 0.39, 0]} s={[0.1, 0.12, length]} c="#9a958c" />
      ))}
    </group>
  )
}

// 증기기관차·객차는 실내가 있는 HjTrainCars.jsx로 옮겼어요.

// ── 승강장 (style: "hjPlatform") — 낮은 돌 승강장 + 쇠기둥 지붕 + 역 이름판 + 벤치. 길이 방향 = z ──
export function HjPlatform({ item }) {
  const [w, , length] = item.size
  const posts = useMemo(() => {
    const list = []
    for (let z = -length / 2 + 2; z <= length / 2 - 1.9; z += 4) list.push({ p: [-w * 0.15, 2.1, z], s: [0.14, 3.4, 0.14] })
    return list
  }, [w, length])
  const name = getSignTexture(item.title ?? '경 성', '#f6efdc', '#2d3b35')
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[w, 0.4, length]} m={mat('#b3ab9c', { roughness: 0.22, metalness: 0.15 })} />
      <Box p={[w / 2 - 0.15, 0.41, 0]} s={[0.3, 0.02, length]} c="#e8d38a" />
      <Instances geometry={GEO.box} material={mat('#3f5a4a')} items={posts} />
      <Box p={[-w * 0.05, 3.85, 0]} s={[w + 0.6, 0.15, length]} r={[0, 0, -0.12]} c="#55606a" />
      <Box p={[-w * 0.15, 3.65, 0]} s={[0.2, 0.25, length]} c="#3f5a4a" />
      {[-length / 4, length / 4].map((z) => (
        <group key={z} position={[-w * 0.15, 3.0, z]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.6, 0.55]} />
            <meshStandardMaterial map={name} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* 기둥 위 장식 까치발 (쇠) */}
      {posts.map((p) =>
        [-1, 1].map((k) => (
          <Box key={`br${p.p[2]}${k}`} p={[p.p[0] + k * 0.45, 3.35, p.p[2]]} s={[1.0, 0.08, 0.08]} r={[0, 0, k * 0.5]} c="#3f5a4a" />
        )),
      )}
      {/* 매달린 시계 2개 + 갓 달린 등 */}
      {[-length / 6, length / 6].map((z) => (
        <group key={`ck${z}`} position={[-w * 0.15, 3.0, z]}>
          <Box p={[0, 0.45, 0]} s={[0.04, 0.5, 0.04]} c={IRON} />
          <Cyl p={[0, 0, 0]} rad={0.42} h={0.14} c="#2d2b29" r={[Math.PI / 2, 0, 0]} />
          {[-1, 1].map((f) => (
            <group key={f} position={[0, 0, f * 0.075]} rotation-y={f > 0 ? 0 : Math.PI}>
              <mesh>
                <circleGeometry args={[0.36, 24]} />
                <meshStandardMaterial color="#f4efe2" />
              </mesh>
              <Box p={[0, 0.1, 0.01]} s={[0.03, 0.22, 0.01]} c={IRON} />
              <Box p={[0.08, -0.04, 0.01]} s={[0.18, 0.03, 0.01]} r={[0, 0, -0.4]} c={IRON} />
            </group>
          ))}
        </group>
      ))}
      {Array.from({ length: Math.floor(length / 6) }, (_, i) => -length / 2 + 3 + i * 6).map((z) => (
        <group key={`lp${z}`} position={[w * 0.18, 3.2, z]}>
          <Box p={[0, 0.25, 0]} s={[0.02, 0.5, 0.02]} c={IRON} />
          <mesh position={[0, 0, 0]} material={mat('#2f3a34')}>
            <coneGeometry args={[0.28, 0.2, 12, 1, true]} />
          </mesh>
          <Ball p={[0, -0.08, 0]} rad={0.1} m={mat('#fff3d8', { emissive: '#ffd9a0', emissiveIntensity: 1.1 })} />
        </group>
      ))}
      {/* 짐 트렁크 (기차 타는 곳은 비워 둬요) */}
      {[[-0.4, -9], [-0.5, 3.5]].map(([x, z]) => (
        <group key={`t${z}`} position={[x, 0.4, z]}>
          <Box p={[0, 0.22, 0]} s={[0.5, 0.44, 0.8]} c="#5a3a22" />
          <Box p={[0, 0.45, 0]} s={[0.52, 0.04, 0.82]} c="#2a1c12" />
          <Box p={[0, 0.62, 0.1]} s={[0.36, 0.3, 0.5]} c="#7a5a3a" />
        </group>
      ))}
      {[-length / 3, 0, length / 3].map((z) => (
        <group key={`b${z}`} position={[-w * 0.32, 0.4, z + 1.2]}>
          <Box p={[0, 0.42, 0]} s={[0.5, 0.08, 1.6]} c={WOOD} />
          <Box p={[-0.22, 0.7, 0]} s={[0.06, 0.5, 1.6]} c={WOOD} />
          {[-0.7, 0.7].map((dz) => (
            <Box key={dz} p={[0, 0.2, dz]} s={[0.45, 0.4, 0.06]} c={IRON} />
          ))}
        </group>
      ))}
    </group>
  )
}

// ── 전신주 + 전깃줄 (style: "hjPowerLine") — item.points: [[x, z], ...] 기둥 자리 (아이템 기준) ──
export function HjPowerLine({ item }) {
  const points = item.points ?? [[0, 0]]
  const poleH = item.size?.[1] ?? 7
  const wires = useMemo(() => {
    const geos = []
    for (let i = 0; i < points.length - 1; i += 1) {
      const [ax, az] = points[i]
      const [bx, bz] = points[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz) || 1
      const nx = -dz / len
      const nz = dx / len
      for (const off of [-0.65, 0, 0.65]) {
        const a = new THREE.Vector3(ax + nx * off, poleH - 0.55, az + nz * off)
        const b = new THREE.Vector3(bx + nx * off, poleH - 0.55, bz + nz * off)
        const mid = a.clone().add(b).multiplyScalar(0.5)
        mid.y -= 0.7
        geos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 10, 0.022, 4, false))
      }
    }
    return geos
  }, [points, poleH])
  return (
    <group>
      {points.map(([x, z], i) => {
        const next = points[i + 1] ?? points[i - 1] ?? [x, z + 1]
        const ang = Math.atan2(next[0] - x, next[1] - z)
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, ang, 0]}>
            <Cyl p={[0, poleH / 2, 0]} rad={0.12} h={poleH} c="#5a4636" geo={GEO.cyl8} />
            <Box p={[0, poleH - 0.5, 0]} s={[1.6, 0.12, 0.12]} c="#5a4636" />
            <Box p={[0, poleH - 1.2, 0]} s={[1.1, 0.1, 0.1]} c="#5a4636" />
            {[-0.65, 0, 0.65].map((ox) => (
              <Cyl key={ox} p={[ox, poleH - 0.36, 0]} rad={0.05} h={0.16} c="#f1efe8" geo={GEO.cyl8} />
            ))}
          </group>
        )
      })}
      {wires.map((g, i) => (
        <mesh key={i} geometry={g} material={mat(IRON)} />
      ))}
    </group>
  )
}

// ── 방울 가로등 (style: "hjGlobeLamp") — 초록 쇠기둥 + 동그란 유리등 5개. item.color: 등 색 ──
export function HjGlobeLamp({ item }) {
  const [, h] = item.size
  const glow = mat(item.color ?? '#fff4dc', { emissive: item.glow ?? '#ffd9a0', emissiveIntensity: 0.9 })
  const arms = [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]]
  return (
    <group>
      <Cyl p={[0, 0.3, 0]} rad={0.2} h={0.6} c="#2f4a3a" geo={GEO.cyl8} />
      <Cyl p={[0, h / 2, 0]} rad={0.07} h={h} c="#2f4a3a" geo={GEO.cyl8} />
      {arms.map(([x, z], i) => (
        <group key={i}>
          <Box p={[x / 2, h - 0.35, z / 2]} s={[Math.abs(x) + 0.05, 0.05, Math.abs(z) + 0.05]} c="#2f4a3a" />
          <Ball p={[x, h - 0.6, z]} rad={0.2} m={glow} />
        </group>
      ))}
      <Ball p={[0, h + 0.2, 0]} rad={0.24} m={glow} />
    </group>
  )
}

// ── 세로 간판 (style: "hjVerticalSign") — 벽에서 튀어나온 세로 간판(양면). item.text / bg / fg. size [폭, 높이, -] ──
export function HjVerticalSign({ item }) {
  const [w, h] = item.size
  const tex = getVerticalSignTexture(item.text ?? '상회', item.bg ?? '#2b2420', item.fg ?? '#f3dfb0')
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[0.12, h + 0.1, w + 0.1]} c={item.frame ?? '#3b2a20'} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.065, h / 2, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={tex} emissive={item.lit ? '#ffffff' : '#000000'} emissiveMap={tex} emissiveIntensity={item.lit ? 0.35 : 0} />
        </mesh>
      ))}
      <Box p={[0, h + 0.1, -w / 2 - 0.25]} s={[0.06, 0.06, 0.6]} c={IRON} />
    </group>
  )
}

// ── 세로 깃발 (style: "hjBanner") — 가게 앞 장대 깃발. item.text / bg / fg ──
export function HjBanner({ item }) {
  const [w, h] = item.size
  const tex = getVerticalSignTexture(item.text ?? '대매출', item.bg ?? '#f3ece0', item.fg ?? '#8f2a22', false)
  return (
    <group>
      <Cyl p={[0, h / 2, 0]} rad={0.04} h={h} c="#4a3a2c" geo={GEO.cyl8} />
      <Box p={[w / 2, h - 0.05, 0]} s={[w + 0.1, 0.04, 0.04]} c="#4a3a2c" />
      <mesh position={[w / 2 + 0.05, h - 0.1 - (h * 0.68) / 2, 0]}>
        <planeGeometry args={[w, h * 0.68]} />
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 노점 (style: "hjMarketStall") — 나무 판매대 + 천 지붕 + 물건 상자·바구니. item.color: 천 색 ──
export function HjMarketStall({ item }) {
  const [w, h, d] = item.size
  const goods = useMemo(() => {
    const colors = ['#d9a441', '#b8433a', '#e8dcc0', '#6f8f4e', '#c98b5a']
    const list = []
    const n = Math.max(3, Math.round(w / 0.55))
    for (let i = 0; i < n; i += 1) {
      list.push({ p: [-w / 2 + 0.35 + ((w - 0.7) / (n - 1)) * i, 1.0, d / 2 - 0.35], s: [0.42, 0.22 + (i % 3) * 0.06, 0.38], c: colors[i % colors.length] })
      list.push({ p: [-w / 2 + 0.35 + ((w - 0.7) / (n - 1)) * i, 1.0, -0.05], s: [0.38, 0.3, 0.38], c: colors[(i + 2) % colors.length] })
    }
    return list
  }, [w, d])
  return (
    <group>
      <Box p={[0, 0.45, 0]} s={[w, 0.9, d]} c={WOOD} />
      <Box p={[0, 0.9, 0]} s={[w + 0.1, 0.06, d + 0.1]} c="#8a6a48" />
      <Instances geometry={GEO.box} material={PARTS} items={goods} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)]} s={[0.08, h, 0.08]} c={WOOD} />),
      )}
      <mesh position={[0, h + 0.05, 0.2]} rotation={[0.25, 0, 0]} material={mat(item.color ?? '#e6dcc4')}>
        <boxGeometry args={[w + 0.6, 0.05, d + 1]} />
      </mesh>
      {item.text && (
        <mesh position={[0, h - 0.25, d / 2 + 0.62]} rotation={[0.25, 0, 0]}>
          <planeGeometry args={[Math.min(w, 1.8), 0.34]} />
          <meshStandardMaterial map={getSignTexture(item.text, '#f6efdc', '#3b2a20')} />
        </mesh>
      )}
    </group>
  )
}

// ── 클래식 자동차 (style: "hjVintageCar") — 1930년대 검은 세단. 앞 = +z. item.color ──
const CAR_GLASS = mat('#cfe3ea', { transparent: true, opacity: 0.18, roughness: 0.05 })
export function HjVintageCar({ item }) {
  const body = mat(item.color ?? '#1d1f22', { roughness: 0.35, metalness: 0.45 })
  const chrome = mat('#d6d3cc', { roughness: 0.2, metalness: 0.9 })
  return (
    <group>
      <Box p={[0, 0.62, 0]} s={[1.6, 0.55, 4.2]} m={body} />
      {/* 실내가 보이는 객실: 높은 지붕 + 기둥 + 유리창 (안에 앉은 사람 머리가 지붕을 뚫지 않게 지붕을 1.95m로) */}
      <Box p={[0, 1.95, -0.45]} s={[1.52, 0.08, 2.18]} m={body} />
      <Box p={[0, 1.91, -0.45]} s={[1.4, 0.02, 2.0]} c="#d8cdb5" />
      {[-0.73, 0.73].flatMap((x) =>
        [0.58, -0.45, -1.48].map((z) => <Box key={`pl${x}${z}`} p={[x, 1.42, z]} s={[0.06, 1.06, 0.06]} m={body} />),
      )}
      {[-1, 1].map((sd) => (
        <Box key={`gl${sd}`} p={[sd * 0.74, 1.42, -0.45]} s={[0.02, 1.0, 2.0]} m={CAR_GLASS} />
      ))}
      <Box p={[0, 1.42, 0.6]} s={[1.42, 1.0, 0.02]} m={CAR_GLASS} />
      <Box p={[0, 1.42, -1.5]} s={[1.42, 1.0, 0.02]} m={CAR_GLASS} />
      {/* 실내: 앞·뒤 가죽 의자 (낮게) + 계기판 */}
      {[-0.35, -1.15].map((z) => (
        <group key={`seat${z}`}>
          <Box p={[0, 0.78, z]} s={[1.3, 0.08, 0.5]} c="#5a2a22" />
          <Box p={[0, 1.05, z - 0.27]} s={[1.3, 0.55, 0.08]} c="#5a2a22" />
        </group>
      ))}
      <Box p={[0, 0.98, 0.5]} s={[1.4, 0.2, 0.16]} c="#3a281c" />
      {/* 운전대: 계기판에서 나온 기둥 끝에 비스듬히 (운전석 앞) */}
      <group position={[-0.35, 0, 0]}>
        <mesh position={[0, 1.0, 0.36]} rotation={[0.95, 0, 0]} material={mat('#1c1a18')}>
          <cylinderGeometry args={[0.025, 0.03, 0.34, 8]} />
        </mesh>
        <group position={[0, 1.1, 0.22]} rotation={[-0.6, 0, 0]}>
          <mesh material={mat('#2a2018')}>
            <torusGeometry args={[0.17, 0.02, 6, 20]} />
          </mesh>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
            <Box key={a} p={[Math.cos(a + Math.PI / 2) * 0.085, Math.sin(a + Math.PI / 2) * 0.085, 0]} s={[0.012, 0.17, 0.012]} r={[0, 0, a]} m={chrome} />
          ))}
          <Cyl p={[0, 0, 0]} rad={0.035} h={0.03} m={chrome} r={[Math.PI / 2, 0, 0]} />
        </group>
      </group>
      {/* 앞 보닛 + 라디에이터 그릴 + 헤드라이트 */}
      <Box p={[0, 0.95, 1.4]} s={[1.0, 0.35, 1.4]} m={body} />
      <Box p={[0, 0.85, 2.12]} s={[0.75, 0.6, 0.06]} m={chrome} />
      {[-0.62, 0.62].map((x) => (
        <Ball key={x} p={[x, 1.0, 2.0]} rad={0.15} m={mat('#fff6d6', { emissive: '#ffd27a', emissiveIntensity: 0.6 })} />
      ))}
      <Box p={[0, 0.4, 2.2]} s={[1.7, 0.1, 0.1]} m={chrome} />
      <Box p={[0, 0.4, -2.15]} s={[1.7, 0.1, 0.1]} m={chrome} />
      {/* 흙받이 + 바퀴 */}
      {[-1, 1].flatMap((sx) =>
        [-1.35, 1.35].map((z) => (
          <group key={`${sx}${z}`} position={[sx * 0.82, 0.42, z]}>
            <Cyl p={[0, 0, 0]} rad={0.42} h={0.22} c="#151515" r={[0, 0, Math.PI / 2]} />
            <Cyl p={[sx * 0.06, 0, 0]} rad={0.22} h={0.14} m={chrome} r={[0, 0, Math.PI / 2]} />
            <Box p={[0, 0.46, 0]} s={[0.32, 0.1, 1.1]} m={body} />
            <Box p={[0, 0.3, 0.6]} s={[0.32, 0.3, 0.12]} r={[0.6, 0, 0]} m={body} />
            <Box p={[0, 0.3, -0.6]} s={[0.32, 0.3, 0.12]} r={[-0.6, 0, 0]} m={body} />
          </group>
        )),
      )}
      <Box p={[0, 0.98, -2.0]} s={[0.5, 0.5, 0.25]} m={body} />
    </group>
  )
}

// ── 터널 입구 (style: "hjTunnelPortal") — 돌로 쌓은 입구 + 어두운 굴 + 흙 언덕. 기차가 여기로 들어가고 나와요.
//    size [폭, 높이, 깊이], 앞 = +z (선로 쪽). item.tracks: 굴 가운데 x 목록 ──
export function HjTunnelPortal({ item }) {
  const [w, h, d] = item.size
  const tracks = item.tracks ?? [0]
  return (
    <group>
      {/* 흙 언덕 (뒤로 덮음) */}
      <Box p={[0, h * 0.55, -d * 0.1]} s={[w + 4, h * 1.1, d * 1.2]} c="#5f7a48" />
      {/* 돌 벽 */}
      <Box p={[0, h / 2, d / 2 - 0.4]} s={[w, h, 0.8]} c="#9a9284" />
      <Box p={[0, h + 0.15, d / 2 - 0.4]} s={[w + 0.4, 0.3, 1.0]} c="#7f786c" />
      {tracks.map((x) => (
        <group key={x} position={[x, 0, d / 2]}>
          {/* 굴 (어두운 아치) */}
          <Box p={[0, 2.3, -0.01]} s={[3.4, 4.6, 0.05]} c="#0c0b0a" />
          <mesh position={[0, 4.6, -0.01]}>
            <circleGeometry args={[1.7, 16, 0, Math.PI]} />
            <meshBasicMaterial color="#0c0b0a" />
          </mesh>
          <mesh position={[0, 4.6, 0.02]}>
            <ringGeometry args={[1.7, 2.1, 16, 1, 0, Math.PI]} />
            <meshStandardMaterial color="#bdb5a4" />
          </mesh>
          {[-1, 1].map((k) => (
            <Box key={k} p={[k * 1.9, 2.3, 0.05]} s={[0.4, 4.6, 0.12]} c="#bdb5a4" />
          ))}
        </group>
      ))}
    </group>
  )
}

// ── 건널목 (style: "hjRailCrossing") — 선로를 건너는 나무 판 길 + "건널목" 표지. size [폭(x), -, 깊이(z)] ──
export function HjRailCrossing({ item }) {
  const [w, , d] = item.size
  const planks = useMemo(() => {
    const list = []
    const n = Math.max(3, Math.round(d / 0.32))
    for (let i = 0; i < n; i += 1) list.push({ p: [0, 0.43, -d / 2 + (d / n) * (i + 0.5)], s: [w, 0.05, d / n - 0.04], c: i % 2 ? '#7a5a3a' : '#6b4a2e' })
    return list
  }, [w, d])
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[w, 0.4, d]} c="#5a4a3a" />
      <Instances geometry={GEO.box} material={PARTS} items={planks} />
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (w / 2 - 0.2), 0, -d / 2 - 0.3]}>
          <Cyl p={[0, 1.1, 0]} rad={0.05} h={2.2} c="#2d2b29" />
          <Box p={[0, 2.0, 0]} s={[1.0, 0.16, 0.04]} r={[0, 0, 0.6]} c="#f4efe4" />
          <Box p={[0, 2.0, 0]} s={[1.0, 0.16, 0.04]} r={[0, 0, -0.6]} c="#f4efe4" />
          {k > 0 && (
            <mesh position={[0, 1.5, 0.03]}>
              <planeGeometry args={[0.8, 0.26]} />
              <meshStandardMaterial map={getSignTexture('건 널 목', '#f4efe4', '#8f2a22')} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

// ── 전차 정류장 안전지대 (style: "hjTramStop") — 길 가운데 낮은 돌 섬 + 작은 지붕 + 정류장 이름판 + 벤치.
//    전차가 여기 서면 섬 위에서 E로 타요. size [폭(x), -, 길이(z)], 앞 = +x (선로 쪽). item.title: 정류장 이름 ──
export function HjTramStop({ item }) {
  const [w, , l] = item.size
  const name = getSignTexture(item.title ?? '정류장', '#f6efdc', '#2f5d4a')
  return (
    <group>
      <Box p={[0, 0.075, 0]} s={[w, 0.15, l]} c="#b9b1a2" />
      <Box p={[w / 2 - 0.08, 0.152, 0]} s={[0.12, 0.01, l]} c="#e8d38a" />
      {/* 작은 지붕 (뒤쪽 기둥 2개) */}
      {[-l / 2 + 0.6, l / 2 - 0.6].map((z) => (
        <Cyl key={z} p={[-w / 2 + 0.2, 1.3, z]} rad={0.05} h={2.3} c="#2f4a3a" geo={GEO.cyl8} />
      ))}
      <Box p={[-w / 2 + 0.45, 2.5, 0]} s={[0.9, 0.08, l - 0.6]} r={[0, 0, 0.12]} c="#55606a" />
      {/* 정류장 이름판 (양면) + 표지 기둥 */}
      <group position={[-w / 2 + 0.2, 0, -l / 2 + 0.25]}>
        <Cyl p={[0, 1.4, 0]} rad={0.04} h={2.8} c="#2f4a3a" geo={GEO.cyl8} />
        {[0, Math.PI].map((ry) => (
          <mesh key={ry} position={[0, 2.55, 0]} rotation-y={ry + Math.PI / 2}>
            <planeGeometry args={[1.3, 0.32]} />
            <meshStandardMaterial map={name} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0.02, 2.15, 0]} rotation-y={Math.PI / 2}>
          <circleGeometry args={[0.16, 16]} />
          <meshStandardMaterial map={getSignTexture('전차', '#2f5d4a', '#f6efdc', 1)} />
        </mesh>
      </group>
      {/* 벤치 */}
      <group position={[-w / 2 + 0.35, 0.15, 0.4]}>
        <Box p={[0, 0.42, 0]} s={[0.4, 0.06, 1.4]} c={WOOD} />
        <Box p={[-0.18, 0.68, 0]} s={[0.05, 0.45, 1.4]} c={WOOD} />
        {[-0.6, 0.6].map((dz) => (
          <Box key={dz} p={[0, 0.2, dz]} s={[0.36, 0.4, 0.05]} c={IRON} />
        ))}
      </group>
    </group>
  )
}
