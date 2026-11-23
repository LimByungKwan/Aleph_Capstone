import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Matrix4, PlaneGeometry, Vector3 } from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GEO, Instances, mat, seeded } from '../kit.jsx'
import { CHANNELS, PONDS, POND_SURFACE } from './gyeongbokgungLayout.js'

const POND_PLANES = [
  ...PONDS.map(({ x, z, w, d }) => ({ x, z, width: w, depth: d })),
  ...CHANNELS.map(([x, z, width, depth]) => ({ x, z, width, depth })),
]
const AQUATIC = mat('#fff', { roughness: 0.79 })
const PETALS = mat('#fff', { emissive: '#5e4831', emissiveIntensity: 0.16 })

const pondShader = {
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: new Matrix4() },
    time: { value: 0 }, ready: { value: 0 }, rippleStrength: { value: 1 },
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
    uniform float rippleStrength;
    varying vec2 vPond;
    varying vec4 vReflection;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      float waves = sin(vPond.x * 2.6 + vPond.y * 1.2 + time * 1.4);
      float ripples = cos(vPond.y * 4.2 - time * 1.8 + waves * 0.72);
      vec2 uv = vReflection.xy / max(vReflection.w, 0.0001);
      vec3 reflected = texture2D(tDiffuse, clamp(uv + vec2(waves, ripples) * 0.003 * rippleStrength, 0.002, 0.998)).rgb;
      float east = step(0.0, vPond.x);
      vec3 water = mix(vec3(0.027,0.155,0.184), vec3(0.075,0.137,0.107), east);
      vec3 surface = mix(water, reflected * vec3(0.84,0.91,0.86), ready * 0.69);
      surface += mix(vec3(0.05,0.11,0.13), vec3(0.14,0.084,0.032), east) * pow(0.5 + 0.5 * ripples, 8.0) * 0.28 * rippleStrength;
      gl_FragColor = vec4(surface, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
}

function PalacePondWater() {
  const mirror = useMemo(() => {
    const pieces = POND_PLANES.map(({ x, z, width, depth }) =>
      new PlaneGeometry(width, depth).translate(x, -z, 0))
    const geometry = mergeGeometries(pieces)
    pieces.forEach((piece) => piece.dispose())
    const surface = new Reflector(geometry, {
      textureWidth: 384, textureHeight: 256, clipBias: 0.003, multisample: 0, shader: pondShader,
    })
    const reflect = surface.onBeforeRender.bind(surface)
    const origin = new Vector3(), viewer = new Vector3()
    let lastUpdate = -Infinity
    surface.position.y = POND_SURFACE
    surface.rotation.x = -Math.PI / 2
    surface.userData.noShadow = true
    surface.material.uniforms.rippleStrength.value = .36
    // 멀리서 볼 때는 물결 색만 표시합니다.
    surface.onBeforeRender = (renderer, scene, camera) => {
      if (renderer.getRenderTarget() !== null) return
      viewer.setFromMatrixPosition(camera.matrixWorld)
      const nearby = PONDS.some(({ x, z }) =>
        origin.set(x, -z, 0).applyMatrix4(surface.matrixWorld).distanceToSquared(viewer) < 35 ** 2)
      const uniforms = surface.material.uniforms
      if (!nearby) {
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

export function GyeongbokgungWater() {
  const { leaves, flowers } = useMemo(() => {
    const rng = seeded(491)
    const leaves = [], flowers = []
    for (const [cx, cz, count] of [[-35.6,-18.4,23],[-35.5,-5.5,22],[-22.55,-18.25,18],[-23.3,-5.75,17]]) {
      for (let i = 0; i < count; i += 1) {
        const x = cx + (rng() - .5) * 3.4
        const z = cz + (rng() - .5) * 2.7
        const size = .08 + rng() * .13
        leaves.push({ p: [x, POND_SURFACE + .016 + (i % 7) * .001, z],
          s: [size, .017, size * .87], r: [0, rng() * Math.PI, 0],
          c: ['#64784b', '#819052', '#446152', '#556d39'][i % 4] })
        if (i % 6 === 0) flowers.push({ p: [x, POND_SURFACE + .055, z], s: [.085, .043, .084], c: '#e5bfaa' })
      }
    }
    return { leaves, flowers }
  }, [])
  return (
    <>
      <PalacePondWater />
      <Instances geometry={GEO.cyl8} material={AQUATIC} items={leaves} />
      <Instances geometry={GEO.sphere} material={PETALS} items={flowers} />
    </>
  )
}
