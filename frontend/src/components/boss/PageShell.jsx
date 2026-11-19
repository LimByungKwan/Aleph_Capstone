import { MOCK_USERS } from '../../api/mockDb.js'
import { USE_SERVER } from '../../api/session.js'
import { currentUser, useUiStore } from '../movieZone/uiStore.js'
import { Toasts } from '../movieZone/common.jsx'
import '../movieZone/ui.css'
import '../movieZone/ui-components.css'

// [3. 개발 > 프론트엔드] 사장님·관리자 화면 공통 틀 (위쪽 바 + 3D 맵으로 돌아가기)
export function PageShell({ title, children }) {
  const user = currentUser(useUiStore((s) => s.userId))
  return (
    <div className="ui-page">
      <header className="ui-page__bar">
        <a className="ui-btn" href="#/">
          ← 3D 골목으로
        </a>
        <span className="ui-page__brand">SceneWalk AI · {title}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--ui-muted)', fontSize: 13 }}>{user.name}</span>
      </header>
      <main className="ui-page__inner">{children}</main>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <Toasts />
      </div>
    </div>
  )
}

// 역할이 맞지 않으면 안내 + (시연용) 해당 역할 계정으로 바꾸기 버튼
export function RoleGate({ role, children }) {
  const userId = useUiStore((s) => s.userId)
  const setUser = useUiStore((s) => s.setUser)
  const user = currentUser(userId)
  if (user.role === role) return children

  // 서버 모드에서는 계정 전환 버튼 없음 (역할은 DB에서 관리자만 바꿈)
  const target = USE_SERVER ? null : MOCK_USERS.find((u) => u.role === role)
  const label = role === 'owner' ? '사장님' : '관리자'
  return (
    <div className="ui-card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <h2>{label} 계정으로 들어와 주세요</h2>
      <p className="ui-sub">
        지금은 {user.name} 계정이에요. {USE_SERVER ? `${label} 계정으로 다시 로그인해 주세요.` : '로그인이 연결되면 역할에 맞는 화면만 보여요.'}
      </p>
      {target && (
        <button type="button" className="ui-btn ui-btn--primary" onClick={() => setUser(target.id)}>
          {target.name} 계정으로 전환 (시연용)
        </button>
      )}
    </div>
  )
}
