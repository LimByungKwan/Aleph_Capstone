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
  // 관리자 2단계 인증: { enrolled, ok, required } (서버 /me·로그인 응답). mfaPrompt가 있으면 6자리 코드 창이 뜸
  mfa: null,
  mfaPrompt: null,
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
  // 서버에 "이 기기 로그인 끝"을 알림 → 이 토큰과 앞서 끊긴 옛 토큰이 다시 쓰이지 않게 (기다리지 않음, 실패해도 화면은 로그아웃)
  const token = useSessionStore.getState().session?.accessToken
  if (USE_SERVER && token) {
    fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => {})
  }
  save(null)
  useSessionStore.setState({ user: null, session: null, mfa: null, mfaPrompt: null })
}

// 계정당 로그인 1곳 (새 로그인 우선): 같은 계정으로 다른 기기에서 로그인하면 서버가 SESSION_REPLACED를 돌려줌
// → 이 기기는 로그아웃하고 이유를 로그인 창으로 알림 (모르는 사이에 다른 사람이 로그인했다면 여기서 알아챌 수 있음)
// 서버에 로그아웃을 다시 알리지 않는 이유: 기록은 이미 새 기기 것이라 바꿀 게 없음
export const SESSION_REPLACED_PROMPT = {
  title: '다른 기기에서 로그인했어요',
  reason: '같은 계정은 한 곳에서만 쓸 수 있어서 이 기기는 로그아웃됐어요. 내가 한 게 아니라면 다시 로그인한 뒤 비밀번호를 바꿔 주세요.',
}
export function handleSessionReplaced() {
  // 같은 브라우저의 다른 탭이 방금 새로 로그인해서 저장해 둔 값은 지우지 않음 (끊긴 게 저장된 그 토큰일 때만 지움)
  const mine = useSessionStore.getState().session?.accessToken
  const stored = loadSaved()
  if (!stored || stored.session.accessToken === mine) save(null)
  useSessionStore.setState({ user: null, session: null, mfa: null, mfaPrompt: null, loginPrompt: SESSION_REPLACED_PROMPT })
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
    // 끊긴 로그인은 토큰을 새로 받아도 session_id가 같아서 계속 거절됨 → refresh 없이 바로 로그아웃
    if (error.code === 'SESSION_REPLACED') handleSessionReplaced()
    // 2단계 인증을 등록한 관리자가 코드 없이 관리자 기능을 부름 → 코드 창
    if (error.code === 'MFA_REQUIRED') openMfaPrompt()
    if (error.code !== 'UNAUTHORIZED') throw error
    await refresh()
    return request(path, { ...options, token: useSessionStore.getState().session?.accessToken })
  }
}

/** 로그인 없이 부르는 API (가게 홍보문구 등) */
export const publicRequest = (path) => request(path)

export async function login({ email, password }) {
  const { session, user, mfa = null } = await request('/auth/login', { method: 'POST', body: { email, password } })
  setLoggedIn(session, user)
  // 2단계 인증을 등록한 관리자: 비밀번호 다음에 6자리 코드 창 (닫으면 순례객 기능만 됨)
  useSessionStore.setState({ mfa, mfaPrompt: mfa?.required ? MFA_PROMPT : null })
  return user
}

// ── 관리자 2단계 인증 (TOTP) — 서버 /auth/mfa/* (server/src/app.js) ──
const MFA_PROMPT = { reason: '이 관리자 계정은 2단계 인증을 켜 두었어요. 인증 앱에 보이는 6자리를 넣어 주세요.' }
export function openMfaPrompt() {
  useSessionStore.setState({ mfaPrompt: MFA_PROMPT })
}
export function closeMfaPrompt() {
  useSessionStore.setState({ mfaPrompt: null })
}
const MFA_OK = { enrolled: true, ok: true, required: false }

/** 로그인 2단계: 코드가 맞으면 aal2 토큰으로 바꿔 끼움 */
export async function verifyMfa(code) {
  const { session } = await authRequest('/auth/mfa/verify', { method: 'POST', body: { code } })
  setLoggedIn(session)
  useSessionStore.setState({ mfa: MFA_OK, mfaPrompt: null })
}

/** 등록 시작 (관리자만): { factorId, qrCode(data URI), secret } */
export function startMfaEnroll() {
  return authRequest('/auth/mfa/enroll', { method: 'POST' })
}

/** 등록 마무리: 앱에 뜬 코드로 확인 → 등록 완료 + 이번 로그인은 바로 aal2 */
export async function confirmMfaEnroll(factorId, code) {
  const { session } = await authRequest('/auth/mfa/enroll/verify', { method: 'POST', body: { factorId, code } })
  setLoggedIn(session)
  useSessionStore.setState({ mfa: MFA_OK, mfaPrompt: null })
}

export async function signup({ email, password, name, signupCode }) {
  const data = await request('/auth/signup', { method: 'POST', body: { email, password, name, signupCode } })
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

// 새로고침·재접속 때 저장된 사용자 정보(역할·이름)를 서버에서 다시 받음
// 이유: 로그인할 때 받은 user를 localStorage에 그대로 쓰면, 관리자가 SQL로 역할을 바꿔도
//       로그아웃→로그인 전까지 예전 역할(순례객)로 보임 (11/23 혜진·지민 관리자 지정 때 발생)
// 실패해도 저장된 값으로 계속 동작 (토큰이 완전히 만료됐으면 authRequest가 로그아웃 처리)
export async function refreshUser() {
  if (!USE_SERVER || !useSessionStore.getState().session) return
  try {
    const { user, mfa = null } = await authRequest('/me')
    const { session } = useSessionStore.getState()
    if (!session) return
    save({ session, user })
    // 새로고침했는데 코드를 아직 안 넣은 관리자(aal1)는 코드 창을 다시 띄움
    useSessionStore.setState({ user, mfa, ...(mfa?.required ? { mfaPrompt: MFA_PROMPT } : {}) })
  } catch {
    // 서버가 잠들어 있거나 네트워크 문제 → 다음 접속 때 다시 시도
  }
}

if (saved) refreshUser()
