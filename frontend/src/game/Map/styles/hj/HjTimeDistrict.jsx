import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace } from 'three'
import { Ball, Box, Cyl, GEO, Instances, mat, texMat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { getSwirlTexture } from './hjTextures.js'

// [3. 개발 > 프론트엔드] 영화·드라마 구역의 레트로/미래 촬영 세트.
const NIGHT = '#202637'
const CYAN = mat('#7ff5ff', { emissive: '#39ddea', emissiveIntensity: 1.3 })
const PINK = mat('#ffa4eb', { emissive: '#eb53bd', emissiveIntensity: 1.3 })
const WINDOWS = mat('#ffffff', { emissive: '#9adcec', emissiveIntensity: 0.28 })
const GLASS = mat('#7ac6da', { transparent: true, opacity: 0.28, roughness: 0.25 })
const red = '#a5292e'
let gridTexture

function getGrid() {
  if (gridTexture) return gridTexture
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1e2530'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = '#35505c'
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, 64, 64)
  ctx.strokeStyle = '#293a46'
  ctx.strokeRect(18, 18, 28, 28)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(12, 14)
  texture.colorSpace = SRGBColorSpace
  gridTexture = texture
  return texture
}

function Sign({ text, p, size = [2.4, 0.56], bg = '#18232d', fg = '#c6ffff', glow = false }) {
  const texture = getSignTexture(text, bg, fg)
  return (
    <mesh position={p} material={texMat(texture, { emissive: glow ? '#b3c9d9' : undefined, emissiveIntensity: 0.5 })}>
      <planeGeometry args={size} />
    </mesh>
  )
}

function HoloBillboard({ text, p, size, pink }) {
  const texture = getSignTexture(text, '#163052', pink ? '#ffc0f6' : '#8af4ff')
  return (
    <mesh position={p} userData={{ noShadow: true }}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent opacity={0.82} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function WarpBooth({ radius, analog = false }) {
  const vortex = useRef(null)
  useFrame((_, delta) => {
    if (vortex.current) {
      vortex.current.rotation.y += delta * 0.74
      vortex.current.rotation.z += delta * 0.15
    }
  })
  const swirl = getSwirlTexture()
  const posts = [-0.64, 0.64].flatMap((x) => [-0.62, 0.62].map((z) => ({ p: [x, 1.5, z], s: [0.13, 2.9, 0.13] })))
  const frames = [0.48, 1.26, 2.02].flatMap((y) => [
    { p: [0, y, -0.64], s: [1.3, 0.065, 0.11] },
    { p: [0.64, y, 0], s: [0.11, 0.065, 1.3] },
    { p: [-0.64, y, 0], s: [0.11, 0.065, 1.3] },
  ])
  return (
    <group>
      <Box p={[0, 0.14, 0]} s={[1.63, 0.24, 1.57]} c="#38343a" />
      <Instances geometry={GEO.box} material={mat(red)} items={[...posts, ...frames]} />
      <Box p={[0, 2.88, 0]} s={[1.58, 0.31, 1.53]} c="#be3237" />
      <Box p={[0, 3.09, 0]} s={[1.26, 0.16, 1.19]} c="#992127" />
      <Box p={[0, 1.58, -0.62]} s={[1.18, 2.30, 0.04]} m={GLASS} />
      <Box p={[0.62, 1.58, 0]} s={[0.04, 2.30, 1.18]} m={GLASS} />
      <Box p={[-0.62, 1.58, 0]} s={[0.04, 2.30, 1.18]} m={GLASS} />
      <Box p={[0, 1.44, -0.36]} s={[0.22, 0.43, 0.15]} c="#29272a" />
      {!analog && <Sign text="시공간 워프 허브" p={[0, 3.49, 0.04]} size={[2.65, 0.53]} glow />}
      <Sign text={analog ? '공중전화' : '부스 안으로 입장'} p={[0, 2.65, 0.79]} size={[1.42, 0.24]} bg="#5c2227" fg="#fff1d7" />
      {!analog && <group ref={vortex} position={[0, 1.55, 0]}>
        {[0, Math.PI / 2].map((angle, index) => (
          <mesh key={angle} rotation={[0.44, angle, -0.48]}>
            <ringGeometry args={[radius * 0.59, radius * 1.03, 48]} />
            <meshBasicMaterial map={swirl} color={index ? '#b487ff' : '#76dcff'} side={DoubleSide}
              transparent opacity={0.52} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>}
    </group>
  )
}

export function HjCyberGrid({ item }) {
  const [w, , d] = item.size
  return (
    <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={getGrid()} roughness={0.95} />
    </mesh>
  )
}

export function HjRift({ item }) {
  const strips = item.points.slice(1).map(([x, z], index) => {
    const [px, pz] = item.points[index]
    return {
      p: [(px + x) / 2, 0.153, (pz + z) / 2],
      s: [Math.hypot(x - px, z - pz) + 0.07, 0.018, index % 2 ? 0.32 : 0.22],
      r: [0, -Math.atan2(z - pz, x - px), 0],
      c: index % 2 ? '#a1e9ff' : '#bf99f8',
    }
  })
  return <Instances geometry={GEO.box} material={WINDOWS} items={strips} />
}

export function HjCyberTower({ item }) {
  const [w, h, d] = item.size
  const rows = Math.floor((h - 3) / 1.55)
  const windows = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const offset = (column - 3) * 0.124
      const y = 2.9 + row * 1.55
      const color = (column + row) % 5 === 0 ? '#ff83d9' : row % 3 ? '#70b6ce' : '#b0f4ff'
      for (const side of [-1, 1]) {
        windows.push({ p: [w * offset, y, side * (d / 2 + 0.035)], s: [w * 0.087, 0.92, 0.06], c: color })
        windows.push({ p: [side * (w / 2 + 0.035), y, d * offset], s: [0.06, 0.92, d * 0.087], c: color })
      }
    }
  }
  const neon = item.accent === 'pink' ? PINK : CYAN
  return (
    <group>
      <Box p={[0, h * 0.5, 0]} s={[w, h, d]} c={item.color ?? NIGHT} />
      <Box p={[0, 1.12, 0]} s={[w + 0.18, 2.2, d + 0.18]} m={GLASS} />
      <Box p={[0, h + 0.32, 0]} s={[w * 0.73, 0.64, d * 0.74]} c="#39445c" />
      <Box p={[0, h + 0.67, 0]} s={[w * 0.72, 0.07, d * 0.73]} m={neon} />
      <Box p={[0, 0.32, 0]} s={[w + 0.37, 0.64, d + 0.36]} c="#3c4858" />
      <Instances geometry={GEO.box} material={WINDOWS} items={windows} />
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <Box key={`${x}/${z}`} p={[w * 0.49 * x, h * 0.51, (d / 2 + 0.064) * z]}
          s={[0.11, h * 0.89, 0.085]} m={x === z ? neon : item.accent === 'pink' ? CYAN : PINK} />
      )))}
      <HoloBillboard text={item.text} p={[0, h * 0.68, d / 2 + 0.44]} size={[w * 0.83, 1.08]} pink={item.accent === 'pink'} />
      {item.beacon && <pointLight position={[0, 3.2, d / 2 + 1.25]} color={item.accent === 'pink' ? '#ff51cd' : '#43c8ff'} intensity={21} distance={9} />}
      <Sign text={item.secondary} p={[0, 1.44, d / 2 + 0.12]} size={[w * 0.74, 0.62]} glow />
    </group>
  )
}

export function HjSkywalk({ item }) {
  const [w, y, d] = item.size
  return (
    <group>
      <Box p={[0, y, 0]} s={[w, 0.27, d]} c="#39435c" />
      <Box p={[0, y + 1.03, 0]} s={[w, 0.14, d]} m={GLASS} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[0, y + 0.58, side * d / 2]} s={[w, 0.9, 0.06]} m={GLASS} />
          <Box p={[0, y + 1.03, side * d / 2]} s={[w, 0.064, 0.08]} m={side === 1 ? CYAN : PINK} />
          {[-0.42, -0.21, 0, 0.21, 0.42].map((x) => (
            <Box key={x} p={[w * x, y + 0.54, side * d / 2]} s={[0.055, 0.98, 0.09]} c="#52637e" />
          ))}
        </group>
      ))}
      <Crew x={-w * 0.28} y={y + 0.14} z={0} color="#c07593" />
      <Crew x={w * 0.24} y={y + 0.14} z={0.15} color="#70a6b0" />
    </group>
  )
}

function Crew({ x, y = 0, z, color = '#e6e2d6', helmet = false }) {
  return (
    <group position={[x, y, z]}>
      <Cyl p={[0, 0.55, 0]} rad={0.16} h={0.64} c={color} />
      <Ball p={[0, 0.97, 0]} rad={0.19} c={helmet ? '#e5edef' : '#a87456'} />
      {helmet && <Box p={[0, 0.96, 0.16]} s={[0.23, 0.10, 0.065]} c="#54788b" />}
      {[-0.065, 0.065].map((dx) => <Box key={dx} p={[dx, 0.19, 0]} s={[0.085, 0.36, 0.12]} c="#434655" />)}
    </group>
  )
}

export function HjFloatingCar({ item }) {
  const [w, y, d] = item.size
  const police = item.police
  const car = useRef(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.27 + (item.phase ?? 0)
    car.current.position.set(6.4 * Math.cos(t), y + Math.sin(t * 2) * 0.48, 8 * Math.sin(t))
    car.current.rotation.y = Math.atan2(-8 * Math.cos(t), -6.4 * Math.sin(t))
  })
  return (
    <group ref={car}>
      <Box p={[0, 0.08, 0]} s={[w, 0.33, d]} c={police ? '#dfe7ef' : '#354b68'} />
      <Box p={[w * 0.09, 0.37, 0]} s={[w * 0.49, 0.28, d * 0.69]} c="#233342" />
      {[-1, 1].map((side) => <Box key={side} p={[0, -0.08, side * d * 0.46]} s={[w * 0.72, 0.065, 0.13]} m={side === 1 ? CYAN : PINK} />)}
      {[-1, 1].flatMap((side) => [0, 1, 2, 3].map((index) => (
        <mesh key={`${side}/${index}`} position={[-w / 2 - 0.18 - index * 0.34, 0, side * d * 0.31]} userData={{ noShadow: true }}>
          <boxGeometry args={[0.32, 0.05, 0.07]} />
          <meshBasicMaterial color={side > 0 ? '#58ddff' : '#ff75d8'} transparent opacity={0.78 - index * 0.17} depthWrite={false} />
        </mesh>
      )))}
      {police && <Sign text="경찰 · 플라잉카" p={[0, 0.11, d / 2 + 0.017]} size={[w * 0.67, 0.23]} bg="#233653" glow />}
    </group>
  )
}

export function HjLunarBase({ item }) {
  const [w, , d] = item.size
  return (
    <group>
      <Box p={[0, 0.12, 0]} s={[w, 0.24, d]} c="#575c67" />
      <Box p={[-0.55, 1.53, -0.58]} s={[w * 0.66, 2.58, d * 0.56]} c="#b6bbc7" />
      <Box p={[-0.55, 2.77, -0.58]} s={[w * 0.75, 0.18, d * 0.62]} c="#43536b" />
      <Sign text="침묵의 바다 달 기지" p={[-0.55, 2.14, d * 0.28 - 0.54]} size={[w * 0.59, 0.54]} bg="#354360" glow />
      <Box p={[-0.43, 1.14, d * 0.28 - 0.53]} s={[0.83, 1.44, 0.06]} c="#445966" />
      <Crew x={-w * 0.37} y={0.24} z={d * 0.32} helmet />
      <Crew x={w * 0.09} y={0.24} z={d * 0.38} helmet />
      <group position={[w * 0.31, 0.24, d * 0.24]}>
        <Box p={[0, 0.33, 0]} s={[1.36, 0.40, 0.72]} c="#b2a591" />
        <Box p={[0.1, 0.60, 0]} s={[0.68, 0.24, 0.64]} c="#c8c2ad" />
        {[-0.47, 0.47].flatMap((x) => [-0.39, 0.39].map((z) => <Cyl key={`${x}/${z}`} p={[x, 0.18, z]} rad={0.18} h={0.12} r={[Math.PI / 2, 0, 0]} c="#313442" />))}
      </group>
    </group>
  )
}

export function HjRetroStairs({ item }) {
  const [w, , d] = item.size
  return (
    <group>
      <Box p={[0, 1.04, -d * 0.47]} s={[w, 2.08, 0.22]} c="#958b80" />
      <Box p={[0, 0.81, -d * 0.40]} s={[0.93, 1.60, 0.06]} c="#292820" />
      <Box p={[0, 1.79, -d * 0.4]} s={[1.02, 0.23, 0.07]} m={mat('#d19c61', { emissive: '#ffaf64', emissiveIntensity: 0.64 })} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[side * w / 2, 0.46, 0]} s={[0.18, 0.92, d]} c="#ad9f8d" />
          <Box p={[side * w / 2, 1.1, 0.06]} s={[0.04, 0.04, d * 0.86]} r={[-0.36, 0, 0]} c="#5c4d3b" />
        </group>
      ))}
      <Instances geometry={GEO.box} material={mat('#b9a693')} items={Array.from({ length: 8 }, (_, index) => {
        const h = 0.10 + index * 0.135
        return { p: [0, h / 2, d * (-0.29 + index * 0.10)], s: [w - 0.2, h, d * 0.101] }
      })} />
    </group>
  )
}

export function HjRetroCrew({ item }) {
  const color = item.color ?? '#b87d50'
  return <Crew x={0} z={0} color={color} />
}
