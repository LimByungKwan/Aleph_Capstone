// (담당: 병관) 노을등 정자의 서로 다른 발판에서 두 사람이 보낸 기분을 짝짓기
import { MOODS, pavilionPad, pavilionPrompt } from '../../shared/bk_pavilion.js'

export function createPavilion({ send, waitMs = 20_000 }) {
  const waiting = new Map()

  function clear(ws) {
    const entry = waiting.get(ws)
    if (entry) clearTimeout(entry.timer)
    waiting.delete(ws)
  }

  function handle(ws, peer, msg) {
    if (msg.t === 'episode.pavilion.cancel') {
      clear(ws)
      return
    }
    if (msg.t !== 'episode.pavilion.light' || typeof msg.mood !== 'string' || !Object.hasOwn(MOODS, msg.mood) || waiting.has(ws)) return
    const pad = pavilionPad(peer.state)
    if (pad < 0) {
      send(ws, { t: 'episode.pavilion.status', status: 'off_pad' })
      return
    }
    for (const [other, entry] of waiting) {
      if (pavilionPad(entry.peer.state) !== entry.pad) {
        clear(other)
        send(other, { t: 'episode.pavilion.status', status: 'off_pad' })
        continue
      }
      if (entry.pad === pad) continue
      clear(other)
      const moods = pad === 0 ? [msg.mood, entry.mood] : [entry.mood, msg.mood]
      const result = { t: 'episode.pavilion.status', status: 'lit', moods, prompt: pavilionPrompt(...moods) }
      send(ws, result)
      send(other, result)
      return
    }
    const timer = setTimeout(() => {
      clear(ws)
      send(ws, { t: 'episode.pavilion.status', status: 'expired' })
    }, waitMs)
    timer.unref?.()
    waiting.set(ws, { peer, pad, mood: msg.mood, timer })
    send(ws, { t: 'episode.pavilion.status', status: 'waiting' })
  }

  return { handle, disconnect: clear }
}
