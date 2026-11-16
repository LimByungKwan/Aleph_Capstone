import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import MapLayout from './Map/MapLayout.jsx'
import PlaceMarkers from './Map/PlaceMarkers.jsx'
import { CAMERA_START, CAMERA_TARGET, SUN_POSITION } from './config.js'
import { labelLayer } from './labelLayer.js'

// 3D 화면 전체: 캔버스, 하늘, 조명, 카메라, 맵, 상호작용 지점
export default function Scene() {
  return (
    <div ref={labelLayer} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas shadows="percentage" camera={{ position: CAMERA_START, fov: 50, near: 0.1, far: 500 }}>
        <Sky sunPosition={SUN_POSITION} turbidity={6} rayleigh={1.5} />

        {/* 약한 전체 조명 + 그림자 있는 태양광 1개 */}
        <hemisphereLight args={['#ffffff', '#b9a98f', 0.6]} />
        <directionalLight
          position={SUN_POSITION}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
          shadow-camera-near={1}
          shadow-camera-far={150}
          shadow-bias={-0.0005}
        />

        <MapLayout />
        <PlaceMarkers />

        {/* 둘러보기 전용 카메라. 땅 밑으로 못 내려가고, 옆으로 끌면 땅과 평행하게 이동 */}
        <OrbitControls
          makeDefault
          target={CAMERA_TARGET}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={3}
          maxDistance={90}
          screenSpacePanning={false}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#fff',
          fontSize: 13,
          lineHeight: 1.6,
          pointerEvents: 'none',
        }}
      >
        <strong>SceneWalk AI · 골목 맵 (블록아웃)</strong>
        <br />
        왼쪽 드래그: 회전 · 오른쪽 드래그: 이동 · 휠: 확대/축소
      </div>
    </div>
  )
}
