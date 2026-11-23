import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { usePalaceTour } from '../../../../components/movieZone/palaceTourStore.js'
import { Box, Cone, Cyl, GEO, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { FILM_ENTRANCE, FLOOR, HALLS, PALACE_ACTIVITIES, PALACE_DRAMA_SETS, PONDS, TOUR_ROUTES } from './gyeongbokgungLayout.js'
import { STREET, STREET_BUILDINGS, streetFootprint } from './gyeongseongLayout.js'
import { tiledRoof } from './gyeongbokgungMaterials.js'

const WOOD = '#673423'
const BORDER = '#976c44'
const AMBER = mat('#ffcf81', { emissive: '#ffad5d', emissiveIntensity: .8 })

function guideTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 832
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f4e7c8'
  ctx.fillRect(0, 0, 768, 832)
  ctx.strokeStyle = '#98714b'
  ctx.lineWidth = 4
  ctx.strokeRect(18, 18, 732, 796)
  ctx.fillStyle = '#392e24'
  ctx.font = 'bold 56px "Malgun Gothic", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('경복궁 관람길', 384, 105)

  const scale = 4.45
  const point = (x, z) => [384 + x * scale, 416 - z * scale]
  ctx.fillStyle = '#c2c69d'
  ctx.fillRect(201, 184, 366, 464)
  const rect = ({ x, z, w, d }, color) => {
    const [px, py] = point(x, z)
    ctx.fillStyle = color
    ctx.fillRect(px - w * scale / 2, py - d * scale / 2, w * scale, d * scale)
  }
  rect({ ...STREET, x: 0 }, '#b59e83')
  rect({ ...STREET, w: STREET.roadWidth }, '#d8bc99')
  for (const building of STREET_BUILDINGS) {
    const [x, z, w, d] = streetFootprint(building)
    rect({ x, z, w, d }, '#714f3c')
  }
  for (const pond of PONDS) rect(pond, '#7fa6a5')
  for (const hall of HALLS) rect(hall, '#4f584b')
  for (const { points, color } of TOUR_ROUTES) {
    ctx.beginPath()
    points.map(([x, z]) => point(x, z)).forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.stroke()
  }
  for (const set of [...PALACE_DRAMA_SETS, ...PALACE_ACTIVITIES]) {
    const [x, y] = point(set.x, set.z)
    ctx.fillStyle = set.color
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.font = 'bold 33px "Malgun Gothic", sans-serif'
  ctx.fillStyle = '#683d32'
  ctx.fillText('안내판을 눌러 지도 열기', 384, 760)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function Plaque({ text, position, width, height, surface = '#322a22', yaw = Math.PI }) {
  return (
    <mesh position={position} rotation-y={yaw} userData={{ noShadow: true }}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={getSignTexture(text, surface, '#f6e8c1')} />
    </mesh>
  )
}

// [3. 개발 > 프론트엔드] 광화문 바깥에서도 촬영 구역과 관람 동선을 찾을 수 있습니다.
export default function PalaceFilmEntrance({ materials }) {
  const { x, z, post, boardX, boardZ } = FILM_ENTRANCE
  const assets = useMemo(() => ({
    gateRoof: tiledRoof(7.85, 1.6, .57),
    boardRoof: tiledRoof(2.55, 1.11, .32),
    guide: guideTexture(),
  }), [])
  useEffect(() => () => Object.values(assets).forEach(asset => asset.dispose()), [assets])

  return (
    <>
      <group name="영화·드라마 구역 입구" position={[x, 0, z]}>
        {[-1, 1].map((side) => (
          <group key={side} position-x={post * side}>
            <Box p={[0, .16, 0]} s={[.8, .32, .78]} c="#b7a690" />
            <Cyl p={[0, 1.95, 0]} rad={.29} h={3.45} c={WOOD} />
            <Box p={[0, 3.35, 0]} s={[.74, .34, .74]} c="#4f745c" />
            <Box p={[0, 2.63, -.38]} s={[.31, .40, .23]} m={AMBER} />
            <Box p={[0, 2.88, -.38]} s={[.39, .12, .31]} c="#343c34" />
          </group>
        ))}
        <Box p={[0, 3.6, 0]} s={[7.05, .28, .67]} c="#43382b" />
        <Box p={[0, 3.12, -.13]} s={[4.45, .83, .38]} c={BORDER} />
        <mesh geometry={assets.gateRoof} material={materials.roof} position-y={3.78} />
        <Plaque text="영화·드라마 촬영지" position={[0, 3.12, -.325]} width={4.25} height={.67} />
        <Plaque text="경복궁 촬영 세트" position={[0, 3.12, .066]} width={4.25} height={.67} yaw={0} />
      </group>
      <group name="광화문 앞 관람 안내판" position={[boardX, 0, boardZ]}>
        {[-1, 1].map((side) => <Box key={side} p={[.96 * side, 1.3, 0]} s={[.16, 2.6, .25]} c={WOOD} />)}
        <Box p={[0, 1.41, 0]} s={[2.19, 2.06, .28]} c={BORDER} />
        <mesh geometry={assets.boardRoof} material={materials.roof} position-y={2.57} />
        <mesh position={[0, 1.41, -.151]} rotation-y={Math.PI} userData={{ noShadow: true }}
          onClick={(event) => {
            event.stopPropagation()
            usePalaceTour.getState().setOpen(true)
          }}>
          <planeGeometry args={[1.91, 1.89]} />
          <meshBasicMaterial map={assets.guide} />
        </mesh>
        <pointLight position={[0, 2.3, -1.3]} color="#ffd089" intensity={4.4} distance={5.25} />
      </group>
    </>
  )
}

export function PalaceDramaMarkers() {
  return PALACE_DRAMA_SETS.map(({ title, theme, signX, signZ, color }) => (
    <group key={title} name={`${title} 테마 촬영지`} position={[signX, FLOOR, signZ]}>
      <Box p={[0, .59, 0]} s={[.14, 1.15, .15]} c={WOOD} />
      <Box p={[0, 1.27, 0]} s={[2.64, .80, .14]} c={BORDER} />
      <Plaque text={`드라마 · ${title}`} position={[0, 1.42, -.078]} width={2.53} height={.39} surface={color} />
      <Plaque text={theme} position={[0, 1.075, -.078]} width={2.51} height={.26} surface="#45352b" />
      <Box p={[0, 1.7, 0]} s={[2.74, .072, .32]} m={AMBER} />
      {title === '홍천기' && (
        <group position={[1.69, 0, .31]}>
          <Box p={[0, .66, 0]} s={[.72, 1.09, .08]} c="#ba9a71" />
          <Box p={[0, .75, -.048]} s={[.56, .72, .026]} c="#e6d9bc" />
          <Box p={[.01, .63, -.074]} s={[.45, .08, .02]} c="#85978e" r={[0, 0, .26]} />
          <Box p={[-.12, .86, -.075]} s={[.075, .075, .019]} c="#b9604a" />
        </group>
      )}
      {title === '동궁' && (
        <Cyl p={[1.58, .61, .2]} rad={.23} h={.71} geo={GEO.cyl8}
          m={mat('#c9afe6', { emissive: '#8858bc', emissiveIntensity: .50 })} />
      )}
      {title === '슈룹' && (
        <group position={[1.64, 0, .2]}>
          <Cyl p={[0, .72, 0]} rad={.032} h={1.46} c={BORDER} />
          <Cone p={[0, 1.43, 0]} rad={.55} h={.22} c="#af513d" />
        </group>
      )}
    </group>
  ))
}

function ArcheryTargets() {
  return [-2.5, 0, 2.5].map((x) => (
    <group key={x} position={[x, 0, 2.72]}>
      <Box p={[-.27, .63, .04]} s={[.12, 1.22, .17]} c={WOOD} />
      <Box p={[.27, .63, .04]} s={[.12, 1.22, .17]} c={WOOD} />
      {[[.65, '#876341'], [.56, '#dfc5a3'], [.42, '#52675c'], [.28, '#914b3d'], [.15, '#dcb273']].map(([rad, c], index) => (
        <Cyl key={rad} p={[0, 1.24, -.1 - index * .028]} rad={rad} h={.09} c={c}
          r={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  ))
}

function TuhoJars() {
  return [-1.75, 0, 1.75].map((x) => (
    <group key={x} position={[x, 0, 1.98]}>
      <mesh position-y={.47} scale={[.46, .52, .46]} geometry={GEO.sphere} material={mat('#487668')} />
      <Cyl p={[0, .91, 0]} rad={.26} h={.27} c="#487668" />
      <Cyl p={[0, 1.063, 0]} rad={.30} h={.076} c="#83a08c" />
      <Cyl p={[0, 1.104, 0]} rad={.232} h={.009} c="#223b34" />
    </group>
  ))
}

export function PalaceActivityYards() {
  return PALACE_ACTIVITIES.map(({ id, name, title, x, z, w, d, color }) => (
    <group key={id} name={name} position={[x, FLOOR, z]}>
      <Box p={[0, .025, 0]} s={[w, .035, d]} c="#bca78a" userData={{ noShadow: true }} />
      <Box p={[0, .50, d / 2 - .55]} s={[w * .81, .94, .27]} c="#82604b" />
      <Box p={[0, .985, d / 2 - .55]} s={[w * .82, .14, .38]} c="#513d32" />
      <Box p={[0, .047, -1.3]} s={[w * .63, .023, .14]} c="#eddbb0" />
      {id === 'archery' ? <ArcheryTargets /> : <TuhoJars />}
      <group position={[w / 2 - .9, 0, -d / 2 + .37]}
        onClick={(event) => {
          event.stopPropagation()
          const tour = usePalaceTour.getState()
          if (tour.nearbyActivity === id) tour.openActivity()
        }}>
        <Box p={[0, .6, 0]} s={[.14, 1.10, .15]} c={WOOD} />
        <Box p={[0, 1.19, 0]} s={[1.56, .45, .12]} c={BORDER} />
        <Plaque text={title} position={[0, 1.19, -.068]} width={1.44} height={.36} surface={color} />
      </group>
    </group>
  ))
}
