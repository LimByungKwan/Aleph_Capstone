// 효과음 엔진 (담당: 병관) — 소리 파일 없이 Web Audio로 직접 만든 소리 → 저작권 걱정 없음, 다운로드도 0
// - 브라우저 규칙: 사용자가 화면을 한 번 누르거나 키를 눌러야 소리를 낼 수 있음 → 첫 입력 때 켬
// - 음소거는 localStorage에 기억 (기본: 소리 켜짐, 볼륨 작게)

const KEY = 'scenewalk.sound'
const MASTER_VOLUME = 0.35

let ctx = null
let master = null
let noiseBuffer = null
let muted = readMuted()
const listeners = new Set()

function readMuted() {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(KEY, value ? 'off' : 'on')
  } catch {
    // 저장이 막힌 브라우저면 이번 접속에서만
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05)
  listeners.forEach((fn) => fn(value))
}

export function onMuteChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 첫 클릭·터치·키 입력 때 오디오 켜기 (그 전에는 소리를 내지 않음)
function unlock() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_VOLUME
    master.connect(ctx.destination)
    // 1초짜리 하얀 소음 (발소리·물소리·셔터의 재료)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
}
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, unlock, { passive: true })
}

const ready = () => ctx && ctx.state === 'running' && !muted

// ── 재료: 짧은 음(tone)과 소음(noise) ─────────────────
function tone(freq, { start = 0, duration = 0.3, gain = 0.3, type = 'sine', slideTo } = {}) {
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

function noise({ start = 0, duration = 0.08, gain = 0.2, filter = 'bandpass', freq = 800, q = 1 } = {}) {
  const t = ctx.currentTime + start
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(f).connect(g).connect(master)
  src.start(t, Math.random() * 0.8)
  src.stop(t + duration + 0.02)
}

// ── 효과음들 ────────────────────────────────
export const sfx = {
  // 발소리 (달리면 조금 더 크고 높게)
  step(run = false) {
    if (!ready()) return
    noise({ duration: run ? 0.07 : 0.09, gain: run ? 0.16 : 0.12, freq: (run ? 900 : 650) * (0.85 + Math.random() * 0.3), q: 1.2 })
    tone(run ? 95 : 80, { duration: 0.06, gain: 0.05, slideTo: 55 })
  },
  // 스탬프 "쾅"
  stamp() {
    if (!ready()) return
    tone(140, { duration: 0.22, gain: 0.45, slideTo: 55 })
    noise({ duration: 0.06, gain: 0.25, filter: 'lowpass', freq: 1800 })
  },
  // 목적지 도착 "띵"
  arrive() {
    if (!ready()) return
    tone(1318.5, { duration: 0.6, gain: 0.18, type: 'triangle' })
    tone(1975.5, { start: 0.12, duration: 0.7, gain: 0.14, type: 'triangle' })
  },
  // 코스 완주 · 배지 "빠라밤"
  fanfare() {
    if (!ready()) return
    ;[523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, { start: i * 0.11, duration: i === 3 ? 0.7 : 0.25, gain: 0.18, type: 'triangle' }))
  },
  // 인증샷 "찰칵"
  shutter() {
    if (!ready()) return
    noise({ duration: 0.04, gain: 0.35, filter: 'highpass', freq: 2500 })
    noise({ start: 0.07, duration: 0.05, gain: 0.25, filter: 'highpass', freq: 1800 })
  },
}

// ── 분수 물소리 (계속 흐르는 소리, 거리에 따라 크기만 바뀜) ─────────
let water = null
export function setWaterLevel(level) {
  if (!ctx || ctx.state !== 'running') return
  if (!water) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'bandpass'
    lp.frequency.value = 1400
    lp.Q.value = 0.6
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(lp).connect(g).connect(master)
    src.start()
    water = { gain: g, filter: lp }
  }
  water.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, ctx.currentTime, 0.3)
  water.filter.frequency.setTargetAtTime(1200 + Math.random() * 400, ctx.currentTime, 0.4) // 살짝 출렁이게
}
