// AI 가이드 '루미' 코스 추천 API (담당: 병관, 서버는 저장소의 ai/ 폴더)
//
// 로컬 개발: ai/ 폴더에서 uvicorn을 8000번 포트로 켜 두면 됨 (ai/README.md)
// 배포: Vercel 환경변수 VITE_AI_API_URL 에 AI 서버 주소를 넣음 (예: https://scenewalk-ai.onrender.com)

import { ApiError } from './client.js'

const AI_API_URL = (import.meta.env.VITE_AI_API_URL || 'http://localhost:8000').replace(/\/$/, '')
// Render 무료 서버는 15분 쉬면 잠들어서, 첫 요청은 깨어나는 데 1분 가까이 걸릴 수 있음
const TIMEOUT_MS = 90000

// 취향 문장 → { reply, course: [{ placeId, name, zone, zoneName, type, position, reason }], nextPlaceId, source }
export async function recommendCourse({ message, count = 3 }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${AI_API_URL}/course`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, count }),
      signal: controller.signal,
    })
  } catch {
    throw new ApiError('AI_OFFLINE', '루미가 지금 쉬는 중이에요. 잠시 후 다시 말을 걸어 주세요.')
  } finally {
    clearTimeout(timer)
  }
  if (response.status === 429) throw new ApiError('RATE_LIMITED', '오늘 루미에게 많이 물어봤어요. 잠시 후 다시 말을 걸어 주세요.')
  if (response.status === 422) throw new ApiError('BAD_REQUEST', '취향을 한 줄로 조금 더 알려 주세요. (300자 이내)')
  if (!response.ok) throw new ApiError('AI_ERROR', '코스를 고르다가 문제가 생겼어요. 다시 한번 말해 주세요.')
  return response.json()
}
