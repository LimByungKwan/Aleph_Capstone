import { useMemo } from 'react'
import { getSignTexture } from '../textures.js'
import { getRedBrickTexture, getRetroMuralTexture, getStripeTexture } from './hjTextures.js'

// [3. 개발 > 기초개발/서비스] 혜진 구역 빈티지 벽돌 건물 (style: "hjBrickBuilding")
// size [가로 w, 높이 h, 깊이 d], 앞면 +z
// item.color: 벽 색(벽돌이 아니라 칠한 벽이면) / item.brick: false면 칠한 벽
// item.signs[0]: 1층 간판 { text, bg, fg } / item.awning: [색1, 색2] 줄무늬 차양
// item.mural: "left" | "right" | "front" — 그 면에 SEOUL 1988 벽화
// item.roofTank: true면 옥상 물탱크
const FLOOR_H = 3

export default function HjBrickBuilding({ item }) {
  const [w, h, d] = item.size
  const floors = Math.max(1, Math.floor(h / FLOOR_H))
  const sign = item.signs?.[0]
  const awning = item.awning

  const wallMap = useMemo(() => {
    if (item.brick === false) return null
    const base = getRedBrickTexture()
    if (!base) return null
    const t = base.clone()
    t.repeat.set(w / 1.2, h / 1.2)
    t.needsUpdate = true
    return t
  }, [item.brick, w, h])

  const stripe = awning ? getStripeTexture(awning[0], awning[1]) : null
  const mural = item.mural ? getRetroMuralTexture() : null
  const windowsPerFloor = Math.max(1, Math.floor(w / 2.2))

  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={wallMap} color={wallMap ? '#ffffff' : item.color ?? '#cdbfa8'} roughness={0.95} />
      </mesh>
      {/* 층 띠 */}
      {Array.from({ length: floors - 1 }, (_, i) => (
        <mesh key={i} position={[0, FLOOR_H * (i + 1), 0]}>
          <boxGeometry args={[w + 0.08, 0.14, d + 0.08]} />
          <meshStandardMaterial color="#d9cbb5" />
        </mesh>
      ))}
      {/* 옥상 난간 + 잡동사니 */}
      <mesh position={[0, h + 0.2, 0]}>
        <boxGeometry args={[w + 0.12, 0.4, d + 0.12]} />
        <meshStandardMaterial color="#9b8f80" />
      </mesh>
      <mesh position={[0, h + 0.02, 0]}>
        <boxGeometry args={[w - 0.3, 0.05, d - 0.3]} />
        <meshStandardMaterial color="#6f8f6a" />
      </mesh>
      {item.roofTank && (
        <group position={[w * 0.25, h, -d * 0.2]}>
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 1.1, 14]} />
            <meshStandardMaterial color="#3f7fbf" />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[1.3, 0.4, 1.3]} />
            <meshStandardMaterial color="#4a4a4a" />
          </mesh>
        </group>
      )}

      {/* 위층 창문 (앞·뒤) */}
      {Array.from({ length: floors - 1 }, (_, f) =>
        Array.from({ length: windowsPerFloor }, (_, i) => {
          const x = -w / 2 + (w / windowsPerFloor) * (i + 0.5)
          const y = FLOOR_H * (f + 1) + 1.5
          const lit = (f + i + (item.id?.length ?? 0)) % 3 === 0
          return [1, -1].map((side) => (
            <group key={`${f}-${i}-${side}`} position={[x, y, (side * d) / 2]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
              <mesh position={[0, 0, 0.04]}>
                <boxGeometry args={[1.15, 1.35, 0.08]} />
                <meshStandardMaterial color="#efe6d6" />
              </mesh>
              <mesh position={[0, 0, 0.09]}>
                <planeGeometry args={[0.95, 1.15]} />
                <meshStandardMaterial
                  color={lit ? '#ffe2ae' : '#6f8796'}
                  emissive={lit ? '#ffcf8a' : '#000000'}
                  emissiveIntensity={lit ? 0.55 : 0}
                />
              </mesh>
              <mesh position={[0, 0, 0.1]}>
                <boxGeometry args={[0.05, 1.15, 0.02]} />
                <meshStandardMaterial color="#efe6d6" />
              </mesh>
            </group>
          ))
        }),
      )}

      {/* 1층 가게: 유리문 + 줄무늬 차양 + 간판 */}
      <mesh position={[0, 1.2, d / 2 + 0.04]}>
        <boxGeometry args={[w - 1, 2.3, 0.08]} />
        <meshStandardMaterial color="#ffe6b8" emissive="#ffcf8a" emissiveIntensity={0.35} />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[(k * (w - 1)) / 3, 1.2, d / 2 + 0.09]}>
          <boxGeometry args={[0.08, 2.3, 0.04]} />
          <meshStandardMaterial color="#4a3a2e" />
        </mesh>
      ))}
      {stripe && (
        <mesh position={[0, 2.75, d / 2 + 0.6]} rotation={[0.38, 0, 0]}>
          <boxGeometry args={[w - 0.4, 0.06, 1.3]} />
          <meshStandardMaterial map={stripe} />
        </mesh>
      )}
      {sign && (
        <mesh position={[0, 3.35, d / 2 + 0.06]}>
          <planeGeometry args={[Math.min(w - 0.8, 5), 0.6]} />
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg)} />
        </mesh>
      )}

      {/* SEOUL 1988 벽화 */}
      {mural && (
        <mesh
          position={
            item.mural === 'front'
              ? [0, h / 2 + 1.2, d / 2 + 0.03]
              : [(item.mural === 'right' ? 1 : -1) * (w / 2 + 0.03), h / 2 + 0.8, 0]
          }
          rotation={[0, item.mural === 'front' ? 0 : item.mural === 'right' ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          <planeGeometry args={[(item.mural === 'front' ? w : d) * 0.85, Math.min(h - 2.4, ((item.mural === 'front' ? w : d) * 0.85 * 640) / 512)]} />
          <meshStandardMaterial map={mural} />
        </mesh>
      )}
    </group>
  )
}
