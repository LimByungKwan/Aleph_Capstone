import { useEffect, useState } from 'react'
import {
  closeLogin,
  closeMfaPrompt,
  confirmMfaEnroll,
  login,
  logout,
  openLogin,
  openMfaPrompt,
  signup,
  startMfaEnroll,
  updateName,
  useSessionStore,
  verifyMfa,
  wakeServer,
} from '../../api/session.js'
import '../movieZone/ui.css'
import '../movieZone/ui-components.css'
import './auth.css'

// [지민] 회원가입 · 로그인 화면
// 처음엔 로그인 없이 맵을 둘러보고, 스탬프를 받으려 하거나 오른쪽 위 '로그인'을 누르면 맵 위에 창으로 뜸 (LoginModal)
// 맵 위에 떠 있어도 입력칸에 친 W·A·S·D·E가 캐릭터 조작으로 새지 않게 키 이벤트를 창 안에서 멈춤
export default function LoginPage({ title = '', reason = '', onClose = null }) {
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
          {isSignup ? '안내받은 가입 코드와 이메일·비밀번호로 시작할 수 있어요.' : reason || '로그인 없이도 골목은 둘러볼 수 있어요. 스탬프를 찍을 때만 로그인이 필요해요.'}
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

// 맵 위에 뜨는 로그인 창 (openLogin()으로 열림) + 관리자 2단계 인증 코드 창 (App.jsx가 이 컴포넌트 하나만 붙임)
export function LoginModal() {
  const prompt = useSessionStore((s) => s.loginPrompt)
  if (!prompt) return <MfaCodeModal />
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

// ── 관리자 2단계 인증 (TOTP) ──
// 6자리 숫자 입력칸 (붙여 넣은 값에서 숫자만 남김)
function CodeInput({ value, onChange, disabled }) {
  return (
    <div className="ui-field">
      <label htmlFor="auth-mfa-code">인증 앱의 6자리</label>
      <input
        id="auth-mfa-code"
        className="auth-code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled}
        autoFocus
      />
    </div>
  )
}

// 창 틀: 키 입력이 캐릭터 조작으로 새지 않게 + Esc로 닫기
function AuthDialog({ label, onClose, children }) {
  const stop = (event) => {
    if (event.key === 'Escape') onClose()
    event.stopPropagation()
  }
  return (
    <div className="auth-overlay ui-interactive" role="dialog" aria-modal="true" aria-label={label} onKeyDown={stop} onKeyUp={stop}>
      <div className="ui-page auth-page">
        <main className="auth-card ui-card">
          <button type="button" className="auth-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
          <p className="auth-brand">SceneWalk AI</p>
          {children}
        </main>
      </div>
    </div>
  )
}

// 로그인 2단계: 비밀번호로 로그인한 관리자(등록한 사람만)에게 뜸. 닫으면 순례객 기능만 쓰다가, 관리자 기능을 누르면 다시 뜸
function MfaCodeModal() {
  const prompt = useSessionStore((s) => s.mfaPrompt)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!prompt) return null

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await verifyMfa(code)
      setCode('')
    } catch (err) {
      setError(err.message)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthDialog label="2단계 인증" onClose={closeMfaPrompt}>
      <h1 className="auth-title">2단계 인증</h1>
      <p className="ui-sub">{prompt.reason}</p>
      <form onSubmit={submit} noValidate>
        <CodeInput value={code} onChange={setCode} disabled={busy} />
        {error && (
          <p className="ui-field__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="ui-btn ui-btn--primary auth-submit" disabled={busy || code.length !== 6}>
          {busy ? '확인 중…' : '확인'}
        </button>
      </form>
      <button type="button" className="auth-switch" onClick={closeMfaPrompt}>
        나중에 (관리자 기능 없이 둘러보기)
      </button>
    </AuthDialog>
  )
}

// 등록: QR 받기 → 인증 앱(Google Authenticator 등)으로 찍기 → 앱에 뜬 6자리로 확인
function MfaEnrollModal({ onClose }) {
  const [step, setStep] = useState({ loading: true })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    startMfaEnroll()
      .then((enroll) => alive && setStep(enroll))
      .catch((err) => alive && setStep({ failed: err.message }))
    return () => {
      alive = false
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await confirmMfaEnroll(step.factorId, code)
      setStep({ done: true })
    } catch (err) {
      setError(err.message)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthDialog label="2단계 인증 등록" onClose={onClose}>
      <h1 className="auth-title">관리자 2단계 인증 켜기</h1>
      {step.loading && <p className="ui-sub">QR 코드를 만드는 중이에요…</p>}
      {step.failed && (
        <p className="ui-field__error" role="alert">
          {step.failed}
        </p>
      )}
      {step.done && (
        <>
          <p className="ui-sub">켜졌어요. 다음 로그인부터 비밀번호 다음에 인증 앱의 6자리를 넣어야 관리자 기능을 쓸 수 있어요.</p>
          <button type="button" className="ui-btn ui-btn--primary auth-submit" onClick={onClose}>
            닫기
          </button>
        </>
      )}
      {step.factorId && (
        <>
          <p className="ui-sub">휴대폰 인증 앱(Google Authenticator, Microsoft Authenticator 등)으로 아래 QR을 찍고, 앱에 뜬 6자리를 넣어 주세요.</p>
          <img className="auth-qr" src={step.qrCode} alt="2단계 인증 QR 코드" width={180} height={180} />
          <p className="auth-secret">
            QR을 못 찍으면 앱에 직접 입력: <code>{step.secret}</code>
          </p>
          <form onSubmit={submit} noValidate>
            <CodeInput value={code} onChange={setCode} disabled={busy} />
            {error && (
              <p className="ui-field__error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="ui-btn ui-btn--primary auth-submit" disabled={busy || code.length !== 6}>
              {busy ? '확인 중…' : '등록 완료'}
            </button>
          </form>
        </>
      )}
    </AuthDialog>
  )
}

// 관리자 이름표 옆 🔐 버튼: 안 켰으면 등록, 켰는데 이번 로그인에서 코드를 안 넣었으면 코드 창, 다 됐으면 표시만
function MfaButton() {
  const mfa = useSessionStore((s) => s.mfa)
  const [enrolling, setEnrolling] = useState(false)
  const label = !mfa?.enrolled ? '2단계 인증 켜기' : mfa.ok ? '2단계 인증 켜짐' : '2단계 인증 코드 넣기'
  function click(event) {
    event.currentTarget.blur()
    if (!mfa?.enrolled) setEnrolling(true)
    else if (!mfa.ok) openMfaPrompt()
  }
  return (
    <>
      <button type="button" className="ui-btn" onClick={click} title={label} aria-label={label} disabled={Boolean(mfa?.ok)}>
        {mfa?.ok ? '🔐✓' : '🔐'}
      </button>
      {enrolling && <MfaEnrollModal onClose={() => setEnrolling(false)} />}
    </>
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
      {user.role === 'admin' && <MfaButton />}
      <button type="button" className="ui-btn" onClick={(e) => (e.currentTarget.blur(), logout())}>
        로그아웃
      </button>
    </div>
  )
}
