import { useMemo } from 'react'
import { getWoodSignTexture } from './hjTextures.js'
import { HjCherryTree, HjLantern, HjPetals, HjStringLights } from './HjProps.jsx'

// [3. 개발 > 기초개발/서비스] 영화·드라마 구역 입구 — 벚꽃 전구줄 아치 (style: "hjBlossomGate")
// 양옆 벚나무 + 나무 기둥 두 개 + 위 가로대 + 흔들리는 나무 현판 + 늘어진 전구줄 + 바닥 등롱 + 흩날리는 꽃잎
// size [폭 w, 높이 h, -] — 길이 가운데로 지나가도록 기둥은 양 끝(±w/2)에 서요.
// item.title / item.subtitle: 현판 글씨
const WOOD = '#7a5236'
const WOOD_DARK = '#5a3d2b'

export default function HjBlossomGate({ item }) {
  const [w, h] = item.size
  const half = w / 2
  const sign = getWoodSignTexture(item.title ?? '영화·드라마 거리', item.subtitle ?? 'SceneWalk · 촬영지 골목')
  const signW = Math.min(w * 0.55, 5.2)
  const signH = signW * (220 / 768)

  // 하위 소품에 넘겨줄 가짜 item (id는 무늬 시드로만 씀)
  const parts = useMemo(
    () => ({
      treeL: { id: `${item.id}-tree-l`, size: [4.4, h + 0.6, 4.4] },
      treeR: { id: `${item.id}-tree-r`, size: [4.2, h + 0.4, 4.2] },
      lantern: { id: `${item.id}-lantern`, size: [0.5, 1, 0.5] },
      lights: {
        id: `${item.id}-lights`,
        points: [
          [-half, h - 0.15, 0.25],
          [0, h - 0.35, 0.25],
          [half, h - 0.15, 0.25],
        ],
      },
      lightsBack: {
        id: `${item.id}-lights-back`,
        points: [
          [-half - 2.2, h - 0.6, -0.4],
          [-half, h - 0.2, -0.25],
          [half, h - 0.2, -0.25],
          [half + 2.2, h - 0.6, -0.4],
        ],
      },
      petals: { id: `${item.id}-petals`, size: [w + 6, h + 1, 6] },
    }),
    [item.id, w, h, half],
  )

  return (
    <group>
      {/* 기둥 2개 (돌 받침 + 나무) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * half, 0, 0]}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.7, 0.5, 0.7]} />
            <meshStandardMaterial color="#b9b0a2" roughness={0.95} />
          </mesh>
          <mesh position={[0, h / 2 + 0.25, 0]}>
            <cylinderGeometry args={[0.17, 0.2, h - 0.5, 10]} />
            <meshStandardMaterial color={WOOD} roughness={0.8} />
          </mesh>
          {/* 기둥 감은 담쟁이 꽃 */}
          {[0.25, 0.45, 0.65].map((t) => (
            <mesh key={t} position={[0.15 * Math.sin(t * 20), h * t, 0.15 * Math.cos(t * 20)]} scale={0.22}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#f4b0c6" flatShading />
            </mesh>
          ))}
        </group>
      ))}

      {/* 위 가로대 (끝이 살짝 들린 지붕보) */}
      <mesh position={[0, h, 0]}>
        <boxGeometry args={[w + 1.2, 0.28, 0.5]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
      </mesh>
      <mesh position={[0, h + 0.28, 0]}>
        <boxGeometry args={[w + 1.6, 0.16, 0.8]} />
        <meshStandardMaterial color="#4a4f57" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (half + 0.9), h + 0.42, 0]} rotation={[0, 0, side * -0.45]}>
          <boxGeometry args={[0.6, 0.14, 0.75]} />
          <meshStandardMaterial color="#4a4f57" />
        </mesh>
      ))}

      {/* 현판: 가로대에 매달린 나무 간판 (앞·뒤 양면) */}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x * signW, h - 0.32, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 4]} />
          <meshStandardMaterial color="#2c2a29" />
        </mesh>
      ))}
      <group position={[0, h - 0.6 - signH / 2, 0]}>
        <mesh>
          <boxGeometry args={[signW + 0.12, signH + 0.12, 0.08]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={side} position={[0, 0, side * 0.045]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[signW, signH]} />
            <meshStandardMaterial map={sign} emissive="#ffe2b5" emissiveIntensity={0.08} />
          </mesh>
        ))}
      </group>

      {/* 전구줄: 앞쪽은 기둥 사이, 뒤쪽은 벚나무까지 늘어짐 */}
      <HjStringLights item={parts.lights} />
      <HjStringLights item={parts.lightsBack} />

      {/* 양옆 벚나무 */}
      <group position={[-half - 2.2, 0, -0.6]}>
        <HjCherryTree item={parts.treeL} />
      </group>
      <group position={[half + 2.2, 0, -0.6]}>
        <HjCherryTree item={parts.treeR} />
      </group>

      {/* 바닥 등롱 (기둥 앞) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (half + 0.7), 0, 0.9]}>
          <HjLantern item={{ ...parts.lantern, light: side > 0 }} />
        </group>
      ))}

      {/* 흩날리는 꽃잎 */}
      <HjPetals item={parts.petals} />

      {/* 아치 전체를 비추는 따뜻한 빛 */}
      <pointLight position={[0, h - 0.8, 1.5]} color="#ffc98a" intensity={5} distance={9} decay={2} />
    </group>
  )
}
