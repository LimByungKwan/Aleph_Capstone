import { useMemo } from 'react'
import { Euler, Quaternion, Vector3 } from 'three'
import { useSeason } from '../../../seasons.js'
import { GEO, Instances, hashString, mat, seeded } from '../kit.jsx'

// [3. 개발 > 프론트엔드] 계절 따라 바뀌는 나무 (style: "hjTree") — 혜진 영화·드라마 구역
// item.kind:
//   "oak"    — 넓게 퍼진 정자나무: 굵은 줄기가 낮게 여러 갈래로 갈라지고, 옆으로 넓은 둥근 수관
//   "linden" — 키 큰 가로수: 곧은 줄기 하나, 위로 길쭉한 달걀 모양 수관
//   "maple"  — 단풍나무: 밑동에서 여러 줄기로 갈라지는 가지, 성긴 수관 (가을엔 새빨갛게)
// 계절(광장 공용 계절)에 따라: 봄 연두 / 여름 짙은 초록 / 가을 노랑·주황·빨강 / 겨울 잎 없이 가지 + 눈
// size [수관 폭, 전체 높이, 수관 폭]. 같은 id면 늘 같은 모양 (id로 무작위 고정)

const UP = new Vector3(0, 1, 0)
const BARK = mat('#ffffff', { roughness: 0.95, flat: true })
const LEAF = mat('#ffffff', { roughness: 0.85, flat: true })

const BARK_COLOR = { oak: '#5a4232', linden: '#4a3a30', maple: '#6b5040' }
const PALETTE = {
  spring: {
    oak: ['#8cc152', '#a5d36a', '#78b048', '#b7e07e'],
    linden: ['#9fd05a', '#b5de70', '#88c24c'],
    maple: ['#9fbf5a', '#b9d070', '#c86a5a', '#d8c070'],
  },
  summer: {
    oak: ['#2f5a2a', '#3d6e33', '#4f8a3c', '#5e9a45'],
    linden: ['#4f8f3a', '#68a845', '#7fbf52', '#5c9c40'],
    maple: ['#3f7a3a', '#55913f', '#6aa548'],
  },
  autumn: {
    oak: ['#a0662a', '#c0812f', '#8a5a22', '#b8893a', '#6f7a32'],
    linden: ['#d8b53a', '#e8c94e', '#c9a032', '#b8a040'],
    maple: ['#c0201a', '#d8301e', '#e8452a', '#a81818', '#f05a3a'],
  },
}

const tmpQ = new Quaternion()
const tmpE = new Euler()
const tmpV = new Vector3()

// a → b 가지 하나 (원기둥 1개)
function limb(list, a, b, r, color) {
  tmpV.subVectors(b, a)
  const len = tmpV.length()
  tmpQ.setFromUnitVectors(UP, tmpV.normalize())
  tmpE.setFromQuaternion(tmpQ)
  list.push({ p: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], s: [r, len, r], r: [tmpE.x, tmpE.y, tmpE.z], c: color })
}

// 방향(수평 각 yaw, 위에서 기운 각 tilt)으로 길이 len인 벡터
function dir(yaw, tilt, len) {
  return new Vector3(Math.sin(tilt) * Math.cos(yaw) * len, Math.cos(tilt) * len, Math.sin(tilt) * Math.sin(yaw) * len)
}

function buildTree(id, kind, w, h, season) {
  const rnd = seeded(hashString(id))
  const bark = BARK_COLOR[kind] ?? BARK_COLOR.oak
  const limbs = []
  const tips = [] // 잔가지 끝 (잎 덩어리 자리)
  const winter = season === 'winter'

  // 가지를 재귀로 뻗기
  const grow = (from, yaw, tilt, len, r, depth, spread) => {
    const to = from.clone().add(dir(yaw, tilt, len))
    limb(limbs, from, to, r, bark)
    if (depth <= 0) {
      tips.push(to)
      return
    }
    const n = depth >= 2 ? 3 : 2 + (rnd() < 0.5 ? 1 : 0)
    for (let i = 0; i < n; i += 1) {
      const ny = yaw + (i - (n - 1) / 2) * spread + (rnd() - 0.5) * 0.6
      const nt = Math.min(1.35, tilt + (rnd() - 0.3) * 0.5)
      grow(to, ny, nt, len * (0.62 + rnd() * 0.12), r * 0.62, depth - 1, spread * 0.9)
    }
  }

  let crown // 수관 타원체 { cy, rx, ry }
  if (kind === 'linden') {
    // 곧은 줄기 + 위로 짧은 가지들
    const trunkTop = new Vector3(0, h * 0.82, 0)
    limb(limbs, new Vector3(0, 0, 0), trunkTop, w * 0.055, bark)
    for (let i = 0; i < 9; i += 1) {
      const y = h * (0.22 + (i / 8) * 0.55)
      grow(new Vector3(0, y, 0), i * 2.4 + rnd(), 0.75 + rnd() * 0.3, w * (0.22 - i * 0.012), w * 0.025, winter ? 2 : 1, 0.7)
    }
    crown = { cy: h * 0.58, rx: w * 0.5, ry: h * 0.42 }
  } else if (kind === 'maple') {
    // 밑동에서 4~5갈래 줄기
    const stems = 4 + Math.floor(rnd() * 2)
    const base = new Vector3(0, h * 0.12, 0)
    limb(limbs, new Vector3(0, 0, 0), base, w * 0.06, bark)
    for (let i = 0; i < stems; i += 1) {
      grow(base, (i / stems) * Math.PI * 2 + rnd() * 0.5, 0.28 + rnd() * 0.25, h * 0.3, w * 0.035, winter ? 3 : 2, 0.55)
    }
    crown = { cy: h * 0.62, rx: w * 0.5, ry: h * 0.34 }
  } else {
    // oak: 굵은 줄기 → 낮게 4~5갈래 큰 가지가 옆으로 뻗음
    const fork = new Vector3(0, h * 0.3, 0)
    limb(limbs, new Vector3(0, 0, 0), fork, w * 0.075, bark)
    limb(limbs, new Vector3(0, 0, 0), new Vector3(0, h * 0.06, 0), w * 0.11, bark) // 밑동 뿌리 부분
    const main = 4 + Math.floor(rnd() * 2)
    for (let i = 0; i < main; i += 1) {
      grow(fork, (i / main) * Math.PI * 2 + rnd() * 0.6, 0.65 + rnd() * 0.3, h * 0.24, w * 0.045, winter ? 3 : 2, 0.6)
    }
    crown = { cy: h * 0.64, rx: w * 0.5, ry: h * 0.34 }
  }

  const leaves = []
  if (!winter) {
    const palette = PALETTE[season]?.[kind] ?? PALETTE.summer.oak
    const count = kind === 'maple' ? 46 : kind === 'linden' ? 60 : 64
    const size = kind === 'maple' ? 0.13 : 0.16
    // 수관 겉면 근처에 잎 덩어리 (아래쪽·안쪽은 진하게)
    for (let i = 0; i < count; i += 1) {
      const u = rnd() * Math.PI * 2
      const v = Math.acos(1 - rnd() * 1.75) // 위쪽 위주 (맨 아래는 비움)
      const rr = 0.72 + rnd() * 0.3
      const x = Math.sin(v) * Math.cos(u) * crown.rx * rr
      const y = crown.cy + Math.cos(v) * crown.ry * rr
      const z = Math.sin(v) * Math.sin(u) * crown.rx * rr
      const s = w * size * (0.75 + rnd() * 0.55)
      const shade = y < crown.cy ? 0 : Math.floor(1 + rnd() * (palette.length - 1))
      leaves.push({ p: [x, y, z], s: [s, s * 0.78, s], r: [rnd(), rnd() * 3, rnd()], c: palette[shade % palette.length] })
    }
    // 가지 끝마다 작은 잎 덩어리
    tips.forEach((t, i) => {
      if (i % (kind === 'maple' ? 1 : 2)) return
      const s = w * size * 0.7
      leaves.push({ p: [t.x, t.y, t.z], s: [s, s * 0.8, s], r: [rnd(), rnd() * 3, 0], c: palette[(i + 1) % palette.length] })
    })
  } else {
    // 겨울: 굵은 가지 위에 쌓인 눈
    limbs.forEach((l, i) => {
      if (l.s[0] < w * 0.02 || i % 2) return
      leaves.push({ p: [l.p[0], l.p[1] + l.s[0] * 0.9, l.p[2]], s: [l.s[0] * 1.6, l.s[0] * 0.6, l.s[0] * 1.6], r: [0, 0, 0], c: '#f4f6f8' })
    })
  }
  return { limbs, leaves }
}

export default function HjTree({ item }) {
  const season = useSeason()
  const [w, h] = item.size
  const kind = item.kind ?? 'oak'
  const tree = useMemo(() => buildTree(item.id, kind, w, h, season), [item.id, kind, w, h, season])
  return (
    <group>
      <Instances key={`b${season}`} geometry={GEO.cyl8} material={BARK} items={tree.limbs} castShadow />
      {tree.leaves.length > 0 && <Instances key={`l${season}`} geometry={GEO.ico} material={LEAF} items={tree.leaves} castShadow={season !== 'winter'} />}
    </group>
  )
}
