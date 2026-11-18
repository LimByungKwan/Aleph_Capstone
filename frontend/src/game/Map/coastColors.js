import { Color, MathUtils } from 'three'
import { coastPoint } from './seabed.js'

// Shared by the beach and its continuation, including the narrow foam strip.
export function coastRows(index) {
  const { z: shore } = coastPoint(index)
  const width = Math.min(1, (130 - shore) / 23)
  return [
    [shore, '#c0ba9f'], [shore + 2 * width, '#e2d4ac'],
    [shore + 9 * width, '#f2d79f'], [shore + 11 * width, '#cba978'],
    [shore + (11.5 + .20 * Math.sin(index * .7)) * width, '#eefbf1'],
    [shore + 12 * width, '#94ddd0'], [shore + 19 * width, '#53b8b9'],
    [shore + (130 - shore) * .30 + 15 * width, '#369aa9'], [130, '#286f91'],
  ]
}

export function coastColorAt(rows, z) {
  if (z <= rows[0][0]) return new Color(rows[0][1])
  for (let i = 1; i < rows.length; i++) {
    if (z <= rows[i][0]) {
      const [from, a] = rows[i - 1]
      const [to, b] = rows[i]
      return new Color(a).lerp(new Color(b), MathUtils.clamp((z - from) / (to - from), 0, 1))
    }
  }
  return new Color(rows.at(-1)[1])
}
