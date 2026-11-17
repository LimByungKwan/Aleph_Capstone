import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'

// 애니메이션 구역(JM) 전용: 들어갈 수 있는 가게 + 가게 겉모습. 담당: 지민
//
// 들어갈 수 있는 가게(shop.enterable = true) 만드는 법:
// 1) 건물은 "collider": false (통째 충돌 박스를 끔)
// 2) 벽 충돌은 생성 스크립트가 "jmCollider" 소품(눈에 안 보이는 벽)으로 따로 깔아 줌
//    (style 안에서는 충돌을 만들 수 없어서. Colliders.jsx 가 소품 size 로 충돌 박스를 만들어 줌)
// 3) 입구는 앞면(+z) 가운데, 폭 DOOR_W

export const DOOR_W = 1.8
const DOOR_H = 2.5
const T = 0.25 // 벽 두께
const range = (n) => Array.from({ length: n }, (_, i) => i)

const LOOKS = {
  cafe: { wall: '#f4efe4', trim: '#1e3a5f', floor: '#8a6a4a', roof: 'flat', awning: '#e8792a' },
  bakery: { wall: '#fbf3e4', trim: '#7c2d12', floor: '#d9c3a0', roof: 'hip', roofColor: '#9c4a2f', awning: '#f59e0b' },
  antique: { wall: '#8a5a3b', trim: '#3f2a1d', floor: '#6b4a2f', roof: 'pyramid', roofColor: '#3f6f5a', upper: '#efe3c8' },
  machiya: { wall: '#5a3d2a', trim: '#2b1d14', floor: '#c9b48a', roof: 'tile', roofColor: '#33373d', upper: '#efe9dc' },
  zakka: { wall: '#eef3f8', trim: '#1e40af', floor: '#cbd5e1', roof: 'flat', awning: '#60a5fa' },
  library: { wall: '#d8cbb3', trim: '#14532d', floor: '#b9a582', roof: 'flat', upper: '#cbbd9f' },
}

// 작은 도형 도우미
function Box({ p, s, c, e, o }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={e ?? '#000000'} emissiveIntensity={e ? 0.5 : 0} transparent={o !== undefined} opacity={o ?? 1} />
    </mesh>
  )
}
function Cyl({ p, r, h, c, e, rot }) {
  return (
    <mesh position={p} rotation={rot ?? [0, 0, 0]}>
      <cylinderGeometry args={[r, r, h, 14]} />
      <meshStandardMaterial color={c} emissive={e ?? '#000000'} emissiveIntensity={e ? 0.6 : 0} />
    </mesh>
  )
}
const GLASS = '#a9cbe0'

// ── 가게 ──────────────────────────────────────
// item.shop = { look, enterable, sign: { text, bg, fg } }
export function JmShopRoom({ item }) {
  const [w, h, d] = item.size
  const shop = item.shop ?? {}
  const look = LOOKS[shop.look] ?? LOOKS.cafe
  const enterable = !!shop.enterable
  const wallH = Math.min(4.2, h * 0.62)
  const upperH = look.upper ? Math.max(0, h - wallH - 2) : 0
  const roofBase = wallH + upperH
  const roofH = Math.max(0.6, h - roofBase)
  const front = d / 2
  const doorHalf = DOOR_W / 2
  const sideW = (w - DOOR_W) / 2 // 문 양옆 앞벽 폭

  const roofGeometry = useMemo(() => {
    if (look.roof === 'hip' || look.roof === 'tile') return hipRoofGeometry(w + 1, d + 1, roofH, look.roof === 'tile' ? 0.25 : 0.1)
    return null
  }, [look.roof, w, d, roofH])

  const sign = shop.sign
  const signW = Math.min(w * 0.7, 5)
  const signH = 0.7

  return (
    <group>
      {/* 바닥 + 천장 */}
      <Box p={[0, 0.06, 0]} s={[w, 0.12, d]} c={look.floor} />
      <mesh position={[0, wallH - 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.1, d - 0.1]} />
        <meshStandardMaterial color="#f2ede3" side={THREE.DoubleSide} />
      </mesh>

      {/* 뒤·옆 벽 */}
      <Box p={[0, wallH / 2, -front + T / 2]} s={[w, wallH, T]} c={look.wall} />
      <Box p={[-w / 2 + T / 2, wallH / 2, 0]} s={[T, wallH, d]} c={look.wall} />
      <Box p={[w / 2 - T / 2, wallH / 2, 0]} s={[T, wallH, d]} c={look.wall} />

      {/* 앞벽: 아래 띠 + 위 띠 + 모서리 기둥 + 유리창 (+ 문) */}
      {[-1, 1].map((side) => {
        const cx = side * (doorHalf + sideW / 2)
        return (
          <group key={side}>
            <Box p={[cx, 0.45, front - T / 2]} s={[sideW, 0.9, T]} c={look.wall} />
            <Box p={[side * (w / 2 - 0.2), wallH / 2, front - T / 2]} s={[0.4, wallH, T]} c={look.trim} />
            <Box p={[cx, 1.7, front - T / 2]} s={[sideW - 0.4, 1.6, 0.05]} c={GLASS} o={0.35} />
          </group>
        )
      })}
      <Box p={[0, (wallH + DOOR_H) / 2, front - T / 2]} s={[w, wallH - DOOR_H, T]} c={look.wall} />
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * (doorHalf + 0.06), DOOR_H / 2, front - T / 2]} s={[0.12, DOOR_H, T + 0.04]} c={look.trim} />
      ))}
      {!enterable && <Box p={[0, DOOR_H / 2, front - T / 2]} s={[DOOR_W, DOOR_H, 0.06]} c={look.trim} />}
      {/* 들어갈 수 없는 가게는 창 너머가 불 켜진 것처럼 */}
      {!enterable && <Box p={[0, 1.6, front - T - 0.3]} s={[w - 0.6, 2, 0.05]} c="#fff1cf" e="#ffd88a" />}

      {/* 간판 (판 비율과 같은 텍스처) */}
      {sign && (
        <mesh position={[0, DOOR_H + (wallH - DOOR_H) / 2 + 0.05, front + 0.02]}>
          <planeGeometry args={[signW, signH]} />
          <GlowMaterial map={getJpSignTexture(sign.text, sign.bg, sign.fg, signW / signH)} />
        </mesh>
      )}

      {/* 차양 */}
      {look.awning && (
        <mesh position={[0, DOOR_H + 0.1, front + 0.55]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[w - 0.6, 0.06, 1.2]} />
          <meshStandardMaterial color={look.awning} />
        </mesh>
      )}

      {/* 마치야: 앞 세로 격자 + 노렌 */}
      {shop.look === 'machiya' &&
        [-1, 1].map((side) =>
          range(8).map((i) => {
            const from = w / 2 - 0.5
            const to = doorHalf + 0.2
            return <Box key={`${side}${i}`} p={[side * (to + ((from - to) * i) / 7), 1.7, front + 0.03]} s={[0.05, 1.6, 0.05]} c={look.trim} />
          }),
        )}
      {shop.look === 'machiya' && <Box p={[0, DOOR_H - 0.35, front + 0.08]} s={[DOOR_W + 0.4, 0.7, 0.02]} c="#1e3a5f" />}

      {/* 2층 (장식, 올라갈 수 없음) */}
      {upperH > 0 && <Box p={[0, wallH + upperH / 2, -0.2]} s={[w * 0.8, upperH, d * 0.8]} c={look.upper} />}
      {upperH > 0 && <Box p={[0, wallH + upperH / 2, d * 0.4 - 0.18]} s={[w * 0.45, upperH * 0.45, 0.05]} c="#fff1cf" e="#ffd88a" />}

      {/* 지붕 */}
      {look.roof === 'flat' && <Box p={[0, roofBase + 0.2, 0]} s={[w + 0.2, 0.4, d + 0.2]} c={look.trim} />}
      {roofGeometry && (
        <mesh geometry={roofGeometry} position={[0, roofBase - 0.05, 0]}>
          <meshStandardMaterial color={look.roofColor} flatShading side={THREE.DoubleSide} />
        </mesh>
      )}
      {look.roof === 'pyramid' && (
        <mesh position={[0, roofBase + roofH / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[Math.max(w, d) * 0.62, roofH, 4]} />
          <meshStandardMaterial color={look.roofColor} flatShading />
        </mesh>
      )}

      {/* 안쪽 가구 */}
      {enterable && <Interior look={shop.look} w={w} d={d} wallH={wallH} />}
    </group>
  )
}

function Interior({ look, w, d, wallH }) {
  const back = -d / 2 + T
  if (look === 'cafe') return <CafeInterior w={w} back={back} wallH={wallH} d={d} />
  if (look === 'bakery') return <BakeryInterior w={w} back={back} d={d} />
  if (look === 'antique') return <AntiqueInterior w={w} back={back} d={d} wallH={wallH} />
  if (look === 'machiya') return <UdonInterior w={w} back={back} d={d} wallH={wallH} />
  return null
}

function PendantLamps({ xs, z, wallH }) {
  return xs.map((x) => (
    <group key={x} position={[x, wallH - 0.05, z]}>
      <Cyl p={[0, -0.4, 0]} r={0.01} h={0.8} c="#222" />
      <Cyl p={[0, -0.85, 0]} r={0.18} h={0.22} c="#ffe2a8" e="#ffcc66" />
    </group>
  ))
}

// 깃사: 뒤 카운터 + 커피 머신 + 의자 + 창가 테이블
function CafeInterior({ w, back, wallH, d }) {
  return (
    <group>
      <Box p={[0, 0.55, back + 0.45]} s={[w * 0.62, 1.1, 0.7]} c="#5a3d2a" />
      <Box p={[0, 1.13, back + 0.45]} s={[w * 0.64, 0.06, 0.8]} c="#2b1d14" />
      <Box p={[-w * 0.18, 1.35, back + 0.35]} s={[0.6, 0.4, 0.4]} c="#b8bcc2" />
      <Box p={[0, 2.2, back + 0.02]} s={[w * 0.5, 0.9, 0.04]} c="#1f2a1f" />
      {[-1, 0, 1].map((i) => (
        <group key={i} position={[i * 1.1, 0, back + 1.25]}>
          <Cyl p={[0, 0.38, 0]} r={0.04} h={0.76} c="#333" />
          <Cyl p={[0, 0.78, 0]} r={0.2} h={0.06} c="#8a2b1f" />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 - 1.4), 0, d / 2 - 1.6]}>
          <Cyl p={[0, 0.37, 0]} r={0.05} h={0.74} c="#333" />
          <Cyl p={[0, 0.75, 0]} r={0.45} h={0.05} c="#f2ede3" />
          {[-1, 1].map((c) => (
            <Box key={c} p={[c * 0.75, 0.45, 0]} s={[0.4, 0.06, 0.4]} c="#6b4a2f" />
          ))}
          <Cyl p={[0, 0.83, 0]} r={0.06} h={0.1} c="#ffffff" />
        </group>
      ))}
      <PendantLamps xs={[-w * 0.25, 0, w * 0.25]} z={back + 1.3} wallH={wallH} />
    </group>
  )
}

// 베이커리: 가운데 유리 진열대 + 양쪽 빵 선반 + 계산대
function Bread({ p, c = '#c98a46' }) {
  return (
    <mesh position={p} rotation={[0, 0, Math.PI / 2]}>
      <capsuleGeometry args={[0.07, 0.16, 4, 8]} />
      <meshStandardMaterial color={c} />
    </mesh>
  )
}
function BakeryInterior({ w, back, d }) {
  return (
    <group>
      {/* 진열대 */}
      <Box p={[0, 0.45, back + 1.6]} s={[w * 0.5, 0.9, 0.8]} c="#f2ede3" />
      <Box p={[0, 1.1, back + 1.6]} s={[w * 0.5, 0.4, 0.8]} c={GLASS} o={0.3} />
      {range(8).map((i) => (
        <Bread key={i} p={[-w * 0.22 + (i * w * 0.44) / 7, 0.98, back + 1.45 + (i % 2) * 0.25]} c={i % 3 ? '#c98a46' : '#e0b070'} />
      ))}
      {/* 양쪽 벽 선반 */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 - T - 0.3), 0, 0]}>
          {[0.6, 1.2, 1.8].map((y) => (
            <group key={y}>
              <Box p={[0, y, 0]} s={[0.5, 0.05, d * 0.6]} c="#8a6a4a" />
              {range(5).map((i) => (
                <Bread key={i} p={[0, y + 0.1, -d * 0.25 + (i * d * 0.5) / 4]} c={(i + y * 10) % 3 ? '#b8743a' : '#e0b070'} />
              ))}
            </group>
          ))}
        </group>
      ))}
      {/* 계산대 */}
      <Box p={[w / 2 - 1.6, 0.5, d / 2 - 1.4]} s={[1.4, 1, 0.6]} c="#7c2d12" />
      <Box p={[w / 2 - 1.6, 1.1, d / 2 - 1.4]} s={[0.4, 0.2, 0.3]} c="#333" />
    </group>
  )
}

// 골동품 가게: 벽 선반의 시계·꽃병, 큰 괘종시계, 지구본, 작업대, 러그
function AntiqueInterior({ w, back, d, wallH }) {
  return (
    <group>
      <Box p={[0, 0.13, 0.3]} s={[w * 0.5, 0.02, d * 0.4]} c="#8b2e2e" />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 - T - 0.3), 0, -0.2]}>
          <Box p={[0, 1.1, 0]} s={[0.5, 2.2, d * 0.65]} c="#3f2a1d" />
          {[0.7, 1.4, 2].map((y) =>
            range(4).map((i) => (
              <mesh key={`${y}${i}`} position={[side * -0.28, y, -d * 0.25 + (i * d * 0.5) / 3]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.12, 0.12, 0.08, 14]} />
                <meshStandardMaterial color={i % 2 ? '#d4a52c' : '#e9e0cc'} />
              </mesh>
            )),
          )}
        </group>
      ))}
      {/* 괘종시계 */}
      <Box p={[-w / 2 + 1.1, 1.2, back + 0.35]} s={[0.6, 2.4, 0.45]} c="#5a3d2a" />
      <mesh position={[-w / 2 + 1.1, 2.0, back + 0.59]}>
        <circleGeometry args={[0.2, 20]} />
        <meshStandardMaterial color="#f5ecd5" />
      </mesh>
      {/* 작업대 + 램프 + 악기 모양(일반적인 현악기) */}
      <Box p={[w * 0.12, 0.45, back + 0.6]} s={[2.2, 0.9, 0.8]} c="#6b4a2f" />
      <Cyl p={[w * 0.12 + 0.8, 1.15, back + 0.5]} r={0.12} h={0.25} c="#ffe2a8" e="#ffcc66" />
      <mesh position={[w * 0.12 - 0.3, 0.95, back + 0.6]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <capsuleGeometry args={[0.13, 0.35, 4, 10]} />
        <meshStandardMaterial color="#a0522d" />
      </mesh>
      {/* 지구본 */}
      <Cyl p={[w / 2 - 1.2, 0.45, d / 2 - 1.3]} r={0.05} h={0.9} c="#3f2a1d" />
      <mesh position={[w / 2 - 1.2, 1.1, d / 2 - 1.3]}>
        <sphereGeometry args={[0.28, 18, 12]} />
        <meshStandardMaterial color="#4f8fc0" />
      </mesh>
      <PendantLamps xs={[0]} z={0} wallH={wallH} />
    </group>
  )
}

// 우동집: 한쪽 다다미 좌석 + 반대쪽 카운터·주방 + 제등
function UdonInterior({ w, back, d, wallH }) {
  const tatamiX = -w / 4
  return (
    <group>
      <Box p={[tatamiX, 0.25, -0.3]} s={[w / 2 - 0.4, 0.3, d - 1.6]} c="#c8c38a" />
      {range(3).map((i) => (
        <Box key={i} p={[tatamiX, 0.41, -d / 2 + 1.4 + i * 1.5]} s={[w / 2 - 0.5, 0.01, 0.04]} c="#7a7448" />
      ))}
      {[0, 1].map((i) => (
        <group key={i} position={[tatamiX, 0.4, -d / 2 + 1.8 + i * 2]}>
          <Box p={[0, 0.2, 0]} s={[1.1, 0.06, 0.8]} c="#3f2a1d" />
          <Box p={[0, 0.1, 0]} s={[0.15, 0.2, 0.15]} c="#3f2a1d" />
          {[-1, 1].map((c) => (
            <Box key={c} p={[c * 0.75, 0.04, 0]} s={[0.5, 0.08, 0.5]} c="#7f1d1d" />
          ))}
          <Cyl p={[0, 0.3, 0]} r={0.12} h={0.12} c="#f5f0e6" />
        </group>
      ))}
      {/* 카운터 + 의자 */}
      <Box p={[w / 4, 0.55, back + 1.4]} s={[w / 2 - 0.6, 1.1, 0.5]} c="#6b4a2f" />
      {[-1, 0, 1].map((i) => (
        <Cyl key={i} p={[w / 4 + i * 0.8, 0.35, back + 2]} r={0.18} h={0.7} c="#3f2a1d" />
      ))}
      {/* 주방 솥 */}
      {[-1, 1].map((i) => (
        <Cyl key={i} p={[w / 4 + i * 0.7, 1.05, back + 0.5]} r={0.3} h={0.5} c="#9aa0a6" />
      ))}
      {/* 제등 */}
      {[-1, 1].map((i) => (
        <Cyl key={i} p={[i * w * 0.25, wallH - 0.6, 0.5]} r={0.2} h={0.45} c="#f5f0e6" e="#ffcc66" />
      ))}
    </group>
  )
}

// ── 눈에 안 보이는 벽 (충돌만) ─────────────────────
// 들어갈 수 있는 가게의 벽 충돌용. Colliders.jsx 가 size 로 충돌 박스를 만들어 줘요
export function JmCollider() {
  return null
}

// ── 시골 버스 정류장 (나무 대기소 + 둥근 표지판) ───────────
// item.signs[0].text = 정류장 이름. size 예: [3, 2.6, 1.6]
export function JmBusStop({ item }) {
  const [w, h, d] = item.size
  const name = item.signs?.[0]?.text ?? '停留所'
  const plateW = 1
  const plateH = 0.28
  return (
    <group>
      {/* 나무 대기소 */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[(sx * (w - 0.1)) / 2, h / 2, (sz * (d - 0.1)) / 2]} s={[0.1, h, 0.1]} c="#5e4630" />),
      )}
      <Box p={[0, h * 0.5, -d / 2 + 0.05]} s={[w, h * 0.8, 0.05]} c="#8b6b47" />
      <mesh position={[0, h + 0.05, 0]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[w + 0.4, 0.06, d + 0.5]} />
        <meshStandardMaterial color="#7a8088" />
      </mesh>
      <Box p={[0, 0.45, -d / 2 + 0.35]} s={[w - 0.3, 0.06, 0.4]} c="#8b6b47" />
      {/* 둥근 표지판 + 이름판 (대기소 오른쪽 앞) */}
      <group position={[w / 2 + 0.6, 0, d / 2]}>
        <Cyl p={[0, 1.2, 0]} r={0.04} h={2.4} c="#9ca3af" />
        <mesh position={[0, 2.35, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.04, 24]} />
          <meshStandardMaterial color="#1d4ed8" />
        </mesh>
        <mesh position={[0, 1.85, 0.03]}>
          <planeGeometry args={[plateW, plateH]} />
          <GlowMaterial map={getJpSignTexture(name, '#f5f0e6', '#14532d', plateW / plateH)} />
        </mesh>
      </group>
    </group>
  )
}

export const JM_SHOP_STYLES = {
  jmShopRoom: JmShopRoom,
  jmCollider: JmCollider,
  jmBusStop: JmBusStop,
}
