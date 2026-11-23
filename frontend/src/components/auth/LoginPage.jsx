import { useEffect, useState } from 'react'
import { closeLogin, login, logout, openLogin, signup, updateName, useSessionStore, wakeServer } from '../../api/session.js'
import '../movieZone/ui.css'
import '../movieZone/ui-components.css'
import './auth.css'

// [지민] 회원가입 · 로그인 화면
// 처음엔 로그인 없이 맵을 둘러보고, 스탬프를 받으려 하거나 오른쪽 위 '로그인'을 누르면 맵 위에 창으로 뜸 (LoginModal)
// 맵 위에 떠 있어도 입력칸에 친 W·A·S·D·E가 캐릭터 조작으로 새지 않게 키 이벤트를 창 안에서 멈춤
export default function LoginPage({ title = '', reason = '', onClose = null }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
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
  return (
    <div className="ui-page auth-page">
      <main className="auth-card ui-card">
        {onClose && (
          <button type="button" className="auth-close" aria-label="닫고 계속 둘러보기" onClick={onClose}>
            ×
          </button>
        )}
        <p className="auth-brand">SceneWalk AI</p>
        {/* 제목: 왜 창이 떴는지(스탬프 찍기 등)를 먼저 말함. 회원가입으로 바꾸면 가입용 문장 */}
        <h1 className="auth-title">{isSignup ? '회원가입하고 스탬프를 모아요' : title || '로그인하고 스탬프를 모아요'}</h1>
        <p className="ui-sub">
          {isSignup ? '이메일과 비밀번호만 있으면 바로 시작할 수 있어요.' : reason || '로그인 없이도 골목은 둘러볼 수 있어요. 스탬프를 찍을 때만 로그인이 필요해요.'}
        </p>

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

          {error && (
            <p className="ui-field__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="ui-btn ui-btn--primary auth-submit" disabled={busy || !form.email || !form.password}>
            {busy ? '잠시만요… (서버가 깨어나는 중이면 1분쯤 걸려요)' : isSignup ? '가입하고 시작하기' : '로그인'}
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
          {isSignup ? '로그인하기' : '회원가입하기'}
        </button>
        {onClose && (
          <button type="button" className="auth-switch" onClick={onClose}>
            로그인 없이 계속 둘러보기
          </button>
        )}
      </main>
    </div>
  )
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
