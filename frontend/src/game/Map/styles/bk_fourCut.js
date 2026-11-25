// 인생네컷 사진 합치기 (담당: 병관) — 4컷을 세로로 이어 붙이고 분홍 테두리·제목·날짜·이름을 그림
// 외부 라이브러리·서버 없이 브라우저 2D 캔버스로 바로 완성 (components/photo/composePhoto.js와 같은 방식)

const W = 600 // 사진 너비(px)
const PAD = 30
const GAP = 16
const CUT_W = W - PAD * 2
const CUT_H = Math.round((CUT_W * 3) / 4) // 컷마다 4:3
const HEAD = 84
const FOOT = 96

const load = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

// 원본 화면에서 가운데를 4:3으로 잘라 그림
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** shots: data URL 4장 (못 찍은 칸은 빈 칸), names: ['민지', '준호'] 또는 [] → JPEG data URL */
export async function composeFourCut(shots, names = []) {
  const H = HEAD + 4 * CUT_H + 3 * GAP + FOOT
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#fce7f3')
  bg.addColorStop(1, '#f9a8d4')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#9d174d'
  ctx.textAlign = 'center'
  ctx.font = '800 30px "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillText('💕 인생네컷 💕', W / 2, 52)

  const imgs = await Promise.all(shots.slice(0, 4).map((src) => (src ? load(src).catch(() => null) : null)))
  for (let i = 0; i < 4; i++) {
    const y = HEAD + i * (CUT_H + GAP)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(PAD - 6, y - 6, CUT_W + 12, CUT_H + 12)
    if (imgs[i]) drawCover(ctx, imgs[i], PAD, y, CUT_W, CUT_H)
    else {
      ctx.fillStyle = '#fbcfe8'
      ctx.fillRect(PAD, y, CUT_W, CUT_H)
    }
  }

  const footY = HEAD + 4 * CUT_H + 3 * GAP
  ctx.fillStyle = '#831843'
  ctx.font = '700 22px "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillText(names.length === 2 ? `${names[0]} ♥ ${names[1]}` : '데이트 코스 커플 포토존', W / 2, footY + 44)
  ctx.font = '500 16px "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.fillStyle = '#9d174d'
  const d = new Date()
  ctx.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} · SceneWalk`, W / 2, footY + 74)

  return canvas.toDataURL('image/jpeg', 0.92)
}
