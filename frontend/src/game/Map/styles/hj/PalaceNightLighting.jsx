import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, MeshBasicMaterial } from 'three'
import { live } from '../../../timeOfDay.js'
import { GEO, Instances } from '../kit.jsx'
import { DECK, GATES, HALLS, MAIN_GATE, THRONE } from './gyeongbokgungLayout.js'

const SOURCES = [
  [MAIN_GATE.x, 3.0, MAIN_GATE.z - 3.5, 24, 12],
  [THRONE.x - 4.6, 2, THRONE.z - 5.1, 28, 12],
  [THRONE.x + 4.6, 2, THRONE.z - 5.1, 28, 12],
  [DECK.x, 2.45, DECK.z, 24, 12],
  [7.6, 1.8, 9.4, 15, 10],
  ...HALLS.filter((hall) => hall !== THRONE).map(({ x, z, d, elevation = .33 }) =>
    [x, elevation + 1.4, z + d * .18, 9, Math.min(5.8, d + 1)]),
]

// [3. 개발 > 프론트엔드] 밤에는 창호와 등롱이 빛나고, 가까운 광원만 공용 조명 풀에서 사용합니다.
export default function PalaceNightLighting({ lanterns, materials }) {
  const lights = useRef(null)
  const night = useRef(null)
  const lighting = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 31.8)
    grad.addColorStop(0, 'rgba(255,202,123,1)')
    grad.addColorStop(.38, 'rgba(255,181,91,.38)')
    grad.addColorStop(1, 'rgba(244,139,47,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 64)
    const texture = new CanvasTexture(canvas)
    const pools = new MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0, toneMapped: false,
    })
    const lamps = new MeshBasicMaterial({ color: '#ffcf7f', toneMapped: false })
    const rotated = [-Math.PI / 2, 0, 0]
    const floor = lanterns.map(([x, z]) => ({ p: [x, .203, z], s: [4.2, 4.2, 1], r: rotated }))
    const bulbs = lanterns.map(([x, z]) => ({ p: [x, .695, z], s: [.204, .18, .204] }))
    const eaves = [
      ...HALLS.map(({ x, z, w, d, h, elevation = .33 }) => ({ x, z, w, d, y: elevation + h - .47 })),
      ...GATES.filter((gate) => !gate.yaw).map(({ x, z, w, d = 1.95 }) => ({ x, z, w, d, y: 2.53 })),
      { x: MAIN_GATE.x, z: MAIN_GATE.z, w: 14.2, d: 5.1, y: 5.39 },
      { x: DECK.x, z: DECK.z, w: 12.7, d: 8.43, y: 4.10 },
    ].flatMap(({ x, z, w, d, y }) => [-1, 1].map(side => (
      { p: [x, y, z + side * (d * .5 + .02)], s: [w * .83, .029, .033] }
    )))
    return { texture, pools, lamps, floor, bulbs, eaves }
  }, [lanterns])

  useEffect(() => () => {
    lighting.texture.dispose()
    lighting.pools.dispose()
    lighting.lamps.dispose()
  }, [lighting])

  useFrame(() => {
    const strength = live.stars
    night.current.visible = strength > .025
    lighting.pools.opacity = strength * .36
    materials.lattice.emissiveIntensity = .15 + strength * .92
    materials.dancheong.emissiveIntensity = .16 + strength * .46
    for (const [index, light] of lights.current.children.entries()) {
      light.intensity = (.12 + strength) * SOURCES[index][3]
    }
  })

  return (
    <>
      <group ref={lights}>
        {SOURCES.map(([x, y, z, , distance]) => (
          <pointLight key={`${x},${z}`} position={[x, y, z]} color="#ffd398" intensity={2} distance={distance} />
        ))}
      </group>
      <group ref={night} visible={false}>
        <Instances geometry={GEO.plane} material={lighting.pools} items={lighting.floor} />
        <Instances geometry={GEO.box} material={lighting.lamps} items={lighting.bulbs} />
        <Instances geometry={GEO.box} material={lighting.lamps} items={lighting.eaves} />
      </group>
    </>
  )
}
