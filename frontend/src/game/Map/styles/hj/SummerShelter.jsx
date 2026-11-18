import { getSignTexture } from '../textures.js'
import { getSummerPosterTexture } from './hjTextures.js'

// [3. 개발 > 기초개발/서비스] 촬영지 '여름 정류장' (혜진 구역 전용 style: "summerShelter")
// 민트색 철골 + 나무 지붕·벤치 + 뒷벽에 가상 영화 포스터 「여름의 기억」.
// size [가로 w, 높이 h, 깊이 d], 앞면(열린 쪽) +z. item.signs[0] = 지붕 앞 간판.
const MINT = '#7fc8b4'
const MINT_DARK = '#5aa892'
const WOOD = '#a8774f'
const WOOD_DARK = '#7d5636'

export default function SummerShelter({ item }) {
  const [w, h, d] = item.size
  const sign = item.signs?.[0]
  const poster = getSummerPosterTexture()
  const posterH = Math.min(h - 0.7, 1.7)
  const posterW = posterH * (512 / 720)

  return (
    <group>
      {/* 민트 기둥 4개 */}
      {[
        [w / 2 - 0.06, -d / 2 + 0.06],
        [-w / 2 + 0.06, -d / 2 + 0.06],
        [w / 2 - 0.06, d / 2 - 0.06],
        [-w / 2 + 0.06, d / 2 - 0.06],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]}>
          <boxGeometry args={[0.1, h, 0.1]} />
          <meshStandardMaterial color={MINT_DARK} roughness={0.5} />
        </mesh>
      ))}

      {/* 뒷벽: 아래는 나무판, 위는 민트 틀 + 포스터 */}
      <mesh position={[0, 0.45, -d / 2 + 0.05]}>
        <boxGeometry args={[w - 0.12, 0.9, 0.05]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.9 + (h - 0.9) / 2, -d / 2 + 0.04]}>
        <boxGeometry args={[w - 0.12, h - 0.9, 0.04]} />
        <meshStandardMaterial color={MINT} roughness={0.6} />
      </mesh>
      {/* 포스터 액자 */}
      <mesh position={[-w / 4, 0.95 + posterH / 2, -d / 2 + 0.075]}>
        <boxGeometry args={[posterW + 0.1, posterH + 0.1, 0.02]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      <mesh position={[-w / 4, 0.95 + posterH / 2, -d / 2 + 0.09]}>
        <planeGeometry args={[posterW, posterH]} />
        <meshStandardMaterial map={poster} color={poster ? '#ffffff' : '#f2b48c'} emissive="#ffe6c4" emissiveIntensity={0.12} />
      </mesh>
      {/* 노선 안내판 (포스터 옆) */}
      <mesh position={[w / 4, 1.6, -d / 2 + 0.08]}>
        <planeGeometry args={[w * 0.32, 0.9]} />
        <meshStandardMaterial color="#fffdf9" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[w / 4, 1.85 - i * 0.22, -d / 2 + 0.09]}>
          <planeGeometry args={[w * 0.26, 0.06]} />
          <meshStandardMaterial color={i === 0 ? '#c86d51' : '#78826d'} />
        </mesh>
      ))}
      <mesh position={[w / 4, 2.27, -d / 2 + 0.11]}>
        <planeGeometry args={[w * 0.3, 0.34]} />
        <meshStandardMaterial map={getSignTexture('마지막 버스', '#6f4a3a', '#f8e2af')} roughness={0.95} />
      </mesh>

      {/* 나무 벤치 */}
      {[-0.12, 0.08].map((z) => (
        <mesh key={z} position={[0, 0.48, -d / 2 + 0.35 + z]}>
          <boxGeometry args={[w * 0.75, 0.05, 0.16]} />
          <meshStandardMaterial color={WOOD} roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * w * 0.33, 0.24, -d / 2 + 0.33]}>
          <boxGeometry args={[0.06, 0.48, 0.3]} />
          <meshStandardMaterial color={MINT_DARK} />
        </mesh>
      ))}

      {/* 지붕: 나무 밑판 + 민트 덮개 (앞으로 살짝 기울어짐) */}
      <mesh position={[0, h - 0.02, 0.05]} rotation={[0.06, 0, 0]}>
        <boxGeometry args={[w + 0.25, 0.06, d + 0.35]} />
        <meshStandardMaterial color={WOOD} roughness={0.8} />
      </mesh>
      <mesh position={[0, h + 0.06, 0.05]} rotation={[0.06, 0, 0]}>
        <boxGeometry args={[w + 0.35, 0.08, d + 0.45]} />
        <meshStandardMaterial color={MINT} roughness={0.5} />
      </mesh>

      {/* 지붕 앞 간판 */}
      {sign && (
        <mesh position={[0, h - 0.24, d / 2 + 0.2]}>
          <planeGeometry args={[w * 0.7, 0.32]} />
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg)} />
        </mesh>
      )}
    </group>
  )
}
