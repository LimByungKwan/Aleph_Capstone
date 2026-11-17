import { Component, Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { STYLES } from './styles/index.js'

// 맵의 건물·소품을 그리는 공통 컴포넌트.
// item = { id, position: [x, z], size: [가로, 높이, 깊이], rotationDeg, color, style, model, elevation }
// elevation: 바닥에서 띄울 높이(m). 구역 파일에서 "onTerrain": true면 언덕 높이로 자동 계산돼요.
// 우선순위: model(GLB) > style(코드로 그린 모양) > 색 박스
// - model이 "/models/xxx.glb"면 GLB 모델 (로딩 중이거나 파일이 없으면 style 모양 또는 박스)
// - style이 "hanok", "tree" 같은 이름이면 styles/ 폴더의 모양으로 그림
export default function Prop({ item, castShadow = true }) {
  const [x, z] = item.position
  const [w, h, d] = item.size
  const rotationY = THREE.MathUtils.degToRad(item.rotationDeg ?? 0)

  const Styled = item.style ? STYLES[item.style] : null
  if (item.style && !Styled) console.warn(`[Prop] 알 수 없는 style "${item.style}" (${item.id}) → 박스로 표시`)

  const fallback = Styled ? (
    <ShadowGroup castShadow={castShadow}>
      <Styled item={item} />
    </ShadowGroup>
  ) : (
    <BoxShape size={item.size} color={item.color} castShadow={castShadow} />
  )

  return (
    <group position={[x, item.elevation ?? 0, z]} rotation={[0, rotationY, 0]} name={item.id}>
      {item.model ? (
        <ModelErrorBoundary fallback={fallback} url={item.model}>
          <Suspense fallback={fallback}>
            <GlbModel url={item.model} size={[w, h, d]} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        fallback
      )}
    </group>
  )
}

// 안에 든 모든 메시가 그림자를 만들고 받도록 한 번에 설정
// (투명한 것, userData.noShadow가 붙은 작은 물체·빛나는 물체는 그림자를 만들지 않음 → 그림자 계산 절약)
function ShadowGroup({ castShadow, children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    ref.current?.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = castShadow && !child.material.transparent && !child.userData.noShadow
        child.receiveShadow = true
      }
    })
  }, [castShadow])
  return <group ref={ref}>{children}</group>
}

function BoxShape({ size, color, castShadow }) {
  const [w, h, d] = size
  return (
    <mesh position={[0, h / 2, 0]} castShadow={castShadow} receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color ?? '#9a9a9a'} />
    </mesh>
  )
}

// GLB를 불러와서 size 박스 안에 꼭 맞게 크기를 맞추고, 바닥(y=0)에 세워 줌
function GlbModel({ url, size }) {
  const { scene } = useGLTF(url)

  const { object, scale, offset } = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    const bounds = new THREE.Box3().setFromObject(clone)
    const extent = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const s = Math.min(size[0] / extent.x, size[1] / extent.y, size[2] / extent.z) || 1
    return {
      object: clone,
      scale: s,
      offset: [-center.x * s, -bounds.min.y * s, -center.z * s],
    }
  }, [scene, size])

  return <primitive object={object} scale={scale} position={offset} />
}

// GLB 파일 경로가 틀렸을 때 화면이 멈추지 않고 박스로 대신 보여 줌
class ModelErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn(`[Prop] GLB를 불러오지 못해 박스로 표시합니다: ${this.props.url}`, error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
