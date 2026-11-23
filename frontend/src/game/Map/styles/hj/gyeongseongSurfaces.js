import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { seeded } from '../kit.jsx'

function texture(draw, seed, repeat = [1, 1]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  draw(canvas.getContext('2d'), seeded(seed))
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  map.repeat.set(...repeat)
  map.anisotropy = 4
  return map
}

function speckle(context, random, count) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * 512
    const y = random() * 512
    context.globalAlpha = .035 + random() * .10
    context.fillStyle = i % 3 ? '#48352b' : '#fff5d4'
    context.fillRect(x, y, .4 + random() * 2.8, .5 + random() * 1.7)
  }
  context.globalAlpha = 1
}

export function streetRoadTexture() {
  return texture((context, random) => {
    context.fillStyle = '#b3a28a'
    context.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 1500; i += 1) {
      const x = random() * 512
      const y = random() * 512
      const length = 2 + random() * 25
      context.globalAlpha = .017 + random() * .08
      context.fillStyle = i % 2 ? '#6c5748' : '#f3e0bd'
      context.beginPath()
      context.ellipse(x, y, length * .25, length, random() * .2, 0, Math.PI * 2)
      context.fill()
    }
    speckle(context, random, 32000)
  }, 663, [2.4, 8])
}

export function streetStuccoTexture() {
  return texture((context, random) => {
    const wash = context.createLinearGradient(0, 0, 0, 512)
    wash.addColorStop(0, '#eeebe3')
    wash.addColorStop(.26, '#ffffff')
    wash.addColorStop(.69, '#f3eee4')
    wash.addColorStop(1, '#c5b9a8')
    context.fillStyle = wash
    context.fillRect(0, 0, 512, 512)
    for (let index = 0; index < 210; index += 1) {
      const x = random() * 512
      const y = random() * 512
      const radius = 3 + random() * 26
      const stain = context.createRadialGradient(x, y, 0, x, y, radius)
      stain.addColorStop(0, index % 3 ? 'rgba(113,90,64,.11)' : 'rgba(255,249,234,.24)')
      stain.addColorStop(1, 'rgba(153,135,113,0)')
      context.fillStyle = stain
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }
    speckle(context, random, 19500)
  }, 112)
}
