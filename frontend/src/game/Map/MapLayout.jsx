import { layout } from '../data/mapData.js'
import Ground from './Ground.jsx'
import Zones from './Zones.jsx'
import Prop from './Prop.jsx'
import { Markings, Road } from './Roads.jsx'
import Terrain from './Terrain.jsx'
import Landscape from './Landscape.jsx'
import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, Vector3 } from 'three'

// 높이가 같은 포장 두 장이 만나는 교차부만 조금 띄워서 겹침을 막아요.
const roadLayers = []
for (const item of layout.roads) {
  const [x, z] = item.position
  const [w, height, d] = item.size
  const yaw = (item.rotationDeg ?? 0) * Math.PI / 180
  const rx = (Math.abs(Math.cos(yaw)) * w + Math.abs(Math.sin(yaw)) * d) / 2
  const rz = (Math.abs(Math.sin(yaw)) * w + Math.abs(Math.cos(yaw)) * d) / 2
  const bounds = [x - rx, z - rz, x + rx, z + rz]
  const layer = roadLayers.reduce((level, previous) => {
    const [left, north, right, south] = previous.bounds
    const overlaps = bounds[0] < right - 0.001 && bounds[2] > left + 0.001 &&
      bounds[1] < south - 0.001 && bounds[3] > north + 0.001
    return height === previous.height && overlaps ? Math.max(level, previous.layer + 1) : level
  }, 0)
  roadLayers.push({ item, bounds, height, layer })
}

// [3. 개발 > 렌더링 최적화] 작은 장식만 묶어서 멀리서는 생략해요.
const CELL_SIZE = 24
const DETAIL_DISTANCE = 95
// 전망대(BK 타워 전망층, 높이 약 25m)처럼 높은 곳에서는 맵 전체가 보이도록 거리 생략을 끔 (땅 위에서는 그대로 생략)
const OVERLOOK_HEIGHT = 18
const detailStyles = /^(bench|bins|vending|lamp|hjLantern|hjMailbox|hjBicycle|hjAFrameSign|hjCafeSet|hjFruitCart|hjPetals|hjStringLights)$/
const mainProps = []
const detailCells = new Map()
const buildingCells = new Map()
const propCells = new Map()

function addToCell(cells, item) {
  const [x, z] = item.position
  const cellX = Math.floor(x / CELL_SIZE)
  const cellZ = Math.floor(z / CELL_SIZE)
  const key = `${cellX},${cellZ}`
  if (!cells.has(key)) {
    cells.set(key, {
      center: new Vector3((cellX + 0.5) * CELL_SIZE, 0, (cellZ + 0.5) * CELL_SIZE),
      items: [],
    })
  }
  cells.get(key).items.push(item)
}

for (const item of layout.props) {
  if (detailStyles.test(item.style) && !item.model) {
    addToCell(detailCells, item)
  } else if (Math.max(...item.size) > 16 || /portal|trigger|gate/i.test(item.style ?? '')) {
    mainProps.push(item)
  } else {
    addToCell(propCells, item)
  }
}
for (const item of layout.buildings) addToCell(buildingCells, item)

function DetailCell({ cell, alwaysVisible, maxDistance = DETAIL_DISTANCE }) {
  const ref = useRef(null)
  useFrame(({ camera }) => {
    if (!ref.current) return
    const distance = camera.position.distanceToSquared(cell.center)
    ref.current.visible = alwaysVisible || camera.position.y > OVERLOOK_HEIGHT || distance < maxDistance ** 2
  })
  return (
    <group ref={ref}>
      {cell.items.map((item) => <Prop key={item.id} item={item} />)}
    </group>
  )
}

function DistantBuildings({ groupRef }) {
  const meshRef = useRef(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    const transform = new Object3D()
    const color = new Color()
    layout.buildings.forEach((building, index) => {
      const [x, z] = building.position
      const [width, height, depth] = building.size
      transform.position.set(x, (building.elevation ?? 0) + height / 2, z)
      transform.rotation.y = (building.rotationDeg ?? 0) * Math.PI / 180
      transform.scale.set(width, height, depth)
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
      mesh.setColorAt(index, color.set(building.color ?? '#c5ad9d'))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [])

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh ref={meshRef} args={[null, null, layout.buildings.length]}>
        <boxGeometry />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  )
}

// hub.json + zones/*.json (mapData.js가 합쳐 줌)을 읽어서
// 바닥, 구역 표시, 길, 도로 표시, 건물, 소품, 시작 지점을 배치
export default function MapLayout({ showStartMarker = true, highDetail = false }) {
  const [startX, startZ] = layout.playerStart
  const detailedBuildings = useRef(null)
  const distantBuildings = useRef(null)
  useFrame(({ camera }) => {
    if (!detailedBuildings.current || !distantBuildings.current) return
    const showSilhouettes = showStartMarker && !highDetail && camera.position.y > 110
    detailedBuildings.current.visible = !showSilhouettes
    distantBuildings.current.visible = showSilhouettes
  })

  return (
    <group name="map">
      <Landscape />
      <Ground ground={layout.ground} />
      <Zones />

      {roadLayers.map(({ item, layer }) => (
        <Road key={item.id} item={item} layer={layer} />
      ))}
      <Markings markings={layout.markings} />
      <Terrain />

      <group ref={detailedBuildings}>
        {Array.from(buildingCells, ([key, cell]) => (
          <DetailCell key={key} cell={cell} alwaysVisible={highDetail || showStartMarker} maxDistance={100} />
        ))}
      </group>
      <DistantBuildings groupRef={distantBuildings} />
      {mainProps.map((prop) => (
        <Prop key={prop.id} item={prop} />
      ))}
      {Array.from(propCells, ([key, cell]) => (
        <DetailCell key={key} cell={cell} alwaysVisible={highDetail || showStartMarker} maxDistance={75} />
      ))}
      {Array.from(detailCells, ([key, cell]) => <DetailCell key={key} cell={cell} alwaysVisible={highDetail} />)}

      {/* 시작 지점: 반투명 초록 캡슐 (둘러보기 중에만. 플레이 중엔 캐릭터가 여기 서 있음) */}
      {showStartMarker && (
        <mesh position={[startX, 0.85, startZ]}>
          <capsuleGeometry args={[0.35, 1.0, 8, 16]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  )
}
