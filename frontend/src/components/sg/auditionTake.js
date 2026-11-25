// 썬그레이 오디션 녹음 → wav 변환 → AI 서버 업로드. 담당: 성근(SG)
// 흐름: const { stream } = await detectMicMode()  (micMode.js)
//       const take = recordTake(stream, songEnd + 2.5)
//       const wav = await take.done                // 녹음이 끝나면 마이크(stream)는 여기서 이미 닫혀 있음
//       const { score, notes, feedback } = await uploadTake('sungray-01', wav)  // 화면: AuditionPanel.jsx
// 서버는 ai/app/audition.py (3MB·곡 끝+6초까지 wav를 받음)

import { ApiError } from '../../api/errors.js'

const AI_API_URL = (import.meta.env.VITE_AI_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const TIMEOUT_MS = 90000 // Render 무료 서버가 잠에서 깨는 시간 (api/course.js와 같은 값)

// 최대 maxSeconds초 녹음. 끝나면(시간 초과·stop()·오류) 마이크를 바로 닫고 done이 wav Blob으로 끝남
export function recordTake(stream, maxSeconds) {
  const recorder = new MediaRecorder(stream)
  const chunks = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => {
      clearTimeout(timer)
      stream.getTracks().forEach((t) => t.stop())
      toWav(new Blob(chunks, { type: recorder.mimeType })).then(resolve, reject)
    }
    recorder.onerror = (e) => recorder.state !== 'inactive' ? recorder.stop() : reject(e.error)
  })
  const stop = () => recorder.state !== 'inactive' && recorder.stop()
  const timer = setTimeout(stop, maxSeconds * 1000)
  recorder.start()
  return { done, stop } // 패널을 닫거나 구역을 떠날 때도 stop()을 불러야 마이크가 꺼짐
}

// 브라우저 녹음 형식(webm, mp4 등) → 모노 16비트 wav. 샘플레이트는 브라우저 값 그대로 (서버가 맞춤)
async function toWav(blob) {
  const ctx = new AudioContext()
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
    const mono = new Float32Array(audio.length)
    for (let c = 0; c < audio.numberOfChannels; c++) {
      audio.getChannelData(c).forEach((v, i) => { mono[i] += v / audio.numberOfChannels })
    }
    return new Blob([encodeWav(mono, audio.sampleRate)], { type: 'audio/wav' })
  } finally {
    ctx.close()
  }
}

// -1~1 소리 값 → wav 파일 바이트 (44바이트 헤더 + 16비트 PCM)
export function encodeWav(samples, sampleRate) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (at, s) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true) // 모노, 샘플레이트
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples.length * 2, true)
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return view.buffer
}

// wav Blob → { songId, duration }. 실패하면 ApiError(code)로 안내 문구를 고른다
export async function uploadTake(songId, wav) {
  const form = new FormData()
  form.append('songId', songId)
  form.append('audio', wav, 'take.wav')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${AI_API_URL}/audition/upload`, { method: 'POST', body: form, signal: controller.signal })
  } catch {
    throw new ApiError('AI_OFFLINE', '심사 서버가 지금 쉬는 중이에요. 잠시 후 다시 도전해 주세요.')
  } finally {
    clearTimeout(timer)
  }
  if (response.ok) return response.json()
  if (response.status === 429) throw new ApiError('RATE_LIMITED', '도전이 너무 잦아요. 1분쯤 뒤에 다시 해 주세요.')
  if (response.status === 413) throw new ApiError('TOO_LARGE', '녹음이 너무 길어요. 다시 도전해 주세요.')
  if (response.status === 400) {
    const { detail } = await response.json().catch(() => ({}))
    throw new ApiError('BAD_TAKE', detail || '녹음을 확인할 수 없어요. 다시 도전해 주세요.')
  }
  throw new ApiError('AI_ERROR', '심사 서버에서 문제가 생겼어요. 다시 한번 해 주세요.')
}

export async function submitKeyboard(songId, presses) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${AI_API_URL}/audition/keyboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, presses }),
      signal: controller.signal,
    })
    if (response.ok) return await response.json()
  } catch {
    throw new ApiError('AI_OFFLINE', '심사 서버가 지금 쉬는 중이에요. 잠시 후 다시 도전해 주세요.')
  } finally {
    clearTimeout(timer)
  }
  if (response.status === 429) throw new ApiError('RATE_LIMITED', '도전이 너무 잦아요. 1분쯤 뒤에 다시 해 주세요.')
  if (response.status === 400 || response.status === 422) throw new ApiError('BAD_TAKE', '키 입력을 확인할 수 없어요. 다시 도전해 주세요.')
  throw new ApiError('AI_ERROR', '심사 서버에서 문제가 생겼어요. 다시 한번 해 주세요.')
}
