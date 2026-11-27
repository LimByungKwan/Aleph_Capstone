import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { InteractiveSeat } from './jm_bench.jsx'

function shuffledColors() {
  const order = ['Beige', 'Green', 'Blue', 'Orange']
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const color = order[i]
    order[i] = order[j]
    order[j] = color
  }
  return order
}

export function PicnicBeanbags({ item }) {
  const { nodes } = useGLTF('/models/picnic-beanbags.glb', false)
  const mats = useMemo(() => {
    let order = []
    return item.features.filter(f => f.t === 'picnic').map(feature => {
      if (!order.length) order = shuffledColors()
      return { feature, pair: order.splice(0, 2) }
    })
  }, [item])

  return mats.map(({ feature, pair }, index) => (
    <group key={index} position={[feature.p[0], feature.y ?? 0, feature.p[1]]} rotation-y={feature.rot ?? 0}>
      {pair.map((color, side) => {
        const model = nodes[color]
        return (
          <group key={side} position={[side ? 1.8 : -1.8, 0, 0.2]} rotation-y={side ? -0.12 : 0.12}>
            <InteractiveSeat id={`${item.id}/${index}/${side}`} seatHeight={model.userData.seatHeight} label="빈백에 앉기">
              <mesh geometry={model.geometry} material={model.material} castShadow receiveShadow dispose={null} />
            </InteractiveSeat>
          </group>
        )
      })}
    </group>
  ))
}
