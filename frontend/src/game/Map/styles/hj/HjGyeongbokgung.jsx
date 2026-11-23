import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CanvasTexture, DoubleSide, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Box, Cyl, GEO, Instances, mat, seeded } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { GyeongbokgungWater } from './HjGyeongbokgungWater.jsx'
import { Gwanghwamun, PalaceTerraceDetails } from './GyeongbokgungLandmarks.jsx'
import HjPalaceInterior from './HjPalaceInterior.jsx'
import { palaceMaps, tiledRoof } from './gyeongbokgungMaterials.js'
import PalaceNightLighting from './PalaceNightLighting.jsx'
import PalaceFilmEntrance, { PalaceActivityYards, PalaceDramaMarkers } from './PalaceFilmEntrance.jsx'
import GyeongseongStreet from './GyeongseongStreet.jsx'
import SpecialAccessScene from './SpecialAccessScene.jsx'
import { specialArchitectureMaterials } from './specialArchitectureMaterials.js'
import ArchitecturalMasonry from './ArchitecturalMasonry.jsx'
import {
  FLOOR, AXIS, BRIDGES, COURTS, DECK, GATES, HALLS,
  PONDS, ROOM_SCALE, THRONE, THRONE_PLATFORMS, THRONE_STAIRS, TOUR_SIGNS, WALLS, WALKS,
  hallBays, hallFooting, hallSteps, hallWalls, pondEdges,
} from './gyeongbokgungLayout.js'

const PARTS = mat('#ffffff')
const WINDOW = mat('#ffdb97', { emissive: '#ffbc69', emissiveIntensity: 0.32 })
const RED = '#9f4937'
const STONE = '#afa792'
const IVORY = '#dcd0b7'
const GREEN = '#3f6c5b'
const THRONE_STONE = [...THRONE_PLATFORMS, ...THRONE_STAIRS].map(part => ({ ...part, base: 0 }))
const DANCHEONG = ['#285855', '#47927b', '#dfaa56', '#af503f', '#367282']
const MASONRY = ['#948b7b', '#a9a28e', '#b5a993', '#c2b59d']
const LANTERNS = [
  [-12, -40.1], [-4.1, -40.1], [-11.95, -28.8], [-4.1, -28.8], [-14, -20.5], [-2.4, -20.5],
  [-34.2, -.6], [-20.2, -.55], [16.0, -17.2], [21.0, -17.15],
  [-11.4, 11.6], [-4.6, 11.6], [5.1, -6.1], [5.8, 7.2],
]

// [3. 개발 > 렌더링 최적화] 반복되는 공포·창살·석축을 재질별 인스턴스로 묶습니다.
function buildArchitecture() {
  const blocks = [], glass = [], ornaments = [], flowers = [], roofs = [], posts = []
  const tileEnds = [], shutters = [], bands = [], masonry = []
  const box = (p, s, c, r) => blocks.push({ p, s, c, r })
  const column = (x, y, z, radius, height, color) => (
    posts.push({ p: [x, y, z], s: [radius, height, radius], c: color })
  )

  function roof(x, y, z, w, d, rise, yaw = 0) {
    roofs.push(tiledRoof(w, d, rise).rotateY(yaw).translate(x, y, z))
    const vertical = yaw !== 0
    box([x, y + rise + 0.025, z], vertical ? [0.11, 0.095, w * 0.68] : [w * 0.68, 0.095, 0.11], '#9f9c90')
    box([x, y - 0.095, z], vertical ? [d * 0.94, 0.19, w * 0.97] : [w * 0.97, 0.19, d * 0.94], '#3d594b')
    for (const side of [-1, 1]) {
      box([x + (vertical ? side * d * 0.456 : 0), y - 0.22, z + (vertical ? 0 : side * d * 0.456)],
        vertical ? [0.075, 0.055, w * 0.94] : [w * 0.94, 0.055, 0.075], '#d5ab66')
      const count = Math.ceil(w / .21)
      const co = Math.cos(yaw), si = Math.sin(yaw)
      for (let i = 0; i < count; i += 1) {
        const u = ((i + .5) / count - .5) * w, v = side * d * .498
        const lift = (Math.abs(u / w) * 2) ** 3.5 * rise * .24
        tileEnds.push({ p: [x + u * co + v * si, y + lift, z - u * si + v * co],
          s: [.069, .063, .105], r: [0, yaw, 0], c: i % 4 ? '#62717a' : '#8a969b' })
      }
    }
  }

  function slab({ x, z, w, d, top }, color = STONE, bottom = FLOOR) {
    box([x, (top + bottom) / 2, z], [w, top - bottom, d], color)
  }

  function facade({ x, z, w, d, h, y, bays, elevated = false, open = false, openSides = false, throne = false }) {
    for (const side of [-1, 1]) {
      const face = z + side * d * (open ? .48 : .423)
      const pitch = w * 0.91 / bays
      const r = [0, side < 0 ? Math.PI : 0, 0]
      for (let i = 0; i <= bays; i += 1) {
        const px = x + (i - bays / 2) * pitch
        if (!throne || side > 0 || Math.abs(px - x) > 2.03) {
          column(px, y + h * 0.48, face, elevated ? 0.147 : 0.17, h * 0.96, RED)
          column(px, y + 0.08, face, 0.205, 0.16, IVORY)
          DANCHEONG.forEach((c, layer) => ornaments.push({
            p: [px, y + h - 0.48 + layer * 0.065, face + side * 0.11],
            s: [0.28 + layer * 0.075, 0.065, 0.22 + layer * 0.078], c,
          }))
          for (let petal = 0; petal < 6; petal += 1) {
            const angle = petal * Math.PI / 3
            flowers.push({
              p: [px + 0.035 * Math.cos(angle), y + h - 0.27 + 0.035 * Math.sin(angle), face + side * 0.318],
              s: [0.022, 0.022, 0.01], c: petal % 2 ? '#f3c482' : '#d3745d',
            })
          }
        }
        if (i === bays) continue
        const mid = px + pitch / 2
        bands.push({ p: [mid, y + h - .31, face + side * .195], s: [pitch, .38, 1], r })
        if (openSides || (throne && side === -1 && Math.abs(mid - x) < 2.22)
          || (open && side === -1 && i === Math.floor(bays / 2))) continue
        const windowWidth = pitch * 0.69
        const windowHeight = h * .51
        const winY = y + h * .49
        box([mid, y + h * .43, face - side * .32], [pitch + .04, h * .85, .65], '#964a38')
        box([mid, winY, face], [windowWidth + .15, windowHeight + .14, .16], '#27463d')
        box([mid, y + h * .2, face], [pitch * .92, .19, .12], GREEN)
        shutters.push({ p: [mid, winY, face + side * .086], s: [windowWidth, windowHeight, 1], r })
        ornaments.push({ p: [mid, winY - .23, face + side * .109], s: [.08, .068, .038], c: '#c59d53' })
      }
    }
    for (const side of [-1, 1]) {
      const faceX = x + side * w * .459
      const r = [0, side * Math.PI / 2, 0]
      const count = Math.max(2, Math.round(d / 1.8))
      for (let i = 0; i < count; i += 1) {
        const span = d * .82 / count
        const faceZ = z + (i + .5 - count / 2) * span
        bands.push({ p: [faceX, y + h - .23, faceZ], s: [span, .29, 1], r })
        shutters.push({ p: [faceX, y + h * .51, faceZ], s: [span * .66, h * .45, 1], r })
        masonry.push({ p: [faceX, y + .23, faceZ], s: [span, .43, 1], r })
      }
    }
  }

  for (const hall of HALLS) {
    const { x, z, w, d, h, masonry, upper } = hall
    const y = hall.elevation ?? .33
    if (hall !== THRONE) {
      slab(hallFooting(hall), IVORY)
      for (const step of hallSteps(hall)) slab(step, '#c9bfa7')
      for (const wall of hallWalls(hall)) {
        box([wall.x, y + wall.height / 2, wall.z], [wall.w, wall.height, wall.d], masonry ? '#a79a83' : '#864c3e')
      }
      const planks = Math.ceil(w * 2.2)
      for (let i = 0; i < planks; i += 1) {
        const span = w * .88 / planks
        box([x + (i + .5 - planks / 2) * span, y + .011, z], [span - .014, .022, d * .88],
          ['#705141', '#775b47', '#83604a', '#795943'][i % 4])
      }
      const cabinetZ = z + d * .345
      const cabinetWidth = Math.min(2.46, w * .62)
      const study = /집옥재|사정전|만춘전|천추전/.test(hall.name)
      const kitchen = /주방|생물방/.test(hall.name)
      box([x, y + .28, cabinetZ], [cabinetWidth, .53, .44], '#51392e')
      box([x, y + .56, cabinetZ], [cabinetWidth + .075, .075, .5], '#896349')
      const panels = Math.max(2, Math.round(w / 1.85))
      const panelWidth = w * .72 / panels
      const innerFace = Math.min(d * .448 - .086, d * .48 - .66)
      for (let i = 0; i < panels; i += 1) {
        const px = x + (i + .5 - panels / 2) * panelWidth
        shutters.push({ p: [px, y + h * .56, z + innerFace],
          s: [panelWidth * .91, h * .43, 1], r: [0, Math.PI, 0] })
      }
      const lampX = x + cabinetWidth * .40
      box([lampX, y + .638, cabinetZ - .035], [.19, .034, .19], '#362a22')
      glass.push({ p: [lampX, y + .755, cabinetZ - .035], s: [.131, .21, .134] })
      box([lampX, y + .866, cabinetZ - .035], [.181, .03, .185], '#544237')
      for (let i = -1; i <= 1; i += 1) {
        const px = x + i * cabinetWidth / 3.3
        box([px, y + .29, cabinetZ - .23], [cabinetWidth * .27, .27, .028], '#a37152')
        if (i === 1) continue
        if (study) box([px, y + .635, cabinetZ], [.22, .1, .21], i === 0 ? '#b99560' : '#637377')
        else if (kitchen) glass.push({ p: [px, y + .67, cabinetZ], s: [.18, .18, .18] })
      }
      if (!kitchen) {
        box([x + w * .295, y + .046, z + d * .115], [Math.min(1.03, w * .25), .06, d * .38], '#8d694d')
        box([x + w * .295, y + .09, z + d * .15], [Math.min(.65, w * .18), .09, .41], '#984c49')
      }
    }
    facade({ x, z, w, d, h, y, bays: hall === THRONE ? 7 : hallBays(w), open: true, throne: hall === THRONE })
    roof(x, y + h, z, w + 1.22, d + 1.08, d * 0.21)
    if (upper) {
      const upperHeight = hall === THRONE ? 2.18 : 1.42
      const upperBase = y + h + .43
      box([x, upperBase + upperHeight * .49, z], [w * .68, upperHeight * .98, d * .63], RED)
      facade({ x, z, w: w * .75, d: d * .765, h: upperHeight, y: upperBase, bays: hall === THRONE ? 7 : 3 })
      roof(x, upperBase + upperHeight, z, w * .88, d * .9, d * .21)
    }
  }

  for (const { x, z, length, vertical, type } of WALLS) {
    const gallery = type === 'gallery'
    const high = gallery ? 2.18 : 1.81
    const width = gallery ? 1.39 : 0.53
    const size = (span, h, thick) => vertical ? [thick, h, span] : [span, h, thick]
    const point = (offset, y, inset = 0) => [x + (vertical ? inset : offset), y, z + (vertical ? offset : inset)]
    box(point(0, FLOOR + high * 0.47), size(length, high * 0.94, width),
      gallery ? '#e1ccb0' : '#c4b8a0')
    box(point(0, FLOOR + 0.14), size(length, 0.28, width + 0.13), '#a29a83')
    roof(x, FLOOR + high, z, length + (gallery ? 0.45 : 0.04), width + (gallery ? 0.75 : 0.36),
      gallery ? 0.49 : 0.25, vertical ? Math.PI / 2 : 0)
    const bays = Math.ceil(length / (gallery ? 1.67 : 1.37))
    for (let i = 0; i < bays; i += 1) {
      const offset = length * ((i + 0.5) / bays - 0.5)
      if (gallery) {
        box(point(offset, 1.04), size(0.13, 1.8, width + 0.115), '#8b4635')
      }
      for (const side of [-1, 1]) {
        const r = [0, vertical ? side * Math.PI / 2 : side < 0 ? Math.PI : 0, 0]
        const inset = side * (width / 2 + .032)
        masonry.push({ p: point(offset, FLOOR + (gallery ? .49 : .81), inset),
          s: [length / bays + .015, gallery ? .80 : 1.37, 1], r })
        if (gallery) {
          shutters.push({ p: point(offset + .27, 1.27, inset), s: [length / bays * .38, .58, 1], r })
          bands.push({ p: point(offset, high - .02, inset), s: [length / bays, .16, 1], r })
        }
      }
      for (let row = 0; row < 3; row += 1) {
        ornaments.push({
          p: point(offset + (row % 2 ? -0.18 : 0), FLOOR + 0.19 + row * 0.13),
          s: size(length / bays * 0.8, 0.09, width + 0.083), c: MASONRY[(i + row) % 4],
        })
      }
    }
  }

  for (const { x, z, w, d = 1.95, upper, yaw = 0, closed } of GATES) {
    const at = (u, y, v = 0) => [x + u * Math.cos(yaw) + v * Math.sin(yaw), y, z - u * Math.sin(yaw) + v * Math.cos(yaw)]
    const r = [0, yaw, 0]
    for (const side of [-1, 1]) {
      for (const row of [-1, 1]) {
        column(...at(side * w * .425, 1.47, row * d * .40), .21, 2.72, RED)
        column(...at(side * w * .425, .19, row * d * .40), .285, .17, IVORY)
      }
      bands.push({ p: at(0, 2.72, side * (d * .47 + .03)), s: [w, .29, 1], r: [0, yaw + (side < 0 ? Math.PI : 0), 0] })
    }
    box(at(0, 2.73), [w, .30, d * .94], GREEN, r)
    if (closed) box(at(0, 1.32), [w * .82, 2.43, .26], '#764532', r)
    roof(x, 2.9, z, w + .78, d + 1.0, d * .3, yaw)
    if (upper) {
      box([x, 4.15, z], [w * .69, 1.5, d * .61], RED)
      facade({ x, z, w: w * .75, d: d * .76, h: 1.64, y: 3.34, bays: 4 })
      roof(x, 5.04, z, w * .83, d * .89, 1.03)
    }
  }

  slab(DECK, '#c5bea9')
  slab({ ...DECK, w: DECK.w + 0.13, d: DECK.d + 0.13 }, '#ddd1b7', DECK.top - 0.07)
  const pavilion = { x: DECK.x, z: DECK.z, w: 12.75, d: 8.43, y: DECK.top }
  facade({ ...pavilion, y: 2.62, h: 2.69, bays: 6, elevated: true, open: true, openSides: true })
  roof(pavilion.x, 5.40, pavilion.z, 14.63, 10.35, 2.23)

  for (const pond of PONDS) {
    for (const { x, z, length, vertical } of pondEdges(pond)) {
      const step = length / Math.ceil(length / 0.71)
      const size = (span, h, thick) => vertical ? [thick, h, span] : [span, h, thick]
      for (let i = 0; i < Math.round(length / step); i += 1) {
        const along = (i + 0.5) * step - length / 2
        const p = [x + (vertical ? 0 : along), 0.293, z + (vertical ? along : 0)]
        box(p, size(step - 0.023, 0.36, 0.41), MASONRY[i % MASONRY.length])
        if (i % 2 === 0) box([p[0], 0.528, p[2]], size(0.16, 0.26, 0.155), '#bcb49d')
      }
      box([x, 0.67, z], size(length, 0.11, 0.26), '#d2c9b0')
    }
  }
  for (const bridge of BRIDGES) {
    slab(bridge, '#bfb7a5')
    const { x, z, w, d, top, vertical } = bridge
    const length = vertical ? d : w
    const count = Math.ceil(length / 0.46)
    for (let i = 0; i < count; i += 1) {
      const offset = ((i + .5) / count - .5) * length
      box([x + (vertical ? 0 : offset), top + .008, z + (vertical ? offset : 0)],
        vertical ? [w - .06, .026, length / count - .029] : [length / count - .029, .026, d - .06],
        MASONRY[i % MASONRY.length])
      for (const side of [-1, 1]) {
        const px = x + (vertical ? side * (w / 2 - .065) : offset)
        const pz = z + (vertical ? offset : side * (d / 2 - .065))
        const height = .48 + Math.sin((i + .5) / count * Math.PI) * .13
        box([px, top + height / 2, pz], [.105, height, .11], '#cbc3ab')
        box([px, top + height, pz],
          vertical ? [.125, .075, length / count + .01] : [length / count + .01, .075, .125], '#e3d8bc')
      }
    }
  }
  for (const [x, z] of LANTERNS) {
    box([x, FLOOR + 0.09, z], [0.46, 0.18, 0.46], '#978e7b')
    box([x, FLOOR + 0.295, z], [0.12, 0.31, 0.12], '#8c8676')
    box([x, FLOOR + 0.47, z], [0.32, 0.065, 0.32], '#515954')
    glass.push({ p: [x, FLOOR + 0.59, z], s: [0.19, 0.17, 0.19] })
    box([x, FLOOR + 0.71, z], [0.32, 0.095, 0.32], '#55584e')
  }
  for (const [x, z, w, d] of WALKS) {
    const longX = w > d
    const length = longX ? w : d
    const count = Math.ceil(length / .63)
    for (let i = 0; i < count; i += 1) {
      const along = ((i + .5) / count - .5) * length
      for (const side of [-1, 1]) {
        const px = x + (longX ? along : side * (w / 2 - .075))
        const pz = z + (longX ? side * (d / 2 - .075) : along)
        const joined = WALKS.some(([otherX, otherZ, otherW, otherD]) =>
          (otherX !== x || otherZ !== z) && Math.abs(px - otherX) < otherW / 2 - .06 && Math.abs(pz - otherZ) < otherD / 2 - .06)
        if (joined) continue
        ornaments.push({ p: [px, .187, pz], s: longX ? [length / count - .02, .027, .151] : [.151, .027, length / count - .02],
          c: MASONRY[(i + 2) % 4] })
      }
    }
  }
  return { blocks, glass, ornaments, flowers, posts, roofs, tileEnds, shutters, bands, masonry }
}

function mergeAndDispose(pieces) {
  const result = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  return result
}

function paving(rectangles, y, repeat) {
  const rects = rectangles.map(([x, z, w, d]) => [x - w / 2, x + w / 2, z - d / 2, z + d / 2])
  const rows = [...new Set(rects.flatMap((rect) => rect.slice(2)))].sort((a, b) => a - b)
  const pieces = []
  for (let i = 1; i < rows.length; i += 1) {
    const start = rows[i - 1], end = rows[i]
    const intervals = rects.filter(([, , z0, z1]) => z0 <= start && end <= z1).sort(([a], [b]) => a - b)
    let edge = -Infinity
    for (const [x0, x1] of intervals) {
      const left = Math.max(x0, edge)
      if (left >= x1) continue
      const plane = new PlaneGeometry(x1 - left, end - start).rotateX(-Math.PI / 2)
        .translate((x1 + left) / 2, y, (start + end) / 2)
      const uv = plane.getAttribute('uv'), position = plane.getAttribute('position')
      for (let k = 0; k < uv.count; k += 1) uv.setXY(k, position.getX(k) / repeat, position.getZ(k) / repeat)
      pieces.push(plane)
      edge = x1
    }
  }
  return mergeAndDispose(pieces)
}

function pavingTexture(flagstones) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  const rng = seeded(flagstones ? 637 : 639)
  ctx.fillStyle = flagstones ? '#a6a197' : '#d4c8ad'
  ctx.fillRect(0, 0, 256, 256)
  if (flagstones) {
    for (let row = 0; row < 8; row += 1) {
      for (let col = -1; col < 8; col += 1) {
        ctx.fillStyle = ['#b7b2a7', '#bfb8a8', '#c9c1b2', '#afa99b'][Math.floor(rng() * 4)]
        ctx.fillRect(col * 32 + row % 2 * 16 + 1, row * 32 + 1, 30, 30)
      }
    }
  }
  for (let i = 0; i < 7900; i += 1) {
    ctx.fillStyle = i % 2 ? 'rgba(85,66,42,.095)' : 'rgba(249,239,206,.19)'
    ctx.fillRect(rng() * 256, rng() * 256, rng() * 2.3 + .3, rng() * 1.6 + .25)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 4
  return texture
}

const GROVES = [
  [-37,-40],[-36.1,-28.1],[-34.5,-23.6],[-37.7,-16],[-37.5,-7],[-37.3,.7],[-34.0,7.5],[-30.2,12],
  [10.3,-40.0],[32.4,-42.0],[34.6,-33.2],[36.1,-25.8],[34.5,-13.7],[34.8,-3.8],[36.2,6.1],[36.7,10.0],
  [-16.1,8.4],[-14.7,11.5],[7.65,10.8],[10.8,8.6],
]
function PalacePlanting() {
  const { trunks, leaves, stones } = useMemo(() => {
    const rng = seeded(626)
    const trunks = [], leaves = [], stones = []
    for (const [x, z] of GROVES) {
      const scale = 0.71 + rng() * 0.47
      const flip = rng() > 0.5 ? -1 : 1
      trunks.push({ p: [x, 1.42 * scale + FLOOR, z], s: [.17 * scale, 2.84 * scale, .17 * scale],
        r: [0, 0, -flip * 0.13], c: '#675344' })
      trunks.push({ p: [x - flip * 0.47, 2.24 * scale, z + 0.36], s: [.075, 1.15 * scale, .075],
        r: [0.37, 0, flip * .47], c: '#735b48' })
      for (let layer = 0; layer < 5; layer += 1) leaves.push({
        p: [x + flip * (rng() - 0.49) * 2.6 * scale, (2.25 + layer * 0.32) * scale, z + (rng() - 0.5) * 2.2],
        s: [(1.31 - layer * 0.083) * scale, (0.32 + rng() * 0.2) * scale, (0.77 + rng() * 0.26) * scale],
        c: ['#314934', '#3d543a', '#506342', '#2c533a', '#426040'][layer],
      })
      stones.push({ p: [x + .82, 0.22, z - 0.22], s: [.31, .22, .28], c: '#8a8d76' })
    }
    return { trunks, leaves, stones }
  }, [])
  return (
    <>
      <Instances geometry={GEO.cyl8} material={PARTS} items={trunks} castShadow />
      <Instances geometry={GEO.sphere} material={PARTS} items={leaves} castShadow />
      <Instances geometry={GEO.rock} material={PARTS} items={stones} />
    </>
  )
}

function PalacePlaque({ x, z, y, name, w = 2.1, rotation = Math.PI }) {
  return (
    <mesh position={[x, y, z]} rotation-y={rotation} userData={{ noShadow: true }}>
      <planeGeometry args={[w, 0.45]} />
      <meshBasicMaterial color="#f4e3be" map={getSignTexture(name, '#26342b', '#f4d183')} />
    </mesh>
  )
}

export default function HjGyeongbokgung({ item }) {
  const stage = useRef(null)
  const trim = useRef(null)
  const [width, thickness, depth] = item.size
  const [worldX, worldZ] = item.position
  const model = useMemo(() => {
    const { roofs, ...parts } = buildArchitecture()
    const maps = palaceMaps()
    return {
      ...parts, roof: mergeAndDispose(roofs),
      courts: paving(COURTS, 0.154, 5.4),
      walks: paving(WALKS, 0.174, 3.6),
      forecourt: paving([[AXIS, -13.5, 28.8, 19]], .158, 5.9),
      stone: pavingTexture(true), sand: pavingTexture(false), maps, architecture: specialArchitectureMaterials(),
      materials: {
        roof: new MeshStandardMaterial({ map: maps.tile, bumpMap: maps.tile, bumpScale: .04, roughness: .87,
          vertexColors: true, side: DoubleSide }),
        masonry: new MeshStandardMaterial({ map: maps.masonry, bumpMap: maps.masonry, bumpScale: .037, roughness: .91 }),
        lattice: new MeshStandardMaterial({ map: maps.lattice, emissiveMap: maps.lattice, emissive: '#debd82',
          emissiveIntensity: .2, roughness: .7 }),
        dancheong: new MeshStandardMaterial({ map: maps.dancheong, emissiveMap: maps.dancheong, emissive: '#efd2ac',
          emissiveIntensity: .16, roughness: .84, color: '#f1e5d0' }),
      },
    }
  }, [])
  useEffect(() => () => {
    model.roof.dispose()
    model.courts.dispose()
    model.walks.dispose()
    model.forecourt.dispose()
    model.stone.dispose()
    model.sand.dispose()
    Object.values(model.maps).forEach((map) => map.dispose())
    Object.values(model.materials).forEach((material) => material.dispose())
    Object.values(model.architecture).forEach((material) => { material.map.dispose(); material.dispose() })
  }, [model])

  useFrame(({ camera }) => {
    const { x, y, z } = camera.position
    const distanceSq = (x - worldX) ** 2 + (z - worldZ) ** 2
    stage.current.visible = y > 18 || distanceSq < 157 ** 2
    trim.current.visible = y < 82 && distanceSq < 131 ** 2
  })

  return (
    <group ref={stage} name="경복궁">
      <Box p={[0, FLOOR - thickness / 2, 0]} s={[width, thickness, depth]} c="#78834f" userData={{ noShadow: true }} />
      <mesh geometry={model.courts} userData={{ noShadow: true }}>
        <meshStandardMaterial map={model.sand} roughness={1} />
      </mesh>
      <mesh geometry={model.walks} userData={{ noShadow: true }}>
        <meshStandardMaterial map={model.stone} roughness={0.94} />
      </mesh>
      <mesh geometry={model.forecourt} userData={{ noShadow: true }}>
        <meshStandardMaterial map={model.stone} color="#d6ccaf" roughness={.97} />
      </mesh>
      <GyeongbokgungWater />
      <ArchitecturalMasonry parts={THRONE_STONE} material={model.architecture.woldae_stone} />
      <mesh geometry={model.roof} material={model.materials.roof} />
      <Instances geometry={GEO.box} material={PARTS} items={model.blocks} castShadow />
      <Instances geometry={GEO.cyl8} material={PARTS} items={model.posts} castShadow />
      <Instances geometry={GEO.box} material={WINDOW} items={model.glass} />
      <Instances geometry={GEO.plane} material={model.materials.lattice} items={model.shutters} />
      <Instances geometry={GEO.plane} material={model.materials.dancheong} items={model.bands} />
      <Instances geometry={GEO.plane} material={model.materials.masonry} items={model.masonry} />
      <Gwanghwamun materials={model.materials} stone={model.architecture.woldae_stone} />
      <PalaceFilmEntrance materials={model.materials} />
      <PalaceDramaMarkers />
      <PalaceActivityYards />
      <PalaceTerraceDetails />
      <GyeongseongStreet roofMaterial={model.materials.roof} brick={model.architecture.red_brick} />
      <SpecialAccessScene materials={model.materials} surfaces={model.architecture} />
      <PalacePlanting />
      <group position={[THRONE.x, THRONE.elevation, THRONE.z]} scale={ROOM_SCALE}>
        <HjPalaceInterior timber={model.architecture.timber} />
      </group>
      <PalaceNightLighting lanterns={LANTERNS} materials={model.materials} />
      <group ref={trim}>
        <Instances geometry={GEO.box} material={PARTS} items={model.ornaments} />
        <Instances geometry={GEO.sphere} material={PARTS} items={model.flowers} />
        <Instances geometry={GEO.cyl8} material={PARTS} items={model.tileEnds} />
        {GATES.map(({ name, x, z, d = 1.95, yaw = 0 }) => (
          <PalacePlaque key={name} x={x - Math.sin(yaw) * (d / 2 + .09)}
            z={z - Math.cos(yaw) * (d / 2 + .09)} y={2.58} name={name} rotation={Math.PI + yaw} />
        ))}
        {HALLS.map((hall) => (
          <PalacePlaque key={hall.name} x={hall.x} z={hall.z - hall.d * (hall === THRONE ? .5 : .45) - .06}
            y={(hall.elevation ?? .33) + hall.h - .56} name={hall.name} />
        ))}
        {TOUR_SIGNS.map(({ x, z, name, yaw }) => (
          <group key={name} position={[x, 0, z]} rotation-y={yaw}>
            <Box p={[0, .51, 0]} s={[.13, .82, .15]} c="#735444" />
            <Box p={[0, .96, 0]} s={[1.34, .40, .084]} c="#594433" />
            <PalacePlaque x={0} z={.052} y={.96} name={name} w={1.28} rotation={0} />
          </group>
        ))}
        <PalacePlaque x={DECK.x} z={DECK.z - 4.02} y={5.08} name="경회루" />

      </group>
    </group>
  )
}
