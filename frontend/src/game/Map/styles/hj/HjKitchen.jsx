import { useMemo } from 'react'
import * as THREE from 'three'
import { GEO, Instances, mat } from '../kit.jsx'
import { kitchenSpots } from './gyeongbokLayout.js'

// [3. 개발 > 프론트엔드] 소주방(수라간) 실내 (혜진 영화·드라마 구역, 사진 기반)
// 뒤벽: 돌 부뚜막 + 아치 아궁이(불빛) + 가마솥 셋·작은 솥, 그 위 돌벽에 국자·주걱 걸이, 나무 시렁(옹기·백자병), 체 걸이
// 오른쪽: 찬장(포개 놓은 놋그릇·나무 그릇·백자병) · 뒤 선반(바구니·달걀·호박·함지) · 마늘·고추 타래
// 가운데: 손질 상(도마·칼·배추·무·당근·호박 바구니) · 앞 오른쪽 붉은 소반 줄(밥그릇)
// 왼쪽: 큰 옹기 독 · 물통 · 뒤주 · 바닥 등롱 · 천장에 매단 하얀 등롱
// 바닥은 짙은 회색 전돌(네모 벽돌). 전각 기준 좌표(앞 -z, 바닥 y0) — 자리 값은 gyeongbokLayout.kitchenSpots

const PARTS = mat('#ffffff', { roughness: 0.85 })
const SHINY = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.15 })
const FIRE = mat('#ff8a3a', { emissive: '#ff6a1a', emissiveIntensity: 1.6 })
const EMBER = mat('#7a2a12', { emissive: '#c2410c', emissiveIntensity: 0.8 })
const LANTERN = mat('#fff4dc', { emissive: '#ffd79a', emissiveIntensity: 0.85 })

const C = {
  stone: '#9a968c',
  stoneDark: '#6f6b63',
  iron: '#24262a',
  wood: '#7a573c',
  woodDark: '#5a3e2b',
  woodLight: '#a8825a',
  onggi: '#5e3a26',
  onggiGlaze: '#3f2a1e',
  white: '#f1ede2',
  brass: '#c9a24a',
  red: '#9e2f25',
  straw: '#c9a66b',
}

const cache = new Map()
function canvasMat(key, size, draw, repeat) {
  const k = `${key}|${repeat.join('x')}`
  if (cache.has(k)) return cache.get(k)
  if (typeof document === 'undefined') return mat('#555')
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return mat('#555')
  draw(ctx, size)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 4
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 })
  cache.set(k, m)
  return m
}

// 짙은 회색 네모 전돌 바닥 (1장 = 1m에 3×3장, 줄눈 밝게)
function tileFloor(rx, rz) {
  return canvasMat('kitchen-tile', 192, (ctx, s) => {
    ctx.fillStyle = '#8c8a86'
    ctx.fillRect(0, 0, s, s)
    const n = 3
    const g = s / n
    let seed = 7
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const v = 70 + r() * 26
        ctx.fillStyle = `rgb(${v},${v - 2},${v - 4})`
        ctx.fillRect(i * g + 2, j * g + 2, g - 4, g - 4)
        for (let k = 0; k < 60; k += 1) {
          const d = (r() - 0.5) * 22
          ctx.fillStyle = `rgba(${v + d},${v + d},${v + d - 3},0.5)`
          ctx.fillRect(i * g + 3 + r() * (g - 8), j * g + 3 + r() * (g - 8), 2, 2)
        }
      }
    }
  }, [rx, rz])
}

// 부뚜막·벽 막돌 (회색 돌 + 흰 회반죽 줄눈)
function rubbleWall(rx, ry) {
  return canvasMat('kitchen-rubble', 256, (ctx, s) => {
    ctx.fillStyle = '#d8d2c4'
    ctx.fillRect(0, 0, s, s)
    let seed = 3
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    let y = 0
    while (y < s) {
      const h = 26 + r() * 22
      let x = -r() * 30
      while (x < s) {
        const w = 34 + r() * 40
        const v = 92 + r() * 50
        ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6)
        else ctx.rect(x + 2, y + 2, w - 4, h - 4)
        ctx.fill()
        x += w
      }
      y += h
    }
  }, [rx, ry])
}

export default function Kitchen({ W2, D2, y0 }) {
  const K = useMemo(() => kitchenSpots(W2, D2), [W2, D2])
  const { boxes, cyls, spheres, shiny, fires, embers, lamps } = useMemo(() => {
    const boxes = []
    const cyls = []
    const spheres = []
    const shiny = []
    const fires = []
    const embers = []
    const lamps = []
    const B = (p, s, c, r) => boxes.push({ p: [p[0], y0 + p[1], p[2]], s, c, r })
    const Cy = (p, rad, h, c, r) => cyls.push({ p: [p[0], y0 + p[1], p[2]], s: [rad, h, rad], c, r })
    const Sp = (p, s, c) => spheres.push({ p: [p[0], y0 + p[1], p[2]], s, c })

    // ── 부뚜막 + 아궁이 + 가마솥 ──
    const { hearth: H } = K
    const hx = (H.x0 + H.x1) / 2
    const hw = H.x1 - H.x0
    const front = H.z - H.d / 2
    B([hx, H.h + 0.03, H.z], [hw + 0.06, 0.06, H.d + 0.06], C.stoneDark) // 윗판 (회반죽 테두리)
    K.pots.forEach(({ x, r }, i) => {
      const big = i < 3
      // 솥 몸통(쇠) + 솥전(넓은 테) + 뚜껑(나무·쇠) + 손잡이
      Cy([x, H.h + 0.1, H.z], r * 0.9, 0.22, C.iron)
      Cy([x, H.h + 0.2, H.z], r * 1.12, 0.035, C.iron)
      Sp([x, H.h + 0.21, H.z], [r * 0.98, r * 0.32, r * 0.98], big ? C.iron : C.brass)
      Cy([x, H.h + 0.21 + r * 0.33, H.z], 0.05, 0.07, big ? C.woodDark : C.brass)
      if (!big) return
      // 아치 아궁이: 어두운 구멍 + 안쪽 불 + 위 장대 돌(이맛돌) + 재받이
      const mw = 0.46
      B([x, 0.24, front - 0.005], [mw, 0.4, 0.04], '#15110f')
      B([x, 0.47, front - 0.03], [mw + 0.22, 0.09, 0.08], C.stone)
      cyls.push({ p: [x, y0 + 0.44, front - 0.006], s: [mw / 2, 0.04, mw / 2], c: '#15110f', r: [Math.PI / 2, 0, 0] }) // 아치 윗부분
      // 불꽃(아궁이 구멍 바로 앞에 겹쳐 보이게) + 바닥 숯불
      fires.push({ p: [x, y0 + 0.14, front - 0.03], s: [mw * 0.62, 0.16, 0.01] })
      fires.push({ p: [x, y0 + 0.24, front - 0.031], s: [mw * 0.34, 0.12, 0.01] })
      embers.push({ p: [x, y0 + 0.05, front - 0.06], s: [mw * 0.8, 0.05, 0.06] })
      for (const dx of [-0.12, 0.05, 0.16]) B([x + dx, 0.06, front - 0.16], [0.42, 0.06, 0.06], C.woodDark, [0, 0.35 + dx, 0]) // 장작
    })
    // 부뚜막 옆 장작더미 + 부지깽이
    for (let k = 0; k < 6; k += 1) Cy([H.x1 + 0.35 + (k % 3) * 0.13, 0.06 + Math.floor(k / 3) * 0.12, H.z - 0.1], 0.06, 0.7, k % 2 ? C.woodDark : C.wood, [Math.PI / 2, 0, 0])
    B([H.x0 + 0.5, 0.35, front - 0.25], [0.04, 0.7, 0.04], C.iron, [0.25, 0, 0])

    // 뒤벽 위: 국자·주걱 걸이 (나무 막대 + 바가지·국자)
    const rackY = H.h + 1.05
    const rackZ = D2 - 0.16
    B([H.x0 + 2.4, rackY, rackZ], [2.4, 0.05, 0.05], C.woodDark)
    for (let k = 0; k < 7; k += 1) {
      const x = H.x0 + 1.4 + k * 0.33
      B([x, rackY - 0.28, rackZ - 0.02], [0.025, 0.5, 0.025], k % 3 === 2 ? C.iron : C.woodLight)
      if (k % 3 === 0) Sp([x, rackY - 0.58, rackZ - 0.05], [0.1, 0.05, 0.1], C.straw) // 국자 머리
      else if (k % 3 === 1) B([x, rackY - 0.56, rackZ - 0.03], [0.09, 0.12, 0.015], C.woodLight) // 주걱
      else B([x, rackY - 0.56, rackZ - 0.03], [0.1, 0.1, 0.01], C.iron) // 뒤집개
    }
    // 시렁(벽 선반) + 까치발 + 옹기·백자병
    const shelfY = H.h + 1.55
    B([hx - 0.6, shelfY, D2 - 0.3], [3.4, 0.05, 0.36], C.wood)
    for (const dx of [-1.4, 0.2]) B([hx - 0.6 + dx, shelfY - 0.16, D2 - 0.2], [0.05, 0.28, 0.2], C.woodDark, [0.6, 0, 0])
    ;[-2.0, -1.55, -1.1, -0.6, -0.2, 0.25, 0.7].forEach((dx, k) => {
      const x = hx - 0.6 + dx
      if (k % 3 === 0) {
        Sp([x, shelfY + 0.14, D2 - 0.3], [0.13, 0.14, 0.13], C.onggi)
        Cy([x, shelfY + 0.27, D2 - 0.3], 0.06, 0.04, C.onggiGlaze)
      } else {
        Sp([x, shelfY + 0.09, D2 - 0.3], [0.07, 0.08, 0.07], C.white)
        Cy([x, shelfY + 0.2, D2 - 0.3], 0.025, 0.1, C.white)
      }
    })
    // 둥근 체(채반) 걸이 — 벽에 기대 세운 모습
    for (const [dx, rad] of [[0.75, 0.24], [1.05, 0.2], [1.3, 0.17]]) {
      Cy([H.x1 + dx - 0.2, H.h + 0.75, D2 - 0.17], rad, 0.06, dx > 1 ? C.straw : '#b98d55', [Math.PI / 2, 0, 0])
    }

    // ── 오른쪽 벽 찬장: 기둥 + 선반 4단 + 그릇 ──
    const cb = K.cupboard
    for (const dz of [-cb.l / 2, cb.l / 2]) for (const dx of [-cb.w / 2, cb.w / 2]) B([cb.x + dx, cb.h / 2, cb.z + dz], [0.05, cb.h, 0.05], C.woodDark)
    for (let r = 0; r < 4; r += 1) {
      const y = 0.25 + r * 0.55
      B([cb.x, y, cb.z], [cb.w, 0.04, cb.l], C.wood)
      for (let k = 0; k < 6; k += 1) {
        const z = cb.z - cb.l / 2 + 0.25 + k * ((cb.l - 0.5) / 5)
        if (r === 0) {
          Sp([cb.x, y + 0.17, z], [0.16, 0.17, 0.16], C.onggi) // 아래 칸: 작은 단지
          Cy([cb.x, y + 0.33, z], 0.08, 0.03, C.onggiGlaze)
        } else if (r === 1) {
          for (let n = 0; n < 4; n += 1) Cy([cb.x, y + 0.035 + n * 0.05, z], 0.13 - n * 0.006, 0.045, k % 2 ? C.woodLight : C.wood) // 나무 그릇 포개기
        } else if (r === 2) {
          for (let n = 0; n < 3; n += 1) shiny.push({ p: [cb.x, y0 + y + 0.04 + n * 0.06, z], s: [0.11, 0.05, 0.11], c: C.brass }) // 놋그릇
        } else {
          Sp([cb.x, y + 0.1, z], [0.075, 0.09, 0.075], C.white) // 백자병
          Cy([cb.x, y + 0.22, z], 0.028, 0.11, C.white)
        }
      }
    }
    // 고추·마늘 타래 (찬장 옆 벽)
    for (let k = 0; k < 5; k += 1) {
      const z = cb.z - cb.l / 2 - 0.35 - k * 0.32
      if (z < -D2 + 1.2) break
      B([W2 - 0.08, 1.85, z], [0.02, 0.5, 0.02], C.straw)
      for (let n = 0; n < 6; n += 1) Sp([W2 - 0.12, 1.65 - n * 0.09, z], [0.05, 0.055, 0.05], k % 2 ? '#c2361f' : '#efe7d2')
    }

    // ── 뒤 오른쪽 선반: 바구니·달걀·호박·함지·나무 상자 ──
    const sh = K.shelf
    for (const dx of [-sh.w / 2, sh.w / 2]) for (const dz of [-sh.d / 2, sh.d / 2]) B([sh.x + dx, sh.h / 2, sh.z + dz], [0.05, sh.h, 0.05], C.woodDark)
    ;[0.3, 0.85, 1.4].forEach((y, r) => {
      B([sh.x, y, sh.z], [sh.w, 0.04, sh.d], C.wood)
      for (let k = 0; k < 3; k += 1) {
        const x = sh.x - sh.w / 2 + 0.33 + k * 0.62
        if (r === 0) Cy([x, y + 0.13, sh.z], 0.2, 0.22, C.straw) // 큰 바구니
        else if (r === 1) {
          Cy([x, y + 0.06, sh.z], 0.2, 0.1, C.straw) // 채반
          for (let n = 0; n < 4; n += 1) Sp([x - 0.08 + (n % 2) * 0.16, y + 0.13, sh.z - 0.06 + Math.floor(n / 2) * 0.12], [0.065, 0.06, 0.065], k === 1 ? '#f2ead8' : '#e3842a')
        } else B([x, y + 0.12, sh.z], [0.4, 0.22, 0.32], k % 2 ? C.woodLight : C.wood) // 나무 상자
      }
    })

    // ── 손질 상: 상판 + 다리 + 도마·칼 + 채소 ──
    const T = K.table
    B([T.x, T.h, T.z], [T.w, 0.07, T.d], C.woodLight)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B([T.x + sx * (T.w / 2 - 0.08), T.h / 2, T.z + sz * (T.d / 2 - 0.08)], [0.07, T.h, 0.07], C.woodDark)
    B([T.x, T.h / 3, T.z], [T.w - 0.2, 0.04, T.d - 0.15], C.wood) // 아래 칸
    B([T.x - 0.35, T.h + 0.06, T.z], [0.55, 0.05, 0.38], '#c9a77a') // 도마
    shiny.push({ p: [T.x - 0.3, y0 + T.h + 0.095, T.z + 0.05], s: [0.22, 0.012, 0.06], c: '#cfd3d6' }) // 칼날
    B([T.x - 0.08, T.h + 0.095, T.z + 0.05], [0.1, 0.025, 0.035], C.woodDark) // 칼자루
    Sp([T.x + 0.2, T.h + 0.14, T.z - 0.12], [0.13, 0.11, 0.12], '#7fae4f') // 배추
    Sp([T.x + 0.2, T.h + 0.2, T.z - 0.12], [0.09, 0.06, 0.09], '#cfe3a2')
    Cy([T.x + 0.45, T.h + 0.08, T.z + 0.1], 0.05, 0.32, '#f2efe6', [0, 0, Math.PI / 2]) // 무
    Sp([T.x + 0.66, T.h + 0.08, T.z + 0.1], [0.06, 0.05, 0.06], '#6fa04a')
    for (let n = 0; n < 3; n += 1) Cy([T.x + 0.35 + n * 0.08, T.h + 0.06, T.z - 0.25], 0.025, 0.2, '#e46a1f', [0, 0, Math.PI / 2]) // 당근
    Cy([T.x + 0.55, T.h / 3 + 0.12, T.z], 0.22, 0.16, C.straw) // 아래 칸 호박 바구니
    for (let n = 0; n < 3; n += 1) Sp([T.x + 0.45 + n * 0.1, T.h / 3 + 0.24, T.z - 0.05 + (n % 2) * 0.1], [0.09, 0.07, 0.09], '#e08a1e')
    Cy([T.x - 0.45, T.h / 3 + 0.1, T.z], 0.18, 0.12, C.straw)
    for (let n = 0; n < 4; n += 1) Sp([T.x - 0.5 + (n % 2) * 0.1, T.h / 3 + 0.2, T.z - 0.05 + Math.floor(n / 2) * 0.1], [0.05, 0.045, 0.05], '#d8b98a') // 감자

    // ── 앞 오른쪽: 붉은 소반 줄 + 밥그릇·국그릇 ──
    const TR = K.trays
    B([TR.x, TR.h, TR.z], [TR.w, 0.05, TR.d], C.woodDark) // 긴 받침 평상
    for (const sx of [-1, 1]) B([TR.x + sx * (TR.w / 2 - 0.08), TR.h / 2, TR.z], [0.07, TR.h, TR.d - 0.1], C.woodDark)
    for (let k = 0; k < 5; k += 1) {
      const x = TR.x - TR.w / 2 + 0.26 + k * ((TR.w - 0.52) / 4)
      B([x, TR.h + 0.07, TR.z], [0.4, 0.035, 0.36], C.red) // 소반 상판
      for (const sx of [-1, 1]) B([x + sx * 0.15, TR.h + 0.04, TR.z], [0.03, 0.06, 0.28], C.red)
      shiny.push({ p: [x - 0.09, y0 + TR.h + 0.13, TR.z - 0.06], s: [0.065, 0.07, 0.065], c: C.brass })
      shiny.push({ p: [x + 0.09, y0 + TR.h + 0.12, TR.z - 0.06], s: [0.07, 0.05, 0.07], c: C.brass })
      Sp([x, TR.h + 0.11, TR.z + 0.09], [0.05, 0.03, 0.05], C.white)
    }

    // ── 왼쪽: 큰 옹기 독 · 물통 · 뒤주 ──
    for (const [x, z, rad] of K.jars) {
      Sp([x, rad * 1.05, z], [rad, rad * 1.1, rad], C.onggi)
      Cy([x, rad * 2.05, z], rad * 0.62, 0.08, C.onggiGlaze) // 입구
      Sp([x, rad * 2.12, z], [rad * 0.66, rad * 0.16, rad * 0.66], C.onggiGlaze) // 뚜껑
    }
    for (const [x, z] of K.buckets) {
      Cy([x, 0.21, z], 0.2, 0.42, C.woodLight)
      for (const y of [0.08, 0.34]) Cy([x, y, z], 0.205, 0.035, C.iron)
      B([x, 0.5, z], [0.03, 0.2, 0.03], C.woodDark) // 손잡이 막대
    }
    const ch = K.chest
    B([ch.x, ch.h / 2 + 0.08, ch.z], [ch.w, ch.h, ch.d], C.wood)
    B([ch.x, ch.h + 0.1, ch.z], [ch.w + 0.06, 0.05, ch.d + 0.06], C.woodDark)
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) B([ch.x + sx * (ch.w / 2 - 0.04), 0.04, ch.z + sz * (ch.d / 2 - 0.04)], [0.08, 0.08, 0.08], C.woodDark)
    B([ch.x + ch.w / 2 + 0.005, ch.h / 2 + 0.2, ch.z], [0.01, 0.12, 0.2], C.brass) // 앞 장석

    // ── 등롱: 천장에 매단 하얀 겹 등롱 3 + 바닥 나무 등롱 ──
    const ceil = 2.7 - 0.3
    for (const [x, z] of [[-3.2, 0.3], [0.2, 0.9], [2.6, -1.2]]) {
      B([x, ceil - 0.25, z], [0.015, 0.5, 0.015], C.woodDark)
      for (let n = 0; n < 3; n += 1) lamps.push({ p: [x, y0 + ceil - 0.6 - n * 0.17, z], s: [0.17, 0.13, 0.17] })
      Cy([x, ceil - 0.5, z], 0.18, 0.03, C.woodDark)
    }
    const fl = [-1.9, -D2 + 0.45]
    B([fl[0], 0.03, fl[1]], [0.3, 0.06, 0.3], C.woodDark)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B([fl[0] + sx * 0.12, 0.3, fl[1] + sz * 0.12], [0.03, 0.55, 0.03], C.woodDark)
    lamps.push({ p: [fl[0], y0 + 0.32, fl[1]], s: [0.22, 0.4, 0.22], box: true })
    return { boxes, cyls, spheres, shiny, fires, embers, lamps }
  }, [K, W2, D2, y0])

  const H = K.hearth
  const hw = H.x1 - H.x0
  const backWallH = 1.75
  const lampCyl = lamps.filter((l) => !l.box)
  const lampBox = lamps.filter((l) => l.box)
  return (
    <>
      {/* 바닥: 짙은 회색 전돌 */}
      <mesh position={[0, y0 + 0.058, 0]} rotation-x={-Math.PI / 2} material={tileFloor(W2 * 2 - 0.3, D2 * 2 - 0.3)}>
        <planeGeometry args={[W2 * 2 - 0.3, D2 * 2 - 0.3]} />
      </mesh>
      {/* 부뚜막 몸통(막돌) + 뒤벽 막돌 판 */}
      <mesh geometry={GEO.box} material={rubbleWall(hw / 1.2, H.h / 1.2)} position={[(H.x0 + H.x1) / 2, y0 + H.h / 2, H.z]} scale={[hw, H.h, H.d]} />
      <mesh geometry={GEO.box} material={rubbleWall((hw + 1.6) / 1.2, backWallH / 1.2)} position={[(H.x0 + H.x1) / 2 + 0.8, y0 + H.h + backWallH / 2, D2 - 0.09]} scale={[hw + 1.6, backWallH, 0.06]} />
      <Instances geometry={GEO.box} material={PARTS} items={boxes} />
      <Instances geometry={GEO.cyl} material={PARTS} items={cyls} />
      <Instances geometry={GEO.sphere} material={PARTS} items={spheres} />
      <Instances geometry={GEO.cyl} material={SHINY} items={shiny} />
      <Instances geometry={GEO.box} material={FIRE} items={fires} />
      <Instances geometry={GEO.box} material={EMBER} items={embers} />
      <Instances geometry={GEO.cyl} material={LANTERN} items={lampCyl} />
      <Instances geometry={GEO.box} material={LANTERN} items={lampBox} />
    </>
  )
}
