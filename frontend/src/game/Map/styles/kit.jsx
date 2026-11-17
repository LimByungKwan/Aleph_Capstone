import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

// ── 최적화용 공용 도구 ─────────────────────────
// 1) 재질(material)은 색·옵션이 같으면 하나를 공유 → GPU 메모리·셰이더 전환 감소
// 2) 기본 도형(geometry)은 크기 1짜리 하나를 만들어 scale로 늘려 씀 → 메모리 절약
// 3) 같은 물체가 많으면 <Instances>로 한 번에 그림 → 그리기 호출(draw call) 1번

const materialCache = new Map()

export function mat(
  color,
  { emissive, emissiveIntensity = 1, transparent = false, opacity = 1, roughness = 0.85, metalness = 0, flat = false, double = false } = {},
) {
  const key = [color, emissive, emissiveIntensity, transparent, opacity, roughness, metalness, flat, double].join('|')
  let material = materialCache.get(key)
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      transparent,
      opacity,
      flatShading: flat,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
      ...(emissive && { emissive, emissiveIntensity }),
    })
    materialCache.set(key, material)
  }
  return material
}

// 텍스처가 있는 재질 (텍스처마다 하나씩 공유)
export function texMat(texture, { emissive, emissiveIntensity = 1, transparent = false, double = false } = {}) {
  const key = [texture.uuid, emissive, emissiveIntensity, transparent, double].join('|')
  let material = materialCache.get(key)
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent,
      roughness: 0.85,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
      ...(emissive && { emissive, emissiveMap: texture, emissiveIntensity }),
    })
    materialCache.set(key, material)
  }
  return material
}

// 크기 1짜리 공용 도형
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl48: new THREE.CylinderGeometry(1, 1, 1, 48),
  cone: new THREE.ConeGeometry(1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  ico: new THREE.IcosahedronGeometry(1, 1),
  rock: new THREE.DodecahedronGeometry(1, 0),
  plane: new THREE.PlaneGeometry(1, 1),
}

// 짧게 쓰는 도형 컴포넌트들
// p: 위치, s: 크기, c: 색, m: 재질(직접 지정), r: 회전
export const Box = ({ p, s, c, m, r, ...rest }) => (
  <mesh geometry={GEO.box} material={m ?? mat(c)} position={p} scale={s} rotation={r} {...rest} />
)
export const Cyl = ({ p, rad, h, c, m, r, geo = GEO.cyl, ...rest }) => (
  <mesh geometry={geo} material={m ?? mat(c)} position={p} scale={[rad, h, rad]} rotation={r} {...rest} />
)
export const Cone = ({ p, rad, h, c, m, r, ...rest }) => (
  <mesh geometry={GEO.cone} material={m ?? mat(c)} position={p} scale={[rad, h, rad]} rotation={r} {...rest} />
)
export const Ball = ({ p, rad, c, m, s, ...rest }) => (
  <mesh geometry={GEO.sphere} material={m ?? mat(c)} position={p} scale={s ?? [rad, rad, rad]} {...rest} />
)

// 같은 도형 여러 개를 한 번에 그리기 (InstancedMesh)
// items: [{ p: [x,y,z], s: [sx,sy,sz], r: [rx,ry,rz], c: '#색' }]
// c(색)를 쓰려면 material 색을 흰색('#ffffff')으로 두세요 (색이 곱해짐)
const tmpMatrix = new THREE.Matrix4()
const tmpQuat = new THREE.Quaternion()
const tmpEuler = new THREE.Euler()
const tmpPos = new THREE.Vector3()
const tmpScale = new THREE.Vector3()
const tmpColor = new THREE.Color()

export function Instances({ geometry, material, items, castShadow = false }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((item, i) => {
      tmpEuler.set(...(item.r ?? [0, 0, 0]))
      tmpQuat.setFromEuler(tmpEuler)
      tmpPos.set(...item.p)
      tmpScale.set(...(item.s ?? [1, 1, 1]))
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMatrix)
      if (item.c) mesh.setColorAt(i, tmpColor.set(item.c))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  if (items.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow
      userData={{ noShadow: !castShadow }}
    />
  )
}

// 매번 같은 결과가 나오는 난수 (꽃·자물쇠 배치용)
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 문자열 → 숫자 (id마다 다른 난수 시드)
export function hashString(text = '') {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}
