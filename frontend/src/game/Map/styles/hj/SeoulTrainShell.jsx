import * as THREE from 'three'

// Longitudinal sections: distance from car centre, half-width, sill and crown.
const sections = [
  [3.9, 1.50, .63, 3.76], [4.6, 1.49, .63, 3.70],
  [5.25, 1.47, .63, 3.50], [6.05, 1.43, .63, 3.04],
  [6.85, 1.36, .65, 2.52], [7.50, 1.24, .70, 2.25],
  [7.88, .99, .78, 2.10], [8.08, .65, .88, 1.99],
  [8.16, .01, 1.21, 1.64], [8.17, 0, 1.42, 1.42],
]
const metal = (color, metalness = .22) => new THREE.MeshStandardMaterial({
  color, metalness, roughness: .32, side: THREE.DoubleSide,
})
const paint = metal('#99afc9')
const skirt = metal('#566b83')
const trim = metal('#192734')
const canopy = metal('#263647')
const windscreen = metal('#526d83', .37)
const glass = new THREE.MeshStandardMaterial({
  color: '#43637c', transparent: true, opacity: .49,
  side: THREE.DoubleSide, roughness: .16, depthWrite: false,
})
const lamp = new THREE.MeshBasicMaterial({ color: '#fff5d4' })

function surface(cab, z, degrees, offset) {
  let [, width, bottom, top] = sections[0]
  if (cab && z > sections[0][0]) {
    const i = sections.findIndex(row => row[0] >= z)
    const next = sections[i < 0 ? sections.length - 1 : i]
    const prev = sections[Math.max(0, sections.indexOf(next) - 1)]
    const t = (z - prev[0]) / (next[0] - prev[0])
    width = THREE.MathUtils.lerp(prev[1], next[1], t)
    bottom = THREE.MathUtils.lerp(prev[2], next[2], t)
    top = THREE.MathUtils.lerp(prev[3], next[3], t)
  }
  const rad = degrees * Math.PI / 180
  const power = v => Math.sign(v) * Math.pow(Math.abs(v), .52)
  return [(width + offset) * power(Math.sin(rad)),
    (bottom + top) / 2 + ((top - bottom) / 2 + offset) * power(Math.cos(rad)), z]
}

// Batch patches by finish, including glazing and fittings, to keep draw calls low.
function buildShell(cab) {
  const batches = new Map()
  function patch(material, z0, z1, a0, a1, offset = 0, shift = 0) {
    if (!batches.has(material)) batches.set(material, { vertices: [], indices: [] })
    const { vertices, indices } = batches.get(material)
    const zs = [z0, ...sections.map(row => row[0]).filter(z => cab && z > z0 && z < z1), z1]
    const steps = Math.max(1, Math.ceil(Math.abs(a1-a0) / 7))
    const base = vertices.length / 3
    zs.forEach((z, row) => {
      for (let col = 0; col <= steps; col++) {
        const angle = a0 + (a1-a0) * col / steps + shift * (z-z0)/(z1-z0)
        vertices.push(...surface(cab, z, angle, offset))
        if (!row || !col) continue
        const d = base + row*(steps+1) + col
        const a = d - steps - 2
        indices.push(a, d-1, d, a, d, a+1)
      }
    })
  }
  const end = cab ? 3.9 : 8
  patch(paint, -8, end, -85, 85)
  patch(paint, -8, end, 98, 262)
  for (const side of [-1, 1]) {
    const band = (m, z0, z1, a, b, lift=0) =>
      patch(m, z0, z1, side > 0 ? a : -b, side > 0 ? b : -a, lift)
    band(trim,-8,end,83,85,.006)
    band(trim,-8,end,98,100,.006)
    band(skirt,-8,end,115,140,.008)
    const count = cab ? 9 : 12
    for (let i=0; i<count; i++) {
      const start = -8 + (end+8)*i/count
      const stop = -8 + (end+8)*(i+1)/count
      band(glass,start+.055,stop-.055,85,98)
      band(trim,start,start+.055,85,98)
      band(trim,stop-.055,stop,85,98)
    }
    for (const edge of [-7.8,-6.72]) band(trim,edge,edge+.025,79,114,.012)
    band(trim,-7.8,-6.7,113,114,.012)
    band(trim,-7.0,-6.84,101,102,.014)
  }
  if (cab) {
    patch(paint,end,8.17,-180,180)
    patch(canopy,end,6.78,-84,84,.012)
    patch(windscreen,4.65,6.26,-48,48,.034)
    for (const side of [-1,1]) {
      const angle = side * 32
      patch(trim,5.57,6.17,angle-1,angle+1,.06,-side*20)
      patch(trim,6.42,6.75,side*59-6,side*59+6,.033)
      patch(lamp,6.47,6.66,side*59-4,side*59+4,.05)
    }
    patch(lamp,4.32,4.45,-4,4,.04)
    patch(trim,7.49,7.52,-151,151,.014)
    patch(trim,7.51,8.08,-.30,.30,.015)
  }
  return Array.from(batches, ([material,{vertices,indices}]) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return {geometry,material}
  })
}

const bodies = [buildShell(false), buildShell(true)]
export function SeoulTrainShell({cab}) {
  return <group dispose={null}>{bodies[Number(cab)].map(({geometry,material}) => (
    <mesh key={material.uuid} geometry={geometry} material={material} />
  ))}</group>
}
