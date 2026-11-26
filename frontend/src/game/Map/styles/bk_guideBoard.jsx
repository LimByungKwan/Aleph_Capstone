import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { layout } from '../../data/mapData.js'
import { GEO, mat } from './kit.jsx'
import { DATE_MISSIONS, mapPoint, useDateMission } from './bk_dateMission.js'
import { dateMapBounds, drawDateMapBase } from './bk_dateMapPlan.js'

// 데이트 코스 안내판 (담당: 병관) — 영화·드라마 구역 "경복궁 관람길" 안내판과 같은 역할
// 데이트 코스 입구 안쪽에 서 있는 나무 안내판. 누르거나 앞에서 E → 데이트 코스 지도(DateMission.jsx의 DateMap)
// 구역 파일 style: "bkGuideBoard"

const W = 2.2
const H = 1.6
const NEAR = 3
const WOOD = mat('#8b5e3c')
const ROOF = mat('#be185d')
const PAPER = '#fffaf0'
const INK = '#5c2340'
const PIN = '#9d174d'
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
const BOARD_WIDTH = 704
const BOARD_HEIGHT = 512
const MAP_WIDTH = 660
const MAP_SCALE = MAP_WIDTH / dateMapBounds.height
const MAP = { x: 22, y: 76, w: MAP_WIDTH, h: dateMapBounds.width * MAP_SCALE }
const guideBoardPosition = layout.props.find(({ id }) => id === 'BK/date_guide_board')?.position

// 세로로 긴 구역 지도를 시계 방향으로 돌려 가로 안내판에 맞춥니다.
function toBoard([x, z]) {
  return [MAP.x + MAP.w - (z - dateMapBounds.top) * MAP_SCALE, MAP.y + (x - dateMapBounds.left) * MAP_SCALE]
}

function missionPin(g, x, y, number, radius) {
  g.beginPath()
  g.arc(x, y, radius, 0, Math.PI * 2)
  g.fillStyle = PIN
  g.fill()
  g.strokeStyle = PAPER
  g.lineWidth = 2.5
  g.stroke()
  g.fillStyle = '#fff'
  g.font = `bold ${radius + 3}px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(number, x, y + 0.5)
}

function createGuideBoardCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = BOARD_WIDTH * 2
  canvas.height = BOARD_HEIGHT * 2
  const g = canvas.getContext('2d')
  g.scale(2, 2)
  g.fillStyle = PAPER
  g.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
  g.strokeStyle = '#c77d99'
  g.lineWidth = 6
  g.strokeRect(3, 3, BOARD_WIDTH - 6, BOARD_HEIGHT - 6)
  g.fillStyle = INK
  g.font = `bold 38px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('데이트 코스 안내', BOARD_WIDTH / 2, 41)

  g.beginPath()
  g.roundRect(MAP.x, MAP.y, MAP.w, MAP.h, 8)
  g.save()
  g.clip()
  g.translate(MAP.x + MAP.w, MAP.y)
  g.rotate(Math.PI / 2)
  g.scale(MAP_SCALE, MAP_SCALE)
  g.imageSmoothingQuality = 'high'
  drawDateMapBase(g)
  g.restore()
  g.strokeStyle = '#8b9a7c'
  g.lineWidth = 2
  g.stroke()

  DATE_MISSIONS.forEach((mission, index) => {
    const [x, y] = toBoard(mapPoint(mission))
    missionPin(g, x, y, index + 1, 13)
  })

  if (guideBoardPosition) {
    const [x, y] = toBoard(guideBoardPosition)
    g.fillStyle = '#254448'
    g.beginPath()
    g.arc(x, y, 6, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = PAPER
    g.lineWidth = 2.5
    g.stroke()
    g.beginPath()
    g.roundRect(x + 10, y - 12, 78, 24, 5)
    g.fill()
    g.fillStyle = PAPER
    g.font = `bold 14px ${FONT}`
    g.fillText('현재 위치', x + 49, y)
  }

  g.beginPath()
  g.roundRect(MAP.x + MAP.w - 67, MAP.y + 12, 54, 26, 5)
  g.fillStyle = PAPER
  g.fill()
  g.fillStyle = '#254448'
  g.font = `bold 15px ${FONT}`
  g.fillText('북 →', MAP.x + MAP.w - 40, MAP.y + 25)

  DATE_MISSIONS.forEach(({ short }, index) => {
    const x = 37 + (index % 4) * 164
    const y = index < 4 ? 446 : 471
    missionPin(g, x, y, index + 1, 9)
    g.fillStyle = INK
    g.font = `bold 17px ${FONT}`
    g.textAlign = 'left'
    g.fillText(short, x + 15, y, 142)
  })
  g.fillStyle = '#654839'
  g.font = `bold 16px ${FONT}`
  g.textAlign = 'center'
  g.fillText('안내판을 눌러 확대 지도 보기', BOARD_WIDTH / 2, 494)

  return canvas
}

export function GuideBoard() {
  const anisotropy = useThree(({ gl }) => Math.min(gl.capabilities.getMaxAnisotropy(), 8))
  const texture = useMemo(() => {
    const map = new THREE.CanvasTexture(createGuideBoardCanvas())
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = anisotropy
    return map
  }, [anisotropy])
  useEffect(() => () => texture.dispose(), [texture])
  const open = () => useDateMission.getState().openMap()
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={WOOD} position={[s * (W / 2 + 0.06), 1.2, 0]} scale={[0.12, 2.4, 0.12]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={WOOD} position={[0, 1.55, -0.03]} scale={[W + 0.2, H + 0.2, 0.06]} />
      <mesh
        geometry={GEO.plane}
        position={[0, 1.55, 0.005]}
        scale={[W, H, 1]}
        onClick={(e) => (e.stopPropagation(), open())}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
      <mesh geometry={GEO.box} material={ROOF} position={[0, 2.5, 0]} rotation={[0.25, 0, 0]} scale={[W + 0.5, 0.08, 0.6]} />
      <BoardInteraction onOpen={open} />
    </group>
  )
}

// 안내판 앞이면 "E 데이트 코스 안내판 보기" + E로 열기
function BoardInteraction({ onOpen }) {
  const scene = useThree((s) => s.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const near = useRef(false)
  const hintRef = useRef(null)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), [])

  useEffect(() => {
    const down = (e) => {
      const game = useGameStore.getState()
      if (e.code === 'KeyE' && !e.repeat && near.current && !game.openPanel && !game.nearbyPlaceId) onOpen()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [onOpen])

  useFrame(({ clock }) => {
    if (!player.current?.parent && Math.floor(clock.elapsedTime) % 1 === 0) player.current = scene.getObjectByName('player') ?? null
    if (!player.current || !anchor.current) return
    anchor.current.localToWorld(tmp.a.set(0, 0, 1.6))
    player.current.getWorldPosition(tmp.b)
    const now = Math.hypot(tmp.a.x - tmp.b.x, tmp.a.z - tmp.b.z) < NEAR && Math.abs(tmp.a.y - tmp.b.y) < 3
    if (now !== near.current) {
      near.current = now
      if (hintRef.current) hintRef.current.style.display = now ? 'block' : 'none'
    }
  })

  return (
    <group ref={anchor}>
      <Html position={[0, 2.95, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={hintRef} style={{ display: 'none', padding: '5px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 13, whiteSpace: 'nowrap' }}>
          <kbd style={{ padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }}>E</kbd> 데이트 코스 안내판 보기
        </div>
      </Html>
    </group>
  )
}
