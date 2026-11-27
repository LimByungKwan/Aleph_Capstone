import { layout } from '../data/mapData.js'
import Ground from './Ground.jsx'
import Zones from './Zones.jsx'
import Prop from './Prop.jsx'
import { Markings, Road } from './Roads.jsx'
import Terrain from './Terrain.jsx'
import Landscape from './Landscape.jsx'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { create } from 'zustand'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, Vector3 } from 'three'
import { useLoadState } from '../../store/loadState.js'

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
// 고화질: 생략 거리를 이만큼 늘림 (예전엔 고화질이면 맵 전체를 한꺼번에 그려서 렉이 심했음)
// 120~170m 밖의 벤치·가로등은 화면에서 몇 픽셀이라 생략해도 티가 안 남
const HIGH_DETAIL_FAR = 1.4
// 전망대(BK 타워 전망층, 높이 약 25m)처럼 높은 곳에서는 맵 전체가 보이도록 거리 생략을 끔 (땅 위에서는 그대로 생략)
const OVERLOOK_HEIGHT = 18
// (11/27 성능) 맵 전체 보기(카메라 약 200m 위)는 맵 전체를 그려 draw call ~5,000개 → 이 높이 위에서는 8m 이하 소품·장식을 생략
//   200m 위에서 8m 이하 소품은 몇 픽셀이라 티가 안 남. 건물이 윤곽으로 바뀌는 높이(110m)와 같음
const AERIAL_HEIGHT = 110
const SMALL_PROP = 8
// 나무·꽃밭·바닥처럼 위에서 봐도 면적이 큰 것은 그대로 그림 (빼면 광장이 휑해 보임)
const aerialKeep = /tree|maple|sakura|ginkgo|bush|flowerBed|landscape|rock|floor|road|beach|fountain/i
const detailStyles = /^(bench|bins|vending|lamp|hjLantern|hjMailbox|hjBicycle|hjAFrameSign|hjCafeSet|hjFruitCart|hjPetals|hjStringLights)$/
const mainProps = []
const detailCells = new Map()
const buildingCells = new Map()
const propCells = new Map()
const smallPropCells = new Map()

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
    const small = Math.max(...item.size) <= SMALL_PROP && !aerialKeep.test(item.style ?? '')
    addToCell(small ? smallPropCells : propCells, item)
  }
}
for (const item of layout.buildings) addToCell(buildingCells, item)

// (11/27 성능) 맵 소품을 한 번에 다 만들면 첫 로딩에 메인 스레드가 ~1.6초 통째로 멈춤(로딩 화면도 굳음)
//   → 시작 지점에서 가까운 것부터 STAGE_CHUNK개씩 나눠 붙임. 다 붙으면 mapReady → 셰이더 미리 컴파일(ShaderWarmup)
const STAGE_CHUNK = 6
const stageRank = new Map()
{
  const [sx, sz] = layout.playerStart
  const units = [
    ...mainProps.map((item) => [item.id, item.position[0], item.position[1]]),
    ...[buildingCells, propCells, smallPropCells, detailCells].flatMap((cells) =>
      Array.from(cells, ([key, cell]) => [cell, cell.center.x, cell.center.z]),
    ),
  ]
  units
    .sort((a, b) => Math.hypot(a[1] - sx, a[2] - sz) - Math.hypot(b[1] - sx, b[2] - sz))
    .forEach(([unit], rank) => stageRank.set(unit, rank))
}
// 몇 개까지 붙였는지. MapLayout은 다시 그리지 않고, 순서가 된 Staged 하나만 다시 그려짐 (전체를 다시 그리면 덩어리마다 ~200ms)
const useStage = create(() => ({ count: STAGE_CHUNK }))
function Staged({ unit, children }) {
  const show = useStage((s) => stageRank.get(unit) < s.count)
  return show ? children : null
}
// 한 덩어리가 화면에 붙은(커밋된) 뒤에 다음 덩어리를 요청 — 먼저 요청하면 React가 여러 덩어리를 한 번에 그려 다시 길게 멈춤
// 덩어리 사이에 브라우저가 화면을 그릴 틈을 줌. setTimeout은 다른 탭에 가 있으면 1초에 한 번으로 늦춰져서 MessageChannel 사용
const stageChannel = typeof MessageChannel === 'undefined' ? null : new MessageChannel()
if (stageChannel) stageChannel.port1.onmessage = () => useStage.setState((s) => ({ count: s.count + STAGE_CHUNK }))
function StageDriver() {
  const count = useStage((s) => s.count)
  useEffect(() => {
    if (count >= stageRank.size) useLoadState.getState().setMapReady()
    else stageChannel?.port2.postMessage(null)
  }, [count])
  return null
}

function DetailCell({ cell, alwaysVisible, maxDistance = DETAIL_DISTANCE, aerialHide = false }) {
  const ref = useRef(null)
  useFrame(({ camera }) => {
    if (!ref.current) return
    const distance = camera.position.distanceToSquared(cell.center)
    const y = camera.position.y
    const hideFromAir = aerialHide && y > AERIAL_HEIGHT
    ref.current.visible = camera.userData.showFullMap || (!hideFromAir && (alwaysVisible || y > OVERLOOK_HEIGHT || distance < maxDistance ** 2))
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
  const far = highDetail ? HIGH_DETAIL_FAR : 1
  const detailedBuildings = useRef(null)
  const distantBuildings = useRef(null)
  useFrame(({ camera }) => {
    if (!detailedBuildings.current || !distantBuildings.current) return
    const showSilhouettes = !camera.userData.showFullMap && showStartMarker && !highDetail && camera.position.y > 110
    detailedBuildings.current.visible = !showSilhouettes
    distantBuildings.current.visible = showSilhouettes
  })

  return (
    <group name="map">
      <StageDriver />
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
          <Staged key={key} unit={cell}><DetailCell cell={cell} alwaysVisible={showStartMarker} maxDistance={100 * far} /></Staged>
        ))}
      </group>
      <DistantBuildings groupRef={distantBuildings} />
      {mainProps.map((prop) => (
        <Staged key={prop.id} unit={prop.id}><Prop item={prop} /></Staged>
      ))}
      {Array.from(propCells, ([key, cell]) => (
        <Staged key={key} unit={cell}><DetailCell cell={cell} alwaysVisible={showStartMarker} maxDistance={75 * far} /></Staged>
      ))}
      {Array.from(smallPropCells, ([key, cell]) => (
        <Staged key={key} unit={cell}><DetailCell cell={cell} alwaysVisible={showStartMarker} maxDistance={75 * far} aerialHide /></Staged>
      ))}
      {Array.from(detailCells, ([key, cell]) => <Staged key={key} unit={cell}><DetailCell cell={cell} alwaysVisible={false} maxDistance={DETAIL_DISTANCE * far} aerialHide /></Staged>)}

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
