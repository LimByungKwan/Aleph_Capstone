import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { getLatticeTexture } from './textures.js'
import { JM_SEASON_STYLES } from './jm_seasons.jsx'
import { getJpSignTexture, GlowMaterial, JM_LANDMARK_STYLES } from './jm_landmarks.jsx'
import { JM_SHOP_STYLES } from './jm_shops.jsx'
import { JM_DETAIL_STYLES } from './jm_details.jsx'
import { JM_SKIP_STYLES } from './jm_skipstone.jsx'
import { JM_BRIDGE_STYLES } from './jm_bridges.jsx'
import { JM_RIVERSIDE_STYLES } from './jm_riverside.jsx'
import { JM_BENCH_STYLES } from './jm_bench.jsx'
import { JM_KYOTO_STYLES } from './jm_kyoto.jsx'
import { JM_STAIR_STYLES } from './jm_stairs.jsx'
import { JM_PORTAL_STYLES } from './jm_portal.jsx'
import { JM_YUTOYA_STYLES } from './jm_yutoya.jsx'
import { JM_GINZAN_STYLES } from './jm_ginzan.jsx'
import { JM_TUNNEL_STYLES } from './jm_tunnel.jsx'
import { JM_SPIRIT_STYLES } from './jm_spirit.jsx'
import { JM_SCENE_STYLES } from './jm_scenes.jsx'
import { mergeStyles } from './jm_perf.jsx'
import { Fence } from './props.jsx'

// 애니메이션 구역(JM) 전용 일본풍 스타일. 담당: 지민
// 다른 스타일과 같은 약속을 따라요:
// - JSON의 size [가로 w, 높이 h, 깊이 d] 상자 안에 들어가게 그림 (지붕 처마만 살짝 튀어나옴)
// - 앞면은 +z → JSON rotationDeg로 길 쪽을 보게 돌림
// - style 이름은 다른 구역과 겹치지 않게 "jm"으로 시작 (index.js에 등록)

const VERMILION = '#c8452f' // 주홍 (도리이·신사 기둥)
const DARK_WOOD = '#4a3424'
const WOOD = '#6e4b33'
const ROOF_TILE = '#33373d'
const PLASTER = '#efe9dc'
const STONE = '#a29d93'

const range = (n) => Array.from({ length: n }, (_, i) => i)

// index.js의 STYLES에 펼쳐 넣는 목록 (새 스타일은 여기만 추가하면 돼서 index.js를 다시 안 건드려도 됨)
// 렉 줄이기: 움직이는 부품이 있는 스타일만 빼고, 정적 부품을 오브젝트마다 재질별로 합쳐 그림 (jm_perf.jsx)
const NO_MERGE = new Set([
  'jmHoop', // 슛 공(움직임)
  'jmBusStop', // 비·우산(움직임)
  'jmSkipSpot', // 물수제비 돌·물보라(움직임)
  'jmBridgeDress', // 흔들다리(매 프레임 움직임)
  'jmWaterwheel', // 도는 바퀴
  'jmRiver', // 흐르는 물결
  'jmCollider', // 그리는 것 없음 (높은 벽은 카메라 막이만)
  'jmElevator', // 레버·다이얼 움직임, HUD
  'jmSeaTrain', // 큰 메시 여러 개
  'jmGrassTufts', // 이미 인스턴스 한 번에 그림
  'jmZoneLight', // 조명
  'jmGroundCover', // 이미 인스턴스 한 번에 그림
  'jmPathRibbon', // 이미 메시 하나
  'jmCrossing', // 깜빡이는 경보등
  'jmPortalDoor', // 문 앞 안내(HUD)·순간 이동
  'jmSceneRoom', // 장면 공간 (비·체험 등 움직이는 부품)
])

const JM_STYLES_RAW = {
  jmTorii: JmTorii,
  jmMachiya: JmMachiya,
  jmShrine: JmShrine,
  jmLantern: JmLantern,
  jmAntique: JmAntique,
  jmHut: JmHut,
  jmLanternString: JmLanternString,
  jmRooftopShrine: JmRooftopShrine,
  jmRooftopBuilding: JmRooftopBuilding,
  // 사계절 나무·바닥, 전봇대·우체통 같은 골목 소품 (jm_seasons.jsx)
  ...JM_SEASON_STYLES,
  // 성지 안내판(직접 그린 포스터), 논, 큰 나무, 농구 골대 같은 작품별 랜드마크 (jm_landmarks.jsx)
  ...JM_LANDMARK_STYLES,
  // 들어갈 수 있는 가게, 눈에 안 보이는 벽, 버스 정류장 (jm_shops.jsx)
  ...JM_SHOP_STYLES,
  // 허수아비·볏단 걸이·데미즈야 같은 영역별 세부 소품, 자연스러운 호수 (jm_details.jsx)
  ...JM_DETAIL_STYLES,
  // 물수제비 체험 (jm_skipstone.jsx)
  ...JM_SKIP_STYLES,
  // 붉은 다리·흔들다리 겉모습 (jm_bridges.jsx)
  ...JM_BRIDGE_STYLES,
  // 강변 소품: 물레방아·노다테·돗자리·철교 (jm_riverside.jsx)
  ...JM_RIVERSIDE_STYLES,
  // 앉을 수 있는 벤치 (jm_bench.jsx)
  ...JM_BENCH_STYLES,
  // 공용 난간(props.jsx Fence)을 애니 구역에서는 합쳐서 그림 (공용 파일은 그대로)
  jmFence: Fence,
  // 교토 온천 마을: 여관·수로·가스등·도리이 터널·건널목·포장마차·붉은 다리 (jm_kyoto.jsx)
  ...JM_KYOTO_STYLES,
  // 계단 겉모습 시안 (jm_stairs.jsx)
  ...JM_STAIR_STYLES,
  // 명장면 공간 입구·공간 (jm_portal.jsx)
  ...JM_PORTAL_STYLES,
  // 큰 여관 「湯灯屋」 외관·안 (jm_yutoya.jsx)
  ...JM_YUTOYA_STYLES,
  // 쌍둥이 가스등·흰 회벽 담·마당 문 (jm_ginzan.jsx, 11/25)
  ...JM_GINZAN_STYLES,
  // 입구 붉은 터널 건물·두 얼굴 석상·돌 사당 (jm_tunnel.jsx, 11/25)
  ...JM_TUNNEL_STYLES,
  ...JM_SPIRIT_STYLES,
  ...JM_SCENE_STYLES,
}

export const JM_STYLES = mergeStyles(JM_STYLES_RAW, NO_MERGE)

// ── 도리이 (신사 입구 문) ─────────────────────
// size 예: [6.4, 5.5, 0.8]. 사이로 지나다닐 수 있게 JSON에 "collider": false 권장
export function JmTorii({ item }) {
  const [w, h] = item.size
  const color = item.color ?? VERMILION
  const pillarR = Math.max(0.16, w * 0.04)
  const span = w - 1.2 // 두 기둥 사이 거리
  const beamY = h - 0.35 // 맨 위 가로대(가사기)
  const lowerY = h - 1.35 // 아래 가로대(누키)

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * span) / 2, 0, 0]}>
          {/* 기둥 + 아래 검은 받침 */}
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[pillarR * 0.9, pillarR, h, 14]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[pillarR * 1.25, pillarR * 1.3, 0.5, 14]} />
            <meshStandardMaterial color="#1f1f1f" />
          </mesh>
        </group>
      ))}
      {/* 누키 (아래 가로대) */}
      <mesh position={[0, lowerY, 0]}>
        <boxGeometry args={[w - 0.4, 0.32, 0.28]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 시마키 + 가사기 (위 가로대 두 겹, 맨 위는 검정) */}
      <mesh position={[0, beamY - 0.2, 0]}>
        <boxGeometry args={[w + 0.2, 0.32, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, beamY + 0.08, 0]}>
        <boxGeometry args={[w + 0.8, 0.24, 0.5]} />
        <meshStandardMaterial color="#1f1f1f" />
      </mesh>
      {/* 양 끝이 살짝 들린 느낌 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w + 0.6)) / 2, beamY + 0.18, 0]} rotation={[0, 0, side * 0.25]}>
          <boxGeometry args={[0.5, 0.2, 0.5]} />
          <meshStandardMaterial color="#1f1f1f" />
        </mesh>
      ))}
      {/* 가운데 편액 기둥 */}
      <mesh position={[0, (lowerY + beamY - 0.2) / 2, 0]}>
        <boxGeometry args={[0.36, beamY - 0.2 - lowerY, 0.22]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

// ── 마치야 (일본식 목조 상가) ──────────────────
// item.signs: [{ text, bg, fg }] — 첫 번째 것이 가게 입구 천(노렌) 글씨
// item.sugidama: true → 처마 밑에 삼나무 공(양조장 표시, 다카야마 옛 거리 느낌)
export function JmMachiya({ item }) {
  const [w, h, d] = item.size
  const wallColor = item.color ?? WOOD
  const sign = item.signs?.[0]
  const base = 0.3
  const floor1 = Math.min(3.2, h * 0.42)
  const roofH = Math.min(2, h * 0.28)
  const floor2 = h - base - floor1 - roofH
  const front = d / 2
  const lattice = getLatticeTexture()
  const slats = Math.max(6, Math.round((w - 1) / 0.25))

  const eaveGeometry = useMemo(() => hipRoofGeometry(w + 0.6, 1.4, 0.45, 0.05), [w])
  const roofGeometry = useMemo(() => hipRoofGeometry(w + 1, d + 1, roofH, 0.15), [w, d, roofH])

  return (
    <group>
      {/* 돌 기단 */}
      <mesh position={[0, base / 2, 0]}>
        <boxGeometry args={[w, base, d]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
      {/* 1층 몸통 */}
      <mesh position={[0, base + floor1 / 2, 0]}>
        <boxGeometry args={[w - 0.2, floor1, d - 0.2]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {/* 1층 앞 세로 격자(고시) */}
      {range(slats).map((i) => (
        <mesh key={i} position={[-(w - 1) / 2 + (i * (w - 1)) / (slats - 1), base + floor1 / 2, front + 0.02]}>
          <boxGeometry args={[0.06, floor1 - 0.3, 0.06]} />
          <meshStandardMaterial color={DARK_WOOD} />
        </mesh>
      ))}
      {/* 입구 노렌 (천 간판) */}
      <mesh position={[0, base + floor1 - 0.75, front + 0.12]}>
        <planeGeometry args={[Math.min(2.6, w * 0.4), 1.1]} />
        <GlowMaterial
          glow={sign ? 0.45 : 0}
          map={sign ? getJpSignTexture(sign.text, sign.bg ?? '#1e3a5f', sign.fg ?? '#f5f0e6', Math.min(2.6, w * 0.4) / 1.1) : null}
          color={sign ? '#ffffff' : '#1e3a5f'}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 1층 위 작은 처마 (기와) */}
      <mesh geometry={eaveGeometry} position={[0, base + floor1, front + 0.35]}>
        <meshStandardMaterial color={ROOF_TILE} flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* 삼나무 공 (스기다마) */}
      {item.sugidama && (
        <group position={[w * 0.3, base + floor1 - 0.55, front + 0.7]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 4]} />
            <meshStandardMaterial color={DARK_WOOD} />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.42, 1]} />
            <meshStandardMaterial color="#5b6b3a" flatShading />
          </mesh>
        </group>
      )}
      {/* 2층 (회벽 + 나무 기둥 + 창살 창) */}
      <mesh position={[0, base + floor1 + floor2 / 2, -0.3]}>
        <boxGeometry args={[w - 0.4, floor2, d - 0.8]} />
        <meshStandardMaterial color={PLASTER} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w - 0.5)) / 2, base + floor1 + floor2 / 2, front - 0.68]}>
          <boxGeometry args={[0.22, floor2, 0.22]} />
          <meshStandardMaterial color={DARK_WOOD} />
        </mesh>
      ))}
      <mesh position={[0, base + floor1 + floor2 / 2, front - 0.68]}>
        <planeGeometry args={[w * 0.6, Math.max(0.6, floor2 - 0.8)]} />
        <meshStandardMaterial map={lattice} color="#f3ead6" />
      </mesh>
      {/* 기와 지붕 */}
      <mesh geometry={roofGeometry} position={[0, h - roofH, 0]}>
        <meshStandardMaterial color={ROOF_TILE} flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 신사 본전 ─────────────────────────────────
// 앞면(+z)에 계단과 새전함(헌금함), 금줄(시메나와)이 있어요
export function JmShrine({ item }) {
  const [w, h, d] = item.size
  const pillarColor = item.color ?? VERMILION
  const base = 0.9 // 높은 돌 기단
  const floorH = 0.35 // 나무 마루
  const roofH = Math.min(3.6, h * 0.42)
  const wallTop = h - roofH
  const bodyTop = base + floorH
  const wallH = wallTop - bodyTop
  const inW = w - 2
  const inD = d - 2
  const bays = Math.max(3, Math.round(inW / 2))
  const lattice = getLatticeTexture()

  const roofGeometry = useMemo(() => hipRoofGeometry(w + 2.2, d + 2.2, roofH, 0.9), [w, d, roofH])
  const ridgeLength = Math.abs(w - d) + 1.2

  return (
    <group>
      {/* 돌 기단 + 앞 돌계단 */}
      <mesh position={[0, base / 2, -0.4]}>
        <boxGeometry args={[w, base, d - 0.8]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
      {range(3).map((i) => (
        <mesh key={i} position={[0, (base / 3) * (i + 0.5), d / 2 - 0.15 - i * 0.3]}>
          <boxGeometry args={[3, (base / 3) * (i + 1), 0.3]} />
          <meshStandardMaterial color={STONE} />
        </mesh>
      ))}
      {/* 나무 마루 */}
      <mesh position={[0, base + floorH / 2, -0.4]}>
        <boxGeometry args={[w - 0.8, floorH, d - 1.6]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {/* 흰 벽 */}
      <mesh position={[0, bodyTop + wallH / 2, -0.4]}>
        <boxGeometry args={[inW, wallH, inD]} />
        <meshStandardMaterial color={PLASTER} />
      </mesh>
      {/* 앞 창살문 */}
      {range(bays).map((i) => (
        <mesh key={i} position={[-inW / 2 + (inW / bays) * (i + 0.5), bodyTop + wallH * 0.45, inD / 2 - 0.38]}>
          <planeGeometry args={[(inW / bays) * 0.8, wallH * 0.75]} />
          <meshStandardMaterial map={lattice} color="#fff6e6" />
        </mesh>
      ))}
      {/* 주홍 기둥 (앞·뒤) */}
      {range(bays + 1).map((i) =>
        [1, -1].map((side) => (
          <mesh key={`${i}${side}`} position={[-inW / 2 + (inW / bays) * i, bodyTop + wallH / 2, -0.4 + (side * inD) / 2]}>
            <cylinderGeometry args={[0.18, 0.2, wallH, 12]} />
            <meshStandardMaterial color={pillarColor} />
          </mesh>
        )),
      )}
      {/* 주홍 보 */}
      <mesh position={[0, wallTop - 0.2, inD / 2 - 0.4]}>
        <boxGeometry args={[inW + 0.6, 0.4, 0.4]} />
        <meshStandardMaterial color={pillarColor} />
      </mesh>
      {/* 금줄 (시메나와) + 종이 장식 */}
      <mesh position={[0, wallTop - 0.75, inD / 2 - 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, inW * 0.7, 10]} />
        <meshStandardMaterial color="#d9c48f" />
      </mesh>
      {[-0.25, 0, 0.25].map((t) => (
        <mesh key={t} position={[t * inW * 0.7, wallTop - 1.15, inD / 2 - 0.12]}>
          <planeGeometry args={[0.22, 0.6]} />
          <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* 새전함 (헌금함) */}
      <mesh position={[0, bodyTop + 0.45, d / 2 - 1.3]}>
        <boxGeometry args={[1.8, 0.9, 0.8]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
      {/* 큰 기와 지붕 (처마가 많이 들림) + 용마루 */}
      <mesh geometry={roofGeometry} position={[0, wallTop - 0.05, -0.4]}>
        <meshStandardMaterial color={ROOF_TILE} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h + 0.05, -0.4]} rotation={[0, d > w ? Math.PI / 2 : 0, 0]}>
        <boxGeometry args={[ridgeLength, 0.4, 0.45]} />
        <meshStandardMaterial color="#26292e" />
      </mesh>
    </group>
  )
}

// ── 석등 (돌 등롱) ─────────────────────────────
// size 예: [0.8, 2.2, 0.8]
export function JmLantern({ item }) {
  const [w, h] = item.size
  const s = w / 0.8 // 기본 크기 대비 배율
  const color = item.color ?? STONE
  const lightY = h * 0.62

  return (
    <group>
      {/* 받침돌 */}
      <mesh position={[0, 0.15 * s, 0]}>
        <boxGeometry args={[w, 0.3 * s, w]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 기둥 */}
      <mesh position={[0, (0.3 * s + lightY - 0.35 * s) / 2, 0]}>
        <cylinderGeometry args={[0.14 * s, 0.17 * s, lightY - 0.65 * s, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 등을 받치는 판 */}
      <mesh position={[0, lightY - 0.3 * s, 0]}>
        <boxGeometry args={[w * 0.8, 0.12 * s, w * 0.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 불 들어오는 칸 */}
      <mesh position={[0, lightY, 0]}>
        <boxGeometry args={[w * 0.55, 0.5 * s, w * 0.55]} />
        <meshStandardMaterial color="#ffe9b0" emissive="#ffb347" emissiveIntensity={0.6} />
      </mesh>
      {/* 사각뿔 지붕 + 꼭지 */}
      <mesh position={[0, lightY + 0.25 * s + 0.2 * s, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[w * 0.72, 0.4 * s, 4]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, Math.min(h - 0.1 * s, lightY + 0.75 * s), 0]}>
        <sphereGeometry args={[0.1 * s, 10, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

// ── 언덕 위 골동품 가게 ─────────────────────────
// 1층 나무 가게 + 좁은 2층 + 뾰족한 초록 지붕. item.signs[0] = 간판
export function JmAntique({ item }) {
  const [w, h, d] = item.size
  const sign = item.signs?.[0]
  const floor1 = h * 0.38
  const floor2 = h * 0.3
  const roofH = h - floor1 - floor2
  const front = d / 2
  return (
    <group>
      {/* 1층 */}
      <mesh position={[0, floor1 / 2, 0]}>
        <boxGeometry args={[w, floor1, d]} />
        <meshStandardMaterial color="#8a5a3b" />
      </mesh>
      <mesh position={[-w * 0.18, floor1 * 0.5, front + 0.03]}>
        <planeGeometry args={[w * 0.45, floor1 * 0.55]} />
        <meshStandardMaterial color="#f3d9a4" emissive="#f0b860" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[w * 0.28, floor1 * 0.4, front + 0.03]}>
        <planeGeometry args={[w * 0.18, floor1 * 0.8]} />
        <meshStandardMaterial color="#3b2a20" />
      </mesh>
      {sign && (
        <mesh position={[0, floor1 - 0.35, front + 0.05]}>
          <planeGeometry args={[w * 0.7, 0.45]} />
          <GlowMaterial map={getJpSignTexture(sign.text, sign.bg ?? '#2f4f3a', sign.fg ?? '#f5e6c8', (w * 0.7) / 0.45)} />
        </mesh>
      )}
      {/* 2층 (조금 좁게) + 둥근 창 */}
      <mesh position={[0, floor1 + floor2 / 2, 0]}>
        <boxGeometry args={[w * 0.75, floor2, d * 0.8]} />
        <meshStandardMaterial color="#efe3c8" />
      </mesh>
      <mesh position={[0, floor1 + floor2 / 2, d * 0.4 + 0.03]}>
        <circleGeometry args={[Math.min(0.6, floor2 * 0.3), 20]} />
        <meshStandardMaterial color="#f3d9a4" emissive="#f0b860" emissiveIntensity={0.3} />
      </mesh>
      {/* 뾰족한 초록 지붕 + 굴뚝 */}
      <mesh position={[0, floor1 + floor2 + roofH / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.max(w, d) * 0.62, roofH, 4]} />
        <meshStandardMaterial color="#3f6f5a" flatShading />
      </mesh>
      <mesh position={[w * 0.25, floor1 + floor2 + roofH * 0.45, -d * 0.15]}>
        <boxGeometry args={[0.45, roofH * 0.6, 0.45]} />
        <meshStandardMaterial color="#7a3e2e" />
      </mesh>
    </group>
  )
}

// ── 비밀기지 오두막 ────────────────────────────
// 숲속에 아이들이 꾸민 낡은 판잣집: 기둥 위에 살짝 띄운 몸체, 앞 판자 마루와 계단,
// 기운 함석지붕, 덧댄 판자, 창문, 난로 연통, 파란 방수포, 「ひみつきち」 손글씨 간판.
// size 예: [6, 3.6, 4.5]. item.signs[0].text = 간판 글씨
const HUT_PLANK = ['#8b6b47', '#7d5f3e', '#957552']
export function JmHut({ item }) {
  const [w, h, d] = item.size
  const lift = 0.5 // 바닥을 띄운 높이
  const wallH = h * 0.62
  const bodyD = d - 1.2 // 앞 마루 1.2m
  const bodyZ = -0.6
  const sign = item.signs?.[0]?.text ?? 'ひみつきち'
  const planks = Math.max(6, Math.round(w / 0.35))
  return (
    <group>
      {/* 기둥 (바닥 띄움) */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (w - 0.3)) / 2, lift / 2, bodyZ + (sz * (bodyD - 0.3)) / 2]}>
            <boxGeometry args={[0.18, lift, 0.18]} />
            <meshStandardMaterial color="#4a3424" />
          </mesh>
        )),
      )}
      {/* 몸체 + 세로 판자 */}
      <mesh position={[0, lift + wallH / 2, bodyZ]}>
        <boxGeometry args={[w, wallH, bodyD]} />
        <meshStandardMaterial color="#8b6b47" />
      </mesh>
      {range(planks).map((i) => (
        <mesh key={i} position={[-w / 2 + (w * (i + 0.5)) / planks, lift + wallH / 2, bodyZ + bodyD / 2 + 0.02]}>
          <boxGeometry args={[w / planks - 0.03, wallH, 0.03]} />
          <meshStandardMaterial color={HUT_PLANK[i % 3]} />
        </mesh>
      ))}
      {/* 덧댄 판자 (비스듬히) */}
      <mesh position={[w * 0.28, lift + wallH * 0.3, bodyZ + bodyD / 2 + 0.06]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[1.2, 0.18, 0.04]} />
        <meshStandardMaterial color="#a68660" />
      </mesh>
      {/* 문 + 창문 */}
      <mesh position={[-w * 0.15, lift + wallH * 0.36, bodyZ + bodyD / 2 + 0.05]}>
        <planeGeometry args={[0.9, wallH * 0.72]} />
        <meshStandardMaterial color="#3b2a1d" />
      </mesh>
      <mesh position={[w * 0.25, lift + wallH * 0.62, bodyZ + bodyD / 2 + 0.05]}>
        <planeGeometry args={[1, 0.7]} />
        <meshStandardMaterial color="#ffe9b0" emissive="#ffcc66" emissiveIntensity={0.4} />
      </mesh>
      {/* 앞 판자 마루 + 계단 */}
      <mesh position={[0, lift - 0.04, d / 2 - 0.6]}>
        <boxGeometry args={[w * 0.8, 0.08, 1.2]} />
        <meshStandardMaterial color="#7d5f3e" />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} position={[-w * 0.15, (lift / 3) * (i + 1) - 0.04, d / 2 + 0.15 - i * 0.3]}>
          <boxGeometry args={[1, 0.08, 0.3]} />
          <meshStandardMaterial color="#6b4f35" />
        </mesh>
      ))}
      {/* 기운 함석지붕 (앞으로 처마) */}
      <mesh position={[0, lift + wallH + (h - lift - wallH) / 2, bodyZ + 0.2]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[w + 0.5, 0.08, bodyD + 1.6]} />
        <meshStandardMaterial color="#7a8088" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* 난로 연통 */}
      <mesh position={[w / 2 - 0.6, h + 0.2, bodyZ - 0.6]}>
        <cylinderGeometry args={[0.1, 0.1, 1.2, 10]} />
        <meshStandardMaterial color="#555b61" />
      </mesh>
      {/* 파란 방수포 (옆벽) */}
      <mesh position={[w / 2 + 0.03, lift + wallH * 0.55, bodyZ]} rotation={[0, Math.PI / 2, 0.05]}>
        <planeGeometry args={[bodyD * 0.8, wallH * 0.75]} />
        <meshStandardMaterial color="#2f6fd6" side={THREE.DoubleSide} />
      </mesh>
      {/* 손글씨 나무 간판 (문 위 벽면) — 앞으로 기운 지붕·처마에 가리거나 뚫리지 않도록 벽에 붙이고 처마 끝보다 아래로 */}
      <mesh position={[-w * 0.15, lift + wallH * 0.72 + 0.23, bodyZ + bodyD / 2 + 0.06]} rotation={[0, 0, -0.04]}>
        <planeGeometry args={[1.8, 0.38]} />
        <GlowMaterial map={getJpSignTexture(sign, '#c9a46a', '#3b2a1d', 1.8 / 0.38)} />
      </mesh>
    </group>
  )
}

// ── 축제 제등 줄 ──────────────────────────────
// 양 끝 기둥 사이에 붉은 제등을 매단 줄. size [폭, 높이, 깊이]. JSON에 "collider": false 권장
export function JmLanternString({ item }) {
  const [w, h] = item.size
  const ropeY = h - 0.3
  const count = Math.max(3, Math.round(w / 1.1))
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * w) / 2, h / 2, 0]}>
          <cylinderGeometry args={[0.07, 0.09, h, 8]} />
          <meshStandardMaterial color={DARK_WOOD} />
        </mesh>
      ))}
      <mesh position={[0, ropeY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, w, 4]} />
        <meshStandardMaterial color="#2b2b2b" />
      </mesh>
      {range(count).map((i) => (
        <mesh key={i} position={[-w / 2 + (w * (i + 0.5)) / count, ropeY - 0.35, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.42, 12]} />
          <meshStandardMaterial color="#d93a2b" emissive="#ff6b3d" emissiveIntensity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

// ── 옥상 신사가 있는 낡은 빌딩 ──────────────────
// 빌딩(size 높이) 옥상 위에 작은 도리이와 사당을 올림. 옥상에는 올라갈 수 없음(보는 용도)
// ── 들어가서 옥상까지 올라가는 옥상 신사 건물 ─────────
// 1층 로비(앞면 가운데 문) → 안쪽 계단 3번(층계참 2곳) → 옥상 구멍으로 나가면 도리이·사당
// 계단·충돌은 데이터(jm_anime.json)가 맡음: terrain의 jm_rooftop_stairs_1~3, props의 jm_rooftop_* (jmCollider)
// 여기서는 눈에 보이는 것만 그림. 좌표는 모두 건물 기준(앞 +z, 가로 x). size 예: [10, 8.5, 8]
// 왜 층계참 3단: 계단 난간 벽(높이 약 0.9m)이 옆으로 나가는 길을 막아서, 마지막 계단 끝이 바로 옥상 바닥으로 이어지게 함
const RT = 0.25 // 벽 두께
const RT_DOOR = 1.8
const RT_DOOR_H = 2.5
export function JmRooftopBuilding({ item }) {
  const [w, h, d] = item.size
  const wall = item.color ?? '#8d8f8c'
  const inner = '#d9d6cf'
  const slab = '#a3a5a2'
  const front = d / 2
  const floors = Math.max(2, Math.floor(h / 3))
  const sideW = (w - RT_DOOR) / 2
  const Box = ({ p, s, c, e }) => (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={e ?? '#000000'} emissiveIntensity={e ? 0.5 : 0} />
    </mesh>
  )
  return (
    <group>
      {/* 바닥 */}
      <Box p={[0, 0.05, 0]} s={[w, 0.1, d]} c="#bdb7ab" />
      {/* 뒤·옆 벽 (바깥 회색, 안쪽 밝은 색은 얇은 판으로) */}
      <Box p={[0, h / 2, -front + RT / 2]} s={[w, h, RT]} c={wall} />
      <Box p={[-w / 2 + RT / 2, h / 2, 0]} s={[RT, h, d]} c={wall} />
      <Box p={[w / 2 - RT / 2, h / 2, 0]} s={[RT, h, d]} c={wall} />
      <Box p={[0, h / 2, -front + RT + 0.01]} s={[w - 2 * RT, h, 0.02]} c={inner} />
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * (w / 2 - RT - 0.01), h / 2, 0]} s={[0.02, h, d - 2 * RT]} c={inner} />
      ))}
      {/* 앞벽: 문 양옆 + 문 위 */}
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * (RT_DOOR / 2 + sideW / 2), h / 2, front - RT / 2]} s={[sideW, h, RT]} c={wall} />
      ))}
      <Box p={[0, (h + RT_DOOR_H) / 2, front - RT / 2]} s={[RT_DOOR, h - RT_DOOR_H, RT]} c={wall} />
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * (RT_DOOR / 2 + 0.06), RT_DOOR_H / 2, front - RT / 2]} s={[0.12, RT_DOOR_H, RT + 0.04]} c="#4b5563" />
      ))}
      {/* 바깥 창 띠 (앞·양옆, 층마다) */}
      {range(floors).map((f) => (
        <group key={f}>
          {f > 0 && <Box p={[0, f * 3 + 1.6, front + 0.02]} s={[w - 1, 1.2, 0.02]} c="#3a3f44" />}
          {f === 0 &&
            [-1, 1].map((side) => <Box key={side} p={[side * (RT_DOOR / 2 + sideW / 2), 1.6, front + 0.02]} s={[sideW - 0.8, 1.2, 0.02]} c="#3a3f44" />)}
          {[-1, 1].map((side) => (
            <Box key={side} p={[side * (w / 2 + 0.02), f * 3 + 1.6, 0]} s={[0.02, 1.2, d - 1]} c="#3a3f44" />
          ))}
        </group>
      ))}
      {/* 입구 위 작은 차양 + 1층 로비 우편함 */}
      <Box p={[0, RT_DOOR_H + 0.15, front + 0.45]} s={[RT_DOOR + 0.8, 0.08, 0.9]} c="#6b7280" />
      <Box p={[-w / 2 + RT + 0.2, 1.3, front - 1.3]} s={[0.3, 0.9, 1.2]} c="#9ca3af" />
      {range(3).map((i) => (
        <Box key={i} p={[-w / 2 + RT + 0.36, 1.05 + i * 0.25, front - 1.3]} s={[0.02, 0.18, 1.1]} c="#4b5563" />
      ))}

      {/* 층계참 2곳 (계단 1→2 사이, 2→3 사이) + 로비 쪽 난간 */}
      <Box p={[3.625, 2.73, -2.2]} s={[2.25, 0.2, 3.1]} c={slab} />
      <Box p={[-3.875, 5.57, -2.2]} s={[1.75, 0.2, 3.1]} c={slab} />
      <Box p={[3.625, 2.83 + 0.5, -0.6]} s={[2.25, 1, 0.06]} c="#6b7280" />
      <Box p={[-3.875, 5.67 + 0.5, -0.6]} s={[1.75, 1, 0.06]} c="#6b7280" />

      {/* 옥상 바닥 (계단 3 위쪽만 뚫림) */}
      <Box p={[0, h - 0.1, 0.75]} s={[9.5, 0.2, 6]} c={slab} />
      <Box p={[3.625, h - 0.1, -3]} s={[2.25, 0.2, 1.5]} c={slab} />
      <Box p={[-3.875, h - 0.1, -3]} s={[1.75, 0.2, 1.5]} c={slab} />
      {/* 계단 구멍 둘레 난간 */}
      <Box p={[-0.25, h + 0.5, -2.2]} s={[5.5, 1, 0.06]} c="#6b7280" />
      <Box p={[-3.05, h + 0.5, -3]} s={[0.06, 1, 1.5]} c="#6b7280" />

      {/* 옥상 난간 */}
      {[
        [0, d / 2, w, 0.1],
        [0, -d / 2, w, 0.1],
        [w / 2, 0, 0.1, d],
        [-w / 2, 0, 0.1, d],
      ].map(([x, z, sx, sz], i) => (
        <Box key={i} p={[x, h + 0.45, z]} s={[sx, 0.9, sz]} c="#b9bbb8" />
      ))}

      {/* 옥상: 도리이 → 작은 사당 (앞에서 들어오면 도리이를 지나 사당) */}
      <group position={[-1, h, 1.9]}>
        <JmTorii item={{ size: [2.2, 2.4, 0.3] }} />
      </group>
      <group position={[-1, h, 0.1]}>
        <Box p={[0, 0.5, 0]} s={[1, 1, 0.9]} c={WOOD} />
        <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.95, 0.5, 4]} />
          <meshStandardMaterial color={ROOF_TILE} flatShading />
        </mesh>
      </group>
      {/* 옥상 화분 (풀이 무성한 느낌) */}
      {[
        [3.9, 3.2],
        [-4.0, 3.2],
        [3.9, 0.4],
        [-4.0, 0.4],
        [1.6, 3.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, h, z]}>
          <Box p={[0, 0.25, 0]} s={[0.8, 0.5, 0.6]} c="#8a6a4a" />
          <mesh position={[0, 0.75, 0]}>
            <icosahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color={i % 2 ? '#6b8f3a' : '#4f7a34'} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function JmRooftopShrine({ item }) {
  const [w, h, d] = item.size
  const floors = Math.max(2, Math.floor(h / 3))
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={item.color ?? '#8d8f8c'} />
      </mesh>
      {/* 층마다 어두운 창 띠 */}
      {range(floors).map((f) => (
        <mesh key={f} position={[0, f * 3 + 1.6, d / 2 + 0.03]}>
          <planeGeometry args={[w - 1, 1.2]} />
          <meshStandardMaterial color="#3a3f44" />
        </mesh>
      ))}
      {/* 옥상 난간 */}
      {[
        [0, d / 2, w, 0.1],
        [0, -d / 2, w, 0.1],
        [w / 2, 0, 0.1, d],
        [-w / 2, 0, 0.1, d],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, h + 0.45, z]}>
          <boxGeometry args={[sx, 0.9, sz]} />
          <meshStandardMaterial color="#b9bbb8" />
        </mesh>
      ))}
      {/* 옥상 위 작은 도리이 + 사당 */}
      <group position={[0, h, d * 0.1]}>
        <JmTorii item={{ size: [2.2, 2.4, 0.3] }} />
      </group>
      <group position={[0, h, -d * 0.25]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 0.9]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
        <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.95, 0.5, 4]} />
          <meshStandardMaterial color={ROOF_TILE} flatShading />
        </mesh>
      </group>
    </group>
  )
}
