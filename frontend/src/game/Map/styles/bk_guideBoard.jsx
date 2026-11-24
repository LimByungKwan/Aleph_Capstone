import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { GEO, mat } from './kit.jsx'
import { DATE_MISSIONS, mapPoint, useDateMission } from './bk_dateMission.js'

// 데이트 코스 안내판 (담당: 병관) — 영화·드라마 구역 "경복궁 관람길" 안내판과 같은 역할
// 데이트 코스 입구 안쪽에 서 있는 나무 안내판. 누르거나 앞에서 E → 데이트 코스 지도(DateMission.jsx의 DateMap)
// 구역 파일 style: "bkGuideBoard"

const W = 2.2
const H = 1.6
const NEAR = 3
const WOOD = mat('#8b5e3c')
const ROOF = mat('#be185d')

// 안내판 그림: 제목 + 구역 모양 + 미션 위치 점 (캔버스로 직접 그림)
function boardTexture() {
  const c = document.createElement('canvas')
  c.width = 704
  c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#fff8f1'
  g.fillRect(0, 0, c.width, c.height)
  g.strokeStyle = '#f9a8d4'
  g.lineWidth = 14
  g.strokeRect(7, 7, c.width - 14, c.height - 14)
  g.fillStyle = '#9d174d'
  g.font = 'bold 46px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
  g.textAlign = 'center'
  g.fillText('💕 데이트 코스 안내', c.width / 2, 72)
  // 구역 지도 (가로로 눕혀 그림: 왼쪽 = 입구)
  const box = { x: 70, y: 110, w: 564, h: 300 }
  g.fillStyle = '#e8f2dc'
  g.fillRect(box.x, box.y, box.w, box.h)
  g.fillStyle = '#cfe3b8'
  g.fillRect(box.x + box.w * 0.5, box.y, box.w * 0.5, box.h)
  const toBoard = ([x, z]) => [box.x + ((40 - z) / 160) * box.w, box.y + ((x - 45) / 80) * box.h]
  g.font = '30px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  g.textBaseline = 'middle'
  for (const m of DATE_MISSIONS) {
    const [x, y] = toBoard(mapPoint(m))
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(x, y, 22, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#f472b6'
    g.lineWidth = 4
    g.stroke()
    g.fillStyle = '#000'
    g.fillText(m.icon, x, y + 2)
  }
  g.fillStyle = '#6b5a45'
  g.font = '26px "Malgun Gothic", sans-serif'
  g.fillText('안내판을 눌러 지도 보기 · 미션 7곳', c.width / 2, 462)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function GuideBoard() {
  const board = useMemo(() => new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.8 }), [])
  const open = () => useDateMission.getState().openMap()
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={WOOD} position={[s * (W / 2 + 0.06), 1.2, 0]} scale={[0.12, 2.4, 0.12]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={WOOD} position={[0, 1.55, -0.03]} scale={[W + 0.2, H + 0.2, 0.06]} />
      <mesh
        geometry={GEO.plane}
        material={board}
        position={[0, 1.55, 0.005]}
        scale={[W, H, 1]}
        onClick={(e) => (e.stopPropagation(), open())}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
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
