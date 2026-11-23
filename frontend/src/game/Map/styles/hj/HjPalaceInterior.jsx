import { useEffect, useMemo } from 'react'
import { THRONE_DOOR_WIDTH } from './gyeongbokgungLayout.js'
import { CanvasTexture, DoubleSide, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three'
import { PALACE_SEATS, ROOM_FLOOR } from '../../../../components/movieZone/palaceInteriorLayout.js'
import { Box, Cyl, GEO, Instances, mat } from '../kit.jsx'

const WOOD = '#713326'
const GREEN = '#31594f'
const GOLD = '#bd9557'
const STONE = '#aba99a'
const PARTS = mat('#ffffff', { roughness: 0.81 })
const PAPER_LIGHT = mat('#ffebc8', { emissive: '#e6b771', emissiveIntensity: 0.65 })

function paintedTexture(width, height, paint) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  paint(canvas.getContext('2d'), width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function lotus(ctx, x, y, radius, petals, palette) {
  ctx.save()
  ctx.translate(x, y)
  for (let i = 0; i < petals; i += 1) {
    ctx.rotate(Math.PI * 2 / petals)
    ctx.beginPath()
    ctx.ellipse(0, -radius * 0.55, radius * 0.23, radius * 0.37, 0, 0, Math.PI * 2)
    ctx.fillStyle = palette[i % palette.length]
    ctx.fill()
    ctx.strokeStyle = '#e3c093'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.20, 0, Math.PI * 2)
  ctx.fillStyle = '#f1c777'
  ctx.fill()
  ctx.restore()
}

function paintDancheong(ctx, w, h) {
  ctx.fillStyle = '#225145'
  ctx.fillRect(0, 0, w, h)
  for (const [y, c, height] of [[0, '#b5714c', 9], [11, '#d4a65e', 3], [17, '#527c77', 6], [h - 24, '#365c77', 7], [h - 14, '#d3a562', 3], [h - 8, '#8b4337', 8]]) {
    ctx.fillStyle = c
    ctx.fillRect(0, y, w, height)
  }
  for (let x = 32; x < w; x += 64) {
    ctx.fillStyle = '#32656b'
    ctx.beginPath()
    ctx.arc(x, 49, 22, 0, Math.PI * 2)
    ctx.fill()
    lotus(ctx, x, 49, 21, 8, ['#c98168', '#88a68b', '#bf7762', '#d4a767'])
    ctx.strokeStyle = '#b6a063'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(x + 18, 57)
    ctx.bezierCurveTo(x + 34, 67, x + 47, 31, x + 59, 42)
    ctx.stroke()
  }
}

function paintScreen(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#182847')
  sky.addColorStop(1, '#456b65')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  for (const [x, c] of [[w * 0.24, '#e77b56'], [w * 0.77, '#e8e4ca']]) {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(x, h * 0.20, h * 0.073, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 5; i += 1) {
    const x = (i + 1) * w / 6
    const y = [0.50, 0.40, 0.34, 0.41, 0.49][i] * h
    ctx.beginPath()
    ctx.moveTo(x - 94, h * 0.79)
    ctx.lineTo(x - 38, y + 55)
    ctx.lineTo(x - 13, y + 24)
    ctx.lineTo(x, y)
    ctx.lineTo(x + 25, y + 38)
    ctx.lineTo(x + 59, y + 74)
    ctx.lineTo(x + 95, h * 0.79)
    ctx.closePath()
    ctx.fillStyle = i % 2 ? '#386a5a' : '#51856b'
    ctx.fill()
    ctx.strokeStyle = '#bcaa78'
    ctx.lineWidth = 2.2
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y + 6)
    ctx.lineTo(x - 4, y + 66)
    ctx.lineTo(x + 32, h * 0.76)
    ctx.stroke()
  }
  for (let y = Math.round(h * 0.78); y < h; y += 10) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, y + Math.sin(x / 22 + y / 13) * 3.5)
    ctx.strokeStyle = y % 3 ? '#9bb49c' : '#d2bd86'
    ctx.lineWidth = 1.8
    ctx.stroke()
  }
  for (const x of [w * 0.1, w * 0.90]) {
    ctx.fillStyle = '#533b32'
    ctx.fillRect(x - 3, h * 0.43, 6, h * 0.36)
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = i % 2 ? '#2c5950' : '#367561'
      ctx.beginPath()
      ctx.ellipse(x + (i % 2 ? 10 : -9), h * (0.49 + i * 0.053), 41 - i * 3, 10, -0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function paintBrocade(ctx, w, h) {
  ctx.fillStyle = '#8a392f'
  ctx.fillRect(0, 0, w, h)
  for (const inset of [6, 11, 16]) {
    ctx.strokeStyle = inset === 11 ? '#49796c' : '#e1ae65'
    ctx.lineWidth = inset === 11 ? 4 : 2
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
  }
  for (const x of [30, w - 30]) for (const y of [30, h - 30]) {
    lotus(ctx, x, y, 11, 6, ['#bd805c', '#6e9380'])
  }
  lotus(ctx, w / 2, h / 2, 28, 8, ['#c7896d', '#7d9b81'])
}

function paintFloor(ctx, w, h) {
  ctx.fillStyle = '#6b6c66'
  ctx.fillRect(0, 0, w, h)
  for (let y = 0; y < 12; y += 1) for (let x = 0; x < 22; x += 1) {
    ctx.fillStyle = ['#343d3e', '#3a4241', '#424846', '#394041'][(x * 5 + y * 7) % 4]
    ctx.fillRect(x * w / 22 + 1, y * h / 12 + 1, w / 22 - 2, h / 12 - 2)
  }
}

function FoldingScreen({ map }) {
  return (
    <group position={[0, 1.54, 2.96]}>
      <Box p={[0, 0, 0]} s={[5.59, 2.22, 0.12]} c="#42362b" />
      <mesh position={[0, 0.015, -0.069]} rotation-y={Math.PI}>
        <planeGeometry args={[5.35, 2.0]} />
        <meshBasicMaterial map={map} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={i} p={[(i - 3) * 0.91, 0.008, -0.087]} s={[0.045, 2.1, 0.035]} c={GOLD} />
      ))}
      {[-1, 1].map(side => <Box key={side} p={[0, side * 1.05, -0.082]} s={[5.52, 0.063, 0.045]} c={GOLD} />)}
    </group>
  )
}

function Throne({ seat, rug }) {
  const [x, floor, z] = seat.position
  return (
    <group position={[x, floor, z]}>
      <Box p={[0, 0.1, 0]} s={[1.23, 0.2, 0.93]} c="#632c24" />
      <Box p={[0, 0.29, 0]} s={[1.18, 0.17, 0.83]} c="#9e4839" />
      <Box p={[0, 0.76, 0.44]} s={[1.29, 1.01, 0.12]} c="#8d3f31" />
      <Box p={[0, 1.24, 0.44]} s={[1.35, 0.12, 0.19]} c={GOLD} />
      <mesh position={[0, 0.78, 0.369]} rotation-y={Math.PI}>
        <planeGeometry args={[0.96, 0.66]} />
        <meshStandardMaterial map={rug} roughness={0.87} />
      </mesh>
      {[-1, 1].map(side => (
        <group key={side}>
          <Box p={[side * 0.64, 0.45, 0.04]} s={[0.105, 0.54, 0.61]} c="#743c2b" />
          <Box p={[side * 0.64, 0.72, 0]} s={[0.18, 0.095, 0.82]} c={GOLD} />
        </group>
      ))}
    </group>
  )
}

function StandingLantern({ position }) {
  return (
    <group position={position}>
      <Box p={[0, 0.075, 0]} s={[0.46, 0.15, 0.46]} c="#6e382e" />
      <Box p={[0, 0.57, 0]} s={[0.28, 0.62, 0.28]} m={PAPER_LIGHT} />
      <Box p={[0, 0.91, 0]} s={[0.40, 0.09, 0.40]} c="#40372b" />
      {[-1, 1].flatMap(x => [-1, 1].map(z => (
        <Box key={`${x}/${z}`} p={[x * 0.153, 0.55, z * 0.153]} s={[0.045, 0.72, 0.045]} c="#402f2b" />
      )))}
    </group>
  )
}

function PaintedBeam({ position, rotation = 0, length, map }) {
  const panel = useMemo(() => {
    const geometry = new PlaneGeometry(length, 0.27)
    const uv = geometry.getAttribute('uv')
    const repeat = Math.max(1, Math.round(length / 1.7))
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, uv.getX(i) * repeat)
    return geometry
  }, [length])
  useEffect(() => () => panel.dispose(), [panel])
  return (
    <group position={position} rotation-y={rotation}>
      <Box p={[0, 0, 0]} s={[length, 0.31, 0.32]} c={GREEN} />
      {[-1, 1].map(side => (
        <mesh key={side} geometry={panel} position={[0, 0, side * 0.163]} rotation-y={side > 0 ? 0 : Math.PI}>
          <meshStandardMaterial map={map} emissive="#343525" emissiveIntensity={0.29} />
        </mesh>
      ))}
      <Box p={[0, -0.176, 0]} s={[length, 0.04, 0.37]} c={GOLD} />
    </group>
  )
}

// [3. 개발 > 프론트엔드] 열린 정전 내부와 어좌 세트. 충돌 벽은 HJ 구역 데이터의 대응 조각을 사용합니다.
export default function HjPalaceInterior({ timber }) {
  const { band, screen, rug, tiles, lattice } = useMemo(() => {
    const band = paintedTexture(512, 96, paintDancheong)
    band.wrapS = RepeatWrapping
    const screen = paintedTexture(768, 320, paintScreen)
    const rug = paintedTexture(160, 128, paintBrocade)
    const tiles = paintedTexture(512, 256, paintFloor)
    const lattice = []
    const add = (p,s,c) => lattice.push({p,s,c})
    for (const side of [-1, 1]) {
      for (const z of [-2.3, -0.78, 0.75, 2.24]) {
        const x = side * 6.328
        for (let i = -4; i <= 4; i += 1) add([x, 1.53, z + i * 0.113], [0.055, 1.48, 0.027], '#32473b')
        for (let i = -3; i <= 3; i += 1) add([x, 1.50 + i * 0.186, z], [0.061, 0.033, 1.14], '#32473b')
      }
    }
    return { band, screen, rug, tiles, lattice }
  }, [])
  useEffect(() => () => [band, screen, rug, tiles].forEach(t => t.dispose()), [band, screen, rug, tiles])
  return (
    <group>
      <mesh position={[0, ROOM_FLOOR, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[13.2, 6.56]} />
        <meshStandardMaterial map={tiles} roughness={0.93} />
      </mesh>
      <mesh position={[0, 3.47, 0]} rotation-x={Math.PI / 2} name="camera-blocker">
        <planeGeometry args={[13.2, 6.56]} />
        <meshStandardMaterial color="#39352b" side={DoubleSide} />
      </mesh>
      <Box name="camera-blocker" p={[0, 1.72, 3.18]} s={[13.2, 3.44, 0.20]} c={WOOD} />
      <Box name="camera-blocker" p={[0, 3.03, -3.18]} s={[THRONE_DOOR_WIDTH, 0.83, 0.20]} c={GREEN} />
      {[-1, 1].map(side => (
        <group key={side}>
          <Box name="camera-blocker" p={[side * 6.50, 1.72, 0]} s={[0.20, 3.44, 6.56]} c={WOOD} />
          <Box name="camera-blocker" p={[side * (13.2+THRONE_DOOR_WIDTH)/4, 1.72, -3.18]} s={[(13.2-THRONE_DOOR_WIDTH)/2, 3.44, 0.20]} c={WOOD} />
          <Box p={[side * (THRONE_DOOR_WIDTH/2+.075), 1.29, -3.30]} s={[0.15, 2.58, 0.16]} c={GREEN} />
          <Box p={[side * 4.10, 1.45, -3.30]} s={[3.7, 1.50, 0.08]} m={PAPER_LIGHT} />
          {[-2.3, -0.78, 0.75, 2.24].map(z => (
            <group key={z}>
              <Box p={[side * 6.42, 1.51, z]} s={[0.07, 1.60, 1.23]} c={GREEN} />
              <Box p={[side * 6.372, 1.51, z]} s={[0.025, 1.43, 1.10]} m={PAPER_LIGHT} />
            </group>
          ))}
          {[-1.83, 1.43].map(z => (
            <group key={z}>
              <Cyl p={[side * 3.15, 0.125, z]} rad={0.43} h={0.12} c={STONE} geo={GEO.cyl8} />
              <Cyl p={[side * 3.15, 1.55, z]} rad={0.27} h={2.78} m={timber} />
              <Box p={[side * 3.15, 2.9, z]} s={[0.78, 0.16, 0.58]} c="#91533d" />
            </group>
          ))}
          <PaintedBeam position={[side * 3.15, 3.05, 0]} rotation={Math.PI / 2} length={6.2} map={band} />
          <StandingLantern position={[side * 2.60, ROOM_FLOOR, -1.86]} />
          <StandingLantern position={[side * 2.75, ROOM_FLOOR, 1.61]} />
        </group>
      ))}
      <Instances geometry={GEO.box} material={PARTS} items={lattice} />
      {[-2.77, -0.83, 1.08, 2.68].map(z => (
        <PaintedBeam key={z} position={[0, 3.13, z]} length={12.8} map={band} />
      ))}
      <Box p={[0, 0.242, 2.02]} s={[5.8, 0.355, 2.15]} c="#773b30" />
      <Box p={[0, 0.17, 0.82]} s={[2.0, 0.21, 0.37]} c="#a1654a" />
      <FoldingScreen map={screen} />
      {PALACE_SEATS.map(seat => seat.id === 'throne'
        ? <Throne key={seat.id} seat={seat} rug={rug} />
        : <Box key={seat.id} p={[seat.position[0], ROOM_FLOOR + 0.058, seat.position[2]]}
          s={[0.91, 0.10, 0.73]} c="#843c35" />)}
      {PALACE_SEATS.map(seat => (
        <mesh key={seat.id} position={[seat.position[0], seat.position[1] + seat.surfaceOffset, seat.position[2]]}
          rotation-x={-Math.PI / 2}>
          <planeGeometry args={seat.id === 'throne' ? [1.15, 0.82] : [0.90, 0.71]} />
          <meshStandardMaterial map={rug} roughness={0.86} />
        </mesh>
      ))}
    </group>
  )
}
