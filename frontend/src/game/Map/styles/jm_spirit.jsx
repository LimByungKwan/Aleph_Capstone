import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Box, Cyl, Ball, GEO, Instances, mat, seeded, texMat } from './kit.jsx'
import { canvasTexture, getJpSignTexture, getJpVerticalTexture, GlowMaterial, JP_FONT } from './jm_landmarks.jsx'
import { getTiledTexture, TILE_METERS } from './textures.js'
import { VerticalSign } from './jm_ginzan.jsx'
import { useGameStore } from '../../../store/gameStore.js'
import { NearOnly } from './jm_yutoya.jsx'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useWarps } from './bk_warpStore.js'
import { findPlayer } from '../../Player/findPlayer.js'
import { requestPalaceWarp } from '../../../components/movieZone/palaceSeating.js'
// (11/26 직접 타 보니) 타는 동안 매 프레임 공용 goto를 쓰면 한 프레임 늦게 적용되고 그 사이 중력이 쌓여 캐릭터가 덜컹이고 도착 뒤 0.3m 튀었음
//   → 캐릭터 프레임 안에서 위치를 놓고 속도를 0으로 만드는 requestPalaceWarp로 붙잡음 (몸통 가운데 높이 = 바닥 + 1.6, goto exact와 같은 자리)
const holdAt = (x, floorY, z) => requestPalaceWarp([x, floorY + 1.6, z])

// 같은 입력이면 같은 0~1 난수 (kit의 seeded는 난수 '함수'를 돌려줌 → 숫자로 한 번 뽑음)
const srand = (n) => seeded(Math.round(n * 9973) + 7)()


// 애니 구역(JM) 「센과 치히로의 행방불명」 배경 마을 (11/25 지민 요청: 교토 대신 영화 속 마을로 구역 전체를 다시) — 담당: 지민
// 영화 순서: 붉은 탑 터널 → 풀밭 언덕 → 마른 강(징검돌) → 돌계단 → 텅 빈 음식점 거리(붉은 등·간판) → 붉은 다리(밑은 바다 위 철길)
//   → 온천장. 온천장 옆 바깥 계단을 내려가면 맨 아래 보일러실, 안에는 층을 오가는 엘리베이터
// 참고: 영화 장면 설명·공개 스틸 + 실제 모델로 알려진 곳(지우펀 붉은 등 골목, 도고 온천 본관, 에도도쿄 건축원 다케이 산쇼도 약방 서랍장)
// 캐릭터·영화 그림·영화 속 간판 글자는 넣지 않음. 간판은 우리가 지은 가게 이름만
// 앞면 = 로컬 +z. 걷는 판정은 생성 스크립트(gen-jm-kyoto.mjs)가 jmCollider·건물 상자로

const range = (n) => Array.from({ length: n }, (_, i) => i)
// 텍스처를 반복해서 붙이기 (복제본에 repeat)
function tiled(base, rx, ry) {
  const t = base.clone()
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.needsUpdate = true
  return t
}

const STONE = mat('#8e877c', { roughness: 1 })
const DARK = mat('#2a1a12', { roughness: 0.9 })
const WOOD = mat('#5e4130', { roughness: 0.85 })
const IRON = mat('#23201d', { roughness: 0.55, metalness: 0.4 })
const BRASS = mat('#b8913c', { roughness: 0.4, metalness: 0.6 })
const INNER_GLOW = mat('#ffcf8a', { emissive: '#ff9a3c', emissiveIntensity: 0.9, roughness: 0.7 })
const LANTERN_RED = mat('#ad4e38', { emissive: '#ff4a22', emissiveIntensity: 1.1, roughness: 0.6 })
const LANTERN_WHITE = mat('#fff1d6', { emissive: '#ffcf7a', emissiveIntensity: 1.0, roughness: 0.6 })
const LANTERN_CAP = mat('#1b1210')
const BOWL = mat('#f1e8d6', { roughness: 0.5 })
const STEAM = mat('#ffffff', { transparent: true, opacity: 0.22, roughness: 1 })
const WALL_LAMP = mat('#ff9ab8', { emissive: '#ff5a8a', emissiveIntensity: 1.4 })
const FIRE = mat('#ff8a2a', { emissive: '#ff5a10', emissiveIntensity: 2.0 })
// (11/26 지민이 보낸 거리·가게 장면 참고) 붉은 천 차양, 초록 칠 기둥, 파란 의자, 선반 항아리·접시, 음식 산더미
const AWNING = mat('#a44c38', { roughness: 0.9, double: true })
const AWNING_D = mat('#9a2a20', { roughness: 0.9, double: true })
const POST_GREEN = mat('#4f8f6a', { roughness: 0.8 })
const STOOL_BLUE = mat('#2f5a7f', { roughness: 0.6 })
const JAR = mat('#5a2e22', { roughness: 0.5 })
const JAR_LABEL = mat('#b1675f', { roughness: 0.7 })
const PLATE_RIM = mat('#3a6f9a', { roughness: 0.4 })
const BAMBOO = mat('#b08a55', { roughness: 0.8 })
const LAMP_SHADE = mat('#2f3a33', { roughness: 0.6, double: true })
const BULB = mat('#fff3d0', { emissive: '#ffd890', emissiveIntensity: 1.6 })
const FOODS = {
  dumpling: mat('#e8b58c', { roughness: 0.6 }),
  stick: mat('#c8c46c', { roughness: 0.6 }),
  ball: mat('#7a361d', { roughness: 0.45 }),
  fried: mat('#a8391f', { roughness: 0.7, flat: true }),
  tempura: mat('#e2a845', { roughness: 0.7, flat: true }),
  glazed: mat('#ab6a54', { roughness: 0.35, emissive: '#3a1004', emissiveIntensity: 0.3 }),
}

// 음식 산더미 가게 안 부엌 (11/26 지민이 보낸 가게 안 장면 2장 참고) — 카운터 너머로 보이는 방
//   왼쪽 벽: 벽돌 화덕(아치 불구멍 + 불빛) / 가운데 뒤: 살창 창(밝게) + 비스듬한 빛줄기, 그 위 둥근 환풍구 / 위: 나무 들보·대들보 + 갓 전등 3개
//   가운데: 나무 그루터기 도마(식칼·큰 칼), 뒤 ㄱ자 조리대(채소: 무·당근·양파, 감자 바구니) / 오른쪽: 걸린 국자들, 연통 후드 + 아궁이 불, 단지·냄비 선반
const BRICK = mat('#5a3424', { roughness: 0.95, flat: true })
const BRICK_D = mat('#3a2218', { roughness: 1 })
const KIT_WALL = mat('#6a4a2c', { roughness: 0.95 })
const KIT_FLOOR = mat('#3e2c1e', { roughness: 0.95 })
const BEAM_W = mat('#3a2616', { roughness: 0.9 })
const KWIN = mat('#f6ebc4', { emissive: '#ffe6a0', emissiveIntensity: 1.2 })
const KBEAM = new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
const STEEL = mat('#8e9296', { roughness: 0.35, metalness: 0.8 })
const STUMP = mat('#5e4430', { roughness: 0.95, flat: true })
const DAIKON = mat('#ece9de', { roughness: 0.6 })
const CARROT = mat('#d9692a', { roughness: 0.6 })
const ONION = mat('#c79a52', { roughness: 0.6 })
const POTATO = mat('#9a7a4a', { roughness: 0.9, flat: true })
const WICKER = mat('#8a6a3a', { roughness: 0.95 })
const POT = mat('#4a3a30', { roughness: 0.5, metalness: 0.2 })

function FeastKitchen({ w, d, base, fh, front, seed }) {
  const iw = w - 0.7 // 안쪽 폭
  const back = -d / 2 + 0.35 // 뒤 벽 안쪽 면
  const zc = (back + front - 1.0) / 2
  const depth = front - 1.0 - back
  const ceil = base + fh - 0.1
  const potatoes = useMemo(() => range(14).map((i) => [srand(seed + i) * 0.5 - 0.25, srand(seed * 3 + i) * 0.5 - 0.25, 0.06 + srand(i * 7) * 0.03]), [seed])
  return (
    <group>
      {/* 방 껍데기: 바닥·뒤 벽·옆 벽·천장 */}
      <Box p={[0, base + 0.02, zc]} s={[iw, 0.04, depth]} m={KIT_FLOOR} />
      <Box p={[0, base + fh / 2, back - 0.02]} s={[iw, fh, 0.04]} m={KIT_WALL} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (iw / 2 + 0.02), base + fh / 2, zc]} s={[0.04, fh, depth]} m={KIT_WALL} />
      ))}
      <Box p={[0, ceil, zc]} s={[iw, 0.06, depth]} m={BEAM_W} />
      {/* 들보: 가로 대들보 + 세로 기둥 + 빗댄 버팀 */}
      {[zc - depth * 0.25, zc + depth * 0.2].map((z, i) => (
        <group key={`bm${i}`}>
          <Box p={[0, ceil - 0.25, z]} s={[iw, 0.18, 0.18]} m={BEAM_W} />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * iw * 0.18, ceil - 0.6, z]} s={[0.07, 0.6, 0.07]} r={[0, 0, s * 0.6]} m={BEAM_W} />
          ))}
        </group>
      ))}
      <Box p={[iw * 0.08, base + fh / 2, back + 0.6]} s={[0.16, fh, 0.16]} m={BEAM_W} />
      {/* 뒤 벽 살창 창 (밝게) + 비스듬한 빛줄기 + 둥근 환풍구 */}
      <group position={[-iw * 0.12, base + 1.75, back + 0.01]}>
        <Box p={[0, 0, 0]} s={[1.8, 0.85, 0.02]} m={KWIN} />
        {range(7).map((i) => (
          <Box key={`wv${i}`} p={[-0.9 + i * 0.3, 0, 0.02]} s={[0.035, 0.85, 0.02]} m={BEAM_W} />
        ))}
        {range(3).map((i) => (
          <Box key={`wh${i}`} p={[0, -0.42 + i * 0.42, 0.02]} s={[1.8, 0.035, 0.02]} m={BEAM_W} />
        ))}
        <group position={[-1.35, 0.85, 0.02]}>
          <Box p={[0, 0, -0.01]} s={[0.55, 0.55, 0.03]} m={BEAM_W} />
          <mesh material={KWIN}>
            <circleGeometry args={[0.22, 16]} />
          </mesh>
          {range(6).map((k) => (
            <Box key={k} p={[0, 0, 0.02]} s={[0.44, 0.05, 0.01]} r={[0, 0, (k * Math.PI) / 6]} m={BEAM_W} />
          ))}
        </group>
      </group>
      {[[-0.6, 0.55], [0.35, 0.45]].map(([dx, wd], i) => (
        <mesh key={`kb${i}`} position={[-iw * 0.12 + dx + 0.4, base + fh * 0.55, back + depth * 0.35]} rotation={[-0.75, 0, 0.12]} material={KBEAM}>
          <planeGeometry args={[wd, fh * 1.2]} />
        </mesh>
      ))}
      {/* 왼쪽 벽: 벽돌 화덕 + 아치 불구멍 */}
      <group position={[-iw / 2 + 0.75, base, zc - depth * 0.1]}>
        <Box p={[0, 0.55, 0]} s={[1.3, 1.1, 1.8]} m={BRICK} />
        <Box p={[0, 1.6, 0]} s={[1.1, 1.0, 1.6]} m={BRICK} />
        <Box p={[0.66, 1.15, 0]} s={[0.02, 0.6, 1.0]} m={BRICK_D} />
        <mesh position={[0.67, 1.45, 0]} rotation={[0, Math.PI / 2, 0]} material={BRICK_D}>
          <circleGeometry args={[0.5, 16, 0, Math.PI]} />
        </mesh>
        <mesh position={[0.68, 1.1, 0]} rotation={[0, Math.PI / 2, 0]} material={FIRE}>
          <planeGeometry args={[0.8, 0.35]} />
        </mesh>
        <Box p={[0, 2.7, 0]} s={[1.4, 0.12, 2.0]} m={BRICK_D} />
        <pointLight position={[1.1, 1.3, 0]} color="#ff8a3a" intensity={3} distance={4} decay={2} />
      </group>
      {/* 뒤 ㄱ자 조리대 + 채소 + 감자 바구니 */}
      <group position={[0, base, back + 0.45]}>
        <Box p={[0, 0.48, 0]} s={[iw - 2.6, 0.96, 0.7]} m={BEAM_W} />
        <Box p={[0, 0.98, 0]} s={[iw - 2.5, 0.05, 0.78]} c="#7a5a3a" />
        <mesh position={[-0.8, 1.06, 0.05]} rotation={[0, 0, Math.PI / 2]} material={DAIKON}>
          <cylinderGeometry args={[0.07, 0.05, 0.55, 8]} />
        </mesh>
        {[0, 1].map((k) => (
          <mesh key={`cr${k}`} position={[-0.35 + k * 0.12, 1.04, 0.12]} rotation={[0, k * 0.5, Math.PI / 2]} material={CARROT}>
            <coneGeometry args={[0.04, 0.3, 6]} />
          </mesh>
        ))}
        {[0, 1, 2].map((k) => (
          <mesh key={`on${k}`} geometry={GEO.sphere} position={[0.05 + k * 0.14, 1.06, 0.0 + (k % 2) * 0.1]} scale={[0.06, 0.07, 0.06]} material={ONION} />
        ))}
        <group position={[-iw / 2 + 2.2, 0, 0.6]}>
          <Cyl p={[0, 0.25, 0]} rad={0.32} h={0.5} m={WICKER} />
          {potatoes.map(([x, z, r], i) => (
            <mesh key={i} geometry={GEO.ico} position={[x, 0.5 + (i % 3) * 0.04, z]} scale={r} material={POTATO} />
          ))}
        </group>
      </group>
      {/* 가운데: 그루터기 도마 + 식칼·큰 칼 */}
      <group position={[-iw * 0.12, base, zc + depth * 0.15]}>
        <Cyl p={[0, 0.42, 0]} rad={0.42} h={0.84} m={STUMP} />
        <Box p={[0.12, 1.0, 0.05]} s={[0.3, 0.32, 0.03]} r={[0, 0.4, 0.2]} m={STEEL} />
        <Box p={[0.3, 1.0, 0.02]} s={[0.24, 0.05, 0.05]} r={[0, 0.4, 0.2]} m={BEAM_W} />
        <Box p={[-0.15, 1.05, -0.05]} s={[0.05, 0.4, 0.015]} r={[0.15, 0, -0.08]} m={STEEL} />
        <Box p={[-0.17, 1.33, -0.02]} s={[0.04, 0.18, 0.04]} r={[0.15, 0, -0.08]} m={BEAM_W} />
      </group>
      {/* 오른쪽: 연통 후드 + 아궁이 불, 걸린 국자들, 단지·냄비 선반 */}
      <group position={[iw / 2 - 0.8, base, zc - depth * 0.05]}>
        <Box p={[0, 0.45, 0]} s={[1.3, 0.9, 1.9]} m={BRICK} />
        <mesh position={[-0.66, 0.42, 0.2]} rotation={[0, -Math.PI / 2, 0]} material={FIRE}>
          <planeGeometry args={[0.4, 0.25]} />
        </mesh>
        <Cyl p={[0, 0.98, -0.35]} rad={0.32} h={0.18} m={POT} />
        <Cyl p={[0, 0.98, 0.45]} rad={0.26} h={0.22} m={STEEL} />
        <Box p={[-0.1, fh - 0.75, 0]} s={[1.5, 0.5, 2.1]} m={BRICK_D} />
        <Box p={[0, fh - 0.3, 0]} s={[0.5, 0.6, 0.5]} m={BRICK_D} />
        <Box p={[-0.7, 2.25, 0]} s={[0.04, 0.04, 1.6]} m={IRON} />
        {range(4).map((k) => (
          <group key={`ld${k}`} position={[-0.72, 2.25, -0.6 + k * 0.4]}>
            <Box p={[0, -0.35, 0]} s={[0.02, 0.7, 0.02]} m={IRON} />
            {k === 2 ? (
              <Box p={[0, -0.8, 0]} s={[0.02, 0.22, 0.14]} m={STEEL} />
            ) : (
              <mesh geometry={GEO.sphere} position={[0, -0.75, 0]} scale={[0.06, 0.05, 0.1]} material={IRON} />
            )}
          </group>
        ))}
        <Box p={[0.5, 1.75, 0]} s={[0.35, 0.04, 1.9]} c="#4a3626" />
        {range(4).map((k) => (
          <Cyl key={`pt${k}`} p={[0.5, 1.88, -0.7 + k * 0.45]} rad={0.12 + (k % 2) * 0.04} h={0.22} m={k % 2 ? JAR : POT} />
        ))}
      </group>
      {/* 갓 전등 3개 (긴 줄) */}
      {[-0.3, 0.05, 0.35].map((t, i) => (
        <group key={`pl${i}`} position={[t * iw, ceil - 0.05, zc - depth * 0.15 + i * 0.4]}>
          <Box p={[0, -0.55, 0]} s={[0.015, 1.1, 0.015]} m={IRON} />
          <mesh position={[0, -1.12, 0]} material={LAMP_SHADE}>
            <coneGeometry args={[0.32, 0.16, 16, 1, true]} />
          </mesh>
          <mesh position={[0, -1.2, 0]} material={BULB}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, ceil - 1.2, zc]} color="#ffcf8a" intensity={4} distance={7} decay={1.8} />
    </group>
  )
}

// 큰 접시 위 음식 산더미 (돔 모양으로 쌓음) — kind: dumpling | stick | ball | fried | tempura
function FoodMound({ p, r = 0.55, kind = 'dumpling', seed = 1 }) {
  const items = useMemo(() => {
    const out = []
    let k = 0
    const layers = 5
    for (let l = 0; l < layers; l++) {
      const lr = r * (1 - l / layers) * 0.92
      const n = Math.max(1, Math.round((lr * 2 * Math.PI) / (kind === 'stick' ? 0.09 : kind === 'glazed' ? 0.12 : 0.16)))
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + l * 0.37 + seed
        out.push({ x: Math.cos(a) * lr, z: Math.sin(a) * lr, y: 0.09 + l * (kind === 'stick' ? 0.07 : kind === 'glazed' ? 0.1 : 0.085), a, k: k++ })
      }
    }
    return out
  }, [r, kind, seed])
  const m = FOODS[kind]
  return (
    <group position={p}>
      {/* 무늬 접시: 흰 바탕 + 파란 테 */}
      <Cyl p={[0, 0.03, 0]} rad={r + 0.12} h={0.05} m={BOWL} />
      <Cyl p={[0, 0.045, 0]} rad={r + 0.14} h={0.03} m={PLATE_RIM} />
      {items.map(({ x, y, z, a, k }) =>
        kind === 'stick' || kind === 'glazed' ? (
          <mesh key={k} position={[x, y + 0.03, z]} rotation={[0, -a, 0.9]} material={m} scale={kind === 'glazed' ? [1.9, 1.3, 1.9] : 1}>
            <cylinderGeometry args={[0.03, kind === 'glazed' ? 0.022 : 0.03, 0.2, 6]} />
          </mesh>
        ) : kind === 'fried' || kind === 'tempura' ? (
          <mesh key={k} geometry={GEO.ico} position={[x, y, z]} rotation={[a, a * 2, 0]} scale={[0.09, 0.06, 0.11]} material={m} />
        ) : (
          <mesh key={k} geometry={GEO.sphere} position={[x, y, z]} scale={kind === 'ball' ? [0.065, 0.06, 0.065] : [0.085, 0.065, 0.08]} material={m} />
        ),
      )}
    </group>
  )
}

// 가게 안 진열: 음식 산더미 줄 + 대나무 찜통(김) + 갓 달린 전등 (item.feast)
function FeastCounter({ w, y, z, seed }) {
  const kinds = ['glazed', 'dumpling', 'stick', 'ball', 'tempura', 'glazed', 'fried']
  const n = Math.max(3, Math.min(5, Math.floor((w - 1.6) / 1.25)))
  return (
    <group>
      {range(n).map((i) => (
        <FoodMound key={i} p={[-((n - 1) * 1.25) / 2 + i * 1.25, y, z + (i % 2) * 0.12]} r={0.5} kind={kinds[(i + seed) % kinds.length]} seed={i + 1} />
      ))}
      <group position={[w / 2 - 0.9, y, z - 0.05]}>
        <Cyl p={[0, 0.17, 0]} rad={0.45} h={0.34} m={BAMBOO} />
        <Cyl p={[0, 0.5, 0]} rad={0.45} h={0.3} m={BAMBOO} />
        <Cyl p={[0, 0.69, 0]} rad={0.47} h={0.08} m={BAMBOO} />
        <Box p={[0, 0.78, 0]} s={[0.3, 0.06, 0.04]} m={IRON} />
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[0.1 * k - 0.1, 1.0 + k * 0.32, 0.05 * k]} scale={[0.25 + k * 0.12, 0.15 + k * 0.05, 0.25 + k * 0.12]} material={STEAM}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * w * 0.22, y + 1.75, z - 0.2]}>
          <Box p={[0, 0.45, 0]} s={[0.02, 0.6, 0.02]} m={IRON} />
          <mesh position={[0, 0.1, 0]} material={LAMP_SHADE}>
            <coneGeometry args={[0.42, 0.22, 16, 1, true]} />
          </mesh>
          <mesh position={[0, 0.0, 0]} material={BULB}>
            <sphereGeometry args={[0.08, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// 건물 벽색 (붉은 칠·짙은 나무·황토·크림·초록) + 지붕색
const WALLS = ['#8f2b22', '#5a3a26', '#b88a3e', '#e3d6b8', '#3f5d4c', '#7a2f4a']
const ROOFS = ['#2e3236', '#3f6e58', '#2e3236', '#5b2b22']
const COPPER = '#5f9a84'
// (11/25 지민이 보낸 거리 장면 참고) 파스텔 서양식 외벽: 민트·황토·분홍보라·연하늘, 테라코타 기와
const PASTELS = ['#86c7a8', '#d9b45e', '#b9719a', '#9cc3d6', '#e6c88f']
const TERRACOTTA = '#b8603e'

// 층마다 불 켜진 격자창 띠 그림 (한 장을 여러 건물이 나눠 씀)
function windowStripTexture(kind) {
  return canvasTexture(`jmspirit:win:${kind}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2a1a12'
    ctx.fillRect(0, 0, w, h)
    const cols = kind === 'round' ? 4 : kind === 'arch' ? 5 : 8
    const cw = w / cols
    for (let i = 0; i < cols; i++) {
      const x = i * cw + cw * 0.1
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#ffe2a8')
      g.addColorStop(1, '#ffb45c')
      ctx.fillStyle = g
      if (kind === 'arch') {
        ctx.beginPath()
        ctx.moveTo(x, h * 0.92)
        ctx.lineTo(x, h * 0.42)
        ctx.arc(x + cw * 0.4, h * 0.42, cw * 0.4, Math.PI, 0)
        ctx.lineTo(x + cw * 0.8, h * 0.92)
        ctx.fill()
      } else if (kind === 'round') {
        ctx.beginPath()
        ctx.arc(x + cw * 0.4, h / 2, Math.min(cw, h) * 0.36, 0, Math.PI * 2)
        ctx.fill()
      } else ctx.fillRect(x, h * 0.14, cw * 0.8, h * 0.72)
      ctx.strokeStyle = '#3a2416'
      ctx.lineWidth = 3
      for (let k = 1; k < 3; k++) {
        ctx.beginPath()
        ctx.moveTo(x + (cw * 0.8 * k) / 3, h * 0.14)
        ctx.lineTo(x + (cw * 0.8 * k) / 3, h * 0.86)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(x, h / 2)
      ctx.lineTo(x + cw * 0.8, h / 2)
      ctx.stroke()
    }
  })
}

// 색유리 아치 창 (마름모 색유리)
function stainedTexture() {
  return canvasTexture('jmspirit:stained', 128, 160, (ctx, w, h) => {
    ctx.fillStyle = '#2a1a12'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(6, h - 6)
    ctx.lineTo(6, w / 2)
    ctx.arc(w / 2, w / 2, w / 2 - 6, Math.PI, 0)
    ctx.lineTo(w - 6, h - 6)
    ctx.closePath()
    ctx.clip()
    const cols = ['#e8b04a', '#bf7070', '#4f8fd9', '#59b36b', '#f2a3c0']
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      ctx.fillStyle = cols[(r + c * 2) % cols.length]
      ctx.beginPath()
      const cx = c * 32 + (r % 2) * 16
      const cy = r * 22
      ctx.moveTo(cx, cy - 16)
      ctx.lineTo(cx + 16, cy)
      ctx.lineTo(cx, cy + 16)
      ctx.lineTo(cx - 16, cy)
      ctx.fill()
      ctx.strokeStyle = '#2a1a12'
      ctx.lineWidth = 3
      ctx.stroke()
    }
    ctx.restore()
  })
}

// 붉은 등(초친) 하나: 몸통 + 위아래 검은 테
function Chochin({ p, r = 0.28, h = 0.62, white = false }) {
  return (
    <group position={p}>
      <mesh geometry={GEO.sphere} material={white ? LANTERN_WHITE : LANTERN_RED} scale={[r, h / 2, r]} />
      <Cyl p={[0, h / 2 - 0.02, 0]} rad={r * 0.55} h={0.08} m={LANTERN_CAP} />
      <Cyl p={[0, -h / 2 + 0.02, 0]} rad={r * 0.55} h={0.08} m={LANTERN_CAP} />
    </group>
  )
}

// ── 음식점 (텅 빈 음식점 거리) ─────────────────
// item.size [w(앞면 폭), h, d], item.floors 2|3, item.seed, item.sign { text, bg, fg }(가로 큰 간판), item.vsign(세로 간판 글자)
// item.noren(1층 노렌 짧은 글자), item.look 'wood' | 'retro'(구리 초록 서양식 앞면)
// 1층 앞면은 트여 있고 카운터에 음식 그릇, 처마 밑에 붉은 등 줄. 위층은 불 켜진 창
export function JmEatery({ item }) {
  const [w, h, d] = item.size
  const seed = item.seed ?? 0
  const floors = item.floors ?? 2
  const look = item.look ?? 'wood'
  const base = 0.3
  const roofH = look === 'retro' ? 0.8 : 1.7
  const fh = (h - base - roofH) / floors
  const front = d / 2
  const pastel = look === 'pastel'
  const wall = pastel ? PASTELS[seed % PASTELS.length] : WALLS[seed % WALLS.length]
  const roofC = pastel ? TERRACOTTA : ROOFS[seed % ROOFS.length]
  const roof = useMemo(() => hipRoofGeometry(w + 0.9, d + 0.9, roofH, 0.2), [w, d, roofH])
  const eave = useMemo(() => hipRoofGeometry(w + 0.6, 2.4, 0.55, 0.06), [w])
  const winTex = windowStripTexture(pastel ? 'arch' : seed % 3 === 0 ? 'round' : 'lattice')
  const bowls = useMemo(() => {
    const out = []
    const n = Math.max(3, Math.floor((w - 2) / 0.55))
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * 0.55) / 2 + i * 0.55
      out.push({ p: [x, base + 1.08, front - 1.25 + (i % 2) * 0.18], s: [0.17 + srand(seed * 13 + i) * 0.06, 0.08, 0.17] })
    }
    return out
  }, [w, front, seed])
  // (11/26 지민 요청: 등불이 너무 많음) 처마 밑 등은 두 집에 한 집만, 간격도 넓게
  const lanterns = seed % 2 === 0 ? Math.max(2, Math.floor(w / 2.4)) : 0
  const g1 = base + fh // 1층 천장
  return (
    <group>
      <Box p={[0, base / 2, 0]} s={[w, base, d]} m={STONE} />
      {/* 1층: 옆·뒤 벽 + 천장, 앞면은 트임 (안쪽 깊이 d-1) */}
      {item.feast ? (
        <FeastKitchen w={w} d={d} base={base} fh={fh} front={front} seed={seed} />
      ) : (
        <>
          <Box p={[0, base + fh / 2, -0.5]} s={[w, fh, d - 1]} m={DARK} />
          <mesh position={[0, base + fh * 0.5, front - 1.02]}>
            <planeGeometry args={[w - 0.5, fh - 0.4]} />
            <primitive object={INNER_GLOW} attach="material" />
          </mesh>
        </>
      )}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (w / 2 - 0.15), base + fh / 2, front - 0.5]} s={[0.3, fh, 1]} c={wall} />
      ))}
      {/* 카운터 + 그릇 */}
      <Box p={[0, base + 0.5, front - 1.3]} s={[w - 1.2, 1.0, 0.6]} c="#4a2f1f" />
      <Box p={[0, base + 1.02, front - 1.3]} s={[w - 1.1, 0.05, 0.75]} c="#2b1d14" />
      <Instances geometry={GEO.cyl} material={BOWL} items={bowls} />
      {/* (11/25 밤) 가게 안 디테일: 벽에 걸린 나무 메뉴 패, 카운터 위 김 나는 큰 솥, 카운터 앞 나무 의자, 문 옆 화분 */}
      {range(Math.max(3, Math.floor((w - 2) / 0.7))).map((i, _, arr) => (
        <Box key={`mn${i}`} p={[-(arr.length - 1) * 0.35 + i * 0.7, g1 - 0.9, front - 1.95]} s={[0.5, 0.75, 0.03]} c={i % 3 === 0 ? '#e9d8b0' : '#d9c08a'} />
      ))}
      <group position={[(seed % 2 ? -1 : 1) * (w / 2 - 1.3), base + 1.05, front - 1.35]}>
        <Cyl p={[0, 0.22, 0]} rad={0.32} h={0.44} m={IRON} />
        <Cyl p={[0, 0.46, 0]} rad={0.34} h={0.05} c="#3a3430" />
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0.05 * k, 0.75 + k * 0.32, 0]} scale={[0.22 + k * 0.1, 0.16 + k * 0.05, 0.22 + k * 0.1]} material={STEAM}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
      </group>
      {/* 카운터 앞 파란 둥근 의자 (다리 셋) */}
      {range(Math.max(2, Math.floor((w - 2) / 1.1))).map((i, _, arr) => (
        <group key={`st${i}`} position={[-(arr.length - 1) * 0.55 + i * 1.1, base, front - 0.7]}>
          <Cyl p={[0, 0.68, 0]} rad={0.19} h={0.08} m={STOOL_BLUE} />
          {[0, 1, 2].map((k) => (
            <Box key={k} p={[Math.cos((k * Math.PI * 2) / 3) * 0.1, 0.32, Math.sin((k * Math.PI * 2) / 3) * 0.1]} s={[0.035, 0.66, 0.035]} r={[Math.sin((k * Math.PI * 2) / 3) * 0.12, 0, -Math.cos((k * Math.PI * 2) / 3) * 0.12]} c="#3a2a1c" />
          ))}
          <Box p={[0, 0.25, 0]} s={[0.22, 0.03, 0.03]} c="#3a2a1c" />
        </group>
      ))}
      {/* 뒤 선반: 붉은 띠 두른 항아리·포갠 접시·젓가락 통 */}
      <group position={[0, base, front - 2.35]}>
        <Box p={[0, 1.35, 0]} s={[w - 0.8, 0.06, 0.45]} c="#3a6f6a" />
        <Box p={[0, 2.2, 0]} s={[w - 0.8, 0.06, 0.45]} c="#3a6f6a" />
        {range(Math.max(3, Math.floor((w - 1.2) / 0.55))).map((i, _, arr) => {
          const x = -((arr.length - 1) * 0.55) / 2 + i * 0.55
          const top = (i + seed) % 3 !== 0
          return (
            <group key={`jr${i}`} position={[x, top ? 2.23 : 1.38, 0]}>
              {(i + seed) % 4 === 1 ? (
                [0, 1, 2, 3, 4].map((k) => <Cyl key={k} p={[0, 0.03 + k * 0.035, 0]} rad={0.17} h={0.025} m={BOWL} />)
              ) : (
                <>
                  <mesh geometry={GEO.sphere} position={[0, 0.2, 0]} scale={[0.18, 0.21, 0.18]} material={JAR} />
                  <Cyl p={[0, 0.42, 0]} rad={0.09} h={0.08} m={JAR} />
                  <Cyl p={[0, 0.24, 0]} rad={0.185} h={0.06} m={JAR_LABEL} />
                </>
              )}
            </group>
          )
        })}
      </group>
      {/* 초록 칠 기둥 (앞면) */}
      {range(Math.max(2, Math.round(w / 2.6)) + 1).map((i, _, arr) => (
        <group key={`gp${i}`} position={[-w / 2 + 0.2 + (i * (w - 0.4)) / (arr.length - 1), base, front + 0.75]}>
          <Box p={[0, fh / 2, 0]} s={[0.18, fh, 0.18]} m={POST_GREEN} />
          <Box p={[0, 0.1, 0]} s={[0.28, 0.2, 0.28]} m={STONE} />
        </group>
      ))}
      {item.feast && <FeastCounter w={w} y={base + 1.05} z={front - 1.3} seed={seed} />}
      <group position={[(seed % 2 ? 1 : -1) * (w / 2 - 0.35), base, front + 0.6]}>
        <Cyl p={[0, 0.22, 0]} rad={0.22} h={0.44} c="#8a5a3a" />
        <mesh geometry={GEO.ico} position={[0, 0.7, 0]} scale={0.36}>
          <meshStandardMaterial color="#4f7a34" flatShading />
        </mesh>
      </group>
      {pastel && (
        <group>
          {range(Math.floor(w / 2.4) + 1).map((i, _, arr) => (
            <Cyl key={i} p={[-w / 2 + 0.3 + (i * (w - 0.6)) / (arr.length - 1), base + fh / 2, front - 0.1]} rad={0.2} h={fh} c={wall} />
          ))}
          <Box p={[0, g1 - 0.35, front - 0.1]} s={[w, 0.7, 0.4]} c={wall} />
        </group>
      )}
      {/* 노렌 */}
      {/* 붉은 천 차양: 처마 끝에서 늘어진 천 조각 줄 (앞면 전체) + 가운데에 노렌 글자 */}
      {range(Math.max(4, Math.round(w / 0.75))).map((i, _, arr) => {
        const pw = (w + 0.2) / arr.length
        const len = 0.85 + srand(seed * 31 + i) * 0.2
        return (
          <mesh key={`aw${i}`} position={[-w / 2 - 0.1 + pw * (i + 0.5), g1 - len / 2 - 0.02, front + 0.95]} rotation={[0.18, 0, 0]} material={i % 5 === 2 ? AWNING_D : AWNING}>
            <planeGeometry args={[pw - 0.04, len]} />
          </mesh>
        )
      })}
      {item.noren && (
        <mesh position={[0, g1 - 0.5, front + 0.97]} rotation={[0.18, 0, 0]}>
          <planeGeometry args={[Math.min(w - 1.2, 2.4), 0.75]} />
          <GlowMaterial glow={0.2} map={getJpSignTexture(item.noren, '#a44c38', '#f5ead8', Math.min(w - 1.2, 2.4) / 0.75)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 1층 처마 + 붉은 등 줄 */}
      <mesh geometry={eave} position={[0, g1, front]}>
        <meshStandardMaterial color={roofC} flatShading side={THREE.DoubleSide} />
      </mesh>
      {range(lanterns).map((i) => (
        <Chochin key={i} p={[-w / 2 + 0.6 + (i * (w - 1.2)) / Math.max(1, lanterns - 1), g1 - 0.45, front + 0.35]} white={(i + seed) % 4 === 3} />
      ))}
      {/* 위층 몸통 + 창 띠 + 발코니 */}
      <Box p={[0, g1 + (fh * (floors - 1)) / 2, -0.1]} s={[w - 0.1, fh * (floors - 1), d - 0.2]} c={wall} />
      {range(floors - 1).map((k) => {
        const y = g1 + fh * k + fh * 0.5
        return (
          <group key={k}>
            <mesh position={[0, y, front - 0.19]}>
              <planeGeometry args={[w - 1, fh * 0.48]} />
              <primitive object={texMat(winTex, { emissive: '#ffffff', emissiveIntensity: 0.55 })} attach="material" />
            </mesh>
            <Box p={[0, g1 + fh * k + 0.08, front - 0.1]} s={[w, 0.16, 0.25]} c="#2b1d14" />
            {(seed + k) % 2 === 0 && (
              <group position={[0, g1 + fh * k, front + 0.3]}>
                <Box p={[0, 0.05, -0.2]} s={[w - 1.6, 0.1, 0.8]} c="#4a2f1f" />
                <Box p={[0, 0.95, 0.15]} s={[w - 1.6, 0.08, 0.08]} c="#a24a36" />
                {range(Math.round((w - 1) / 0.7)).map((i, _, arr) => (
                  <Box key={i} p={[-(w - 1.6) / 2 + (i * (w - 1.6)) / Math.max(1, arr.length - 1), 0.5, 0.15]} s={[0.07, 0.9, 0.07]} c="#a24a36" />
                ))}
              </group>
            )}
          </group>
        )
      })}
      {/* 가로 큰 간판 (1층 처마 위) */}
      {item.sign && (
        <group position={[0, g1 + 1.3, front + 0.4]}>
          <Box p={[0, 0, -0.06]} s={[Math.min(w - 0.6, 5.6) + 0.2, 1.2, 0.1]} m={DARK} />
          <mesh>
            <planeGeometry args={[Math.min(w - 0.6, 5.6), 1.0]} />
            <GlowMaterial glow={0.6} map={getJpSignTexture(item.sign.text, item.sign.bg ?? '#f4ead2', item.sign.fg ?? '#2a1a10', Math.min(w - 0.6, 5.6))} />
          </mesh>
        </group>
      )}
      {item.vsign && <VerticalSign text={item.vsign} p={[(seed % 2 ? 1 : -1) * (w / 2 + 0.3), g1 + fh * 0.7, front + 0.9]} h={Math.min(3.4, fh * (floors - 1) + 0.6)} bg={seed % 3 === 1 ? '#7a1d12' : '#f4ead2'} fg={seed % 3 === 1 ? '#fdf6e3' : '#2a1a10'} />}
      {/* 지붕: 기와 / 서양식 앞면(구리 초록 판 + 위 장식) */}
      {pastel ? (
        <group>
          <mesh geometry={roof} position={[0, h - roofH, -0.3]}>
            <meshStandardMaterial color={roofC} flatShading side={THREE.DoubleSide} />
          </mesh>
          <Box p={[0, h - roofH + 0.9, front - 0.1]} s={[w + 0.1, 1.8, 0.3]} c={wall} />
          <mesh position={[0, h - roofH + 1.8, front - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w * 0.28, w * 0.28, 0.3, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={wall} />
          </mesh>
          <mesh position={[0, h - roofH + 1.75, front + 0.06]}>
            <circleGeometry args={[0.45, 20]} />
            <meshStandardMaterial color="#ffe2a8" emissive="#ffb45c" emissiveIntensity={0.7} />
          </mesh>
          {[-1, 1].map((sx) => (
            <Box key={sx} p={[sx * w * 0.3, h - roofH + 1.2, front + 0.08]} s={[0.5, 0.5, 0.06]} r={[0, 0, Math.PI / 4]} c="#f0e6c8" />
          ))}
        </group>
      ) : look === 'retro' ? (
        <group>
          <Box p={[0, h - roofH / 2, -0.1]} s={[w, roofH, d - 0.2]} c="#3a3430" />
          <Box p={[0, h - 0.2, front + 0.02]} s={[w + 0.2, 2.6, 0.3]} c={COPPER} />
          <Box p={[0, h + 1.15, front + 0.02]} s={[w * 0.4, 0.5, 0.3]} c={COPPER} />
          <Box p={[0, h + 0.85, front + 0.2]} s={[w + 0.3, 0.12, 0.12]} m={BRASS} />
          <Ball p={[0, h + 1.5, front + 0.02]} rad={0.25} m={BRASS} />
        </group>
      ) : (
        <mesh geometry={roof} position={[0, h - roofH, 0]}>
          <meshStandardMaterial color={roofC} flatShading side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* (11/25 거리 장면 참고) 분홍빛 벽 등 (까치발) + 파스텔 집은 2층 색유리 아치 창·꼬마전구 줄 */}
      {[-1, 1].map((s) => (
        <group key={`wl${s}`} position={[s * (w / 2 - 1.1), g1 + 0.9, front + 0.1]}>
          <Box p={[0, 0, 0.25]} s={[0.05, 0.05, 0.5]} m={IRON} />
          <Box p={[0, -0.25, 0.5]} s={[0.26, 0.42, 0.26]} m={WALL_LAMP} />
          <Box p={[0, -0.02, 0.5]} s={[0.32, 0.05, 0.32]} m={IRON} />
        </group>
      ))}
      {pastel && floors > 1 && (
        <group position={[0, g1 + fh * 0.5, front - 0.15]}>
          <mesh>
            <planeGeometry args={[1.6, 2.0]} />
            <meshStandardMaterial map={stainedTexture()} emissiveMap={stainedTexture()} emissive="#ffffff" emissiveIntensity={0.8} />
          </mesh>
          <Box p={[0, 0, -0.03]} s={[1.8, 2.2, 0.06]} c="#3a2416" />
        </group>
      )}
      {pastel && seed % 2 === 1 && range(Math.round(w / 0.6)).map((i) => (
        <Ball key={`sl${i}`} p={[-w / 2 + 0.3 + i * 0.6, h - roofH + 0.05 - Math.sin((i / Math.round(w / 0.6)) * Math.PI) * 0.25, front + 0.25]} rad={0.07} m={LANTERN_RED} />
      ))}
      {/* 문 옆 큰 등 한 쌍 (세 집에 한 집) */}
      {seed % 3 === 0 && [-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.45), base, front + 0.25]}>
          <Cyl p={[0, 0.9, 0]} rad={0.04} h={1.8} m={DARK} />
          <Chochin p={[0, 1.55, 0.15]} r={0.34} h={0.85} white={seed % 2 === 1} />
        </group>
      ))}
    </group>
  )
}

// ── 거리를 가로지르는 등 줄 ───────────────────
// item.size [len, h]: 로컬 x 방향으로 len, 높이 h에 늘어진 줄 + 1.4m마다 등
export function JmLanternLine({ item }) {
  const [len, h] = item.size
  const n = Math.max(2, Math.round(len / 1.4))
  const parts = useMemo(() => {
    const pts = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      pts.push([-len / 2 + len * t, h - Math.sin(Math.PI * t) * 0.6])
    }
    return pts
  }, [len, h, n])
  return (
    <group>
      {parts.slice(0, -1).map(([x, y], i) => {
        const [x2, y2] = parts[i + 1]
        const L = Math.hypot(x2 - x, y2 - y)
        return <Box key={i} p={[(x + x2) / 2, (y + y2) / 2, 0]} s={[L, 0.03, 0.03]} r={[0, 0, Math.atan2(y2 - y, x2 - x)]} m={DARK} />
      })}
      {parts.slice(1, -1).map(([x, y], i) => (
        <Chochin key={i} p={[x, y - 0.45, 0]} r={0.24} h={0.5} white={i % 3 === 1} />
      ))}
    </group>
  )
}

// ── 마을 입구 문 (돌계단 위) ───────────────────
// item.size [w, h, d], item.signs[0].text: 가운데 현판
export function JmTownGate({ item }) {
  const [w, h] = item.size
  const text = item.signs?.[0]?.text ?? '灯籠横丁'
  const roof = useMemo(() => hipRoofGeometry(w + 1.6, 2.4, 1.1, 0.2), [w])
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.4), 0, 0]}>
          <Box p={[0, 0.3, 0]} s={[1.1, 0.6, 1.1]} m={STONE} />
          <Cyl p={[0, h / 2, 0]} rad={0.34} h={h} c="#9e4634" />
          <Chochin p={[0, 2.4, 0.6]} r={0.38} h={0.95} />
        </group>
      ))}
      <Box p={[0, h - 1.2, 0]} s={[w, 0.4, 0.5]} c="#9e4634" />
      <Box p={[0, h - 0.2, 0]} s={[w + 0.8, 0.5, 0.7]} c="#2a1a12" />
      <mesh geometry={roof} position={[0, h, 0]}>
        <meshStandardMaterial color="#2e3236" flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* (11/26 점검) 간판: 양면 판 하나라 마을 안쪽에서 보면 글자가 거울처럼 뒤집혀 보였음 → 판 + 앞뒤 따로 글자 */}
      <Box p={[0, h - 2.2, 0]} s={[3.55, 1.32, 0.5]} c="#2a1a12" />
      {[1, -1].map((sd) => (
        <mesh key={`sg${sd}`} position={[0, h - 2.2, sd * 0.27]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[3.4, 1.2]} />
          <GlowMaterial glow={0.6} map={getJpSignTexture(text, '#2a1a12', '#f2c94c', 3.4 / 1.2)} />
        </mesh>
      ))}
      {range(4).map((i) => (
        <Chochin key={i} p={[-w / 2 + 1.6 + (i * (w - 3.2)) / 3, h - 1.75, 0.35]} r={0.3} h={0.6} white={i % 2 === 1} />
      ))}
    </group>
  )
}

// ── 바다 위 철길 (다리 밑 골짜기: 밤이면 물이 차오른 바다 위를 달리는 전차 길) ──
// item.size [폭, _, 길이] (로컬 z 방향 길이), item.train: 세워 둔 전차 한 량 위치(로컬 z) 또는 없음
export function JmSeaRail({ item }) {
  const [, , len] = item.size
  const sleepers = useMemo(() => {
    const out = []
    const n = Math.round(len / 0.9)
    for (let i = 0; i < n; i++) out.push({ p: [0, 0.18, -len / 2 + (i + 0.5) * (len / n)], s: [2.3, 0.1, 0.24] })
    return out
  }, [len])
  const poles = useMemo(() => range(Math.floor(len / 14) + 1).map((i) => -len / 2 + i * 14), [len])
  return (
    <group position={[0, item.submerged ? -0.32 : 0, 0]}>
      <Box p={[0, 0.06, 0]} s={[3.0, 0.12, len]} c="#6f6a62" />
      <Instances geometry={GEO.box} material={mat('#3b2e24')} items={sleepers} />
      {[-0.72, 0.72].map((x) => (
        <Box key={x} p={[x, 0.27, 0]} s={[0.08, 0.08, len]} m={IRON} />
      ))}
      {poles.map((z) => (
        <group key={z} position={[1.9, 0, z]}>
          <Cyl p={[0, 3, 0]} rad={0.09} h={6} c="#4a3a2c" />
          <Box p={[-0.8, 5.6, 0]} s={[1.8, 0.1, 0.1]} c="#4a3a2c" />
        </group>
      ))}
      <Box p={[1.1, 5.45, 0]} s={[0.02, 0.02, len]} m={IRON} />
      {item.train !== undefined && (
        <group position={[0, 0.3, item.train]}>
          <Box p={[0, 1.7, 0]} s={[2.5, 2.6, 11]} c="#7a2a24" />
          <Box p={[0, 0.5, 0]} s={[2.3, 0.5, 10.4]} m={IRON} />
          <Box p={[0, 3.1, 0]} s={[2.6, 0.25, 11.2]} c="#2e2a26" />
          <Box p={[0, 1.15, 0]} s={[2.54, 0.6, 11.04]} c="#e8dcc0" />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.26, 2.15, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
              <planeGeometry args={[10, 0.9]} />
              <primitive object={texMat(windowStripTexture('lattice'), { emissive: '#ffffff', emissiveIntensity: 0.7 })} attach="material" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <Ball key={`l${s}`} p={[0, 2.6, s * 5.52]} rad={0.18} m={LANTERN_WHITE} />
          ))}
          <Box p={[0, 3.6, 2]} s={[0.1, 0.8, 0.1]} m={IRON} />
          <Box p={[0, 4.0, 2]} s={[1.2, 0.06, 0.1]} m={IRON} />
        </group>
      )}
    </group>
  )
}

// ── 보일러실 (온천장 맨 아래, 바깥 계단으로 내려감) ──
// item.size [w, h, d], 앞(+z) = 물가 쪽. item.boiler = { door: {x, w, h}, furnace: [x, z], drawers: [x, z, w], deck: [x, z, w, d], chimney: [x, z, h] }
// 모티브: 영화 속 보일러실 (큰 화덕, 천장까지 닿는 약초 서랍장과 사다리, 석탄 더미, 천장 관). 캐릭터는 넣지 않음
const HERBS = ['薬草', '甘草', '桂皮', '生姜', '陳皮', '薄荷', '菖蒲', '柚子', '蓬', '笹', '松葉', '桜皮']
function drawerTexture() {
  return canvasTexture('jmspirit:drawers', 1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#3a2416'
    ctx.fillRect(0, 0, w, h)
    const cols = 16
    const rows = 10
    const cw = w / cols
    const rh = h / rows
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw
        const y = r * rh
        ctx.fillStyle = (r + c) % 2 ? '#7a5232' : '#6b462a'
        ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6)
        ctx.fillStyle = '#e9d8b0'
        ctx.fillRect(x + cw * 0.2, y + rh * 0.15, cw * 0.6, rh * 0.38)
        ctx.fillStyle = '#2a1a10'
        ctx.font = `bold ${Math.round(rh * 0.24)}px ${JP_FONT}`
        ctx.fillText(HERBS[(r * 7 + c * 3) % HERBS.length], x + cw / 2, y + rh * 0.34)
        ctx.fillStyle = '#c9a24a'
        ctx.beginPath()
        ctx.arc(x + cw / 2, y + rh * 0.72, rh * 0.08, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}
function flagTexture() {
  return canvasTexture('jmspirit:flag-ko', 192, 300, (ctx, w, h) => {
    ctx.fillStyle = '#f2ede2'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#1a1210'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(w / 2, h * 0.45, w * 0.36, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#1a1210'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.round(w * 0.42)}px ${JP_FONT}`
    ctx.fillText('湯', w / 2, h * 0.46)
    ctx.font = `bold ${Math.round(w * 0.16)}px "Malgun Gothic", sans-serif`
    ctx.fillText('온천', w / 2, h * 0.86)
  })
}
export function JmBoilerRoom({ item }) {
  const [w, h, d] = item.size
  const B = item.boiler
  const front = d / 2
  const drawers = useMemo(() => drawerTexture(), [])
  const roof = useMemo(() => hipRoofGeometry(w + 1, d + 1, 1.4, 0.2), [w, d])
  const coal = useMemo(() => range(28).map((i) => ({ p: [B.furnace[0] + 3.2 + (srand(i) - 0.5) * 2.4, 0.15 + srand(i + 40) * 0.35, B.furnace[1] + 1.8 + (srand(i + 80) - 0.5) * 1.6], s: [0.35, 0.3, 0.35] })), [B])
  const [dx, dz, dw] = B.drawers
  const [kx, kz, kw, kd] = B.deck
  return (
    <group>
      {/* 바닥 + 벽(앞면은 문만 비움) + 지붕 */}
      <Box p={[0, 0.05, 0]} s={[w, 0.1, d]} c="#4a4038" />
      <Box p={[0, h / 2, -front + 0.2]} s={[w, h, 0.4]} m={STONE} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (w / 2 - 0.2), h / 2, 0]} s={[0.4, h, d]} c="#a3523f" />
      ))}
      {(() => {
        const a = B.door.x - B.door.w / 2
        const b = B.door.x + B.door.w / 2
        return (
          <group>
            <Box p={[(-w / 2 + a) / 2, h / 2, front - 0.2]} s={[a + w / 2, h, 0.4]} c="#a3523f" />
            <Box p={[(b + w / 2) / 2, h / 2, front - 0.2]} s={[w / 2 - b, h, 0.4]} c="#a3523f" />
            <Box p={[B.door.x, (B.door.h + h) / 2, front - 0.2]} s={[B.door.w, h - B.door.h, 0.4]} c="#a3523f" />
            <mesh position={[B.door.x, B.door.h + 0.45, front + 0.02]}>
              <planeGeometry args={[1.4, 0.5]} />
              <GlowMaterial glow={0.5} map={getJpSignTexture('釜場', '#2a1a12', '#f3e6c8', 1.4 / 0.5)} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })()}
      <Box p={[0, h + 0.1, 0]} s={[w, 0.2, d]} c="#3a2a1c" />
      <mesh geometry={roof} position={[0, h + 0.2, 0]}>
        <meshStandardMaterial color="#3a3530" flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* 큰 화덕: 벽돌 몸통 + 쇠 문 + 불 + 위로 올라가는 굵은 관 */}
      <group position={[B.furnace[0], 0, B.furnace[1]]}>
        <Box p={[0, 1.9, 0]} s={[5, 3.8, 2.6]} c="#6a3b2a" />
        <Box p={[0, 3.95, 0]} s={[5.3, 0.3, 2.9]} m={IRON} />
        <Box p={[0, 1.2, 1.31]} s={[2.2, 1.4, 0.06]} m={IRON} />
        <mesh position={[0, 1.15, 1.35]}>
          <planeGeometry args={[1.6, 0.9]} />
          <primitive object={FIRE} attach="material" />
        </mesh>
        {[-1.6, 0, 1.6].map((x) => (
          <Cyl key={x} p={[x, (4 + h) / 2, -0.4]} rad={0.32} h={h - 4} m={IRON} />
        ))}
      </group>
      <Instances geometry={GEO.rock} material={mat('#1c1a18', { flat: true })} items={coal} />
      {/* 약초 서랍장 (천장까지) + 사다리 */}
      <group position={[dx, 0, dz]}>
        <Box p={[0, (h - 0.4) / 2, -0.3]} s={[dw + 0.3, h - 0.4, 0.6]} c="#2a1a10" />
        <mesh position={[0, (h - 0.4) / 2, 0.01]}>
          <planeGeometry args={[dw, h - 0.6]} />
          <primitive object={texMat(drawers, { emissive: '#ffffff', emissiveIntensity: 0.12 })} attach="material" />
        </mesh>
        {[-0.3, 0.3].map((x) => (
          <Box key={x} p={[dw / 2 - 1.4 + x, (h - 0.5) / 2, 0.55]} s={[0.07, h - 0.5, 0.07]} c="#8a6a48" r={[0.12, 0, 0]} />
        ))}
        {range(10).map((i) => (
          <Box key={i} p={[dw / 2 - 1.4, 0.4 + i * ((h - 1) / 10), 0.55 - i * 0.04]} s={[0.66, 0.05, 0.05]} c="#8a6a48" />
        ))}
      </group>
      {/* 서랍장 앞 나무 단 + 낮은 책상 */}
      <group position={[kx, 0, kz]}>
        <Box p={[0, 0.3, 0]} s={[kw, 0.6, kd]} c="#6b4a30" />
        <Box p={[0, 0.85, 0]} s={[1.6, 0.5, 0.8]} c="#3b2a1c" />
        <Box p={[-0.4, 1.12, 0]} s={[0.4, 0.06, 0.3]} c="#e9e1cf" />
      </group>
      {/* 천장 관 + 매달린 등 */}
      {[-d / 4, d / 4].map((z) => (
        <Cyl key={z} p={[0, h - 0.5, z]} rad={0.18} h={w - 1} m={IRON} r={[0, 0, Math.PI / 2]} />
      ))}
      {[-w / 4, w / 4].map((x) => (
        <group key={x} position={[x, h - 1.2, 0]}>
          <Cyl p={[0, 0.5, 0]} rad={0.02} h={0.8} m={IRON} />
          <Ball p={[0, 0, 0]} rad={0.2} m={LANTERN_WHITE} />
        </group>
      ))}
      {/* 굴뚝 (온천장보다 높이) */}
      {B.chimney && (
        <group position={[B.chimney[0], 0, B.chimney[1]]}>
          <Cyl p={[0, B.chimney[2] / 2, 0]} rad={0.9} h={B.chimney[2]} c="#7d5a48" />
          {range(Math.floor(B.chimney[2] / 6)).map((i) => (
            <Cyl key={i} p={[0, 6 + i * 6, 0]} rad={0.95} h={0.25} c="#4a3a30" />
          ))}
          <Cyl p={[0, B.chimney[2] + 0.2, 0]} rad={1.05} h={0.4} c="#2e2a26" />
          {/* 깃발 (흰 천에 둥근 테 「湯」) — 우리 글자 */}
          <Box p={[1.6, B.chimney[2] - 2, 0]} s={[2.4, 0.12, 0.12]} m={IRON} />
          <mesh position={[2.3, B.chimney[2] - 3.6, 0]}>
            <planeGeometry args={[1.8, 2.8]} />
            <meshStandardMaterial map={flagTexture()} side={THREE.DoubleSide} />
          </mesh>
          {range(4).map((i) => (
            <mesh key={i} position={[0.3 * i, B.chimney[2] + 1 + i * 1.3, 0.2 * i]} scale={[0.9 + i * 0.5, 0.6 + i * 0.3, 0.9 + i * 0.5]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color="#d9d4ce" transparent opacity={0.35 - i * 0.06} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// ── 엘리베이터 (온천장 층 사이 + 보일러실) ─────
// item.size [w, h, d], 열린 쪽 = 로컬 +z. item.elevator = { me, stops: [{ key, label, pos: [월드 x, y, z], face(도) }] }
// 칸 안에서 E → 층 고르기(숫자·B 키) → 화면이 어두워지고 그 층 칸으로 순간 이동
// 이동은 병관님 워프(bk_warpStore.js goto)의 정확한 자리(exact) 요청을 씀. 워프 쪽이 아직 exact를 모르면(useWarps.exact 없음) 안내만 함
export const useJmElevator = (() => {
  let near = null
  const subs = new Set()
  return {
    get: () => near,
    set: (v) => {
      near = v
      subs.forEach((f) => f(v))
    },
    sub: (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
  }
})()

// (11/25 지민 요청) 탄 느낌: 문 닫힘 → 어두운 화면 가운데 층 숫자가 한 층씩 바뀌며 덜컹 → 도착하면 그 층 칸의 문이 닫힌 채 시작해서 열림
const floorName = (key) => (key === 'B' ? 'B1' : `${key}F`)
// 마지막 도착 기록: 도착한 칸은 문이 닫힌 채 시작했다가 열림
const lastArrive = { kind: null, key: null, t: 0 }
// (11/26) 지금 타고 가는 칸: 같은 종류의 다른 층 칸은 이동하는 동안 숨기고 "들어왔다" 판정도 안 함
//   층마다 칸 모형이 따로 서 있어서, 움직이는 칸이 지나갈 때 겹쳐 보이고 그 칸들이 안내창·카메라를 가로채던 문제
const rideNow = { kind: null, from: null }

function cageTexture() {
  return canvasTexture('jmspirit:cage', 256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#c9a24a'
    ctx.lineWidth = 6
    ctx.strokeRect(4, 4, w - 8, h - 8)
    ctx.lineWidth = 3
    for (let i = 1; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(-h, i * 64)
      ctx.lineTo(w + h, i * 64 + w)
      ctx.moveTo(-h, i * 64 + w)
      ctx.lineTo(w + h, i * 64)
      ctx.stroke()
    }
  })
}

// (11/26 지민 요청) 영화 장면처럼: 옆벽 축에 박힌 긴 나무 레버를 밀어 올리고 내리는 엘리베이터, 벽은 어두운 나무판
// 조작은 쉽게: 칸 안에 들어가면 오른쪽에 층 목록 → 숫자 키(1~5) 또는 층을 눌러 바로 출발 (레버가 그 층 쪽으로 돌아감)
// item.elevator.kind: 'staff'(구석, 1~5층) | 'guest'(가운데 누각, 1~4층)
// 워프는 바닥 + 1.6m에 캐릭터 중심을 두는데 서 있을 때 중심은 약 1m → 타고 가는 동안 뜨지 않게 0.6m 내림
// (11/26) 층 자리 x·z는 저장된 stops가 아니라 지금 칸이 서 있는 자리에서 계산함
//   → 맵을 늘이거나 옮겨도 층 자리가 칸과 어긋나지 않음 (예전 stops z가 칸보다 약 100m 어긋나 엉뚱한 곳으로 보내던 문제)
const STAND_FIX = 0.6
// 영화 클로즈업처럼: 붉은 벽에 반원 청동 판(구멍 몇 개, 둥근 홈) + 짧은 놋쇠 팔 + 끝의 나무 원통 손잡이
const LEVER_PIVOT = [-0.2, 1.45] // 옆벽 기준 (문 쪽 = +x, 위 = +y)
const LEVER_LEN = 0.5
const LEVER_SWING = 1.0 // 맨 아래층 -1.0rad ~ 맨 위층 +1.0rad (반원 안에서 돌아감)
const LEVER_WOOD = mat('#9a5f2c', { roughness: 0.6 })
const LEVER_BRONZE = mat('#7a4e26', { roughness: 0.45, metalness: 0.55 })
const LEVER_HOLE = mat('#1a0e06', { roughness: 0.9 })
// 층 글자 판 (B1·1F~5F). on = 빨갛게 빛남
function floorTexture(key, on) {
  const label = key === 'B' ? 'B1' : `${key}F`
  return canvasTexture(`jmspirit:floor:${label}:${on ? 1 : 0}`, 160, 110, (ctx, w, h) => {
    ctx.fillStyle = on ? '#7a1408' : '#1a120c'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#c9a24a'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, w - 6, h - 6)
    ctx.fillStyle = on ? '#ffd9c8' : '#f2c94c'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `900 ${Math.round(h * 0.66)}px "Malgun Gothic", sans-serif`
    ctx.fillText(label, w / 2, h / 2 + 3)
  })
}
// 어두운 세로 나무판 벽 (장면 속 엘리베이터 안벽)
function elevPlankTexture() {
  return canvasTexture('jmspirit:elevplank', 256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a2f1a'
    ctx.fillRect(0, 0, w, h)
    const rnd = seeded(77)
    for (let i = 0; i < 5; i++) {
      const x = (i * w) / 5
      ctx.fillStyle = `rgba(${90 + rnd() * 40}, ${55 + rnd() * 25}, ${28 + rnd() * 15}, 0.55)`
      ctx.fillRect(x + 2, 0, w / 5 - 4, h)
      ctx.strokeStyle = 'rgba(20, 10, 4, 0.35)'
      ctx.lineWidth = 1
      for (let k = 0; k < 6; k++) {
        const gx = x + 6 + rnd() * (w / 5 - 12)
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.bezierCurveTo(gx + rnd() * 6 - 3, h * 0.3, gx + rnd() * 6 - 3, h * 0.7, gx, h)
        ctx.stroke()
      }
      ctx.fillStyle = '#1c1008'
      ctx.fillRect(x, 0, 3, h)
    }
  })
}
const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
export function JmElevator({ item }) {
  const [w, h, d] = item.size
  const E = item.elevator
  const scene = useThree((s) => s.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const next = useRef(0)
  const [near, setNear] = useState(false)
  const meIndex = Math.max(0, E.stops.findIndex((s) => s.key === E.me))
  const [sel, setSel] = useState(meIndex)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), [])
  const cage = useMemo(() => cageTexture(), [])
  const planks = useMemo(() => elevPlankTexture(), [])
  const controls = useThree((s) => s.controls)
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const rideCam = useRef(null) // 타고 가는 동안 카메라 방향(문 쪽 azimuth)
  const here = E.stops[meIndex]
  const n = E.stops.length
  const leverAngle = (i) => (n > 1 ? -LEVER_SWING + (2 * LEVER_SWING * i) / (n - 1) : 0)
  const lever = useRef(null)
  // 이 칸의 실제 x·z (월드). 칸은 위아래로만 움직이므로 한 번 재면 됨
  const cabXZ = useRef(null)
  const stopPos = (i) => {
    const p = E.stops[i].pos
    return cabXZ.current ? [cabXZ.current[0], p[1], cabXZ.current[1]] : p
  }
  // 문: 0 = 열림, 1 = 닫힘. 막 도착한 칸이면 닫힌 채 시작
  const justArrived = () => lastArrive.kind === (E.kind ?? 'staff') && lastArrive.key === E.me && performance.now() - lastArrive.t < 5000
  const door = useRef(justArrived() ? 1 : 0)
  const doorTarget = useRef(0)
  const gateL = useRef(null)
  const gateR = useRef(null)
  const [riding, setRiding] = useState(false)
  const ridingRef = useRef(false)
  const [rideIdx, setRideIdx] = useState(null)
  const ride = useRef(null)
  const rideFloor = useRef(null)
  const body = useRef(null)

  useFrame(({ clock }, dt) => {
    if (!cabXZ.current && anchor.current) {
      anchor.current.getWorldPosition(tmp.a)
      cabXZ.current = [tmp.a.x, tmp.a.z]
    }
    // 문이 닫히는 동안: 캐릭터를 이 칸 가운데에 붙잡아 둠
    if (ridingRef.current && !ride.current) {
      const p = stopPos(meIndex)
      holdAt(p[0], p[1] - STAND_FIX, p[2])
    }
    // (11/26) 문 닫힘 ~ 도착까지: 카메라를 칸 안(문 쪽 위, 0.75m)으로 당겨 둠 — 닫힌 철문(칸 끝 1.4m)보다 안쪽
    //   칸 밖 2.6m에 있으면 층 사이를 지나는 동안 승강로 벽·창살 문이 화면을 가림. 도착하면 새 칸이 다시 2.6m로 되돌림
    //   칸이 움직이는 동안은 카메라 중심을 캐릭터에 바로 맞춤(transition 없이): 공용 카메라의 부드러운 따라가기는 위아래로
    //   빠르게 움직이면 몇 m씩 늦어서 카메라가 아래층에 남아 바닥판·바깥 장지문을 비췄음 (11/26 측정: 최대 6m 뒤처짐)
    if (ridingRef.current && rideCam.current != null && controls?.rotateTo) {
      const moving = !!ride.current
      controls.minDistance = Math.min(controls.minDistance, 0.6)
      if (moving && player.current) {
        player.current.getWorldPosition(tmp.a)
        controls.moveTo(tmp.a.x, tmp.a.y + 0.6, tmp.a.z, false)
      }
      controls.rotateTo(rideCam.current, 1.05, !moving)
      controls.dollyTo(0.75, !moving)
    }
    // 타고 가는 중: 칸이 위·아래로 움직이고 캐릭터를 칸 바닥에 맞춰 같이 옮김
    const r = ride.current
    if (r) {
      const t = Math.min(1, (performance.now() - r.t0) / r.dur)
      const e = t * t * (3 - 2 * t)
      const y = r.y0 + (r.y1 - r.y0) * e
      if (body.current) body.current.position.y = y - r.y0 + Math.sin(t * 40) * 0.01
      useGameStore.setState({ inputLocked: true })
      holdAt(r.x, y - STAND_FIX, r.z)
      let nearest = 0
      E.stops.forEach((st, i) => {
        if (Math.abs(st.pos[1] - y) < Math.abs(E.stops[nearest].pos[1] - y)) nearest = i
      })
      if (nearest !== rideFloor.current) {
        rideFloor.current = nearest
        setRideIdx(nearest)
      }
      if (t >= 1) {
        lastArrive.kind = E.kind ?? 'staff'
        lastArrive.key = r.stop.key
        lastArrive.t = performance.now()
        holdAt(r.x, r.y1 - STAND_FIX, r.z)
        ride.current = null
        if (body.current) body.current.position.y = 0
        ridingRef.current = false
        rideNow.kind = null
        rideNow.from = null
        setRiding(false)
        setRideIdx(null)
        setSel(meIndex)
        rideFloor.current = null
        doorTarget.current = 0
        setTimeout(() => {
          if (!useGameStore.getState().openPanel) useGameStore.setState({ inputLocked: false })
        }, 200)
      }
    }
    // 나무 레버: 고른 층 각도로 부드럽게 돌아감
    if (lever.current) lever.current.rotation.z += (leverAngle(sel) - lever.current.rotation.z) * Math.min(1, dt * 6)
    // 접이식 철문: 목표값 쪽으로 천천히 (1초쯤)
    door.current += Math.sign(doorTarget.current - door.current) * Math.min(Math.abs(doorTarget.current - door.current), dt * 1.2)
    const k = 0.12 + door.current * 0.88
    if (gateL.current) gateL.current.scale.x = k
    if (gateR.current) gateR.current.scale.x = k
    const t = clock.elapsedTime
    if (t < next.current) return
    next.current = t + 0.15
    if (!player.current?.parent) player.current = findPlayer(scene)
    if (!player.current || !anchor.current) return
    anchor.current.getWorldPosition(tmp.a)
    player.current.getWorldPosition(tmp.b)
    const otherRiding = rideNow.kind === (E.kind ?? 'staff') && rideNow.from !== E.me
    if (body.current) body.current.visible = !otherRiding
    // 타고 가는 동안 출발한 칸은 안내창을 계속 띄움 (캐릭터 이동이 한 프레임 늦어 잠깐 칸 밖으로 판정되던 것)
    const inside = !otherRiding && (ridingRef.current || Math.abs(tmp.b.x - tmp.a.x) < w / 2 + 0.3 && Math.abs(tmp.b.z - tmp.a.z) < d / 2 + 0.3 && Math.abs(tmp.b.y - tmp.a.y) < 2.2)
    if (inside !== near) {
      setNear(inside)
      // (11/26) 칸에 들어서면(도착 포함) 카메라를 열린 문 쪽 바깥에서 칸 안을 들여다보는 자리로 돌림
      //   칸 폭이 2.8m라 뒤에서 따라오는 카메라(3~5m)는 승강로·벽 속으로 빠짐. 돌린 뒤에는 마우스로 자유롭게
      if (inside && controls?.rotateTo) {
        const open = tmp.b.set(0, 0, 1).applyQuaternion(anchor.current.getWorldQuaternion(tmpQ))
        controls.rotateTo(Math.atan2(open.x, open.z), 1.2, true)
        controls.dollyTo(2.6, true)
      }
      if (inside && justArrived()) {
        door.current = 1
        doorTarget.current = 1
        setTimeout(() => (doorTarget.current = 0), 900)
      }
    }
  })

  useEffect(() => {
    if (!justArrived()) return undefined
    door.current = 1
    doorTarget.current = 1
    const t = setTimeout(() => (doorTarget.current = 0), 700)
    return () => clearTimeout(t)
  }, [])

  const go = (to) => {
    if (ridingRef.current || to === meIndex || to < 0 || to >= n) return
    if (!useWarps.getState().exact) {
      useUiStore.getState().toast('엘리베이터는 아직 운행 준비 중이에요. 옆 계단을 이용해 주세요.', 'info')
      return
    }
    const steps = Math.abs(to - meIndex)
    const from = stopPos(meIndex)
    const dest = stopPos(to)
    setSel(to) // 레버가 그 층 쪽으로 돌아감
    if (anchor.current) {
      const open = new THREE.Vector3(0, 0, 1).applyQuaternion(anchor.current.getWorldQuaternion(tmpQ))
      rideCam.current = Math.atan2(open.x, open.z)
    }
    setRiding(true)
    ridingRef.current = true
    rideNow.kind = E.kind ?? 'staff'
    rideNow.from = E.me
    useGameStore.setState({ inputLocked: true })
    doorTarget.current = 1 // 문 닫힘 (1초쯤)
    setTimeout(() => {
      ride.current = { y0: from[1], y1: dest[1], x: dest[0], z: dest[2], t0: performance.now(), dur: Math.max(2000, steps * 1500), stop: E.stops[to] }
    }, 1100)
  }

  // 숫자 키(1~5, 숫자패드 포함)로 바로 출발. 채팅 입력 중에는 무시
  useEffect(() => {
    if (!near) return undefined
    const down = (event) => {
      if (event.repeat || isTyping(event.target) || useGameStore.getState().openPanel) return
      const m = /^(?:Digit|Numpad)(\d)$/.exec(event.code)
      const key = m ? m[1] : event.code === 'KeyB' ? 'B' : null
      if (!key) return
      const to = E.stops.findIndex((s) => s.key === key)
      if (to < 0) return
      event.preventDefault()
      go(to)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  const size = useThree((s) => s.size)
  const target = E.stops[sel]
  const kbd = (k) => <kbd style={{ padding: '0 5px', borderRadius: 4, background: '#e8c35a', color: '#111', fontSize: 11, fontWeight: 700 }}>{k}</kbd>
  return (
    <group ref={body}>
      <group ref={anchor} position={[0, 0.2, 0]} />
      {/* 바닥판 + 천장 + 세 면 나무판 벽 + 열린 쪽 접이식 철문 */}
      <Box p={[0, 0.05, 0]} s={[w, 0.1, d]} c="#3b2a1c" />
      <Box p={[0, h - 0.1, 0]} s={[w, 0.2, d]} c="#2a1a0e" />
      {[
        [0, -d / 2, w, 0],
        [-w / 2, 0, d, Math.PI / 2],
        [w / 2, 0, d, -Math.PI / 2],
      ].map(([x, z, len, r], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
          {/* 벽은 칸 안쪽에서만 보임(FrontSide, 앞면 = 안쪽): 칸이 좁아 카메라가 벽 밖에 있어도 벽 너머로 캐릭터가 보이게 */}
          <mesh position={[0, h / 2, 0.01]}>
            <planeGeometry args={[len, h - 0.2]} />
            <meshStandardMaterial map={planks} side={THREE.FrontSide} roughness={0.85} />
          </mesh>
          {/* 허리 높이 나무 손잡이 띠 */}
          <Box p={[0, 1.0, 0.05]} s={[len - 0.1, 0.1, 0.08]} c="#6b4423" />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (w / 2 - 0.05), h / 2, d / 2]} s={[0.12, h, 0.12]} c="#5a3a1e" />
          {/* 접이식 철문 한 짝: 바깥 기둥에 붙어 가운데로 늘어남 (scale.x) */}
          <group ref={s < 0 ? gateL : gateR} position={[s * (w / 2 - 0.1), 0, d / 2 - 0.03]} scale={[0.12, 1, 1]}>
            <mesh position={[-s * (w / 4 - 0.05), h / 2 - 0.1, 0]}>
              <planeGeometry args={[w / 2 - 0.1, h - 0.4]} />
              <meshStandardMaterial map={cage} transparent alphaTest={0.4} side={THREE.DoubleSide} metalness={0.6} roughness={0.35} color="#e8c35a" />
            </mesh>
            <Box p={[-s * (w / 2 - 0.12), h / 2 - 0.1, 0]} s={[0.05, h - 0.4, 0.05]} m={BRASS} />
          </group>
        </group>
      ))}
      <Box p={[0, h + 0.05, d / 2]} s={[w + 0.2, 0.15, 0.15]} c="#5a3a1e" />
      {/* 층 표시: 문 위 이 칸의 층 + 칸 안 뒷벽 큰 숫자판(가는 층, 출발하면 빨갛게) */}
      <mesh position={[0, h + 0.6, d / 2 + 0.06]}>
        <planeGeometry args={[1.3, 0.8]} />
        <GlowMaterial glow={0.9} map={floorTexture(here?.key ?? '1', false)} side={THREE.DoubleSide} />
      </mesh>
      <Box p={[0, h + 0.6, d / 2 + 0.02]} s={[1.45, 0.95, 0.04]} m={BRASS} />
      <mesh position={[0, h - 0.75, -d / 2 + 0.08]}>
        <planeGeometry args={[1.1, 0.75]} />
        <GlowMaterial glow={1.0} map={floorTexture(target?.key ?? '1', riding)} />
      </mesh>
      <Box p={[0, h - 0.75, -d / 2 + 0.05]} s={[1.25, 0.9, 0.04]} m={BRASS} />
      {/* 레버(영화 클로즈업): 오른쪽 안 벽 붉은 옻칠 판 위 반원 청동 판 — 둥근 홈을 따라 짧은 놋쇠 팔이 돌고 끝에 나무 원통 손잡이.
          위로 올리면 위층, 내리면 아래층. 반원 바깥 둘레에 층 글자판 */}
      <group position={[w / 2 - 0.12, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Box p={[LEVER_PIVOT[0] + 0.15, LEVER_PIVOT[1], -0.01]} s={[1.3, 1.5, 0.03]} c="#7a2416" />
        <group position={[LEVER_PIVOT[0], LEVER_PIVOT[1], 0.02]}>
          {E.stops.map((s, i) => {
            const a = leverAngle(i)
            return (
              <mesh key={s.key} position={[Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.01]}>
                <planeGeometry args={[0.22, 0.15]} />
                <GlowMaterial glow={0.8} map={floorTexture(s.key, i === sel)} />
              </mesh>
            )
          })}
          {/* 반원 청동 판 (문 쪽으로 볼록) + 안쪽 둥근 홈 + 구멍 3개 */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} material={LEVER_BRONZE}>
            <cylinderGeometry args={[0.62, 0.62, 0.05, 24, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]} material={LEVER_HOLE}>
            <cylinderGeometry args={[0.42, 0.42, 0.02, 24, 1, false, 0, Math.PI]} />
          </mesh>
          {[-0.75, 0, 0.75].map((a) => (
            <Ball key={a} p={[Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0.05]} rad={0.035} m={LEVER_HOLE} />
          ))}
          <Box p={[-0.04, 0, 0.03]} s={[0.12, 1.3, 0.08]} m={LEVER_BRONZE} />
          <Ball p={[0, 0, 0.07]} rad={0.06} m={BRASS} />
          <group ref={lever} rotation={[0, 0, leverAngle(meIndex)]}>
            {/* 놋쇠 팔 */}
            <Box p={[LEVER_LEN / 2, 0, 0.09]} s={[LEVER_LEN, 0.07, 0.03]} m={BRASS} />
            {/* 나무 원통 손잡이 (팔 끝, 팔 방향으로 누운 원통 + 끝 구멍) */}
            <mesh position={[LEVER_LEN + 0.06, 0, 0.13]} rotation={[0, 0, -Math.PI / 2]} material={LEVER_WOOD}>
              <cylinderGeometry args={[0.075, 0.085, 0.24, 14]} />
            </mesh>
            <Ball p={[LEVER_LEN + 0.19, 0, 0.13]} rad={0.025} m={LEVER_HOLE} />
          </group>
        </group>
      </group>
      {near && (
        <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          {/* 왼쪽 조작키 안내 아래에 둠 (오른쪽 아래는 미니맵이 가림) */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '210px 0 0 16px', boxSizing: 'border-box', pointerEvents: 'none' }}>
            <div style={{ width: 230, padding: '12px 14px', borderRadius: 14, background: 'rgba(24,14,8,0.86)', border: '2px solid #b8913c', color: '#fff', fontSize: 14, lineHeight: 1.5, pointerEvents: 'auto' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#f2c94c', marginBottom: 6 }}>{E.kind === 'guest' ? '손님용 엘리베이터' : '직원용 엘리베이터'}</div>
              {/* 층 목록: 위층이 위. 누르면 바로 출발 */}
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 3, marginBottom: 8 }}>
                {E.stops.map((s, i) => {
                  const isHere = i === meIndex
                  const isSel = riding ? i === sel : isHere
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={riding || isHere}
                      onClick={(e) => {
                        e.currentTarget.blur()
                        go(i)
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8, border: 'none', textAlign: 'left', color: '#fff', cursor: riding || isHere ? 'default' : 'pointer', background: isSel ? (riding ? '#a24a36' : '#b8913c') : 'rgba(255,255,255,0.08)', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: isSel ? 800 : 500 }}
                    >
                      {kbd(s.key)}
                      <span style={{ width: 28, fontSize: 16, fontWeight: 900 }}>{floorName(s.key)}</span>
                      <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                      {isHere && <span style={{ fontSize: 11, opacity: 0.85 }}>지금</span>}
                    </button>
                  )
                })}
              </div>
              {riding ? (
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f2c94c', textAlign: 'center' }}>
                  {rideIdx == null ? '문이 닫혀요…' : `${sel > meIndex ? '▲' : '▼'} ${floorName(E.stops[rideIdx].key)}`}
                </div>
              ) : (
                <div style={{ fontSize: 13 }}>숫자 키 {kbd('1')}~{kbd(String(E.stops[n - 1].key))} 또는 층을 누르면 바로 출발해요</div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// ── 온천장 아래층 외벽 (지대 남쪽 벼랑에 붙임) ─────
// 지민이 보낸 사진처럼 온천장이 물가에서부터 솟은 붉은 건물로 보이게: 붉은 벽 2층 + 불 켜진 창 + 초록 처마 + 물가 돌 띠
// item.size [w, h, _], 앞(+z) = 골짜기 쪽. 걷는 판정 없음 (뒤는 지대 옹벽)
export function JmYuLowerFacade({ item }) {
  const [w, h] = item.size
  const winTex = windowStripTexture('lattice')
  const eave = useMemo(() => hipRoofGeometry(w + 0.8, 2.2, 0.55, 0.06), [w])
  const plants = useMemo(() => range(Math.round(w / 1.6)).map((i) => ({ p: [-w / 2 + 0.8 + i * 1.6, h + 0.35, 0.55], s: [0.5 + srand(i) * 0.3, 0.45, 0.4] })), [w, h])
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, 0.6]} c="#8a7f6e" />
      <Box p={[0, 0.5, 0.05]} s={[w + 0.2, 1.0, 0.7]} c="#5f574b" />
      {range(Math.round(w / 3)).map((i) => (
        <Box key={`st${i}`} p={[-w / 2 + 1.5 + i * 3, h * (0.25 + (i % 3) * 0.2), 0.31]} s={[2.2 + (i % 2) * 0.6, 0.9, 0.04]} c={i % 2 ? '#7a705f' : '#968b78'} />
      ))}
      {[0.38, 0.78].map((t, i) => (
        <group key={t}>
          <mesh position={[0, h * t, 0.31]}>
            <planeGeometry args={[w - 1.5, h * 0.2]} />
            <primitive object={texMat(winTex, { emissive: '#ffffff', emissiveIntensity: 0.55 })} attach="material" />
          </mesh>
          {i === 0 && (
            <mesh geometry={eave} position={[0, h * 0.58, 0.6]}>
              <meshStandardMaterial color="#3f7a5c" flatShading side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
      {range(Math.round(w / 6) + 1).map((i) => (
        <Box key={i} p={[-w / 2 + (i * w) / Math.round(w / 6), h / 2, 0.36]} s={[0.6, h, 0.2]} c="#6f6556" />
      ))}
      {/* (지민이 보낸 영상 참고) 벽에 붙은 나무 덧방 2채: 격자창 + 어두운 기와 + 받침 기둥 */}
      {[[-w / 2 + 5, 3.2, 6], [w / 2 - 6, 1.2, 5]].map(([x, y, aw], i) => (
        <group key={`an${i}`} position={[x, y, 0.3]}>
          <Box p={[0, 1.1, 0.7]} s={[aw, 2.2, 1.4]} c="#5a3d2a" />
          <mesh position={[0, 1.2, 1.41]}>
            <planeGeometry args={[aw - 0.6, 1.3]} />
            <primitive object={texMat(winTex, { emissive: '#ffffff', emissiveIntensity: 0.5 })} attach="material" />
          </mesh>
          <Box p={[0, 2.35, 0.8]} s={[aw + 0.5, 0.15, 1.9]} c="#2e3236" r={[0.18, 0, 0]} />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * (aw / 2 - 0.2), -y / 2, 1.2]} s={[0.18, y, 0.18]} c="#3b2a1c" />
          ))}
        </group>
      ))}
      {/* 지그재그 나무 계단 (벽 장식) + 물가로 내려가는 사다리 */}
      {range(8).map((i) => (
        <Box key={`zs${i}`} p={[-w / 2 + 9.5 + i * 0.45, 3.1 - i * 0.38, 0.75]} s={[0.5, 0.08, 0.8]} c="#7a5a3a" />
      ))}
      <Box p={[-w / 2 + 11.1, 1.75, 1.15]} s={[3.8, 0.06, 0.06]} c="#5a3d2a" r={[0, 0, -0.69]} />
      {[w / 2 - 12, w / 2 - 2.5].map((x) => (
        <group key={`ld${x}`} position={[x, 0, 0.45]}>
          {[-0.3, 0.3].map((dx) => (
            <Box key={dx} p={[dx, 1.6, 0]} s={[0.06, 3.2, 0.06]} c="#3b2a1c" />
          ))}
          {range(8).map((k) => (
            <Box key={k} p={[0, 0.3 + k * 0.38, 0]} s={[0.6, 0.05, 0.05]} c="#3b2a1c" />
          ))}
        </group>
      ))}
      {/* 벽을 타고 꺾이는 흰 관 */}
      {[[-w / 2 + 2.2, 0, 4.4], [-2, 2.4, 7], [w / 2 - 8.5, 0.8, 5]].map(([x, z0, len], i) => (
        <group key={`pp${i}`}>
          <Cyl p={[x, (z0 + h) / 2 + 0.3, 0.5]} rad={0.13} h={h - z0 + 0.6} c="#d6d1c6" />
          <Cyl p={[x + len / 2, z0 + 0.3, 0.5]} rad={0.13} h={len} c="#d6d1c6" r={[0, 0, Math.PI / 2]} />
          <Ball p={[x, z0 + 0.3, 0.5]} rad={0.17} c="#bdb7aa" />
          <Ball p={[x + len, z0 + 0.3, 0.5]} rad={0.17} c="#bdb7aa" />
          <Cyl p={[x + len, z0 / 2 + 0.15, 0.5]} rad={0.13} h={z0 + 0.3} c="#d6d1c6" />
        </group>
      ))}
      {/* 지대 끝 위 화분 줄 (사진의 층마다 초록 덤불) */}
      <Box p={[0, h + 0.1, 0.55]} s={[w, 0.2, 0.6]} c="#5a3d2a" />
      <Instances geometry={GEO.sphere} material={mat('#3f6b3a', { flat: true })} items={plants} />
    </group>
  )
}

// ── 꽃덤불 (온천장 옆 꽃밭: 수국·철쭉) ─────────
export function JmFlowerBush({ item }) {
  const [w, h, d] = item.size
  const seed = item.seed ?? 0
  const colors = [['#7aa7e8', '#9f8ee0', '#b9c8f2'], ['#e86a9a', '#f2a3c0', '#ffffff'], ['#d94f6a', '#f28aa0', '#ffd0dc']][seed % 3]
  const flowers = useMemo(() => colors.map((_, c) => range(10).map((i) => {
    const a = srand(seed * 31 + i * 3 + c) * Math.PI * 2
    const r = 0.35 + srand(seed + i * 7 + c * 11) * 0.5
    return { p: [Math.cos(a) * r * (w / 2), h * (0.55 + srand(i + c * 5 + seed) * 0.4), Math.sin(a) * r * (d / 2)], s: [0.22, 0.22, 0.22] }
  })), [w, h, d, seed, colors])
  return (
    <group>
      <mesh geometry={GEO.sphere} position={[0, h * 0.45, 0]} scale={[w / 2, h * 0.5, d / 2]}>
        <meshStandardMaterial color="#3f6b3a" flatShading />
      </mesh>
      {!item.green && flowers.map((items, c) => (
        <Instances key={c} geometry={GEO.sphere} material={mat(colors[c])} items={items} />
      ))}
    </group>
  )
}

// ── 풀밭 언덕 (터널을 나오면 펼쳐지는 초록 언덕, 올라가지 않는 풍경) ──
export function JmGrassHill({ item }) {
  const [w, h, d] = item.size
  return (
    <mesh geometry={GEO.dome} scale={[w / 2, h, d / 2]}>
      <meshStandardMaterial color={item.color ?? '#6f9a4e'} flatShading roughness={1} />
    </mesh>
  )
}

// ── 바다 위 전차 한 량 (11/25 지민이 보낸 장면 참고) ─────────
// 아래 밤색 세로 나무판 + 위 크림색 창 줄, 붉은 지붕과 통풍구, 앞면은 둥근 얼굴에 큰 창 두 장 + 지붕 위 둥근 등 + 행선판
// 안: 나무 바닥, 북쪽 긴 붉은 의자, 손잡이 고리. 문은 남쪽 옆면 2곳(열려 있음). 캐릭터·승객은 넣지 않음
// item.size [w, h, len] (로컬 z = 길이 방향), item.floor 바닥 높이, item.head 1|-1 둥근 앞면 쪽, item.sign 행선판 글자
const TRAIN_RED = mat('#8a3326', { roughness: 0.8 })
const TRAIN_CREAM = mat('#e9c98a', { roughness: 0.75 })
const TRAIN_ROOF = mat('#7a2a20', { roughness: 0.7 })
const TRAIN_GLASS = mat('#bfe3ee', { transparent: true, opacity: 0.35, roughness: 0.1, double: true })
const SEAT_RED = mat('#9a2f2a', { roughness: 0.8 })
const FLOOR_WOOD = mat('#a07a50', { roughness: 0.85 })
function plankTexture() {
  return canvasTexture('jmspirit:trainplank', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a3326'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(40,10,5,0.45)'
    ctx.lineWidth = 3
    for (let x = 0; x < w; x += 12) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
  })
}
export function JmSeaTrain({ item }) {
  const [w, h, len] = item.size
  const fl = item.floor ?? 0.9
  const head = item.head ?? 1
  const planks = useMemo(() => plankTexture(), [])
  const lowerH = 1.3
  const bodyTop = fl + 2.6
  const doors = [-len / 2 + 2, len / 2 - 2]
  const windows = useMemo(() => {
    const out = []
    const xs = []
    for (let z = -len / 2 + 0.8; z <= len / 2 - 0.8; z += 1.05) if (doors.every((d) => Math.abs(z - d) > 0.9)) xs.push(z)
    for (const z of xs) for (const s of [-1, 1]) out.push({ z, s })
    return out
  }, [len])
  const straps = useMemo(() => range(Math.floor((len - 2) / 0.8)).map((i) => -len / 2 + 1 + i * 0.8), [len])
  return (
    <group>
      {/* 바퀴·차대 (물에 잠김) */}
      {[-len / 2 + 1.6, len / 2 - 1.6].map((z) => (
        <group key={z} position={[0, 0.35, z]}>
          <Box p={[0, 0, 0]} s={[w - 0.4, 0.5, 1.6]} m={IRON} />
          {[-1, 1].map((s) => [-0.5, 0.5].map((dz) => <Cyl key={`${s}${dz}`} p={[s * (w / 2 - 0.25), 0, dz]} rad={0.35} h={0.15} m={IRON} r={[0, 0, Math.PI / 2]} />))}
        </group>
      ))}
      {/* 바닥 */}
      <Box p={[0, fl / 2, 0]} s={[w, fl, len]} c="#3a2a20" />
      <Box p={[0, fl + 0.01, 0]} s={[w - 0.3, 0.02, len - 0.3]} m={FLOOR_WOOD} />
      {/* 옆면: 아래 나무판 + 위 크림 띠 + 창 (남쪽 옆면은 문 자리 비움) */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {[[-len / 2, doors[0] - 0.6], [doors[0] + 0.6, doors[1] - 0.6], [doors[1] + 0.6, len / 2]].map(([a, b], i) => (
            <group key={i}>
              <mesh position={[s * (w / 2), fl + lowerH / 2, (a + b) / 2]} rotation={[0, (s * Math.PI) / 2, 0]}>
                <planeGeometry args={[b - a, lowerH]} />
                <meshStandardMaterial map={planks} side={THREE.DoubleSide} />
              </mesh>
              <Box p={[s * (w / 2), bodyTop - 0.2, (a + b) / 2]} s={[0.06, 0.4, b - a]} m={TRAIN_CREAM} />
            </group>
          ))}
          {s < 0 && <Box p={[-w / 2, fl + 1.6, 0]} s={[0.06, 2.0, 1.2]} m={TRAIN_CREAM} />}
          {/* 북쪽 옆면은 문 자리도 막힘(문짝) */}
          {s < 0 && doors.map((d) => <Box key={d} p={[-w / 2, fl + 1.3, d]} s={[0.08, 2.6, 1.2]} m={TRAIN_CREAM} />)}
        </group>
      ))}
      {windows.map(({ z, s }, i) => (
        <group key={i} position={[s * (w / 2), fl + lowerH + 0.55, z]}>
          <Box p={[0, 0, 0]} s={[0.07, 1.1, 0.95]} m={TRAIN_CREAM} />
          <mesh position={[s * 0.04, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[0.8, 0.85]} />
            <primitive object={TRAIN_GLASS} attach="material" />
          </mesh>
        </group>
      ))}
      {/* 지붕 + 통풍구 */}
      <mesh position={[0, bodyTop, 0]} scale={[w / 2 + 0.1, 0.35, len / 2 + 0.05]}>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={TRAIN_ROOF} attach="material" />
      </mesh>
      <Box p={[0, bodyTop + 0.02, 0]} s={[w + 0.15, 0.06, len + 0.1]} m={TRAIN_ROOF} />
      {[-len / 4, 0, len / 4].map((z) => (
        <Box key={z} p={[0, bodyTop + 0.38, z]} s={[0.9, 0.25, z === 0 ? 2.4 : 0.9]} m={TRAIN_ROOF} />
      ))}
      {/* 끝면: 둥근 앞면(head) / 다른 쪽은 연결 주름막 */}
      {[-1, 1].map((e) => (
        <group key={e} position={[0, 0, e * (len / 2)]}>
          {e === head ? (
            <group>
              <mesh position={[0, fl + lowerH / 2, e * 0.25]} scale={[w / 2, lowerH / 2, 0.5]} material={TRAIN_RED}>
                <cylinderGeometry args={[1, 1, 2, 20, 1, false, e > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
              </mesh>
              <mesh position={[0, fl + lowerH + 0.65, e * 0.25]} scale={[w / 2, 0.65, 0.5]} material={TRAIN_CREAM}>
                <cylinderGeometry args={[1, 1, 2, 20, 1, false, e > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
              </mesh>
              {[-0.55, 0.55].map((x) => (
                <mesh key={x} position={[x, fl + lowerH + 0.65, e * 0.72]} rotation={[0, e > 0 ? 0 : Math.PI, 0]}>
                  <planeGeometry args={[0.95, 1.0]} />
                  <primitive object={TRAIN_GLASS} attach="material" />
                </mesh>
              ))}
              <mesh position={[0, fl + 0.75, e * 0.76]} rotation={[0, e > 0 ? 0 : Math.PI, 0]}>
                <planeGeometry args={[0.55, 0.55]} />
                <GlowMaterial glow={0.5} map={getJpSignTexture(item.sign ?? '湯灯', '#f3e6c8', '#2a1a10', 1)} side={THREE.DoubleSide} />
              </mesh>
              {[-0.9, 0.9].map((x) => (
                <Ball key={x} p={[x, fl + 0.5, e * 0.7]} rad={0.09} m={LANTERN_RED} />
              ))}
              <Ball p={[0, bodyTop + 0.35, e * 0.35]} rad={0.2} m={LANTERN_WHITE} />
            </group>
          ) : (
            <group>
              <Box p={[0, fl + 1.3, 0]} s={[w, 2.6, 0.08]} m={TRAIN_CREAM} />
              <Box p={[0, fl + 1.2, e * 0.3]} s={[1.3, 2.2, 0.6]} c="#2a2420" />
            </group>
          )}
        </group>
      ))}
      {/* 안: 북쪽 긴 붉은 의자, 손잡이 고리, 천장 등 */}
      <group position={[-w / 2 + 0.55, fl, 0]}>
        <Box p={[0, 0.45, 0]} s={[0.6, 0.12, len - 5.4]} m={SEAT_RED} />
        <Box p={[-0.25, 0.85, 0]} s={[0.12, 0.7, len - 5.4]} m={SEAT_RED} />
        <Box p={[0, 0.2, 0]} s={[0.5, 0.4, len - 5.6]} c="#3a2a20" />
      </group>
      <Box p={[0, bodyTop - 0.25, 0]} s={[0.05, 0.05, len - 1]} m={BRASS} />
      {straps.map((z) => (
        <group key={z} position={[0, bodyTop - 0.25, z]}>
          <Box p={[0, -0.2, 0]} s={[0.02, 0.4, 0.02]} c="#e8dcc0" />
          <mesh position={[0, -0.48, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.08, 0.015, 6, 12]} />
            <meshStandardMaterial color="#e8dcc0" />
          </mesh>
        </group>
      ))}
      {[-len / 4, len / 4].map((z) => (
        <Ball key={`lp${z}`} p={[0, bodyTop - 0.12, z]} rad={0.14} m={LANTERN_WHITE} />
      ))}
    </group>
  )
}

// ── 굵은 관 다리 (섬 아래 골짜기를 가로지르는 관 + 철 받침) ──
// item.size [폭, 높이, 길이] (로컬 z 방향 길이)
export function JmPipeBridge({ item }) {
  const [w, h, len] = item.size
  const n = Math.max(2, Math.round(len / 4))
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <Cyl key={x} p={[x, h * 0.6, 0]} rad={0.55} h={len} c="#6f5a48" r={[Math.PI / 2, 0, 0]} />
      ))}
      <Box p={[0, h * 0.6 - 0.75, 0]} s={[w, 0.18, len]} m={IRON} />
      {range(n + 1).map((i) => {
        const z = -len / 2 + (i * len) / n
        return (
          <group key={i} position={[0, 0, z]}>
            <Box p={[0, h * 0.6 + 0.6, 0]} s={[w, 0.12, 0.12]} m={IRON} />
            {[-1, 1].map((s) => (
              <Box key={s} p={[s * (w / 2), h * 0.6, 0]} s={[0.12, 1.4, 0.12]} m={IRON} />
            ))}
          </group>
        )
      })}
      {[-1, 1].map((e) => (
        <Box key={e} p={[0, (h * 0.6) / 2, e * (len / 2 - 0.5)]} s={[w, h * 0.6, 0.8]} c="#7d7262" />
      ))}
    </group>
  )
}

// ── 꽃 핀 키 큰 덤불 울타리 (거리 쪽 정원: 주먹밥 장면 참고) ──
export function JmHedge({ item }) {
  const [len, h, d] = item.size
  const seed = item.seed ?? 0
  const bumps = useMemo(() => range(Math.max(3, Math.round(len / 1.1))).map((i) => ({ p: [-len / 2 + 0.55 + i * ((len - 1.1) / Math.max(1, Math.round(len / 1.1) - 1)), h * (0.55 + srand(seed * 17 + i) * 0.2), (srand(i + seed) - 0.5) * 0.3], s: [0.9, h * 0.55, d * 0.6] })), [len, h, d, seed])
  const flowers = useMemo(() => [['#e47fb4', 0], ['#a98be0', 1], ['#ffffff', 2]].map(([c, k]) => ({ c, items: range(Math.round(len * 1.6)).map((i) => ({ p: [-len / 2 + srand(i * 3 + k + seed * 7) * len, 0.5 + srand(i * 5 + k * 11 + seed) * (h - 0.4), (srand(i * 7 + k) > 0.5 ? 1 : -1) * (d / 2 + 0.05)], s: [0.22, 0.22, 0.22] })) })), [len, h, d, seed])
  return (
    <group>
      <Box p={[0, h * 0.45, 0]} s={[len, h * 0.9, d * 0.85]} c="#5e9a44" />
      <Instances geometry={GEO.sphere} material={mat('#72ad52', { flat: true })} items={bumps} />
      {flowers.map(({ c, items }) => (
        <Instances key={c} geometry={GEO.sphere} material={mat(c, { emissive: c, emissiveIntensity: 0.35 })} items={items} />
      ))}
    </group>
  )
}

// ── 배추밭 ──
export function JmVeggiePatch({ item }) {
  const [w, , d] = item.size
  const heads = useMemo(() => {
    const out = []
    for (let r = 0; r < Math.floor(d / 1.0); r++) for (let c = 0; c < Math.floor(w / 0.9); c++) out.push({ p: [-w / 2 + 0.45 + c * 0.9, 0.3, -d / 2 + 0.5 + r * 1.0], s: [0.38, 0.3, 0.38] })
    return out
  }, [w, d])
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[w, 0.12, d]} c="#6b4a2e" />
      {range(Math.floor(d / 1.0)).map((r) => (
        <Box key={r} p={[0, 0.14, -d / 2 + 0.5 + r]} s={[w - 0.2, 0.08, 0.5]} c="#7a5634" />
      ))}
      <Instances geometry={GEO.sphere} material={mat('#9fd16a', { flat: true })} items={heads} />
    </group>
  )
}

// ── 빨간 지붕 창고 (정원 끝 작은 헛간) ──
export function JmShed({ item }) {
  const [w, h, d] = item.size
  const roof = useMemo(() => hipRoofGeometry(w + 0.6, d + 0.6, h * 0.35, 0.1), [w, d, h])
  return (
    <group>
      <Box p={[0, h * 0.33, 0]} s={[w, h * 0.66, d]} c="#8a6a48" />
      <Box p={[0, h * 0.25, d / 2 + 0.02]} s={[1.4, h * 0.5, 0.05]} c="#3b2a1c" />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * w * 0.3, h * 0.45, d / 2 + 0.02]} s={[0.7, 0.6, 0.05]} c="#e8dcc0" />
      ))}
      <mesh geometry={roof} position={[0, h * 0.66, 0]}>
        <meshStandardMaterial color="#9e4634" flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 풀밭 돌집 (터널 뒤 풀밭에 드문드문, 회색 기와 낮은 집) ──
export function JmFieldHut({ item }) {
  const [w, h, d] = item.size
  const roof = useMemo(() => hipRoofGeometry(w + 0.8, d + 0.8, h * 0.4, 0.12), [w, d, h])
  return (
    <group>
      <Box p={[0, h * 0.3, 0]} s={[w, h * 0.6, d]} c="#a59b8a" />
      <Box p={[0, h * 0.22, d / 2 + 0.02]} s={[1.0, h * 0.44, 0.05]} c="#2a2420" />
      <mesh geometry={roof} position={[0, h * 0.6, 0]}>
        <meshStandardMaterial color="#5e615f" flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 높은 곳 바닥 그림 (길·풀밭·흙길): item.floor = TILE_METERS 무늬 이름 또는 없음(item.color 단색) ──
// (11/25 밤 지민 요청) 돌과 이끼가 섞인 바닥 무늬: 크기 다른 회색 돌 + 틈 이끼 + 군데군데 돌 위 이끼 (3m 한 칸으로 반복)
function mossyStoneBase() {
  // 바닥은 돌, 이끼는 '틈에 끼고 가장자리를 덮는' 느낌 (잔디처럼 넓게 덮지 않음)
  return canvasTexture('jmspirit:mossystone2', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#39432a' // 돌 틈 = 짙은 이끼
    ctx.fillRect(0, 0, w, h)
    let seed = 11
    const r = () => srand(seed++ * 0.53)
    // 틈 이끼 알갱이
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.5 ? '#4a5a30' : '#2f3822'
      ctx.fillRect(r() * w, r() * h, 2, 2)
    }
    const stones = []
    const rows = 7
    for (let j = 0; j < rows; j++) {
      const y = (j * h) / rows
      let x = -r() * 60
      while (x < w) {
        const sw = 46 + r() * 70
        const sh = h / rows - 4 - r() * 4
        const g = 128 + Math.floor(r() * 36)
        const ry = y + 2 + r() * 2
        for (const dx of [0, w, -w]) {
          const rx = x + dx + 2
          ctx.fillStyle = `rgb(${g},${g - 3},${g - 10})`
          ctx.beginPath()
          const rr = 9
          ctx.moveTo(rx + rr, ry)
          ctx.arcTo(rx + sw, ry, rx + sw, ry + sh, rr)
          ctx.arcTo(rx + sw, ry + sh, rx, ry + sh, rr)
          ctx.arcTo(rx, ry + sh, rx, ry, rr)
          ctx.arcTo(rx, ry, rx + sw, ry, rr)
          ctx.fill()
          // 돌 결 (밝고 어두운 점)
          for (let k = 0; k < 10; k++) {
            ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
            ctx.fillRect(rx + r() * sw, ry + r() * sh, 3, 3)
          }
          if (dx === 0) stones.push([rx, ry, sw, sh])
        }
        x += sw + 3 + r() * 3
      }
    }
    // 돌 가장자리·모서리를 덮은 작은 이끼 얼룩 (몇몇 돌만)
    for (const [rx, ry, sw, sh] of stones) {
      if (r() > 0.45) continue
      const n = 2 + Math.floor(r() * 4)
      for (let k = 0; k < n; k++) {
        const edge = r() < 0.5
        const cx = edge ? rx + (r() < 0.5 ? 0 : sw) + (r() - 0.5) * 10 : rx + r() * sw
        const cy = edge ? ry + r() * sh : ry + (r() < 0.5 ? 0 : sh) + (r() - 0.5) * 8
        const rad = 4 + r() * 11
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
        gr.addColorStop(0, 'rgba(78,98,46,0.9)')
        gr.addColorStop(0.7, 'rgba(66,84,40,0.55)')
        gr.addColorStop(1, 'rgba(60,78,38,0)')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(cx, cy, rad, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}
export function JmFloor({ item }) {
  const [w, h, d] = item.size
  const tile = TILE_METERS[item.floor]
  const map = useMemo(() => {
    if (item.floor === 'mossyStone') {
      const t = mossyStoneBase().clone()
      t.wrapS = THREE.RepeatWrapping
      t.wrapT = THREE.RepeatWrapping
      t.repeat.set(w / 3, d / 3)
      t.needsUpdate = true
      return t
    }
    return tile ? getTiledTexture(item.floor, w / tile, d / tile) : null
  }, [item.floor, tile, w, d])
  return (
    <mesh position={[0, 0.03 + Math.min(h, 0.06) / 2, 0]} receiveShadow>
      <boxGeometry args={[w, Math.min(h, 0.06), d]} />
      <meshStandardMaterial map={map} color={map ? '#ffffff' : item.color ?? '#a8946e'} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

// ── 지하 보일러실 (온천장 밑, 섬 지대 안을 비운 공간) — 지민이 보낸 장면 참고 ──
// item.size [w, h, d] (가운데 기준), item.boiler: 생성 스크립트가 넘기는 상대 좌표들. 벽은 섬 지대 돌벽이 대신함
// 캐릭터는 넣지 않음. 서랍장은 벽 두 면 가득(아래 작은 어두운 구멍), 높은 작업대 + 쇠 바퀴 + 유리 항아리 + 노란 주전자 + 사다리,
// 둥근 계기판 달린 화덕 + 바닥 불구멍 + 석탄, 굵은 관·밸브 바퀴·작은 세면대, 꽃무늬 이불 더미, 작은 서랍장, 달력, 작은 미닫이문
const JAR_GLASS = mat('#cfe3d6', { transparent: true, opacity: 0.45, roughness: 0.1 })
const HERB_COLS = ['#7a9a3a', '#b0507a', '#6aa04a']
const KETTLE = mat('#d9b23a', { roughness: 0.35, metalness: 0.4 })
function futonTexture() {
  return canvasTexture('jmspirit:futon', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#a24a36'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? '#f2c94c' : '#f5e6c8'
      const x = (i * 53) % w
      const y = (i * 37) % h
      for (let k = 0; k < 5; k++) {
        ctx.beginPath()
        ctx.ellipse(x + Math.cos((k / 5) * Math.PI * 2) * 9, y + Math.sin((k / 5) * Math.PI * 2) * 9, 7, 4, (k / 5) * Math.PI * 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}
// 벽 달력 (빈 흰 판 → 붉은 달 + 날짜 칸)
function boilerCalendarTexture() {
  return canvasTexture('jmspirit:calendar', 96, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2ead2'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#9e4634'
    ctx.fillRect(0, 0, w, 34)
    ctx.fillStyle = '#f7efe0'
    ctx.font = `bold 24px ${JP_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('十一月', w / 2, 18)
    ctx.fillStyle = '#3a2a1c'
    ctx.font = '11px sans-serif'
    for (let d = 0; d < 30; d++) {
      const c = (d + 3) % 7
      const r = Math.floor((d + 3) / 7)
      ctx.fillStyle = c === 0 ? '#9e4634' : '#3a2a1c'
      ctx.fillText(String(d + 1), 8 + c * 13.3, 46 + r * 16)
    }
  })
}
function ValveWheel({ p, r = 0.5, rot = [0, 0, 0] }) {
  return (
    <group position={p} rotation={rot}>
      <mesh>
        <torusGeometry args={[r, 0.05, 8, 24]} />
        <primitive object={IRON} attach="material" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <Box key={i} p={[0, 0, 0]} s={[r * 2, 0.05, 0.05]} r={[0, 0, (i * Math.PI) / 3]} m={IRON} />
      ))}
      <Cyl p={[0, 0, 0]} rad={0.08} h={0.1} m={IRON} r={[Math.PI / 2, 0, 0]} />
    </group>
  )
}
// ── 계단 난간 (11/26 지민 요청) — 계단 옆 나무 기둥 + 경사 손잡이 + 가운데 가로대 ──
// 소품 기준: 로컬 +z가 올라가는 쪽, z -L/2(높이 0) → +L/2(높이 rise). 충돌 벽은 생성기에서 collider로 따로
const RAIL_WOOD = mat('#6b4428', { roughness: 0.8 })
const RAIL_CAP = mat('#4a2e1c', { roughness: 0.7 })
export function JmStairRail({ item }) {
  const L = item.size[2]
  const rise = item.rail?.rise ?? 0
  const H = 0.95
  const parts = useMemo(() => {
    const n = Math.max(2, Math.round(L / 1.6) + 1)
    const posts = range(n).map((i) => {
      const t = i / (n - 1)
      const z = -L / 2 + 0.08 + t * (L - 0.16)
      const y0 = rise * t
      return { p: [0, y0 + H / 2, z], s: [0.12, H, 0.12] }
    })
    const slope = Math.atan2(rise, L)
    const len = Math.hypot(L, rise)
    return { posts, slope, len }
  }, [L, rise])
  return (
    <group>
      <Instances geometry={GEO.box} material={RAIL_WOOD} items={parts.posts} />
      {/* 손잡이 + 가운데 가로대 (경사 따라) */}
      <Box p={[0, rise / 2 + H, 0]} s={[0.16, 0.08, parts.len + 0.1]} r={[-parts.slope, 0, 0]} m={RAIL_CAP} />
      <Box p={[0, rise / 2 + H * 0.5, 0]} s={[0.06, 0.06, parts.len - 0.1]} r={[-parts.slope, 0, 0]} m={RAIL_WOOD} />
    </group>
  )
}

// ── 까망이 (11/26 지민 요청: 석탄을 누르면 까망이들이 석탄을 하나씩 들고 화덕으로 나르고 돌아옴) ──
// 평소: 석탄 더미 둘레에 옹기종기 앉아 살짝 들썩임 / 클릭: 하나씩 조금씩 늦게 출발 → 깡충깡충 화덕 불구멍까지 → 석탄 던져 넣고 돌아옴
// 털 뭉치는 공 모양 점을 들쭉날쭉 밀어낸 덩어리(어두운 단색) + 흰 눈·검은 눈동자
const SOOT = mat('#0e0c0b', { flat: true, roughness: 1 })
const SOOT_EYE = mat('#ffffff', { roughness: 0.5 })
const SOOT_PUPIL = mat('#050403')
const SOOT_COAL = mat('#2a2522', { flat: true })
let sootGeo = null
function sootGeometry() {
  if (sootGeo) return sootGeo
  const g = new THREE.IcosahedronGeometry(1, 2)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  const seen = new Map() // 같은 자리 점은 같은 길이로 (틈 안 생기게)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
    if (!seen.has(key)) seen.set(key, 0.78 + ((Math.sin(v.x * 91.7 + v.y * 47.3 + v.z * 13.1) * 43758.5) % 1 + 1) % 1 * 0.42)
    v.multiplyScalar(seen.get(key))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  sootGeo = g
  return g
}
const SOOT_N = 10
const SOOT_GO = 1.7 // 화덕까지 가는 시간(초)
const SOOT_TOSS = 0.45
const SOOT_BACK = 1.6
const SOOT_LAG = 0.14 // 하나씩 늦게 출발
function JmSootSprites({ coal, mouth }) {
  const clock = useThree((s) => s.clock)
  const run = useRef(-1)
  const bodies = useRef([])
  const carried = useRef([])
  const geo = useMemo(() => sootGeometry(), [])
  const homes = useMemo(() => range(SOOT_N).map((i) => {
    const a = (i / SOOT_N) * Math.PI * 2 + srand(i + 300) * 0.4
    const r = 1.0 + srand(i + 310) * 0.5
    return { x: coal[0] + Math.cos(a) * r, z: coal[1] + Math.sin(a) * r, s: 0.11 + srand(i + 320) * 0.04, ph: srand(i + 330) * 6 }
  }), [coal])
  const total = SOOT_GO + SOOT_TOSS + SOOT_BACK
  useFrame(() => {
    const t = clock.elapsedTime
    const k = run.current < 0 ? -1 : t - run.current
    if (k > total + SOOT_N * SOOT_LAG) run.current = -1
    for (let i = 0; i < SOOT_N; i++) {
      const g = bodies.current[i]
      if (!g) continue
      const h = homes[i]
      const local = k - i * SOOT_LAG
      let x = h.x, z = h.z, y = h.s * 1.35, face = Math.atan2(h.x - coal[0], h.z - coal[1]) + Math.sin(t * 0.7 + h.ph) * 0.4, carry = false, sq = 1 + Math.sin(t * 4 + h.ph) * 0.06
      if (k >= 0 && local > 0 && local < total) {
        const tx = mouth[0] + (srand(i + 340) - 0.5) * 0.5
        const tz = mouth[1] + (srand(i + 350) - 0.5) * 0.9
        let f
        if (local < SOOT_GO) {
          f = local / SOOT_GO
          carry = true
          face = Math.atan2(tx - h.x, tz - h.z)
        } else if (local < SOOT_GO + SOOT_TOSS) {
          f = 1
          carry = local < SOOT_GO + SOOT_TOSS * 0.4
          face = Math.atan2(tx - h.x, tz - h.z)
        } else {
          f = 1 - (local - SOOT_GO - SOOT_TOSS) / SOOT_BACK
          face = Math.atan2(h.x - tx, h.z - tz)
        }
        const e = f * f * (3 - 2 * f)
        x = h.x + (tx - h.x) * e
        z = h.z + (tz - h.z) * e
        const hop = Math.abs(Math.sin(local * Math.PI * 3.2))
        y = h.s * 1.35 + hop * 0.55 // 석탄 더미(높이 약 0.5m)를 넘어가게
        sq = 1 + (1 - hop) * 0.18 // 땅에 닿을 때 납작
      }
      g.position.set(x, y, z)
      g.rotation.y = face
      g.scale.set(h.s * sq, (h.s / sq), h.s * sq)
      const c = carried.current[i]
      if (c) c.visible = carry
    }
  })
  const poke = (e) => {
    e.stopPropagation()
    if (e.delta > 8) return // 화면을 돌리려고 끈 것은 클릭이 아님
    if (run.current < 0) run.current = clock.elapsedTime
  }
  const hover = (on) => (e) => {
    e.stopPropagation()
    document.body.style.cursor = on ? 'pointer' : ''
  }
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  return (
    <group>
      {/* 석탄 더미 클릭 칸 (안 보임) */}
      <mesh position={[coal[0], 0.35, coal[1]]} onClick={poke} onPointerOver={hover(true)} onPointerOut={hover(false)} userData={{ noMerge: true }}>
        <boxGeometry args={[1.8, 0.7, 1.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {homes.map((h, i) => (
        <group key={i} ref={(el) => (bodies.current[i] = el)} onClick={poke} onPointerOver={hover(true)} onPointerOut={hover(false)}>
          <mesh geometry={geo} material={SOOT} userData={{ noMerge: true }} />
          {/* (영화 장면) 가는 막대 다리 */}
          {[-1, 1].map((sx) => (
            <mesh key={`leg${sx}`} position={[sx * 0.4, -0.98, 0.1]} rotation={[0, 0, sx * 0.25]} scale={[0.06, 0.7, 0.06]} geometry={GEO.box} material={SOOT} userData={{ noMerge: true }} />
          ))}
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.38, 0.22, 1.0]}>
              <mesh scale={0.34} material={SOOT_EYE} userData={{ noMerge: true }}>
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
              <mesh position={[0, 0, 0.24]} scale={0.15} material={SOOT_PUPIL} userData={{ noMerge: true }}>
                <sphereGeometry args={[1, 8, 6]} />
              </mesh>
            </group>
          ))}
          {/* 머리 위로 든 석탄 */}
          <mesh ref={(el) => (carried.current[i] = el)} position={[0, 1.35, 0]} scale={1.5} geometry={GEO.rock} material={SOOT_COAL} visible={false} userData={{ noMerge: true }} />
        </group>
      ))}
    </group>
  )
}
// (11/26 지민이 보낸 영화 장면 12장) 보일러실 다시 그림
//  화덕: 리벳 박힌 구리색 둥근 덩어리 여러 개 + 계기판(관 줄기) + 작은 둥근 창 + 바닥 높이 둥근 불구멍 + 꼭대기 불길
//  바닥: 어두운 흙바닥(주황 티끌) / 서랍장 앞 반들거리는 마루 단, 단 아래 돌 띠에 까망이 아치 구멍
//  서랍장: 큰 나무 서랍 + 반달 손잡이 홈, 맨 위 선반에 붉은 유리 항아리 줄
//  작업대: 미장 둥근 끝 + 큰 쇠 바퀴 + 노란 주전자 + 찻잔 + 지팡이 + 「整理整頓」 세로 판, 천장에서 내려온 끈과 붉은 손잡이
//  화덕 앞 미장 아치, 천장 환풍기, 들어오는 쪽: 세로 보일러 기둥(밸브 바퀴·계기판)·세면대·거울·수건·양동이, 깊은 미장 문틀
const BOIL_COPPER = mat('#a9572f', { roughness: 0.5, metalness: 0.35 })
const BOIL_COPPER_DK = mat('#6e331c', { roughness: 0.6, metalness: 0.3 })
const BOIL_PLASTER = mat('#d4a877', { roughness: 0.95 })
// 불꽃은 빛을 받지 않는 재질 (주황 방 조명을 받으면 허옇게 바래 보였음)
const BOIL_FLAME_IN = new THREE.MeshBasicMaterial({ color: '#ffd24a' })
const BOIL_FLAME = new THREE.MeshBasicMaterial({ color: '#ff6414', transparent: true, opacity: 0.9, depthWrite: false })
const BOIL_RED_JAR = mat('#9a2a18', { emissive: '#5a1006', emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.1 })
const BOIL_HOLE = mat('#120d0a')
function earthFloorTexture() {
  return canvasTexture('jmspirit:earthfloor2', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a3029'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${20 + srand(i) * 40},${16 + srand(i + 1) * 30},${12 + srand(i + 2) * 20},0.35)`
      ctx.fillRect(srand(i + 3) * w, srand(i + 4) * h, 20 + srand(i + 5) * 70, 3 + srand(i + 6) * 6)
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(170,96,44,0.6)' : 'rgba(210,130,60,0.7)'
      ctx.beginPath()
      ctx.arc(srand(i + 100) * w, srand(i + 200) * h, 0.8 + srand(i + 300) * 1.0, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}
function filmDrawerTexture() {
  return canvasTexture('jmspirit:filmdrawers2', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a2c18'
    ctx.fillRect(0, 0, w, h)
    const cols = 4
    const rows = 4
    const cw = w / cols
    const rh = h / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw
        const y = r * rh
        const t = 0.88 + srand(r * 5 + c) * 0.24
        ctx.fillStyle = `rgb(${Math.round(128 * t)},${Math.round(82 * t)},${Math.round(46 * t)})`
        ctx.fillRect(x + 4, y + 4, cw - 8, rh - 8)
        ctx.strokeStyle = 'rgba(60,32,16,0.35)'
        ctx.lineWidth = 1
        for (let k = 0; k < 5; k++) {
          ctx.beginPath()
          ctx.moveTo(x + 8, y + 18 + k * 21 + srand(r + c + k) * 6)
          ctx.bezierCurveTo(x + cw * 0.4, y + 12 + k * 21, x + cw * 0.6, y + 26 + k * 21, x + cw - 8, y + 18 + k * 21)
          ctx.stroke()
        }
        // 반달 손잡이 홈 (위 가운데)
        ctx.fillStyle = '#1e120a'
        ctx.beginPath()
        ctx.ellipse(x + cw / 2, y + 10, cw * 0.14, 9, 0, 0, Math.PI)
        ctx.fill()
      }
    }
    // 굵은 세로·가로 나무 틀 (두 칸마다)
    ctx.fillStyle = '#6a4024'
    for (let c = 0; c <= cols; c += 2) ctx.fillRect(c * cw - 5, 0, 10, h)
    ctx.fillRect(0, 0, w, 6)
  })
}
function stagePlankTexture() {
  return canvasTexture('jmspirit:stageplank', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a6232'
    ctx.fillRect(0, 0, w, h)
    for (let r = 0; r < 4; r++) {
      const y = (r * h) / 4
      ctx.fillStyle = `rgba(255,190,110,${0.08 + srand(r + 60) * 0.1})`
      ctx.fillRect(0, y + 3, w, h / 4 - 6)
      ctx.fillStyle = 'rgba(40,20,8,0.8)'
      ctx.fillRect(0, y, w, 2)
      const off = srand(r + 70) * w
      ctx.fillRect(off, y, 2, h / 4)
    }
  })
}
function glowTexture() {
  return canvasTexture('jmspirit:fireglow', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,170,70,0.85)')
    g.addColorStop(0.5, 'rgba(255,120,40,0.3)')
    g.addColorStop(1, 'rgba(255,100,30,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}
// 둥근 덩어리 겉면 위 한 점(앞쪽 반구, 각 a는 +x에서 z쪽으로)과 바깥 방향
function onBlob(b, a, lat, out = 1.0) {
  const x = b.c[0] + b.r[0] * Math.cos(lat) * Math.cos(a) * out
  const y = b.c[1] + b.r[1] * Math.sin(lat) * out
  const z = b.c[2] + b.r[2] * Math.cos(lat) * Math.sin(a) * out
  const n = new THREE.Vector3((x - b.c[0]) / (b.r[0] * b.r[0]), (y - b.c[1]) / (b.r[1] * b.r[1]), (z - b.c[2]) / (b.r[2] * b.r[2])).normalize()
  return { p: [x, y, z], yaw: Math.atan2(n.x, n.z), pitch: Math.asin(n.y) }
}
function Facing({ at, children }) {
  return (
    <group position={at.p} rotation={[0, at.yaw, 0]}>
      <group rotation={[-at.pitch, 0, 0]}>{children}</group>
    </group>
  )
}
function Gauge({ r = 0.3 }) {
  return (
    <group>
      <mesh position={[0, 0, 0.085]}>
        <circleGeometry args={[r, 24]} />
        <meshStandardMaterial color="#efe4c8" />
      </mesh>
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} material={BRASS}>
        <cylinderGeometry args={[r + 0.06, r + 0.06, 0.08, 24]} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <ringGeometry args={[r, r + 0.06, 24]} />
        <primitive object={BRASS} attach="material" />
      </mesh>
      <Box p={[0.06, 0.1, 0.095]} s={[0.025, r * 0.75, 0.01]} c="#1a1210" r={[0, 0, -0.5]} />
      <Cyl p={[0, -r - 0.25, 0.05]} rad={0.035} h={0.5} m={BOIL_COPPER_DK} />
    </group>
  )
}
function Flames({ spots }) {
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const k = 1 + Math.sin(t * 9 + i * 2.1) * 0.18 + Math.sin(t * 23 + i) * 0.08
      m.scale.set(spots[i].s * (1.1 - k * 0.1), spots[i].s * 1.6 * k, spots[i].s * (1.1 - k * 0.1))
      const r = spots[i].r ?? [0, 0, 0]
      m.rotation.set(r[0] + Math.sin(t * 3.1 + i) * 0.12, 0, r[2] + Math.sin(t * 2.3 + i * 1.7) * 0.15)
    })
  })
  // 바깥 주황 불꽃 + 안쪽 노란 불꽃 (같이 일렁임)
  return spots.map((f, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} position={f.p} rotation={f.r ?? [0, 0, 0]} userData={{ noMerge: true }}>
      {/* 물방울 모양: 둥근 밑 + 위로 길게 빠지는 끝 (바깥 주황 / 안 노랑) */}
      <mesh position={[0, 0.35, 0]} scale={[0.5, 0.45, 0.5]} geometry={GEO.sphere} material={BOIL_FLAME} userData={{ noMerge: true }} />
      <mesh position={[0, 1.05, 0]} scale={[0.5, 1.2, 0.5]} geometry={GEO.cone} material={BOIL_FLAME} userData={{ noMerge: true }} />
      <mesh position={[0, 0.38, 0]} scale={[0.3, 0.3, 0.3]} geometry={GEO.sphere} material={BOIL_FLAME_IN} userData={{ noMerge: true }} />
      <mesh position={[0, 0.85, 0]} scale={[0.3, 0.75, 0.3]} geometry={GEO.cone} material={BOIL_FLAME_IN} userData={{ noMerge: true }} />
    </group>
  ))
}
function CeilingFan({ p }) {
  const blades = useRef(null)
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.y += dt * 2.2
  })
  return (
    <group position={p}>
      {[[0, 0.62, 1.4, 0.16], [0, -0.62, 1.4, 0.16], [0.62, 0, 0.16, 1.4], [-0.62, 0, 0.16, 1.4]].map(([x, z, sx, sz], i) => (
        <Box key={i} p={[x, 0, z]} s={[sx, 0.16, sz]} c="#9a9488" />
      ))}
      {range(5).map((i) => (
        <group key={i}>
          <Box p={[-0.45 + i * 0.225, -0.09, 0]} s={[0.015, 0.015, 1.1]} m={IRON} r={[0, 0.5, 0]} />
          <Box p={[0, -0.09, -0.45 + i * 0.225]} s={[1.1, 0.015, 0.015]} m={IRON} r={[0, 0.5, 0]} />
        </group>
      ))}
      <group ref={blades} position={[0, 0.02, 0]} userData={{ noMerge: true }}>
        {range(4).map((i) => (
          <Box key={i} p={[Math.cos((i * Math.PI) / 2) * 0.28, 0, Math.sin((i * Math.PI) / 2) * 0.28]} s={[0.42, 0.02, 0.2]} r={[0.3, -(i * Math.PI) / 2, 0]} c="#3a3632" />
        ))}
        <Cyl p={[0, 0, 0]} rad={0.08} h={0.08} m={IRON} />
      </group>
    </group>
  )
}
function JmBoilerFurnace() {
  // 가운데 기준, 앞(+x) = 방 쪽. 충돌 상자 3×4 안에 들어가게
  const blobs = useMemo(() => [
    { c: [0.05, 1.3, 0.15], r: [1.3, 1.2, 1.8] },
    { c: [-0.25, 2.95, -0.1], r: [1.4, 1.35, 1.9] },
    { c: [-0.5, 4.4, -0.35], r: [1.0, 0.9, 1.3] },
    { c: [-0.4, 2.3, 1.55], r: [0.85, 1.0, 0.6] },
    { c: [-0.4, 2.6, -1.6], r: [0.8, 0.9, 0.5] },
  ], [])
  const rivets = useMemo(() => {
    const out = []
    blobs.slice(0, 3).forEach((b) => {
      for (const lat of [-0.35, 0.05, 0.45]) {
        for (let a = -1.4; a <= 1.4; a += 0.16) out.push({ p: onBlob(b, a, lat, 1.01).p, s: [0.035, 0.035, 0.035] })
      }
      for (let lat = -0.6; lat <= 0.9; lat += 0.12) out.push({ p: onBlob(b, 0.0, lat, 1.01).p, s: [0.035, 0.035, 0.035] })
    })
    return out
  }, [blobs])
  const ports = useMemo(() => [-0.55, -0.18, 0.2, 0.58].map((a) => onBlob(blobs[2], a, 0.3, 1.0)), [blobs])
  const gauges = useMemo(() => [onBlob(blobs[1], -0.42, 0.28, 1.0), onBlob(blobs[1], 0.5, 0.22, 1.0)], [blobs])
  const knobs = useMemo(() => [-0.12, 0.12].map((a) => onBlob(blobs[0], a, 0.5, 1.0)), [blobs])
  const flames = useMemo(() => [
    { p: [-0.6, 5.05, 0.15], s: 0.55 },
    { p: [-0.2, 4.9, -0.95], s: 0.42, r: [-0.3, 0, 0] },
    { p: [-0.55, 3.0, 2.0], s: 0.42, r: [0.7, 0, 0] },
    { p: [0.55, 3.9, 0.95], s: 0.32, r: [0.4, 0, -0.5] },
    { p: [-0.6, 3.35, -2.0], s: 0.36, r: [-0.7, 0, 0] },
  ], [])
  return (
    <group>
      <Box p={[0, 0.15, 0]} s={[3.1, 0.3, 4.0]} c="#3e241a" />
      {blobs.map((b, i) => (
        <mesh key={i} position={b.c} scale={b.r} geometry={GEO.sphere} material={i > 2 ? BOIL_COPPER_DK : BOIL_COPPER} />
      ))}
      <Instances geometry={GEO.sphere} material={BOIL_COPPER_DK} items={rivets} />
      {ports.map((at, i) => (
        <Facing key={i} at={at}>
          <mesh position={[0, 0, 0.02]} scale={[0.11, 0.15, 1]}>
            <circleGeometry args={[1, 16]} />
            <meshStandardMaterial color="#d9733a" emissive="#ab6a4c" emissiveIntensity={0.6} />
          </mesh>
          <mesh scale={[0.15, 0.19, 0.05]} geometry={GEO.sphere} material={BOIL_COPPER_DK} />
        </Facing>
      ))}
      {gauges.map((at, i) => (
        <Facing key={i} at={at}>
          <Gauge r={i ? 0.24 : 0.3} />
        </Facing>
      ))}
      {knobs.map((at, i) => (
        <Facing key={i} at={at}>
          <mesh scale={[0.1, 0.1, 0.06]} geometry={GEO.sphere} material={IRON} />
        </Facing>
      ))}
      {/* 바닥 높이 둥근 불구멍 (까망이가 석탄을 던져 넣는 곳) */}
      <group position={[1.32, 0.62, 0.3]}>
        <Cyl p={[0, 0, 0]} rad={0.6} h={0.5} m={BOIL_COPPER} r={[0, 0, Math.PI / 2]} />
        <mesh position={[0.26, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[0.42, 0.6, 24]} />
          <primitive object={BOIL_COPPER_DK} attach="material" />
        </mesh>
        <mesh position={[0.25, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.42, 24]} />
          <primitive object={FIRE} attach="material" />
        </mesh>
        {[-0.18, 0, 0.18].map((y) => (
          <Box key={y} p={[0.24, y, 0]} s={[0.02, 0.05, 0.7]} c="#ffd27a" />
        ))}
      </group>
      <Flames spots={flames} />
    </group>
  )
}
export function JmBoilerBasement({ item }) {
  const [w, h, d] = item.size
  const B = item.boiler
  const xL = -w / 2 + 0.05 // 서쪽 벽
  const zN = -d / 2 + 0.05 // 북쪽 벽
  const room = B.stairX // 보일러실 동쪽 끝 (계단 쪽 칸막이)
  const S = B.stage ?? { x0: B.deck[0] - 1.5, x1: B.deck[0] + 1.5, z0: zN, z1: B.deck[1] + 0.8, h: 0.4 }
  const [fx, fz] = B.furnace
  const [px, pz] = B.platform
  const shelfY = h - 1.15
  const tex = useMemo(() => {
    const drawers = filmDrawerTexture()
    return {
      earth: tiled(earthFloorTexture(), w / 3, d / 3),
      stage: tiled(stagePlankTexture(), (S.x1 - S.x0) / 3, (S.z1 - S.z0) / 1.5),
      drawerN: tiled(drawers, (room - xL) / 2.4, (shelfY - S.h) / 2.2),
      drawerW: tiled(drawers, (fz - 2.6 - zN) / 2.4, (shelfY - S.h) / 2.2),
      futon: futonTexture(),
      calendar: boilerCalendarTexture(),
      glow: glowTexture(),
      sign: getJpVerticalTexture('整理整頓', '#3a2216', '#9a7a42', 0.28, '#3a2216'),
    }
  }, [w, d, room, xL, zN, fz, shelfY, S.x0, S.x1, S.z0, S.z1, S.h])
  const coal = useMemo(() => range(48).map((i) => {
    const pile = i < 36
    const [cx, cz] = B.coal
    return pile
      ? { p: [cx + (srand(i) - 0.5) * 1.4, 0.12 + srand(i + 40) * 0.35, cz + (srand(i + 80) - 0.5) * 1.2], s: [0.22, 0.18, 0.22] }
      : { p: [fx + 1.9 + srand(i) * 1.8, 0.06, fz + 0.3 + (srand(i + 9) - 0.5) * 2], s: [0.1, 0.08, 0.1] }
  }), [B, fx, fz])
  const jars = useMemo(() => {
    const out = []
    for (let x = xL + 0.5; x < room - 0.3; x += 0.62) out.push({ p: [x, shelfY + 0.38, zN + 0.3], s: [0.24, 0.3, 0.22] })
    return out
  }, [xL, room, zN, shelfY])
  const holes = useMemo(() => {
    const out = []
    for (let x = S.x0 + 0.5; x < S.x1 - 0.3; x += 0.85) out.push(x)
    return out
  }, [S.x0, S.x1])
  const cols = useMemo(() => [-6.4, -4.3, -2.2, -0.1].map((x) => [x, B.pipes.z]), [B.pipes.z])
  const sink = [room - 0.38, 5.9]
  return (
    <NearOnly radius={42}>
    <group>
      {/* 흙바닥 */}
      {/* 바닥 0.15: 섬 밑 바다(jm_water JmOcean, 깊이를 앞으로 당긴 재질)가 0.06 바닥을 뚫고 보였음 */}
      <mesh position={[0, 0.151, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex.earth} roughness={1} />
      </mesh>
      <Box p={[0, 0.075, 0]} s={[w, 0.15, d]} c="#2a221d" />
      {/* 마루 단: 반들거리는 널 + 앞 가장자리 띠 + 아래 돌 띠의 까망이 아치 구멍 */}
      <group>
        <mesh position={[(S.x0 + S.x1) / 2, S.h + 0.005, (S.z0 + S.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[S.x1 - S.x0, S.z1 - S.z0]} />
          <meshStandardMaterial map={tex.stage} roughness={0.35} metalness={0.05} />
        </mesh>
        <Box p={[(S.x0 + S.x1) / 2, S.h / 2, (S.z0 + S.z1) / 2]} s={[S.x1 - S.x0, S.h, S.z1 - S.z0]} c="#3b322b" />
        <Box p={[(S.x0 + S.x1) / 2, S.h - 0.04, S.z1 + 0.02]} s={[S.x1 - S.x0 + 0.04, 0.1, 0.08]} c="#7a4a26" />
        <Box p={[S.x0 - 0.02, S.h - 0.04, (S.z0 + S.z1) / 2]} s={[0.08, 0.1, S.z1 - S.z0]} c="#7a4a26" />
        {holes.map((x) => (
          <group key={x} position={[x, 0, S.z1 + 0.012]}>
            <Box p={[0, 0.1, 0]} s={[0.26, 0.2, 0.01]} m={BOIL_HOLE} />
            <mesh position={[0, 0.2, 0]}>
              <circleGeometry args={[0.13, 12, 0, Math.PI]} />
              <primitive object={BOIL_HOLE} attach="material" />
            </mesh>
          </group>
        ))}
      </group>
      {/* 서랍장 벽 (단 위 ~ 선반), 맨 위 선반 + 붉은 유리 항아리 줄 */}
      <mesh position={[(xL + room) / 2, (S.h + shelfY) / 2, zN + 0.02]}>
        <planeGeometry args={[room - xL, shelfY - S.h]} />
        <meshStandardMaterial map={tex.drawerN} roughness={0.8} />
      </mesh>
      <mesh position={[xL + 0.02, (S.h + shelfY) / 2, (zN + fz - 2.6) / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[fz - 2.6 - zN, shelfY - S.h]} />
        <meshStandardMaterial map={tex.drawerW} roughness={0.8} />
      </mesh>
      <Box p={[(xL + room) / 2, (shelfY + h) / 2, zN + 0.04]} s={[room - xL, h - shelfY, 0.04]} c="#2a1810" />
      <Box p={[(xL + room) / 2, shelfY, zN + 0.3]} s={[room - xL, 0.08, 0.6]} c="#6a4024" />
      <Instances geometry={GEO.sphere} material={BOIL_RED_JAR} items={jars} />
      {/* 서랍 아래 작은 어두운 구멍(미닫이) + 단 위 낮은 상·방석 */}
      <Box p={[B.hole[0], S.h + 0.45, zN + 0.03]} s={[1.3, 0.9, 0.02]} c="#0b0806" />
      <Box p={[B.hole[0] + 0.85, S.h + 0.45, zN + 0.06]} s={[0.7, 0.9, 0.04]} c="#7a4a2a" />
      <group position={[B.deck[0], S.h, B.deck[1] + 0.1]}>
        <Box p={[0.6, 0.15, 0.1]} s={[0.9, 0.06, 0.55]} c="#3a2a1c" />
        {[-1, 1].map((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[0.6 + sx * 0.38, 0.06, 0.1 + sz * 0.22]} s={[0.05, 0.12, 0.05]} c="#3a2a1c" />))}
        <Box p={[-0.5, 0.05, 0.15]} s={[0.75, 0.1, 0.75]} c="#4a5a8a" />
      </group>
      {/* 작업대: 미장 둥근 끝 + 나무 상자 + 큰 쇠 바퀴 + 방석·주전자·찻잔 + 「整理整頓」 세로 판, 앞 나무 상자 속 유리 항아리 3개 */}
      <group position={[px, 0, pz]}>
        <Box p={[0, 1.1, 0]} s={[3.2, 2.2, 1.6]} c="#7a3a26" />
        {range(9).map((i) => (
          <Box key={i} p={[-1.5 + i * 0.375, 1.1, 0.81]} s={[0.03, 2.1, 0.02]} c="#5a2a1a" />
        ))}
        <Box p={[0.15, 2.25, 0]} s={[3.1, 0.1, 1.8]} c="#5a2a1a" />
        <Box p={[-1.62, 1.05, 0]} s={[0.5, 2.1, 1.75]} m={BOIL_PLASTER} />
        <Cyl p={[-1.62, 2.1, 0]} rad={0.25} h={1.75} m={BOIL_PLASTER} r={[Math.PI / 2, 0, 0]} />
        <ValveWheel p={[0.9, 1.3, 0.9]} r={0.6} />
        <Box p={[-0.3, 2.4, -0.1]} s={[1.6, 0.2, 1.2]} c="#5a3a7a" />
        <group position={[1.15, 2.3, 0.2]}>
          <mesh position={[0, 0.25, 0]} scale={[0.3, 0.25, 0.3]} material={KETTLE}>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
          <Cyl p={[0.32, 0.28, 0]} rad={0.04} h={0.3} m={KETTLE} r={[0, 0, -0.8]} />
          <mesh position={[0, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.18, 0.025, 6, 12, Math.PI]} />
            <primitive object={KETTLE} attach="material" />
          </mesh>
        </group>
        <mesh position={[-1.25, 2.3, 0.25]}>
          <cylinderGeometry args={[0.14, 0.08, 0.16, 12]} />
          <meshStandardMaterial color="#cfe0b0" />
        </mesh>
        <Cyl p={[-0.9, 1.25, 0.95]} rad={0.035} h={2.4} c="#7a4a26" r={[0.12, 0, 0.18]} />
        <Box p={[1.63, 1.1, 0]} s={[0.08, 2.1, 1.5]} c="#2e1a10" />
        <mesh position={[1.68, 1.15, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.5, 1.8]} />
          <meshStandardMaterial map={tex.sign} />
        </mesh>
      </group>
      {/* 천장에서 내려온 끈 + 붉은 손잡이 */}
      <Cyl p={[px + 0.3, (h + 3.2) / 2, pz + 0.5]} rad={0.012} h={h - 3.2} c="#5a4a9a" />
      <Box p={[px + 0.3, 3.05, pz + 0.5]} s={[0.06, 0.3, 0.06]} c="#a95753" />
      <group position={[B.jars[0], 0, B.jars[1]]}>
        <Box p={[0, 0.15, 0]} s={[3.2, 0.3, 0.8]} c="#8a6a48" />
        {[-1, 0, 1].map((i) => (
          <group key={i} position={[i * 0.95, 0.3, 0]}>
            <mesh position={[0, 0.35, 0]} scale={[0.3, 0.3, 0.3]}>
              <sphereGeometry args={[1, 14, 10]} />
              <meshStandardMaterial color={HERB_COLS[i + 1]} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.5, 0]} scale={[0.36, 0.55, 0.36]} material={JAR_GLASS}>
              <sphereGeometry args={[1, 14, 10]} />
            </mesh>
            <Cyl p={[0, 1.08, 0]} rad={0.2} h={0.12} m={KETTLE} />
          </group>
        ))}
      </group>
      {/* 화덕 + 앞 미장 아치 + 바닥 불빛 + 굴뚝 관 */}
      <group position={[fx, 0, fz]}>
        <JmBoilerFurnace />
        {[-1.2, 0, 1.2].map((z) => (
          <Cyl key={z} p={[-0.6, (5.3 + h) / 2, z]} rad={0.28} h={h - 5.3} m={BOIL_COPPER_DK} />
        ))}
      </group>
      <mesh position={[fx + 2.2, 0.16, fz + 0.3]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noMerge: true }}>
        <planeGeometry args={[3.2, 3.2]} />
        <meshBasicMaterial map={tex.glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {B.piers && (() => {
        const [[ax, az], [, bz]] = B.piers
        const ph = 5.2
        return (
          <group>
            {B.piers.map(([x, z]) => (
              <Box key={z} p={[x, ph / 2, z]} s={[0.7, ph, 0.9]} m={BOIL_PLASTER} />
            ))}
            <Box p={[ax, ph + 0.3, (az + bz) / 2]} s={[0.7, 0.6, bz - az + 0.9]} m={BOIL_PLASTER} />
            {[az + 0.45, bz - 0.45].map((z, i) => (
              <Cyl key={z} p={[ax, ph - 0.05, z + (i ? -0.25 : 0.25)]} rad={0.4} h={0.7} m={BOIL_PLASTER} r={[0, 0, Math.PI / 2]} />
            ))}
          </group>
        )
      })()}
      <Instances geometry={GEO.rock} material={mat('#1c1a18', { flat: true })} items={coal} />
      <JmSootSprites coal={B.coal} mouth={[fx + 1.95, fz + 0.3]} />
      {/* 들어오는 쪽 남쪽 벽: 세로 보일러 기둥(밸브 바퀴·계기판) + 위 가로 관 */}
      {cols.map(([x, z], i) => (
        <group key={x} position={[x, 0, z]}>
          <Cyl p={[0, 1.7, 0]} rad={0.45} h={3.4} m={BOIL_COPPER_DK} />
          <Cyl p={[0, 3.45, 0]} rad={0.3} h={0.3} m={BOIL_COPPER_DK} />
          <Cyl p={[0, 0.15, 0]} rad={0.52} h={0.3} m={IRON} />
          <ValveWheel p={[0, 1.3, -0.55]} r={0.38} />
          <group position={[0.1, 2.5, -0.47]} rotation={[0, Math.PI, 0]}>
            <Gauge r={0.22} />
          </group>
          {i % 2 === 0 && <Cyl p={[0, (3.6 + h) / 2, 0.1]} rad={0.14} h={h - 3.6} m={IRON} />}
        </group>
      ))}
      <Cyl p={[(cols[0][0] + cols[3][0]) / 2, 3.75, B.pipes.z + 0.15]} rad={0.2} h={cols[3][0] - cols[0][0] + 0.6} m={IRON} r={[0, 0, Math.PI / 2]} />
      {/* 세면대 + 거울 + 줄에 걸린 수건 + 양동이 (칸막이 벽 쪽) */}
      <group position={[sink[0], 0, sink[1]]}>
        <Box p={[0, 0.85, 0]} s={[0.45, 0.16, 0.6]} c="#c9c4b8" />
        <Box p={[0.06, 0.8, 0]} s={[0.33, 0.1, 0.46]} c="#9d978c" />
        <Cyl p={[0.05, 0.42, 0]} rad={0.05} h={0.8} c="#8a847a" />
        <Box p={[0.18, 1.12, 0]} s={[0.05, 0.4, 0.05]} m={BRASS} />
        <mesh position={[0.24, 1.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.45, 0.55]} />
          <meshStandardMaterial color="#8fa0a4" metalness={0.8} roughness={0.15} />
        </mesh>
      </group>
      <Cyl p={[room - 0.12, 2.35, 2.6]} rad={0.008} h={1.6} c="#2a2a2a" r={[Math.PI / 2, 0, 0]} />
      <group position={[room - 0.14, 2.35, 2.4]}>
        <Box p={[0, -0.32, 0]} s={[0.03, 0.62, 0.42]} c="#e8e2d2" />
        <Box p={[0, -0.02, 0]} s={[0.05, 0.03, 0.46]} c="#5a5a5a" />
      </group>
      <group position={[room - 1.0, 0, 6.25]}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.2, 0.16, 0.44, 14, 1, true]} />
          <meshStandardMaterial color="#9a9a96" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 꽃무늬 이불 더미 + 작은 서랍장 + 달력 */}
      <group position={[B.futon[0], 0, B.futon[1]]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.12 + i * 0.18, 0]} scale={[1, 0.09, 0.7]}>
            <boxGeometry args={[2 - i * 0.1, 2, 2 - i * 0.1]} />
            <meshStandardMaterial map={tex.futon} />
          </mesh>
        ))}
      </group>
      <group position={[B.chest[0], 0, B.chest[1]]}>
        <Box p={[0, 0.55, 0]} s={[1.2, 1.1, 0.6]} c="#6b4a30" />
        {[0.3, 0.65, 0.95].map((y) => (
          <Box key={y} p={[0, y, 0.31]} s={[1.0, 0.02, 0.02]} c="#3a2a1c" />
        ))}
      </group>
      <mesh position={[room - 0.14, 1.75, B.chest[1] + 1.4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.42, 0.56]} />
        <meshStandardMaterial map={tex.calendar} />
      </mesh>
      {/* 계단 쪽 나무 칸막이 + 깊은 미장 문틀 (영화 속 들어오는 문) */}
      {B.part && (() => {
        const [a, b] = B.part.door
        return (
          <group>
            <Box p={[B.part.x, h / 2, (zN + a) / 2]} s={[0.25, h, a - zN]} c="#6b4630" />
            <Box p={[B.part.x, h / 2, (b + d / 2) / 2]} s={[0.25, h, d / 2 - b]} c="#6b4630" />
            <Box p={[B.part.x, (B.part.h + h) / 2, (a + b) / 2]} s={[0.25, h - B.part.h, b - a]} c="#6b4630" />
            {[a, b].map((z) => (
              <Box key={z} p={[B.part.x, (B.part.h + 0.25) / 2, z]} s={[0.75, B.part.h + 0.25, 0.12]} m={BOIL_PLASTER} />
            ))}
            <Box p={[B.part.x, B.part.h + 0.13, (a + b) / 2]} s={[0.75, 0.26, b - a + 0.12]} m={BOIL_PLASTER} />
          </group>
        )
      })()}
      {/* 천장 관 + 환풍기 + 매달린 알전구 */}
      {[-d / 4, d / 4].map((z) => (
        <Cyl key={z} p={[(xL + room) / 2, h - 0.5, z]} rad={0.18} h={room - xL} m={IRON} r={[0, 0, Math.PI / 2]} />
      ))}
      <CeilingFan p={[px - 0.5, h - 0.1, 1.6]} />
      {[[-4, 0], [1, -1.5]].map(([x, z]) => (
        <group key={x} position={[x, h - 1.8, z]}>
          <Cyl p={[0, 0.9, 0]} rad={0.01} h={1.6} c="#1a1a1a" />
          <mesh scale={[0.1, 0.13, 0.1]} geometry={GEO.sphere} material={LANTERN_WHITE} />
        </group>
      ))}
    </group>
    </NearOnly>
  )
}

// ── 로비 구석 지하 계단실 (작은 문 + 「釜場」 노렌) ──
// item.size [w, h, d] = 계단실(로컬 x·z), item.door [문 가운데 z(계단실 기준), 폭, 높이]. 문은 서쪽(-x) 벽
export function JmBasementDoor({ item }) {
  const [w, h, d] = item.size
  const [dz, dw, dh] = item.door
  const x = -w / 2
  return (
    <group>
      {/* 서쪽 벽(문 자리 비움) + 북쪽 벽: 짙은 나무 판 */}
      <Box p={[x, h / 2, (-d / 2 + dz - dw / 2) / 2]} s={[0.25, h, dz - dw / 2 + d / 2]} c="#5a3d2a" />
      <Box p={[x, h / 2, (dz + dw / 2 + d / 2) / 2]} s={[0.25, h, d / 2 - dz - dw / 2]} c="#5a3d2a" />
      <Box p={[x, (dh + h) / 2, dz]} s={[0.25, h - dh, dw]} c="#5a3d2a" />
      <Box p={[0, h / 2, -d / 2]} s={[w, h, 0.25]} c="#5a3d2a" />
      {/* (11/26 여관 점검) 로비 쪽 두 면이 7m 높이 밋밋한 갈색 판이었음 → 아래 징두리 판 + 세로 살 + 가로 띠 + 붉은 모서리 기둥 */}
      {(() => {
        const out = 0.14
        const bat = []
        const skip = (z) => Math.abs(z - dz) < dw / 2 + 0.25
        for (let z = -d / 2 + 0.6; z < d / 2 - 0.3; z += 1.0) if (!skip(z)) bat.push([x - out, z, 'w'])
        for (let xx = -w / 2 + 0.6; xx < w / 2 - 0.3; xx += 1.0) bat.push([xx, -d / 2 - out, 'n'])
        const lowW = [[-d / 2, dz - dw / 2], [dz + dw / 2, d / 2]].filter(([a, b]) => b - a > 0.1)
        return (
          <group>
            {lowW.map(([a, b]) => (
              <Box key={a} p={[x - 0.15, 0.5, (a + b) / 2]} s={[0.04, 1.0, b - a]} c="#3e2819" />
            ))}
            <Box p={[0, 0.5, -d / 2 - 0.15]} s={[w, 1.0, 0.04]} c="#3e2819" />
            {bat.map(([bx, bz, f]) => (
              <Box key={`${f}${bx}${bz}`} p={[bx, h / 2, bz]} s={f === 'w' ? [0.04, h, 0.08] : [0.08, h, 0.04]} c="#2e1d12" />
            ))}
            {[1.0, h - 0.35].map((y) => (
              <group key={y}>
                {lowW.map(([a, b]) => (y > dh ? null : <Box key={a} p={[x - 0.18, y, (a + b) / 2]} s={[0.06, 0.1, b - a]} c="#22150d" />))}
                {y > dh && <Box p={[x - 0.18, y, 0]} s={[0.06, 0.12, d]} c="#22150d" />}
                <Box p={[0, y, -d / 2 - 0.18]} s={[w, y > dh ? 0.12 : 0.1, 0.06]} c="#22150d" />
              </group>
            ))}
            {[[x, -d / 2], [x, d / 2 - 0.15]].map(([cx, cz]) => (
              <Box key={cz} p={[cx - 0.05, h / 2, cz]} s={[0.32, h, 0.32]} c="#9e4634" />
            ))}
          </group>
        )
      })()}
      {item.well && (
        <group>
          {/* 계단실: 두 계단 사이 판자 칸막이, 쉼터 뒤 벽, 1층 바닥 끝 나무 난간 */}
          <Box p={[item.well.divider[0], -item.well.depth / 2, item.well.divider[1]]} s={[0.25, item.well.depth, item.well.divider[2]]} c="#4a3222" />
          <Box p={[0, -item.well.depth / 2, item.well.back]} s={[w, item.well.depth, 0.25]} c="#3e2a1c" />
          <Box p={[item.well.rail[0], 0.95, item.well.rail[1]]} s={[item.well.rail[2], 0.08, 0.12]} c="#2a1a12" />
          {[-0.5, 0, 0.5].map((t) => (
            <Box key={t} p={[item.well.rail[0] + t * (item.well.rail[2] - 0.2), 0.48, item.well.rail[1]]} s={[0.1, 0.95, 0.1]} c="#2a1a12" />
          ))}
        </group>
      )}
      {/* 작은 문틀 + 노렌 + 문 위 등 */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[x - 0.08, dh / 2, dz + s * (dw / 2 + 0.06)]} s={[0.14, dh, 0.12]} c="#2a1a12" />
      ))}
      <Box p={[x - 0.08, dh + 0.08, dz]} s={[0.16, 0.16, dw + 0.4]} c="#2a1a12" />
      <mesh position={[x - 0.16, dh - 0.45, dz]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[dw - 0.1, 0.8]} />
        <GlowMaterial glow={0.4} map={getJpSignTexture('釜場', '#2a1a12', '#f3e6c8', (dw - 0.1) / 0.8)} side={THREE.DoubleSide} />
      </mesh>
      <Ball p={[x - 0.3, dh + 0.45, dz]} rad={0.14} m={LANTERN_WHITE} />
      <mesh position={[x - 0.14, dh + 0.9, dz]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.6, 0.45]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture('地下 釜場', '#f3e6c8', '#2a1a12', 1.6 / 0.45)} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 깃발 단 굴뚝 ──
export function JmChimney({ item }) {
  const [, h] = item.size
  return (
    <group>
      <Cyl p={[0, h / 2, 0]} rad={0.9} h={h} c="#7d5a48" />
      {range(Math.floor(h / 6)).map((i) => (
        <Cyl key={i} p={[0, 6 + i * 6, 0]} rad={0.95} h={0.25} c="#4a3a30" />
      ))}
      <Cyl p={[0, h + 0.2, 0]} rad={1.05} h={0.4} c="#2e2a26" />
      <Box p={[1.6, h - 2, 0]} s={[2.4, 0.12, 0.12]} m={IRON} />
      <mesh position={[2.3, h - 3.6, 0]}>
        <planeGeometry args={[1.8, 2.8]} />
        <meshStandardMaterial map={flagTexture()} side={THREE.DoubleSide} />
      </mesh>
      {range(4).map((i) => (
        <mesh key={i} position={[0.3 * i, h + 1 + i * 1.3, 0.2 * i]} scale={[0.9 + i * 0.5, 0.6 + i * 0.3, 0.9 + i * 0.5]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#d9d4ce" transparent opacity={0.35 - i * 0.06} />
        </mesh>
      ))}
    </group>
  )
}

// ── 보이지 않는 벽(jmCollider): 높고 넓은 벽은 카메라 막이(camera-blocker)로도 등록 ──
// 공용 FollowCamera는 이름이 camera-blocker인 물체만 피함. 애니 구역은 건물(buildings)이 없어 카메라가 벽을 뚫던 문제 (11/25)
//   공용 카메라는 플레이 시작 때 한 번만 camera-blocker를 모으므로, 늦게 그려진 막이는 스스로 controls.colliderMeshes에 넣고 빠짐
export function JmCollider({ item }) {
  const [w, h, d] = item.size
  // (11/26) 층 사이 바닥판·지붕판(_slab)도 막이로: 얇아서(0.3m) 높이 조건에 안 걸려, 여러 층 건물(온천장) 안에서
  //   카메라가 천장을 뚫고 위층 바닥 속으로 들어가 화면이 갈색으로 가리던 문제. 좁은 띠(폭 1.5m 미만)는 그대로 둠
  const slab = /_slab/.test(item.id) && Math.min(w, d) >= 1.5
  const block = item.camera ?? (slab || (h >= 1.8 && Math.max(w, d) >= 1.5 && !/_rail|_pier|_pillar|_post/.test(item.id)))
  const ref = useRef(null)
  const controls = useThree((s) => s.controls)
  useEffect(() => {
    const mesh = ref.current
    const list = controls?.colliderMeshes
    if (!block || !mesh || !Array.isArray(list)) return undefined
    if (!list.includes(mesh)) list.push(mesh)
    return () => {
      const i = list.indexOf(mesh)
      if (i >= 0) list.splice(i, 1)
    }
  }, [controls, block])
  if (!block) return null
  return <mesh ref={ref} name="camera-blocker" visible={false} geometry={GEO.box} position={[0, h / 2, 0]} scale={[w, h, d]} />
}

// ── 붉은 등대 모양 석등 (11/26 지민이 보낸 큰길 사진: 계단 위 소나무 옆) ──
// 돌 받침 → 붉은 기둥(아래가 퍼짐) → 흰 창 등 칸(불빛) → 붉은 처마 지붕 + 보주
export function JmRedLanternTower() {
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[1.3, 0.4, 1.3]} m={STONE} />
      <Box p={[0, 0.5, 0]} s={[1.0, 0.2, 1.0]} m={STONE} />
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.24, 0.42, 1.9, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color="#a44c38" roughness={0.7} flatShading />
      </mesh>
      <Box p={[0, 2.55, 0]} s={[0.95, 0.12, 0.95]} c="#8a241c" />
      <Box p={[0, 3.0, 0]} s={[0.8, 0.8, 0.8]} c="#a44c38" />
      {[0, 1, 2, 3].map((k) => (
        <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
          <mesh position={[0, 3.0, 0.41]}>
            <planeGeometry args={[0.5, 0.55]} />
            <meshStandardMaterial color="#fff1d6" emissive="#ffcf7a" emissiveIntensity={1.0} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 3.55, 0]}>
        <cylinderGeometry args={[0.15, 0.8, 0.4, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color="#8a241c" roughness={0.7} flatShading />
      </mesh>
      <Ball p={[0, 3.88, 0]} rad={0.14} m={BRASS} />
    </group>
  )
}

// ── 마을 입구 마당 집 두 채 (11/26 지민이 보낸 마을 첫 장면 참고) ──
// 분홍 회벽 집: 벗겨진 자리(푸른 회색), 위 둥근 노란 차양 띠, 둥근 창 달린 초록 아치 문, 마름모 색유리 두 짝 아치 창, 벽의 꽃 부조, 초록 갓 벽등, 화분, 굽은 돌 화단
export function JmPinkHouse({ item }) {
  const [w, h, d] = item.size
  const f = d / 2
  const flakes = useMemo(() => range(9).map((i) => [(srand(i * 3 + 1) - 0.5) * (w - 1), 1 + srand(i * 5 + 2) * (h - 2.5), 0.4 + srand(i * 7) * 0.9, 0.3 + srand(i * 11) * 0.5]), [w, h])
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c="#d98a80" />
      {flakes.map(([x, y, a, b], i) => (
        <mesh key={`fk${i}`} position={[x, y, f + 0.01]} scale={[a, b, 1]}>
          <circleGeometry args={[1, 7]} />
          <meshStandardMaterial color={i % 3 ? '#a9b4c2' : '#c9c2b6'} roughness={1} />
        </mesh>
      ))}
      {/* 위 둥근 노란 차양 띠 */}
      <mesh position={[0, h - 1.0, f + 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, w + 0.3, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#e2c36a" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <Box p={[0, h - 0.4, 0]} s={[w + 0.3, 0.3, d + 0.3]} c="#c9a55a" />
      {/* 초록 아치 문 + 둥근 창 */}
      <group position={[-w * 0.22, 0, f + 0.02]}>
        <Box p={[0, 1.05, 0]} s={[1.15, 2.1, 0.06]} c="#5f9a6a" />
        <mesh position={[0, 2.1, 0]}>
          <circleGeometry args={[0.575, 16, 0, Math.PI]} />
          <meshStandardMaterial color="#5f9a6a" />
        </mesh>
        <mesh position={[0.1, 1.75, 0.04]}>
          <ringGeometry args={[0.13, 0.19, 16]} />
          <meshStandardMaterial color="#e8dcc0" />
        </mesh>
        <Box p={[0.35, 1.05, 0.05]} s={[0.18, 0.05, 0.05]} m={BRASS} />
        <Box p={[0, 1.4, -0.01]} s={[1.45, 2.9, 0.04]} c="#b8735f" />
      </group>
      {/* 마름모 색유리 두 짝 아치 창 */}
      {[-0.55, 0.55].map((dx) => (
        <group key={dx} position={[w * 0.18 + dx, 2.3, f + 0.03]}>
          {/* (11/26 점검) 유리판이 창틀 앞면과 같은 깊이라 겹쳐 깜빡이며 대각선으로 잘려 보였음 → 앞으로 */}
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[0.95, 1.5]} />
            <meshStandardMaterial map={stainedTexture()} emissiveMap={stainedTexture()} emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          <Box p={[0, 0, -0.02]} s={[1.08, 1.62, 0.04]} c="#e8d9b0" />
        </group>
      ))}
      <Box p={[w * 0.18, 1.45, f + 0.12]} s={[2.5, 0.12, 0.25]} c="#e8d9b0" />
      {/* 반달 창 (차양 밑) */}
      <mesh position={[-w * 0.05, h - 2.0, f + 0.02]}>
        <circleGeometry args={[0.6, 16, 0, Math.PI]} />
        <meshStandardMaterial color="#3a3a44" />
      </mesh>
      {/* 벽의 꽃 부조 */}
      <group position={[-w * 0.4, 1.9, f + 0.05]}>
        {range(6).map((k) => (
          <mesh key={k} geometry={GEO.sphere} position={[Math.cos((k * Math.PI) / 3) * 0.32, Math.sin((k * Math.PI) / 3) * 0.32, 0]} scale={[0.22, 0.22, 0.08]}>
            <meshStandardMaterial color="#efd6a0" />
          </mesh>
        ))}
        <mesh geometry={GEO.sphere} scale={[0.16, 0.16, 0.1]}>
          <meshStandardMaterial color="#d9a75a" />
        </mesh>
        <Box p={[0, -0.85, 0]} s={[0.06, 1.1, 0.04]} c="#8fae7a" />
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={GEO.sphere} position={[sx * 0.25, -0.9, 0]} rotation={[0, 0, sx * 0.6]} scale={[0.26, 0.1, 0.05]}>
            <meshStandardMaterial color="#8fae7a" />
          </mesh>
        ))}
      </group>
      {/* 초록 갓 벽등 3 */}
      {[-0.3, 0.05, 0.38].map((t, i) => (
        <group key={`wl${i}`} position={[t * w, h - 2.6, f + 0.05]}>
          <Box p={[0, 0, 0.2]} s={[0.04, 0.04, 0.4]} m={IRON} />
          <Box p={[0, -0.3, 0.4]} s={[0.24, 0.36, 0.24]} m={LANTERN_WHITE} />
          <mesh position={[0, -0.05, 0.4]}>
            <coneGeometry args={[0.22, 0.2, 4]} />
            <meshStandardMaterial color="#3f7a5a" />
          </mesh>
        </group>
      ))}
      {/* 화분 + 굽은 돌 화단 */}
      {[-0.4, -0.33].map((t, i) => (
        <group key={`pt${i}`} position={[t * w + i * 0.3, 0, f + 0.5]}>
          <Cyl p={[0, 0.18, 0]} rad={0.17} h={0.36} c="#b8603e" />
          <mesh geometry={GEO.ico} position={[0, 0.48, 0]} scale={0.2}>
            <meshStandardMaterial color="#5f8a3a" flatShading />
          </mesh>
        </group>
      ))}
      {/* (11/26 점검) 빈 굽은 돌띠만 있어 이상한 돌판처럼 보였음 → 흙 + 풀·꽃을 심은 화단으로 */}
      <group position={[w * 0.05, 0, f + 1.6]}>
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.3, 0.28, 6, 14, Math.PI * 0.9]} />
          <meshStandardMaterial color="#b9b2a2" roughness={1} />
        </mesh>
        {range(9).map((i) => {
          const a = (Math.PI * 0.9 * (i + 0.5)) / 9
          return (
            <group key={`fb${i}`} position={[Math.cos(a) * 1.3, 0.5, -Math.sin(a) * 1.3]}>
              <mesh geometry={GEO.ico} scale={[0.26, 0.2, 0.26]}>
                <meshStandardMaterial color={i % 2 ? '#5f8a3a' : '#4f7a34'} flatShading />
              </mesh>
              <mesh geometry={GEO.sphere} position={[0.05, 0.16, 0]} scale={0.07}>
                <meshStandardMaterial color={['#f2c94c', '#e86a8a', '#f5f0e6'][i % 3]} />
              </mesh>
            </group>
          )
        })}
      </group>
      {/* 지붕 */}
      <Box p={[0, h + 0.05, 0]} s={[w, 0.1, d]} c="#6a5a4a" />
    </group>
  )
}

// 나무 툇마루 가게: 높은 마루 + 난간, 옆 나무 계단, 처마 밑 세로 간판, 붉은 위층 판
export function JmVerandaShop({ item }) {
  const [w, h, d] = item.size
  const f = d / 2
  const deck = 1.1
  return (
    <group>
      <Box p={[0, deck / 2, 0]} s={[w, deck, d]} c="#4a3626" />
      {range(Math.round(w / 0.25)).map((i) => (
        <Box key={`dp${i}`} p={[-w / 2 + 0.12 + i * 0.25, deck + 0.02, f - 1.2]} s={[0.22, 0.04, 2.4]} c={i % 2 ? '#8a6544' : '#7a5838'} />
      ))}
      <Box p={[0, deck + (h - deck) / 2, -1.2]} s={[w, h - deck, d - 2.4]} c="#6b4a30" />
      <Box p={[0, h - 1.4, f - 2.38]} s={[w - 0.6, 1.6, 0.06]} c="#b03a4a" />
      <Box p={[0, deck + 1.1, f - 2.38]} s={[w - 1.2, 1.8, 0.04]} m={DARK} />
      {/* 기둥 + 처마 */}
      {[-1, 0, 1].map((k) => (
        <Box key={`po${k}`} p={[k * (w / 2 - 0.2), deck + (h - deck) / 2, f - 0.15]} s={[0.2, h - deck, 0.2]} c="#5a3e28" />
      ))}
      <Box p={[0, h + 0.1, f - 1.0]} s={[w + 0.5, 0.15, 2.8]} c="#3e3a36" />
      {/* 난간 (앞·옆) */}
      <Box p={[0, deck + 0.95, f - 0.1]} s={[w - 1.6, 0.07, 0.07]} c="#8a6a48" />
      {range(Math.round((w - 1.6) / 0.22)).map((i) => (
        <Box key={`rl${i}`} p={[-(w - 1.6) / 2 + i * 0.22, deck + 0.5, f - 0.1]} s={[0.045, 0.9, 0.045]} c="#8a6a48" />
      ))}
      {/* 옆 나무 계단 */}
      {range(4).map((i) => (
        <Box key={`stp${i}`} p={[w / 2 - 0.6, (deck * (i + 1)) / 4 - 0.05, f + 0.9 - i * 0.28]} s={[1.0, 0.08, 0.3]} c="#7a5838" />
      ))}
      {[-1, 1].map((sx) => (
        <Box key={sx} p={[w / 2 - 0.6 + sx * 0.5, deck / 2, f + 0.5]} s={[0.07, deck + 0.3, 1.2]} r={[0.75, 0, 0]} c="#5a3e28" />
      ))}
      {/* 처마 밑 세로 간판 (우리 글자) */}
      <VerticalSign text="甘味あり" p={[-w * 0.15, h - 1.4, f - 0.05]} h={2.2} bg="#efe4c8" fg="#7a1d12" />
    </group>
  )
}

// ── 장면 골목 입구: 가게 줄을 뚫고 들어가는 둥근 지붕 짧은 터널 (11/26 지민 요청 + 큰길 사진의 골목 입구 참고) ──
// 큰길 쪽 앞면: 둥근 아치 문틀(두꺼운 띠 + 밝은 테) — 띠 위에 작품 이름을 아치를 따라, 안쪽·바깥쪽 테에 전구 줄
// 그 뒤로 반원 지붕(골이 진 밝은 판 + 갈비 기둥)이 골목 안으로 depth만큼, 양옆은 회벽 + 아래 돌띠. 안에는 갓 전등과 장면 설명 판
// item.size [골목 폭(안쪽), 높이, 깊이], item.title, item.sub, item.color(문틀 띠 색). 앞 = +z(큰길 쪽), 터널은 -z로
function archBandTexture(title, color, ratio) {
  return canvasTexture(`jmspirit:arch2:${title}:${color}:${ratio.toFixed(2)}`, 1024, 1024, (ctx, w) => {
    const c = w / 2
    const rOut = c
    const rIn = c * ratio
    ctx.clearRect(0, 0, w, w)
    ctx.beginPath()
    ctx.arc(c, c, rOut, Math.PI, 0)
    ctx.arc(c, c, rIn, 0, Math.PI, true)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    // 바랜 칠·얼룩
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,236,210' : '60,30,20'},${0.03 + Math.random() * 0.07})`
      ctx.beginPath()
      ctx.arc(Math.random() * w, Math.random() * c, 8 + Math.random() * 36, 0, Math.PI * 2)
      ctx.fill()
    }
    // 테 두 줄 (밝은 칠 + 짙은 선)
    for (const [r, col, lw] of [[rOut - 10, '#f0d9b0', 14], [rOut - 22, '#3a2416', 4], [rIn + 10, '#f0d9b0', 14], [rIn + 22, '#3a2416', 4]]) {
      ctx.lineWidth = lw
      ctx.strokeStyle = col
      ctx.beginPath()
      ctx.arc(c, c, r, Math.PI, 0)
      ctx.stroke()
    }
    const chars = [...title]
    const R = (rOut + rIn) / 2
    const band = rOut - rIn
    // (11/26) 긴 장면 이름도 띠 안에 들어가게 글자 크기를 줄임 (띠 길이의 82%까지)
    const fs = Math.min(band * 0.5, (Math.PI * 0.82 * R) / (chars.length * 1.08))
    const span = Math.min(Math.PI * 0.82, chars.length * (fs * 1.08) / R)
    ctx.font = `bold ${Math.round(fs)}px ${JP_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chars.forEach((ch, i) => {
      const t = chars.length === 1 ? 0.5 : i / (chars.length - 1)
      const th = Math.PI / 2 + span / 2 - t * span
      ctx.save()
      ctx.translate(c + R * Math.cos(th), c - R * Math.sin(th))
      ctx.rotate(Math.PI / 2 - th)
      ctx.fillStyle = '#2a1a10'
      ctx.fillText(ch, 5, 5)
      ctx.fillStyle = '#fff3d6'
      ctx.fillText(ch, 0, 0)
      ctx.restore()
    })
  })
}
const ARCH_ROOF = mat('#d9cfb4', { roughness: 0.6, emissive: '#3a3020', emissiveIntensity: 0.25, double: true })
const ARCH_RIB = mat('#8a7a5e', { roughness: 0.8 })
const ARCH_TRIM = mat('#f0d9b0', { roughness: 0.8 })
const BULB_PINK = mat('#ffd0d8', { emissive: '#ff7a9a', emissiveIntensity: 1.3 })
// 아치 모양으로 뚫린 벽 판 (폭 fw, 높이 fh, 뚫린 곳: 다리 ±R 높이 spring까지 + 위 반원 R). 판이 아치보다 좁으면 아치 곡선 위만 남김
const ARCH_WALL_CACHE = new Map()
function archWallGeometry(fw, fh, R, spring, depth) {
  const key = [fw, fh, R, spring, depth].map((v) => v.toFixed(3)).join(':')
  if (ARCH_WALL_CACHE.has(key)) return ARCH_WALL_CACHE.get(key)
  const hw = fw / 2
  const sh = new THREE.Shape()
  if (R < hw - 0.01) {
    sh.moveTo(-hw, 0)
    sh.lineTo(-hw, fh)
    sh.lineTo(hw, fh)
    sh.lineTo(hw, 0)
    sh.lineTo(R, 0)
    sh.lineTo(R, spring)
    sh.absarc(0, spring, R, 0, Math.PI, false)
    sh.lineTo(-R, 0)
    sh.lineTo(-hw, 0)
  } else {
    const a0 = Math.acos(Math.min(1, hw / R))
    const yEdge = spring + R * Math.sin(a0)
    sh.moveTo(-hw, yEdge)
    sh.lineTo(-hw, fh)
    sh.lineTo(hw, fh)
    sh.lineTo(hw, yEdge)
    sh.absarc(0, spring, R, a0, Math.PI - a0, false)
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 28 })
  ARCH_WALL_CACHE.set(key, g)
  return g
}
export function JmAlleyArch({ item }) {
  const [span, , depth = 5] = item.size
  const spring = 3.0 // 아치가 휘기 시작하는 높이
  const r = span / 2 // 안쪽 반지름
  const band = 0.95 // 문틀 띠 폭
  const color = item.color ?? '#b1705f'
  const ratio = r / (r + band)
  const tex = archBandTexture(item.title ?? '', color, ratio)
  const geo = useMemo(() => {
    // 문틀: 바깥(네모 + 위 반원)에서 안쪽(네모 + 위 반원)을 뺀 판, 두께 0.45
    const R = r + band
    const sh = new THREE.Shape()
    sh.moveTo(-R, 0)
    sh.lineTo(R, 0)
    sh.lineTo(R, spring)
    sh.absarc(0, spring, R, 0, Math.PI, false)
    sh.lineTo(-R, 0)
    const hole = new THREE.Path()
    hole.moveTo(-r, 0)
    hole.lineTo(-r, spring)
    hole.absarc(0, spring, r, Math.PI, 0, true)
    hole.lineTo(r, 0)
    hole.lineTo(-r, 0)
    sh.holes.push(hole)
    const frame = new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 })
    const ring = new THREE.RingGeometry(r, R, 48, 1, 0, Math.PI)
    // 반원 지붕 (안쪽에서도 보이게 양면) — 원통의 위쪽 반
    // (11/26 지민 요청: 아치 옆에 네모난 벽 상자가 같이 보임 → 터널 몸통 전체를 아치 모양으로)
    //   다리(곧게) + 위 반원으로 된 두께 0.3 둥근 굴 껍데기를 터널 깊이만큼 밀어 냄 → 밖에서 봐도 안에서 봐도 아치
    const T = 0.3
    const vs = new THREE.Shape()
    vs.moveTo(-(r + T), 0)
    vs.lineTo(-(r + T), spring)
    vs.absarc(0, spring, r + T, Math.PI, 0, true)
    vs.lineTo(r + T, 0)
    vs.lineTo(r, 0)
    vs.lineTo(r, spring)
    vs.absarc(0, spring, r, 0, Math.PI, false)
    vs.lineTo(-r, 0)
    vs.lineTo(-(r + T), 0)
    const vault = new THREE.ExtrudeGeometry(vs, { depth, bevelEnabled: false, curveSegments: 28 })
    return { frame, ring, vault }
  }, [r, band, spring, depth])
  const bulbs = (rad, n) => range(n).map((i) => {
    const th = (Math.PI * (i + 0.5)) / n
    return [Math.cos(th) * rad, spring + Math.sin(th) * rad]
  })
  const legBulbs = (x) => range(5).map((i) => [x, 0.5 + i * 0.55])
  return (
    <group>
      {/* 앞 문틀 + 띠 글자 */}
      <mesh geometry={geo.frame} material={mat(color, { roughness: 0.85 })} position={[0, 0, -0.45]} />
      {/* (11/26) 띠 글자판은 문틀 앞면(+모서리 0.04)보다 앞에 둬야 보임 */}
      <mesh geometry={geo.ring} position={[0, spring, 0.06]}>
        <meshStandardMaterial map={tex} transparent alphaTest={0.4} roughness={0.85} />
      </mesh>
      {/* 다리 쪽 밝은 띠 (문틀 앞면에 붙은 얇은 칠). 다리 밑·꺾이는 곳에 튀어나오던 네모 받침은 뺌 */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (r + band / 2), spring / 2, 0.06]} s={[band * 0.86, spring, 0.02]} m={ARCH_TRIM} />
      ))}
      {/* 전구: 아치 안쪽·바깥쪽 테 + 다리 */}
      {[...bulbs(r + 0.14, 15), ...bulbs(r + band - 0.12, 21), ...legBulbs(-(r + 0.14)), ...legBulbs(r + 0.14)].map(([x, y], i) => (
        <Ball key={`b${i}`} p={[x, y, 0.1]} rad={0.065} m={i % 3 === 1 ? BULB_PINK : LANTERN_RED} />
      ))}
      {/* 둥근 굴 껍데기 (다리 + 반원 지붕 한 덩어리) + 갈비 */}
      <mesh geometry={geo.vault} material={ARCH_ROOF} position={[0, 0, -0.45 - depth]} />
      {range(Math.max(2, Math.round(depth / 1.1)) + 1).map((i, _, arr) => {
        const z = -0.45 - (i * depth) / (arr.length - 1)
        return (
          <mesh key={`rb${i}`} position={[0, spring, z]} material={ARCH_RIB}>
            <torusGeometry args={[r - 0.04, 0.06, 5, 20, Math.PI]} />
          </mesh>
        )
      })}
      {range(9).map((i) => {
        const th = (Math.PI * (i + 0.5)) / 9
        return <Box key={`rl${i}`} p={[Math.cos(th) * (r - 0.04), spring + Math.sin(th) * (r - 0.04), -0.45 - depth / 2]} s={[0.05, 0.05, depth]} r={[0, 0, th]} m={ARCH_RIB} />
      })}
      {/* 안쪽 아래 돌띠 */}
      {[-1, 1].map((s) => (
        <Box key={`w${s}`} p={[s * (r - 0.02), 0.35, -0.45 - depth / 2]} s={[0.06, 0.7, depth]} m={STONE} />
      ))}
      {/* (11/26 지민 요청: 건물 사이에 틈 없이 빽빽하게) item.fill = { w: 가게 사이 틈 폭, h: 가게 높이 }
           문틀 옆 남는 틈·문틀 위를 건물 몸통으로 꽉 채움 → 건물을 뚫고 들어가는 골목 터널처럼. 위에는 색유리 아치 창 + 작은 발코니 */}
      {item.fill && (() => {
        const R = r + band
        const crown = spring + R
        const fh = Math.max(crown + 1.6, item.fill.h)
        const wallC = item.fill.color ?? '#d9b45e'
        return (
          <group>
            {/* (11/26 지민 요청: 아치가 네모난 홈 안에 들어간 것처럼 보임) 건물 벽을 아치 모양으로 뚫린 판 한 장으로
                 → 붉은 문틀 바로 뒤에서 벽이 아치 테두리를 따라 둥글게 맞닿음 (전엔 벽 앞면 0.4m 뒤에 네모 어깨판이 있어 네모 홈이 생겼음) */}
            <mesh geometry={archWallGeometry(item.fill.w, fh, R - 0.06, spring, depth + 0.4)} position={[0, 0, -0.45 - depth]}>
              <meshStandardMaterial color={wallC} roughness={0.9} />
            </mesh>
            <Box p={[0, fh - 0.1, -0.45 - depth / 2 + 0.2]} s={[item.fill.w + 0.4, 0.2, depth + 0.8]} c="#3a2416" />
            <group position={[0, crown + (fh - crown) / 2 + 0.1, 0.24]}>
              <mesh>
                <planeGeometry args={[1.3, 1.7]} />
                <meshStandardMaterial map={stainedTexture()} emissiveMap={stainedTexture()} emissive="#ffffff" emissiveIntensity={0.6} />
              </mesh>
              <Box p={[0, 0, -0.03]} s={[1.5, 1.9, 0.06]} c="#3a2416" />
              {/* 작은 발코니 */}
              <Box p={[0, -0.95, 0.3]} s={[1.9, 0.1, 0.7]} c="#4a2f1f" />
              <Box p={[0, -0.45, 0.62]} s={[1.9, 0.06, 0.06]} c="#3f7a6a" />
              {range(8).map((i) => (
                <Box key={i} p={[-0.9 + i * (1.8 / 7), -0.68, 0.62]} s={[0.05, 0.5, 0.05]} c="#3f7a6a" />
              ))}
            </group>
          </group>
        )
      })()}
      {/* 안: 갓 전등 + 장면 설명 판 */}
      <group position={[0, spring + r - 0.1, -0.45 - depth * 0.45]}>
        <Box p={[0, -0.25, 0]} s={[0.015, 0.5, 0.015]} m={IRON} />
        <mesh position={[0, -0.55, 0]} material={LAMP_SHADE}>
          <coneGeometry args={[0.3, 0.16, 14, 1, true]} />
        </mesh>
        <mesh position={[0, -0.62, 0]} material={BULB}>
          <sphereGeometry args={[0.06, 8, 6]} />
        </mesh>
      </group>
      {item.sub && (
        <group position={[0, spring - 0.15, -0.6]}>
          <Box p={[0, 0, -0.03]} s={[Math.min(span - 0.3, 3.4) + 0.12, 0.46, 0.05]} c="#3a2416" />
          <mesh>
            <planeGeometry args={[Math.min(span - 0.3, 3.4), 0.36]} />
            <GlowMaterial glow={0.35} map={getJpSignTexture(item.sub, '#efe4c8', '#5a1d12', Math.min(span - 0.3, 3.4) / 0.36)} />
          </mesh>
        </group>
      )}
    </group>
  )
}


// ── 다져진 흙길 바닥 (11/26 지민 요청: 큰길 흙바닥이 한 색이라 어색함 → 자연스럽게) ──
// 무늬(반복): 모래빛 바탕 + 얼룩덜룩한 밝고 어두운 자국 + 사람이 다녀 다져진 길 자국 + 잔돌 + 가는 금
// 가장자리(반복 없음): 1.5m쯤에 걸쳐 투명하게 흐려져 처마 밑 돌바닥과 자연스럽게 섞임
// item.size [폭, _, 길이], item.spill(골목 입구 쪽 흙이 번진 자국 여부)
let dirtTex = null
function dirtTexture() {
  if (dirtTex) return dirtTex
  const N = 512
  const c = document.createElement('canvas')
  c.width = c.height = N
  const x = c.getContext('2d')
  x.fillStyle = '#c9ad83'
  x.fillRect(0, 0, N, N)
  let seed = 77
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const blob = (px, py, r, col) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r)
      g.addColorStop(0, col)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      x.fillStyle = g
      x.beginPath()
      x.arc(px + ox, py + oy, r, 0, Math.PI * 2)
      x.fill()
    }
  }
  for (let i = 0; i < 70; i++) blob(rnd() * N, rnd() * N, 30 + rnd() * 90, rnd() < 0.5 ? 'rgba(232,212,170,0.35)' : 'rgba(140,108,72,0.22)')
  // 다져진 길 자국 (세로로 길게)
  for (let k = 0; k < 3; k++) {
    const cx = 80 + rnd() * 350
    x.strokeStyle = 'rgba(120,92,60,0.10)'
    x.lineWidth = 26 + rnd() * 20
    x.beginPath()
    x.moveTo(cx, -10)
    x.bezierCurveTo(cx + 30, 170, cx - 30, 340, cx, N + 10)
    x.stroke()
  }
  // 잔돌
  for (let i = 0; i < 650; i++) {
    const r = rnd() < 0.85 ? 1 + rnd() * 2 : 3 + rnd() * 4
    x.fillStyle = ['#8f7a5e', '#a69378', '#6f604c', '#ddc9a2'][Math.floor(rnd() * 4)]
    x.beginPath()
    x.ellipse(rnd() * N, rnd() * N, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2)
    x.fill()
  }
  // 가는 금
  x.strokeStyle = 'rgba(100,78,52,0.25)'
  x.lineWidth = 1.5
  for (let k = 0; k < 9; k++) {
    let px = rnd() * N
    let py = rnd() * N
    x.beginPath()
    x.moveTo(px, py)
    for (let s2 = 0; s2 < 5; s2++) {
      px += (rnd() - 0.5) * 40
      py += 10 + rnd() * 25
      x.lineTo(px, py)
    }
    x.stroke()
  }
  dirtTex = new THREE.CanvasTexture(c)
  dirtTex.colorSpace = THREE.SRGBColorSpace
  dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping
  dirtTex.anisotropy = 8
  return dirtTex
}
const edgeTexCache = {}
function edgeFadeTexture(fx, fz) {
  const key = `${fx.toFixed(2)}:${fz.toFixed(2)}`
  if (edgeTexCache[key]) return edgeTexCache[key]
  const N = 256
  const c = document.createElement('canvas')
  c.width = c.height = N
  const x = c.getContext('2d')
  const img = x.createImageData(N, N)
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const wob = Array.from({ length: 64 }, () => rnd())
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      const v = j / (N - 1)
      const w1 = wob[Math.floor(v * 63)] * 0.6
      const w2 = wob[Math.floor(u * 63)] * 0.6
      const ex = Math.min(u, 1 - u) / Math.max(0.001, fx) - w1 * 0.5
      const ez = Math.min(v, 1 - v) / Math.max(0.001, fz) - w2 * 0.5
      const a = Math.max(0, Math.min(1, Math.min(ex, ez)))
      const k = (j * N + i) * 4
      const vv = Math.round(255 * a * a * (3 - 2 * a))
      img.data[k] = img.data[k + 1] = img.data[k + 2] = vv
      img.data[k + 3] = 255
    }
  x.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  edgeTexCache[key] = t
  return t
}
export function JmDirtFloor({ item }) {
  const [w, , d] = item.size
  const m = useMemo(() => {
    const map = dirtTexture().clone()
    map.needsUpdate = true
    map.repeat.set(w / 6, d / 6)
    return new THREE.MeshStandardMaterial({
      map, color: item.tint ?? '#ffffff', alphaMap: edgeFadeTexture((item.fade ?? 1.6) / w, item.fadeEnds === false ? 0.0001 : (item.fade ?? 1.6) / d), transparent: true, depthWrite: false, roughness: 1,
      polygonOffset: true, polygonOffsetFactor: -4,
    })
  }, [w, d, item.fadeEnds, item.tint, item.fade])
  // 아래 이끼 돌바닥 판(JmFloor) 윗면이 바닥 높이 + 0.07이라 그보다 조금 위에
  return (
    <mesh position={[0, item.y ?? 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m} renderOrder={item.y != null ? -1 : 0} userData={{ noMerge: true }}>
      <planeGeometry args={[w, d]} />
    </mesh>
  )
}

export const JM_SPIRIT_STYLES = {
  jmDirtFloor: JmDirtFloor,
  jmAlleyArch: JmAlleyArch,
  jmPinkHouse: JmPinkHouse,
  jmVerandaShop: JmVerandaShop,
  jmRedLanternTower: JmRedLanternTower,
  jmCollider: JmCollider,
  jmBoilerBasement: JmBoilerBasement,
  jmStairRail: JmStairRail,
  jmBasementDoor: JmBasementDoor,
  jmChimney: JmChimney,
  jmFloor: JmFloor,
  jmEatery: JmEatery,
  jmLanternLine: JmLanternLine,
  jmTownGate: JmTownGate,
  jmSeaRail: JmSeaRail,
  jmBoilerRoom: JmBoilerRoom,
  jmElevator: JmElevator,
  jmFlowerBush: JmFlowerBush,
  jmGrassHill: JmGrassHill,
  jmYuLowerFacade: JmYuLowerFacade,
  jmSeaTrain: JmSeaTrain,
  jmPipeBridge: JmPipeBridge,
  jmHedge: JmHedge,
  jmVeggiePatch: JmVeggiePatch,
  jmShed: JmShed,
  jmFieldHut: JmFieldHut,
}
