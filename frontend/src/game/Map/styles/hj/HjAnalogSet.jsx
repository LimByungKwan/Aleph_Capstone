import { useEffect, useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { Shape, Object3D } from 'three'
import { labelLayer } from '../../../labelLayer.js'
import { usePortalStore } from '../../../../components/movieZone/portalStore.js'
import { ANALOG_SCENES } from '../../../../components/movieZone/sceneData.js'
import { areaForScene, lastPlayerPosition } from '../../../../components/movieZone/hjAreas.js'
import { requestPalaceWarp } from '../../../../components/movieZone/palaceSeating.js'
import { Box, Cyl, GEO, Instances, mat, seeded } from '../kit.jsx'
import HjWalkInRoom from './HjWalkInRoom.jsx'

const OAK = '#69402b'
const TILE = mat('#ffffff', { roughness: 0.86 })
const LEAF = mat('#ffffff', { flat: true })

// [3. 개발 > 프론트엔드] 따뜻한 빛은 정해진 거리에서 감쇠해 HJ 골목에만 닿아요.
export function HjGoldenSet() {
  const target = useRef(null)
  const light = useRef(null)
  useEffect(() => { light.current.target = target.current }, [])
  return (
    <>
      <primitive object={useMemo(() => new Object3D(), [])} ref={target} position={[12, 0, 9]} />
      <spotLight ref={light} position={[-4, 14, -15]} color="#ffc179" intensity={1030}
        angle={0.63} penumbra={0.84} distance={42} decay={2} />
      <pointLight position={[19, 3.65, 2]} color="#ffd69a" intensity={32} distance={12} />
      <pointLight position={[5, 4.15, 12]} color="#ffba72" intensity={26} distance={10} />
    </>
  )
}

export function HjAnalogHanok({ item }) {
  const [w, h, d] = item.size
  const wallH = h * 0.48
  const front = d / 2
  const { roof, tiles, ivy } = useMemo(() => {
    const section = new Shape()
    section.moveTo(-front - 0.5, 0)
    section.quadraticCurveTo(-front * 0.62, -0.16, 0, h * 0.33)
    section.quadraticCurveTo(front * 0.62, -0.16, front + 0.5, 0)
    section.lineTo(front + 0.5, -0.19)
    section.quadraticCurveTo(front * 0.62, -0.35, 0, h * 0.33 - 0.19)
    section.quadraticCurveTo(-front * 0.62, -0.35, -front - 0.5, -0.19)
    section.closePath()

    const tiles = []
    const rng = seeded(7078)
    for (let x = -w / 2 - 0.3; x < w / 2 + 0.4; x += 0.26) {
      for (const side of [-1, 1]) {
        const edge = front + 0.44
        tiles.push({ p: [x, wallH + 0.015, side * edge], s: [0.106, 0.25, 0.106],
          r: [Math.PI / 2, 0, 0], c: rng() > 0.5 ? '#645652' : '#514544' })
        tiles.push({ p: [x, wallH + h * 0.33, 0], s: [0.14, 0.26, 0.14],
          r: [0, 0, Math.PI / 2], c: '#62514a' })
      }
    }
    const ivy = Array.from({ length: 54 }, () => {
      const x = (0.22 + rng() * 0.25) * w * (rng() > 0.43 ? 1 : -1)
      const y = wallH * (0.38 + rng() * 0.52)
      return { p: [x, y, front + 0.1 + rng() * 0.09], s: [0.18, 0.115, 0.12],
        c: rng() > 0.5 ? '#687d39' : '#456630' }
    })
    return { roof: section, tiles, ivy }
  }, [w, h, front, wallH])
  return (
    <group>
      {item.walkIn
        ? <HjWalkInRoom width={w} depth={d} material={mat(item.color ?? '#eddbb8')} />
        : <>
          <Box p={[0, 0.17, 0]} s={[w + 0.17, 0.34, d + 0.12]} c="#a69883" />
          <Box p={[0, wallH / 2, 0]} s={[w, wallH, d]} c={item.color ?? '#eddbb8'} />
        </>}
      <mesh position={[-w / 2 - 0.46, wallH, 0]} rotation-y={Math.PI / 2}>
        <extrudeGeometry args={[roof, { depth: w + 0.92, bevelEnabled: false, curveSegments: 12 }]} />
        <meshStandardMaterial color="#544943" roughness={0.87} />
      </mesh>
      <Instances geometry={GEO.cyl8} material={TILE} items={tiles} />
      <Box p={[0, wallH - 0.08, front + 0.06]} s={[w + 0.07, 0.19, 0.11]} c={OAK} />
      {[-0.47, -0.25, 0.25, 0.47].map((x) => (
        <Box key={x} p={[w * x, wallH / 2, front + 0.053]} s={[0.13, wallH, 0.14]} c={OAK} />
      ))}
      {!item.walkIn && <Box p={[0, 1.27, front + 0.1]} s={[1.9, 2.25, 0.19]} c={OAK} />}
      {Array.from({ length: item.walkIn ? 0 : 8 }, (_, i) => (
        <Box key={i} p={[(i - 3.5) * 0.224, 1.27, front + 0.207]} s={[0.206, 2.16, 0.035]}
          c={i % 2 ? '#8a5737' : '#75472d'} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          {item.walkIn
            ? <Box p={[side * 0.97, 1.13, front + 0.035]} s={[0.14, 2.25, 0.17]} c={OAK} />
            : <Box p={[side * 0.18, 1.23, front + 0.25]} s={[0.09, 0.07, 0.045]} c="#b9884d" />}
          <Box p={[side * w * 0.29, 1.52, front + 0.07]} s={[w * 0.21, 0.91, 0.045]}
            m={mat('#ffe4b0', { emissive: '#ffab57', emissiveIntensity: 0.41 })} />
          {[-1, 0, 1].map((bar) => (
            <Box key={bar} p={[side * w * 0.29 + bar * w * 0.058, 1.52, front + 0.108]}
              s={[0.042, 0.95, 0.035]} c={OAK} />
          ))}
          <Cyl p={[side * w * 0.38, 0.22, front + 0.42]} rad={0.24} h={0.43} c="#ac6244" />
          <mesh geometry={GEO.ico} material={mat('#698348')} position={[side * w * 0.38, 0.55, front + 0.42]}
            scale={[0.29, 0.26, 0.29]} />
        </group>
      ))}
      <Instances geometry={GEO.ico} material={LEAF} items={ivy} />
    </group>
  )
}

// 구역 이름표(📍): 멀리서 누르면 그 구역 입구로 바로 이동(도착하면 입장 카드), 가까이에서 누르면 장면 이야기 열기
const WARP_FROM_M = 22
export function HjAnalogLabel({ item }) {
  const scene = ANALOG_SCENES[item.sceneId]
  if (!scene) return null
  const area = areaForScene(item.sceneId)
  const onPick = (event) => {
    event.stopPropagation()
    event.currentTarget.blur()
    const me = lastPlayerPosition()
    const [lx, lz] = item.position
    const far = me && Math.hypot(me.x - lx, me.z - lz) > WARP_FROM_M
    const arrive = far && area?.arrive()
    if (arrive) requestPalaceWarp(arrive)
    else usePortalStore.setState({ active: scene, dismissedId: null })
  }
  return (
    <Html portal={labelLayer} position={[0, item.size[1], 0]} center zIndexRange={[50, 30]}>
      <button type="button" className="hj-story-cue" onClick={onPick} title={area ? `누르면 ${area.name} 입구로 이동해요` : undefined}>📍 {scene.title}</button>
    </Html>
  )
}
