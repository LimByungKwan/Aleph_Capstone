import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GEO, Instances } from '../kit.jsx'

// [3. 개발 > 프론트엔드] 경복궁 바닥 돌 (혜진 영화·드라마 구역) — 사진 기반
//  - 박석: 근정전 마당. 크기·모양이 제각각인 넓적한 화강암 판석, 줄눈에 흙과 풀, 돌마다 색이 조금씩 달라요
//  - 포석: 마당·길. 네모난 화강석을 줄마다 엇갈려 깐 바닥, 모래색 줄눈
//  - 삼도: 광화문 → 근정전 가운데 길. 긴 장대석 테두리로 나뉜 세 길 (가운데 어도가 조금 높아요)
// 그림은 이미지 파일 없이 캔버스에 그리고, 돌 높낮이(요철)는 노멀맵으로 줘서 빛을 받으면 울퉁불퉁해 보여요.
// 무늬는 이어 붙여도 이음매가 안 보이게(타일링) 그려요. 바닥 좌표(월드 x, z)로 무늬를 깔아서 조각끼리 무늬가 이어져요.

const cache = new Map()
const rand = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 색(RGBA)과 높이(0~1)를 받아 색 텍스처 + 노멀맵을 만들어요
function makeTextures(key, size, paint) {
  if (cache.has(key)) return cache.get(key)
  if (typeof document === 'undefined') return null
  const color = new Uint8ClampedArray(size * size * 4)
  const height = new Float32Array(size * size)
  paint(color, height, size)
  const toTexture = (data, srgb) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.putImageData(new ImageData(data, size, size), 0, 0)
    const t = new THREE.CanvasTexture(canvas)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    return t
  }
  // 높이 → 노멀 (이웃 칸 기울기, 가장자리는 반대편과 이어 계산 = 타일링)
  const normal = new Uint8ClampedArray(size * size * 4)
  const H = (x, y) => height[((y + size) % size) * size + ((x + size) % size)]
  const strength = 3.2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      normal[i] = (-dx / len) * 127.5 + 127.5
      normal[i + 1] = (dy / len) * 127.5 + 127.5
      normal[i + 2] = (1 / len) * 127.5 + 127.5
      normal[i + 3] = 255
    }
  }
  const out = { map: toTexture(color, true), normalMap: toTexture(normal, false) }
  cache.set(key, out)
  return out
}

// 화강암 점박이 (검은·흰 알갱이) + 돌 하나의 밑색
function granite(r, base, x, y, warm) {
  const n = r()
  let v = base + (n - 0.5) * 18
  if (n < 0.05) v -= 55 // 검은 운모
  else if (n > 0.97) v += 30 // 흰 장석
  return [v + warm, v + warm * 0.4, v - warm * 0.6]
}

// ── 박석: 보로노이(가장 가까운 점)로 나눈 불규칙 판석 ──
function bakseok() {
  return makeTextures('bakseok-v3', 768, (color, height, size) => {
    const r = rand(9)
    const G = 6 // 한 장(5m)에 6×6 판석 → 판석 하나 약 0.85m
    const cell = size / G
    const sites = []
    for (let gy = 0; gy < G; gy += 1) {
      for (let gx = 0; gx < G; gx += 1) {
        sites.push({
          x: (gx + 0.15 + r() * 0.7) * cell,
          y: (gy + 0.15 + r() * 0.7) * cell,
          tone: 150 + r() * 45,
          warm: (r() - 0.4) * 14,
          tx: (r() - 0.5) * 0.25, // 판석 기울기 (요철)
          ty: (r() - 0.5) * 0.25,
          joint: 2 + r() * 2.5, // 줄눈 폭 (px, 1px ≈ 0.65cm)
        })
      }
    }
    const pr = rand(41)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const gx = Math.floor(x / cell)
        const gy = Math.floor(y / cell)
        let d1 = 1e9
        let d2 = 1e9
        let best = null
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const cx = (gx + ox + G) % G
            const cy = (gy + oy + G) % G
            const s = sites[cy * G + cx]
            // 타일링: 이웃 칸이 반대편으로 넘어가면 좌표를 옮겨 계산
            const sx = s.x + (gx + ox < 0 ? -size : gx + ox >= G ? size : 0)
            const sy = s.y + (gy + oy < 0 ? -size : gy + oy >= G ? size : 0)
            const d = Math.hypot(x - sx, y - sy)
            if (d < d1) {
              d2 = d1
              d1 = d
              best = { s, sx, sy }
            } else if (d < d2) d2 = d
          }
        }
        const edge = (d2 - d1) / 2 // 경계까지 거리 (px)
        const i = (y * size + x) * 4
        const k = y * size + x
        const s = best.s
        if (edge < s.joint) {
          // 줄눈: 흙 + 군데군데 풀
          const grass = pr() < 0.35 && ((x * 7 + y * 13) % 11) < 5
          const c = grass ? [78 + pr() * 30, 110 + pr() * 35, 52 + pr() * 18] : [92 + pr() * 22, 86 + pr() * 18, 70 + pr() * 14]
          color.set([...c, 255], i)
          height[k] = 0.05 + (grass ? 0.15 : 0)
        } else {
          const [cr, cg, cb] = granite(pr, s.tone - Math.max(0, 8 - edge) * 2.5, x, y, s.warm)
          color.set([cr, cg, cb, 255], i)
          // 판석: 가장자리가 둥글게 깎이고, 판석마다 살짝 기울어 있어요
          const bevel = Math.min(1, (edge - s.joint) / 10)
          height[k] = 0.55 + 0.4 * bevel + s.tx * ((x - best.sx) / cell) + s.ty * ((y - best.sy) / cell) + (pr() - 0.5) * 0.04
        }
      }
    }
  })
}

// ── 포석: 네모난 화강석을 줄마다 엇갈려 깐 바닥 (1장 = 3m) ──
function paver() {
  return makeTextures('paver-v2', 768, (color, height, size) => {
    const r = rand(5)
    const pr = rand(77)
    const rows = 9 // 한 줄 약 0.33m (사진처럼 두툼한 돌)
    const rowH = size / rows
    const joint = 3.5
    // 줄마다 돌 길이를 정해 두고(합 = size), 시작 위치를 엇갈려요
    const layout = []
    for (let row = 0; row < rows; row += 1) {
      const stones = []
      let x = 0
      while (x < size) {
        let len = rowH * (1.3 + r() * 0.8)
        if (size - x - len < rowH * 1.2) len = size - x
        stones.push({ x0: x, x1: x + len, tone: 172 + r() * 34, warm: 4 + r() * 12 })
        x += len
      }
      layout.push({ shift: r() * size, stones })
    }
    for (let y = 0; y < size; y += 1) {
      const row = Math.floor(y / rowH)
      const ly = y - row * rowH
      const L = layout[row]
      for (let x = 0; x < size; x += 1) {
        const sx = (x + L.shift) % size
        const st = L.stones.find((s) => sx >= s.x0 && sx < s.x1) ?? L.stones[0]
        const ex = Math.min(sx - st.x0, st.x1 - sx)
        const ey = Math.min(ly, rowH - ly)
        const edge = Math.min(ex, ey)
        const i = (y * size + x) * 4
        const k = y * size + x
        if (edge < joint) {
          const t = 150 + pr() * 30 // 모래색 줄눈
          color.set([t + 20, t + 6, t - 25, 255], i)
          height[k] = 0.1
        } else {
          const [cr, cg, cb] = granite(pr, st.tone - Math.max(0, 6 - edge) * 3, x, y, st.warm)
          color.set([cr, cg, cb, 255], i)
          height[k] = 0.6 + 0.35 * Math.min(1, (edge - joint) / 8) + (pr() - 0.5) * 0.05
        }
      }
    }
  })
}

// 네모 조각들 → 하나의 바닥 면 (무늬는 월드 좌표 기준이라 조각끼리 이어져요)
function rectsGeometry(rects, y, tile) {
  const pos = []
  const uv = []
  const idx = []
  for (const [x0, x1, z0, z1] of rects) {
    const b = pos.length / 3
    for (const [x, z] of [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]) {
      pos.push(x, y, z)
      uv.push(x / tile, -z / tile)
    }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

function stoneMaterial(kind) {
  const tex = kind === 'bakseok' ? bakseok() : paver()
  if (!tex?.map) return new THREE.MeshStandardMaterial({ color: kind === 'bakseok' ? '#b9b4a6' : '#c9bfa8', roughness: 0.95 })
  return new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.93 })
}

/**
 * 돌 바닥 깔기
 * @param kind 'bakseok'(불규칙 판석) | 'paver'(네모 포석)
 * @param rects [[x0, x1, z0, z1], …] (이 컴포넌트를 넣은 그룹 좌표)
 * @param y 높이, tile 무늬 한 장 크기(m)
 */
export function StoneFloor({ kind, rects, y, tile = kind === 'bakseok' ? 5 : 3 }) {
  const geometry = useMemo(() => rectsGeometry(rects, y, tile), [rects, y, tile])
  const material = useMemo(() => stoneMaterial(kind), [kind])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} receiveShadow />
}

// ── 삼도: 긴 장대석 테두리 + 가운데 어도(높게)·양옆 신하 길 ──
const CURB = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })
export function Samdo({ z0, z1, y = 0.17 }) {
  const lanes = useMemo(
    () => ({
      center: [[-0.85, 0.85, z0, z1]],
      sides: [
        [-2.25, -0.95, z0, z1],
        [0.95, 2.25, z0, z1],
      ],
    }),
    [z0, z1],
  )
  // 테두리 장대석: 길이 1.2~2m짜리 돌을 이어 놓은 모습 (돌 사이 이음 줄)
  const curbs = useMemo(() => {
    const list = []
    for (const x of [-0.9, 0.9, -2.3, 2.3]) {
      const high = Math.abs(x) < 1
      let z = z0
      let n = 0
      while (z < z1 - 0.05) {
        const l = Math.min(z1 - z, 1.2 + ((n * 37) % 9) / 10)
        list.push({ p: [x, y + (high ? 0.05 : 0.035), z + l / 2], s: [0.12, high ? 0.1 : 0.07, l - 0.02], c: n % 3 ? '#d3ccbb' : '#c7c0ae' })
        z += l
        n += 1
      }
    }
    return list
  }, [z0, z1, y])
  return (
    <group>
      <StoneFloor kind="paver" rects={lanes.center} y={y + 0.06} tile={2.4} />
      <StoneFloor kind="paver" rects={lanes.sides} y={y + 0.03} tile={2.4} />
      <Instances geometry={GEO.box} material={CURB} items={curbs} />
    </group>
  )
}
