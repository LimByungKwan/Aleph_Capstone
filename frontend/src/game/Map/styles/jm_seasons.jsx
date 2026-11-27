import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { useSeason } from '../../seasons.js'
import SeasonalTree from './SeasonalTree.jsx'

// 애니메이션 구역(JM) 전용 나무·바닥·골목 소품
const range = (n) => Array.from({ length: n }, (_, i) => i)

// 기존 구역 파일의 수종·크기 설정을 공용 사계절 나무에 전달해요.
export const JmSakura = ({ item }) => <SeasonalTree item={item} kind="sakura" />
export const JmMaple = ({ item }) => <SeasonalTree item={item} kind="maple" />
export const JmGinkgo = ({ item }) => <SeasonalTree item={item} kind="ginkgo" />

// ── 계절 바닥 (꽃잎·풀·낙엽·눈) ────────────────
// 바닥에 얇게 깔리는 조각들. size [가로, 0.02, 깊이] 범위 안에 흩뿌림. JSON에 "collider": false
const GROUND = {
  spring: { colors: ['#f7c3d2', '#fbd6e0', '#f0aac0'], density: 0.5, size: 0.35 }, // 벚꽃잎
  summer: { colors: ['#5d8f3e', '#6fa04a', '#4f7f34'], density: 0.25, size: 0.6 }, // 풀
  autumn: { colors: ['#c9282d', '#e0452b', '#f2c12e', '#b5502f', '#ef7a2c'], density: 0.8, size: 0.4 }, // 낙엽
  winter: { colors: ['#f4f7fb', '#e8eef5', '#ffffff'], density: 0.6, size: 0.9 }, // 눈
}

// 같은 위치에 매번 같은 무늬가 나오도록 하는 간단한 난수
function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
const hash = (text) => [...text].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1

// 조각이 수백 개라 색마다 InstancedMesh 하나로 그려요 (그리기 호출 수를 색 개수만큼으로 줄임)
export function JmGroundCover({ item }) {
  const season = useSeason()
  const [w, , d] = item.size
  const cfg = GROUND[season]

  const groups = useMemo(() => {
    const count = Math.min(220, Math.round(w * d * cfg.density))
    const rand = seeded(hash(item.id ?? 'ground'))
    const byColor = cfg.colors.map(() => [])
    const dummy = new THREE.Object3D()
    range(count).forEach((i) => {
      const s = cfg.size * (0.6 + rand() * 0.8)
      dummy.position.set((rand() - 0.5) * w, 0.035 + (i % 3) * 0.002, (rand() - 0.5) * d)
      dummy.rotation.set(-Math.PI / 2, 0, rand() * Math.PI)
      dummy.scale.set(s, s, 1)
      dummy.updateMatrix()
      byColor[Math.floor(rand() * cfg.colors.length)].push(dummy.matrix.clone())
    })
    return byColor
  }, [w, d, cfg, item.id])

  return (
    <group>
      {groups.map((matrices, i) =>
        matrices.length ? <PieceInstances key={i} matrices={matrices} color={cfg.colors[i]} /> : null,
      )}
    </group>
  )
}

function PieceInstances({ matrices, color }) {
  const season = useSeason()
  const ref = useRef(null)
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
  }, [matrices])
  return (
    <instancedMesh ref={ref} args={[null, null, matrices.length]}>
      <circleGeometry args={[0.5, season === 'winter' ? 10 : 5]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  )
}

// ── 대나무 숲 ─────────────────────────────────
// size [가로, 높이, 깊이] 안에 대나무를 여러 그루. 겨울엔 잎 위에 눈. JSON에 "collider": false 또는 작은 값
export function JmBamboo({ item }) {
  const season = useSeason()
  const [w, h, d] = item.size
  const rand = seeded(hash(item.id ?? 'bamboo'))
  const count = Math.max(4, Math.round(w * d * 1.2))
  const stalks = range(count).map(() => ({
    x: (rand() - 0.5) * w,
    z: (rand() - 0.5) * d,
    hh: h * (0.75 + rand() * 0.25),
  }))
  const leaf = season === 'autumn' ? '#8fa848' : season === 'spring' ? '#7fbf55' : '#4f9a3c'
  return (
    <group>
      {stalks.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <mesh position={[0, s.hh / 2, 0]}>
            <cylinderGeometry args={[0.06, 0.07, s.hh, 6]} />
            <meshStandardMaterial color="#7fa650" />
          </mesh>
          {range(3).map((k) => (
            <mesh key={k} position={[0, s.hh * (0.7 + k * 0.12), 0]} rotation={[0, k * 2.1, 0.5]}>
              <coneGeometry args={[0.45, 0.9, 5]} />
              <meshStandardMaterial color={season === 'winter' && k === 2 ? '#f4f7fb' : leaf} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ── 전봇대 + 전선 ─────────────────────────────
// 일본 골목 애니의 단골 풍경. item.wire = 로컬 +x 방향으로 늘어뜨릴 전선 길이(m, 다음 전봇대까지)
export function JmUtilityPole({ item }) {
  const [, h] = item.size
  const wire = item.wire ?? 0
  const armY = h - 0.6
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.13, 0.17, h, 8]} />
        <meshStandardMaterial color="#8a8780" />
      </mesh>
      {/* 가로 완목 2단 */}
      {[armY, armY - 0.7].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.1, 0.1, 1.6]} />
          <meshStandardMaterial color="#5c5a55" />
        </mesh>
      ))}
      {/* 변압기 */}
      <mesh position={[0.32, h - 2.2, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.7, 10]} />
        <meshStandardMaterial color="#9aa0a6" />
      </mesh>
      {/* 노랑·검정 줄무늬 보호판 */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 1.6, 8]} />
        <meshStandardMaterial color="#e8c02a" />
      </mesh>
      {/* 전선 (살짝 처진 3가닥) */}
      {wire > 0 &&
        [-0.7, 0, 0.7].map((z) =>
          [0, 1].map((half) => (
            <mesh
              key={`${z}${half}`}
              position={[wire * (half ? 0.75 : 0.25), armY - 0.25 + 0.12 * (half ? 1 : 1), z]}
              rotation={[0, 0, (half ? -1 : 1) * 0.04 + Math.PI / 2]}
            >
              <cylinderGeometry args={[0.012, 0.012, wire / 2 + 0.02, 3]} />
              <meshStandardMaterial color="#222222" />
            </mesh>
          )),
        )}
    </group>
  )
}

// ── 빨간 원통 우체통 (일본식) ───────────────────
export function JmPostBox() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 1, 8]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.9, 16]} />
        <meshStandardMaterial color="#d7262b" />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d7262b" />
      </mesh>
      <mesh position={[0, 1.42, 0.3]}>
        <planeGeometry args={[0.32, 0.06]} />
        <meshStandardMaterial color="#1f1f1f" />
      </mesh>
    </group>
  )
}

// ── 커브 미러 (주황 기둥 + 둥근 거울) ──────────────
export function JmCurveMirror({ item }) {
  const [, h] = item.size
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, h, 8]} />
        <meshStandardMaterial color="#e8792a" />
      </mesh>
      <mesh position={[0, h - 0.1, 0.12]}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 20]} />
        <meshStandardMaterial color="#e8792a" />
      </mesh>
      <mesh position={[0, h - 0.1, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.36, 20]} />
        <meshStandardMaterial color="#cfe3f0" metalness={0.8} roughness={0.15} />
      </mesh>
    </group>
  )
}

// ── 자판기 줄 (일본 골목의 자판기 2~3대) ─────────
// size [가로, 높이, 깊이]. 가로 1m당 1대
export function JmVendingRow({ item }) {
  const [w, h, d] = item.size
  const count = Math.max(1, Math.round(w))
  const colors = ['#f2f4f5', '#1f6fd1', '#d7262b']
  return (
    <group>
      {range(count).map((i) => {
        const x = -w / 2 + (w / count) * (i + 0.5)
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[w / count - 0.06, h, d]} />
              <meshStandardMaterial color={colors[i % colors.length]} />
            </mesh>
            {/* 음료 진열창 (불 들어옴) */}
            <mesh position={[0, h * 0.68, d / 2 + 0.01]}>
              <planeGeometry args={[w / count - 0.25, h * 0.42]} />
              <meshStandardMaterial color="#fff8e6" emissive="#fff1c9" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, h * 0.2, d / 2 + 0.01]}>
              <planeGeometry args={[w / count - 0.35, 0.18]} />
              <meshStandardMaterial color="#222222" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ── 구역 전용 보조 조명 ───────────────────────────
// 맵 전체 조명(Scene.jsx, 공용)은 그대로 두고, 애니 구역 위에만 그림자 없는 부드러운 빛을 더해요.
// decay 0 + distance: 거리 안쪽은 고르게 밝히고 distance 근처에서 부드럽게 사라져서 옆 구역으로 거의 안 번져요.
// ⚠ three.js는 조명 하나마다 맵 전체 물체의 계산이 조금씩 늘어나요. 이 구역에는 4개까지만 쓰기.
// item.light = { intensity, distance } (선택). 색은 계절마다 바뀜
const ZONE_LIGHT_COLOR = {
  spring: '#ffdce6', // 벚꽃 분홍빛 (11/26: 너무 붉게 물들어 옅게)
  summer: '#fff0a8', // 쨍한 노란 햇빛
  autumn: '#ffc896', // 노을 주황빛 (11/26: 옅게)
  winter: '#a9c8ff', // 차가운 푸른빛
}
// 색 세기를 한곳에서 조절 (0.5 은은함 ~ 1.2 강함)
export const JM_LIGHT_INTENSITY = 0.9 // (11/26 지민 요청: 전체가 너무 빨강빨강) 1.2 → 0.9
export function JmZoneLight({ item }) {
  const season = useSeason()
  const [, h] = item.size
  const { intensity = JM_LIGHT_INTENSITY, distance = 36, color } = item.light ?? {}
  // item.light.color: 실내(보일러실 등)는 계절 색 대신 정한 색
  return <pointLight position={[0, h, 0]} color={color ?? ZONE_LIGHT_COLOR[season]} intensity={intensity} distance={distance} decay={0} castShadow={false} />
}

export const JM_SEASON_STYLES = {
  jmZoneLight: JmZoneLight,
  jmSakura: JmSakura,
  jmMaple: JmMaple,
  jmGinkgo: JmGinkgo,
  jmGroundCover: JmGroundCover,
  jmBamboo: JmBamboo,
  jmUtilityPole: JmUtilityPole,
  jmPostBox: JmPostBox,
  jmCurveMirror: JmCurveMirror,
  jmVendingRow: JmVendingRow,
}
