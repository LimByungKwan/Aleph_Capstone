import { useEffect, useState } from 'react'
import { TIME_PRESETS } from './config.js'
import { useSettings } from './settingsStore.js'
import SeasonPicker from './SeasonPicker.jsx'
import { characters, usePlayerCharacter } from './Player/characterStore.js'
import { useIsAdmin } from '../api/useIsAdmin.js'

// 오른쪽 위 ⚙ 설정 버튼 + 설정창 (시간대 / 그래픽 품질 / 구역 표시)
// 위치: 스탬프북·쿠폰함 버튼 묶음(.ui-hud, 혜진 님 UI) 바로 왼쪽.
//       그 묶음의 폭을 읽기만 해서 겹치지 않게 자리 잡음 (혜진 님 파일은 수정하지 않음)

const TIME_ICONS = { morning: '🌅', noon: '☀️', night: '🌙' }
const GAP = 8

function useHudWidth() {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    let observer = null
    let timer = null
    const attach = () => {
      const hud = document.querySelector('.ui-hud')
      if (!hud) {
        timer = setTimeout(attach, 500) // UI가 늦게 뜨면 잠시 후 다시 찾기
        return
      }
      const update = () => {
        // 포털 장면 등으로 HUD가 빠졌다 새로 만들어지면 옛 요소는 폭 0 → 새 HUD를 다시 찾음
        if (!hud.isConnected) {
          observer?.disconnect()
          setWidth(0)
          attach()
          return
        }
        setWidth(hud.getBoundingClientRect().width)
      }
      update()
      observer = new ResizeObserver(update)
      observer.observe(hud)
    }
    attach()
    return () => {
      clearTimeout(timer)
      observer?.disconnect()
    }
  }, [])
  return width
}

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const hudWidth = useHudWidth()
  const right = 12 + (hudWidth ? hudWidth + GAP : 0)
  const { timeOfDay, quality, showZones, setTimeOfDay, setQuality, setShowZones } = useSettings()
  const { character, choose, busy, error } = usePlayerCharacter()
  // [지민] 계절·시간대·구역 테두리는 시연·개발용이라 관리자만 보임. 캐릭터·그래픽 품질은 모두에게
  const isAdmin = useIsAdmin()

  // 버튼을 누른 뒤 포커스가 남으면 Space(점프)가 버튼을 다시 누르므로 바로 해제
  const press = (action) => (event) => {
    event.currentTarget.blur()
    action()
  }

  return (
    <div style={{ position: 'absolute', top: 12, right, zIndex: 20, fontFamily: 'inherit' }}>
      <button type="button" onClick={press(() => setOpen((v) => !v))} style={styles.gear} title="설정" aria-label="설정" aria-expanded={open}>
        ⚙️
      </button>

        <div hidden={!open} style={styles.panel} role="dialog" aria-label="설정">
          <div style={styles.header}>
            <strong>설정</strong>
            <button type="button" onClick={press(() => setOpen(false))} style={styles.close} aria-label="닫기">
              ✕
            </button>
          </div>
          {isAdmin && <SeasonPicker />}

          <div style={styles.label}>캐릭터</div>
          <div style={styles.segment}>
            {characters.map(item => (
              <button key={item.id} type="button" disabled={busy} aria-pressed={character.id === item.id}
                onClick={press(() => choose(item.id))} style={choice(character.id === item.id)}>
                {item.name}
              </button>
            ))}
          </div>
          {error && <div role="alert" style={styles.hint}>{error}</div>}

          {isAdmin && (
            <>
              <div style={styles.label}>시간대</div>
              <div style={styles.segment}>
                {Object.entries(TIME_PRESETS).map(([key, preset]) => (
                  <button key={key} type="button" onClick={press(() => setTimeOfDay(key))} style={choice(timeOfDay === key)}>
                    {TIME_ICONS[key]} {preset.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={styles.label}>그래픽 품질</div>
          <div style={styles.segment}>
            <button type="button" onClick={press(() => setQuality('high'))} style={choice(quality === 'high')}>
              높음
            </button>
            <button type="button" onClick={press(() => setQuality('low'))} style={choice(quality === 'low')}>
              낮음
            </button>
          </div>
          <div style={styles.hint}>낮음: 그림자 끄기 + 해상도 낮추기 (느린 컴퓨터용)</div>

          {isAdmin && (
            <label style={styles.toggleRow}>
              <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} onClick={(e) => e.currentTarget.blur()} />
              구역 테두리 표시 (관리자)
            </label>
          )}
        </div>
    </div>
  )
}

const choice = (active) => ({
  flex: 1,
  padding: '7px 0',
  border: 'none',
  borderRadius: 8,
  background: active ? '#f472b6' : '#f3f4f6',
  color: active ? '#fff' : '#374151',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
})

const styles = {
  gear: {
    width: 38,
    height: 38,
    border: 'none',
    borderRadius: 10,
    background: '#ffffff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    fontSize: 18,
    cursor: 'pointer',
  },
  panel: {
    position: 'absolute',
    top: 46,
    right: 0,
    width: 240,
    padding: 14,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.96)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    color: '#1f2937',
    fontSize: 13,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 },
  close: { border: 'none', background: 'transparent', fontSize: 15, cursor: 'pointer', color: '#6b7280' },
  label: { margin: '10px 0 6px', fontWeight: 700, color: '#6b7280', fontSize: 12 },
  segment: { display: 'flex', gap: 6 },
  hint: { marginTop: 6, fontSize: 11, color: '#9ca3af' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontWeight: 600 },
}
