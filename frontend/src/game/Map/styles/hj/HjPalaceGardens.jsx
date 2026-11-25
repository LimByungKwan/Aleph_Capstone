import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Matrix4, PlaneGeometry, Vector3 } from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Ball, Box, Cyl, GEO, Instances, mat, seeded } from '../kit.jsx'

const WATER_LEVEL = 0.206
const REFLECTION_DISTANCE = 53
const STONE = '#b5ac96'
const GOLDEN = mat('#ffe7a7', { emissive: '#ffba66', emissiveIntensity: 0.73 })
const PARTS = mat('#ffffff', { roughness: 0.86 })
const PONDS = [
  { x: -14.55, z: -14.1, width: 15, depth: 11.6, bridgeSide: 1 },
  { x: 15.4, z: 4.5, width: 13.2, depth: 12.2, bridgeSide: -1 },
]
const pondShader = {
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: new Matrix4() },
    time: { value: 0 }, ready: { value: 0 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vReflection;
    varying vec2 vPond;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vPond = position.xy;
      vReflection = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float ready;
    varying vec2 vPond;
    varying vec4 vReflection;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      float waves = sin(vPond.x * 2.6 + vPond.y * 1.2 + time * 1.4);
      float ripples = cos(vPond.y * 4.2 - time * 1.8 + waves * 0.72);
      vec2 uv = vReflection.xy / max(vReflection.w, 0.0001);
      vec3 reflected = texture2D(tDiffuse, clamp(uv + vec2(waves, ripples) * 0.003, 0.002, 0.998)).rgb;
      float east = step(0.0, vPond.x);
      vec3 water = mix(vec3(0.027,0.155,0.184), vec3(0.075,0.137,0.107), east);
      vec3 surface = mix(water, reflected * vec3(0.84,0.91,0.86), ready * 0.69);
      surface += mix(vec3(0.05,0.11,0.13), vec3(0.14,0.084,0.032), east) * pow(0.5 + 0.5 * ripples, 8.0) * 0.28;
      gl_FragColor = vec4(surface, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
}

function PalacePondWater() {
  const mirror = useMemo(() => {
    const pieces = PONDS.map(({ x, z, width, depth }) =>
      new PlaneGeometry(width, depth).translate(x, -z, 0))
    const geometry = mergeGeometries(pieces)
    pieces.forEach((piece) => piece.dispose())
    const surface = new Reflector(geometry, {
      textureWidth: 384, textureHeight: 256, clipBias: 0.003, multisample: 0, shader: pondShader,
    })
    const reflect = surface.onBeforeRender.bind(surface)
    const origin = new Vector3(), viewer = new Vector3()
    let lastUpdate = -Infinity
    surface.position.y = WATER_LEVEL
    surface.rotation.x = -Math.PI / 2
    surface.userData.noShadow = true
    // Both ponds share the same reflection pass. Wide map views use the rippled base color.
    surface.onBeforeRender = (renderer, scene, camera) => {
      origin.setFromMatrixPosition(surface.matrixWorld)
      viewer.setFromMatrixPosition(camera.matrixWorld)
      const uniforms = surface.material.uniforms
      if (origin.distanceToSquared(viewer) > REFLECTION_DISTANCE ** 2) {
        uniforms.ready.value = 0
        lastUpdate = -Infinity
        return
      }
      if (uniforms.time.value - lastUpdate < 1 / 14) return
      reflect(renderer, scene, camera)
      uniforms.ready.value = 1
      lastUpdate = uniforms.time.value
    }
    return surface
  }, [])
  useFrame(({ clock }) => { mirror.material.uniforms.time.value = clock.elapsedTime })
  useEffect(() => () => { mirror.geometry.dispose(); mirror.dispose() }, [mirror])
  return <primitive object={mirror} />
}

function PondEdges({ x, z, width, depth, bridgeSide }) {
  const parts = useMemo(() => {
    const pieces = []
    function wall(cx, cz, length, alongX) {
      const count = Math.ceil(length / 0.52)
      const step = length / count
      for (let i = 0; i < count; i += 1) {
        const offset = (i + 0.5) * step - length / 2
        const p = [cx + (alongX ? offset : 0), 0.295, cz + (alongX ? 0 : offset)]
        pieces.push({ p, s: alongX ? [step - 0.03, 0.24, 0.31] : [0.31, 0.24, step - 0.03],
          c: ['#b2a68f', '#cac1ac', '#9d9686'][i % 3] })
        if (i % 3 === 1) pieces.push({ p: [p[0], 0.52, p[2]], s: [0.17, 0.26, 0.17], c: '#c9c4b1' })
      }
      pieces.push({ p: [cx, 0.66, cz], s: alongX ? [length, 0.10, 0.185] : [0.185, 0.10, length], c: '#d1c9b6' })
    }
    wall(x, z - depth / 2, width, true)
    wall(x, z + depth / 2, width, true)
    for (const side of [-1, 1]) {
      const edgeX = x + side * width / 2
      if (side === bridgeSide) {
        const span = (depth - 2.36) / 2
        for (const end of [-1, 1]) wall(edgeX, z + end * (1.18 + span / 2), span, false)
      } else wall(edgeX, z, depth, false)
    }
    return pieces
  }, [x, z, width, depth, bridgeSide])
  return <Instances geometry={GEO.box} material={PARTS} items={parts} />
}

function GardenPine({ position, size = 1 }) {
  return (
    <group position={position} scale={size}>
      <Cyl p={[0, 1.55, 0]} rad={0.18} h={3.1} c="#635342" geo={GEO.cyl8} r={[0, 0, -0.16]} />
      <Cyl p={[-0.53, 2.40, 0.18]} rad={0.095} h={1.4} c="#625444" geo={GEO.cyl8} r={[0.24, 0, 0.64]} />
      <Ball p={[0.46, 3.13, 0]} c="#354f36" s={[1.6, 0.37, 0.93]} />
      <Ball p={[-0.94, 2.73, 0.19]} c="#45623c" s={[1.08, 0.31, 0.84]} />
      <Ball p={[0.14, 3.73, -0.29]} c="#294d38" s={[1.18, 0.38, 0.99]} />
    </group>
  )
}

export function PalaceGardens({ Pavilion }) {
  const pads = useMemo(() => {
    const rng = seeded(827)
    return Array.from({ length: 42 }, (_, i) => {
      const x = (i < 21 ? -10.1 : 20.32) + (rng() - 0.5) * 1.82
      const z = (i < 21 ? -10.12 : 8.17) + (rng() - 0.5) * 2.05
      const radius = 0.085 + rng() * 0.19
      return { p: [x, WATER_LEVEL + 0.023 + i * 0.0004, z], s: [radius, 0.023, radius * 0.87],
        c: i % 5 ? '#617a3a' : '#ce9c83' }
    })
  }, [])
  return (
    <>
      <PalacePondWater />
      {PONDS.map((pond) => <PondEdges key={pond.x} {...pond} />)}
      <Instances geometry={GEO.cyl8} material={PARTS} items={pads} />
      <Box p={[-15.8, 0.195, -14.26]} s={[8.8, 0.37, 6.9]} c={STONE} />
      <Box p={[-9.15, 0.247, -14.1]} s={[5.22, 0.25, 2.16]} c="#cabfa9" />
      <Box p={[-6.25, 0.212, -14.1]} s={[0.65, 0.115, 2.16]} c="#c2b79f" />
      <Pavilion position={[-15.8, 0.39, -14.26]} width={7.5} depth={5.55} height={2.74}
        open upper ornate title="경회루" />
      {[-1, 1].map(side => <Box key={side} p={[-9.15, 0.68, -14.1 + side * 1.02]}
        s={[5.12, 0.11, 0.10]} c="#d0c6ac" />)}
      <Cyl p={[16.2, 0.19, 4.5]} rad={2.68} h={0.39} c="#8d8a75" geo={GEO.cyl8} />
      <Cyl p={[16.2, 0.389, 4.5]} rad={2.61} h={0.052} c="#7b8655" geo={GEO.cyl8} />
      <Pavilion position={[16.2, 0.42, 4.5]} width={4.35} depth={3.6} height={2.21}
        open upper ornate title="향원정" />
      <Box p={[14.0, 0.24, 14.67]} s={[7.6, 0.16, 4.7]} c={STONE} />
      <Pavilion position={[14, 0.31, 14.67]} width={5.8} depth={4.1} height={2.82} ornate title="자경전" />
      <Cyl p={[-20.35, 0.168, -10.64]} rad={1.1} h={0.26} c="#85866a" geo={GEO.cyl8} />
      <GardenPine position={[-20.35, 0.26, -10.64]} size={0.85} />
      <Cyl p={[20.8, 0.17, 0.85]} rad={1.02} h={0.29} c="#848575" geo={GEO.cyl8} />
      <GardenPine position={[20.51, 0.28, 0.85]} size={0.75} />
      <GardenPine position={[19.96, 0.18, 12.68]} size={0.9} />
      <GardenPine position={[7.37, 0.17, 16.45]} size={0.79} />
      <Box p={[-15.8, 1.92, -14.26]} s={[0.46, 0.42, 0.46]} m={GOLDEN} />
      <Box p={[16.2, 1.77, 4.5]} s={[0.31, 0.36, 0.31]} m={GOLDEN} />
      <pointLight position={[-14.8, 2.18, -12.5]} intensity={25} color="#ffd49a" distance={9} />
    </>
  )
}
