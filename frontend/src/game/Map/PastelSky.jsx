import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CLOUDS_DRIFT, FOG_FAR, FOG_NEAR, SHOW_CLOUDS, SHOW_MOUNTAINS, SKY_COLORS } from '../config.js'
import { useSettings } from '../settingsStore.js'
import { live, snapTimeOfDay, stepTimeOfDay } from '../timeOfDay.js'
import { seeded } from './styles/kit.jsx'

// 파스텔 하늘 세트. 인터넷 이미지(HDR) 없이 코드로만 그려요.
// 하늘색은 시간대(아침/점심/밤, 설정창 ⚙)에 따라 timeOfDay.js의 live 값을 따라 부드럽게 바뀌어요. (계절과는 무관)
// 최적화: 하늘 1번 + 구름 1번 + 먼 산 1번 + 바깥 땅 1번 + 별 1번(밤에만) = 그리기 호출 최대 5번, 그림자 없음.

export default function PastelSky({ fullBackdrop = false }) {
  return (
    <>
      <TimeOfDayDriver />
      <fog attach="fog" args={[SKY_COLORS.fog, fullBackdrop ? 550 : FOG_NEAR, fullBackdrop ? 1800 : FOG_FAR]} />
      <SkyDome />
      <Stars />
      <OuterGround />
      {SHOW_MOUNTAINS && <Mountains />}
      {SHOW_CLOUDS && <Clouds />}
    </>
  )
}

// 매 프레임 하늘·빛 값을 시간대 목표로 조금씩 옮기고, 안개 색을 맞춤 (가장 먼저 실행)
function TimeOfDayDriver() {
  const scene = useThree((state) => state.scene)
  useLayoutEffect(() => {
    snapTimeOfDay(useSettings.getState().timeOfDay)
  }, [])
  useFrame(({ camera }, delta) => {
    if (!camera.userData.showFullMap) stepTimeOfDay(useSettings.getState().timeOfDay, delta)
    if (scene.fog) scene.fog.color.copy(live.fog)
  }, -1)
  return null
}

// ── 별 (밤에만 보임, 점 1,200개를 한 번에) ──
function Stars() {
  const ref = useRef(null)
  const { geometry, material } = useMemo(() => {
    const random = seeded(31)
    const count = 1200
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // 하늘 위쪽 반구에 고르게 (지평선 근처는 적게)
      const y = 0.08 + random() * 0.92
      const a = random() * Math.PI * 2
      const r = Math.sqrt(1 - y * y)
      positions.set([Math.cos(a) * r * 9, y * 9, Math.sin(a) * r * 9], i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({ color: '#fff8e7', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })
    return { geometry, material }
  }, [])
  useFrame(({ camera }) => {
    const points = ref.current
    if (!points) return
    points.visible = live.stars > 0.01 // 낮에는 아예 안 그림
    material.opacity = live.stars
    points.position.copy(camera.position)
  })
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={0} />
}

// ── 하늘 돔: 위 하늘색 → 지평선 복숭아빛 그라데이션 + 태양 빛번짐 ──
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = pos.xyww; // 항상 가장 먼 곳에 그림 (다른 물체를 가리지 않음)
  }
`
const skyFragment = /* glsl */ `
  uniform vec3 top;
  uniform vec3 middle;
  uniform vec3 horizon;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 color = mix(horizon, middle, smoothstep(-0.02, 0.22, h));
    color = mix(color, top, smoothstep(0.22, 0.85, h));
    float s = max(dot(dir, sunDir), 0.0);
    color += sunColor * (pow(s, 600.0) * 1.2 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function SkyDome() {
  const ref = useRef(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        // live 객체를 그대로 연결 → 시간대가 바뀌면 하늘 색이 자동으로 따라감
        uniforms: {
          top: { value: live.top },
          middle: { value: live.middle },
          horizon: { value: live.horizon },
          sunColor: { value: live.sunGlow },
          sunDir: { value: live.sunDir },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  const geometry = useMemo(() => new THREE.SphereGeometry(10, 32, 16), [])

  // 하늘은 카메라를 따라다님 (아무리 멀리 가도 하늘 끝에 닿지 않게)
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />
}

// ── 맵 바깥 땅 (지평선까지 이어지는 풀밭, 충돌 없음) ──
function OuterGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
      <planeGeometry args={[2400, 2400]} />
      <meshStandardMaterial color={SKY_COLORS.outerGround} roughness={1} />
    </mesh>
  )
}

// ── 먼 산 (로우폴리 원뿔 여러 개를 하나로 합침) ──
const MOUNTAIN_COLORS = ['#b9a7d6', '#c4b2de', '#a9c7a1', '#b8d3a8', '#d1b8d8']

function Mountains() {
  const geometry = useMemo(() => {
    const random = seeded(99)
    const parts = []
    const color = new THREE.Color()
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2 + random() * 0.08
      // Keep the expanded sea horizon open instead of surrounding it with cones.
      if (angle > .7 && angle < 3.5) continue
      const distance = 470 + random() * 140
      const radius = 65 + random() * 60
      const height = 16 + random() * 28
      const cone = new THREE.ConeGeometry(radius, height, 7 + Math.floor(random() * 3), 1).toNonIndexed()
      cone.rotateY(random() * Math.PI)
      cone.translate(Math.cos(angle) * distance, height / 2 - 2, Math.sin(angle) * distance)
      // 아래는 진하고 위로 갈수록 밝게 (꼭대기만 살짝 분홍빛)
      color.set(MOUNTAIN_COLORS[Math.floor(random() * MOUNTAIN_COLORS.length)])
      const top = color.clone().lerp(new THREE.Color('#ffe4ec'), 0.35)
      const pos = cone.attributes.position
      const colors = new Float32Array(pos.count * 3)
      for (let v = 0; v < pos.count; v++) {
        const t = THREE.MathUtils.clamp((pos.getY(v) + 2) / height, 0, 1)
        const c = color.clone().lerp(top, t)
        colors.set([c.r, c.g, c.b], v * 3)
      }
      cone.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      cone.deleteAttribute('uv')
      parts.push(cone)
    }
    const merged = mergeGeometries(parts)
    merged.computeVertexNormals()
    parts.forEach((p) => p.dispose())
    return merged
  }, [])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </mesh>
  )
}

// ── 로우폴리 구름 (덩어리들을 인스턴스 하나로) ──
function Clouds() {
  const groupRef = useRef(null)
  const meshRef = useRef(null)

  const puffs = useMemo(() => {
    const random = seeded(7)
    const list = []
    for (let c = 0; c < 16; c++) {
      const angle = random() * Math.PI * 2
      const distance = 150 + random() * 260
      const cx = Math.cos(angle) * distance
      const cz = Math.sin(angle) * distance
      const cy = 70 + random() * 60
      const size = 9 + random() * 8
      const count = 4 + Math.floor(random() * 3)
      for (let p = 0; p < count; p++) {
        const s = size * (0.6 + random() * 0.6)
        list.push([cx + (p - count / 2) * size * 0.8 + random() * 4, cy + random() * size * 0.4, cz + (random() - 0.5) * size, s, s * 0.7, s])
      }
    }
    return list
  }, [])

  const setup = (mesh) => {
    if (!mesh || meshRef.current === mesh) return
    meshRef.current = mesh
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    puffs.forEach(([x, y, z, sx, sy, sz], i) => {
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }

  // 그룹 전체를 아주 천천히 돌림 (구름 하나하나가 아니라 그룹 1개만 움직임)
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: SKY_COLORS.cloudGlow, emissiveIntensity: 0.35, flatShading: true, roughness: 1, fog: false }),
    [],
  )

  useFrame((_, delta) => {
    if (CLOUDS_DRIFT && groupRef.current) groupRef.current.rotation.y += delta * 0.004
    // 시간대에 따라 구름 색 (밤에는 어둡고 덜 빛나게)
    material.color.copy(live.cloud)
    material.emissiveIntensity = 0.35 * (1 - live.stars * 0.85)
  })

  return (
    <group ref={groupRef}>
      <instancedMesh ref={setup} args={[geometry, material, puffs.length]} frustumCulled={false} />
    </group>
  )
}
