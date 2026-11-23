import { create } from 'zustand'
import { ApiError } from './errors.js'

// [지민] 로그인 상태 + 지민 API 서버(server/) 호출 도구
//
// VITE_API_URL 이 있으면 "서버 모드": 로그인하고 실제 DB(Supabase)에 저장
// 없으면 "mock 모드": 예전처럼 브라우저 localStorage(mockDb)로 동작 → 다른 팀원 로컬 개발은 그대로
//   로컬에서 서버 모드로 보려면 frontend/.env.local 에  VITE_API_URL=http://localhost:4000
//   배포(Vercel)는 환경변수에  VITE_API_URL=https://scenewalk-api.onrender.com
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const USE_SERVER = Boolean(API_URL)

// 토큰 보관: localStorage (새로고침해도 로그인 유지)
// 판단: httpOnly 쿠키가 XSS에 더 강하지만, 화면(Vercel)과 서버(Render) 도메인이 달라 쿠키 설정이 복잡해짐.
//       MVP에서는 localStorage + 짧은 만료(1시간) + refresh 토큰으로 타협. 화면에 사용자 입력을 HTML로 넣지 않음(React 기본 이스케이프)
const STORAGE_KEY = 'scenewalk-session-v1'
const TIMEOUT_MS = 70_000 // Render 무료 서버가 잠들어 있으면 첫 요청이 50초 넘게 걸릴 수 있음

function loadSaved() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    return saved?.session?.accessToken && saved?.user?.id ? saved : null
  } catch {
    return null
  }
}

function save(value) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 저장 못 해도 이번 접속에서는 동작
  }
}

const saved = USE_SERVER ? loadSaved() : null

/**
 * user: { id, email, name, role: 'pilgrim'|'owner'|'admin', shopId }
 * loginPrompt: 로그인 창이 열려 있으면 { title, reason } (닫혀 있으면 null)
 *   판단: 처음엔 로그인 없이 맵을 둘러보고, 스탬프처럼 "기록이 남는 행동"을 할 때만 로그인 창을 띄움
 */
export const useSessionStore = create(() => ({
  user: saved?.user ?? null,
  session: saved?.session ?? null,
  loginPrompt: null,
}))

/**
 * 로그인 창 열기
 * @param {{ title?: string, reason?: string }} [prompt] title: 창 제목, reason: 그 아래 한 줄 (왜 로그인이 필요한지)
 */
export function openLogin({ title = '', reason = '' } = {}) {
  if (!USE_SERVER) return
  useSessionStore.setState({ loginPrompt: { title, reason } })
}

export function closeLogin() {
  useSessionStore.setState({ loginPrompt: null })
}

function setLoggedIn(session, user) {
  const value = { session, user: user ?? useSessionStore.getState().user }
  save(value)
  useSessionStore.setState({ ...value, loginPrompt: null })
}

export function logout() {
  save(null)
  useSessionStore.setState({ user: null, session: null })
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ApiError('NETWORK', '서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(data?.error?.code ?? 'SERVER_ERROR', data?.error?.message ?? '잠시 뒤에 다시 시도해 주세요.')
  }
  return data
}

// 동시에 여러 요청이 만료를 만나도 refresh는 한 번만
let refreshing = null
async function refresh() {
  const refreshToken = useSessionStore.getState().session?.refreshToken
  if (!refreshToken) throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.')
  refreshing ??= request('/auth/refresh', { method: 'POST', body: { refreshToken } })
    .then(({ session }) => setLoggedIn(session))
    .catch((error) => {
      if (error.code === 'UNAUTHORIZED') logout()
      throw error
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** 로그인이 필요한 API 호출. 만료가 가까우면 먼저 토큰을 새로 받고, 401이면 한 번 더 시도 */
export async function authRequest(path, options = {}) {
  const { session } = useSessionStore.getState()
  if (!session) throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.')
  if (session.expiresAt && session.expiresAt * 1000 - Date.now() < 60_000) await refresh()
  try {
    return await request(path, { ...options, token: useSessionStore.getState().session?.accessToken })
  } catch (error) {
    if (error.code !== 'UNAUTHORIZED') throw error
    await refresh()
    return request(path, { ...options, token: useSessionStore.getState().session?.accessToken })
  }
}

/** 로그인 없이 부르는 API (가게 홍보문구 등) */
export const publicRequest = (path) => request(path)

export async function login({ email, password }) {
  const { session, user } = await request('/auth/login', { method: 'POST', body: { email, password } })
  setLoggedIn(session, user)
  return user
}

export async function signup({ email, password, name }) {
  const data = await request('/auth/signup', { method: 'POST', body: { email, password, name } })
  if (data.needsEmailConfirm) throw new ApiError('EMAIL_NOT_CONFIRMED', '메일함에서 인증 링크를 누른 뒤 로그인해 주세요.')
  setLoggedIn(data.session, data.user)
  return data.user
}

/** 닉네임 바꾸기 (1~20자). 멀티 접속 이름표는 realtimeStore가 이름 변경을 보고 다시 연결해서 바뀜 */
export async function updateName(name) {
  const { user } = await authRequest('/me', { method: 'PATCH', body: { name } })
  const { session } = useSessionStore.getState()
  save({ session, user })
  useSessionStore.setState({ user })
  return user
}

/** Render 서버 미리 깨우기 (로그인 화면이 뜰 때 한 번) */
export function wakeServer() {
  if (USE_SERVER) fetch(`${API_URL}/health`).catch(() => {})
}
