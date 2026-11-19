import { useEffect, useState } from 'react'
import { login, logout, signup, useSessionStore, wakeServer } from '../../api/session.js'
import '../movieZone/ui.css'
import '../movieZone/ui-components.css'
import './auth.css'

// [지민] 회원가입 · 로그인 화면 (서버 모드에서 로그인 전에만 보임)
// 3D 맵과 따로 그리는 이유: 맵이 떠 있으면 입력칸에 친 W·A·S·D·E가 캐릭터 조작으로도 들어감
export default function LoginPage() {
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
      // 로그인되면 App이 3D 맵으로 바꿔 그림 (광장에서 시작)
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
        <p className="auth-brand">SceneWalk AI</p>
        <h1 className="auth-title">{isSignup ? '처음 오셨군요' : '다시 오셨네요'}</h1>
        <p className="ui-sub">성지 골목을 걸으며 스탬프를 모아 보세요.</p>

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

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(isSignup ? 'login' : 'signup')
            setError('')
          }}
        >
          {isSignup ? '이미 계정이 있어요 → 로그인' : '처음이에요 → 회원가입'}
        </button>
      </main>
    </div>
  )
}

// 3D 맵 위 오른쪽 위: 지금 누구로 로그인했는지 + 로그아웃
export function AccountBox() {
  const user = useSessionStore((s) => s.user)
  if (!user) return null
  const roleLabel = { pilgrim: '순례객', owner: '사장님', admin: '관리자' }[user.role] ?? ''
  return (
    <div className="ui-role ui-interactive auth-account">
      <span>
        {user.name} <small>· {roleLabel}</small>
      </span>
      <button type="button" className="ui-btn" onClick={(e) => (e.currentTarget.blur(), logout())}>
        로그아웃
      </button>
    </div>
  )
}
