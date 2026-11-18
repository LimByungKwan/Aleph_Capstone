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
// item.shop = { look, interior?, enterable, sign: { text, bg, fg } }, item.sugidama?: true
// interior: 겉모습(look)은 같고 안만 다를 때 (예: 마치야 겉모습 + 찻집 내부 = "teahouse")
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

      {/* 삼나무 공 (스기다마, 양조장 표시). item.sugidama: true. 간판 오른쪽 처마 밑 */}
      {item.sugidama && (
        <group position={[w / 2 - 0.7, DOOR_H + 0.1, front + 0.5]}>
          <Cyl p={[0, 0.45, 0]} r={0.02} h={0.3} c="#2b1d14" />
          <mesh>
            <icosahedronGeometry args={[0.4, 1]} />
            <meshStandardMaterial color="#5b6b3a" flatShading />
          </mesh>
        </group>
      )}

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
      {enterable && <Interior look={shop.interior ?? shop.look} w={w} d={d} wallH={wallH} />}
    </group>
  )
}

function Interior({ look, w, d, wallH }) {
  const back = -d / 2 + T
  if (look === 'cafe') return <CafeInterior w={w} back={back} wallH={wallH} d={d} />
  if (look === 'bakery') return <BakeryInterior w={w} back={back} d={d} />
  if (look === 'antique') return <AntiqueInterior w={w} back={back} d={d} wallH={wallH} />
  if (look === 'machiya') return <UdonInterior w={w} back={back} d={d} wallH={wallH} />
  if (look === 'teahouse') return <TeahouseInterior w={w} back={back} d={d} wallH={wallH} />
  if (look === 'zakka') return <ZakkaInterior w={w} back={back} d={d} wallH={wallH} />
  if (look === 'brewery') return <BreweryInterior w={w} back={back} d={d} wallH={wallH} />
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

// 요괴 찻집: 왼쪽 다다미 좌석(낮은 상 2개) + 오른쪽 벽 화과자 진열장 + 뒤쪽 차 카운터
// 입구에서 뒤 카운터까지 가운데 통로(x -1~1)는 비워 둠
const WAGASHI = ['#f9c6d3', '#9bbf6a', '#f5f0e6', '#8e6aa8', '#e8b04a']
function TeahouseInterior({ w, back, d, wallH }) {
  const front = d / 2
  const tatamiW = w / 2 - 1.35
  const tatamiX = -w / 2 + T + tatamiW / 2
  const tatamiD = d - 1.8
  const tatamiZ = back + tatamiD / 2
  const caseX = w / 2 - T - 0.4
  return (
    <group>
      {/* 다다미 좌석 (높이 0.3) + 이음선 */}
      <Box p={[tatamiX, 0.25, tatamiZ]} s={[tatamiW, 0.3, tatamiD]} c="#c8c38a" />
      <Box p={[tatamiX, 0.41, tatamiZ]} s={[0.04, 0.01, tatamiD - 0.1]} c="#7a7448" />
      {range(2).map((i) => (
        <Box key={i} p={[tatamiX, 0.41, back + ((i + 1) * tatamiD) / 3]} s={[tatamiW - 0.1, 0.01, 0.04]} c="#7a7448" />
      ))}
      {/* 낮은 상 + 방석 + 찻잔·화과자 접시 */}
      {[-1, 1].map((i) => (
        <group key={i} position={[tatamiX, 0.4, tatamiZ + i * 1.3]}>
          <Box p={[0, 0.3, 0]} s={[0.9, 0.06, 0.9]} c="#4a2f1f" />
          <Box p={[0, 0.14, 0]} s={[0.12, 0.28, 0.12]} c="#4a2f1f" />
          {[-1, 1].map((c) => (
            <Box key={c} p={[c * 0.75, 0.04, 0]} s={[0.5, 0.08, 0.5]} c="#14532d" />
          ))}
          {[-1, 1].map((c) => (
            <Cyl key={c} p={[c * 0.25, 0.38, 0.15]} r={0.06} h={0.1} c="#5f7f4a" />
          ))}
          <Cyl p={[0, 0.34, -0.2]} r={0.14} h={0.02} c="#f5f0e6" />
          <mesh position={[0, 0.39, -0.2]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshStandardMaterial color={WAGASHI[i < 0 ? 0 : 1]} />
          </mesh>
        </group>
      ))}
      {/* 족자 (다다미 쪽 뒷벽) */}
      <Box p={[tatamiX, 2.3, back + 0.02]} s={[0.8, 1.6, 0.03]} c="#efe6cf" />
      <Box p={[tatamiX, 2.4, back + 0.04]} s={[0.08, 0.9, 0.01]} c="#2b1d14" />
      {[1.5, 3.1].map((y) => (
        <Box key={y} p={[tatamiX, y, back + 0.04]} s={[0.9, 0.05, 0.05]} c="#3f2a1d" />
      ))}

      {/* 화과자 진열장 (오른쪽 벽, 유리 덮개) */}
      <Box p={[caseX, 0.55, 0.6]} s={[0.7, 0.86, 2.4]} c="#3f2a1d" />
      <Box p={[caseX, 1.18, 0.6]} s={[0.7, 0.4, 2.4]} c={GLASS} o={0.3} />
      {range(2).map((row) =>
        range(6).map((i) => {
          const z = 0.6 - 1.0 + (i * 2.0) / 5
          const color = WAGASHI[(i + row * 2) % WAGASHI.length]
          return row === 0 ? (
            <mesh key={`${row}${i}`} position={[caseX - 0.12, 1.05, z]}>
              <sphereGeometry args={[0.07, 12, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          ) : (
            <Box key={`${row}${i}`} p={[caseX + 0.14, 1.04, z]} s={[0.12, 0.08, 0.18]} c={color} />
          )
        }),
      )}

      {/* 차 카운터 (뒤 오른쪽) + 화로·쇠주전자 + 차통 + 여우 인형 */}
      <Box p={[w / 4 + 0.3, 0.55, back + 0.45]} s={[w / 2 - 1.2, 1.0, 0.7]} c="#5a3d2a" />
      <Box p={[w / 4 + 0.3, 1.08, back + 0.45]} s={[w / 2 - 1.1, 0.06, 0.8]} c="#2b1d14" />
      <Cyl p={[w / 4 - 0.4, 1.2, back + 0.45]} r={0.2} h={0.18} c="#6b6b6b" />
      <mesh position={[w / 4 - 0.4, 1.42, back + 0.45]}>
        <sphereGeometry args={[0.17, 14, 10]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {['#14532d', '#1f1f1f', '#7f1d1d'].map((c, i) => (
        <Cyl key={c} p={[w / 4 + 0.4 + i * 0.3, 1.24, back + 0.35]} r={0.09} h={0.26} c={c} />
      ))}
      {[0, 1].map((i) => (
        <group key={i} position={[w / 2 - T - 0.45 - i * 0.35, 1.11, back + 0.6]}>
          <mesh position={[0, 0.16, 0]}>
            <coneGeometry args={[0.09, 0.32, 10]} />
            <meshStandardMaterial color="#f5f0e6" />
          </mesh>
          <Box p={[0, 0.12, 0.07]} s={[0.12, 0.06, 0.02]} c="#b91c1c" />
        </group>
      ))}

      {/* 입구 왼쪽 구석: 외눈 우산 요괴 (접힌 우산 + 눈 하나) */}
      <group position={[-w / 2 + T + 0.45, 0.12, front - T - 0.45]}>
        <Cyl p={[0, 0.2, 0]} r={0.03} h={0.4} c="#5a3d2a" />
        <mesh position={[0, 0.95, 0]}>
          <coneGeometry args={[0.24, 1.1, 12]} />
          <meshStandardMaterial color="#6d4c8f" />
        </mesh>
        <mesh position={[0.11, 0.9, -0.1]}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.15, 0.9, -0.13]}>
          <sphereGeometry args={[0.03, 10, 6]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>

      {/* 종이 제등 (가운데 붉은 것 하나 + 양옆) */}
      <Cyl p={[0, wallH - 0.7, 0.3]} r={0.26} h={0.55} c="#c2410c" e="#ff9a4d" />
      {[-1, 1].map((i) => (
        <Cyl key={i} p={[i * w * 0.28, wallH - 0.6, -0.6]} r={0.18} h={0.4} c="#f5f0e6" e="#ffcc66" />
      ))}
    </group>
  )
}

// 하레야 잡화점: 천장의 펼친 우산들 + 창가 테루테루보즈 줄 + 왼쪽 우산꽂이
//              + 오른쪽 벽 선반(장화·작은 잡화) + 뒤쪽 계산대. 가운데 통로는 비워 둠
const UMBRELLA_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6']
function TeruTeruBozu({ p, scale = 1 }) {
  return (
    <group position={p} scale={scale}>
      <Cyl p={[0, 0.35, 0]} r={0.006} h={0.5} c="#9ca3af" />
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.11, 14, 10]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <coneGeometry args={[0.14, 0.28, 12, 1, true]} />
        <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <Box p={[0, -0.09, 0]} s={[0.2, 0.02, 0.2]} c="#ef4444" />
    </group>
  )
}
function ZakkaInterior({ w, back, d, wallH }) {
  const front = d / 2
  const shelfX = w / 2 - T - 0.3
  return (
    <group>
      {/* 천장: 펼친 우산 6개 (2줄) */}
      {range(6).map((i) => {
        const x = ((i % 3) - 1) * w * 0.27
        const z = i < 3 ? -0.9 : 1.0
        return (
          <group key={i} position={[x, wallH - 0.75, z]} rotation={[0.12 * ((i % 2) * 2 - 1), 0, 0.1 * (((i + 1) % 2) * 2 - 1)]}>
            <Cyl p={[0, 0.4, 0]} r={0.01} h={0.8} c="#d1d5db" />
            <mesh position={[0, 0.05, 0]}>
              <coneGeometry args={[0.7, 0.3, 8, 1, true]} />
              <meshStandardMaterial color={UMBRELLA_COLORS[i]} side={THREE.DoubleSide} />
            </mesh>
            <Cyl p={[0, -0.25, 0]} r={0.012} h={0.6} c="#4b5563" />
          </group>
        )
      })}

      {/* 창가(앞벽 안쪽) 테루테루보즈 줄 */}
      <Box p={[0, 2.95, front - T - 0.25]} s={[w - 0.8, 0.02, 0.02]} c="#9ca3af" />
      {range(7).map((i) => {
        const x = -w / 2 + 0.8 + (i * (w - 1.6)) / 6
        if (Math.abs(x) < DOOR_W / 2 + 0.1) return null
        return <TeruTeruBozu key={i} p={[x, 2.45, front - T - 0.25]} />
      })}

      {/* 왼쪽: 우산꽂이 2개 + 꽂힌 우산 */}
      {[-1.2, 0.6].map((z, k) => (
        <group key={z} position={[-w / 2 + T + 0.4, 0.12, z]}>
          <Cyl p={[0, 0.3, 0]} r={0.32} h={0.6} c="#475569" />
          {range(5).map((i) => {
            const a = (i / 5) * Math.PI * 2
            return (
              <group key={i} position={[Math.cos(a) * 0.15, 0.6, Math.sin(a) * 0.15]} rotation={[Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]}>
                <mesh position={[0, 0.35, 0]}>
                  <coneGeometry args={[0.06, 0.75, 8]} />
                  <meshStandardMaterial color={UMBRELLA_COLORS[(i + k * 2) % UMBRELLA_COLORS.length]} />
                </mesh>
                <mesh position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.05, 0.012, 6, 10, Math.PI]} />
                  <meshStandardMaterial color="#5a3d2a" />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}

      {/* 오른쪽 벽 선반 3단: 장화 + 작은 잡화 상자 */}
      <Box p={[shelfX + 0.2, 1.2, -0.3]} s={[0.05, 2.2, d * 0.6]} c="#e2e8f0" />
      {[0.5, 1.15, 1.8].map((y) => (
        <Box key={y} p={[shelfX, y, -0.3]} s={[0.45, 0.04, d * 0.6]} c="#cbd5e1" />
      ))}
      {[0.5, 1.15, 1.8].map((y, row) =>
        range(5).map((i) => {
          const z = -0.3 - d * 0.25 + (i * d * 0.5) / 4
          const color = UMBRELLA_COLORS[(i + row) % UMBRELLA_COLORS.length]
          return row === 0 ? (
            <group key={`${row}${i}`} position={[shelfX - 0.02, y + 0.12, z]}>
              <Box p={[0, 0.08, 0]} s={[0.12, 0.32, 0.12]} c={color} />
              <Box p={[-0.06, -0.04, 0]} s={[0.2, 0.08, 0.12]} c={color} />
            </group>
          ) : (
            <Box key={`${row}${i}`} p={[shelfX - 0.02, y + 0.11, z]} s={[0.18, 0.18, 0.26]} c={color} />
          )
        }),
      )}

      {/* 뒤쪽 계산대 + 계산기 + 테루테루보즈 하나 */}
      <Box p={[w / 4, 0.5, back + 0.5]} s={[w / 2 - 1.2, 1, 0.6]} c="#1e40af" />
      <Box p={[w / 4, 1.02, back + 0.5]} s={[w / 2 - 1.1, 0.05, 0.7]} c="#f8fafc" />
      <Box p={[w / 4 + 0.6, 1.12, back + 0.45]} s={[0.35, 0.15, 0.25]} c="#334155" />
      <TeruTeruBozu p={[w / 4 - 0.6, 1.3, back + 0.5]} scale={0.8} />
      {/* 뒷벽 하늘색 포스터 (맑음 표시) */}
      <Box p={[-w / 4, 2.2, back + 0.02]} s={[1.4, 1, 0.03]} c="#bae6fd" />
      <mesh position={[-w / 4, 2.25, back + 0.05]}>
        <circleGeometry args={[0.25, 20]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}

// 효카 양조장: 왼쪽 큰 나무 술통 2개 + 앞쪽 짚 술통(코모다루) 더미
//            + 오른쪽 벽 술병 선반 + 뒤쪽 시음 카운터(잔·술병). 가운데 통로는 비워 둠
function BigTub({ p, r = 0.7, h = 1.6 }) {
  return (
    <group position={p}>
      <Cyl p={[0, h / 2, 0]} r={r} h={h} c="#8a6a4a" />
      {[0.2, h / 2, h - 0.2].map((y) => (
        <Cyl key={y} p={[0, y, 0]} r={r + 0.02} h={0.08} c="#3f2a1d" />
      ))}
      <Cyl p={[0, h + 0.02, 0]} r={r - 0.05} h={0.04} c="#6b4a2f" />
    </group>
  )
}
function Komodaru({ p }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.23, 0]} r={0.28} h={0.46} c="#e9dfc4" />
      <Cyl p={[0, 0.06, 0]} r={0.29} h={0.05} c="#7a6a4a" />
      <Cyl p={[0, 0.4, 0]} r={0.29} h={0.05} c="#7a6a4a" />
      <Box p={[0, 0.23, 0.27]} s={[0.22, 0.24, 0.02]} c="#b91c1c" />
    </group>
  )
}
function Isshobin({ p, c = '#1f4d2b' }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.17, 0]} r={0.06} h={0.34} c={c} />
      <Cyl p={[0, 0.4, 0]} r={0.025} h={0.12} c={c} />
      <Box p={[0, 0.18, 0.06]} s={[0.07, 0.12, 0.005]} c="#f5f0e6" />
    </group>
  )
}
function BreweryInterior({ w, back, d, wallH }) {
  const front = d / 2
  const leftX = -w / 2 + T + 0.85
  const rackX = w / 2 - T - 0.25
  return (
    <group>
      {/* 큰 술통 2개 (왼쪽 벽) */}
      <BigTub p={[leftX, 0.12, back + 0.9]} />
      <BigTub p={[leftX, 0.12, back + 2.5]} r={0.6} h={1.4} />

      {/* 짚 술통 더미 3-2-1 (왼쪽 앞) */}
      <group position={[leftX + 0.05, 0.12, front - T - 1.2]}>
        {[-0.58, 0, 0.58].map((z) => (
          <Komodaru key={z} p={[0, 0, z]} />
        ))}
        {[-0.29, 0.29].map((z) => (
          <Komodaru key={z} p={[0, 0.46, z]} />
        ))}
        <Komodaru p={[0, 0.92, 0]} />
      </group>

      {/* 오른쪽 벽 술병 선반 */}
      <Box p={[rackX + 0.15, 1.2, 0.3]} s={[0.05, 2.2, d * 0.5]} c="#5a3d2a" />
      {[0.5, 1.15, 1.8].map((y) => (
        <group key={y}>
          <Box p={[rackX, y, 0.3]} s={[0.35, 0.04, d * 0.5]} c="#6b4a2f" />
          {range(6).map((i) => (
            <Isshobin key={i} p={[rackX, y + 0.02, 0.3 - d * 0.22 + (i * d * 0.44) / 5]} c={i % 2 ? '#5b3a1e' : '#1f4d2b'} />
          ))}
        </group>
      ))}

      {/* 시음 카운터 (뒤 오른쪽) + 잔(마스) + 술병 */}
      <Box p={[w / 4 + 0.2, 0.55, back + 0.5]} s={[w / 2 - 1, 1.0, 0.7]} c="#6b4a2f" />
      <Box p={[w / 4 + 0.2, 1.08, back + 0.5]} s={[w / 2 - 0.9, 0.06, 0.8]} c="#2b1d14" />
      {range(4).map((i) => (
        <Box key={i} p={[w / 4 - 0.9 + i * 0.35, 1.16, back + 0.65]} s={[0.12, 0.1, 0.12]} c="#e8d3a8" />
      ))}
      <Isshobin p={[w / 4 + 0.7, 1.11, back + 0.4]} />
      <Isshobin p={[w / 4 + 1.0, 1.11, back + 0.4]} c="#5b3a1e" />

      {/* 뒷벽 술 이름 천 (가운데) + 안쪽 스기다마 */}
      <Box p={[-0.3, 2.4, back + 0.02]} s={[1.2, 1.4, 0.02]} c="#1e3a5f" />
      <Box p={[-0.3, 2.4, back + 0.04]} s={[0.12, 1.0, 0.01]} c="#f5f0e6" />
      <group position={[w / 4 + 0.2, wallH - 0.75, back + 0.6]}>
        <Cyl p={[0, 0.4, 0]} r={0.015} h={0.5} c="#2b1d14" />
        <mesh>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshStandardMaterial color="#6b7a3e" flatShading />
        </mesh>
      </group>

      <PendantLamps xs={[-w * 0.15, w * 0.15]} z={0.4} wallH={wallH} />
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
