import places from '@shared/places.json'
import { zones } from '../../game/data/mapData.js'
import { playerPose } from '../../store/playerPose.js'
import { useGameStore } from '../../store/gameStore.js'

// 인증샷 사진 만들기 (담당: 병관) — 게임 화면 + 폴라로이드 테두리 + 장소·날짜·로고
// 그림은 2D 캔버스로 직접 그려서 외부 라이브러리·서버 없이 브라우저에서 바로 완성

const MAX_WIDTH = 1600
const HUB = { name: '중앙 광장', color: '#e9c46a' }

// 지금 어디서 찍었나: 지점 원 안 → 그 장소 / 20m 안 가장 가까운 장소 / 구역 / 광장
export function whereAmI() {
  const nearbyId = useGameStore.getState().nearbyPlaceId
  let place = places.find((p) => p.id === nearbyId && p.type !== 'npc') ?? null
  if (!place && playerPose.ready) {
    let best = 20
    for (const p of places) {
      if (p.type === 'npc') continue
      const d = Math.hypot(p.position[0] - playerPose.x, p.position[2] - playerPose.z)
      if (d < best) {
        best = d
        place = p
      }
    }
  }
  const zone = zones.find((z) => {
    const [ox, oz] = z.origin
    const [w, d] = z.size
    return Math.abs(playerPose.x - ox) <= w / 2 && Math.abs(playerPose.z - oz) <= d / 2
  })
  const zoneFor = place ? zones.find((z) => z.zoneId === place.zone) : zone
  return {
    place: place?.name ?? null,
    zoneName: zoneFor ? `${zoneFor.name} 구역` : HUB.name,
    color: zoneFor?.color ?? HUB.color,
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function todayText() {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 3D 화면 이미지(src) → 테두리 씌운 JPEG data URL
export async function composePhoto(src, info) {
  const shot = await loadImage(src)
  const scale = Math.min(1, MAX_WIDTH / shot.width)
  const w = Math.round(shot.width * scale)
  const h = Math.round(shot.height * scale)
  const pad = Math.round(w * 0.025) // 테두리 두께
  const band = Math.round(Math.max(110, w * 0.11)) // 아래 글자 띠
  const canvas = document.createElement('canvas')
  canvas.width = w + pad * 2
  canvas.height = h + pad * 2 + band
  const ctx = canvas.getContext('2d')

  // 종이색 바탕 + 사진
  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(shot, pad, pad, w, h)

  // 구역 색 줄
  ctx.fillStyle = info.color
  ctx.fillRect(pad, pad + h, w, Math.max(4, Math.round(band * 0.05)))

  const base = pad + h + band * 0.12
  const big = Math.round(band * 0.27)
  const small = Math.round(band * 0.16)
  const font = "'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif"

  // 왼쪽: 장소 + 구역·날짜
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#2c2a29'
  ctx.font = `700 ${big}px ${font}`
  const title = info.place ? `${info.place}에서` : `${info.zoneName}에서`
  ctx.fillText(title, pad + small * 0.4, base + band * 0.08, w * 0.68)
  ctx.fillStyle = '#7a736d'
  ctx.font = `400 ${small}px ${font}`
  ctx.fillText(`${info.place ? `${info.zoneName} · ` : ''}${todayText()}  #SceneWalk #가상성지순례`, pad + small * 0.4, base + band * 0.08 + big * 1.35, w * 0.68)

  // 오른쪽: 로고
  ctx.textAlign = 'right'
  ctx.font = `900 ${Math.round(big * 1.05)}px 'Noto Serif KR', 'Nanum Myeongjo', serif`
  const logoY = base + band * 0.18
  const walkWidth = ctx.measureText('Walk').width
  ctx.fillStyle = '#c86d51'
  ctx.fillText('Walk', canvas.width - pad - small * 0.4, logoY)
  ctx.fillStyle = '#2c2a29'
  ctx.fillText('Scene', canvas.width - pad - small * 0.4 - walkWidth, logoY)

  return canvas.toDataURL('image/jpeg', 0.92)
}
