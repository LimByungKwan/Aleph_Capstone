import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSeason } from '../seasons.js'

// [3. 개발 > 프론트엔드] 계절 날씨 (봄 꽃잎 · 가을 낙엽 · 겨울 눈) — 혜진
// 1) 지붕 가림: 1초마다 캐릭터 주변(64m)을 위에서 내려다본 "가장 높은 면의 높이"를 작은 그림(높이 지도)으로 찍어요.
//    눈·꽃잎·낙엽은 그 높이보다 아래로 내려가면 사라져요 → 지붕·처마·나무를 뚫고 건물 안으로 들어오지 않아요.
// 2) 눈 쌓이기: 겨울에는 시간이 지날수록 하늘을 향한 면(땅·지붕·담장 위)이 하얗게 덮여요.
//    같은 높이 지도로 "지붕 아래 바닥"은 빼서, 건물 안 마루에는 눈이 쌓이지 않아요. 다른 계절이 되면 천천히 녹아요.

const WEATHER = {
  spring: { count: 70, size: 0.16, color: '#f5afc8', speed: 0.65 },
  autumn: { count: 70, size: 0.2, color: '#c87331', speed: 1.1 },
  winter: { count: 160, size: 0.14, color: '#ffffff', speed: 0.95 },
}

// ── 높이 지도 (모든 날씨·눈 재질이 함께 씀) ──
const COVER = {
  size: 64, // m (캐릭터 중심 정사각형)
  res: 160, // 픽셀
  top: 45, // 카메라 높이 (이보다 높은 구름·하늘은 빼요)
  range: 47, // 카메라에서 아래로 볼 깊이 → y -2 까지
}
const uniforms = {
  snowAmount: { value: 0 },
  snowCoverTex: { value: null },
  snowCover: { value: new THREE.Vector3(0, 0, COVER.size) }, // (중심 x, 중심 z, 크기)
  snowRange: { value: new THREE.Vector2(COVER.top, COVER.range) },
}
// 0~0.85, 겨울에 점점 늘고 다른 계절엔 녹아요. 시연용: 주소에 ?season=winter&snow=full 이면 처음부터 쌓인 채로
let snowAmount = new URLSearchParams(globalThis.location?.search).get('snow') === 'full' ? 0.85 : 0

export default function SeasonalWeather({ playerRef }) {
  const season = useSeason()
  const weather = WEATHER[season]
  return (
    <>
      <CoverMap playerRef={playerRef} active={Boolean(weather) || season === 'winter'} />
      <SnowLayer winter={season === 'winter'} />
      {weather && <FallingParticles key={season} weather={weather} playerRef={playerRef} />}
    </>
  )
}

// 위에서 내려다본 높이 지도 찍기 (깊이를 RGBA에 담아요)
function CoverMap({ playerRef, active }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const { target, camera, depthMat } = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(COVER.res, COVER.res, { depthBuffer: true })
    t.texture.minFilter = THREE.NearestFilter
    t.texture.magFilter = THREE.NearestFilter
    const half = COVER.size / 2
    const c = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, COVER.range)
    c.up.set(0, 0, -1) // 화면 위쪽 = 북쪽(-z)
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
    return { target: t, camera: c, depthMat: m }
  }, [])
  useEffect(() => {
    uniforms.snowCoverTex.value = target.texture
    return () => {
      target.dispose()
      depthMat.dispose()
    }
  }, [target, depthMat])
  const last = useRef({ t: -10, x: 1e9, z: 1e9 })
  // 찍을 때 숨길 것(하늘·입자·투명) 목록은 장면 전체를 훑어야 해서 비싸요 → 12초마다만 새로 모아요
  const skipList = useRef({ t: -100, list: [] })

  useFrame(({ clock }) => {
    // 날씨(눈·꽃잎·낙엽)가 없고 눈도 안 쌓였으면 높이 지도가 필요 없어요
    if (!active && snowAmount <= 0) return
    const p = playerRef.current?.currPos
    if (!p) return
    const L = last.current
    const moved = Math.hypot(p.x - L.x, p.z - L.z)
    // 지도는 64m 크기라 14m 안쪽으로 움직일 땐 2.5초마다만 다시 찍어도 충분해요 (장면 전체를 한 번 더 그리는 일이라 자주 하면 끊겨요)
    if (clock.elapsedTime - L.t < 2.5 && moved < 14) return
    L.t = clock.elapsedTime
    // 높이 지도 칸에 맞춰 중심을 끊어서(떨림 방지) 옮겨요
    const cell = COVER.size / COVER.res
    const cx = Math.round(p.x / cell) * cell
    const cz = Math.round(p.z / cell) * cell
    L.x = cx
    L.z = cz
    camera.position.set(cx, COVER.top, cz)
    camera.lookAt(cx, 0, cz)
    camera.updateMatrixWorld()
    // 하늘·구름·날리는 입자·투명한 것은 빼고 찍어요 (그게 "지붕"이 되면 안 되니까)
    const S = skipList.current
    if (clock.elapsedTime - S.t > 12) {
      S.t = clock.elapsedTime
      S.list.length = 0
      scene.traverse((o) => {
        const m = o.material
        const skip =
          o.isPoints ||
          o.isSprite ||
          o.isLine ||
          (m && !Array.isArray(m) && (m.isShaderMaterial || m.fog === false || (m.transparent && m.opacity < 0.95) || m.colorWrite === false))
        if (skip) S.list.push(o)
      })
    }
    const hidden = []
    for (const o of S.list) {
      if (!o.visible) continue
      o.visible = false
      hidden.push(o)
    }
    const prevTarget = gl.getRenderTarget()
    const prevOverride = scene.overrideMaterial
    const prevBg = scene.background
    const prevFog = scene.fog
    scene.overrideMaterial = depthMat
    scene.background = null
    scene.fog = null
    gl.setRenderTarget(target)
    gl.setClearColor(0xffffff, 1) // 아무것도 없으면 깊이 1 = 가장 낮음
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(prevTarget)
    scene.overrideMaterial = prevOverride
    scene.background = prevBg
    scene.fog = prevFog
    for (const o of hidden) o.visible = true
    uniforms.snowCover.value.set(cx, cz, COVER.size)
  })
  return null
}

// GLSL: 높이 지도에서 그 자리의 "가장 높은 면" 높이 (지도 밖이면 아주 낮게 = 가림 없음)
const COVER_GLSL = /* glsl */ `
uniform sampler2D snowCoverTex;
uniform vec3 snowCover;
uniform vec2 snowRange;
// RGBA에 담긴 깊이 풀기 (three의 RGBADepthPacking과 같은 계산)
float snowUnpackDepth(vec4 v) {
  return dot(v, vec4(255.0 / 256.0, 255.0 / 256.0 / 256.0, 255.0 / 256.0 / 65536.0, 1.0 / 16777216.0));
}
float coverTopAt(vec3 wp) {
  vec2 uv = vec2((wp.x - snowCover.x) / snowCover.z + 0.5, 0.5 - (wp.z - snowCover.y) / snowCover.z);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return -1000.0;
  float d = snowUnpackDepth(texture2D(snowCoverTex, uv));
  return snowRange.x - d * snowRange.y;
}
`

// ── 날리는 눈·꽃잎·낙엽 (지붕 아래로는 안 내려와요) ──
function FallingParticles({ playerRef, weather }) {
  const points = useRef(null)
  const { count, size, color, speed } = weather
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const seeds = useMemo(() => Float32Array.from({ length: count * 3 }, () => Math.random()), [count])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          color: { value: new THREE.Color(color) },
          size: { value: size },
          scale: { value: 400 },
          snowCoverTex: uniforms.snowCoverTex,
          snowCover: uniforms.snowCover,
          snowRange: uniforms.snowRange,
        },
        vertexShader: /* glsl */ `
          ${COVER_GLSL}
          uniform float size;
          uniform float scale;
          varying float vHidden;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            // 지붕·처마·나무 아래(가장 높은 면보다 낮은 곳)면 숨겨요
            vHidden = wp.y < coverTopAt(wp.xyz) + 0.05 ? 1.0 : 0.0;
            vec4 mv = viewMatrix * wp;
            gl_Position = projectionMatrix * mv;
            gl_PointSize = vHidden > 0.5 ? 0.0 : size * scale / max(0.1, -mv.z);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 color;
          varying float vHidden;
          void main() {
            if (vHidden > 0.5) discard;
            vec2 c = gl_PointCoord - 0.5;
            if (dot(c, c) > 0.25) discard;
            gl_FragColor = vec4(color, 0.85);
          }
        `,
      }),
    [color, size],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock, size: view, gl }) => {
    const mesh = points.current
    const position = playerRef.current?.currPos
    if (!mesh) return
    mesh.visible = Boolean(position)
    if (!position) return
    material.uniforms.scale.value = (view.height * gl.getPixelRatio()) / 2
    mesh.position.set(position.x, position.y, position.z)
    const time = clock.elapsedTime
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (seeds[index] - 0.5) * 30 + Math.sin(time + index) * 0.8
      positions[index + 1] = 9 - ((time * speed + seeds[index + 1] * 11) % 11)
      positions[index + 2] = (seeds[index + 2] - 0.5) * 30
    }
    mesh.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points} visible={false} frustumCulled={false} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} usage={THREE.DynamicDrawUsage} />
      </bufferGeometry>
    </points>
  )
}

// ── 눈 쌓이기: 하늘을 향한 면 + 지붕 아래가 아닌 곳만 하얗게 ──
// 맵의 일반 재질(MeshStandardMaterial)에 눈 덮기를 조금 덧붙여요 (처음 겨울이 될 때 한 번, 새로 생긴 재질은 3초마다 확인)
function patchMaterial(material) {
  if (material.userData.snowPatched) return
  material.userData.snowPatched = true
  const prev = material.onBeforeCompile
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    shader.uniforms.snowAmount = uniforms.snowAmount
    shader.uniforms.snowCoverTex = uniforms.snowCoverTex
    shader.uniforms.snowCover = uniforms.snowCover
    shader.uniforms.snowRange = uniforms.snowRange
    shader.vertexShader = `varying vec3 vSnowN;\nvarying vec3 vSnowP;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec3 snowN = objectNormal;
      vec4 snowP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        snowN = mat3(instanceMatrix) * snowN;
        snowP = instanceMatrix * snowP;
      #endif
      vSnowN = normalize(mat3(modelMatrix) * snowN);
      vSnowP = (modelMatrix * snowP).xyz;`,
    )
    shader.fragmentShader = `uniform float snowAmount;\nvarying vec3 vSnowN;\nvarying vec3 vSnowP;\n${shader.fragmentShader}`
      .replace('void main() {', `${COVER_GLSL}\nvoid main() {`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (snowAmount > 0.001) {
          float up = smoothstep(0.22, 0.6, normalize(vSnowN).y); // 기와지붕 비탈(약 30~50도)에도 쌓이게
          float open = step(coverTopAt(vSnowP) - 0.3, vSnowP.y); // 지붕 아래가 아님
          float grain = 0.9 + 0.1 * fract(sin(dot(floor(vSnowP.xz * 6.0), vec2(12.9898, 78.233))) * 43758.5453);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0) * grain, snowAmount * up * open);
        }`,
      )
  }
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|snow`
  material.needsUpdate = true
}

function SnowLayer({ winter }) {
  const scene = useThree((s) => s.scene)
  const lastScan = useRef(-10)
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1)
    // 겨울엔 약 2분 30초에 걸쳐 쌓이고, 다른 계절엔 1분쯤에 녹아요
    snowAmount = winter ? Math.min(0.85, snowAmount + dt / 150) : Math.max(0, snowAmount - dt / 60)
    uniforms.snowAmount.value = snowAmount
    if (snowAmount <= 0 || clock.elapsedTime - lastScan.current < 8) return // 장면 전체를 훑으니 8초마다만
    lastScan.current = clock.elapsedTime
    scene.traverse((o) => {
      if (!o.isMesh) return
      const list = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of list) {
        if (m && m.isMeshStandardMaterial && !m.transparent && m.colorWrite !== false) patchMaterial(m)
      }
    })
  })
  return null
}
