import { useEffect, useState } from 'react'
import {
  closeLogin,
  login,
  logout,
  openLogin,
  signup,
  updateName,
  useSessionStore,
  wakeServer,
} from '../../api/session.js'
import { usePreload } from './jm_preload.js'
import { GateOverlay, MapLoadingLook } from './jm_EntryScreen.jsx'
import '../movieZone/ui.css'
import '../movieZone/ui-components.css'
import './auth.css'

// [지민] 회원가입 · 로그인 화면
// 11/27부터: 손님 없음 — 서버 모드에선 로그인해야 맵에 들어감 (LoginGate가 맵 대신 이 화면을 보여 줌)
//   회원가입은 가입 코드가 있어야 함. 맵 안에서는 다시 로그인이 필요할 때만 창으로 뜸 (LoginModal)
// 맵 위에 떠 있어도 입력칸에 친 W·A·S·D·E가 캐릭터 조작으로 새지 않게 키 이벤트를 창 안에서 멈춤
export default function LoginPage({ title = '', reason = '', onClose = null }) {
  return (
    <div className="ui-page auth-page">
      <main className="auth-card ui-card">
        {onClose && (
          <button type="button" className="auth-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        )}
        <p className="auth-brand">SceneWalk AI</p>
        <LoginForm title={title} reason={reason} onClose={onClose} />
      </main>
    </div>
  )
}

// 로그인·회원가입 입력 부분 (창 틀 없이) — 맵 위 로그인 창(LoginPage)과 첫 화면(EntryScreen)이 같이 씀
function LoginForm({ title = '', reason = '', onClose = null }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', name: '', signupCode: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    wakeServer() // 무료 서버가 잠들어 있으면 입력하는 동안 깨워 둠
  }, [])

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }
    if (mode === 'signup' && !form.signupCode.trim()) {
      setError('가입 코드를 넣어 주세요.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await login(form)
      else await signup(form)
      // 로그인되면 창이 닫히고 하던 곳에서 그대로 이어짐 (setLoggedIn이 loginPrompt를 지움)
    } catch (err) {
      setError(err?.message ?? '잠시 뒤에 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'
  const serverReady = usePreload((s) => s.server === 'ready' || s.server === 'off')
  return (
    <>
        {/* 제목: 왜 창이 떴는지(스탬프 찍기 등)를 먼저 말함. 회원가입으로 바꾸면 가입용 문장 */}
        <h1 className="auth-title" id="auth-heading">{isSignup ? '회원가입' : title || '로그인'}</h1>
        <p className="ui-sub">{isSignup ? '팀에게 받은 가입 코드가 있어야 가입할 수 있어요.' : reason || 'SceneWalk는 회원만 이용할 수 있어요.'}</p>

        <form onSubmit={submit} noValidate>
          <div className="ui-field">
            <label htmlFor="auth-email">이메일</label>
            <input id="auth-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          </div>
          <div className="ui-field">
            <label htmlFor="auth-password">비밀번호</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={update('password')}
              required
            />
            {isSignup && <span className="ui-field__hint">6자 이상</span>}
          </div>
          {isSignup && (
            <div className="ui-field">
              <label htmlFor="auth-name">닉네임</label>
              <input id="auth-name" maxLength={20} value={form.name} onChange={update('name')} placeholder="순례객" />
            </div>
          )}
          {/* [지민] 가입 코드: 아는 사람만 가입 (DB 트리거가 최종 검사 — supabase/migrations/20261202120000_jm_signup_code.sql) */}
          {isSignup && (
            <div className="ui-field">
              <label htmlFor="auth-signup-code">가입 코드</label>
              <input
                id="auth-signup-code"
                autoComplete="off"
                maxLength={64}
                value={form.signupCode}
                onChange={update('signupCode')}
                required
              />
              <span className="ui-field__hint">팀에게 안내받은 코드</span>
            </div>
          )}

          {error && (
            <p className="ui-field__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="ui-btn ui-btn--primary auth-submit" disabled={busy || !form.email || !form.password || (isSignup && !form.signupCode.trim())}>
            {busy ? (serverReady ? '잠시만요…' : '서버가 깨어나면 바로 이어서 진행돼요…') : isSignup ? '가입하고 시작하기' : '로그인'}
          </button>
        </form>

        {/* 로그인이 먼저, 회원가입도 글자 링크가 아니라 버튼으로 바로 보이게 */}
        <div className="auth-divider" aria-hidden="true">
          <span>{isSignup ? '이미 계정이 있나요?' : '처음 오셨나요?'}</span>
        </div>
        <button
          type="button"
          className="ui-btn auth-alt"
          onClick={() => {
            setMode(isSignup ? 'login' : 'signup')
            setError('')
          }}
        >
          {isSignup ? (
            '로그인하기'
          ) : (
            <>
              회원가입하기
              {/* 말풍선: 가입 코드가 있어야 한다는 걸 버튼에 붙여서 보여 줌 */}
              <span className="auth-bubble">가입 코드 필요</span>
            </>
          )}
        </button>
        {onClose && (
          <button type="button" className="auth-switch" onClick={onClose}>
            닫기
          </button>
        )}
    </>
  )
}

// [지민] 로그인 전: 로딩이 끝나면 캐릭터 없는 맵 전체 위에 뜨는 로그인 창 (App.jsx). 닫기 버튼 없음
//   다른 기기 로그인으로 끊겨서 돌아온 경우 등은 그 이유(loginPrompt)를 제목·설명으로 보여 줌
//   entering: 로그인은 끝났고 캐릭터·첫 화면을 준비하는 중 → 입력 칸 대신 "입장하는 중…"
export function LoginGate({ entering = false }) {
  const prompt = useSessionStore((s) => s.loginPrompt)
  return <GateOverlay entering={entering}>{entering ? null : <LoginForm title={prompt?.title} reason={prompt?.reason} />}</GateOverlay>
}

// 게임 코드(약 7MB)를 받는 동안 (App.jsx의 Suspense 자리) — 병관님 로딩 화면과 같은 모양
export function MapLoading() {
  return <MapLoadingLook />
}

// 맵 위에 뜨는 로그인 창 (openLogin()으로 열림)
export function LoginModal() {
  const prompt = useSessionStore((s) => s.loginPrompt)
  if (!prompt) return null
  // 창 안의 키 입력은 여기서 멈춤 → window에 붙은 캐릭터·체험 조작(WASD, E, Space)으로 새지 않음
  const stop = (event) => {
    if (event.key === 'Escape') closeLogin()
    event.stopPropagation()
  }
  return (
    <div className="auth-overlay ui-interactive" role="dialog" aria-modal="true" aria-label="로그인" onKeyDown={stop} onKeyUp={stop}>
      <LoginPage title={prompt.title} reason={prompt.reason} onClose={closeLogin} />
    </div>
  )
}

// 3D 맵 위 오른쪽 위: 지금 누구로 로그인했는지 + 로그아웃 (손님이면 로그인 버튼)
export function AccountBox() {
  const user = useSessionStore((s) => s.user)
  if (!user) {
    return (
      <div className="ui-role ui-interactive auth-account">
        <span>
          손님 <small>· 둘러보는 중</small>
        </span>
        <button type="button" className="ui-btn ui-btn--primary" onClick={(e) => (e.currentTarget.blur(), openLogin())}>
          로그인
        </button>
      </div>
    )
  }
  return <AccountInfo user={user} />
}

// 로그인한 사람: 이름 · 역할 · 닉네임 바꾸기(✎) · 로그아웃
function AccountInfo({ user }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const roleLabel = { pilgrim: '순례객', owner: '사장님', admin: '관리자' }[user.role] ?? ''

  function startEdit(event) {
    event.currentTarget.blur()
    setName(user.name)
    setError('')
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    const next = name.trim()
    if (!next) return setError('1~20자로 입력해 주세요.')
    if (next === user.name) return setEditing(false)
    setBusy(true)
    setError('')
    try {
      await updateName(next)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // 입력칸에 친 W·A·S·D·E·Space가 캐릭터 조작으로 새지 않게 막음
  const stop = (event) => {
    if (event.key === 'Escape') setEditing(false)
    event.stopPropagation()
  }

  if (editing) {
    return (
      <form className="ui-role ui-interactive auth-account" onSubmit={save} onKeyDown={stop} onKeyUp={stop}>
        <input
          className="auth-name-input"
          aria-label="새 닉네임"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
        <button type="button" className="ui-btn" onClick={() => setEditing(false)} disabled={busy}>
          취소
        </button>
        {error && <small className="auth-name-error" role="alert">{error}</small>}
      </form>
    )
  }

  return (
    <div className="ui-role ui-interactive auth-account">
      <span>
        {user.name} <small>· {roleLabel}</small>
      </span>
      <button type="button" className="ui-btn" onClick={startEdit} title="닉네임 바꾸기" aria-label="닉네임 바꾸기">
        ✎
      </button>
      <button type="button" className="ui-btn" onClick={(e) => (e.currentTarget.blur(), logout())}>
        로그아웃
      </button>
    </div>
  )
}
