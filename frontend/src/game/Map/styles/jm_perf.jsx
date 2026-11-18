import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useSeason } from '../../seasons.js'

// 애니메이션 구역(JM) 렉 줄이기 — 담당: 지민
//
// 문제: 우리 스타일은 부품(기둥·격자 살·대나무 한 줄기…)마다 <mesh>를 따로 써서, 오브젝트 하나가 메시 수십~수백 개가 됨
//       → 그리기 호출이 너무 많음 (측정: 맵 전체 8,692개 중 애니 구역 5,711개, 대나무 울타리 18m 하나 = 150개)
// 해결: 스타일을 그대로 그린 다음, "안 움직이는" 부품을 오브젝트마다 재질별로 한 덩어리 메시로 합침
//       (모양·색은 그대로, 오브젝트 하나 = 재질 수만큼의 메시 몇 개)
// - 원래 메시는 숨겨 두고(그리지 않음) 합친 메시만 그림
// - 계절이 바뀌거나 다시 그려지면 다시 합침
// - 움직이는 부품(공·빗방울·흔들다리 등)이 있는 스타일에는 씌우지 않음 (jm_japanese.jsx의 목록 참고)
// - 원래 부품에 userData.noMerge = true 를 주면 그 부품은 합치지 않음
//
// 공용 파일(Prop.jsx, MapLayout.jsx)은 고치지 않음: 스타일 컴포넌트를 감싸는 방식

const KEEP = ['position', 'normal', 'uv']

// 같은 모양으로 그려지는 재질끼리 묶기 위한 열쇠 (재질 객체는 메시마다 따로 만들어져서 값으로 비교)
function materialKey(m) {
  return [
    m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.flatShading, m.side,
    m.transparent, m.opacity, m.map?.uuid, m.vertexColors, m.roughness, m.metalness, m.depthWrite, m.alphaTest, m.toneMapped, m.wireframe,
  ].join('|')
}

// 거울처럼 뒤집힌(scale -1) 부품은 삼각형 감김 방향을 되돌려야 앞면이 보임
function flipWinding(g) {
  for (const name of KEEP) {
    const a = g.attributes[name]
    if (!a) continue
    const s = a.itemSize
    const arr = a.array
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < s; k++) {
        const t = arr[(i + 1) * s + k]
        arr[(i + 1) * s + k] = arr[(i + 2) * s + k]
        arr[(i + 2) * s + k] = t
      }
    }
    a.needsUpdate = true
  }
}

function prepare(mesh, rel) {
  let g = mesh.geometry
  if (!g?.attributes?.position) return null
  g = g.index ? g.toNonIndexed() : g.clone()
  for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  g.morphAttributes = {}
  g.clearGroups()
  g.applyMatrix4(rel)
  if (rel.determinant() < 0) flipWinding(g)
  return g
}

// 이 메시를 합쳐도 되는지: 스스로 또는 조상 중 하나라도 의도적으로 숨긴 것(visible=false)이 아니어야 함
function shouldMerge(o, root) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.userData.noMerge) return false
  if (!o.visible && !o.userData.__jmMerged) return false
  for (let p = o.parent; p && p !== root; p = p.parent) if (!p.visible || p.userData.noMerge) return false
  return true
}

function rebuild(root, holder) {
  for (const c of [...holder.children]) {
    c.geometry.dispose()
    holder.remove(c)
  }
  root.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const rel = new THREE.Matrix4()
  const groups = new Map()
  root.traverse((o) => {
    if (!shouldMerge(o, root)) return
    rel.multiplyMatrices(inv, o.matrixWorld)
    const g = prepare(o, rel)
    if (!g) return
    const key = materialKey(o.material)
    if (!groups.has(key)) groups.set(key, { material: o.material, list: [], sources: [] })
    const entry = groups.get(key)
    entry.list.push(g)
    entry.sources.push(o)
  })
  for (const { material, list, sources } of groups.values()) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)
    if (list.length > 1) list.forEach((g) => g.dispose())
    if (!merged) continue // 합치기 실패하면 원래 메시를 그대로 둠
    merged.computeBoundingSphere()
    const mesh = new THREE.Mesh(merged, material)
    mesh.matrixAutoUpdate = false
    mesh.receiveShadow = true
    holder.add(mesh)
    for (const s of sources) {
      s.visible = false
      s.userData.__jmMerged = true
    }
  }
}

// 스타일 컴포넌트를 감싸서 정적 부품을 합쳐 그리게 함
export function withMerge(Style) {
  function Merged(props) {
    const root = useRef(null)
    const holder = useRef(null)
    // 계절이 바뀌면 이 래퍼도 다시 그려져서 다시 합침 (안쪽 스타일만 바뀌고 합친 메시가 옛 모양으로 남는 일 방지)
    const season = useSeason()
    useLayoutEffect(() => {
      if (root.current && holder.current) rebuild(root.current, holder.current)
    })
    useLayoutEffect(
      () => () => {
        for (const c of [...(holder.current?.children ?? [])]) c.geometry.dispose()
      },
      [],
    )
    return (
      <>
        <group ref={root}>
          <Style {...props} season={season} />
        </group>
        <group ref={holder} />
      </>
    )
  }
  Merged.displayName = `Merged(${Style.displayName || Style.name})`
  return Merged
}

// 스타일 묶음에 한꺼번에 씌우기 (skip 목록의 스타일은 그대로)
export function mergeStyles(styles, skip) {
  return Object.fromEntries(Object.entries(styles).map(([name, Style]) => [name, skip.has(name) ? Style : withMerge(Style)]))
}
