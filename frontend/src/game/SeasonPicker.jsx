import { useEffect } from 'react'
import { SEASON_LABELS, useSeason, useSeasonStore } from './seasons.js'

export default function SeasonPicker() {
  const season = useSeason()
  const preview = useSeasonStore((state) => state.preview)
  const setPreview = useSeasonStore((state) => state.setPreview)
  const refresh = useSeasonStore((state) => state.refresh)

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return (
    <label style={{ display: 'block', marginTop: 8, pointerEvents: 'auto' }}>
      전체 맵 계절{' '}
      <select
        value={preview ?? 'auto'}
        onChange={(event) => {
          const value = event.currentTarget.value
          refresh()
          setPreview(value === 'auto' ? null : value)
          event.currentTarget.blur()
        }}
        style={{ borderRadius: 6, padding: '4px 6px', color: '#2c2a29', background: '#f9f6ee' }}
      >
        <option value="auto">자동{preview === null ? ` · ${SEASON_LABELS[season]}` : ''}</option>
        {Object.entries(SEASON_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
  )
}
