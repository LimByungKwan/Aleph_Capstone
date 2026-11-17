import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { getLatticeTexture, getSignTexture } from './textures.js'

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
export const JM_STYLES = {
  jmTorii: JmTorii,
  jmMachiya: JmMachiya,
  jmShrine: JmShrine,
  jmLantern: JmLantern,
}

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
        <meshStandardMaterial
          map={sign ? getSignTexture(sign.text, sign.bg ?? '#1e3a5f', sign.fg ?? '#f5f0e6') : null}
          color={sign ? '#ffffff' : '#1e3a5f'}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 1층 위 작은 처마 (기와) */}
      <mesh geometry={eaveGeometry} position={[0, base + floor1, front + 0.35]}>
        <meshStandardMaterial color={ROOF_TILE} flatShading side={THREE.DoubleSide} />
      </mesh>
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
