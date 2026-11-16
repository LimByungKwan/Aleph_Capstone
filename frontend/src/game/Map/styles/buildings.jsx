import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { getLatticeTexture, getMuralTexture, getSignTexture, getTiledTexture } from './textures.js'

// 건물 스타일들. 모두 JSON의 size [가로 w, 높이 h, 깊이 d] 상자 안에 들어가도록 그려요
// (지붕 처마·차양만 살짝 튀어나옴). 앞면은 +z 방향 → JSON rotationDeg로 길 쪽을 보게 돌려요.

const WOOD = '#6b4a2f'
const ROOF = '#3a3f46'
const STONE_BASE = '#9a958c'
const GLASS = { color: '#2e3f4f', metalness: 0.1, roughness: 0.25 }

const range = (n) => Array.from({ length: n }, (_, i) => i)

// ── 한옥 ─────────────────────────────────────
export function Hanok({ item }) {
  const [w, h, d] = item.size
  const wallColor = item.color ?? '#f2ece0'
  const base = 0.5
  const roofH = Math.min(2.4, h * 0.38)
  const wallTop = h - roofH
  const wallH = wallTop - base
  const inW = w - 0.6
  const inD = d - 0.6
  const bays = Math.max(2, Math.round(inW / 1.8))
  const bayW = inW / bays
  const doorBay = Math.floor(bays / 2)

  const roofGeometry = useMemo(() => hipRoofGeometry(w + 1.8, d + 1.8, roofH, 0.45), [w, d, roofH])
  const lattice = getLatticeTexture()
  const ridgeLength = Math.abs(w - d) + 0.8
  const ridgeAlongZ = d > w

  return (
    <group>
      {/* 기단 (돌) */}
      <mesh position={[0, base / 2, 0]}>
        <boxGeometry args={[w, base, d]} />
        <meshStandardMaterial color={STONE_BASE} />
      </mesh>
      {/* 벽 */}
      <mesh position={[0, base + wallH / 2, 0]}>
        <boxGeometry args={[inW, wallH, inD]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {/* 기둥 (앞·뒤) */}
      {range(bays + 1).map((i) =>
        [1, -1].map((side) => (
          <mesh key={`${i}${side}`} position={[-inW / 2 + i * bayW, base + wallH / 2, (side * inD) / 2]}>
            <boxGeometry args={[0.24, wallH, 0.24]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
        )),
      )}
      {/* 보 (기둥 위 가로 나무) */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, wallTop - 0.15, (side * inD) / 2]}>
          <boxGeometry args={[inW + 0.3, 0.3, 0.3]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
      ))}
      {/* 창살 창문 + 가운데 문 */}
      {range(bays).map((i) => {
        const isDoor = i === doorBay
        const ph = isDoor ? Math.min(2.2, wallH - 0.3) : Math.min(1.4, wallH - 1.2)
        const py = isDoor ? base + ph / 2 : base + 0.9 + ph / 2
        return (
          <mesh key={i} position={[-inW / 2 + bayW * (i + 0.5), py, inD / 2 + 0.02]}>
            <planeGeometry args={[bayW * 0.72, ph]} />
            <meshStandardMaterial map={lattice} color={isDoor ? '#e3d3b4' : '#ffffff'} />
          </mesh>
        )
      })}
      {/* 기와지붕 + 용마루 */}
      <mesh geometry={roofGeometry} position={[0, wallTop - 0.05, 0]}>
        <meshStandardMaterial color={ROOF} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, wallTop + roofH + 0.05, 0]} rotation={[0, ridgeAlongZ ? Math.PI / 2 : 0, 0]}>
        <boxGeometry args={[ridgeLength, 0.3, 0.35]} />
        <meshStandardMaterial color="#2c3036" />
      </mesh>
    </group>
  )
}

// ── 현대식 상가 건물 ──────────────────────────
// item.signs: [{ text, bg, fg, awning }] — 1층 가게 간판 (여러 개면 1층을 나눠 씀)
export function Modern({ item }) {
  const [w, h, d] = item.size
  const color = item.color ?? '#cfcac2'
  const floors = Math.max(1, Math.floor(h / 3.2))
  const shops = item.signs ?? []
  const shopCount = Math.max(1, shops.length)
  const shopW = (w - 0.6) / shopCount

  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 옥상 난간 턱 + 옥상 실외기 */}
      <mesh position={[0, h - 0.17, 0]}>
        <boxGeometry args={[w + 0.15, 0.35, d + 0.15]} />
        <meshStandardMaterial color="#7d7a75" />
      </mesh>
      <mesh position={[w * 0.2, h + 0.5, -d * 0.15]}>
        <boxGeometry args={[w * 0.3, 1, d * 0.3]} />
        <meshStandardMaterial color="#bdb9b2" />
      </mesh>
      {/* 2층 이상 창문 띠 (앞·뒤·옆) */}
      {range(floors - 1).map((f) => {
        const y = (f + 1) * 3.2 + 1.6
        return (
          <group key={f}>
            {[1, -1].map((side) => (
              <mesh key={`z${side}`} position={[0, y, (side * d) / 2 + side * 0.04]}>
                <boxGeometry args={[w - 1, 1.5, 0.08]} />
                <meshStandardMaterial {...GLASS} />
              </mesh>
            ))}
            {[1, -1].map((side) => (
              <mesh key={`x${side}`} position={[(side * w) / 2 + side * 0.04, y, 0]}>
                <boxGeometry args={[0.08, 1.5, d - 1]} />
                <meshStandardMaterial {...GLASS} />
              </mesh>
            ))}
          </group>
        )
      })}
      {/* 1층 유리 가게 앞면 */}
      <mesh position={[0, 1.35, d / 2 + 0.04]}>
        <boxGeometry args={[w - 0.8, 2.3, 0.08]} />
        <meshStandardMaterial {...GLASS} />
      </mesh>
      {/* 가게마다 차양 + 간판 */}
      {range(shopCount).map((i) => {
        const shop = shops[i] ?? {}
        const cx = -w / 2 + 0.3 + shopW * (i + 0.5)
        return (
          <group key={i}>
            <mesh position={[cx, 2.95, d / 2 + 0.6]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[shopW - 0.3, 0.1, 1.25]} />
              <meshStandardMaterial color={shop.awning ?? '#2f7d5b'} />
            </mesh>
            {shop.text && (
              <mesh position={[cx, 3.6, d / 2 + 0.05]}>
                <planeGeometry args={[shopW - 0.6, 0.62]} />
                <meshStandardMaterial map={getSignTexture(shop.text, shop.bg, shop.fg)} />
              </mesh>
            )}
            {i > 0 && (
              <mesh position={[-w / 2 + 0.3 + shopW * i, 1.5, d / 2 + 0.1]}>
                <boxGeometry args={[0.3, 3, 0.2]} />
                <meshStandardMaterial color="#7d7a75" />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

// ── 카페 (빨간 차양 + 옥상 테라스 파라솔) ─────
export function Cafe({ item }) {
  const [w, h, d] = item.size
  const bodyH = h - 1.1
  const umbrella = item.umbrella ?? '#6a5acd'
  const sign = item.signs?.[0]
  const panelW = (w - 1.2) / 3

  // 옥상 난간 기둥 위치 (둘레를 따라 약 1.2m 간격)
  const railPosts = useMemo(() => {
    const posts = []
    const nx = Math.round(w / 1.2)
    const nz = Math.round(d / 1.2)
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx
      posts.push([x, d / 2], [x, -d / 2])
    }
    for (let i = 1; i < nz; i++) {
      const z = -d / 2 + (d * i) / nz
      posts.push([w / 2, z], [-w / 2, z])
    }
    return posts
  }, [w, d])

  const umbrellas = [
    [-w * 0.25, -d * 0.1],
    [w * 0.2, d * 0.15],
    [w * 0.05, -d * 0.3],
  ]

  return (
    <group>
      {/* 몸통 (흰 벽) + 아래 검은 띠 + 처마 장식 */}
      <mesh position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={item.color ?? '#f4f1ea'} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[w + 0.06, 0.6, d + 0.06]} />
        <meshStandardMaterial color="#3d3d3d" />
      </mesh>
      <mesh position={[0, bodyH, 0]}>
        <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
        <meshStandardMaterial color="#e2ddd2" />
      </mesh>
      {/* 1층 큰 유리창 3개 */}
      {range(3).map((i) => (
        <mesh key={i} position={[-w / 2 + 0.6 + panelW * (i + 0.5), 2, d / 2 + 0.03]}>
          <boxGeometry args={[panelW - 0.3, 2.6, 0.06]} />
          <meshStandardMaterial {...GLASS} />
        </mesh>
      ))}
      {/* 2층 창문 띠 */}
      <mesh position={[0, bodyH - 1, d / 2 + 0.03]}>
        <boxGeometry args={[w - 1.2, 0.9, 0.06]} />
        <meshStandardMaterial {...GLASS} />
      </mesh>
      {/* 빨간 차양 */}
      <mesh position={[0, 3.45, d / 2 + 0.65]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[w - 0.4, 0.1, 1.4]} />
        <meshStandardMaterial color="#c2453a" />
      </mesh>
      {/* 간판 */}
      {sign && (
        <mesh position={[0, 4.15, d / 2 + 0.04]}>
          <planeGeometry args={[w * 0.55, 0.6]} />
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg)} />
        </mesh>
      )}
      {/* 옥상 데크 + 난간 */}
      <mesh position={[0, bodyH + 0.18, 0]}>
        <boxGeometry args={[w - 0.1, 0.06, d - 0.1]} />
        <meshStandardMaterial color="#9b7653" />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[0, h, (side * d) / 2]}>
            <boxGeometry args={[w, 0.08, 0.08]} />
            <meshStandardMaterial color="#2f2f2f" />
          </mesh>
          <mesh position={[(side * w) / 2, h, 0]}>
            <boxGeometry args={[0.08, 0.08, d]} />
            <meshStandardMaterial color="#2f2f2f" />
          </mesh>
        </group>
      ))}
      {railPosts.map(([x, z], i) => (
        <mesh key={i} position={[x, bodyH + 0.65, z]}>
          <boxGeometry args={[0.06, 0.9, 0.06]} />
          <meshStandardMaterial color="#2f2f2f" />
        </mesh>
      ))}
      {/* 파라솔 + 테이블 */}
      {umbrellas.map(([x, z], i) => (
        <group key={i} position={[x, bodyH + 0.2, z]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.2, 6]} />
            <meshStandardMaterial color="#d9d9d9" />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[1.1, 0.45, 8]} />
            <meshStandardMaterial color={umbrella} flatShading />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.45, 0.45, 0.05, 16]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── 벽화 건물 (막다른 골목 끝) ────────────────
export function Mural({ item }) {
  const [w, h, d] = item.size
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={item.color ?? '#f6f0d8'} />
      </mesh>
      <mesh position={[0, h - 0.15, 0]}>
        <boxGeometry args={[w + 0.2, 0.3, d + 0.2]} />
        <meshStandardMaterial color="#8a8278" />
      </mesh>
      <mesh position={[0, (h - 1.4) / 2 + 0.3, d / 2 + 0.02]}>
        <planeGeometry args={[w - 0.6, h - 1.4]} />
        <meshStandardMaterial map={getMuralTexture()} />
      </mesh>
    </group>
  )
}

// ── 돌담 (기와 얹은 담벼락) ───────────────────
export function StoneWall({ item }) {
  const [w, h, d] = item.size
  const capH = 0.45
  const wallH = h - capH
  const texture = useMemo(() => getTiledTexture('stone', w / 2, wallH / 2), [w, wallH])
  const capGeometry = useMemo(() => hipRoofGeometry(w + 0.4, d + 0.7, capH, 0.08), [w, d])
  return (
    <group>
      <mesh position={[0, wallH / 2, 0]}>
        <boxGeometry args={[w, wallH, d]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      <mesh geometry={capGeometry} position={[0, wallH, 0]}>
        <meshStandardMaterial color={ROOF} flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
